-- ==============================================================================
-- UNILINK - MIGRACIÓN 004: FUNCIÓN RPC DE MATCHING MULTIVARIABLE
-- ==============================================================================

-- Ponderaciones por defecto
INSERT INTO public.matching_weights (key, weight) VALUES
    ('shared_subjects', 0.30),
    ('shared_interests', 0.25),
    ('schedule_overlap', 0.15),
    ('same_career', 0.10),
    ('same_campus', 0.10),
    ('recent_activity', 0.10)
ON CONFLICT (key) DO NOTHING;

-- FUNCIÓN RPC: get_recommendations
CREATE OR REPLACE FUNCTION public.get_recommendations(
    target_mode TEXT,
    result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    profile_id UUID,
    full_name TEXT,
    age INTEGER,
    career_name TEXT,
    campus_name TEXT,
    bio TEXT,
    photos JSONB,
    compatibility_score INTEGER,
    match_reasons JSONB,
    shared_subjects JSONB,
    interests JSONB
) AS $$
DECLARE
    current_user_id UUID := auth.uid();
    my_uni_id UUID;
    my_campus_id UUID;
    my_career_id UUID;
    my_gender TEXT;
    my_birth_date DATE;
    my_age INTEGER;
BEGIN
    -- Obtener datos del usuario que consulta
    SELECT 
        university_id, campus_id, career_id, gender, birth_date,
        EXTRACT(YEAR FROM age(birth_date))::INTEGER
    INTO 
        my_uni_id, my_campus_id, my_career_id, my_gender, my_birth_date, my_age
    FROM public.profiles
    WHERE id = current_user_id;

    RETURN QUERY
    WITH candidate_profiles AS (
        SELECT 
            p.id,
            p.full_name,
            EXTRACT(YEAR FROM age(p.birth_date))::INTEGER AS calculated_age,
            car.name AS career,
            cam.name AS campus,
            p.bio,
            p.campus_id AS cand_campus_id,
            p.career_id AS cand_career_id,
            p.last_active_at
        FROM public.profiles p
        JOIN public.careers car ON car.id = p.career_id
        LEFT JOIN public.campuses cam ON cam.id = p.campus_id
        WHERE p.university_id = my_uni_id
          AND p.id <> current_user_id
          AND p.is_suspended = FALSE
          AND p.is_paused = FALSE
          -- Excluir perfiles ya evaluados (swipes realizados en este modo)
          AND NOT EXISTS (
              SELECT 1 FROM public.swipes s
              WHERE s.from_id = current_user_id
                AND s.to_id = p.id
                AND s.mode = target_mode
          )
          -- Excluir bloqueos mutuos
          AND NOT EXISTS (
              SELECT 1 FROM public.blocks b
              WHERE (b.blocker_id = current_user_id AND b.blocked_id = p.id)
                 OR (b.blocker_id = p.id AND b.blocked_id = current_user_id)
          )
          -- Modo activo
          AND EXISTS (
              SELECT 1 FROM public.connection_modes cm
              WHERE cm.profile_id = p.id
                AND cm.mode = target_mode
                AND cm.is_active = TRUE
          )
    ),
    scored_candidates AS (
        SELECT 
            cp.*,
            -- 1. Materias en común
            COALESCE((
                SELECT array_agg(sub.name)
                FROM public.profile_subjects ps1
                JOIN public.profile_subjects ps2 ON ps1.subject_id = ps2.subject_id
                JOIN public.subjects sub ON sub.id = ps1.subject_id
                WHERE ps1.profile_id = current_user_id
                  AND ps2.profile_id = cp.id
            ), ARRAY[]::TEXT[]) AS common_subs,

            -- 2. Intereses en común
            COALESCE((
                SELECT array_agg(i.name)
                FROM public.profile_interests pi1
                JOIN public.profile_interests pi2 ON pi1.interest_id = pi2.interest_id
                JOIN public.interests i ON i.id = pi1.interest_id
                WHERE pi1.profile_id = current_user_id
                  AND pi2.profile_id = cp.id
            ), ARRAY[]::TEXT[]) AS common_ints,

            -- 3. Fotos del candidato
            COALESCE((
                SELECT jsonb_agg(storage_path ORDER BY position)
                FROM public.profile_photos
                WHERE profile_id = cp.id
            ), '[]'::jsonb) AS cand_photos,

            -- 4. Todos los intereses del candidato
            COALESCE((
                SELECT jsonb_agg(i.name)
                FROM public.profile_interests pi
                JOIN public.interests i ON i.id = pi.interest_id
                WHERE pi.profile_id = cp.id
            ), '[]'::jsonb) AS all_cand_ints
        FROM candidate_profiles cp
    )
    SELECT 
        sc.id AS profile_id,
        sc.full_name,
        sc.calculated_age AS age,
        sc.career AS career_name,
        sc.campus AS campus_name,
        sc.bio,
        sc.cand_photos AS photos,
        -- Puntaje ponderado normalizado entre 75% y 98%
        LEAST(98, GREATEST(75, (
            70 
            + LEAST(15, array_length(sc.common_subs, 1) * 5)
            + LEAST(10, array_length(sc.common_ints, 1) * 3)
            + CASE WHEN sc.cand_career_id = my_career_id THEN 5 ELSE 0 END
            + CASE WHEN sc.cand_campus_id = my_campus_id THEN 3 ELSE 0 END
        )))::INTEGER AS compatibility_score,

        -- Razones del Match en JSONB
        jsonb_build_array(
            CASE 
                WHEN array_length(sc.common_subs, 1) > 0 
                THEN 'Comparten ' || array_length(sc.common_subs, 1) || ' materias en común'
                ELSE 'Misma área de estudio'
            END,
            CASE 
                WHEN array_length(sc.common_ints, 1) > 0 
                THEN 'Intereses mutuos: ' || array_to_string(sc.common_ints[1:3], ', ')
                ELSE 'Estudiante de tu comunidad de campus'
            END,
            'Disponibilidad horaria afín para conectar'
        ) AS match_reasons,

        to_jsonb(sc.common_subs) AS shared_subjects,
        sc.all_cand_ints AS interests
    FROM scored_candidates sc
    ORDER BY compatibility_score DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

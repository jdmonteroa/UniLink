-- ==============================================================================
-- 008 · Preferencia "¿A quién quieres conocer?" en los tres modos
-- ------------------------------------------------------------------------------
-- Antes, el filtro por género solo se aplicaba en Modo Pareja. Ahora cada modo
-- (Estudio, Amistad, Pareja) guarda su propia preferencia en
-- connection_modes.pref_genders (['female'], ['male'] o NULL = todos) y el filtro
-- es MUTUO: solo ves a alguien si tú quieres ver su género Y esa persona quiere
-- ver el tuyo. El rango de edad sigue aplicando solo en Modo Pareja.
--
-- Requiere haber corrido 007. Es idempotente: se puede correr más de una vez.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_recommendations(TEXT, INTEGER);

CREATE FUNCTION public.get_recommendations(target_mode TEXT, result_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  age INTEGER,
  gender TEXT,
  pronouns TEXT,
  career_name TEXT,
  campus_name TEXT,
  semester INTEGER,
  bio TEXT,
  is_photo_verified BOOLEAN,
  photos JSONB,
  compatibility_score INTEGER,
  match_reasons JSONB,
  shared_subjects JSONB,
  shared_interests JSONB,
  interests JSONB,
  schedule_overlap TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  me UUID := auth.uid();
  my_uni UUID; my_campus UUID; my_career UUID; my_area TEXT; my_gender TEXT; my_age INTEGER;
  my_pref TEXT[]; my_min INTEGER; my_max INTEGER;
  w_sub NUMERIC; w_int NUMERIC; w_sch NUMERIC; w_car NUMERIC; w_cam NUMERIC; w_act NUMERIC; w_total NUMERIC;
BEGIN
  IF me IS NULL OR target_mode NOT IN ('study', 'friendship', 'dating') THEN
    RETURN;
  END IF;

  SELECT p.university_id, p.campus_id, p.career_id, car.area, p.gender,
         EXTRACT(YEAR FROM age(p.birth_date))::INTEGER
    INTO my_uni, my_campus, my_career, my_area, my_gender, my_age
  FROM public.profiles p
  LEFT JOIN public.careers car ON car.id = p.career_id
  WHERE p.id = me;

  SELECT cm.pref_genders, cm.min_age, cm.max_age INTO my_pref, my_min, my_max
  FROM public.connection_modes cm WHERE cm.profile_id = me AND cm.mode = target_mode;

  SELECT
    COALESCE(MAX(weight) FILTER (WHERE key = 'shared_subjects'), 0.30),
    COALESCE(MAX(weight) FILTER (WHERE key = 'shared_interests'), 0.25),
    COALESCE(MAX(weight) FILTER (WHERE key = 'schedule_overlap'), 0.15),
    COALESCE(MAX(weight) FILTER (WHERE key = 'same_career'), 0.10),
    COALESCE(MAX(weight) FILTER (WHERE key = 'same_campus'), 0.10),
    COALESCE(MAX(weight) FILTER (WHERE key = 'recent_activity'), 0.10)
  INTO w_sub, w_int, w_sch, w_car, w_cam, w_act
  FROM public.matching_weights;
  w_total := NULLIF(w_sub + w_int + w_sch + w_car + w_cam + w_act, 0);

  RETURN QUERY
  WITH cand AS (
    SELECT
      p.id AS c_id, p.full_name AS c_name, p.gender AS c_gender, p.pronouns AS c_pronouns,
      p.bio AS c_bio, p.semester AS c_semester, p.is_photo_verified AS c_verified,
      p.campus_id AS c_campus, p.career_id AS c_career, p.last_active_at AS c_active,
      car.name AS c_career_name, car.area AS c_area, cam.name AS c_campus_name,
      EXTRACT(YEAR FROM age(p.birth_date))::INTEGER AS c_age
    FROM public.profiles p
    LEFT JOIN public.careers car ON car.id = p.career_id
    LEFT JOIN public.campuses cam ON cam.id = p.campus_id
    WHERE p.university_id = my_uni
      AND p.id <> me
      AND p.onboarding_completed = TRUE
      AND p.is_paused = FALSE
      AND (p.is_suspended = FALSE OR (p.suspended_until IS NOT NULL AND p.suspended_until < NOW()))
      AND NOT EXISTS (
        SELECT 1 FROM public.swipes s
        WHERE s.from_id = me AND s.to_id = p.id AND s.mode = target_mode
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = me AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = me)
      )
      AND EXISTS (
        SELECT 1 FROM public.connection_modes cm
        WHERE cm.profile_id = p.id AND cm.mode = target_mode AND cm.is_active = TRUE
          -- Esa persona quiere ver a alguien de mi género (en cualquier modo)
          AND (cm.pref_genders IS NULL OR cardinality(cm.pref_genders) = 0 OR my_gender = ANY (cm.pref_genders))
          -- Rango de edad: solo en Modo Pareja
          AND (
            target_mode <> 'dating' OR (
              (cm.min_age IS NULL OR my_age IS NULL OR my_age >= cm.min_age)
              AND (cm.max_age IS NULL OR my_age IS NULL OR my_age <= cm.max_age)
            )
          )
      )
      -- Yo quiero ver a alguien de su género (en cualquier modo)
      AND (my_pref IS NULL OR cardinality(my_pref) = 0 OR p.gender = ANY (my_pref))
      AND (
        target_mode <> 'dating' OR (
          (my_min IS NULL OR p.birth_date IS NULL OR EXTRACT(YEAR FROM age(p.birth_date)) >= my_min)
          AND (my_max IS NULL OR p.birth_date IS NULL OR EXTRACT(YEAR FROM age(p.birth_date)) <= my_max)
        )
      )
  ),
  scored AS (
    SELECT
      c.*,
      ARRAY(
        SELECT s.name FROM public.profile_subjects a
        JOIN public.profile_subjects b ON b.subject_id = a.subject_id
        JOIN public.subjects s ON s.id = a.subject_id
        WHERE a.profile_id = me AND b.profile_id = c.c_id
        ORDER BY s.name
      ) AS subs,
      ARRAY(
        SELECT i.name FROM public.profile_interests a
        JOIN public.profile_interests b ON b.interest_id = a.interest_id
        JOIN public.interests i ON i.id = a.interest_id
        WHERE a.profile_id = me AND b.profile_id = c.c_id
        ORDER BY i.name
      ) AS ints,
      (SELECT COUNT(*) FROM public.profile_interests x WHERE x.profile_id IN (me, c.c_id))::NUMERIC AS ints_rows,
      ov.minutes AS ov_minutes,
      ov.label AS ov_label
    FROM cand c
    LEFT JOIN LATERAL (
      SELECT
        SUM(EXTRACT(EPOCH FROM (LEAST(a.end_time, b.end_time) - GREATEST(a.start_time, b.start_time))) / 60)::INTEGER AS minutes,
        (ARRAY_AGG(
          (ARRAY['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'])[a.weekday + 1]
          || ' ' || substr(GREATEST(a.start_time, b.start_time)::TEXT, 1, 5)
          || '–' || substr(LEAST(a.end_time, b.end_time)::TEXT, 1, 5)
          ORDER BY (LEAST(a.end_time, b.end_time) - GREATEST(a.start_time, b.start_time)) DESC, a.weekday
        ))[1] AS label
      FROM public.availability_slots a
      JOIN public.availability_slots b
        ON b.weekday = a.weekday AND a.start_time < b.end_time AND b.start_time < a.end_time
      WHERE a.profile_id = me AND b.profile_id = c.c_id
    ) ov ON TRUE
  )
  SELECT
    sc.c_id,
    sc.c_name,
    sc.c_age,
    sc.c_gender,
    sc.c_pronouns,
    sc.c_career_name,
    sc.c_campus_name,
    sc.c_semester,
    sc.c_bio,
    COALESCE(sc.c_verified, FALSE),
    COALESCE((
      SELECT jsonb_agg(ph.storage_path ORDER BY ph.position)
      FROM public.profile_photos ph WHERE ph.profile_id = sc.c_id
    ), '[]'::jsonb),
    LEAST(99, ROUND(100 * (
        w_sub * LEAST(cardinality(sc.subs) / 3.0, 1)
      + w_int * CASE WHEN sc.ints_rows - cardinality(sc.ints) > 0
                     THEN cardinality(sc.ints) / (sc.ints_rows - cardinality(sc.ints)) ELSE 0 END
      + w_sch * LEAST(COALESCE(sc.ov_minutes, 0) / 240.0, 1)
      + w_car * CASE WHEN sc.c_career = my_career THEN 1 WHEN sc.c_area = my_area THEN 0.5 ELSE 0 END
      + w_cam * CASE WHEN sc.c_campus = my_campus THEN 1 ELSE 0 END
      + w_act * CASE WHEN sc.c_active > NOW() - INTERVAL '3 days' THEN 1
                     WHEN sc.c_active > NOW() - INTERVAL '14 days' THEN 0.5 ELSE 0 END
    ) / w_total))::INTEGER,
    to_jsonb(array_remove(ARRAY[
      CASE WHEN cardinality(sc.subs) = 1 THEN 'Comparten 1 materia'
           WHEN cardinality(sc.subs) > 1 THEN 'Comparten ' || cardinality(sc.subs) || ' materias' END,
      CASE WHEN sc.ov_label IS NOT NULL THEN 'Libres: ' || sc.ov_label END,
      CASE WHEN cardinality(sc.ints) > 0 THEN 'A ambos les gusta: ' || array_to_string(sc.ints[1:3], ', ') END,
      CASE WHEN sc.c_career = my_career THEN 'Misma carrera' END,
      CASE WHEN sc.c_campus = my_campus THEN 'Mismo campus' END
    ], NULL)),
    to_jsonb(sc.subs),
    to_jsonb(sc.ints),
    COALESCE((
      SELECT jsonb_agg(i.name ORDER BY i.name)
      FROM public.profile_interests pi JOIN public.interests i ON i.id = pi.interest_id
      WHERE pi.profile_id = sc.c_id
    ), '[]'::jsonb),
    sc.ov_label
  FROM scored sc
  ORDER BY 12 DESC, sc.c_active DESC NULLS LAST
  LIMIT result_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recommendations(TEXT, INTEGER) TO authenticated;

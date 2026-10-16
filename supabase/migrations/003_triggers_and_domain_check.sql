-- ==============================================================================
-- UNILINK - MIGRACIÓN 003: TRIGGERS, VERIFICACIÓN DE DOMINIO Y MATCHES
-- ==============================================================================

-- 1. TRIGGER: VALIDAR DOMINIO INSTITUCIONAL Y CREAR PERFIL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email_domain TEXT;
    matched_university_id UUID;
    user_full_name TEXT;
BEGIN
    -- Extraer el dominio del correo electrónico (ej. 'edu.uaa.mx')
    user_email_domain := lower(split_part(NEW.email, '@', 2));

    -- Validar contra la tabla university_domains
    SELECT university_id INTO matched_university_id
    FROM public.university_domains
    WHERE domain = user_email_domain;

    -- Si el dominio no está registrado, rechazar la creación
    IF matched_university_id IS NULL THEN
        RAISE EXCEPTION 'El correo institucional (%) no pertenece a una universidad registrada. Asegúrate de usar tu correo oficial (ej. @edu.uaa.mx).', NEW.email;
    END IF;

    -- Obtener nombre desde los metadatos o fallback
    user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

    -- Insertar perfil del estudiante vinculado a su universidad
    INSERT INTO public.profiles (
        id,
        full_name,
        university_id,
        role,
        onboarding_completed,
        created_at
    ) VALUES (
        NEW.id,
        user_full_name,
        matched_university_id,
        'student',
        FALSE,
        NOW()
    );

    -- Inicializar modos de conexión activos por defecto
    INSERT INTO public.connection_modes (profile_id, mode, is_active)
    VALUES 
        (NEW.id, 'study', TRUE),
        (NEW.id, 'friendship', TRUE),
        (NEW.id, 'dating', FALSE);

    -- Inicializar suscripción gratuita
    INSERT INTO public.subscriptions (profile_id, plan, status)
    VALUES (NEW.id, 'free', 'active');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asociar el trigger a auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. TRIGGER: DETECTAR LIKE MUTUO Y CREAR MATCH + CONVERSACIÓN
CREATE OR REPLACE FUNCTION public.handle_swipe_action()
RETURNS TRIGGER AS $$
DECLARE
    reciprocal_like_exists BOOLEAN;
    new_match_id UUID;
    ua UUID;
    ub UUID;
    user_plan TEXT;
    today_likes INTEGER;
BEGIN
    -- Solo procesar likes
    IF NEW.action = 'like' THEN
        -- Validar límite diario freemium (25 likes por día para plan 'free')
        SELECT plan INTO user_plan FROM public.subscriptions WHERE profile_id = NEW.from_id;
        IF user_plan = 'free' OR user_plan IS NULL THEN
            SELECT count INTO today_likes 
            FROM public.daily_like_counts 
            WHERE profile_id = NEW.from_id AND swipe_date = CURRENT_DATE;

            IF today_likes >= 25 THEN
                RAISE EXCEPTION 'Has alcanzado tu límite de 25 Me Interesa diarios. Actualiza a Premium para swipes ilimitados.';
            END IF;

            -- Incrementar contador diario
            INSERT INTO public.daily_like_counts (profile_id, swipe_date, count)
            VALUES (NEW.from_id, CURRENT_DATE, 1)
            ON CONFLICT (profile_id, swipe_date) 
            DO UPDATE SET count = daily_like_counts.count + 1;
        END IF;

        -- Verificar si la otra persona ya dio like en este mismo modo
        SELECT EXISTS (
            SELECT 1 FROM public.swipes
            WHERE from_id = NEW.to_id
              AND to_id = NEW.from_id
              AND mode = NEW.mode
              AND action = 'like'
        ) INTO reciprocal_like_exists;

        -- Si es mutuo, crear Match y Conversación
        IF reciprocal_like_exists THEN
            ua := LEAST(NEW.from_id, NEW.to_id);
            ub := GREATEST(NEW.from_id, NEW.to_id);

            -- Crear Match
            INSERT INTO public.matches (user_a, user_b, mode, is_active)
            VALUES (ua, ub, NEW.mode, TRUE)
            RETURNING id INTO new_match_id;

            -- Crear Conversación directa en tiempo real
            INSERT INTO public.conversations (match_id, type)
            VALUES (new_match_id, 'direct');

            -- Notificación para ambos estudiantes
            INSERT INTO public.notifications (user_id, type, payload)
            VALUES 
                (NEW.from_id, 'match', jsonb_build_object('match_id', new_match_id, 'mode', NEW.mode, 'with_user', NEW.to_id)),
                (NEW.to_id, 'match', jsonb_build_object('match_id', new_match_id, 'mode', NEW.mode, 'with_user', NEW.from_id));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_swipe_inserted ON public.swipes;
CREATE TRIGGER on_swipe_inserted
    BEFORE INSERT ON public.swipes
    FOR EACH ROW EXECUTE FUNCTION public.handle_swipe_action();


-- 3. TRIGGER: AUTO-SUSPENSIÓN DE PERFILES CON 3 REPORTES EN 7 DÍAS
CREATE OR REPLACE FUNCTION public.handle_report_threshold()
RETURNS TRIGGER AS $$
DECLARE
    distinct_reports_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT reporter_id) INTO distinct_reports_count
    FROM public.reports
    WHERE reported_id = NEW.reported_id
      AND created_at >= NOW() - INTERVAL '7 days';

    IF distinct_reports_count >= 3 THEN
        -- Ocultar / suspender automáticamente el perfil de Descubrir
        UPDATE public.profiles
        SET is_suspended = TRUE,
            suspended_until = NOW() + INTERVAL '3 days'
        WHERE id = NEW.reported_id;

        -- Registrar en bitácora de moderación
        INSERT INTO public.moderation_actions (target_user_id, action, duration_days, reason)
        VALUES (NEW.reported_id, 'suspend', 3, 'Suspensión automática preventiva por acumulación de 3 reportes en 7 días.');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_report_inserted ON public.reports;
CREATE TRIGGER on_report_inserted
    AFTER INSERT ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.handle_report_threshold();

-- ==============================================================================
-- UNILINK - MIGRACIÓN 007: REPARACIÓN GENERAL
-- ------------------------------------------------------------------------------
-- Córrela UNA vez en el SQL Editor de Supabase, sin importar si antes corriste
-- COMPLETE_SETUP.sql o las migraciones 001-006. Es idempotente: si la vuelves a
-- correr no rompe nada.
--
-- Qué arregla:
--   1. Políticas RLS faltantes (materias, intereses, modos, horarios, bloqueos,
--      reportes, notificaciones...) que impedían guardar el onboarding.
--   2. Perfiles faltantes para usuarios ya registrados.
--   3. Columnas protegidas del perfil (rol, verificación, suspensión).
--   4. Bucket 'avatars' de Storage + políticas para subir fotos por usuario.
--   5. Matching real (get_recommendations) con horarios y preferencias.
--   6. RPCs de chat: mis matches, deshacer match, bloquear, marcar leído.
--   7. Moderación básica de mensajes y chat en tiempo real.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

-- ------------------------------------------------------------------------------
-- 1. FUNCIONES AUXILIARES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_university_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT university_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('moderator', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_match_participant(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id AND auth.uid() IN (m.user_a, m.user_b)
  );
$$;

-- ------------------------------------------------------------------------------
-- 2. RLS ACTIVADO EN TODAS LAS TABLAS
-- ------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'universities','university_domains','campuses','careers','subjects','profiles',
    'profile_photos','profile_subjects','interests','profile_interests','availability_slots',
    'connection_modes','swipes','matches','conversations','messages','blocks','reports',
    'moderation_terms','moderation_flags','moderation_actions','photo_verifications',
    'study_groups','study_group_members','events','event_attendees','tutoring_offers',
    'subscriptions','daily_like_counts','notifications','matching_weights'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS RLS (se borran y se recrean para que queden consistentes)
-- ------------------------------------------------------------------------------

-- Catálogos (lectura)
DROP POLICY IF EXISTS "Lectura pública de universidades" ON public.universities;
CREATE POLICY "Lectura pública de universidades" ON public.universities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Lectura pública de dominios" ON public.university_domains;
CREATE POLICY "Lectura pública de dominios" ON public.university_domains FOR SELECT USING (true);
DROP POLICY IF EXISTS "Lectura de campus" ON public.campuses;
CREATE POLICY "Lectura de campus" ON public.campuses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Lectura de carreras" ON public.careers;
CREATE POLICY "Lectura de carreras" ON public.careers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Lectura de materias" ON public.subjects;
CREATE POLICY "Lectura de materias" ON public.subjects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Lectura de intereses" ON public.interests;
CREATE POLICY "Lectura de intereses" ON public.interests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Lectura de ponderaciones" ON public.matching_weights;
CREATE POLICY "Lectura de ponderaciones" ON public.matching_weights FOR SELECT TO authenticated USING (true);

-- Perfiles
DROP POLICY IF EXISTS "Ver perfiles de la misma universidad" ON public.profiles;
CREATE POLICY "Ver perfiles de la misma universidad" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (
    university_id = public.get_my_university_id()
    AND is_suspended = FALSE
    AND is_paused = FALSE
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = profiles.id)
         OR (b.blocker_id = profiles.id AND b.blocked_id = auth.uid())
    )
  )
);
-- El perfil lo crea el trigger de registro (o ensure_my_profile), nunca el cliente
-- directamente: así nadie puede elegir su universidad o su rol.
DROP POLICY IF EXISTS "Crear propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Actualizar propio perfil" ON public.profiles;
CREATE POLICY "Actualizar propio perfil" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Fotos
DROP POLICY IF EXISTS "Ver fotos de usuarios misma universidad" ON public.profile_photos;
CREATE POLICY "Ver fotos de usuarios misma universidad" ON public.profile_photos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = profile_photos.profile_id
    AND (p.id = auth.uid() OR p.university_id = public.get_my_university_id())
));
DROP POLICY IF EXISTS "Gestionar fotos propias" ON public.profile_photos;
CREATE POLICY "Gestionar fotos propias" ON public.profile_photos FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- Materias, intereses, horarios y modos
DROP POLICY IF EXISTS "Ver materias de perfiles" ON public.profile_subjects;
CREATE POLICY "Ver materias de perfiles" ON public.profile_subjects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Gestionar materias propias" ON public.profile_subjects;
CREATE POLICY "Gestionar materias propias" ON public.profile_subjects FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Ver intereses de perfiles" ON public.profile_interests;
CREATE POLICY "Ver intereses de perfiles" ON public.profile_interests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Gestionar intereses propios" ON public.profile_interests;
CREATE POLICY "Gestionar intereses propios" ON public.profile_interests FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Ver horarios de disponibilidad" ON public.availability_slots;
CREATE POLICY "Ver horarios de disponibilidad" ON public.availability_slots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Gestionar horarios propios" ON public.availability_slots;
CREATE POLICY "Gestionar horarios propios" ON public.availability_slots FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Ver modos de conexion" ON public.connection_modes;
CREATE POLICY "Ver modos de conexion" ON public.connection_modes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Gestionar modos propios" ON public.connection_modes;
CREATE POLICY "Gestionar modos propios" ON public.connection_modes FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- Swipes (solo se puede borrar un "Pasar" propio, para la función Deshacer)
DROP POLICY IF EXISTS "Ver propios swipes" ON public.swipes;
CREATE POLICY "Ver propios swipes" ON public.swipes FOR SELECT TO authenticated USING (auth.uid() = from_id);
DROP POLICY IF EXISTS "Crear propio swipe" ON public.swipes;
CREATE POLICY "Crear propio swipe" ON public.swipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_id);
DROP POLICY IF EXISTS "Deshacer propio pase" ON public.swipes;
CREATE POLICY "Deshacer propio pase" ON public.swipes FOR DELETE TO authenticated
USING (auth.uid() = from_id AND action = 'pass');

-- Matches y conversaciones (los cambios se hacen por RPC)
DROP POLICY IF EXISTS "Ver matches donde participo" ON public.matches;
CREATE POLICY "Ver matches donde participo" ON public.matches FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Ver conversaciones donde participo" ON public.conversations;
CREATE POLICY "Ver conversaciones donde participo" ON public.conversations FOR SELECT TO authenticated
USING (public.is_match_participant(match_id));

-- Mensajes
DROP POLICY IF EXISTS "Ver mensajes de mis conversaciones" ON public.messages;
CREATE POLICY "Ver mensajes de mis conversaciones" ON public.messages FOR SELECT TO authenticated
USING (
  is_hidden = FALSE
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id AND public.is_match_participant(c.match_id)
  )
);
DROP POLICY IF EXISTS "Enviar mensajes a mis conversaciones" ON public.messages;
DROP POLICY IF EXISTS "Enviar mensajes a mis conversaciones con match" ON public.messages;
CREATE POLICY "Enviar mensajes a mis conversaciones con match" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.matches m ON m.id = c.match_id
    WHERE c.id = messages.conversation_id
      AND auth.uid() IN (m.user_a, m.user_b)
      AND m.is_active = TRUE
  )
);

-- Bloqueos y reportes
DROP POLICY IF EXISTS "Ver mis bloqueos" ON public.blocks;
CREATE POLICY "Ver mis bloqueos" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "Crear bloqueo" ON public.blocks;
CREATE POLICY "Crear bloqueo" ON public.blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "Eliminar bloqueo" ON public.blocks;
CREATE POLICY "Eliminar bloqueo" ON public.blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Crear reporte" ON public.reports;
CREATE POLICY "Crear reporte" ON public.reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id AND reporter_id <> reported_id);
DROP POLICY IF EXISTS "Moderadores ven reportes de su universidad" ON public.reports;
CREATE POLICY "Moderadores ven reportes de su universidad" ON public.reports FOR SELECT TO authenticated
USING (public.is_moderator_or_admin() OR auth.uid() = reporter_id);

-- Suscripciones, contador de likes y notificaciones
DROP POLICY IF EXISTS "Ver mi propia suscripcion" ON public.subscriptions;
CREATE POLICY "Ver mi propia suscripcion" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Ver mi contador de likes" ON public.daily_like_counts;
CREATE POLICY "Ver mi contador de likes" ON public.daily_like_counts FOR SELECT TO authenticated USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "Ver mis notificaciones" ON public.notifications;
CREATE POLICY "Ver mis notificaciones" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Actualizar mis notificaciones (marcar leido)" ON public.notifications;
CREATE POLICY "Actualizar mis notificaciones (marcar leido)" ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. PROTEGER COLUMNAS SENSIBLES DEL PERFIL
-- Un estudiante puede editar su perfil, pero no su rol, verificación,
-- suspensión ni universidad. (Las funciones internas sí pueden.)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.id := OLD.id;
    NEW.role := OLD.role;
    NEW.university_id := OLD.university_id;
    NEW.is_photo_verified := OLD.is_photo_verified;
    NEW.is_suspended := OLD.is_suspended;
    NEW.suspended_until := OLD.suspended_until;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_update_protect ON public.profiles;
CREATE TRIGGER on_profile_update_protect
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- ------------------------------------------------------------------------------
-- 5. CREACIÓN DE PERFIL AL REGISTRARSE (versión idempotente)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  matched_university_id UUID;
BEGIN
  SELECT university_id INTO matched_university_id
  FROM public.university_domains
  WHERE domain = lower(split_part(NEW.email, '@', 2));

  IF matched_university_id IS NULL THEN
    RAISE EXCEPTION 'El correo institucional (%) no pertenece a una universidad registrada. Usa tu correo oficial (ej. @edu.uaa.mx).', NEW.email;
  END IF;

  INSERT INTO public.profiles (id, full_name, university_id, role, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    matched_university_id,
    'student',
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.connection_modes (profile_id, mode, is_active)
  VALUES (NEW.id, 'study', TRUE), (NEW.id, 'friendship', TRUE), (NEW.id, 'dating', FALSE)
  ON CONFLICT (profile_id, mode) DO NOTHING;

  INSERT INTO public.subscriptions (profile_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- La app llama a esta función si, por algún motivo, tu perfil no existe.
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  u auth.users%ROWTYPE;
  uni UUID;
BEGIN
  SELECT * INTO u FROM auth.users WHERE id = auth.uid();
  IF u.id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  SELECT university_id INTO uni FROM public.university_domains
  WHERE domain = lower(split_part(u.email, '@', 2));
  IF uni IS NULL THEN
    RAISE EXCEPTION 'Tu correo no pertenece a una universidad registrada.';
  END IF;

  INSERT INTO public.profiles (id, full_name, university_id, role, onboarding_completed)
  VALUES (u.id, COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)), uni, 'student', FALSE)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.connection_modes (profile_id, mode, is_active)
  VALUES (u.id, 'study', TRUE), (u.id, 'friendship', TRUE), (u.id, 'dating', FALSE)
  ON CONFLICT (profile_id, mode) DO NOTHING;

  INSERT INTO public.subscriptions (profile_id, plan, status)
  VALUES (u.id, 'free', 'active')
  ON CONFLICT (profile_id) DO NOTHING;
END;
$$;

-- Reparar usuarios ya registrados que se quedaron sin perfil
INSERT INTO public.profiles (id, full_name, university_id, role, onboarding_completed)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
  d.university_id,
  'student',
  COALESCE((u.raw_user_meta_data->>'onboarding_completed')::BOOLEAN, FALSE)
FROM auth.users u
JOIN public.university_domains d ON d.domain = lower(split_part(u.email, '@', 2))
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

INSERT INTO public.connection_modes (profile_id, mode, is_active)
SELECT p.id, m.mode, m.mode <> 'dating'
FROM public.profiles p
CROSS JOIN (VALUES ('study'), ('friendship'), ('dating')) AS m(mode)
ON CONFLICT (profile_id, mode) DO NOTHING;

INSERT INTO public.subscriptions (profile_id, plan, status)
SELECT p.id, 'free', 'active' FROM public.profiles p
ON CONFLICT (profile_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. SWIPES → MATCH MUTUO + LÍMITE DIARIO GRATUITO
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_swipe_action()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_match_id UUID;
  user_plan TEXT;
  today_likes INTEGER;
BEGIN
  IF NEW.action <> 'like' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO user_plan FROM public.subscriptions WHERE profile_id = NEW.from_id;
  IF COALESCE(user_plan, 'free') = 'free' THEN
    SELECT count INTO today_likes FROM public.daily_like_counts
    WHERE profile_id = NEW.from_id AND swipe_date = CURRENT_DATE;

    IF COALESCE(today_likes, 0) >= 25 THEN
      RAISE EXCEPTION 'Llegaste a tus 25 "Me interesa" de hoy. Vuelve mañana o actualiza a Premium.';
    END IF;

    INSERT INTO public.daily_like_counts (profile_id, swipe_date, count)
    VALUES (NEW.from_id, CURRENT_DATE, 1)
    ON CONFLICT (profile_id, swipe_date) DO UPDATE SET count = daily_like_counts.count + 1;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.swipes
    WHERE from_id = NEW.to_id AND to_id = NEW.from_id AND mode = NEW.mode AND action = 'like'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = NEW.from_id AND blocked_id = NEW.to_id)
       OR (blocker_id = NEW.to_id AND blocked_id = NEW.from_id)
  ) THEN
    INSERT INTO public.matches (user_a, user_b, mode, is_active)
    VALUES (LEAST(NEW.from_id, NEW.to_id), GREATEST(NEW.from_id, NEW.to_id), NEW.mode, TRUE)
    ON CONFLICT (user_a, user_b, mode) DO NOTHING
    RETURNING id INTO new_match_id;

    IF new_match_id IS NOT NULL THEN
      INSERT INTO public.conversations (match_id, type) VALUES (new_match_id, 'direct');

      INSERT INTO public.notifications (user_id, type, payload)
      VALUES
        (NEW.from_id, 'match', jsonb_build_object('match_id', new_match_id, 'mode', NEW.mode, 'with_user', NEW.to_id)),
        (NEW.to_id,   'match', jsonb_build_object('match_id', new_match_id, 'mode', NEW.mode, 'with_user', NEW.from_id));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_swipe_inserted ON public.swipes;
CREATE TRIGGER on_swipe_inserted
  BEFORE INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.handle_swipe_action();

-- ------------------------------------------------------------------------------
-- 7. STORAGE: FOTOS DE PERFIL
-- Cada usuario sube a avatars/<su-id>/archivo.jpg. El bucket es público para
-- poder mostrar las fotos con una URL directa; solo el dueño puede subir/borrar.
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('verifications', 'verifications', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('chat-images',   'chat-images',   FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Lectura de avatares para usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Subir propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Actualizar/Eliminar propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "avatars: lectura" ON storage.objects;
DROP POLICY IF EXISTS "avatars: subir propias" ON storage.objects;
DROP POLICY IF EXISTS "avatars: actualizar propias" ON storage.objects;
DROP POLICY IF EXISTS "avatars: borrar propias" ON storage.objects;

CREATE POLICY "avatars: lectura" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "avatars: subir propias" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

CREATE POLICY "avatars: actualizar propias" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

CREATE POLICY "avatars: borrar propias" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

-- Verificación por selfie (privado: dueño + moderadores)
DROP POLICY IF EXISTS "Subir foto de verificacion propia" ON storage.objects;
DROP POLICY IF EXISTS "Moderadores pueden ver fotos de verificacion" ON storage.objects;
CREATE POLICY "Subir foto de verificacion propia" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'verifications' AND (storage.foldername(name))[1] = auth.uid()::TEXT);
CREATE POLICY "Moderadores pueden ver fotos de verificacion" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'verifications'
  AND ((storage.foldername(name))[1] = auth.uid()::TEXT OR public.is_moderator_or_admin())
);

-- Imágenes de chat: carpeta = id de la conversación; solo participantes.
DROP POLICY IF EXISTS "Subir imagen a conversacion" ON storage.objects;
DROP POLICY IF EXISTS "Ver imagenes de chat autorizadas" ON storage.objects;
CREATE POLICY "Subir imagen a conversacion" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::TEXT = (storage.foldername(name))[1] AND public.is_match_participant(c.match_id)
  )
);
CREATE POLICY "Ver imagenes de chat autorizadas" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-images'
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::TEXT = (storage.foldername(name))[1] AND public.is_match_participant(c.match_id)
  )
);

-- ------------------------------------------------------------------------------
-- 8. MATCHING MULTIVARIABLE
-- ------------------------------------------------------------------------------
INSERT INTO public.matching_weights (key, weight) VALUES
  ('shared_subjects', 0.30),
  ('shared_interests', 0.25),
  ('schedule_overlap', 0.15),
  ('same_career', 0.10),
  ('same_campus', 0.10),
  ('recent_activity', 0.10)
ON CONFLICT (key) DO NOTHING;

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
          AND (
            target_mode <> 'dating' OR (
              (cm.pref_genders IS NULL OR cardinality(cm.pref_genders) = 0 OR my_gender = ANY (cm.pref_genders))
              AND (cm.min_age IS NULL OR my_age IS NULL OR my_age >= cm.min_age)
              AND (cm.max_age IS NULL OR my_age IS NULL OR my_age <= cm.max_age)
            )
          )
      )
      AND (
        target_mode <> 'dating' OR (
          (my_pref IS NULL OR cardinality(my_pref) = 0 OR p.gender = ANY (my_pref))
          AND (my_min IS NULL OR p.birth_date IS NULL OR EXTRACT(YEAR FROM age(p.birth_date)) >= my_min)
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

-- ------------------------------------------------------------------------------
-- 9. RPCs DE MATCHES Y CHAT
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_matches();
CREATE FUNCTION public.get_my_matches()
RETURNS TABLE (
  match_id UUID,
  conversation_id UUID,
  mode TEXT,
  matched_at TIMESTAMPTZ,
  other_id UUID,
  other_name TEXT,
  other_career TEXT,
  other_campus TEXT,
  other_photo TEXT,
  other_instagram TEXT,
  other_verified BOOLEAN,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_sender_id UUID,
  unread_count INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    m.id,
    c.id,
    m.mode,
    m.created_at,
    o.id,
    o.full_name,
    car.name,
    cam.name,
    (SELECT ph.storage_path FROM public.profile_photos ph WHERE ph.profile_id = o.id ORDER BY ph.position LIMIT 1),
    o.instagram_handle,
    COALESCE(o.is_photo_verified, FALSE),
    lm.content,
    lm.created_at,
    lm.sender_id,
    (SELECT COUNT(*)::INTEGER FROM public.messages x
      WHERE x.conversation_id = c.id AND x.sender_id <> auth.uid() AND x.read_at IS NULL AND x.is_hidden = FALSE)
  FROM public.matches m
  JOIN public.conversations c ON c.match_id = m.id
  JOIN public.profiles o ON o.id = CASE WHEN m.user_a = auth.uid() THEN m.user_b ELSE m.user_a END
  LEFT JOIN public.careers car ON car.id = o.career_id
  LEFT JOIN public.campuses cam ON cam.id = o.campus_id
  LEFT JOIN LATERAL (
    SELECT msg.content, msg.created_at, msg.sender_id FROM public.messages msg
    WHERE msg.conversation_id = c.id AND msg.is_hidden = FALSE
    ORDER BY msg.created_at DESC LIMIT 1
  ) lm ON TRUE
  WHERE auth.uid() IN (m.user_a, m.user_b)
    AND m.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = o.id) OR (b.blocker_id = o.id AND b.blocked_id = auth.uid())
    )
  ORDER BY COALESCE(lm.created_at, m.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.unmatch(p_match_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.matches SET is_active = FALSE
  WHERE id = p_match_id AND auth.uid() IN (user_a, user_b);
$$;

CREATE OR REPLACE FUNCTION public.block_user(p_target UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_target = auth.uid() THEN
    RAISE EXCEPTION 'Operación no válida.';
  END IF;

  INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (auth.uid(), p_target)
  ON CONFLICT DO NOTHING;

  UPDATE public.matches SET is_active = FALSE
  WHERE user_a = LEAST(auth.uid(), p_target) AND user_b = GREATEST(auth.uid(), p_target);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.messages msg SET read_at = NOW()
  FROM public.conversations c
  WHERE msg.conversation_id = p_conversation_id
    AND c.id = msg.conversation_id
    AND public.is_match_participant(c.match_id)
    AND msg.sender_id <> auth.uid()
    AND msg.read_at IS NULL;
$$;

-- ------------------------------------------------------------------------------
-- 10. MODERACIÓN DE MENSAJES (anti-acoso + anti-spam)
-- Si el mensaje contiene un término prohibido NO se guarda y se registra en
-- moderation_flags. La app lo detecta porque el insert no devuelve fila.
-- ------------------------------------------------------------------------------
INSERT INTO public.moderation_terms (term, severity) VALUES
  ('idiota', 'medium'), ('estúpida', 'medium'), ('estúpido', 'medium'),
  ('pendeja', 'high'), ('pendejo', 'high'), ('puta', 'high'), ('zorra', 'high'),
  ('mándame nudes', 'high'), ('manda nudes', 'high'), ('pásame tu pack', 'high')
ON CONFLICT (term) DO NOTHING;

CREATE OR REPLACE FUNCTION public.moderate_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  hit TEXT;
  recent INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent FROM public.messages
  WHERE sender_id = NEW.sender_id AND created_at > NOW() - INTERVAL '1 minute';
  IF recent >= 20 THEN
    RAISE EXCEPTION 'Estás enviando mensajes muy rápido. Espera un momento.';
  END IF;

  SELECT t.term INTO hit FROM public.moderation_terms t
  WHERE NEW.content IS NOT NULL
    AND lower(NEW.content) ~ ('(^|[^[:alnum:]])' || regexp_replace(lower(t.term), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '($|[^[:alnum:]])')
  LIMIT 1;

  IF hit IS NOT NULL THEN
    INSERT INTO public.moderation_flags (message_id, sender_id, detected_term)
    VALUES (NULL, NEW.sender_id, hit);
    RETURN NULL; -- se descarta el mensaje
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_moderate ON public.messages;
CREATE TRIGGER on_message_moderate
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.moderate_message();

-- ------------------------------------------------------------------------------
-- 11. CHAT EN TIEMPO REAL
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profile_photos_profile ON public.profile_photos(profile_id, position);
CREATE INDEX IF NOT EXISTS idx_availability_profile ON public.availability_slots(profile_id, weekday);

-- Permisos de ejecución de RPCs para usuarios con sesión
GRANT EXECUTE ON FUNCTION public.get_recommendations(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmatch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_recommendations(TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_matches() FROM anon;
REVOKE EXECUTE ON FUNCTION public.unmatch(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.block_user(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM anon;

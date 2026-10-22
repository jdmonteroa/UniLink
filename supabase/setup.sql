-- ==============================================================================
-- UNILINK · BASE DE DATOS COMPLETA (Supabase)
-- ------------------------------------------------------------------------------
-- Un solo archivo con todo lo que la app necesita. Cópialo completo en el
-- SQL Editor de Supabase y presiona "Run".
--
-- Funciona en un proyecto nuevo y también en uno que ya tenga una versión
-- anterior instalada: es idempotente, así que se puede correr varias veces sin
-- romper nada ni duplicar datos.
--
-- Contenido:
--   1. Tablas e índices
--   2. Seguridad (RLS), perfiles, matches, fotos, recomendaciones, chat y moderación
--   3. Catálogo de la UAA: dominios @edu.uaa.mx, campus, carreras, materias e
--      intereses (obligatorio: sin el dominio nadie puede registrarse)
--   4. Cuentas de prueba (OPCIONAL, desactivado por defecto; ver instrucciones)
--
-- Después de correrlo, en el dashboard de Supabase:
--   · Authentication → URL Configuration: agrega tu URL (http://localhost:5173 y
--     la de producción) en Site URL y Redirect URLs.
-- ==============================================================================


-- ==============================================================================
-- 1. TABLAS E ÍNDICES
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS public.universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    short_name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.university_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    domain CITEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(university_id, name)
);

CREATE TABLE IF NOT EXISTS public.careers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    area TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(university_id, name)
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    career_id UUID NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(career_id, name)
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    birth_date DATE,
    gender TEXT,
    pronouns TEXT,
    bio TEXT CHECK (char_length(bio) <= 300),
    university_id UUID REFERENCES public.universities(id) ON DELETE RESTRICT,
    campus_id UUID REFERENCES public.campuses(id) ON DELETE RESTRICT,
    career_id UUID REFERENCES public.careers(id) ON DELETE RESTRICT,
    semester INTEGER CHECK (semester >= 1 AND semester <= 12),
    instagram_handle TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'moderator', 'admin')),
    is_photo_verified BOOLEAN DEFAULT FALSE,
    is_paused BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspended_until TIMESTAMPTZ,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profile_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0 AND position < 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, position)
);

-- Máximo 2 fotos por perfil (posiciones 0 y 1). En bases creadas antes con
-- límite de 6, se reemplaza la regla; NOT VALID respeta las fotos que ya existen
-- y solo bloquea las nuevas fuera de rango.
ALTER TABLE public.profile_photos DROP CONSTRAINT IF EXISTS profile_photos_position_check;
ALTER TABLE public.profile_photos ADD CONSTRAINT profile_photos_position_check
    CHECK (position >= 0 AND position < 2) NOT VALID;

CREATE TABLE IF NOT EXISTS public.profile_subjects (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    PRIMARY KEY(profile_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profile_interests (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interest_id UUID NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
    PRIMARY KEY(profile_id, interest_id)
);

CREATE TABLE IF NOT EXISTS public.availability_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS public.connection_modes (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('study', 'friendship', 'dating')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    pref_genders TEXT[],
    min_age INTEGER CHECK (min_age >= 18),
    max_age INTEGER CHECK (max_age >= min_age),
    PRIMARY KEY(profile_id, mode)
);

CREATE TABLE IF NOT EXISTS public.swipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    to_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('study', 'friendship', 'dating')),
    action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_id, to_id, mode),
    CHECK (from_id <> to_id)
);

CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('study', 'friendship', 'dating')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_a, user_b, mode),
    CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    image_path TEXT,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blocks (
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (reason IN ('harassment', 'sexual_content', 'fake_profile', 'spam', 'other')),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.moderation_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term TEXT NOT NULL UNIQUE,
    severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high'))
);

CREATE TABLE IF NOT EXISTS public.moderation_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    detected_term TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    moderator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('warn', 'suspend', 'ban', 'dismiss')),
    duration_days INTEGER,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.photo_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    selfie_path TEXT NOT NULL,
    gesture_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    max_members INTEGER DEFAULT 6 CHECK (max_members >= 2 AND max_members <= 20),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_group_members (
    group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(group_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_attendees (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(event_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.tutoring_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('offer', 'request')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
    current_period_end TIMESTAMPTZ,
    provider TEXT DEFAULT 'mock',
    provider_customer_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_like_counts (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    swipe_date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY(profile_id, swipe_date)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('match', 'message', 'event', 'verification')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.matching_weights (
    key TEXT PRIMARY KEY,
    weight NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_university ON public.profiles(university_id);
CREATE INDEX IF NOT EXISTS idx_swipes_from ON public.swipes(from_id);
CREATE INDEX IF NOT EXISTS idx_swipes_to ON public.swipes(to_id);
CREATE INDEX IF NOT EXISTS idx_matches_users ON public.matches(user_a, user_b);


-- ==============================================================================
-- 2. SEGURIDAD, FUNCIONES, FOTOS, RECOMENDACIONES Y CHAT
-- ==============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

-- ------------------------------------------------------------------------------
-- 2.1 FUNCIONES AUXILIARES
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
-- 2.2 RLS ACTIVADO EN TODAS LAS TABLAS
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
-- 2.3 POLÍTICAS RLS (se borran y se recrean para que queden consistentes)
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


-- Grupos de estudio, eventos y tutorías (tablas listas para funciones futuras)
DROP POLICY IF EXISTS "Ver grupos de mi universidad" ON public.study_groups;
DROP POLICY IF EXISTS "Crear grupo de estudio" ON public.study_groups;
CREATE POLICY "Ver grupos de mi universidad" ON public.study_groups FOR SELECT TO authenticated
USING (university_id = public.get_my_university_id());
CREATE POLICY "Crear grupo de estudio" ON public.study_groups FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND university_id = public.get_my_university_id());

-- Eventos: las políticas viejas se eliminan; las nuevas (con moderación) están en la sección 2.13.
DROP POLICY IF EXISTS "Ver eventos de mi universidad" ON public.events;
DROP POLICY IF EXISTS "Crear evento" ON public.events;

DROP POLICY IF EXISTS "Ver tutorias" ON public.tutoring_offers;
DROP POLICY IF EXISTS "Gestionar mis tutorias" ON public.tutoring_offers;
CREATE POLICY "Ver tutorias" ON public.tutoring_offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestionar mis tutorias" ON public.tutoring_offers FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- ------------------------------------------------------------------------------
-- 2.4 PROTEGER COLUMNAS SENSIBLES DEL PERFIL
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
-- 2.5 CREACIÓN DE PERFIL AL REGISTRARSE (versión idempotente)
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
-- 2.6 SWIPES → MATCH MUTUO + LÍMITE DIARIO GRATUITO
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
-- 2.7 STORAGE: FOTOS DE PERFIL
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
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

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
-- 2.8 MATCHING MULTIVARIABLE
-- ------------------------------------------------------------------------------
-- get_recommendations arma la lista de Descubrir. Filtra por universidad, modo
-- activo, perfiles no evaluados, bloqueos y la preferencia "Quiero conocer"
-- (Mujeres / Hombres / Todos), que es MUTUA en los tres modos: solo ves a alguien
-- si tú quieres ver su género y esa persona quiere ver el tuyo. El rango de edad
-- aplica solo en Modo Pareja. La afinidad se calcula con los pesos de abajo.
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
      AND p.role = 'student' -- moderadores y administradores no participan en Descubrir
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


-- ------------------------------------------------------------------------------
-- 2.9 RPCs DE MATCHES Y CHAT
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
-- 2.10 MODERACIÓN DE MENSAJES (anti-acoso + anti-spam)
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


-- Suspensión automática: si 3 personas distintas reportan a alguien en 7 días,
-- su perfil se oculta de Descubrir por 3 días y queda registrado para moderación.
CREATE OR REPLACE FUNCTION public.handle_report_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  distinct_reports_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT reporter_id) INTO distinct_reports_count
  FROM public.reports
  WHERE reported_id = NEW.reported_id
    AND created_at >= NOW() - INTERVAL '7 days';

  IF distinct_reports_count >= 3 THEN
    UPDATE public.profiles
    SET is_suspended = TRUE,
        suspended_until = NOW() + INTERVAL '3 days'
    WHERE id = NEW.reported_id;

    INSERT INTO public.moderation_actions (target_user_id, action, duration_days, reason)
    VALUES (NEW.reported_id, 'suspend', 3, 'Suspensión automática preventiva por acumulación de 3 reportes en 7 días.');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_report_inserted ON public.reports;
CREATE TRIGGER on_report_inserted
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_report_threshold();

-- ------------------------------------------------------------------------------
-- 2.11 CHAT EN TIEMPO REAL
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

-- ------------------------------------------------------------------------------
-- 2.14 LISTA DE ESTUDIANTES (modo Amistad)
-- Misma base que get_recommendations (misma universidad, preferencia mutua, sin
-- bloqueos, sin quien ya evaluaste), pero con filtros opcionales pensados para
-- estudios: carrera, campus, semestre, materia que cursa, interés y búsqueda por
-- texto. Devuelve a cada persona con su foto, intereses y carrera.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_students(TEXT, UUID, UUID, INTEGER, UUID, UUID, TEXT, INTEGER, INTEGER);
CREATE FUNCTION public.list_students(
  p_mode TEXT DEFAULT 'friendship',
  p_career UUID DEFAULT NULL,
  p_campus UUID DEFAULT NULL,
  p_semester INTEGER DEFAULT NULL,
  p_subject UUID DEFAULT NULL,
  p_interest UUID DEFAULT NULL,
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 40,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  profile_id UUID, full_name TEXT, age INTEGER, career_name TEXT, campus_name TEXT, semester INTEGER,
  bio TEXT, is_photo_verified BOOLEAN, photos JSONB, compatibility_score INTEGER,
  match_reasons JSONB, shared_subjects JSONB, shared_interests JSONB, interests JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  q TEXT := NULLIF(btrim(COALESCE(p_query, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF q IS NOT NULL THEN
    q := '%' || replace(replace(replace(lower(left(q, 60)), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  RETURN QUERY
  SELECT r.profile_id, r.full_name, r.age, r.career_name, r.campus_name, r.semester,
         r.bio, r.is_photo_verified, r.photos, r.compatibility_score,
         r.match_reasons, r.shared_subjects, r.shared_interests, r.interests
  FROM public.get_recommendations(p_mode, 1000) r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE (p_career IS NULL OR p.career_id = p_career)
    AND (p_campus IS NULL OR p.campus_id = p_campus)
    AND (p_semester IS NULL OR p.semester = p_semester)
    AND (p_subject IS NULL OR EXISTS (
          SELECT 1 FROM public.profile_subjects ps WHERE ps.profile_id = p.id AND ps.subject_id = p_subject))
    AND (p_interest IS NULL OR EXISTS (
          SELECT 1 FROM public.profile_interests pi WHERE pi.profile_id = p.id AND pi.interest_id = p_interest))
    AND (q IS NULL
         OR lower(r.full_name) LIKE q
         OR lower(COALESCE(r.bio, '')) LIKE q
         OR lower(COALESCE(r.career_name, '')) LIKE q
         OR lower(r.interests::TEXT) LIKE q)
  ORDER BY r.compatibility_score DESC, r.full_name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_students(TEXT, UUID, UUID, INTEGER, UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_students(TEXT, UUID, UUID, INTEGER, UUID, UUID, TEXT, INTEGER, INTEGER) FROM anon;

-- ------------------------------------------------------------------------------
-- 2.15 ENCUENTROS (reemplazan al chat entre matches)
-- Tras un match, cualquiera de los dos propone quedar en un lugar y hora de la
-- escuela con un mensaje corto OBLIGATORIO. La otra persona acepta, rechaza o
-- replantea (otro lugar/hora con su propio mensaje). Máximo 3 rondas por propuesta,
-- una propuesta activa por match, vencen a las 48 h o al pasar la hora.
-- El texto se filtra (insultos, groserías, contenido sexual, amenazas, spam y
-- enlaces) y se rechaza si no pasa: aquí no hay moderador en medio.
-- El Instagram del match solo se muestra cuando hay un encuentro aceptado.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    proposer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    place TEXT NOT NULL CHECK (char_length(place) BETWEEN 3 AND 80),
    when_at TIMESTAMPTZ NOT NULL,
    note TEXT NOT NULL CHECK (char_length(note) BETWEEN 5 AND 200),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'rescheduled', 'cancelled', 'expired')),
    round INTEGER NOT NULL DEFAULT 1 CHECK (round BETWEEN 1 AND 3),
    parent_id UUID REFERENCES public.meetups(id) ON DELETE SET NULL,
    response_note TEXT CHECK (char_length(response_note) <= 200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CHECK (proposer_id <> recipient_id)
);

-- Una sola propuesta esperando respuesta por match
CREATE UNIQUE INDEX IF NOT EXISTS uniq_meetup_pending ON public.meetups(match_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_meetups_match ON public.meetups(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetups_proposer_day ON public.meetups(proposer_id, created_at);

-- Cuándo abrió cada persona un match por última vez (para el punto rojo)
CREATE TABLE IF NOT EXISTS public.meetup_reads (
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(match_id, user_id)
);

ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetup_reads ENABLE ROW LEVEL SECURITY;

-- Solo lectura para quienes participan; todo lo demás pasa por las funciones
DROP POLICY IF EXISTS "Ver mis encuentros" ON public.meetups;
CREATE POLICY "Ver mis encuentros" ON public.meetups FOR SELECT TO authenticated
USING (auth.uid() IN (proposer_id, recipient_id));
DROP POLICY IF EXISTS "Ver mis lecturas" ON public.meetup_reads;
CREATE POLICY "Ver mis lecturas" ON public.meetup_reads FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Devuelve el motivo si el texto no es aceptable (null = está bien)
CREATE OR REPLACE FUNCTION public.meetup_text_problem(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE scan JSONB := public.scan_text(p_text);
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(scan->'hits') h
    WHERE h->>'severity' IN ('medium', 'high') OR h->>'category' = 'link'
  ) THEN
    RETURN 'El texto contiene lenguaje o enlaces que no están permitidos. Reescríbelo.';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.meetup_text_problem(TEXT) FROM PUBLIC, anon, authenticated;

-- Marca como vencidas las propuestas sin respuesta (48 h) o cuya hora ya pasó
CREATE OR REPLACE FUNCTION public.expire_my_stale_meetups()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.meetups SET status = 'expired', updated_at = NOW(), updated_by = NULL
  WHERE status = 'pending'
    AND auth.uid() IN (proposer_id, recipient_id)
    AND (created_at < NOW() - INTERVAL '48 hours' OR when_at < NOW());
$$;
REVOKE EXECUTE ON FUNCTION public.expire_my_stale_meetups() FROM PUBLIC, anon, authenticated;

-- Valida lugar, hora y mensaje de una propuesta o replanteamiento
CREATE OR REPLACE FUNCTION public.validate_meetup_fields(p_place TEXT, p_when TIMESTAMPTZ, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE problem TEXT;
BEGIN
  IF char_length(p_place) < 3 OR char_length(p_place) > 80 THEN
    RAISE EXCEPTION 'Escribe el lugar de la escuela donde se verán (3 a 80 caracteres).';
  END IF;
  IF p_when IS NULL OR p_when < NOW() + INTERVAL '15 minutes' THEN
    RAISE EXCEPTION 'Elige una fecha y hora que todavía no haya pasado (con al menos 15 minutos de margen).';
  END IF;
  IF p_when > NOW() + INTERVAL '60 days' THEN RAISE EXCEPTION 'Elige una fecha dentro de los próximos 60 días.'; END IF;
  IF char_length(p_note) < 5 THEN RAISE EXCEPTION 'Escribe un mensaje para la otra persona (mínimo 5 caracteres).'; END IF;
  IF char_length(p_note) > 200 THEN RAISE EXCEPTION 'El mensaje puede tener máximo 200 caracteres.'; END IF;
  problem := COALESCE(public.meetup_text_problem(p_place), public.meetup_text_problem(p_note));
  IF problem IS NOT NULL THEN RAISE EXCEPTION '%', problem; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_meetup_fields(TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.propose_meetup(UUID, TEXT, TIMESTAMPTZ, TEXT);
CREATE FUNCTION public.propose_meetup(p_match UUID, p_place TEXT, p_when TIMESTAMPTZ, p_note TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  me UUID := auth.uid();
  m RECORD;
  other UUID;
  place TEXT := btrim(COALESCE(p_place, ''));
  note TEXT := btrim(COALESCE(p_note, ''));
  new_id UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Inicia sesión primero.'; END IF;
  SELECT * INTO m FROM public.matches WHERE id = p_match AND is_active = TRUE AND me IN (user_a, user_b);
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese match ya no está disponible.'; END IF;
  other := CASE WHEN m.user_a = me THEN m.user_b ELSE m.user_a END;
  IF EXISTS (SELECT 1 FROM public.blocks WHERE (blocker_id = me AND blocked_id = other) OR (blocker_id = other AND blocked_id = me)) THEN
    RAISE EXCEPTION 'Ese match ya no está disponible.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = me AND is_suspended AND (suspended_until IS NULL OR suspended_until > NOW())) THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida y no puede proponer encuentros.';
  END IF;

  PERFORM public.expire_my_stale_meetups();
  IF EXISTS (SELECT 1 FROM public.meetups WHERE match_id = p_match AND status = 'pending') THEN
    RAISE EXCEPTION 'Ya hay un encuentro esperando respuesta.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.meetups WHERE match_id = p_match AND status = 'accepted' AND when_at > NOW()) THEN
    RAISE EXCEPTION 'Ya tienen un encuentro confirmado. Cancélalo si quieren proponer otro.';
  END IF;
  IF (SELECT COUNT(*) FROM public.meetups WHERE proposer_id = me AND created_at > NOW() - INTERVAL '24 hours') >= 10 THEN
    RAISE EXCEPTION 'Mandaste muchas propuestas hoy. Inténtalo mañana.';
  END IF;

  PERFORM public.validate_meetup_fields(place, p_when, note);
  INSERT INTO public.meetups (match_id, proposer_id, recipient_id, place, when_at, note, updated_by)
  VALUES (p_match, me, other, place, p_when, note, me)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- p_action: 'accept' | 'decline' | 'reschedule'. Solo quien recibió la propuesta.
-- Al replantear se crea una propuesta nueva (ronda + 1) que ahora debe responder
-- quien propuso primero; la nota es obligatoria. Devuelve el id de la propuesta vigente.
DROP FUNCTION IF EXISTS public.respond_meetup(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ);
CREATE FUNCTION public.respond_meetup(
  p_meetup UUID, p_action TEXT, p_note TEXT DEFAULT NULL, p_place TEXT DEFAULT NULL, p_when TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  me UUID := auth.uid();
  mt RECORD;
  note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  place TEXT;
  new_id UUID;
  problem TEXT;
BEGIN
  IF p_action NOT IN ('accept', 'decline', 'reschedule') THEN RAISE EXCEPTION 'Acción no válida.'; END IF;
  SELECT * INTO mt FROM public.meetups WHERE id = p_meetup FOR UPDATE;
  IF NOT FOUND OR mt.recipient_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'Esa propuesta no es tuya para responder.'; END IF;
  IF mt.status <> 'pending' THEN RAISE EXCEPTION 'Esta propuesta ya fue respondida.'; END IF;
  IF mt.created_at < NOW() - INTERVAL '48 hours' OR mt.when_at < NOW() THEN
    UPDATE public.meetups SET status = 'expired', updated_at = NOW(), updated_by = NULL WHERE id = p_meetup;
    RAISE EXCEPTION 'Esta propuesta ya venció.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.matches WHERE id = mt.match_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Ese match ya no está disponible.';
  END IF;

  IF p_action = 'accept' THEN
    UPDATE public.meetups SET status = 'accepted', updated_at = NOW(), updated_by = me WHERE id = p_meetup;
    RETURN p_meetup;
  END IF;

  IF p_action = 'decline' THEN
    IF note IS NOT NULL THEN
      IF char_length(note) > 200 THEN RAISE EXCEPTION 'El mensaje puede tener máximo 200 caracteres.'; END IF;
      problem := public.meetup_text_problem(note);
      IF problem IS NOT NULL THEN RAISE EXCEPTION '%', problem; END IF;
    END IF;
    UPDATE public.meetups SET status = 'declined', response_note = note, updated_at = NOW(), updated_by = me WHERE id = p_meetup;
    RETURN p_meetup;
  END IF;

  -- reschedule
  IF mt.round >= 3 THEN RAISE EXCEPTION 'Ya no se puede replantear: acepta o rechaza el encuentro.'; END IF;
  place := btrim(COALESCE(NULLIF(btrim(COALESCE(p_place, '')), ''), mt.place));
  PERFORM public.validate_meetup_fields(place, p_when, COALESCE(note, ''));
  UPDATE public.meetups SET status = 'rescheduled', updated_at = NOW(), updated_by = me WHERE id = p_meetup;
  INSERT INTO public.meetups (match_id, proposer_id, recipient_id, place, when_at, note, round, parent_id, updated_by)
  VALUES (mt.match_id, me, mt.proposer_id, place, p_when, note, mt.round + 1, p_meetup, me)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Quien propuso cancela una propuesta pendiente; cualquiera de los dos cancela un encuentro aceptado.
DROP FUNCTION IF EXISTS public.cancel_meetup(UUID, TEXT);
CREATE FUNCTION public.cancel_meetup(p_meetup UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  me UUID := auth.uid();
  mt RECORD;
  note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  problem TEXT;
BEGIN
  SELECT * INTO mt FROM public.meetups WHERE id = p_meetup FOR UPDATE;
  IF NOT FOUND OR me NOT IN (mt.proposer_id, mt.recipient_id) THEN RAISE EXCEPTION 'Ese encuentro no existe.'; END IF;
  IF NOT ((mt.status = 'pending' AND mt.proposer_id = me) OR (mt.status = 'accepted' AND mt.when_at > NOW())) THEN
    RAISE EXCEPTION 'Este encuentro ya no se puede cancelar.';
  END IF;
  IF note IS NOT NULL THEN
    IF char_length(note) > 200 THEN RAISE EXCEPTION 'El mensaje puede tener máximo 200 caracteres.'; END IF;
    problem := public.meetup_text_problem(note);
    IF problem IS NOT NULL THEN RAISE EXCEPTION '%', problem; END IF;
  END IF;
  UPDATE public.meetups SET status = 'cancelled', response_note = note, updated_at = NOW(), updated_by = me WHERE id = p_meetup;
END;
$$;

DROP FUNCTION IF EXISTS public.mark_match_seen(UUID);
CREATE FUNCTION public.mark_match_seen(p_match UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.meetup_reads (match_id, user_id, seen_at)
  SELECT m.id, auth.uid(), NOW() FROM public.matches m WHERE m.id = p_match AND auth.uid() IN (m.user_a, m.user_b)
  ON CONFLICT (match_id, user_id) DO UPDATE SET seen_at = NOW();
$$;

-- Historial de propuestas de un match (lo más reciente primero)
DROP FUNCTION IF EXISTS public.get_match_meetups(UUID);
CREATE FUNCTION public.get_match_meetups(p_match UUID)
RETURNS TABLE (
  id UUID, proposer_id UUID, place TEXT, when_at TIMESTAMPTZ, note TEXT, status TEXT, round INTEGER,
  response_note TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, updated_by UUID
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = p_match AND auth.uid() IN (m.user_a, m.user_b)) THEN
    RAISE EXCEPTION 'Ese match no existe.';
  END IF;
  PERFORM public.expire_my_stale_meetups();
  RETURN QUERY
  SELECT x.id, x.proposer_id, x.place, x.when_at, x.note, x.status, x.round, x.response_note, x.created_at, x.updated_at, x.updated_by
  FROM public.meetups x WHERE x.match_id = p_match
  ORDER BY x.created_at DESC LIMIT 12;
END;
$$;

-- Matches de quien consulta con el estado de su encuentro y si hay algo pendiente
-- (needs_attention = punto rojo). El Instagram solo se muestra si hubo un encuentro aceptado.
DROP FUNCTION IF EXISTS public.get_my_connections();
CREATE FUNCTION public.get_my_connections()
RETURNS TABLE (
  match_id UUID, mode TEXT, matched_at TIMESTAMPTZ,
  other_id UUID, other_name TEXT, other_career TEXT, other_campus TEXT, other_semester INTEGER,
  other_bio TEXT, other_photo TEXT, other_instagram TEXT, other_verified BOOLEAN, other_interests JSONB,
  meetup_id UUID, meetup_status TEXT, meetup_proposer_is_me BOOLEAN, meetup_place TEXT, meetup_when TIMESTAMPTZ,
  meetup_round INTEGER, meetup_note TEXT, meetup_response_note TEXT, meetup_updated_at TIMESTAMPTZ,
  needs_attention BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  PERFORM public.expire_my_stale_meetups();
  RETURN QUERY
  SELECT m.id, m.mode, m.created_at,
         o.id, o.full_name, car.name, cam.name, o.semester,
         o.bio,
         (SELECT ph.storage_path FROM public.profile_photos ph WHERE ph.profile_id = o.id ORDER BY ph.position LIMIT 1),
         CASE WHEN EXISTS (SELECT 1 FROM public.meetups a WHERE a.match_id = m.id AND a.status = 'accepted')
              THEN o.instagram_handle END,
         COALESCE(o.is_photo_verified, FALSE),
         COALESCE((SELECT jsonb_agg(i.name ORDER BY i.name) FROM public.profile_interests pi
                   JOIN public.interests i ON i.id = pi.interest_id WHERE pi.profile_id = o.id), '[]'::JSONB),
         cur.id, cur.status, (cur.proposer_id = me), cur.place, cur.when_at,
         cur.round, cur.note, cur.response_note, cur.updated_at,
         COALESCE(
           (cur.status = 'pending' AND cur.recipient_id = me)
           OR (cur.status IN ('accepted', 'declined', 'cancelled')
               AND cur.updated_by IS DISTINCT FROM me
               AND cur.updated_at > COALESCE(rd.seen_at, '-infinity'::TIMESTAMPTZ)),
           FALSE)
  FROM public.matches m
  JOIN public.profiles o ON o.id = CASE WHEN m.user_a = me THEN m.user_b ELSE m.user_a END
  LEFT JOIN public.careers car ON car.id = o.career_id
  LEFT JOIN public.campuses cam ON cam.id = o.campus_id
  LEFT JOIN public.meetup_reads rd ON rd.match_id = m.id AND rd.user_id = me
  LEFT JOIN LATERAL (
    SELECT x.* FROM public.meetups x WHERE x.match_id = m.id ORDER BY x.created_at DESC LIMIT 1
  ) cur ON TRUE
  WHERE me IN (m.user_a, m.user_b)
    AND m.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = me AND b.blocked_id = o.id) OR (b.blocker_id = o.id AND b.blocked_id = me)
    )
  ORDER BY 23 DESC, COALESCE(cur.updated_at, m.created_at) DESC;
END;
$$;

-- Para que el punto rojo aparezca en vivo
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meetups'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meetups;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.propose_meetup(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_meetup(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_meetup(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_match_seen(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_meetups(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_connections() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.propose_meetup(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_meetup(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_meetup(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_match_seen(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_match_meetups(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_connections() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_matches() FROM anon;
REVOKE EXECUTE ON FUNCTION public.unmatch(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.block_user(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM anon;


-- ------------------------------------------------------------------------------
-- 2.12 GRUPOS (visibles para toda la universidad, entrada con aprobación)
-- Cualquiera puede crear un grupo y queda como creador y administrador. El enlace
-- del grupo (WhatsApp u otra red) se guarda en group_links y SOLO lo puede leer
-- quien ya es miembro. Para entrar se manda una solicitud que aprueba un admin.
-- Nada se escribe directo en las tablas: todo pasa por las funciones de abajo.
-- (Las tablas viejas study_groups/study_group_members ya no se usan.)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 60),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
    category TEXT NOT NULL DEFAULT 'otro' CHECK (category IN (
        'estudio','deporte','arte','musica','videojuegos','tecnologia','idiomas','voluntariado','social','otro')),
    image_path TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_links (
    group_id UUID PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
    url TEXT NOT NULL CHECK (char_length(url) <= 300)
);

CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(group_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.group_join_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT CHECK (char_length(message) <= 200),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    UNIQUE(group_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_groups_university ON public.groups(university_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_profile ON public.group_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_group_requests_group ON public.group_join_requests(group_id, status);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(p_group UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group AND profile_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = p_group AND profile_id = auth.uid() AND role = 'admin'
  );
$$;

-- Solo lectura. Cualquier escritura se hace con las funciones (SECURITY DEFINER).
DROP POLICY IF EXISTS "Ver grupos de mi universidad (nuevos)" ON public.groups;
CREATE POLICY "Ver grupos de mi universidad (nuevos)" ON public.groups FOR SELECT TO authenticated
USING (university_id = public.get_my_university_id());

DROP POLICY IF EXISTS "Ver enlace solo si soy miembro" ON public.group_links;
CREATE POLICY "Ver enlace solo si soy miembro" ON public.group_links FOR SELECT TO authenticated
USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Ver miembros de mis grupos" ON public.group_members;
CREATE POLICY "Ver miembros de mis grupos" ON public.group_members FOR SELECT TO authenticated
USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Ver mis solicitudes o las de mis grupos" ON public.group_join_requests;
CREATE POLICY "Ver mis solicitudes o las de mis grupos" ON public.group_join_requests FOR SELECT TO authenticated
USING (profile_id = auth.uid() OR public.is_group_admin(group_id));

-- Enlace permitido: https:// y solo redes/mensajeros conocidos (evita enlaces raros).
CREATE OR REPLACE FUNCTION public.validate_group_link(p_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  u TEXT := btrim(COALESCE(p_url, ''));
  host TEXT;
BEGIN
  IF u = '' OR char_length(u) > 300 OR u !~* '^https://[^[:space:]/?#]+([/?#][^[:space:]]*)?$' THEN
    RAISE EXCEPTION 'Pega el enlace completo del grupo (debe empezar con https://).';
  END IF;
  host := regexp_replace(lower(substring(u from '^[hH][tT][tT][pP][sS]://([^/?#]+)')), '^www\.', '');
  IF host NOT IN (
    'chat.whatsapp.com', 'whatsapp.com', 'wa.me',
    'instagram.com', 'ig.me',
    't.me', 'telegram.me', 'telegram.dog',
    'discord.gg', 'discord.com',
    'facebook.com', 'm.facebook.com', 'fb.me', 'm.me',
    'signal.group', 'signal.me'
  ) THEN
    RAISE EXCEPTION 'Usa un enlace de WhatsApp, Instagram, Telegram, Discord, Facebook o Signal.';
  END IF;
  RETURN u;
END;
$$;

DROP FUNCTION IF EXISTS public.create_group(TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE FUNCTION public.create_group(
  p_name TEXT, p_description TEXT, p_category TEXT, p_image_path TEXT, p_link TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  me UUID := auth.uid();
  uni UUID;
  nm TEXT := btrim(COALESCE(p_name, ''));
  ds TEXT := btrim(COALESCE(p_description, ''));
  new_id UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Inicia sesión para crear un grupo.'; END IF;
  SELECT university_id INTO uni FROM public.profiles
  WHERE id = me AND onboarding_completed = TRUE AND is_suspended = FALSE;
  IF uni IS NULL THEN RAISE EXCEPTION 'Completa tu perfil para crear grupos.'; END IF;

  IF char_length(nm) < 3 OR char_length(nm) > 60 THEN
    RAISE EXCEPTION 'El nombre del grupo debe tener entre 3 y 60 caracteres.';
  END IF;
  IF char_length(ds) > 500 THEN RAISE EXCEPTION 'La descripción puede tener máximo 500 caracteres.'; END IF;
  IF p_category NOT IN ('estudio','deporte','arte','musica','videojuegos','tecnologia','idiomas','voluntariado','social','otro') THEN
    RAISE EXCEPTION 'Elige una categoría válida.';
  END IF;
  IF p_image_path IS NOT NULL AND p_image_path NOT LIKE me::TEXT || '/%' THEN
    RAISE EXCEPTION 'Imagen no válida.';
  END IF;
  IF (SELECT COUNT(*) FROM public.groups WHERE created_by = me) >= 5 THEN
    RAISE EXCEPTION 'Ya creaste 5 grupos. Elimina uno para crear otro.';
  END IF;

  INSERT INTO public.groups (university_id, name, description, category, image_path, created_by)
  VALUES (uni, nm, ds, p_category, p_image_path, me)
  RETURNING id INTO new_id;
  INSERT INTO public.group_links (group_id, url) VALUES (new_id, public.validate_group_link(p_link));
  INSERT INTO public.group_members (group_id, profile_id, role) VALUES (new_id, me, 'admin');
  RETURN new_id;
END;
$$;

DROP FUNCTION IF EXISTS public.update_group(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE FUNCTION public.update_group(
  p_group UUID, p_name TEXT, p_description TEXT, p_category TEXT, p_image_path TEXT, p_link TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  nm TEXT := btrim(COALESCE(p_name, ''));
  ds TEXT := btrim(COALESCE(p_description, ''));
BEGIN
  IF NOT public.is_group_admin(p_group) THEN RAISE EXCEPTION 'Solo los administradores pueden editar el grupo.'; END IF;
  IF char_length(nm) < 3 OR char_length(nm) > 60 THEN
    RAISE EXCEPTION 'El nombre del grupo debe tener entre 3 y 60 caracteres.';
  END IF;
  IF char_length(ds) > 500 THEN RAISE EXCEPTION 'La descripción puede tener máximo 500 caracteres.'; END IF;
  IF p_category NOT IN ('estudio','deporte','arte','musica','videojuegos','tecnologia','idiomas','voluntariado','social','otro') THEN
    RAISE EXCEPTION 'Elige una categoría válida.';
  END IF;
  IF p_image_path IS NOT NULL AND p_image_path NOT LIKE me::TEXT || '/%'
     AND p_image_path IS DISTINCT FROM (SELECT image_path FROM public.groups WHERE id = p_group) THEN
    RAISE EXCEPTION 'Imagen no válida.';
  END IF;

  UPDATE public.groups SET name = nm, description = ds, category = p_category, image_path = p_image_path
  WHERE id = p_group;
  IF p_link IS NOT NULL AND btrim(p_link) <> '' THEN
    UPDATE public.group_links SET url = public.validate_group_link(p_link) WHERE group_id = p_group;
  END IF;
END;
$$;

-- Devuelve la ruta de la imagen para que la app pueda borrar el archivo.
DROP FUNCTION IF EXISTS public.delete_group(UUID);
CREATE FUNCTION public.delete_group(p_group UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE img TEXT;
BEGIN
  SELECT image_path INTO img FROM public.groups WHERE id = p_group AND created_by = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Solo el creador puede eliminar el grupo.'; END IF;
  DELETE FROM public.groups WHERE id = p_group;
  RETURN img;
END;
$$;

DROP FUNCTION IF EXISTS public.list_groups();
CREATE FUNCTION public.list_groups()
RETURNS TABLE (
  id UUID, name TEXT, description TEXT, category TEXT, image_path TEXT,
  created_by UUID, creator_name TEXT, created_at TIMESTAMPTZ,
  member_count INTEGER, my_role TEXT, my_request_status TEXT, pending_requests INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.description, g.category, g.image_path,
         g.created_by, p.full_name, g.created_at,
         (SELECT COUNT(*) FROM public.group_members m WHERE m.group_id = g.id)::INTEGER,
         mine.role,
         req.status,
         CASE WHEN mine.role = 'admin'
              THEN (SELECT COUNT(*) FROM public.group_join_requests r WHERE r.group_id = g.id AND r.status = 'pending')::INTEGER
              ELSE 0 END
  FROM public.groups g
  JOIN public.profiles p ON p.id = g.created_by
  LEFT JOIN public.group_members mine ON mine.group_id = g.id AND mine.profile_id = me
  LEFT JOIN public.group_join_requests req ON req.group_id = g.id AND req.profile_id = me
  WHERE g.university_id = public.get_my_university_id()
  ORDER BY (mine.role IS NOT NULL) DESC, g.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_group_link(UUID);
CREATE FUNCTION public.get_group_link(p_group UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE link TEXT;
BEGIN
  IF NOT public.is_group_member(p_group) THEN RAISE EXCEPTION 'Solo los miembros pueden ver el enlace.'; END IF;
  SELECT url INTO link FROM public.group_links WHERE group_id = p_group;
  RETURN link;
END;
$$;

DROP FUNCTION IF EXISTS public.request_join_group(UUID, TEXT);
CREATE FUNCTION public.request_join_group(p_group UUID, p_message TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  existing RECORD;
  msg TEXT := NULLIF(btrim(COALESCE(p_message, '')), '');
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Inicia sesión primero.'; END IF;
  IF msg IS NOT NULL AND char_length(msg) > 200 THEN RAISE EXCEPTION 'El mensaje puede tener máximo 200 caracteres.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.groups WHERE id = p_group AND university_id = public.get_my_university_id()) THEN
    RAISE EXCEPTION 'Ese grupo no existe.';
  END IF;
  IF public.is_group_member(p_group) THEN RAISE EXCEPTION 'Ya eres miembro de este grupo.'; END IF;

  SELECT * INTO existing FROM public.group_join_requests WHERE group_id = p_group AND profile_id = me;
  IF FOUND AND existing.status = 'pending' THEN RAISE EXCEPTION 'Ya tienes una solicitud pendiente.'; END IF;
  IF FOUND AND existing.status = 'rejected' AND existing.resolved_at > NOW() - INTERVAL '3 days' THEN
    RAISE EXCEPTION 'Tu solicitud fue rechazada. Podrás intentarlo de nuevo en unos días.';
  END IF;

  INSERT INTO public.group_join_requests (group_id, profile_id, message)
  VALUES (p_group, me, msg)
  ON CONFLICT (group_id, profile_id) DO UPDATE
    SET status = 'pending', message = EXCLUDED.message, created_at = NOW(), resolved_by = NULL, resolved_at = NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.cancel_join_request(UUID);
CREATE FUNCTION public.cancel_join_request(p_group UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.group_join_requests
  WHERE group_id = p_group AND profile_id = auth.uid() AND status = 'pending';
$$;

DROP FUNCTION IF EXISTS public.get_group_requests(UUID);
CREATE FUNCTION public.get_group_requests(p_group UUID)
RETURNS TABLE (
  request_id UUID, profile_id UUID, full_name TEXT, career_name TEXT, semester INTEGER,
  photo TEXT, message TEXT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_group_admin(p_group) THEN RAISE EXCEPTION 'Solo los administradores ven las solicitudes.'; END IF;
  RETURN QUERY
  SELECT r.id, p.id, p.full_name, car.name, p.semester,
         (SELECT ph.storage_path FROM public.profile_photos ph WHERE ph.profile_id = p.id ORDER BY ph.position LIMIT 1),
         r.message, r.created_at
  FROM public.group_join_requests r
  JOIN public.profiles p ON p.id = r.profile_id
  LEFT JOIN public.careers car ON car.id = p.career_id
  WHERE r.group_id = p_group AND r.status = 'pending'
  ORDER BY r.created_at;
END;
$$;

DROP FUNCTION IF EXISTS public.resolve_join_request(UUID, BOOLEAN);
CREATE FUNCTION public.resolve_join_request(p_request UUID, p_approve BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE req RECORD;
BEGIN
  SELECT * INTO req FROM public.group_join_requests WHERE id = p_request;
  IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud ya no existe.'; END IF;
  IF NOT public.is_group_admin(req.group_id) THEN RAISE EXCEPTION 'Solo los administradores pueden responder solicitudes.'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Esta solicitud ya fue respondida.'; END IF;

  UPDATE public.group_join_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      resolved_by = auth.uid(), resolved_at = NOW()
  WHERE id = p_request;
  IF p_approve THEN
    INSERT INTO public.group_members (group_id, profile_id, role)
    VALUES (req.group_id, req.profile_id, 'member')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.get_group_members(UUID);
CREATE FUNCTION public.get_group_members(p_group UUID)
RETURNS TABLE (
  profile_id UUID, full_name TEXT, career_name TEXT, semester INTEGER, photo TEXT,
  role TEXT, is_creator BOOLEAN, joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_group_member(p_group) THEN RAISE EXCEPTION 'Solo los miembros ven la lista de miembros.'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, car.name, p.semester,
         (SELECT ph.storage_path FROM public.profile_photos ph WHERE ph.profile_id = p.id ORDER BY ph.position LIMIT 1),
         m.role, (g.created_by = p.id), m.joined_at
  FROM public.group_members m
  JOIN public.groups g ON g.id = m.group_id
  JOIN public.profiles p ON p.id = m.profile_id
  LEFT JOIN public.careers car ON car.id = p.career_id
  WHERE m.group_id = p_group
  ORDER BY (g.created_by = p.id) DESC, (m.role = 'admin') DESC, m.joined_at;
END;
$$;

-- Solo el creador nombra o quita administradores, y el candidato ya debe ser miembro.
DROP FUNCTION IF EXISTS public.set_group_admin(UUID, UUID, BOOLEAN);
CREATE FUNCTION public.set_group_admin(p_group UUID, p_profile UUID, p_make_admin BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE creator UUID;
BEGIN
  SELECT created_by INTO creator FROM public.groups WHERE id = p_group;
  IF creator IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Solo el creador puede nombrar administradores.'; END IF;
  IF p_profile = creator THEN RAISE EXCEPTION 'El creador siempre es administrador.'; END IF;
  UPDATE public.group_members SET role = CASE WHEN p_make_admin THEN 'admin' ELSE 'member' END
  WHERE group_id = p_group AND profile_id = p_profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa persona primero debe unirse al grupo.'; END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.remove_group_member(UUID, UUID);
CREATE FUNCTION public.remove_group_member(p_group UUID, p_profile UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  creator UUID;
  target_role TEXT;
BEGIN
  IF NOT public.is_group_admin(p_group) THEN RAISE EXCEPTION 'Solo los administradores pueden quitar miembros.'; END IF;
  SELECT created_by INTO creator FROM public.groups WHERE id = p_group;
  IF p_profile = creator THEN RAISE EXCEPTION 'No se puede quitar al creador del grupo.'; END IF;
  IF p_profile = auth.uid() THEN RAISE EXCEPTION 'Para salir usa "Salir del grupo".'; END IF;
  SELECT role INTO target_role FROM public.group_members WHERE group_id = p_group AND profile_id = p_profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa persona ya no está en el grupo.'; END IF;
  IF target_role = 'admin' AND creator <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el creador puede quitar a otro administrador.';
  END IF;
  DELETE FROM public.group_members WHERE group_id = p_group AND profile_id = p_profile;
END;
$$;

DROP FUNCTION IF EXISTS public.leave_group(UUID);
CREATE FUNCTION public.leave_group(p_group UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.groups WHERE id = p_group AND created_by = auth.uid()) THEN
    RAISE EXCEPTION 'El creador no puede salir del grupo. Puedes eliminarlo desde su pantalla.';
  END IF;
  DELETE FROM public.group_members WHERE group_id = p_group AND profile_id = auth.uid();
  -- Al salir se borra la solicitud vieja para poder volver a pedir entrada
  DELETE FROM public.group_join_requests WHERE group_id = p_group AND profile_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_group(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_groups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_join_group(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_join_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_requests(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_join_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_group_admin(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_group(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_group(TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_group(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_group(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_groups() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_group_link(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_join_group(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_join_request(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_group_requests(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_join_request(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_group_members(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_group_admin(UUID, UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_group_member(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_group(UUID) FROM anon;


-- ------------------------------------------------------------------------------
-- 2.13 EVENTOS Y AVISOS CON MODERACIÓN
-- Cualquiera puede mandar un evento o aviso (texto, imagen o ambos), pero NADA se
-- publica hasta que un moderador/administrador lo aprueba. Los filtros solo
-- ANOTAN el resultado (texto: lista de términos; imagen: Google SafeSearch) para
-- que la persona que modera decida con contexto: aprobar, rechazar o rechazar y
-- sancionar. Todas las escrituras pasan por funciones; las tablas son de lectura.
--
-- Para dar permisos de moderación a alguien (una sola vez, desde el SQL Editor):
--   UPDATE public.profiles SET role = 'moderator' WHERE id = '<uuid del usuario>';
--   (usa 'admin' para cuentas dedicadas a moderar; ver supabase/seed-admins.sql)
--
-- Análisis de imagen (SafeSearch): ver el contrato en el README, sección
-- "Moderación de eventos". La función set_event_image_scan() la llama una Edge Function.
-- ------------------------------------------------------------------------------
ALTER TABLE public.events ALTER COLUMN location DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'otro';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS text_scan JSONB;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_scan JSONB;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days');

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events ADD CONSTRAINT events_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;
ALTER TABLE public.events ADD CONSTRAINT events_category_check
  CHECK (category IN ('mercadito', 'reunion', 'academico', 'cultural', 'deportivo', 'aviso', 'otro'));

-- Las sanciones por eventos se registran junto a las demás acciones de moderación
ALTER TABLE public.moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_action_check;
ALTER TABLE public.moderation_actions ADD CONSTRAINT moderation_actions_action_check
  CHECK (action IN ('warn', 'suspend', 'ban', 'dismiss', 'strike'));
ALTER TABLE public.moderation_actions ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.event_reports (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('offensive', 'sexual', 'spam', 'false', 'other')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(event_id, reporter_id)
);

-- Lista de términos para el filtro de texto (aparte de la del chat para no cambiarlo)
CREATE TABLE IF NOT EXISTS public.content_filter_terms (
    term TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('insult', 'profanity', 'sexual', 'violence', 'spam')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_events_feed ON public.events(university_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_events_author ON public.events(created_by, created_at DESC);

ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_filter_terms ENABLE ROW LEVEL SECURITY;

-- Solo lectura: lo publicado de mi universidad, lo mío, o todo si soy moderador
DROP POLICY IF EXISTS "Ver eventos aprobados, propios o como moderador" ON public.events;
CREATE POLICY "Ver eventos aprobados, propios o como moderador" ON public.events FOR SELECT TO authenticated
USING (
  university_id = public.get_my_university_id()
  AND (
    (status = 'approved' AND expires_at > NOW())
    OR created_by = auth.uid()
    OR public.is_moderator_or_admin()
  )
);

-- Términos: sin políticas = solo las funciones (SECURITY DEFINER) los leen.
-- Reportes de eventos: solo los ve quien modera.
DROP POLICY IF EXISTS "Moderadores ven reportes de eventos" ON public.event_reports;
CREATE POLICY "Moderadores ven reportes de eventos" ON public.event_reports FOR SELECT TO authenticated
USING (public.is_moderator_or_admin());

-- Imágenes de eventos: bucket público con rutas imposibles de adivinar. Una imagen
-- pendiente solo se conoce por la fila del evento, que no se ve hasta aprobarse.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-images', 'event-images', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "event-images: lectura" ON storage.objects;
DROP POLICY IF EXISTS "event-images: subir propias" ON storage.objects;
DROP POLICY IF EXISTS "event-images: borrar propias o moderar" ON storage.objects;
CREATE POLICY "event-images: lectura" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-images');
CREATE POLICY "event-images: subir propias" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-images' AND (storage.foldername(name))[1] = auth.uid()::TEXT);
CREATE POLICY "event-images: borrar propias o moderar" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-images'
  AND ((storage.foldername(name))[1] = auth.uid()::TEXT OR public.is_moderator_or_admin())
);

-- ---- Filtro de texto ----------------------------------------------------------
-- Normaliza para que "PÚT4", "puuuta" o "p.u.t.a" no se escapen tan fácil:
-- minúsculas, sin acentos, números parecidos a letras y letras repetidas colapsadas.
CREATE OR REPLACE FUNCTION public.normalize_filter_text(t TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT regexp_replace(
    translate(lower(COALESCE(t, '')), 'áàäâéèëêíìïîóòöôúùüûñ0134578@$', 'aaaaeeeeiiiioooouuuunoieastbas'),
    '(.)\1+', '\1', 'g'
  );
$$;

INSERT INTO public.content_filter_terms (term, category, severity) VALUES
  -- insultos
  ('idiota', 'insult', 'medium'), ('imbécil', 'insult', 'medium'), ('estúpido', 'insult', 'medium'),
  ('estúpida', 'insult', 'medium'), ('pendejo', 'insult', 'high'), ('pendeja', 'insult', 'high'),
  ('cabrón', 'insult', 'medium'), ('cabrona', 'insult', 'medium'), ('culero', 'insult', 'medium'),
  ('culera', 'insult', 'medium'), ('mamón', 'insult', 'low'), ('mamona', 'insult', 'low'),
  ('inútil', 'insult', 'low'), ('retrasado', 'insult', 'high'), ('retrasada', 'insult', 'high'),
  ('maricón', 'insult', 'high'), ('puto', 'insult', 'high'), ('putos', 'insult', 'high'),
  ('puta', 'insult', 'high'), ('putas', 'insult', 'high'), ('zorra', 'insult', 'high'),
  ('hdp', 'insult', 'high'), ('hijo de puta', 'insult', 'high'),
  ('hijo de tu madre', 'insult', 'high'), ('asqueroso', 'insult', 'low'),
  -- groserías
  ('chingar', 'profanity', 'medium'), ('chingada', 'profanity', 'medium'), ('chingado', 'profanity', 'medium'),
  ('chinga tu madre', 'profanity', 'high'), ('chingatumadre', 'profanity', 'high'),
  ('verga', 'profanity', 'medium'), ('vete a la verga', 'profanity', 'high'), ('vales verga', 'profanity', 'high'),
  ('mierda', 'profanity', 'low'), ('joder', 'profanity', 'low'), ('carajo', 'profanity', 'low'),
  ('pinche', 'profanity', 'low'),
  -- contenido sexual
  ('sexo', 'sexual', 'medium'), ('sexual', 'sexual', 'low'), ('porno', 'sexual', 'high'),
  ('pornografía', 'sexual', 'high'), ('nudes', 'sexual', 'high'), ('nude', 'sexual', 'high'),
  ('manda pack', 'sexual', 'high'), ('pasa pack', 'sexual', 'high'),
  ('onlyfans', 'sexual', 'high'), ('follar', 'sexual', 'high'), ('coger', 'sexual', 'medium'),
  ('tetas', 'sexual', 'high'), ('nalgas', 'sexual', 'medium'), ('pene', 'sexual', 'high'),
  ('vagina', 'sexual', 'medium'), ('masturbación', 'sexual', 'high'), ('orgía', 'sexual', 'high'),
  ('desnudo', 'sexual', 'medium'), ('desnuda', 'sexual', 'medium'), ('erótico', 'sexual', 'medium'),
  ('escort', 'sexual', 'high'), ('sugar daddy', 'sexual', 'high'), ('sugar baby', 'sexual', 'high'),
  -- violencia y amenazas
  ('te voy a matar', 'violence', 'high'), ('mátate', 'violence', 'high'), ('suicídate', 'violence', 'high'),
  ('te voy a golpear', 'violence', 'high'), ('múerete', 'violence', 'high'), ('matar', 'violence', 'low'),
  -- spam y estafas
  ('gana dinero', 'spam', 'medium'), ('dinero fácil', 'spam', 'medium'), ('inversión segura', 'spam', 'medium'),
  ('casino', 'spam', 'medium'), ('criptomonedas', 'spam', 'low'), ('bitcoin', 'spam', 'low'),
  ('apuestas', 'spam', 'low'), ('click aquí', 'spam', 'low')
ON CONFLICT (term) DO NOTHING;

-- Devuelve {"verdict": "clean|review|flagged", "hits": [{term, category, severity}]}
--   flagged = al menos un término grave o 2+ medios; review = cualquier coincidencia.
-- Es informativo: nunca publica ni rechaza por sí solo.
CREATE OR REPLACE FUNCTION public.scan_text(p_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  norm TEXT := ' ' || public.normalize_filter_text(p_text) || ' ';
  hits JSONB := '[]'::JSONB;
  rec RECORD;
  highs INTEGER := 0;
  meds INTEGER := 0;
  verdict TEXT := 'clean';
BEGIN
  FOR rec IN SELECT term, category, severity FROM public.content_filter_terms
             WHERE char_length(public.normalize_filter_text(term)) >= 3 -- evita términos que al normalizar quedan en 1-2 letras
  LOOP
    IF norm ~ ('(^|[^a-z0-9])'
               || regexp_replace(public.normalize_filter_text(rec.term), '([.*+?^${}()|\[\]\\])', '\\\1', 'g')
               || '($|[^a-z0-9])') THEN
      hits := hits || jsonb_build_array(jsonb_build_object('term', rec.term, 'category', rec.category, 'severity', rec.severity));
      IF rec.severity = 'high' THEN highs := highs + 1;
      ELSIF rec.severity = 'medium' THEN meds := meds + 1;
      END IF;
    END IF;
  END LOOP;

  IF lower(COALESCE(p_text, '')) ~ '(https?://|www\.)' THEN
    hits := hits || jsonb_build_array(jsonb_build_object('term', 'enlace', 'category', 'link', 'severity', 'low'));
  END IF;

  IF highs > 0 OR meds >= 2 THEN verdict := 'flagged';
  ELSIF jsonb_array_length(hits) > 0 THEN verdict := 'review';
  END IF;
  RETURN jsonb_build_object('verdict', verdict, 'hits', hits);
END;
$$;

-- ---- Enviar, ver, reportar y borrar -------------------------------------------
DROP FUNCTION IF EXISTS public.submit_event(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT);
CREATE FUNCTION public.submit_event(
  p_title TEXT, p_description TEXT, p_category TEXT, p_location TEXT, p_start TIMESTAMPTZ, p_image_path TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  prof RECORD;
  ttl TEXT := btrim(COALESCE(p_title, ''));
  dsc TEXT := NULLIF(btrim(COALESCE(p_description, '')), '');
  loc TEXT := NULLIF(btrim(COALESCE(p_location, '')), '');
  new_id UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Inicia sesión para publicar.'; END IF;
  SELECT university_id, onboarding_completed, is_suspended, suspended_until INTO prof
  FROM public.profiles WHERE id = me;
  IF prof.university_id IS NULL OR NOT prof.onboarding_completed THEN
    RAISE EXCEPTION 'Completa tu perfil para publicar.';
  END IF;
  IF prof.is_suspended AND (prof.suspended_until IS NULL OR prof.suspended_until > NOW()) THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida y no puede publicar por ahora.';
  END IF;

  IF char_length(ttl) < 3 OR char_length(ttl) > 80 THEN RAISE EXCEPTION 'El título debe tener entre 3 y 80 caracteres.'; END IF;
  IF dsc IS NOT NULL AND char_length(dsc) > 1000 THEN RAISE EXCEPTION 'El texto puede tener máximo 1000 caracteres.'; END IF;
  IF loc IS NOT NULL AND char_length(loc) > 120 THEN RAISE EXCEPTION 'El lugar puede tener máximo 120 caracteres.'; END IF;
  IF dsc IS NULL AND p_image_path IS NULL THEN RAISE EXCEPTION 'Agrega un texto, una imagen o ambos.'; END IF;
  IF p_category NOT IN ('mercadito', 'reunion', 'academico', 'cultural', 'deportivo', 'aviso', 'otro') THEN
    RAISE EXCEPTION 'Elige una categoría válida.';
  END IF;
  IF p_start IS NOT NULL AND p_start < NOW() THEN RAISE EXCEPTION 'La fecha del evento ya pasó.'; END IF;
  IF p_image_path IS NOT NULL AND p_image_path NOT LIKE me::TEXT || '/%' THEN RAISE EXCEPTION 'Imagen no válida.'; END IF;
  IF (SELECT COUNT(*) FROM public.events
      WHERE created_by = me AND status IN ('pending', 'approved') AND expires_at > NOW()) >= 3 THEN
    RAISE EXCEPTION 'Ya tienes 3 publicaciones activas o en revisión. Espera a que se resuelvan o elimina una.';
  END IF;

  INSERT INTO public.events (
    university_id, title, description, category, location, start_time, image_path,
    status, text_scan, image_scan, created_by, expires_at
  ) VALUES (
    prof.university_id, ttl, dsc, p_category, loc, p_start, p_image_path,
    'pending',
    public.scan_text(ttl || ' ' || COALESCE(dsc, '') || ' ' || COALESCE(loc, '')),
    CASE WHEN p_image_path IS NULL THEN NULL ELSE jsonb_build_object('status', 'pending') END,
    me,
    COALESCE(p_start + INTERVAL '6 hours', NOW() + INTERVAL '14 days')
  ) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

DROP FUNCTION IF EXISTS public.list_events();
CREATE FUNCTION public.list_events()
RETURNS TABLE (
  id UUID, title TEXT, description TEXT, category TEXT, location TEXT, start_time TIMESTAMPTZ,
  image_path TEXT, created_at TIMESTAMPTZ, author_name TEXT, is_mine BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT e.id, e.title, e.description, e.category, e.location, e.start_time,
         e.image_path, e.created_at, p.full_name, (e.created_by = me)
  FROM public.events e
  JOIN public.profiles p ON p.id = e.created_by
  WHERE e.university_id = public.get_my_university_id()
    AND e.status = 'approved' AND e.expires_at > NOW()
  ORDER BY (e.start_time IS NULL), e.start_time, e.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.list_my_events();
CREATE FUNCTION public.list_my_events()
RETURNS TABLE (
  id UUID, title TEXT, description TEXT, category TEXT, location TEXT, start_time TIMESTAMPTZ,
  image_path TEXT, status TEXT, review_note TEXT, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.title, e.description, e.category, e.location, e.start_time,
         e.image_path, e.status, e.review_note, e.created_at, e.expires_at
  FROM public.events e
  WHERE e.created_by = auth.uid()
  ORDER BY e.created_at DESC
  LIMIT 30;
$$;

-- Devuelve la ruta de la imagen para que la app borre el archivo.
DROP FUNCTION IF EXISTS public.delete_event(UUID);
CREATE FUNCTION public.delete_event(p_event UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE ev RECORD;
BEGIN
  SELECT created_by, university_id, image_path INTO ev FROM public.events WHERE id = p_event;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa publicación ya no existe.'; END IF;
  IF ev.created_by <> auth.uid()
     AND NOT (public.is_moderator_or_admin() AND ev.university_id = public.get_my_university_id()) THEN
    RAISE EXCEPTION 'No puedes eliminar esta publicación.';
  END IF;
  DELETE FROM public.events WHERE id = p_event;
  RETURN ev.image_path;
END;
$$;

-- Con 2 reportes de personas distintas, un evento aprobado vuelve a revisión.
DROP FUNCTION IF EXISTS public.report_event(UUID, TEXT);
CREATE FUNCTION public.report_event(p_event UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  ev RECORD;
BEGIN
  IF p_reason NOT IN ('offensive', 'sexual', 'spam', 'false', 'other') THEN RAISE EXCEPTION 'Motivo no válido.'; END IF;
  SELECT created_by, status INTO ev FROM public.events
  WHERE id = p_event AND university_id = public.get_my_university_id();
  IF NOT FOUND OR ev.status <> 'approved' THEN RAISE EXCEPTION 'Esa publicación ya no está disponible.'; END IF;
  IF ev.created_by = me THEN RAISE EXCEPTION 'No puedes reportar tu propia publicación.'; END IF;

  INSERT INTO public.event_reports (event_id, reporter_id, reason) VALUES (p_event, me, p_reason)
  ON CONFLICT (event_id, reporter_id) DO NOTHING;

  IF (SELECT COUNT(*) FROM public.event_reports WHERE event_id = p_event) >= 2 THEN
    UPDATE public.events SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, review_note = NULL
    WHERE id = p_event AND status = 'approved';
  END IF;
END;
$$;

-- ---- Moderación ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_moderation_queue();
CREATE FUNCTION public.list_moderation_queue()
RETURNS TABLE (
  id UUID, title TEXT, description TEXT, category TEXT, location TEXT, start_time TIMESTAMPTZ,
  image_path TEXT, created_at TIMESTAMPTZ,
  author_id UUID, author_name TEXT, author_career TEXT, author_semester INTEGER, author_photo TEXT,
  text_scan JSONB, image_scan JSONB,
  report_count INTEGER, report_reasons JSONB,
  prior_rejections INTEGER, prior_sanctions INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_moderator_or_admin() THEN RAISE EXCEPTION 'Solo moderadores pueden ver la cola.'; END IF;
  RETURN QUERY
  SELECT e.id, e.title, e.description, e.category, e.location, e.start_time,
         e.image_path, e.created_at,
         p.id, p.full_name, car.name, p.semester,
         (SELECT ph.storage_path FROM public.profile_photos ph WHERE ph.profile_id = p.id ORDER BY ph.position LIMIT 1),
         e.text_scan, e.image_scan,
         (SELECT COUNT(*) FROM public.event_reports r WHERE r.event_id = e.id)::INTEGER,
         COALESCE((SELECT jsonb_agg(r.reason) FROM public.event_reports r WHERE r.event_id = e.id), '[]'::JSONB),
         (SELECT COUNT(*) FROM public.events x WHERE x.created_by = p.id AND x.status = 'rejected')::INTEGER,
         (SELECT COUNT(*) FROM public.moderation_actions a WHERE a.target_user_id = p.id AND a.action = 'strike')::INTEGER
  FROM public.events e
  JOIN public.profiles p ON p.id = e.created_by
  LEFT JOIN public.careers car ON car.id = p.career_id
  WHERE e.status = 'pending'
    AND e.university_id = public.get_my_university_id()
    AND e.expires_at > NOW()
  ORDER BY
    (SELECT COUNT(*) FROM public.event_reports r WHERE r.event_id = e.id) DESC,
    CASE e.text_scan->>'verdict' WHEN 'flagged' THEN 0 WHEN 'review' THEN 1 ELSE 2 END,
    e.created_at;
END;
$$;

-- Cola de correos salientes. Cada sanción agrega una fila; una Edge Function la envía
-- (ver README, "Correos de sanción"). Sin políticas: solo service_role y las funciones la tocan.
CREATE TABLE IF NOT EXISTS public.email_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    to_email TEXT NOT NULL,
    template TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_pending ON public.email_outbox(status, created_at);
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_outbox FROM anon, authenticated;

-- Bloqueo permanente. Además de marcar el perfil, impide iniciar sesión (banned_until de
-- Supabase Auth) y cierra las sesiones abiertas. Si algo de auth falla, el bloqueo del
-- perfil se conserva y se avisa con un WARNING.
DROP FUNCTION IF EXISTS public.block_account(UUID, TEXT);
CREATE FUNCTION public.block_account(p_user UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET is_suspended = TRUE, suspended_until = NULL WHERE id = p_user;
  INSERT INTO public.moderation_actions (target_user_id, action, reason) VALUES (p_user, 'ban', p_reason);
  BEGIN
    UPDATE auth.users SET banned_until = 'infinity' WHERE id = p_user;
    DELETE FROM auth.sessions WHERE user_id = p_user;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo cerrar la sesión de %: %', p_user, SQLERRM;
  END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.block_account(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Cuántas sanciones lleva la persona que consulta (para avisarle en la app).
DROP FUNCTION IF EXISTS public.my_sanction_count();
CREATE FUNCTION public.my_sanction_count()
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.moderation_actions WHERE target_user_id = auth.uid() AND action = 'strike';
$$;

-- p_decision: 'approve' | 'reject'.
-- p_sanction (solo con 'reject'): suma UNA sanción a quien publicó y le manda un correo con
-- su conteo. Al llegar a 5 sanciones la cuenta se bloquea sola; no hay que decidirlo.
-- Devuelve la ruta de la imagen cuando se rechaza, para que la app borre el archivo.
DROP FUNCTION IF EXISTS public.review_event(UUID, TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.review_event(UUID, TEXT, TEXT, BOOLEAN);
CREATE FUNCTION public.review_event(
  p_event UUID, p_decision TEXT, p_note TEXT DEFAULT NULL, p_sanction BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  my_role TEXT;
  ev RECORD;
  note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  strikes INTEGER;
  blocked BOOLEAN := FALSE;
  target RECORD;
  sanction_limit CONSTANT INTEGER := 5;
BEGIN
  SELECT role INTO my_role FROM public.profiles WHERE id = me;
  IF my_role NOT IN ('moderator', 'admin') THEN RAISE EXCEPTION 'Solo moderadores pueden revisar publicaciones.'; END IF;

  SELECT id, title, created_by, university_id, status, image_path INTO ev FROM public.events WHERE id = p_event;
  IF NOT FOUND OR ev.university_id <> public.get_my_university_id() THEN RAISE EXCEPTION 'Esa publicación ya no existe.'; END IF;
  IF ev.status <> 'pending' THEN RAISE EXCEPTION 'Esta publicación ya fue revisada.'; END IF;
  IF ev.created_by = me AND my_role <> 'admin' THEN RAISE EXCEPTION 'Otra persona debe revisar tu publicación.'; END IF;
  IF p_decision NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'Decisión no válida.'; END IF;

  IF p_decision = 'approve' THEN
    IF p_sanction THEN RAISE EXCEPTION 'Para sancionar primero rechaza la publicación.'; END IF;
    UPDATE public.events SET status = 'approved', reviewed_by = me, reviewed_at = NOW(), review_note = note WHERE id = p_event;
    DELETE FROM public.event_reports WHERE event_id = p_event; -- los reportes quedan resueltos
    RETURN NULL;
  END IF;

  IF note IS NULL OR char_length(note) < 3 THEN RAISE EXCEPTION 'Escribe el motivo del rechazo (lo verá quien publicó).'; END IF;
  IF char_length(note) > 300 THEN RAISE EXCEPTION 'El motivo puede tener máximo 300 caracteres.'; END IF;

  IF p_sanction THEN
    IF ev.created_by = me THEN RAISE EXCEPTION 'No puedes sancionarte a ti mismo.'; END IF;

    INSERT INTO public.moderation_actions (moderator_id, target_user_id, action, reason, event_id)
    VALUES (me, ev.created_by, 'strike', note, p_event);
    SELECT COUNT(*) INTO strikes FROM public.moderation_actions WHERE target_user_id = ev.created_by AND action = 'strike';

    IF strikes >= sanction_limit THEN
      PERFORM public.block_account(ev.created_by, 'Bloqueo automático por acumular ' || sanction_limit || ' sanciones.');
      blocked := TRUE;
    END IF;

    SELECT p.full_name, u.email INTO target
    FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.id = ev.created_by;
    IF target.email IS NOT NULL THEN
      INSERT INTO public.email_outbox (to_email, template, payload)
      VALUES (target.email, 'sancion', jsonb_build_object(
        'name', target.full_name, 'event_title', ev.title, 'reason', note,
        'strike_count', strikes, 'limit', sanction_limit,
        'remaining', GREATEST(sanction_limit - strikes, 0), 'blocked', blocked));
    END IF;
  END IF;

  UPDATE public.events
  SET status = 'rejected', reviewed_by = me, reviewed_at = NOW(), review_note = note, image_path = NULL
  WHERE id = p_event;
  DELETE FROM public.event_reports WHERE event_id = p_event;
  RETURN ev.image_path;
END;
$$;

-- La llama la Edge Function de SafeSearch (rol service_role). Ver README.
-- Forma esperada de p_scan:
--   {"status": "done", "provider": "google_safesearch", "adult": "VERY_UNLIKELY", "violence": "UNLIKELY",
--    "racy": "POSSIBLE", "spoof": "UNLIKELY", "medical": "UNLIKELY"}   (o {"status": "error", "error": "..."})
DROP FUNCTION IF EXISTS public.set_event_image_scan(UUID, JSONB);
CREATE FUNCTION public.set_event_image_scan(p_event UUID, p_scan JSONB)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.events SET image_scan = p_scan || jsonb_build_object('checked_at', NOW()) WHERE id = p_event;
$$;

GRANT EXECUTE ON FUNCTION public.submit_event(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_event(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_moderation_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_event(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_sanction_count() TO authenticated;
-- scan_text solo la usa submit_event (SECURITY DEFINER); nadie más necesita llamarla
REVOKE EXECUTE ON FUNCTION public.scan_text(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_event(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_events() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_my_events() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_event(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.report_event(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_moderation_queue() FROM anon;
REVOKE EXECUTE ON FUNCTION public.review_event(UUID, TEXT, TEXT, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_sanction_count() FROM anon;

-- set_event_image_scan: solo service_role (nunca un usuario de la app)
REVOKE EXECUTE ON FUNCTION public.set_event_image_scan(UUID, JSONB) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.set_event_image_scan(UUID, JSONB) TO service_role;
  END IF;
END $$;


-- ==============================================================================
-- 3. CATÁLOGO DE LA UAA (obligatorio)
-- ==============================================================================

DO $$
DECLARE
    uni_uaa_id UUID := '11111111-1111-1111-1111-111111111111';
    campus_central UUID := '22222222-2222-2222-2222-222222222221';
    campus_sur UUID := '22222222-2222-2222-2222-222222222222';
    
    car_isc UUID := '33333333-3333-3333-3333-333333333331';
    car_bio UUID := '33333333-3333-3333-3333-333333333332';
    car_dg UUID := '33333333-3333-3333-3333-333333333333';
    car_med UUID := '33333333-3333-3333-3333-333333333334';
BEGIN

    -- 1. UNIVERSIDAD: UAA
    INSERT INTO public.universities (id, name, short_name, logo_url)
    VALUES (uni_uaa_id, 'Universidad Autónoma de Aguascalientes', 'UAA', 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Logo_de_la_UAA.svg')
    ON CONFLICT (short_name) DO NOTHING;

    -- 2. DOMINIOS INSTITUCIONALES PERMITIDOS (¡Obligatorio edu.uaa.mx!)
    INSERT INTO public.university_domains (university_id, domain)
    VALUES 
        (uni_uaa_id, 'edu.uaa.mx'),
        (uni_uaa_id, 'alumnos.uaa.mx')
    ON CONFLICT (domain) DO NOTHING;

    -- 3. CAMPUS
    INSERT INTO public.campuses (id, university_id, name)
    VALUES 
        (campus_central, uni_uaa_id, 'Campus Central UAA'),
        (campus_sur, uni_uaa_id, 'Campus Sur UAA')
    ON CONFLICT (university_id, name) DO NOTHING;

    -- 4. CARRERAS
    INSERT INTO public.careers (id, university_id, name, area)
    VALUES 
        (car_isc, uni_uaa_id, 'Ingeniería en Sistemas Computacionales', 'Ingeniería'),
        (car_bio, uni_uaa_id, 'Ingeniería Biomédica', 'Ingeniería y Salud'),
        (car_dg, uni_uaa_id, 'Licenciatura en Diseño Gráfico', 'Diseño y Arte'),
        (car_med, uni_uaa_id, 'Médico Cirujano', 'Ciencias de la Salud')
    ON CONFLICT (university_id, name) DO NOTHING;

    -- 5. MATERIAS (16 materias)
    INSERT INTO public.subjects (career_id, name, code) VALUES
        -- ISC
        (car_isc, 'Estructura de Datos', 'ISC-301'),
        (car_isc, 'Sistemas Distribuidos', 'ISC-602'),
        (car_isc, 'Inteligencia Artificial', 'ISC-701'),
        (car_isc, 'Bases de Datos Avanzadas', 'ISC-503'),
        -- Biomédica
        (car_bio, 'Bioinstrumentación', 'BIO-401'),
        (car_bio, 'Procesamiento de Bioseñales', 'BIO-502'),
        (car_bio, 'Biomecánica', 'BIO-603'),
        (car_bio, 'Fisiología para Ingenieros', 'BIO-304'),
        -- Diseño Gráfico
        (car_dg, 'Tipografía Editorial', 'DG-301'),
        (car_dg, 'Identidad Corporativa', 'DG-402'),
        (car_dg, 'Diseño de Interfaces UI/UX', 'DG-503'),
        (car_dg, 'Fotografía y Semiótica', 'DG-204'),
        -- Medicina
        (car_med, 'Anatomía Humana II', 'MED-201'),
        (car_med, 'Farmacología Clínica', 'MED-402'),
        (car_med, 'Fisiopatología', 'MED-303'),
        (car_med, 'Microbiología Médica', 'MED-305')
    ON CONFLICT (career_id, name) DO NOTHING;

    -- 6. INTERESES (40 intereses categorizados)
    INSERT INTO public.interests (name, category) VALUES
        -- Tecnología
        ('Programación', 'Tecnología'), ('Inteligencia Artificial', 'Tecnología'),
        ('Videojuegos', 'Tecnología'), ('Robótica', 'Tecnología'), ('Ciberseguridad', 'Tecnología'),
        -- Arte y Cultura
        ('Fotografía 35mm', 'Arte'), ('Cineclub', 'Arte'), ('Pintura', 'Arte'),
        ('Lectura', 'Arte'), ('Museos', 'Arte'), ('Escritura Creativa', 'Arte'),
        -- Música
        ('Música Indie', 'Música'), ('Rock en Español', 'Música'), ('Jazz', 'Música'),
        ('Pop', 'Música'), ('Electrónica', 'Música'), ('Tocar Guitarra', 'Música'),
        -- Deportes y Bienestar
        ('Básquetbol', 'Deportes'), ('Fútbol', 'Deportes'), ('Gimnasio', 'Deportes'),
        ('Running', 'Deportes'), ('Yoga', 'Deportes'), ('Senderismo', 'Deportes'),
        ('Natación', 'Deportes'), ('Voleibol', 'Deportes'),
        -- Estilo de Vida y Social
        ('Café de Especialidad', 'Estilo de Vida'), ('Matcha', 'Estilo de Vida'),
        ('Viajar', 'Estilo de Vida'), ('Voluntariado', 'Estilo de Vida'), ('Perros y Gatos', 'Estilo de Vida'),
        ('Juegos de Mesa', 'Estilo de Vida'), ('Cocinar', 'Estilo de Vida'), ('Ajedrez', 'Estilo de Vida'),
        ('Cerveza Artesanal', 'Estilo de Vida'), ('Plantas y Botánica', 'Estilo de Vida'),
        ('Anime y Manga', 'Estilo de Vida'), ('Sustentabilidad', 'Estilo de Vida'),
        ('Podcasts', 'Estilo de Vida'), ('Meditación', 'Estilo de Vida'), ('Series y Cine', 'Estilo de Vida')
    ON CONFLICT (name) DO NOTHING;

END $$;

-- Materias extra para que cada carrera tenga suficientes opciones
INSERT INTO public.subjects (career_id, name, code) VALUES
    ('33333333-3333-3333-3333-333333333331', 'Redes de Computadoras', 'ISC-504'),
    ('33333333-3333-3333-3333-333333333331', 'Compiladores', 'ISC-605'),
    ('33333333-3333-3333-3333-333333333332', 'Sensores Médicos', 'BIO-605'),
    ('33333333-3333-3333-3333-333333333333', 'Animación Digital', 'DG-505'),
    ('33333333-3333-3333-3333-333333333334', 'Bioética Médica', 'MED-406')
ON CONFLICT (career_id, name) DO NOTHING;


-- ==============================================================================
-- 4. CUENTAS DE PRUEBA (OPCIONAL)
-- Crea 10 estudiantes de prueba ya confirmados (contraseña: UniLinkDemo2026!)
-- para probar matches y chat desde el otro lado. NO lo actives en producción.
--
-- Para activarlo: borra la línea "/* INICIO CUENTAS DE PRUEBA" y la línea
-- "FIN CUENTAS DE PRUEBA */" de abajo y vuelve a correr el archivo.
-- ==============================================================================

/* INICIO CUENTAS DE PRUEBA

-- ==============================================================================
-- ESTUDIANTES DE PRUEBA (10 perfiles completos)
-- ------------------------------------------------------------------------------
-- Cada perfil necesita existir primero en auth.users (por la llave foránea), así
-- que aquí se crean como usuarios reales ya confirmados. El trigger de registro
-- les crea el perfil y después se completa con sus datos.
--
-- Puedes iniciar sesión con cualquiera para probar matches y chat desde el otro
-- lado, por ejemplo:  sofia.alvarez@edu.uaa.mx  /  UniLinkDemo2026!
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
    slot TEXT;
    parts TEXT[];
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('a0000000-0000-0000-0000-000000000001'::uuid, 'sofia.alvarez@edu.uaa.mx', 'Sofía Álvarez', '2004-03-15'::date, 'female', 'Ella',
             'Enfocada en biosensores y análisis de datos. Fan del café filtrado y los gatos.',
             '22222222-2222-2222-2222-222222222221'::uuid, '33333333-3333-3333-3333-333333333332'::uuid, 6,
             ARRAY['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80','https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80'],
             ARRAY['study','friendship','dating'],
             ARRAY['Bioinstrumentación','Procesamiento de Bioseñales','Sensores Médicos'],
             ARRAY['Café de Especialidad','Música Indie','Perros y Gatos','Programación','Lectura'],
             ARRAY['2 16:00 19:00','4 16:00 19:00','5 11:00 13:00']),
            ('a0000000-0000-0000-0000-000000000002'::uuid, 'diego.martinez@edu.uaa.mx', 'Diego Martínez', '2003-08-20'::date, 'male', 'Él',
             'Programando en C++ y armando grupos de estudio para IA. Retas de Smash entre clases.',
             '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333331'::uuid, 7,
             ARRAY['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80'],
             ARRAY['study','friendship'],
             ARRAY['Inteligencia Artificial','Sistemas Distribuidos','Compiladores'],
             ARRAY['Programación','Videojuegos','Ajedrez','Inteligencia Artificial','Anime y Manga'],
             ARRAY['1 14:00 16:00','3 14:00 16:00','5 09:00 11:00']),
            ('a0000000-0000-0000-0000-000000000003'::uuid, 'valeria.lozano@edu.uaa.mx', 'Valeria Lozano', '2005-01-10'::date, 'female', 'Ella',
             'Diseño de interfaces y fotografía analógica. Me gusta descubrir cafeterías en Aguascalientes.',
             '22222222-2222-2222-2222-222222222221'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 4,
             ARRAY['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80','https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80'],
             ARRAY['study','friendship','dating'],
             ARRAY['Diseño de Interfaces UI/UX','Fotografía y Semiótica','Tipografía Editorial'],
             ARRAY['Fotografía 35mm','Cineclub','Matcha','Museos','Café de Especialidad'],
             ARRAY['3 13:00 15:00','5 13:00 15:00']),
            ('a0000000-0000-0000-0000-000000000004'::uuid, 'mateo.espinoza@edu.uaa.mx', 'Mateo Espinoza', '2002-11-28'::date, 'male', 'Él',
             'Estudiante de Medicina. Busco despejar la mente después de guardias: rock en español y senderismo.',
             '22222222-2222-2222-2222-222222222221'::uuid, '33333333-3333-3333-3333-333333333334'::uuid, 8,
             ARRAY['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80'],
             ARRAY['friendship','dating'],
             ARRAY['Farmacología Clínica','Fisiopatología'],
             ARRAY['Rock en Español','Senderismo','Running','Podcasts','Café de Especialidad'],
             ARRAY['4 17:00 20:00','6 09:00 13:00']),
            ('a0000000-0000-0000-0000-000000000005'::uuid, 'camila.macias@edu.uaa.mx', 'Camila Macías', '2004-06-12'::date, 'female', 'Ella',
             'Apasionada por la tipografía y el arte editorial. Siempre lista para platicar de música indie.',
             '22222222-2222-2222-2222-222222222221'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 5,
             ARRAY['https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80'],
             ARRAY['study','friendship','dating'],
             ARRAY['Tipografía Editorial','Identidad Corporativa','Animación Digital'],
             ARRAY['Música Indie','Pintura','Escritura Creativa','Lectura','Plantas y Botánica'],
             ARRAY['1 11:00 13:00','3 11:00 13:00']),
            ('a0000000-0000-0000-0000-000000000006'::uuid, 'andres.ruiz@edu.uaa.mx', 'Andrés Ruiz', '2004-09-02'::date, 'male', 'Él',
             'ISC de quinto. Me late el backend, las bases de datos y jugar básquet los viernes.',
             '22222222-2222-2222-2222-222222222221'::uuid, '33333333-3333-3333-3333-333333333331'::uuid, 5,
             ARRAY['https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80'],
             ARRAY['study','friendship','dating'],
             ARRAY['Estructura de Datos','Bases de Datos Avanzadas','Redes de Computadoras'],
             ARRAY['Programación','Básquetbol','Videojuegos','Cerveza Artesanal','Series y Cine'],
             ARRAY['2 16:00 18:00','5 16:00 19:00']),
            ('a0000000-0000-0000-0000-000000000007'::uuid, 'renata.diaz@edu.uaa.mx', 'Renata Díaz', '2005-04-21'::date, 'female', 'Ella',
             'Biomédica de cuarto. Busco equipo para el proyecto de bioseñales y alguien para ir al gym.',
             '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333332'::uuid, 4,
             ARRAY['https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80'],
             ARRAY['study','friendship'],
             ARRAY['Procesamiento de Bioseñales','Biomecánica','Fisiología para Ingenieros'],
             ARRAY['Gimnasio','Yoga','Robótica','Viajar','Pop'],
             ARRAY['2 16:00 18:00','4 10:00 12:00']),
            ('a0000000-0000-0000-0000-000000000008'::uuid, 'emilio.torres@edu.uaa.mx', 'Emilio Torres', '2003-02-14'::date, 'male', 'Él',
             'Diseñador gráfico y fotógrafo de conciertos. Si hay un toquín en Ags, ahí ando.',
             '22222222-2222-2222-2222-222222222221'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 7,
             ARRAY['https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80'],
             ARRAY['friendship','dating'],
             ARRAY['Fotografía y Semiótica','Animación Digital'],
             ARRAY['Fotografía 35mm','Música Indie','Tocar Guitarra','Electrónica','Cineclub'],
             ARRAY['3 18:00 21:00','6 11:00 15:00']),
            ('a0000000-0000-0000-0000-000000000009'::uuid, 'ximena.reyes@edu.uaa.mx', 'Ximena Reyes', '2004-12-05'::date, 'female', 'Ella',
             'Medicina, tercer semestre. Hago resúmenes bonitos y comparto. Voluntaria en la Cruz Roja.',
             '22222222-2222-2222-2222-222222222221'::uuid, '33333333-3333-3333-3333-333333333334'::uuid, 3,
             ARRAY['https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=800&q=80'],
             ARRAY['study','friendship'],
             ARRAY['Anatomía Humana II','Microbiología Médica','Bioética Médica'],
             ARRAY['Voluntariado','Lectura','Meditación','Cocinar','Perros y Gatos'],
             ARRAY['1 07:00 09:00','3 07:00 09:00','5 15:00 17:00']),
            ('a0000000-0000-0000-0000-000000000010'::uuid, 'leonardo.campos@edu.uaa.mx', 'Leonardo Campos', '2002-07-30'::date, 'male', 'Él',
             'Último semestre de ISC. Doy asesorías de Estructura de Datos a cambio de café.',
             '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333331'::uuid, 9,
             ARRAY['https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80'],
             ARRAY['study','friendship','dating'],
             ARRAY['Estructura de Datos','Compiladores','Inteligencia Artificial'],
             ARRAY['Programación','Ciberseguridad','Café de Especialidad','Juegos de Mesa','Senderismo'],
             ARRAY['2 16:00 19:00','4 16:00 19:00'])
        ) AS t(id, email, name, birth, gender, pronouns, bio, campus_id, career_id, semester, photos, modes, subjects, interests, slots)
    LOOP
        -- Usuario de Auth (contraseña de prueba: UniLinkDemo2026!)
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = r.id) THEN
            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                confirmation_token, recovery_token, email_change_token_new, email_change
            ) VALUES (
                '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated', r.email,
                extensions.crypt('UniLinkDemo2026!', extensions.gen_salt('bf')), NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('full_name', r.name), NOW(), NOW(), '', '', '', ''
            );

            -- Identidad de email para poder iniciar sesión (si tu versión de
            -- Supabase tiene otra estructura, solo se omite este paso)
            BEGIN
                INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
                VALUES (gen_random_uuid(), r.id::text, r.id,
                        jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
                        'email', NOW(), NOW(), NOW());
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'No se creó la identidad de % (%). El perfil sí se creó.', r.email, SQLERRM;
            END;
        END IF;

        -- Por si el trigger de registro no existía cuando se creó el usuario
        INSERT INTO public.profiles (id, full_name, university_id, role)
        VALUES (r.id, r.name, '11111111-1111-1111-1111-111111111111', 'student')
        ON CONFLICT (id) DO NOTHING;

        UPDATE public.profiles SET
            full_name = r.name,
            birth_date = r.birth,
            gender = r.gender,
            pronouns = r.pronouns,
            bio = r.bio,
            campus_id = r.campus_id,
            career_id = r.career_id,
            semester = r.semester,
            is_photo_verified = TRUE,
            onboarding_completed = TRUE,
            last_active_at = NOW()
        WHERE id = r.id;

        DELETE FROM public.profile_photos WHERE profile_id = r.id;
        INSERT INTO public.profile_photos (profile_id, storage_path, position)
        SELECT r.id, p.url, p.ord - 1
        FROM unnest(r.photos) WITH ORDINALITY AS p(url, ord);

        INSERT INTO public.connection_modes (profile_id, mode, is_active)
        SELECT r.id, m.mode, m.mode = ANY (r.modes)
        FROM (VALUES ('study'), ('friendship'), ('dating')) AS m(mode)
        ON CONFLICT (profile_id, mode) DO UPDATE SET is_active = EXCLUDED.is_active;

        DELETE FROM public.profile_subjects WHERE profile_id = r.id;
        INSERT INTO public.profile_subjects (profile_id, subject_id)
        SELECT r.id, s.id FROM public.subjects s
        WHERE s.career_id = r.career_id AND s.name = ANY (r.subjects)
        ON CONFLICT DO NOTHING;

        DELETE FROM public.profile_interests WHERE profile_id = r.id;
        INSERT INTO public.profile_interests (profile_id, interest_id)
        SELECT r.id, i.id FROM public.interests i WHERE i.name = ANY (r.interests)
        ON CONFLICT DO NOTHING;

        DELETE FROM public.availability_slots WHERE profile_id = r.id;
        FOREACH slot IN ARRAY r.slots LOOP
            parts := string_to_array(slot, ' ');
            INSERT INTO public.availability_slots (profile_id, weekday, start_time, end_time)
            VALUES (r.id, parts[1]::int, parts[2]::time, parts[3]::time);
        END LOOP;
    END LOOP;
END $$;

-- ==============================================================================
-- OPCIONAL: hacer que los perfiles de prueba ya te hayan dado "Me interesa"
-- ------------------------------------------------------------------------------
-- Así, en cuanto tú les des "Me interesa" desde la app, se crea el match al
-- instante y puedes probar el chat. Cambia el correo por el tuyo y ejecuta solo
-- este bloque (quitando los guiones de comentario).
-- ==============================================================================
-- DO $$
-- DECLARE me UUID;
-- BEGIN
--     SELECT id INTO me FROM auth.users WHERE email = 'TU_CORREO@edu.uaa.mx';
--     INSERT INTO public.swipes (from_id, to_id, mode, action)
--     SELECT p.id, me, cm.mode, 'like'
--     FROM public.profiles p
--     JOIN public.connection_modes cm ON cm.profile_id = p.id AND cm.is_active
--     WHERE p.id::text LIKE 'a0000000-%'
--     ON CONFLICT (from_id, to_id, mode) DO NOTHING;
-- END $$;

FIN CUENTAS DE PRUEBA */

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

DROP POLICY IF EXISTS "Ver eventos de mi universidad" ON public.events;
DROP POLICY IF EXISTS "Crear evento" ON public.events;
CREATE POLICY "Ver eventos de mi universidad" ON public.events FOR SELECT TO authenticated
USING (university_id = public.get_my_university_id());
CREATE POLICY "Crear evento" ON public.events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND university_id = public.get_my_university_id());

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
REVOKE EXECUTE ON FUNCTION public.get_my_matches() FROM anon;
REVOKE EXECUTE ON FUNCTION public.unmatch(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.block_user(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM anon;


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

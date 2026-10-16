-- ==============================================================================
-- UNILINK - INSTALACIÓN COMPLETA (TODO EN UNO)
-- Puedes copiar y pegar este script directamente en el SQL Editor de Supabase
-- Incluye: Tablas, RLS, Triggers (@edu.uaa.mx) y Datos de la UAA
-- IMPORTANTE: después de este archivo corre migrations/007_reparacion_onboarding_fotos_chat.sql
-- (políticas que faltan aquí, fotos/Storage, matching y chat) y luego seed.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PARTE 1: ESQUEMA Y TABLAS
-- ------------------------------------------------------------------------------
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
    position INTEGER NOT NULL CHECK (position >= 0 AND position < 6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, position)
);

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

-- ------------------------------------------------------------------------------
-- PARTE 2: ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.careers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutoring_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_like_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_weights ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_university_id()
RETURNS UUID AS $$
  SELECT university_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Políticas
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

DROP POLICY IF EXISTS "Ver perfiles de la misma universidad" ON public.profiles;
CREATE POLICY "Ver perfiles de la misma universidad" ON public.profiles FOR SELECT TO authenticated
USING (
    id = auth.uid()
    OR (
        university_id = public.get_my_university_id()
        AND is_suspended = FALSE
        AND is_paused = FALSE
        AND NOT EXISTS (
            SELECT 1 FROM public.blocks
            WHERE (blocker_id = auth.uid() AND blocked_id = public.profiles.id)
               OR (blocker_id = public.profiles.id AND blocked_id = auth.uid())
        )
    )
);

DROP POLICY IF EXISTS "Crear propio perfil" ON public.profiles;
CREATE POLICY "Crear propio perfil" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Actualizar propio perfil" ON public.profiles;
CREATE POLICY "Actualizar propio perfil" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Gestionar fotos propias" ON public.profile_photos;
CREATE POLICY "Gestionar fotos propias" ON public.profile_photos FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Ver fotos de usuarios misma universidad" ON public.profile_photos;
CREATE POLICY "Ver fotos de usuarios misma universidad" ON public.profile_photos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_photos.profile_id AND (p.id = auth.uid() OR p.university_id = public.get_my_university_id())));

DROP POLICY IF EXISTS "Ver propios swipes" ON public.swipes;
CREATE POLICY "Ver propios swipes" ON public.swipes FOR SELECT TO authenticated USING (auth.uid() = from_id);

DROP POLICY IF EXISTS "Crear propio swipe" ON public.swipes;
CREATE POLICY "Crear propio swipe" ON public.swipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_id);

DROP POLICY IF EXISTS "Ver matches donde participo" ON public.matches;
CREATE POLICY "Ver matches donde participo" ON public.matches FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Ver conversaciones donde participo" ON public.conversations;
CREATE POLICY "Ver conversaciones donde participo" ON public.conversations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = conversations.match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));

DROP POLICY IF EXISTS "Ver mensajes de mis conversaciones" ON public.messages;
CREATE POLICY "Ver mensajes de mis conversaciones" ON public.messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.conversations c JOIN public.matches m ON m.id = c.match_id WHERE c.id = messages.conversation_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid()) AND messages.is_hidden = FALSE));

DROP POLICY IF EXISTS "Enviar mensajes a mis conversaciones" ON public.messages;
CREATE POLICY "Enviar mensajes a mis conversaciones" ON public.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- ------------------------------------------------------------------------------
-- PARTE 3: TRIGGERS (VALIDACIÓN DE @edu.uaa.mx Y MATCHES)
-- ------------------------------------------------------------------------------

-- Trigger: Validación de Dominio en Registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email_domain TEXT;
    matched_university_id UUID;
    user_full_name TEXT;
BEGIN
    user_email_domain := lower(split_part(NEW.email, '@', 2));

    SELECT university_id INTO matched_university_id
    FROM public.university_domains
    WHERE domain = user_email_domain;

    IF matched_university_id IS NULL THEN
        RAISE EXCEPTION 'El correo institucional (%) no pertenece a una universidad registrada. Asegúrate de usar tu correo oficial (ej. @edu.uaa.mx).', NEW.email;
    END IF;

    user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

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

    INSERT INTO public.connection_modes (profile_id, mode, is_active)
    VALUES 
        (NEW.id, 'study', TRUE),
        (NEW.id, 'friendship', TRUE),
        (NEW.id, 'dating', FALSE);

    INSERT INTO public.subscriptions (profile_id, plan, status)
    VALUES (NEW.id, 'free', 'active');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Detección de Like Mutuo
CREATE OR REPLACE FUNCTION public.handle_swipe_action()
RETURNS TRIGGER AS $$
DECLARE
    reciprocal_like_exists BOOLEAN;
    new_match_id UUID;
    ua UUID;
    ub UUID;
BEGIN
    IF NEW.action = 'like' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.swipes
            WHERE from_id = NEW.to_id
              AND to_id = NEW.from_id
              AND mode = NEW.mode
              AND action = 'like'
        ) INTO reciprocal_like_exists;

        IF reciprocal_like_exists THEN
            ua := LEAST(NEW.from_id, NEW.to_id);
            ub := GREATEST(NEW.from_id, NEW.to_id);

            INSERT INTO public.matches (user_a, user_b, mode, is_active)
            VALUES (ua, ub, NEW.mode, TRUE)
            RETURNING id INTO new_match_id;

            INSERT INTO public.conversations (match_id, type)
            VALUES (new_match_id, 'direct');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_swipe_inserted ON public.swipes;
CREATE TRIGGER on_swipe_inserted
    BEFORE INSERT ON public.swipes
    FOR EACH ROW EXECUTE FUNCTION public.handle_swipe_action();

-- ------------------------------------------------------------------------------
-- PARTE 4: SEED DATA (UAA - @edu.uaa.mx)
-- ------------------------------------------------------------------------------
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
    INSERT INTO public.universities (id, name, short_name, logo_url)
    VALUES (uni_uaa_id, 'Universidad Autónoma de Aguascalientes', 'UAA', 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Logo_de_la_UAA.svg')
    ON CONFLICT (short_name) DO NOTHING;

    -- DOMINIO OFICIAL UAA
    INSERT INTO public.university_domains (university_id, domain)
    VALUES 
        (uni_uaa_id, 'edu.uaa.mx'),
        (uni_uaa_id, 'alumnos.uaa.mx')
    ON CONFLICT (domain) DO NOTHING;

    INSERT INTO public.campuses (id, university_id, name)
    VALUES 
        (campus_central, uni_uaa_id, 'Campus Central UAA'),
        (campus_sur, uni_uaa_id, 'Campus Sur UAA')
    ON CONFLICT (university_id, name) DO NOTHING;

    INSERT INTO public.careers (id, university_id, name, area)
    VALUES 
        (car_isc, uni_uaa_id, 'Ingeniería en Sistemas Computacionales', 'Ingeniería'),
        (car_bio, uni_uaa_id, 'Ingeniería Biomédica', 'Ingeniería y Salud'),
        (car_dg, uni_uaa_id, 'Licenciatura en Diseño Gráfico', 'Diseño y Arte'),
        (car_med, uni_uaa_id, 'Médico Cirujano', 'Ciencias de la Salud')
    ON CONFLICT (university_id, name) DO NOTHING;

    INSERT INTO public.subjects (career_id, name, code) VALUES
        (car_isc, 'Estructura de Datos', 'ISC-301'),
        (car_isc, 'Sistemas Distribuidos', 'ISC-602'),
        (car_isc, 'Inteligencia Artificial', 'ISC-701'),
        (car_bio, 'Bioinstrumentación', 'BIO-401'),
        (car_bio, 'Procesamiento de Bioseñales', 'BIO-502'),
        (car_dg, 'Tipografía Editorial', 'DG-301'),
        (car_dg, 'Diseño de Interfaces UI/UX', 'DG-503'),
        (car_med, 'Anatomía Humana II', 'MED-201'),
        (car_med, 'Farmacología Clínica', 'MED-402')
    ON CONFLICT (career_id, name) DO NOTHING;

    INSERT INTO public.interests (name, category) VALUES
        ('Programación', 'Tecnología'), ('Inteligencia Artificial', 'Tecnología'),
        ('Fotografía 35mm', 'Arte'), ('Cineclub', 'Arte'),
        ('Música Indie', 'Música'), ('Rock en Español', 'Música'),
        ('Básquetbol', 'Deportes'), ('Running', 'Deportes'),
        ('Café de Especialidad', 'Estilo de Vida'), ('Matcha', 'Estilo de Vida')
    ON CONFLICT (name) DO NOTHING;
END $$;

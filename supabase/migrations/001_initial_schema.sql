-- ==============================================================================
-- UNILINK - MIGRACIÓN 001: ESQUEMA BASE DE DATOS
-- ==============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- 1. UNIVERSIDADES
CREATE TABLE IF NOT EXISTS public.universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    short_name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DOMINIOS INSTITUCIONALES PERMITIDOS (ej. edu.uaa.mx)
CREATE TABLE IF NOT EXISTS public.university_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    domain CITEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CAMPUS
CREATE TABLE IF NOT EXISTS public.campuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(university_id, name)
);

-- 4. CARRERAS
CREATE TABLE IF NOT EXISTS public.careers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    area TEXT NOT NULL, -- ej. 'Ingeniería', 'Diseño', 'Salud', 'Ciencias Sociales'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(university_id, name)
);

-- 5. MATERIAS
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    career_id UUID NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(career_id, name)
);

-- 6. PERFILES DE USUARIO (Vinculados a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    birth_date DATE,
    gender TEXT, -- 'male', 'female', 'non-binary', 'other'
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

-- 7. FOTOS DE PERFIL (1 a 6 fotos ordenadas por position)
CREATE TABLE IF NOT EXISTS public.profile_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0 AND position < 6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, position)
);

-- 8. MATERIAS DEL PERFIL (materias cursadas este semestre)
CREATE TABLE IF NOT EXISTS public.profile_subjects (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    PRIMARY KEY(profile_id, subject_id)
);

-- 9. CATÁLOGO DE INTERESES
CREATE TABLE IF NOT EXISTS public.interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL -- 'Deportes', 'Música', 'Tecnología', 'Arte', 'Gaming', etc.
);

-- 10. INTERESES DEL PERFIL
CREATE TABLE IF NOT EXISTS public.profile_interests (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interest_id UUID NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
    PRIMARY KEY(profile_id, interest_id)
);

-- 11. HORARIOS DE DISPONIBILIDAD (bloques libres)
CREATE TABLE IF NOT EXISTS public.availability_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6), -- 0=Domingo, 1=Lunes, ...
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CHECK (start_time < end_time)
);

-- 12. MODOS DE CONEXIÓN ACTIVOS (Estudio, Amistad, Pareja)
CREATE TABLE IF NOT EXISTS public.connection_modes (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('study', 'friendship', 'dating')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    pref_genders TEXT[], -- Opcional para citas: ['female', 'male', etc.]
    min_age INTEGER CHECK (min_age >= 18),
    max_age INTEGER CHECK (max_age >= min_age),
    PRIMARY KEY(profile_id, mode)
);

-- 13. SWIPES (Likes y Pases)
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

-- 14. MATCHES MUTUOS (creados automáticamente al haber likes recíprocos en el mismo modo)
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

-- 15. CONVERSACIONES (Directas entre matches o Grupales)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. MENSAJES DE CHAT
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

-- 17. BLOQUEOS ENTRE USUARIOS
CREATE TABLE IF NOT EXISTS public.blocks (
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

-- 18. REPORTES DE CONDUCTA
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

-- 19. TÉRMINOS Y ACCIONES DE MODERACIÓN
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

-- 20. VERIFICACIONES DE SELFIE
CREATE TABLE IF NOT EXISTS public.photo_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    selfie_path TEXT NOT NULL,
    gesture_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. COMUNIDAD: GRUPOS DE ESTUDIO
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

-- 22. COMUNIDAD: EVENTOS DEL CAMPUS
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

-- 23. COMUNIDAD: TUTORÍAS
CREATE TABLE IF NOT EXISTS public.tutoring_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('offer', 'request')), -- Puedo enseñar / Necesito ayuda
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. SUSCRIPCIONES FREEMIUM / PREMIUM
CREATE TABLE IF NOT EXISTS public.subscriptions (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
    current_period_end TIMESTAMPTZ,
    provider TEXT DEFAULT 'mock', -- 'stripe', 'mercadopago', 'mock'
    provider_customer_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. LÍMITE DIARIO DE LIKES (25 para usuarios gratuitos)
CREATE TABLE IF NOT EXISTS public.daily_like_counts (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    swipe_date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY(profile_id, swipe_date)
);

-- 26. NOTIFICACIONES EN TIEMPO REAL
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('match', 'message', 'event', 'verification')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. PONDERACIONES CONFIGURABLES DE MATCHING
CREATE TABLE IF NOT EXISTS public.matching_weights (
    key TEXT PRIMARY KEY,
    weight NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1)
);

-- Índices para optimización de consultas
CREATE INDEX IF NOT EXISTS idx_profiles_university ON public.profiles(university_id);
CREATE INDEX IF NOT EXISTS idx_swipes_from ON public.swipes(from_id);
CREATE INDEX IF NOT EXISTS idx_swipes_to ON public.swipes(to_id);
CREATE INDEX IF NOT EXISTS idx_matches_users ON public.matches(user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);

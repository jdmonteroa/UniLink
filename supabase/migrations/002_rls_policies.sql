-- ==============================================================================
-- UNILINK - MIGRACIÓN 002: ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- 1. Habilitar RLS en todas las tablas
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

-- Helper function: obtener universidad del usuario actual
CREATE OR REPLACE FUNCTION public.get_my_university_id()
RETURNS UUID AS $$
  SELECT university_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: verificar si el usuario es moderador o admin
CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('moderator', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- POLÍTICAS: Catálogos públicos y de lectura general
CREATE POLICY "Lectura pública de universidades" ON public.universities FOR SELECT USING (true);
CREATE POLICY "Lectura pública de dominios" ON public.university_domains FOR SELECT USING (true);
CREATE POLICY "Lectura de campus" ON public.campuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura de carreras" ON public.careers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura de materias" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura de intereses" ON public.interests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura de ponderaciones" ON public.matching_weights FOR SELECT TO authenticated USING (true);

-- POLÍTICAS: Perfiles
CREATE POLICY "Ver perfiles de la misma universidad" ON public.profiles FOR SELECT TO authenticated
USING (
    -- Uno mismo siempre puede verse
    id = auth.uid()
    OR (
        -- Mismo campus / universidad
        university_id = public.get_my_university_id()
        AND is_suspended = FALSE
        AND is_paused = FALSE
        -- No bloqueado en ninguna dirección
        AND NOT EXISTS (
            SELECT 1 FROM public.blocks
            WHERE (blocker_id = auth.uid() AND blocked_id = public.profiles.id)
               OR (blocker_id = public.profiles.id AND blocked_id = auth.uid())
        )
    )
);

CREATE POLICY "Crear propio perfil" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Actualizar propio perfil" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- POLÍTICAS: Fotos, Materias, Intereses, Horarios, Modos
CREATE POLICY "Ver fotos de usuarios misma universidad" ON public.profile_photos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_photos.profile_id AND (p.id = auth.uid() OR p.university_id = public.get_my_university_id())));

CREATE POLICY "Gestionar fotos propias" ON public.profile_photos FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Ver materias de perfiles" ON public.profile_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestionar materias propias" ON public.profile_subjects FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Ver intereses de perfiles" ON public.profile_interests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestionar intereses propios" ON public.profile_interests FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Ver horarios de disponibilidad" ON public.availability_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestionar horarios propios" ON public.availability_slots FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Ver modos de conexion" ON public.connection_modes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestionar modos propios" ON public.connection_modes FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- POLÍTICAS: Swipes y Matches
CREATE POLICY "Ver propios swipes" ON public.swipes FOR SELECT TO authenticated USING (auth.uid() = from_id);
CREATE POLICY "Crear propio swipe" ON public.swipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_id);

CREATE POLICY "Ver matches donde participo" ON public.matches FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

-- POLÍTICAS: Conversaciones y Mensajes
CREATE POLICY "Ver conversaciones donde participo" ON public.conversations FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = conversations.match_id
          AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
);

CREATE POLICY "Ver mensajes de mis conversaciones" ON public.messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.matches m ON m.id = c.match_id
        WHERE c.id = messages.conversation_id
          AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
          AND messages.is_hidden = FALSE
    )
);

CREATE POLICY "Enviar mensajes a mis conversaciones con match" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.matches m ON m.id = c.match_id
        WHERE c.id = messages.conversation_id
          AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
          AND m.is_active = TRUE
    )
);

-- POLÍTICAS: Bloqueos y Reportes
CREATE POLICY "Ver mis bloqueos" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Crear bloqueo" ON public.blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Eliminar bloqueo" ON public.blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

CREATE POLICY "Crear reporte" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Moderadores ven reportes de su universidad" ON public.reports FOR SELECT TO authenticated
USING (
    public.is_moderator_or_admin()
    OR auth.uid() = reporter_id
);

-- POLÍTICAS: Suscripciones y Notificaciones
CREATE POLICY "Ver mi propia suscripcion" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = profile_id);
-- No se permite INSERT/UPDATE directo a subscriptions por parte del usuario común

CREATE POLICY "Ver mis notificaciones" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Actualizar mis notificaciones (marcar leido)" ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- POLÍTICAS: Grupos, Eventos y Tutorías
CREATE POLICY "Ver grupos de mi universidad" ON public.study_groups FOR SELECT TO authenticated
USING (university_id = public.get_my_university_id());
CREATE POLICY "Crear grupo de estudio" ON public.study_groups FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND university_id = public.get_my_university_id());

CREATE POLICY "Ver eventos de mi universidad" ON public.events FOR SELECT TO authenticated
USING (university_id = public.get_my_university_id());
CREATE POLICY "Crear evento" ON public.events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND university_id = public.get_my_university_id());

CREATE POLICY "Ver tutorias" ON public.tutoring_offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestionar mis tutorias" ON public.tutoring_offers FOR ALL TO authenticated
USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

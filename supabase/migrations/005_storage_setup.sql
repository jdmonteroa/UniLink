-- ==============================================================================
-- UNILINK - MIGRACIÓN 005: CONFIGURACIÓN DE STORAGE BUCKETS Y POLÍTICAS
-- ==============================================================================

-- 1. Crear buckets si no existen
INSERT INTO storage.buckets (id, name, public) VALUES
    ('avatars', 'avatars', true),
    ('verifications', 'verifications', false),
    ('chat-images', 'chat-images', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Storage para 'avatars'
CREATE POLICY "Lectura de avatares para usuarios autenticados"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Subir propio avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Actualizar/Eliminar propio avatar"
ON storage.objects FOR ALL TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Políticas de Storage para 'verifications' (Privado)
CREATE POLICY "Subir foto de verificacion propia"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'verifications' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Moderadores pueden ver fotos de verificacion"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'verifications'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('moderator', 'admin')
        )
    )
);

-- 4. Políticas de Storage para 'chat-images'
CREATE POLICY "Subir imagen a conversacion"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Ver imagenes de chat autorizadas"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-images');

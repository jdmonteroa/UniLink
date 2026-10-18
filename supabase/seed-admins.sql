-- ==============================================================================
-- UniLink · CUENTAS DE ADMINISTRACIÓN (ejecutar DESPUÉS de setup.sql)
-- ==============================================================================
-- Crea 2 administradores ya confirmados (sin verificación de correo ni onboarding).
-- Un administrador no usa la app para conocer gente: solo ve Eventos (moderación) y
-- Mi perfil, y no aparece en Descubrir.
--
--   admin1@edu.uaa.mx   /   admin2@edu.uaa.mx
--   Contraseña inicial: AdminUnilink2026!
--
-- ⚠ Esta contraseña queda escrita en este archivo. Cámbiala en cuanto entres por
--   primera vez (Mi perfil → Cambiar contraseña) y no subas este archivo a un
--   repositorio público. Si las cuentas ya existen NO se les cambia la contraseña;
--   solo se asegura que tengan el rol 'admin'.
--
-- Para quitar el acceso a alguien después:
--   UPDATE public.profiles SET role = 'student' WHERE id = (SELECT id FROM auth.users WHERE email = '...');
-- ==============================================================================
DO $$
DECLARE
    uni UUID := '11111111-1111-1111-1111-111111111111';
    r RECORD;
    uid UUID;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('admin1@edu.uaa.mx', 'Administrador 1'),
        ('admin2@edu.uaa.mx', 'Administrador 2')
    ) AS t(email, name)
    LOOP
        SELECT id INTO uid FROM auth.users WHERE email = r.email;

        IF uid IS NULL THEN
            uid := gen_random_uuid();
            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                confirmation_token, recovery_token, email_change_token_new, email_change
            ) VALUES (
                '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', r.email,
                extensions.crypt('AdminUnilink2026!', extensions.gen_salt('bf')), NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('full_name', r.name), NOW(), NOW(), '', '', '', ''
            );

            -- Identidad de email para poder iniciar sesión (si tu versión de
            -- Supabase tiene otra estructura, solo se omite este paso)
            BEGIN
                INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
                VALUES (gen_random_uuid(), uid::text, uid,
                        jsonb_build_object('sub', uid::text, 'email', r.email, 'email_verified', true),
                        'email', NOW(), NOW(), NOW());
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'No se creó la identidad de % (%).', r.email, SQLERRM;
            END;
        END IF;

        -- Por si el trigger de registro no existía cuando se creó el usuario
        INSERT INTO public.profiles (id, full_name, university_id, role)
        VALUES (uid, r.name, uni, 'admin')
        ON CONFLICT (id) DO NOTHING;

        UPDATE public.profiles SET
            role = 'admin',
            university_id = uni,
            onboarding_completed = TRUE,
            is_photo_verified = TRUE,
            is_suspended = FALSE,
            suspended_until = NULL
        WHERE id = uid;

        RAISE NOTICE 'Administrador listo: %', r.email;
    END LOOP;
END $$;

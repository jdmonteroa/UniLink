-- ==============================================================================
-- UNILINK - SEED DATA: UNIVERSIDAD AUTÓNOMA DE AGUASCALIENTES (UAA)
-- Dominio oficial: @edu.uaa.mx
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
-- 7. ESTUDIANTES DE PRUEBA (10 perfiles completos)
-- ------------------------------------------------------------------------------
-- Cada perfil necesita existir primero en auth.users (por la llave foránea), así
-- que aquí se crean como usuarios reales ya confirmados. El trigger de registro
-- les crea el perfil y después se completa con sus datos.
--
-- Puedes iniciar sesión con cualquiera para probar matches y chat desde el otro
-- lado, por ejemplo:  sofia.alvarez@edu.uaa.mx  /  UniLinkDemo2026!
-- Requiere haber corrido antes la migración 007.
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

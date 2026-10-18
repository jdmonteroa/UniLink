<p align="center"><img src="public/logo-unilink.png" alt="UniLink" width="160" /></p>

# UniLink

> **App web para conectar estudiantes universitarios verificados de forma segura según intereses reales.**
> Encuentra compañeros de estudio, amistad o pareja en tu campus.

---

## Qué hace

- **Solo estudiantes verificados**: el registro solo acepta correos institucionales (`@edu.uaa.mx`, `@alumnos.uaa.mx`). La base de datos rechaza cualquier otro dominio.
- **Tres modos de conexión**: Estudio, Amistad y Pareja. Cada quien activa los que quiera y elige a quién quiere conocer en cada uno (Mujeres, Hombres o Todos). El filtro es mutuo: solo ves a quien también quiere conocer a alguien como tú.
- **Descubrir**: tarjetas que se deslizan a la derecha ("Me interesa") o a la izquierda ("Pasar"), con un porcentaje de afinidad calculado a partir de materias, intereses, horario libre, carrera, campus y actividad reciente.
- **Matches y chat en tiempo real**: cuando el interés es mutuo se crea el match y se abre el chat. Incluye deshacer match, bloquear y reportar, y moderación automática de mensajes.
- **Grupos**: cualquiera crea un grupo (nombre, categoría, descripción, imagen y enlace de WhatsApp u otra red). Son visibles para toda la universidad; se pide permiso para entrar y un administrador del grupo lo acepta. Solo los miembros ven el enlace. El creador es administrador y nombra más administradores entre los miembros.
- **Eventos y avisos**: cualquiera puede mandar uno (texto, imagen o ambos), pero nada se publica hasta que un moderador lo aprueba. Ver [Moderación de eventos](#moderación-de-eventos).
- **Perfil**: hasta 2 fotos, biografía, Instagram (solo lo ven tus matches), intereses, materias y horario libre.
- **Modo día y noche**.
- **App instalable (PWA)**: se puede instalar en el celular desde el navegador, abre aunque no haya internet y avisa cuando hay una versión nueva.

---

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite + React Router v7
- **Estilos & Animaciones**: Tailwind CSS v4 + Framer Motion + Lucide React
- **Tipografía**: Fraunces (títulos y nombres) + Plus Jakarta Sans (texto)
- **Estado & Datos**: Zustand (sesión / tema) + TanStack Query v5 (servidor)
- **Formularios & Validación**: React Hook Form + Zod
- **Backend (BaaS)**: Supabase (Auth con verificación institucional, PostgreSQL con RLS, Realtime, Storage)
- **PWA**: vite-plugin-pwa (manifiesto, íconos y service worker con Workbox)
- **Testing**: Vitest

---

## Instalación y Puesta en Marcha

### 1. Clonar e instalar dependencias (requiere Node.js 20.19 o superior)
```bash
git clone https://github.com/jdmonteroa/UniLink.git
cd UniLink
npm install
```

### 2. Configurar variables de entorno
Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```
Edita `.env` con las credenciales de tu proyecto de Supabase:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-public-key
VITE_APP_URL=http://localhost:5173
```
> ⚠️ **REGLA DE SEGURIDAD**: NUNCA coloques la `service_role key` en el frontend ni en archivos `.env` del cliente. El archivo `.env` está en `.gitignore` y no debe subirse al repositorio.

### 3. Ejecutar en desarrollo
```bash
npm run dev
```
Abre en tu navegador: [http://localhost:5173](http://localhost:5173)

### 4. Ejecutar pruebas unitarias
```bash
npm test
```

### 5. Compilar para producción
```bash
npm run build
```

---

## Configuración de Supabase

Toda la base de datos está en un solo archivo: `supabase/setup.sql`. Cópialo completo en el **SQL Editor** de tu proyecto de Supabase y presiona *Run*. Crea las tablas, la seguridad (RLS), el bucket `avatars` para fotos, el matching, las funciones del chat, la moderación y el catálogo de la UAA (dominios `@edu.uaa.mx`, campus, carreras, materias e intereses).

Sirve tanto para un proyecto nuevo como para actualizar uno que ya tenga una versión anterior instalada: se puede correr varias veces sin romper nada ni duplicar datos.

Después, en el dashboard:

- **Authentication → URL Configuration**: pon `http://localhost:5173` (y tu dominio de Vercel/Netlify) como *Site URL* y en *Redirect URLs*.
- **Database → Replication / Publications**: confirma que la tabla `messages` está en `supabase_realtime` (`setup.sql` la agrega) para que el chat llegue en tiempo real.

### Cuentas de prueba
Al final de `setup.sql` hay una sección **opcional y desactivada** que crea 10 estudiantes de prueba con la contraseña `UniLinkDemo2026!` (ej. `sofia.alvarez@edu.uaa.mx`), para probar matches y chat desde el otro lado. Para activarla, sigue las instrucciones de esa sección y vuelve a correr el archivo. No la actives en producción.

---

## Cómo funciona

La app no tiene un servidor propio: el frontend habla directo con Supabase usando solo la clave pública (`anon key`). La seguridad vive en las políticas RLS de cada tabla.

- **Registro**: un trigger (`handle_new_user`) valida el dominio del correo y crea el perfil y los modos de conexión.
- **Descubrir**: la función `get_recommendations` filtra (misma universidad, modo activo, preferencias mutuas, sin bloqueos) y calcula la afinidad.
- **Deslizar**: cada decisión se guarda en `swipes`. Un trigger (`handle_swipe_action`) crea el match y la conversación cuando el "Me interesa" es mutuo, y limita a 25 "Me interesa" al día en cuentas gratuitas.
- **Chat**: los mensajes se guardan en `messages` y llegan por Realtime. Un trigger (`moderate_message`) frena el spam y descarta mensajes con términos prohibidos.
- **Reportes**: si 3 personas distintas reportan a alguien en 7 días, su perfil se suspende automáticamente 3 días (`handle_report_threshold`).
- **Otras funciones**: `get_my_matches`, `unmatch`, `block_user`, `mark_conversation_read` y `ensure_my_profile`.

### Moderación de eventos
Todo evento o aviso nace **en revisión** y solo se publica cuando un moderador o administrador lo aprueba.

- **Quién modera**: quien tenga `role = 'moderator'` (o `'admin'`, que además puede dar bloqueos permanentes) en `profiles`. Se asigna una sola vez desde el SQL Editor:
  ```sql
  UPDATE public.profiles SET role = 'moderator' WHERE id = '<uuid del usuario>';
  ```
  Esas personas ven la pestaña **Moderación** dentro de *Eventos*. Nadie puede revisar su propia publicación (salvo un administrador).
- **Filtro de texto** (ya incluido): al enviar, la base de datos compara el texto con `content_filter_terms` (insultos, groserías, contenido sexual, amenazas y spam; ignora acentos, mayúsculas, letras repetidas y cambios como `p3ndej0`). El resultado se guarda en `events.text_scan` y la persona que modera ve qué términos coincidieron y su gravedad. Es solo informativo; puedes agregar o quitar términos desde el SQL Editor.
- **Filtro de imagen (SafeSearch)**: pendiente de conectar. Hasta entonces `events.image_scan` queda en `{"status": "pending"}` y la cola muestra "todavía no hay análisis automático, revísala tú". Para conectarlo:
  1. Una Edge Function que se ejecute cuando se inserte una fila en `events` con `image_path` (por ejemplo, con un *Database Webhook* sobre `INSERT` en `events`).
  2. La función arma la URL pública `…/storage/v1/object/public/event-images/<image_path>`, la envía a Google Cloud Vision (`SAFE_SEARCH_DETECTION`) y guarda la clave de la API como secreto de Supabase.
  3. Con la clave `service_role` (solo dentro de la Edge Function) llama a `public.set_event_image_scan(p_event, p_scan)` con este formato, que es el que entiende la cola de moderación:
     ```json
     { "status": "done", "provider": "google_safesearch",
       "adult": "VERY_UNLIKELY", "violence": "UNLIKELY", "racy": "POSSIBLE",
       "spoof": "UNLIKELY", "medical": "VERY_UNLIKELY" }
     ```
     (o `{ "status": "error", "error": "mensaje" }` si falla). Los valores son los de SafeSearch: `VERY_UNLIKELY`, `UNLIKELY`, `POSSIBLE`, `LIKELY`, `VERY_LIKELY`.
  La función `set_event_image_scan` solo puede ejecutarla `service_role`; ningún usuario de la app puede llamarla.
- **Decisiones**: *Aprobar*; *Rechazar* (con un motivo que ve quien publicó; la imagen se borra del almacenamiento); o *Rechazar y sancionar*: advertencia, no poder publicar eventos N días, suspender la cuenta N días o bloqueo permanente (solo administradores). Las sanciones quedan en `moderation_actions`.
- **Otras protecciones**: máximo 3 publicaciones activas por persona, los eventos expiran solos (6 h después de su hora, o 14 días si son avisos) y un evento ya publicado vuelve a revisión si 2 personas distintas lo reportan.

### Fotos
Las fotos se comprimen en el navegador (máx. 1440 px, JPEG) y se suben al bucket `avatars` en `avatars/<tu-id>/<archivo>.jpg`. La base de datos no guarda la imagen, solo su ruta en `profile_photos.storage_path` junto con su posición (0 = foto principal, 1 = segunda foto; máximo 2). La app convierte esa ruta en una URL pública para mostrarla. Solo el dueño puede subir o borrar archivos en su carpeta.

---

## App instalable (PWA)

- **Íconos**: están en `public/` (el logo oficial: dos personas cuyos cuerpos forman la "u" y se enlazan; el favicon de la pestaña es `favicon.ico`). El manifiesto (nombre, colores e íconos) se configura en `vite.config.ts`.
- **Instalar**: en Android/Chrome aparece el botón "Instalar app" en *Mi perfil*; en iPhone se muestran los pasos para agregarla desde Safari (Compartir → Agregar a inicio).
- **Sin conexión**: la app y las fotos ya vistas se guardan en el celular. Los datos (perfiles, mensajes) siempre se piden a Supabase, así que sin internet aparece el aviso "Sin conexión".
- **Actualizaciones**: después de cada despliegue, quien tenga la app abierta ve "Hay una versión nueva" y decide cuándo actualizar.
- El service worker solo funciona en producción (`npm run build`); en `npm run dev` no se activa.

## Estructura del proyecto

```
src/
  app/          App, rutas y guardia de sesión
  components/   Componentes compartidos (fotos, diálogos, logo, selector "Quiero conocer")
  features/     Pantallas por función: auth, onboarding, discover, chat, profile, theme
  lib/          Cliente de Supabase, fotos, catálogo y utilidades
  styles/       Tokens de diseño (colores, tipografía) en index.css
supabase/
  setup.sql     Base de datos completa (un solo archivo)
```

---

## Despliegue en Vercel / Netlify

1. Conecta tu repositorio de GitHub a Vercel o Netlify.
2. Configura el comando de build: `npm run build`
3. Directorio de salida: `dist`
4. Añade las variables de entorno en la configuración del proyecto: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Agrega el dominio de producción en Supabase (**Authentication → URL Configuration**).

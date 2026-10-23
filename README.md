<p align="center"><img src="public/logo-unilink.png" alt="UniLink" width="160" /></p>

# UniLink

> **App web para conectar estudiantes universitarios verificados de forma segura según intereses reales.**
> Encuentra amistades (compañeros de tu carrera y con tus gustos) o pareja en tu campus.

---

## Qué hace

- **Solo estudiantes verificados**: el registro solo acepta correos institucionales (`@edu.uaa.mx`, `@alumnos.uaa.mx`). La base de datos rechaza cualquier otro dominio.
- **Dos modos de conexión**: Amistades y Pareja. Cada quien activa los que quiera y elige a quién quiere conocer en cada uno (Mujeres, Hombres o Todos). El filtro es mutuo: solo ves a quien también quiere conocer a alguien como tú.
- **Amistades**: una **lista** de estudiantes. Cada fila muestra su foto, su carrera y lo que le gusta hacer (los intereses que comparten contigo resaltan). Se filtra por carrera, semestre, campus, materia que cursa y lo que le gusta, se puede buscar por texto, y hay atajos como "Mi carrera", "Mi semestre" y "Cursan lo mismo que yo". En Amistades **siempre hay gente**: la lista muestra a todos los compatibles, también a quienes ya les diste la mano (con la marca "Pendiente", al final); con quien ya hiciste match deja de salir ahí y pasa a Matches. En **Matches** hay un filtro **Interés enviado** con las personas a las que ya les diste la mano y aún no responden (se puede retirar el interés). Si el interés es mutuo, se crea el match y simplemente aparece en Matches, sin confeti ni ventana.
- **Pareja**: tarjetas que se deslizan a la derecha ("Me interesa") o a la izquierda ("Pasar"), con un porcentaje de afinidad calculado a partir de materias, intereses, horario libre, carrera, campus y actividad reciente. **Pasar no es para siempre**: esa persona descansa 3 días y puede volver a salir, y el sistema baja (hasta 40 %) la afinidad de perfiles parecidos (intereses y carrera) a los que pasaste. Solo en Pareja un match se celebra con confeti y la ventana "¡Hay match!".
- **Matches y encuentros**: los matches se dividen en **Amistades** y **Pareja**. Cada match tiene un **chat temporal** (los mensajes se borran a las 24 horas) y además puede conectarse proponiendo un encuentro en la escuela (ver [Encuentros](#encuentros)). Incluye deshacer match, bloquear y reportar.
- **Grupos**: cualquiera puede **proponer** un grupo (nombre, categoría, descripción, imagen y enlace de WhatsApp u otra red), pero **un administrador lo revisa antes de publicarlo** (nombre, imagen y descripción). Una vez aprobado es visible para toda la universidad; se pide permiso para entrar y un administrador del grupo lo acepta. Solo los miembros ven el enlace. El creador es administrador del grupo y nombra más administradores entre los miembros. Ver [Moderación de grupos](#moderación-de-grupos).
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
- **Descubrir**: la función `get_recommendations` filtra (misma universidad, modo activo, preferencias mutuas, sin bloqueos) y calcula la afinidad. Pareja la usa directamente; **Amistades** usa `list_students`, que la envuelve y agrega los filtros (carrera, campus, semestre, materia, interés y texto, con paginación de 40 en 40).
- **El modo Estudio ya no existe** en la app. Los datos viejos de ese modo (`connection_modes`, `swipes`, `matches` con `mode = 'study'`) no se borran; los matches antiguos se muestran como Amistades.
- **Deslizar**: la app llama a `record_swipe` (cambiar de opinión reemplaza la respuesta anterior). Un trigger (`handle_swipe_action`) crea el match y la conversación cuando el "Me interesa" es mutuo, y limita a 25 "Me interesa" al día en cuentas gratuitas. `get_recommendations` (tarjetas de Pareja) excluye los "Me interesa" y los "Pasar" de los últimos 3 días; `list_students` (Amistades) no excluye a nadie.
- **Chat temporal**: los mensajes se guardan en `messages` y llegan por Realtime; un trigger (`moderate_message`) frena el spam y descarta términos prohibidos. A las 24 h dejan de verse (política RLS) y `purge_expired_messages()` los borra: se ejecuta al abrir los matches y, si activas la extensión **pg_cron** (Database → Extensions) antes de correr `setup.sql`, cada 10 minutos. Si alguien **reporta** a otra persona, se guarda una copia de los mensajes de las últimas 24 h en `report_message_snapshots` (solo la ven moderadores) para que el reporte conserve su evidencia. Los administradores la ven en la pestaña **Reportes** (`get_reports_for_review` / `resolve_report`), donde pueden marcar el reporte en revisión, descartarlo o resolverlo.
- **Reportes**: si 3 personas distintas reportan a alguien en 7 días, su perfil se suspende automáticamente 3 días (`handle_report_threshold`).
- **Otras funciones**: `get_my_matches`, `unmatch`, `block_user`, `mark_conversation_read` y `ensure_my_profile`.

### Encuentros
Además del chat temporal, tras un match cualquiera de los dos puede **proponer un encuentro**: un lugar libre dentro de la escuela (salón, cafetería, librería, infoteca…), fecha y hora, y un **mensaje obligatorio** de 5 a 200 caracteres.

- Quien recibe la propuesta ve un **punto rojo** en la pestaña *Matches* y en ese match; al entrar ve el mensaje, el lugar y la hora y puede **aceptar**, **rechazar** (con nota opcional) o **replantear** (otro lugar u hora, con su propio mensaje obligatorio). Quien propuso ve "Esperando respuesta" y puede cancelar.
- Máximo **3 rondas** de replanteamiento por propuesta, una propuesta activa por match, y vencen a las 48 h sin respuesta o al pasar la hora. Máximo 10 propuestas por persona al día.
- El texto (lugar, mensaje y notas) pasa por el mismo filtro de insultos, groserías, contenido sexual, amenazas y spam que los eventos, y además no admite enlaces. Si no pasa, no se envía; aquí no hay moderador en medio.
- El **Instagram** del match solo se muestra cuando hay un encuentro aceptado, para avisar de imprevistos.
- El punto rojo se actualiza en vivo (Realtime sobre `meetups`). Todo está en la sección 2.15 de `setup.sql` (`propose_meetup`, `respond_meetup`, `cancel_meetup`, `get_my_connections`…).

### Moderación de eventos
Todo evento o aviso nace **en revisión** y solo se publica cuando un moderador o administrador lo aprueba.

- **Quién modera**: quien tenga `role = 'moderator'` (o `'admin'`, para las cuentas dedicadas a moderar; ver Administradores) en `profiles`. Se asigna una sola vez desde el SQL Editor:
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
- **Decisiones**: *Aprobar*; *Rechazar* (con un motivo que ve quien publicó; la imagen se borra del almacenamiento); o *Rechazar y sancionar*. Cada sanción suma **una** al contador de la persona (`moderation_actions`, acción `strike`) y le manda un correo. **A las 5 sanciones la cuenta se bloquea sola**: el perfil queda bloqueado, se marca `banned_until = infinity` en Supabase Auth (ya no puede iniciar sesión) y se cierran sus sesiones. Quien modera no decide el bloqueo.
- **Desbloquear** (manual, desde el SQL Editor, si fue un error):
  ```sql
  UPDATE public.profiles SET is_suspended = FALSE, suspended_until = NULL WHERE id = '<uuid>';
  UPDATE auth.users SET banned_until = NULL WHERE id = '<uuid>';
  DELETE FROM public.moderation_actions WHERE target_user_id = '<uuid>' AND action IN ('strike', 'ban'); -- reinicia el conteo
  ```
- **Otras protecciones**: máximo 3 publicaciones activas por persona, quien tenga la cuenta bloqueada no puede publicar, los eventos expiran solos (6 h después de su hora, o 14 días si son avisos) y un evento ya publicado vuelve a revisión si 2 personas distintas lo reportan.

### Moderación de grupos
Los grupos pasan por revisión igual que los eventos, y quienes los crean no los eliminan por su cuenta.

- **Crear:** un grupo nuevo nace *en revisión* (`groups.status = 'pending'`): nadie más lo ve ni puede pedir entrar. Un moderador o administrador ve nombre, imagen, descripción, quién lo envió (con sus rechazos previos), de qué plataforma es el enlace (no el enlace) y el resultado del filtro de texto, y lo **aprueba** o lo **rechaza con un motivo** que ve quien lo envió. Un grupo rechazado se corrige y se reenvía desde el mismo grupo.
- **Editar:** cambiar el nombre, la descripción o la imagen de un grupo aprobado lo **vuelve a revisión** (para que nadie cambie un grupo aprobado por otra cosa). Cambiar solo el enlace o la categoría es inmediato.
- **Eliminar:** un grupo **solo lo elimina un moderador o administrador de la plataforma, con motivo**, y nunca uno que él mismo creó. Quien creó o administra un grupo **no lo elimina por su cuenta en ningún estado** (en revisión, rechazado o aprobado): manda una petición (ver *Pedir cambios*).
- **Pedir cambios:** quien administra un grupo manda una **petición con motivo** (mínimo 10 caracteres): *eliminar el grupo* (vale en cualquier estado) o *que lo lleve otra persona* (solo el creador, solo un grupo aprobado, y esa persona debe ser miembro). Un moderador o administrador la aprueba o la rechaza (con motivo, que ven los administradores del grupo); nadie resuelve su propia petición, salvo un administrador. Hay una petición activa por grupo. Al aprobar un traspaso, la persona elegida queda como creadora y administradora.
- **Dónde se modera:** en *Grupos → Moderación* para moderadores y en la pestaña *Grupos* del panel de administración. Hay un puntito rojo cuando hay algo pendiente.
- **Bitácora:** `group_moderation_log` guarda aprobaciones, rechazos, traspasos y eliminaciones (quién, cuándo y por qué), aun después de borrar el grupo.
- Los grupos que ya existían antes de este cambio quedan **aprobados** al correr `setup.sql`. Los roles `moderator`/`admin` son los mismos de la moderación de eventos.

### Administradores
Las cuentas de administración se crean con `supabase/seed-admins.sql` (se corre **después** de `setup.sql`; no forma parte de `setup.sql` a propósito). Crea `admin1@edu.uaa.mx` y `admin2@edu.uaa.mx` ya confirmados, sin verificación ni onboarding.

- Solo ven **Eventos** (abre directo en *Moderación*), **Grupos** (solo la moderación: grupos por aprobar, peticiones y todos los grupos) y **Mi perfil**. No aparecen en Descubrir ni usan Matches.
- La contraseña inicial está escrita en ese archivo: **cámbiala en el primer inicio de sesión** (Mi perfil → Cambiar contraseña) y no subas el archivo a un repositorio público.
- Para volver a alguien administrador o quitarle el acceso: `UPDATE public.profiles SET role = 'admin' | 'student' WHERE id = '<uuid>';`

### Correos de sanción
Cada sanción agrega una fila a `public.email_outbox` (destinatario, plantilla y datos: nombre, evento, motivo, sanciones, límite y si la cuenta quedó bloqueada). Así la sanción siempre se registra aunque el envío falle. La plantilla es `supabase/email-templates/sancion.html` y muestra el conteo ("2 de 5"), cuántas sanciones le quedan y el aviso de que a las 5 la cuenta se bloquea; al llegar a 5 el correo avisa del bloqueo.

El envío lo hace la Edge Function `supabase/functions/send-sanction-email` (usa [Resend](https://resend.com); se puede cambiar por otro proveedor editando `sendMail()`). **Aún no está desplegada ni se ha probado contra un proveedor real**; lo que sí está probado es el renderizado de la plantilla (`render.test.ts`). Para activarla:
1. `supabase secrets set RESEND_API_KEY=... MAIL_FROM="UniLink <avisos@tu-dominio>" WEBHOOK_SECRET=<cadena larga al azar>` (el remitente debe ser un dominio verificado en el proveedor).
2. `supabase functions deploy send-sanction-email --no-verify-jwt`
3. En Supabase → Database → Webhooks: nuevo webhook sobre `INSERT` en `public.email_outbox` que llame a la función, con el encabezado `x-webhook-secret: <el mismo WEBHOOK_SECRET>`.

Si cambias la plantilla, copia el mismo contenido a `supabase/functions/send-sanction-email/sancion.html` (una prueba verifica que ambas sean idénticas). Los correos que fallen quedan con `status = 'failed'` y el error en `last_error`.

### Fotos
Las fotos se comprimen en el navegador (máx. 1440 px, JPEG) y se suben al bucket `avatars` en `avatars/<tu-id>/<archivo>.jpg`. La base de datos no guarda la imagen, solo su ruta en `profile_photos.storage_path` junto con su posición (0 = foto principal, 1 = segunda foto; máximo 2). La app convierte esa ruta en una URL pública para mostrarla. Solo el dueño puede subir o borrar archivos en su carpeta.

---

## App de Android (APK)
La app tiene un APK para Android que se descarga desde la propia web, en `/descargar` (página pública, sin iniciar sesión). El enlace aparece en el pie del login y, en Android, como tarjeta en *Mi perfil*.

**Cómo funciona.** Es una *Trusted Web Activity* (generada con PWABuilder): el APK solo abre `https://unilinksystem.vercel.app` a pantalla completa, sin barra del navegador. Por eso **las mejoras de la web les llegan solas** a quienes ya lo instalaron (con el aviso "Hay una versión nueva" de la PWA); solo hay que generar un APK nuevo si cambia el ícono, el nombre, el ID del paquete (`app.vercel.unilink.twa`) o la URL del sitio.

**Piezas en el repositorio**
- `public/downloads/unilink.apk`: el archivo que se descarga. Vercel lo sirve con `Content-Disposition: attachment` (ver `vercel.json`). El tamaño que muestra la página se calcula al compilar.
- `public/.well-known/assetlinks.json`: enlaza el sitio con el APK (ID del paquete + huella SHA-256 de la llave de firma). Sin él, Android mostraría la barra de direcciones. Debe abrir en `https://<dominio>/.well-known/assetlinks.json`.
- `vite.config.ts` excluye `/downloads/` y `/.well-known/` del `navigateFallback` del service worker; sin eso, tocar "Descargar" bajaría `index.html` en vez del APK.
- `src/lib/android.ts`: versión que muestra la página (`ANDROID_APK.version`).

**Publicar una versión nueva del APK**
1. Genera el APK nuevo en PWABuilder con el **mismo ID de paquete y la misma llave de firma** (`signing.keystore`); así Android lo instala como actualización.
2. Reemplaza `public/downloads/unilink.apk` y sube `ANDROID_APK.version` en `src/lib/android.ts`.
3. Si cambió la llave o el dominio, actualiza también `assetlinks.json` (una huella o dominio distintos quitan el modo pantalla completa).

**Importante: la llave de firma.** `signing.keystore` y sus contraseñas **no están ni deben estar en el repositorio** (`.gitignore` bloquea `*.keystore`, `*.jks`, `signing-key-info*` y `*.aab`). Guárdalos en un lugar seguro y con respaldo: si se pierden, ya no se pueden publicar actualizaciones del mismo APK.

**Instalación para quien lo descarga:** permitir "instalar apps de esta fuente" para su navegador y, si Play Protect avisa, elegir "Instalar de todos modos" (la página lo explica). Necesita Chrome instalado en el teléfono. En iPhone no hay APK: se usa "Agregar a inicio" desde Safari.

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
  features/     Pantallas por función: auth, onboarding, discover, connections (matches, chat temporal, encuentros), profile, theme
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

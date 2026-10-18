# UniLink

> **App web para conectar estudiantes universitarios verificados de forma segura según intereses reales.**
> Encuentra compañeros de estudio, amistad o pareja en tu campus.

---

## Qué hace

- **Solo estudiantes verificados**: el registro solo acepta correos institucionales (`@edu.uaa.mx`, `@alumnos.uaa.mx`). La base de datos rechaza cualquier otro dominio.
- **Tres modos de conexión**: Estudio, Amistad y Pareja. Cada quien activa los que quiera y elige a quién quiere conocer en cada uno (Mujeres, Hombres o Todos). El filtro es mutuo: solo ves a quien también quiere conocer a alguien como tú.
- **Descubrir**: tarjetas que se deslizan a la derecha ("Me interesa") o a la izquierda ("Pasar"), con un porcentaje de afinidad calculado a partir de materias, intereses, horario libre, carrera, campus y actividad reciente.
- **Matches y chat en tiempo real**: cuando el interés es mutuo se crea el match y se abre el chat. Incluye deshacer match, bloquear y reportar, y moderación automática de mensajes.
- **Perfil**: hasta 6 fotos, biografía, Instagram (solo lo ven tus matches), intereses, materias y horario libre.
- **Modo día y noche**.

---

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite + React Router v7
- **Estilos & Animaciones**: Tailwind CSS v4 + Framer Motion + Lucide React
- **Tipografía**: Fraunces (títulos y nombres) + Plus Jakarta Sans (texto)
- **Estado & Datos**: Zustand (sesión / tema) + TanStack Query v5 (servidor)
- **Formularios & Validación**: React Hook Form + Zod
- **Backend (BaaS)**: Supabase (Auth con verificación institucional, PostgreSQL con RLS, Realtime, Storage)
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

### Fotos
Las fotos se comprimen en el navegador (máx. 1440 px, JPEG) y se suben al bucket `avatars` en `avatars/<tu-id>/<archivo>.jpg`. La base de datos no guarda la imagen, solo su ruta en `profile_photos.storage_path` junto con su posición (0 = foto principal, máximo 6). La app convierte esa ruta en una URL pública para mostrarla. Solo el dueño puede subir o borrar archivos en su carpeta.

---

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

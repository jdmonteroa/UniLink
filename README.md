# UniLink 🎓

> **App web para conectar estudiantes universitarios verificados de forma segura según intereses reales.**  
> Encuentra compañeros de estudio, tutorías, amistad o pareja en tu campus.

---

## 🚀 Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite + React Router v7
- **Estilos & Animaciones**: Tailwind CSS v4 + Framer Motion + Lucide React
- **Estado & Datos**: Zustand (sesión / tema) + TanStack Query v5 (servidor)
- **Formularios & Validación**: React Hook Form + Zod
- **Backend (BaaS)**: Supabase (Auth con verificación institucional, PostgreSQL con RLS, Realtime, Storage, Edge Functions)
- **Testing**: Vitest

---

## 📦 Instalación y Puesta en Marcha

### 1. Clonar e instalar dependencias (requiere Node.js 20.19 o superior)
```bash
git clone <url-del-repo>
cd uniLink
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
> ⚠️ **REGLA DE SEGURIDAD**: NUNCA coloques la `service_role key` en el frontend ni en archivos `.env` del cliente.

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

## 🗄️ Configuración de Supabase

En el **SQL Editor** de tu proyecto de Supabase corre, en este orden:

1. `supabase/COMPLETE_SETUP.sql` *(solo si es un proyecto nuevo; si ya lo corriste, sáltalo)*
2. `supabase/migrations/007_reparacion_onboarding_fotos_chat.sql` **(obligatorio)** — crea las políticas RLS que faltaban, el bucket `avatars` para fotos, el matching, las funciones del chat y la moderación. Se puede correr varias veces sin romper nada.
3. `supabase/seed.sql` — carreras, materias, intereses y 10 estudiantes de prueba.

Después, en el dashboard:

- **Authentication → URL Configuration**: pon `http://localhost:5173` (y tu dominio de Vercel/Netlify) como *Site URL* y en *Redirect URLs*.
- **Database → Replication / Publications**: confirma que la tabla `messages` está en `supabase_realtime` (la migración 007 la agrega) para que el chat llegue en tiempo real.

### Cuentas de prueba
Los 10 perfiles del seed pueden iniciar sesión con la contraseña `UniLinkDemo2026!` (ej. `sofia.alvarez@edu.uaa.mx`). Sirven para probar el chat desde el otro lado. Al final de `seed.sql` hay un bloque opcional para que todos te den "Me interesa" y así obtener matches al instante.

### Fotos
Las fotos se comprimen en el navegador (máx. 1440 px, JPEG) y se suben a `avatars/<tu-id>/<archivo>.jpg`. En `profile_photos.storage_path` se guarda esa ruta; la app la convierte en URL pública. Solo el dueño puede subir o borrar en su carpeta.

### Modo demo
Si el `.env` no tiene credenciales, la app ofrece "Probar en modo demo": todo funciona en memoria y no se guarda nada.

---

## 🎨 Propuestas de Diseño (Fase 1)

En la Fase 1, la aplicación incluye una interfaz interactiva para comparar las dos direcciones de diseño:
- **Propuesta A: "Campus Pulse"**: Digital Vanguard / Neo-Brutalist Soft (Outfit + Plus Jakarta Sans, bordes orgánicos `rounded-3xl`, glow por modo, alta energía juvenil).
- **Propuesta B: "Alma Máter"**: Editorial Campus / Warm Prestige (Instrument Serif + Plus Jakarta Sans, bordes estructurados `rounded-xl`, sensación de anuario universitario y elegancia académica).

Ambas propuestas soportan Modo Claro / Oscuro y los 3 modos de conexión:
- 📚 **Modo Estudio** (Azul Cobalto / Sky)
- 🤝 **Modo Amistad** (Ámbar / Naranja)
- ❤️ **Modo Pareja** (Crimson / Magenta)

---

## 🚢 Despliegue en Vercel / Netlify

1. Conecta tu repositorio de GitHub a Vercel o Netlify.
2. Configura el comando de build: `npm run build`
3. Directorio de salida: `dist`
4. Añade las variables de entorno en la configuración del proyecto: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

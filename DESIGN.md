# Design Direction: Neo-Premium Universitario (Dual Mode)

## Color Palette & Semantic Tokens
Debes usar las variantes de Tailwind (`dark:`) de forma estricta para asegurar que el cambio de modo sea fluido y consistente.

### 1. Fondos (Backgrounds)
- MODO DÍA (Por defecto): Bone Canvas (`#F5F4F0` o `bg-[#F5F4F0]`). Un tono hueso/arena cálido que imita el papel de una revista premium. Evita el blanco puro `bg-white`.
- MODO NOCHE: Charcoal Night (`#121212` o `dark:bg-[#121212]`). Un negro profundo editorial, no completamente oscuro, con excelente contraste para pantallas OLED.

### 2. Textos (Typography Colors)
- MODO DÍA: Ink Black (`text-[#1C1C1E]`). Un negro tinta muy legible para títulos y textos principales.
- MODO NOCHE: Chalk White (`dark:text-[#F9F9FB]`). Blanco suave para evitar la fatiga visual en la oscuridad.
- TEXTOS SECUNDARIOS: Muted Slate (`text-gray-500` / `dark:text-gray-400`).

### 3. Color de Acento (Identidad de la App)
- Crimson Academic (`text-[#A30021]` / `bg-[#A30021]`). Un rojo universitario quemado, sofisticado y enérgico, que resalta tanto en fondos claros como oscuros. Úsalo para botones principales, indicadores de match y elementos activos.

## Typography & Hierarchy
- Nombres de usuarios y Títulos grandes: Fuentes Serif marcadas (`font-serif` en Tailwind, idealmente mapeadas a Playfair Display o similar). Aporta elegancia instantánea.
- Descripciones y Botones: Fuentes Sans-serif limpias (`font-sans` como Inter o Geist) para máxima legibilidad móvil.

## Layout & Components
- Bordes y Estructura: Mantener ángulos rectos o micro-redondeados (`rounded-sm` o `rounded-none`). Los bordes afilados se asocian al diseño de autor.
- Espaciado: Uso generoso del espacio en blanco. Cada perfil debe respirar como una página de portafolio independiente.

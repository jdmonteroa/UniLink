# Product Context: Unilink

## Purpose & Core Value
Unilink es una plataforma exclusiva de conexiones y emparejamiento (networking, amistad y citas) diseñada específicamente para la comunidad universitaria. Su objetivo es romper el hielo del campus mediante una experiencia fluida, segura y estéticamente impactante, alejándose de las dinámicas masivas y genéricas de las apps de citas tradicionales.

## Target Audience
- Estudiantes universitarios activos (18-25 años).
- Usuarios que valoran la privacidad, el diseño contemporáneo y buscan interacciones con sustancia dentro de su entorno académico.

## Technical Constraints & Stack
- Framework: React
- Styling: Tailwind CSS con soporte nativo para Modo Oscuro/Claro basado en clases (`class` strategy).
- Enfoque: Mobile-First estructurado, transiciones fluidas de opacidad al cambiar de modo.


## Anti-AI Patterns (Lo que debemos EVITAR)
- Cero gradientes lineales genéricos de morado a rosa/naranja (estilo Tinder predeterminado).
- Cero bordes redondeados excesivos (`rounded-2xl` o `rounded-3xl` en cada contenedor).
- Evitar sombras flotantes masivas (`shadow-2xl`) que hagan ver la app como una plantilla barata.
- Evitar tipografías sans-serif ultra-delgadas y genéricas sin jerarquía.

# Migraciones de Supabase – UniLink

Córrelas en el SQL Editor de Supabase, en orden:

| Archivo | Qué hace |
|---|---|
| 001–006 | Esquema, RLS, triggers, matching y storage originales (equivalen a `../COMPLETE_SETUP.sql`). |
| **007_reparacion_onboarding_fotos_chat.sql** | **Obligatoria.** Repara políticas RLS faltantes, crea perfiles faltantes, protege rol/verificación, bucket `avatars` y sus políticas, nuevo `get_recommendations` (con horarios y preferencias), RPCs del chat (`get_my_matches`, `unmatch`, `block_user`, `mark_conversation_read`, `ensure_my_profile`), moderación de mensajes y Realtime. Es idempotente. |
| **008_preferencia_genero_todos_los_modos.sql** | **Obligatoria para la preferencia "Quiero conocer".** Actualiza `get_recommendations` para que el filtro Mujeres / Hombres / Todos aplique en los tres modos y sea mutuo (solo ves a quien también quiere conocer a alguien como tú). La edad sigue filtrando solo en Modo Pareja. Requiere 007; es idempotente. |

Después corre `../seed.sql`.

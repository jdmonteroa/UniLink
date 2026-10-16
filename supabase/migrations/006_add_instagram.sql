-- ==============================================================================
-- UNILINK - MIGRACIÓN 006: AGREGAR CAMPO DE INSTAGRAM AL PERFIL
-- ==============================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

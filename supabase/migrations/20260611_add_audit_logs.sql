CREATE TABLE public.calendario_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.calendario_profiles(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'CREADO', 'ACTUALIZADO', 'ELIMINADO'
  entity_type text NOT NULL, -- 'BITACORA', 'AVANCE', 'PLANEACION', 'ESTADO', 'CHAT'
  entity_id uuid, -- ID del elemento modificado (si aplica)
  details jsonb, -- Detalles en JSON sobre qué cambió
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Habilitar realtime para que la tabla de auditoría se actualice en vivo si es necesario
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendario_audit_logs;

-- Añadir la columna 'title' a la tabla 'calendario_work_logs'
ALTER TABLE public.calendario_work_logs ADD COLUMN IF NOT EXISTS title text;

-- Eliminar la restricción UNIQUE en (employee_id, date)
-- Nota: La restricción UNIQUE probablemente se llama 'calendario_work_logs_employee_id_date_key' o similar.
ALTER TABLE public.calendario_work_logs DROP CONSTRAINT IF EXISTS calendario_work_logs_employee_id_date_key;

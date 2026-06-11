-- Eliminar tablas existentes para resetear el esquema
DROP TABLE IF EXISTS public.calendario_notifications CASCADE;
DROP TABLE IF EXISTS public.calendario_chat_messages CASCADE;
DROP TABLE IF EXISTS public.calendario_tasks CASCADE;
DROP TABLE IF EXISTS public.calendario_work_evidence CASCADE;
DROP TABLE IF EXISTS public.calendario_work_updates CASCADE;
DROP TABLE IF EXISTS public.calendario_work_logs CASCADE;
DROP TABLE IF EXISTS public.calendario_profiles CASCADE;

-- Eliminar tipos existentes
DROP TYPE IF EXISTS calendario_task_status CASCADE;
DROP TYPE IF EXISTS calendario_task_priority CASCADE;
DROP TYPE IF EXISTS calendario_work_status CASCADE;
DROP TYPE IF EXISTS calendario_user_role CASCADE;

-- Custom Types
CREATE TYPE calendario_user_role AS ENUM ('admin', 'supervisor', 'employee');
CREATE TYPE calendario_work_status AS ENUM ('Trabajando', 'En pausa', 'En traslado', 'En reunión', 'Finalizó actividades');
CREATE TYPE calendario_task_priority AS ENUM ('Baja', 'Media', 'Alta', 'Urgente');
CREATE TYPE calendario_task_status AS ENUM ('Pendiente', 'En proceso', 'Completada', 'Cancelada');

-- 1. PROFILES (AHORA ES LA TABLA PRINCIPAL DE USUARIOS)
CREATE TABLE public.calendario_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role calendario_user_role DEFAULT 'employee'::calendario_user_role NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. WORK LOGS (Bitácoras)
CREATE TABLE public.calendario_work_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.calendario_profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  start_time time,
  end_time time,
  status calendario_work_status DEFAULT 'Trabajando'::calendario_work_status,
  planned_activities text,
  objectives text,
  priority calendario_task_priority,
  comments text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(employee_id, date)
);

-- 3. WORK UPDATES
CREATE TABLE public.calendario_work_updates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_log_id uuid REFERENCES public.calendario_work_logs(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES public.calendario_profiles(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 4. WORK EVIDENCE
CREATE TABLE public.calendario_work_evidence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_log_id uuid REFERENCES public.calendario_work_logs(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES public.calendario_profiles(id) ON DELETE CASCADE NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 5. TASKS
CREATE TABLE public.calendario_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  priority calendario_task_priority DEFAULT 'Media'::calendario_task_priority,
  due_date date,
  assignee_id uuid REFERENCES public.calendario_profiles(id) ON DELETE SET NULL,
  creator_id uuid REFERENCES public.calendario_profiles(id) ON DELETE SET NULL NOT NULL,
  status calendario_task_status DEFAULT 'Pendiente'::calendario_task_status,
  work_log_id uuid REFERENCES public.calendario_work_logs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 6. CHAT MESSAGES
CREATE TABLE public.calendario_chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_log_id uuid REFERENCES public.calendario_work_logs(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.calendario_profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 7. NOTIFICATIONS
CREATE TABLE public.calendario_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.calendario_profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text,
  type text,
  read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- FUNCIÓN PARA ACTUALIZAR UPDATED_AT AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION calendario_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.calendario_profiles FOR EACH ROW EXECUTE PROCEDURE calendario_update_updated_at_column();
CREATE TRIGGER update_work_logs_updated_at BEFORE UPDATE ON public.calendario_work_logs FOR EACH ROW EXECUTE PROCEDURE calendario_update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.calendario_tasks FOR EACH ROW EXECUTE PROCEDURE calendario_update_updated_at_column();

-- Habilitar publicaciones para Realtime en tablas clave
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendario_work_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendario_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendario_work_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendario_notifications;

-- USUARIO ADMINISTRADOR POR DEFECTO
-- Contraseña por defecto: admin123 (hash generado con bcrypt)
INSERT INTO public.calendario_profiles (full_name, email, password_hash, role)
VALUES ('Administrador General', 'admin@admin.com', '$2a$10$tZ8lI9t4/g.p/tF.q1eO/ONZqR6/T/uTf41F.mZtY0R/G5s1uB6C6', 'admin');

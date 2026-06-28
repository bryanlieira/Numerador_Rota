/*
# SaaS Monetization Tables

## Summary
Sets up the database layer for the Leitor Circuit SaaS: user profiles tied to
auth.users, an access-log table, a trigger that auto-creates a profile on
signup, and all required RLS policies.

## 1. New Tables

### public.profiles
Stores per-user subscription state.
- id (uuid, PK, references auth.users)
- email (text, not null)
- subscription_active (boolean, default false)
- expires_at (timestamptz, nullable – null means never expires)
- plano (text, nullable – informational label: 'trial','semanal','mensal','anual','vitalicio')
- created_at (timestamptz)

### public.logs_acesso
Audit trail for every protected-route hit.
- id (uuid, PK)
- user_id (uuid, nullable, references auth.users)
- email (text, nullable)
- rota (text)
- resultado (text: 'permitido' | 'bloqueado_sem_login' | 'bloqueado_sem_assinatura')
- ip (text)
- user_agent (text)
- criado_em (timestamptz)

## 2. Trigger
on_auth_user_created: inserts a row in profiles when a new auth.users row is
created, so every user has a profile immediately after signup.

## 3. Security
- RLS enabled on both tables.
- profiles: authenticated users can SELECT their own row.
- profiles: admin email can SELECT all rows.
- profiles: NO user-facing UPDATE/INSERT – those only happen via webhook/admin.
- profiles: service role bypasses RLS (used by webhook and admin server actions).
- logs_acesso: only admin email can SELECT.
- logs_acesso: INSERT allowed to authenticated role (middleware writes logs).
*/

-- ── profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  subscription_active boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  plano text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario ve seu proprio perfil" ON public.profiles;
CREATE POLICY "usuario ve seu proprio perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin ve todos os perfis" ON public.profiles;
CREATE POLICY "admin ve todos os perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'bryanoliveira.br@gmail.com');

-- ── logs_acesso ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logs_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  email text,
  rota text,
  resultado text,
  ip text,
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.logs_acesso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin le os logs" ON public.logs_acesso;
CREATE POLICY "admin le os logs"
  ON public.logs_acesso FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'bryanoliveira.br@gmail.com');

DROP POLICY IF EXISTS "insert logs authenticated" ON public.logs_acesso;
CREATE POLICY "insert logs authenticated"
  ON public.logs_acesso FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "insert logs anon" ON public.logs_acesso;
CREATE POLICY "insert logs anon"
  ON public.logs_acesso FOR INSERT
  TO anon
  WITH CHECK (true);

-- ── trigger: auto-create profile on signup ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

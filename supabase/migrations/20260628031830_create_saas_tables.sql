/*
# SaaS Monetization Tables

Creates the full schema for Leitor Circuit SaaS:
- profiles: per-user subscription state linked to auth.users
- logs_acesso: audit trail for protected route access attempts
- handle_new_user trigger: auto-creates profile on signup
- All RLS policies with proper ownership checks

## Tables

### public.profiles
- id (uuid PK, references auth.users)
- email (text, not null)
- subscription_active (boolean, default false)
- expires_at (timestamptz, nullable)
- plano (text, nullable – 'trial'|'semanal'|'mensal'|'anual'|'vitalicio')
- created_at (timestamptz)

### public.logs_acesso
- id (uuid PK)
- user_id (uuid, nullable, references auth.users)
- email (text)
- rota (text)
- resultado (text: 'permitido'|'bloqueado_sem_login'|'bloqueado_sem_assinatura')
- ip (text)
- user_agent (text)
- criado_em (timestamptz)

## Security
- RLS enabled on both tables
- profiles: user reads own row; no user INSERT/UPDATE (only webhook/service role)
- logs_acesso: authenticated users insert only their own rows; admin reads all
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

-- Admin policy: uses uid, will be updated once admin signs up
DROP POLICY IF EXISTS "admin ve todos os perfis" ON public.profiles;
CREATE POLICY "admin ve todos os perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'bryanoliveira.br@gmail.com'
    )
  );

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
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'bryanoliveira.br@gmail.com'
    )
  );

DROP POLICY IF EXISTS "insert logs authenticated" ON public.logs_acesso;
CREATE POLICY "insert logs authenticated"
  ON public.logs_acesso FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ── trigger: auto-create profile on signup ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

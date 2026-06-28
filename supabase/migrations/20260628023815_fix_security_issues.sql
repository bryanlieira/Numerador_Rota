/*
# Fix security issues

1. Fix mutable search_path on handle_new_user() by setting search_path = ''
   and qualifying all object references with their schema.
2. Revoke EXECUTE on handle_new_user() from anon and authenticated roles —
   it is a trigger function and must never be callable via RPC.
3. Tighten logs_acesso INSERT policies: anon inserts are removed entirely
   (unauthenticated users should not write logs), and the authenticated INSERT
   policy is restricted so a user can only insert a log row where the user_id
   matches their own auth.uid() (or is null for unauthenticated paths written
   server-side via service role, which bypasses RLS anyway).
*/

-- ── 1. Fix handle_new_user: lock search_path + revoke public EXECUTE ──────────
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

-- Revoke EXECUTE from roles that must never call this directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ── 2. Remove overly-permissive anon INSERT on logs_acesso ────────────────────
-- Unauthenticated users have no business writing audit logs directly.
-- The webhook (service role) and ProtectedRoute (authenticated session) cover
-- every legitimate write path; the anon policy is unnecessary and risky.
DROP POLICY IF EXISTS "insert logs anon" ON public.logs_acesso;

-- ── 3. Tighten authenticated INSERT: user may only log their own user_id ───────
DROP POLICY IF EXISTS "insert logs authenticated" ON public.logs_acesso;
CREATE POLICY "insert logs authenticated"
  ON public.logs_acesso FOR INSERT
  TO authenticated
  WITH CHECK (
    -- either the row's user_id matches the calling user, or user_id is null
    -- (null rows are only inserted by service-role paths which bypass RLS)
    user_id IS NULL OR user_id = auth.uid()
  );

/*
# Fix admin RLS policies to use auth.uid() instead of JWT email claim

Using auth.jwt() ->> 'email' is fragile — the email claim is not always
present in the JWT depending on Supabase project settings. Using auth.uid()
matched against the known admin UUID is more reliable and cannot be spoofed.

Changes:
- Drop email-based admin SELECT policy on profiles, replace with uid-based.
- Drop email-based admin SELECT policy on logs_acesso, replace with uid-based.

Admin UUID: 52cf6fe6-10ff-4d74-97f8-83940813adf9
*/

-- profiles
DROP POLICY IF EXISTS "admin ve todos os perfis" ON public.profiles;
CREATE POLICY "admin ve todos os perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = '52cf6fe6-10ff-4d74-97f8-83940813adf9'::uuid);

-- logs_acesso
DROP POLICY IF EXISTS "admin le os logs" ON public.logs_acesso;
CREATE POLICY "admin le os logs"
  ON public.logs_acesso FOR SELECT
  TO authenticated
  USING (auth.uid() = '52cf6fe6-10ff-4d74-97f8-83940813adf9'::uuid);

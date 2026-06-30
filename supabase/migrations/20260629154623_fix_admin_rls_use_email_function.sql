-- Drop old admin SELECT policy that relied on a subquery (could fail when admin hadn't signed up)
DROP POLICY IF EXISTS "admin ve todos os perfis" ON public.profiles;

-- New policy: admin can read all rows, matched by auth.email() which is reliable and index-friendly
CREATE POLICY "admin_select_all_profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.email() = 'bryanoliveira.br@gmail.com');

-- Also allow admin full UPDATE (needed if direct updates ever bypass edge function)
DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.profiles;
CREATE POLICY "admin_update_all_profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.email() = 'bryanoliveira.br@gmail.com')
  WITH CHECK (auth.email() = 'bryanoliveira.br@gmail.com');

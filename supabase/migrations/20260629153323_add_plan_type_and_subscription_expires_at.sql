-- Add plan_type and subscription_expires_at to profiles
-- Keep existing expires_at for backwards compat but alias subscription_expires_at as the canonical column

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_type text,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Back-fill from existing expires_at / plano where present
UPDATE public.profiles
  SET plan_type = plano,
      subscription_expires_at = expires_at
  WHERE (plano IS NOT NULL OR expires_at IS NOT NULL)
    AND subscription_expires_at IS NULL;

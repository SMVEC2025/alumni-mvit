ALTER TABLE public.alumni_registrations
  ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT true;


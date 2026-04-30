-- Fresh Supabase migration for the SMVEC Alumni website.
-- Run this in the NEW Supabase project's SQL Editor.
-- Safe for a fresh project. For an existing project, review before running.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Custom auth users used by the Edge Function auth-handler.
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_number VARCHAR(10) UNIQUE NOT NULL,
  password_hash TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'alumni' CHECK (role IN ('alumni', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_users_mobile_digits_10 CHECK (mobile_number ~ '^[0-9]{10}$')
);

-- 2) Staff source table. Any mobile number here logs in as staff.
CREATE TABLE IF NOT EXISTS public.faculty_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  mobile_number VARCHAR(10) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_faculty_mobile_digits_10 CHECK (mobile_number ~ '^[0-9]{10}$')
);

-- 3) Custom sessions. The frontend sends x-session-token to satisfy RLS.
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 4) Main alumni profile table.
CREATE TABLE IF NOT EXISTS public.alumni_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT,
  linkedin_url TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone VARCHAR(10),
  show_phone BOOLEAN NOT NULL DEFAULT false,
  degree TEXT,
  department TEXT,
  year_of_completion INTEGER,
  roll_number TEXT,
  company TEXT,
  designation TEXT,
  industry TEXT,
  experience NUMERIC,
  work_experiences JSONB,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  pincode VARCHAR(10),
  profile_image_url TEXT,
  cover_image_url TEXT,
  is_disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_alumni_phone_digits_10 CHECK (phone IS NULL OR phone ~ '^[0-9]{10}$'),
  CONSTRAINT ck_alumni_pincode_digits_6 CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$'),
  CONSTRAINT ck_alumni_email_format CHECK (
    email IS NULL OR email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  CONSTRAINT ck_alumni_year_of_completion CHECK (
    year_of_completion IS NULL OR
    year_of_completion BETWEEN 1950 AND (EXTRACT(YEAR FROM now())::INT + 1)
  ),
  CONSTRAINT ck_alumni_show_phone_requires_phone CHECK (show_phone = false OR phone IS NOT NULL)
);

-- If this is run over an older partial schema, make sure newer columns exist.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.alumni_registrations
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS work_experiences JSONB,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.alumni_registrations
  DROP CONSTRAINT IF EXISTS fk_alumni_user;

ALTER TABLE public.alumni_registrations
  ADD CONSTRAINT fk_alumni_user
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;

-- 5) Indexes and uniqueness.
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_alumni_user_id ON public.alumni_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_alumni_phone ON public.alumni_registrations(phone);
CREATE INDEX IF NOT EXISTS idx_alumni_email ON public.alumni_registrations(email);
CREATE INDEX IF NOT EXISTS idx_alumni_dept_year ON public.alumni_registrations(department, year_of_completion);
CREATE INDEX IF NOT EXISTS idx_alumni_is_disabled ON public.alumni_registrations(is_disabled);
CREATE INDEX IF NOT EXISTS idx_alumni_created_at ON public.alumni_registrations(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_user_id
  ON public.alumni_registrations(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_phone
  ON public.alumni_registrations(phone)
  WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_email_lower
  ON public.alumni_registrations(LOWER(email))
  WHERE email IS NOT NULL;

-- 6) Updated-at helper.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON public.users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_faculty_set_updated_at ON public.faculty_data;
CREATE TRIGGER trg_faculty_set_updated_at
BEFORE UPDATE ON public.faculty_data
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_alumni_set_updated_at ON public.alumni_registrations;
CREATE TRIGGER trg_alumni_set_updated_at
BEFORE UPDATE ON public.alumni_registrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) Password and custom-session helper functions.
CREATE OR REPLACE FUNCTION public.hash_password(raw_password TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(raw_password, gen_salt('bf'));
$$;

CREATE OR REPLACE FUNCTION public.verify_password(raw_password TEXT, hashed_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT hashed_password = crypt(raw_password, hashed_password);
$$;

CREATE OR REPLACE FUNCTION public.current_session_token()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((COALESCE(current_setting('request.headers', true), '{}')::json ->> 'x-session-token'), '');
$$;

CREATE OR REPLACE FUNCTION public.current_user_id_from_session()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id
  FROM public.sessions s
  WHERE s.id = (
    CASE
      WHEN public.current_session_token() ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.current_session_token()::uuid
      ELSE NULL
    END
  )
  AND s.expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role_from_session()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role
  FROM public.sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.id = (
    CASE
      WHEN public.current_session_token() ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.current_session_token()::uuid
      ELSE NULL
    END
  )
  AND s.expires_at > now()
  LIMIT 1;
$$;

-- 8) RLS.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_registrations ENABLE ROW LEVEL SECURITY;

-- Edge Functions use the service-role key and bypass RLS for users/sessions/faculty_data.
-- Faculty registration page inserts faculty rows directly from the anon client.
DROP POLICY IF EXISTS "Public insert faculty data" ON public.faculty_data;
CREATE POLICY "Public insert faculty data"
ON public.faculty_data FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read faculty data" ON public.faculty_data;
CREATE POLICY "Staff read faculty data"
ON public.faculty_data FOR SELECT
USING (public.current_user_role_from_session() = 'staff');

DROP POLICY IF EXISTS "Public read alumni registrations" ON public.alumni_registrations;
CREATE POLICY "Public read alumni registrations"
ON public.alumni_registrations FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public insert alumni registrations" ON public.alumni_registrations;
DROP POLICY IF EXISTS "Session-owned insert alumni registrations" ON public.alumni_registrations;
CREATE POLICY "Session-owned insert alumni registrations"
ON public.alumni_registrations FOR INSERT
WITH CHECK (user_id = public.current_user_id_from_session());

DROP POLICY IF EXISTS "Public update alumni registrations" ON public.alumni_registrations;
DROP POLICY IF EXISTS "Session-owned update alumni registrations" ON public.alumni_registrations;
CREATE POLICY "Session-owned update alumni registrations"
ON public.alumni_registrations FOR UPDATE
USING (user_id = public.current_user_id_from_session())
WITH CHECK (user_id = public.current_user_id_from_session());

DROP POLICY IF EXISTS "Staff update alumni registrations" ON public.alumni_registrations;
CREATE POLICY "Staff update alumni registrations"
ON public.alumni_registrations FOR UPDATE
USING (public.current_user_role_from_session() = 'staff')
WITH CHECK (public.current_user_role_from_session() = 'staff');

-- 9) Optional Supabase Storage bucket.
-- Current frontend uploads through the r2-images Edge Function, but keeping this bucket
-- preserves compatibility if you switch back to Supabase Storage.
INSERT INTO storage.buckets (id, name, public)
VALUES ('alumni-image', 'alumni-image', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public read alumni images" ON storage.objects;
CREATE POLICY "Public read alumni images"
ON storage.objects FOR SELECT
USING (bucket_id = 'alumni-image');

DROP POLICY IF EXISTS "Public write alumni images" ON storage.objects;
DROP POLICY IF EXISTS "Session write own alumni images" ON storage.objects;
CREATE POLICY "Session write own alumni images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'alumni-image'
  AND public.current_user_id_from_session() IS NOT NULL
  AND name LIKE (public.current_user_id_from_session()::text || '/%')
);

DROP POLICY IF EXISTS "Public update alumni images" ON storage.objects;
DROP POLICY IF EXISTS "Session update own alumni images" ON storage.objects;
CREATE POLICY "Session update own alumni images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'alumni-image'
  AND public.current_user_id_from_session() IS NOT NULL
  AND name LIKE (public.current_user_id_from_session()::text || '/%')
)
WITH CHECK (
  bucket_id = 'alumni-image'
  AND public.current_user_id_from_session() IS NOT NULL
  AND name LIKE (public.current_user_id_from_session()::text || '/%')
);

-- 10) Grants. RLS still controls access.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.alumni_registrations TO anon, authenticated;
GRANT INSERT, SELECT ON public.faculty_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_password(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_session_token() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_id_from_session() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role_from_session() TO anon, authenticated;

-- 11) Manual data migration order, if copying from the old project:
-- A. Export/import public.users first.
-- B. Export/import public.faculty_data second.
-- C. Export/import public.alumni_registrations third.
-- D. You can skip public.sessions; users can log in again and create fresh sessions.
-- E. Keep UUID values during import, especially users.id and alumni_registrations.user_id.
-- F. If images are Cloudflare R2 URLs, no SQL import is needed for files; URLs are in profile_image_url/cover_image_url.

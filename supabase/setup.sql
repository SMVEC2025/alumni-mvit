-- Run in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_number VARCHAR(10) UNIQUE NOT NULL,
  password_hash TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'alumni',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  browser TEXT,
  platform TEXT,
  device_name TEXT
);

-- Performance indexes for alumni listing and profile lookups.
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_alumni_user_id ON alumni_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_alumni_phone ON alumni_registrations(phone);
CREATE INDEX IF NOT EXISTS idx_alumni_email ON alumni_registrations(email);
CREATE INDEX IF NOT EXISTS idx_alumni_dept_year ON alumni_registrations(department, year_of_completion);

-- Enforce one row per alumni user and prevent duplicate contact identities.
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_user_id
  ON alumni_registrations(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_phone
  ON alumni_registrations(phone)
  WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_email_lower
  ON alumni_registrations(LOWER(email))
  WHERE email IS NOT NULL;

-- Ensure alumni_registrations.user_id references custom auth table (public.users),
-- not auth.users. This fixes "violates foreign key constraint fk_alumni_user".
ALTER TABLE alumni_registrations
  DROP CONSTRAINT IF EXISTS fk_alumni_user;

ALTER TABLE alumni_registrations
  ADD CONSTRAINT fk_alumni_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE alumni_registrations
  ADD COLUMN IF NOT EXISTS work_experiences JSONB;

ALTER TABLE alumni_registrations
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

ALTER TABLE alumni_registrations
  ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE alumni_registrations
  ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE alumni_registrations
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

ALTER TABLE alumni_registrations
  ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS device_name TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alumni_registrations'
      AND column_name = 'is_enabled'
  ) THEN
    UPDATE public.alumni_registrations
    SET is_disabled = true
    WHERE COALESCE(is_enabled, true) = false;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_alumni_is_enabled;
CREATE INDEX IF NOT EXISTS idx_alumni_is_disabled ON alumni_registrations(is_disabled);

-- Enforce core data quality at DB layer (new writes) without breaking existing rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_alumni_phone_digits_10'
      AND conrelid = 'public.alumni_registrations'::regclass
  ) THEN
    ALTER TABLE public.alumni_registrations
      ADD CONSTRAINT ck_alumni_phone_digits_10
      CHECK (phone IS NULL OR phone ~ '^[0-9]{10}$') NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_alumni_pincode_digits_6'
      AND conrelid = 'public.alumni_registrations'::regclass
  ) THEN
    ALTER TABLE public.alumni_registrations
      ADD CONSTRAINT ck_alumni_pincode_digits_6
      CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$') NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_alumni_email_format'
      AND conrelid = 'public.alumni_registrations'::regclass
  ) THEN
    ALTER TABLE public.alumni_registrations
      ADD CONSTRAINT ck_alumni_email_format
      CHECK (
        email IS NULL OR
        email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_alumni_year_of_completion'
      AND conrelid = 'public.alumni_registrations'::regclass
  ) THEN
    ALTER TABLE public.alumni_registrations
      ADD CONSTRAINT ck_alumni_year_of_completion
      CHECK (
        year_of_completion IS NULL OR
        year_of_completion BETWEEN 1950 AND (EXTRACT(YEAR FROM now())::INT + 1)
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_alumni_show_phone_requires_phone'
      AND conrelid = 'public.alumni_registrations'::regclass
  ) THEN
    ALTER TABLE public.alumni_registrations
      ADD CONSTRAINT ck_alumni_show_phone_requires_phone
      CHECK (show_phone = false OR phone IS NOT NULL) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION hash_password(raw_password TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT crypt(raw_password, gen_salt('bf'));
$$;

CREATE OR REPLACE FUNCTION verify_password(raw_password TEXT, hashed_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT hashed_password = crypt(raw_password, hashed_password);
$$;

CREATE OR REPLACE FUNCTION current_session_token()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((COALESCE(current_setting('request.headers', true), '{}')::json ->> 'x-session-token'), '');
$$;

CREATE OR REPLACE FUNCTION current_user_id_from_session()
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

CREATE OR REPLACE FUNCTION current_user_role_from_session()
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

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- The app uses custom session tokens (not Supabase Auth JWT).
-- RLS write policies below enforce ownership by resolving x-session-token
-- from request headers to sessions.user_id.
ALTER TABLE alumni_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read alumni registrations" ON alumni_registrations;
CREATE POLICY "Public read alumni registrations"
ON alumni_registrations FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public insert alumni registrations" ON alumni_registrations;
DROP POLICY IF EXISTS "Session-owned insert alumni registrations" ON alumni_registrations;
CREATE POLICY "Session-owned insert alumni registrations"
ON alumni_registrations FOR INSERT
WITH CHECK (user_id = public.current_user_id_from_session());

DROP POLICY IF EXISTS "Public update alumni registrations" ON alumni_registrations;
DROP POLICY IF EXISTS "Session-owned update alumni registrations" ON alumni_registrations;
CREATE POLICY "Session-owned update alumni registrations"
ON alumni_registrations FOR UPDATE
USING (user_id = public.current_user_id_from_session())
WITH CHECK (user_id = public.current_user_id_from_session());

DROP POLICY IF EXISTS "Staff update alumni registrations" ON alumni_registrations;
CREATE POLICY "Staff update alumni registrations"
ON alumni_registrations FOR UPDATE
USING (public.current_user_role_from_session() = 'staff')
WITH CHECK (public.current_user_role_from_session() = 'staff');

-- Optional: storage policies if profile uploads fail due RLS
-- Replace if your bucket is named differently.
INSERT INTO storage.buckets (id, name, public)
VALUES ('alumni-image', 'alumni-image', true)
ON CONFLICT (id) DO NOTHING;

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

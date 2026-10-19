-- ============================================================================
-- RUMAH TAHFIDZ MUSLIMAH (RTM) - POSTGRESQL / SUPABASE MIGRATION SCHEMA
-- Deliverable 7 of PRD-RTM-CMS.md
-- ============================================================================

CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'CONTENT_EDITOR', 'ACADEMIC_ADMIN', 'FINANCE_ADMIN');
CREATE TYPE content_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE campaign_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE registration_status AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CORRECTION', 'ACCEPTED', 'REJECTED');
CREATE TYPE transaction_verification_status AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'VOIDED');

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'CONTENT_EDITOR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_name TEXT NOT NULL DEFAULT 'public-media',
  file_path TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT DEFAULT '',
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body_content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Berita',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Tim Media RTM',
  cover_media_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  thumbnail_url TEXT,
  seo_title TEXT,
  seo_description TEXT,
  status content_status NOT NULL DEFAULT 'DRAFT',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gallery_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  event_date DATE,
  status content_status NOT NULL DEFAULT 'PUBLISHED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES public.gallery_albums(id) ON DELETE SET NULL,
  media_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'kegiatan_santri',
  album_name TEXT DEFAULT 'Dokumentasi Utama',
  media_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  status content_status NOT NULL DEFAULT 'PUBLISHED',
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'formal',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  eligibility_criteria TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  schedule_info TEXT NOT NULL DEFAULT '',
  curriculum_syllabus JSONB NOT NULL DEFAULT '[]'::jsonb,
  application_instructions TEXT NOT NULL DEFAULT '',
  form_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  cover_media_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  quota INT DEFAULT 30,
  is_registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  status content_status NOT NULL DEFAULT 'PUBLISHED',
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.program_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT UNIQUE NOT NULL,
  program_id UUID NOT NULL REFERENCES public.academic_programs(id) ON DELETE RESTRICT,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT,
  applicant_phone TEXT NOT NULL,
  birth_date DATE,
  parent_name TEXT,
  custom_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status registration_status NOT NULL DEFAULT 'SUBMITTED',
  admin_notes TEXT,
  correction_request_note TEXT,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.registration_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.program_registrations(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  notes TEXT,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.donation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'wakaf',
  category_name TEXT NOT NULL DEFAULT 'Wakaf',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount >= 0),
  collected_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
  donor_count INT NOT NULL DEFAULT 0,
  end_date DATE,
  status campaign_status NOT NULL DEFAULT 'PUBLISHED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  campaign_id UUID REFERENCES public.donation_campaigns(id) ON DELETE RESTRICT,
  campaign_title TEXT NOT NULL DEFAULT 'Donasi Umum / Infaq Operasional',
  donor_name TEXT NOT NULL,
  donor_phone TEXT,
  donor_email TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  payment_source TEXT NOT NULL DEFAULT 'Transfer Bank BSI',
  reference_number TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proof_image TEXT,
  payment_status transaction_verification_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  notes TEXT,
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  action_type TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB NOT NULL,
  reason TEXT NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'Super Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'System',
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

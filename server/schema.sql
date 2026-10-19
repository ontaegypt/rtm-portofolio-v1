-- ============================================================================
-- RUMAH TAHFIDZ MUSLIMAH / MADANI (RTM) - DATABASE SCHEMA DEFINITION
-- Reference: PRD-RTM-CMS.md (Deliverable 7)
-- ============================================================================

-- 1. USERS & STAFF ACCOUNTS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('superadmin', 'editor', 'finance', 'academic')),
  role_title TEXT NOT NULL,
  avatar TEXT,
  is_active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. SHARED MEDIA LIBRARY
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  file_size INTEGER DEFAULT 0,
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT DEFAULT '',
  album_name TEXT DEFAULT 'Umum',
  uploaded_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 3. ACADEMIC PROGRAMS
CREATE TABLE IF NOT EXISTS academic_programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('formal', 'non_formal')),
  slug TEXT UNIQUE NOT NULL,
  badge TEXT,
  headline TEXT NOT NULL,
  description TEXT,
  eligibility_criteria TEXT DEFAULT '',
  duration_claim TEXT,
  schedule_info TEXT DEFAULT '',
  target_participants TEXT,
  application_instructions TEXT DEFAULT '',
  form_schema TEXT DEFAULT '[]',
  quota INTEGER DEFAULT 30,
  enrolled INTEGER DEFAULT 0,
  investment_fee REAL DEFAULT 0,
  syllabus_pdf_url TEXT,
  is_active INTEGER DEFAULT 1,
  publication_status TEXT DEFAULT 'published' CHECK(publication_status IN ('draft', 'published', 'archived')),
  image TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- CURRICULUM PHASES (1:N with academic_programs)
CREATE TABLE IF NOT EXISTS curriculum_phases (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  phase_number INTEGER NOT NULL,
  phase_title TEXT NOT NULL,
  description TEXT,
  topics TEXT,
  FOREIGN KEY (program_id) REFERENCES academic_programs(id) ON DELETE CASCADE
);

-- PROGRAM BATCHES (1:N with academic_programs)
CREATE TABLE IF NOT EXISTS program_batches (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  batch_name TEXT NOT NULL,
  period TEXT,
  quota TEXT,
  status TEXT DEFAULT 'open',
  dates TEXT,
  is_open INTEGER DEFAULT 1,
  FOREIGN KEY (program_id) REFERENCES academic_programs(id) ON DELETE CASCADE
);

-- 4. PROGRAM REGISTRATIONS (PPDB) & STATUS AUDIT LOGS
CREATE TABLE IF NOT EXISTS ppdb_registrations (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  batch_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_whatsapp TEXT NOT NULL,
  gender TEXT DEFAULT 'Perempuan',
  birth_date TEXT,
  parent_name TEXT,
  info_source TEXT DEFAULT 'Website Resmi',
  motivation TEXT,
  payment_method TEXT DEFAULT 'Transfer Bank BSI',
  custom_answers TEXT DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'submitted', 'under_review', 'verified', 'needs_correction', 'accepted', 'rejected')),
  notes TEXT,
  correction_note TEXT DEFAULT '',
  reviewed_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_status_logs (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  notes TEXT,
  actor_id TEXT,
  actor_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (registration_id) REFERENCES ppdb_registrations(id) ON DELETE CASCADE
);

-- 5. ARTICLES & CMS NEWS
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  author_id TEXT,
  author_name TEXT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT DEFAULT '[]',
  seo_title TEXT DEFAULT '',
  seo_description TEXT DEFAULT '',
  read_time TEXT DEFAULT '4 min baca',
  view_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'archived')),
  published_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 6. GALLERIES & MEDIA
CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  album_name TEXT DEFAULT 'Dokumentasi Utama',
  media_type TEXT DEFAULT 'photo' CHECK(media_type IN ('photo', 'video')),
  media_url TEXT NOT NULL,
  alt_text TEXT DEFAULT '',
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'archived')),
  date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 7. SITE SETTINGS & INSTITUTION IDENTITY
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  draft_value TEXT,
  published_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 8. DONATION CAMPAIGNS
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('wakaf', 'infaq', 'sedekah')),
  category_name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  collected_amount REAL DEFAULT 0,
  donor_count INTEGER DEFAULT 0,
  cover_image TEXT,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'published', 'completed', 'closed', 'archived')),
  is_urgent INTEGER DEFAULT 0,
  end_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 9. FINANCIAL TRANSACTIONS (INDEPENDENT LEDGER) & AUDIT TRAIL
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  campaign_id TEXT,
  campaign_title TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  donor_phone TEXT,
  donor_email TEXT,
  is_anonymous INTEGER DEFAULT 0,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_source TEXT DEFAULT 'Transfer Bank BSI',
  reference_number TEXT DEFAULT '',
  transaction_date TEXT DEFAULT (datetime('now')),
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'success', 'failed', 'expired', 'rejected', 'voided')),
  proof_image TEXT,
  notes TEXT,
  verified_by TEXT,
  verified_at TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS financial_audit_logs (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  action_type TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 10. VISIT RESERVATIONS
CREATE TABLE IF NOT EXISTS visit_reservations (
  id TEXT PRIMARY KEY,
  visitor_name TEXT NOT NULL,
  institution TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  session_time TEXT NOT NULL,
  visitor_count INTEGER DEFAULT 1,
  objective TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 11. LEADS WAITLIST
CREATE TABLE IF NOT EXISTS leads_waitlist (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  contact TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 12. SYSTEM AUDIT LOGS
CREATE TABLE IF NOT EXISTS system_audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

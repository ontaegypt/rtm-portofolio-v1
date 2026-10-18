-- ============================================================================
-- RUMAH TAHFIDZ MADANI (RTM) - DATABASE SCHEMA DEFINITION (SQLITE / POSTGRESQL)
-- Reference: PRD Section 6 (Database Entity Highlights)
-- ============================================================================

-- 1. USERS & STAFF ACCOUNTS (PRD Section 6 Branch 1)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('superadmin', 'editor', 'finance')),
  role_title TEXT NOT NULL,
  avatar TEXT,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. ACADEMIC PROGRAMS (PRD Section 6 Branch 2)
CREATE TABLE IF NOT EXISTS academic_programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('formal', 'non_formal')),
  slug TEXT UNIQUE NOT NULL,
  badge TEXT,
  headline TEXT NOT NULL,
  description TEXT,
  duration_claim TEXT,
  target_participants TEXT,
  quota INTEGER DEFAULT 30,
  enrolled INTEGER DEFAULT 0,
  investment_fee REAL DEFAULT 0,
  syllabus_pdf_url TEXT,
  is_active INTEGER DEFAULT 1,
  image TEXT,
  created_at TEXT DEFAULT (datetime('now'))
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

-- 3. PPDB REGISTRATIONS / LEADS (PRD Section 6 Branch 2)
CREATE TABLE IF NOT EXISTS ppdb_registrations (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  batch_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_whatsapp TEXT NOT NULL,
  gender TEXT DEFAULT 'Laki-laki',
  birth_date TEXT,
  parent_name TEXT,
  info_source TEXT DEFAULT 'Website Resmi',
  motivation TEXT,
  payment_method TEXT DEFAULT 'Transfer Bank BSI',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'accepted', 'rejected')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 4. ARTICLES & CMS NEWS (PRD Section 6 Branch 3)
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
  read_time TEXT DEFAULT '4 min baca',
  view_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published')),
  published_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- 5. GALLERIES & MEDIA (PRD Section 6 Branch 3)
CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('all', 'gedung', 'kegiatan_santri', 'event', 'ekstrakurikuler')),
  media_type TEXT DEFAULT 'photo' CHECK(media_type IN ('photo', 'video')),
  media_url TEXT NOT NULL,
  caption TEXT,
  date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 6. SITE SETTINGS & INSTITUTION IDENTITY (PRD Section 6 Branch 3)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 7. CAMPAIGNS & WAKAF / DONASI (PRD Section 6 Branch 4)
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
  status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'completed', 'closed')),
  is_urgent INTEGER DEFAULT 0,
  end_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 8. DONATIONS TRANSACTIONS (PRD Section 6 Branch 4)
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_title TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  donor_phone TEXT,
  donor_email TEXT,
  is_anonymous INTEGER DEFAULT 0,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'success', 'failed', 'expired')),
  proof_image TEXT,
  notes TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 9. VISIT RESERVATIONS (PRD Section 4.4 & 5.5)
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

-- 10. LEADS WAITLIST (LMS & Donasi Waitlist capture)
CREATE TABLE IF NOT EXISTS leads_waitlist (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  contact TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

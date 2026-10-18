import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  INSTITUTION,
  PROGRAMS,
  GALLERIES,
  NEWS_ARTICLES,
  ADMIN_USERS,
  CAMPAIGNS,
  DONATION_TRANSACTIONS,
  VISIT_RESERVATIONS,
  PPDB_LEADS
} from '../src/data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'rtm.db');
export const db = new DatabaseSync(DB_PATH);

// Helper for Password Hashing
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  // Support migration for plain-text initial passwords
  if (!storedHash.includes(':')) {
    return password === storedHash;
  }
  const [salt, key] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// 1. Initialize Tables
export function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

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
      category TEXT NOT NULL,
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
  `);

  seedInitialData();
}

// 2. Initial Data Seeder (Sprint 3 Auto-seed)
function seedInitialData() {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount > 0) {
    return; // Already seeded
  }

  console.log('🌱 Seeding initial database from data.js...');

  // Seed Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, role_title, avatar, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  ADMIN_USERS.forEach(u => {
    insertUser.run(
      String(u.id),
      String(u.name),
      String(u.email),
      hashPassword(u.password),
      String(u.role),
      String(u.roleTitle),
      String(u.avatar || '')
    );
  });

  // Seed Academic Programs
  const insertProgram = db.prepare(`
    INSERT INTO academic_programs (
      id, name, category, slug, badge, headline, description,
      duration_claim, target_participants, quota, enrolled, investment_fee,
      syllabus_pdf_url, is_active, image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPhase = db.prepare(`
    INSERT INTO curriculum_phases (id, program_id, phase_number, phase_title, description, topics)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.prepare(`
    INSERT INTO program_batches (id, program_id, batch_name, period, quota, status, dates, is_open)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  PROGRAMS.forEach(p => {
    insertProgram.run(
      String(p.id),
      String(p.name || p.shortTitle || p.title || 'Program'),
      String(p.category || 'formal'),
      String(p.id),
      String(p.badge || ''),
      String(p.headline || ''),
      String(p.summary || p.shortDescription || ''),
      String(p.durationClaim || '1 Tahun'),
      String(p.about?.target || 'Umum'),
      Number(p.quota || 30),
      Number(p.enrolled || 18),
      Number(p.investmentFee || 0),
      String(p.syllabusPdf || `/downloads/silabus-${p.id}.pdf`),
      1,
      String(p.image || '')
    );

    if (p.curriculumPhases && Array.isArray(p.curriculumPhases)) {
      p.curriculumPhases.forEach((phase, idx) => {
        insertPhase.run(
          `phase-${p.id}-${idx + 1}`,
          String(p.id),
          Number(phase.phase || idx + 1),
          String(phase.title || `Fase ${idx + 1}`),
          String(phase.desc || ''),
          JSON.stringify(phase.topics || [])
        );
      });
    }

    if (p.batches && Array.isArray(p.batches)) {
      p.batches.forEach((b, idx) => {
        insertBatch.run(
          `batch-${p.id}-${idx + 1}`,
          String(p.id),
          String(b.name || `Gelombang ${idx + 1}`),
          String(b.period || ''),
          String(b.quota || '30 Santri'),
          String(b.status || 'open'),
          String(b.dates || ''),
          b.status === 'open' ? 1 : 0
        );
      });
    }
  });

  // Seed Articles
  const insertArticle = db.prepare(`
    INSERT INTO articles (id, author_id, author_name, title, slug, category, excerpt, content, thumbnail_url, read_time, view_count, status, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  NEWS_ARTICLES.forEach(a => {
    insertArticle.run(
      String(a.id),
      'user-1',
      String(a.author || 'Tim Media RTM'),
      String(a.title),
      String(a.id),
      String(a.category || 'Berita'),
      String(a.excerpt || ''),
      String(a.content || a.excerpt || ''),
      String(a.image || a.thumbnail || '/assets/images/campus.jpg'),
      String(a.readTime || '4 min baca'),
      Number(a.viewCount || Math.floor(Math.random() * 400 + 100)),
      'published',
      String(a.date || '2026-10-10')
    );
  });

  // Seed Galleries
  const insertGallery = db.prepare(`
    INSERT INTO galleries (id, title, category, media_type, media_url, caption, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  GALLERIES.forEach(g => {
    insertGallery.run(
      String(g.id),
      String(g.title),
      String(g.category || 'gedung'),
      'photo',
      String(g.image || ''),
      String(g.caption || g.title),
      '2026-03-15'
    );
  });

  // Seed Campaigns
  const insertCampaign = db.prepare(`
    INSERT INTO campaigns (id, title, slug, type, category_name, target_amount, collected_amount, donor_count, cover_image, description, status, is_urgent, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  CAMPAIGNS.forEach(c => {
    insertCampaign.run(
      String(c.id),
      String(c.title),
      String(c.id),
      String(c.type || 'wakaf'),
      String(c.category || 'Wakaf'),
      Number(c.targetAmount || 100000000),
      Number(c.collectedAmount || 0),
      Number(c.donorCount || 0),
      String(c.image || ''),
      String(c.description || 'Program penggalangan dana umat Rumah Tahfidz Madani.'),
      String(c.status || 'active'),
      c.isUrgent ? 1 : 0,
      String(c.endDate || '2026-12-31')
    );
  });

  // Seed Donations
  const insertDonation = db.prepare(`
    INSERT INTO donations (id, invoice_number, campaign_id, campaign_title, donor_name, donor_phone, donor_email, is_anonymous, amount, payment_method, payment_status, proof_image, notes, paid_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  DONATION_TRANSACTIONS.forEach(d => {
    const isSuccess = (d.paymentStatus || d.status) === 'success';
    insertDonation.run(
      String(d.id),
      String(d.invoiceNumber || d.invoice || 'INV-' + d.id),
      String(d.campaignId || 'camp-1'),
      String(d.campaignTitle || 'Wakaf Pembebasan Lahan'),
      String(d.donorName || 'Hamba Allah'),
      String(d.donorPhone || '081234567890'),
      String(d.donorEmail || 'donatur@gmail.com'),
      d.isAnonymous ? 1 : 0,
      Number(d.amount || 100000),
      String(d.paymentMethod || 'Transfer BSI'),
      String(d.paymentStatus || d.status || 'pending'),
      String(d.receiptUrl || d.proofUrl || ''),
      String(d.notes || 'Infaq & Wakaf Berkah'),
      isSuccess ? String(d.paidAt || '2026-10-14') : null,
      String(d.paidAt ? d.paidAt.slice(0, 11) : '2026-10-15')
    );
  });

  // Seed Visit Reservations
  const insertReservation = db.prepare(`
    INSERT INTO visit_reservations (id, visitor_name, institution, email, phone, visit_date, session_time, visitor_count, objective, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  VISIT_RESERVATIONS.forEach(v => {
    insertReservation.run(
      String(v.id),
      String(v.name),
      String(v.institution || ''),
      String(v.email || ''),
      String(v.phone || ''),
      String(v.date || '2026-10-20'),
      String(v.session || 'Sesi 1 (08.30 - 11.30 WIB)'),
      Number(v.guests || 1),
      String(v.purpose || 'Kunjungan Studi Banding'),
      String(v.status || 'pending'),
      String(v.notes || '')
    );
  });

  // Seed PPDB Leads
  const insertLead = db.prepare(`
    INSERT INTO ppdb_registrations (id, program_id, batch_id, full_name, email, phone_whatsapp, gender, birth_date, parent_name, info_source, motivation, payment_method, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  PPDB_LEADS.forEach(l => {
    insertLead.run(
      String(l.id),
      String(l.programId || 'smp'),
      'batch-smp-1',
      String(l.studentName || l.name || 'Calon Santri'),
      String(l.email || 'santri@gmail.com'),
      String(l.phone || '081234567890'),
      'Laki-laki',
      '2012-05-14',
      String(l.parentName || 'Orang Tua Santri'),
      String(l.source || 'Website Resmi'),
      'Ingin menghafal Al-Qur\'an 30 juz mutqin',
      'Transfer Bank BSI',
      String(l.status || 'pending'),
      String(l.notes || '')
    );
  });

  // Seed Site Settings
  const insertSetting = db.prepare(`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `);

  insertSetting.run('institution_profile', JSON.stringify(INSTITUTION));
  insertSetting.run('site_identity', JSON.stringify({
    title: 'Rumah Tahfidz Madani - Islamic Boarding School Modern',
    tagline: 'Mencetak Generasi Qur\'ani Mutqin 30 Juz & Berakhlak Mulia',
    logoHeader: '/assets/images/logo-header-RTM.png',
    logoFooter: '/assets/images/logo-footer-RTM.png',
    favicon: '/assets/images/logo-header-RTM.png',
    heroBadgeText: 'Penerimaan Santri Baru (PPDB) TA 2026/2027 Dibuka',
    ppdbWaCenter: '6281234567890'
  }));

  console.log('✅ Database initialization and seeding completed successfully!');
}

// Auto init on import
initDatabase();

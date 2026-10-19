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

// Helper: Recalculate Campaign Totals strictly from valid (success) transactions (PRD Req #7)
export function recalculateCampaignTotals(campaignId = null) {
  if (campaignId) {
    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as count
      FROM donations
      WHERE campaign_id = ? AND payment_status = 'success'
    `).get(campaignId);
    db.prepare(`
      UPDATE campaigns
      SET collected_amount = ?, donor_count = ?
      WHERE id = ?
    `).run(Number(stats?.total || 0), Number(stats?.count || 0), campaignId);
    return;
  }

  const allCampaigns = db.prepare('SELECT id FROM campaigns').all();
  for (const c of allCampaigns) {
    recalculateCampaignTotals(c.id);
  }
}

// Helper: System Audit Logger (PRD Req #9)
export function logSystemAudit({
  actorId = 'usr-1',
  actorName = 'Super Admin',
  actorRole = 'superadmin',
  module = 'system',
  action = 'UPDATE',
  entityType = 'record',
  entityId = '-',
  summary = '',
  metadata = {}
}) {
  try {
    const id = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    db.prepare(`
      INSERT INTO system_audit_logs (
        id, actor_id, actor_name, actor_role, module, action, entity_type, entity_id, summary, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      String(actorId || 'usr-1'),
      String(actorName || 'Admin'),
      String(actorRole || 'superadmin'),
      String(module),
      String(action),
      String(entityType),
      String(entityId),
      String(summary),
      JSON.stringify(metadata || {})
    );
  } catch (err) {
    console.warn('[AuditLog] Failed to record system audit:', err.message);
  }
}

// Helper: Immutable Financial Audit Logger (PRD Req #7)
export function logFinancialAudit({
  transactionId,
  invoiceNumber,
  actionType,
  oldValues = null,
  newValues = {},
  reason = '',
  actorId = 'usr-1',
  actorName = 'Super Admin'
}) {
  try {
    const id = `faud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    db.prepare(`
      INSERT INTO financial_audit_logs (
        id, transaction_id, invoice_number, action_type, old_values, new_values, reason, actor_id, actor_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      String(transactionId),
      String(invoiceNumber || transactionId),
      String(actionType),
      oldValues ? JSON.stringify(oldValues) : null,
      JSON.stringify(newValues || {}),
      String(reason || 'Verifikasi transaksi keuangan'),
      String(actorId || 'usr-1'),
      String(actorName || 'Super Admin')
    );
  } catch (err) {
    console.warn('[FinancialAudit] Failed to record financial audit:', err.message);
  }
}

function addColumnIfNotExists(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function upgradeTableCheckConstraints() {
  // Check if articles, ppdb_registrations, campaigns, or donations have legacy restrictive CHECK constraints
  const getSql = (name) => db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name)?.sql || '';

  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const artSql = getSql('articles');
    if (artSql && !artSql.includes("'archived'")) {
      db.exec(`
        CREATE TABLE articles_new (
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
        INSERT INTO articles_new (id, author_id, author_name, title, slug, category, excerpt, content, thumbnail_url, read_time, view_count, status, published_at, created_at)
        SELECT id, author_id, author_name, title, slug, category, excerpt, content, thumbnail_url, read_time, view_count, status, published_at, created_at FROM articles;
        DROP TABLE articles;
        ALTER TABLE articles_new RENAME TO articles;
      `);
    }

    const ppdbSql = getSql('ppdb_registrations');
    if (ppdbSql && !ppdbSql.includes("'needs_correction'")) {
      db.exec(`
        CREATE TABLE ppdb_registrations_new (
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
        INSERT INTO ppdb_registrations_new (id, program_id, batch_id, full_name, email, phone_whatsapp, gender, birth_date, parent_name, info_source, motivation, payment_method, status, notes, created_at)
        SELECT id, program_id, batch_id, full_name, email, phone_whatsapp, gender, birth_date, parent_name, info_source, motivation, payment_method, status, notes, created_at FROM ppdb_registrations;
        DROP TABLE ppdb_registrations;
        ALTER TABLE ppdb_registrations_new RENAME TO ppdb_registrations;
      `);
    }

    const campSql = getSql('campaigns');
    if (campSql && !campSql.includes("'archived'")) {
      db.exec(`
        CREATE TABLE campaigns_new (
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
        INSERT INTO campaigns_new (id, title, slug, type, category_name, target_amount, collected_amount, donor_count, cover_image, description, status, is_urgent, end_date, created_at)
        SELECT id, title, slug, type, category_name, target_amount, collected_amount, donor_count, cover_image, description, status, is_urgent, end_date, created_at FROM campaigns;
        DROP TABLE campaigns;
        ALTER TABLE campaigns_new RENAME TO campaigns;
      `);
    }

    const donSql = getSql('donations');
    if (donSql && !donSql.includes("'voided'")) {
      db.exec(`
        CREATE TABLE donations_new (
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
        INSERT INTO donations_new (id, invoice_number, campaign_id, campaign_title, donor_name, donor_phone, donor_email, is_anonymous, amount, payment_method, payment_status, proof_image, notes, paid_at, created_at)
        SELECT id, invoice_number, campaign_id, campaign_title, donor_name, donor_phone, donor_email, is_anonymous, amount, payment_method, payment_status, proof_image, notes, paid_at, created_at FROM donations;
        DROP TABLE donations;
        ALTER TABLE donations_new RENAME TO donations;
      `);
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

function ensureSchemaUpgrades() {
  upgradeTableCheckConstraints();

  // Users columns
  addColumnIfNotExists('users', 'is_active', 'INTEGER DEFAULT 1');

  // Ensure default seed users exist and are active
  const upsertDefaultUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, role_title, avatar, is_active, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      password_hash = excluded.password_hash,
      role = excluded.role,
      is_active = 1
  `);
  for (const u of ADMIN_USERS) {
    upsertDefaultUser.run(
      String(u.id),
      String(u.name),
      String(u.email),
      hashPassword(u.password),
      String(u.role),
      String(u.roleTitle),
      String(u.avatar || '')
    );
  }

  // Academic Programs columns
  addColumnIfNotExists('academic_programs', 'eligibility_criteria', "TEXT DEFAULT ''");
  addColumnIfNotExists('academic_programs', 'schedule_info', "TEXT DEFAULT ''");
  addColumnIfNotExists('academic_programs', 'application_instructions', "TEXT DEFAULT ''");
  addColumnIfNotExists('academic_programs', 'form_schema', "TEXT DEFAULT '[]'");
  addColumnIfNotExists('academic_programs', 'publication_status', "TEXT DEFAULT 'published'");
  addColumnIfNotExists('academic_programs', 'updated_at', "TEXT DEFAULT ''");

  // PPDB Registrations columns
  addColumnIfNotExists('ppdb_registrations', 'custom_answers', "TEXT DEFAULT '{}'");
  addColumnIfNotExists('ppdb_registrations', 'correction_note', "TEXT DEFAULT ''");
  addColumnIfNotExists('ppdb_registrations', 'reviewed_by', "TEXT DEFAULT ''");
  addColumnIfNotExists('ppdb_registrations', 'updated_at', "TEXT DEFAULT ''");

  // Articles columns
  addColumnIfNotExists('articles', 'tags', "TEXT DEFAULT '[]'");
  addColumnIfNotExists('articles', 'seo_title', "TEXT DEFAULT ''");
  addColumnIfNotExists('articles', 'seo_description', "TEXT DEFAULT ''");
  addColumnIfNotExists('articles', 'updated_at', "TEXT DEFAULT ''");

  // Galleries columns
  addColumnIfNotExists('galleries', 'album_name', "TEXT DEFAULT 'Dokumentasi Utama'");
  addColumnIfNotExists('galleries', 'alt_text', "TEXT DEFAULT ''");
  addColumnIfNotExists('galleries', 'sort_order', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('galleries', 'status', "TEXT DEFAULT 'published'");

  // Campaigns columns
  addColumnIfNotExists('campaigns', 'updated_at', "TEXT DEFAULT ''");

  // Donations columns
  addColumnIfNotExists('donations', 'payment_source', "TEXT DEFAULT 'Transfer Bank BSI'");
  addColumnIfNotExists('donations', 'reference_number', "TEXT DEFAULT ''");
  addColumnIfNotExists('donations', 'transaction_date', "TEXT DEFAULT ''");
  addColumnIfNotExists('donations', 'verified_by', "TEXT DEFAULT ''");
  addColumnIfNotExists('donations', 'verified_at', "TEXT DEFAULT ''");
  addColumnIfNotExists('donations', 'updated_at', "TEXT DEFAULT ''");

  // Site settings columns
  addColumnIfNotExists('site_settings', 'draft_value', 'TEXT');
  addColumnIfNotExists('site_settings', 'published_at', 'TEXT');
  addColumnIfNotExists('site_settings', 'updated_by', 'TEXT');

  // Seed default dynamic form_schema on programs if empty
  const programs = db.prepare('SELECT id, name, category, form_schema, eligibility_criteria, schedule_info, application_instructions FROM academic_programs').all();
  for (const p of programs) {
    const defaultSchema = p.category === 'formal'
      ? [
          { key: 'hafalan_juz', label: 'Jumlah Hafalan Saat Ini (Juz)', type: 'number', required: true, placeholder: 'Contoh: 3' },
          { key: 'asal_sekolah', label: 'Asal Sekolah Sebelumnya', type: 'text', required: true, placeholder: 'Contoh: SDIT Al-Hikmah' },
          { key: 'pilihan_mukim', label: 'Pilihan Asrama / Mukim', type: 'select', required: true, options: ['Mukim Asrama Penuh', 'Beasiswa Tahfidz Mukim'] }
        ]
      : [
          { key: 'level_bacaan', label: 'Kemampuan Membaca Al-Qur\'an Saat Ini', type: 'select', required: true, options: ['Pemula / Iqra', 'Lancar Belum Bertajwid', 'Lancar Bertajwid'] },
          { key: 'jadwal_pilihan', label: 'Preferensi Waktu Belajar', type: 'select', required: true, options: ['Pagi (08.00 - 10.00 WIB)', 'Sore (16.00 - 17.30 WIB)', ' Akhir Pekan (Sabtu/Ahad)'] }
        ];

    const currentSchema = p.form_schema && p.form_schema !== '[]' ? p.form_schema : JSON.stringify(defaultSchema);
    const elig = p.eligibility_criteria || 'Muslim/Muslimah, memiliki semangat menghafal Al-Qur\'an, dan berkomitmen mengikuti tata tertib lembaga.';
    const sched = p.schedule_info || (p.category === 'formal' ? 'Senin - Sabtu (Mukim Asrama Terpadu)' : '3x Pertemuan Sepekan (Reguler / Akhir Pekan)');
    const instr = p.application_instructions || 'Isi formulir pendaftaran online, unggah berkas persyaratan, dan konfirmasi ke nomor WhatsApp Admin PPDB untuk jadwal tes bacaan (talaqqi).';

    db.prepare(`
      UPDATE academic_programs
      SET form_schema = ?, eligibility_criteria = ?, schedule_info = ?, application_instructions = ?
      WHERE id = ?
    `).run(currentSchema, elig, sched, instr, p.id);
  }

  // Seed media_assets from galleries if empty
  const mediaCount = db.prepare('SELECT count(*) as c FROM media_assets').get().c;
  if (mediaCount === 0) {
    const gals = db.prepare('SELECT * FROM galleries').all();
    const insertMedia = db.prepare(`
      INSERT INTO media_assets (id, file_name, file_url, mime_type, file_size, alt_text, caption, album_name, uploaded_by, created_at)
      VALUES (?, ?, ?, 'image/jpeg', 245000, ?, ?, ?, 'usr-1', datetime('now'))
    `);
    gals.forEach((g, idx) => {
      const fileName = (g.media_url || '/assets/images/campus.jpg').split('/').pop() || `media-${idx + 1}.jpg`;
      insertMedia.run(
        `med-${idx + 1}`,
        fileName,
        g.media_url || '/assets/images/campus.jpg',
        g.alt_text || g.title,
        g.caption || g.title,
        g.album_name || g.category || 'Dokumentasi Utama'
      );
    });
  }

  // Seed initial registration status logs if empty
  const regLogCount = db.prepare('SELECT count(*) as c FROM registration_status_logs').get().c;
  if (regLogCount === 0) {
    const regs = db.prepare('SELECT id, status, notes, created_at FROM ppdb_registrations').all();
    const insertRegLog = db.prepare(`
      INSERT INTO registration_status_logs (id, registration_id, previous_status, new_status, notes, actor_id, actor_name, created_at)
      VALUES (?, ?, ?, ?, ?, 'usr-1', 'Admin PPDB', ?)
    `);
    regs.forEach((r, idx) => {
      insertRegLog.run(
        `rlog-init-${idx + 1}`,
        r.id,
        null,
        r.status || 'pending',
        r.notes || 'Pendaftaran diterima melalui formulir publik.',
        r.created_at || new Date().toISOString()
      );
    });
  }

  // Seed initial financial audit logs if empty
  const finLogCount = db.prepare('SELECT count(*) as c FROM financial_audit_logs').get().c;
  if (finLogCount === 0) {
    const dons = db.prepare('SELECT * FROM donations').all();
    const insertFinLog = db.prepare(`
      INSERT INTO financial_audit_logs (id, transaction_id, invoice_number, action_type, old_values, new_values, reason, actor_id, actor_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'usr-3', 'Hj. Rina Kusuma Dewi, S.E.', ?)
    `);
    dons.forEach((d, idx) => {
      if (!d.reference_number) {
        db.prepare('UPDATE donations SET reference_number = ?, payment_source = ?, transaction_date = COALESCE(paid_at, created_at) WHERE id = ?')
          .run(`REF-BSI-202610${10 + idx}`, d.payment_method || 'Transfer Bank BSI', d.id);
      }
      insertFinLog.run(
        `flog-init-${idx + 1}`,
        d.id,
        d.invoice_number,
        d.payment_status === 'success' ? 'VERIFIED' : 'CREATED',
        null,
        JSON.stringify({ amount: d.amount, status: d.payment_status, campaign_id: d.campaign_id }),
        d.payment_status === 'success' ? 'Verifikasi mutasi rekening bank resmi yayasan' : 'Pencatatan awal konfirmasi donasi',
        d.created_at || new Date().toISOString()
      );
    });
  }

  // Seed initial system audit logs if empty
  const sysLogCount = db.prepare('SELECT count(*) as c FROM system_audit_logs').get().c;
  if (sysLogCount === 0) {
    logSystemAudit({
      actorId: 'usr-1',
      actorName: 'KH. Dr. Muhammad Zaki Al-Hafizh',
      actorRole: 'superadmin',
      module: 'settings',
      action: 'PUBLISH',
      entityType: 'site_settings',
      entityId: 'site_identity',
      summary: 'Mempublikasikan konfigurasi identitas lembaga & halaman beranda'
    });
    logSystemAudit({
      actorId: 'usr-3',
      actorName: 'Hj. Rina Kusuma Dewi, S.E.',
      actorRole: 'finance',
      module: 'donasi',
      action: 'VERIFY',
      entityType: 'donation',
      entityId: 'INV-202610-001',
      summary: 'Memverifikasi mutasi donasi INV-202610-001 sebesar Rp 5.000.000'
    });
    logSystemAudit({
      actorId: 'usr-2',
      actorName: 'Ustadz H. Ahmad Syakir, Lc.',
      actorRole: 'editor',
      module: 'berita',
      action: 'PUBLISH',
      entityType: 'article',
      entityId: 'art-1',
      summary: 'Menerbitkan artikel berita Wisuda Tahfidz 30 Juz Mutqin'
    });
  }

  // Enforce PRD Req #7: Recalculate all campaign totals strictly from verified ('success') transactions!
  recalculateCampaignTotals();
}

// 1. Initialize Tables
export function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

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
      publication_status TEXT DEFAULT 'published',
      image TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- CURRICULUM PHASES
    CREATE TABLE IF NOT EXISTS curriculum_phases (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      phase_number INTEGER NOT NULL,
      phase_title TEXT NOT NULL,
      description TEXT,
      topics TEXT,
      FOREIGN KEY (program_id) REFERENCES academic_programs(id) ON DELETE CASCADE
    );

    -- PROGRAM BATCHES
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

    -- 4. PPDB REGISTRATIONS & STATUS LOGS
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
      created_at TEXT DEFAULT (datetime('now'))
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
      status TEXT DEFAULT 'published',
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

    -- 8. CAMPAIGNS & WAKAF / DONASI
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

    -- 9. DONATIONS TRANSACTIONS & AUDIT TRAIL
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
  `);

  seedInitialData();
  ensureSchemaUpgrades();
}

// 2. Initial Data Seeder
function seedInitialData() {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount > 0) {
    return; // Already seeded
  }

  console.log('🌱 Seeding initial database from data.js...');

  // Seed Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, role_title, avatar, is_active, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
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
      syllabus_pdf_url, is_active, publication_status, image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)
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
    INSERT INTO articles (id, author_id, author_name, title, slug, category, excerpt, content, thumbnail_url, tags, seo_title, seo_description, read_time, view_count, status, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  NEWS_ARTICLES.forEach(a => {
    insertArticle.run(
      String(a.id),
      'usr-1',
      String(a.author || 'Tim Media RTM'),
      String(a.title),
      String(a.id),
      String(a.category || 'Berita'),
      String(a.excerpt || ''),
      String(a.content || a.excerpt || ''),
      String(a.image || a.thumbnail || '/assets/images/campus.jpg'),
      JSON.stringify(a.tags || ['Tahfidz', 'RTM']),
      String(a.title),
      String(a.excerpt || ''),
      String(a.readTime || '4 min baca'),
      Number(a.viewCount || 120),
      'published',
      String(a.date || '2026-10-10')
    );
  });

  // Seed Galleries
  const insertGallery = db.prepare(`
    INSERT INTO galleries (id, title, category, album_name, media_type, media_url, alt_text, caption, sort_order, status, date)
    VALUES (?, ?, ?, ?, 'photo', ?, ?, ?, ?, 'published', ?)
  `);

  GALLERIES.forEach((g, idx) => {
    insertGallery.run(
      String(g.id),
      String(g.title),
      String(g.category || 'gedung'),
      String(g.album || 'Dokumentasi Utama'),
      String(g.image || ''),
      String(g.title),
      String(g.caption || g.title),
      idx + 1,
      '2026-03-15'
    );
  });

  // Seed Campaigns (Initial collected_amount = 0, then calculated from verified donations)
  const insertCampaign = db.prepare(`
    INSERT INTO campaigns (id, title, slug, type, category_name, target_amount, collected_amount, donor_count, cover_image, description, status, is_urgent, end_date)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
  `);

  CAMPAIGNS.forEach(c => {
    insertCampaign.run(
      String(c.id),
      String(c.title),
      String(c.slug || c.id),
      String(c.type || 'wakaf'),
      String(c.category || 'Wakaf'),
      Number(c.targetAmount || 100000000),
      String(c.image || ''),
      String(c.description || 'Program penggalangan dana umat Rumah Tahfidz.'),
      String(c.status || 'active'),
      c.isUrgent ? 1 : 0,
      String(c.endDate || c.deadline || '2026-12-31')
    );
  });

  // Seed Donations
  const insertDonation = db.prepare(`
    INSERT INTO donations (id, invoice_number, campaign_id, campaign_title, donor_name, donor_phone, donor_email, is_anonymous, amount, payment_method, payment_source, reference_number, transaction_date, payment_status, proof_image, notes, paid_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  DONATION_TRANSACTIONS.forEach((d, idx) => {
    const isSuccess = (d.paymentStatus || d.status) === 'success';
    insertDonation.run(
      String(d.id),
      String(d.invoiceNumber || d.invoice || 'INV-' + d.id),
      String(d.campaignId || 'cmp-1'),
      String(d.campaignTitle || 'Wakaf Pembebasan Lahan'),
      String(d.donorName || 'Hamba Allah'),
      String(d.donorPhone || '081234567890'),
      String(d.donorEmail || 'donatur@gmail.com'),
      d.isAnonymous ? 1 : 0,
      Number(d.amount || 100000),
      String(d.paymentMethod || 'Transfer BSI'),
      String(d.paymentMethod || 'Transfer BSI'),
      `REF-BSI-2026100${idx + 1}`,
      String(d.paidAt || '2026-10-14'),
      String(d.paymentStatus || d.status || 'pending'),
      String(d.receiptUrl || d.proofUrl || ''),
      String(d.notes || 'Infaq & Wakaf Berkah'),
      isSuccess ? String(d.paidAt || '2026-10-14') : null,
      String(d.paidAt ? d.paidAt.slice(0, 11) : '2026-10-15')
    );
  });

  // Recalculate campaign totals strictly from verified donations
  recalculateCampaignTotals();

  // Seed Visit Reservations
  const insertReservation = db.prepare(`
    INSERT INTO visit_reservations (id, visitor_name, institution, email, phone, visit_date, session_time, visitor_count, objective, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  VISIT_RESERVATIONS.forEach(v => {
    insertReservation.run(
      String(v.id),
      String(v.leaderName || v.name || 'Tamu'),
      String(v.groupName || v.institution || ''),
      String(v.email || ''),
      String(v.phone || ''),
      String(v.date || '2026-10-20'),
      String(v.session || 'Sesi 1 (08.30 - 11.30 WIB)'),
      Number(v.count || v.guests || 1),
      String(v.goal || v.purpose || 'Kunjungan Studi Banding'),
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
      'Gelombang 1 - TA 2026/2027',
      String(l.studentName || l.name || 'Calon Santri'),
      String(l.email || 'santri@gmail.com'),
      String(l.phone || '081234567890'),
      'Perempuan',
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
    INSERT INTO site_settings (key, value, draft_value, published_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `);

  const instJson = JSON.stringify(INSTITUTION);
  insertSetting.run('institution_profile', instJson, instJson);

  const identityObj = {
    title: 'Rumah Tahfidz Muslimah - Pesantren Tahfidz Al-Qur\'an Modern',
    shortTitle: 'Rumah Tahfidz Muslimah',
    tagline: 'Mencetak Generasi Muslimah Qur\'ani Mutqin 30 Juz & Berakhlak Mulia',
    mudir: INSTITUTION.mudir || 'KH. Dr. Muhammad Zaki Al-Hafizh, M.A.',
    logoHeader: '/assets/images/logo-header-RTM.png',
    logoFooter: '/assets/images/logo-footer-RTM.png',
    favicon: '/assets/images/logo-header-RTM.png',
    heroBadgeText: 'Penerimaan Santri Baru (PPDB) TA 2026/2027 Dibuka',
    heroHeadline: 'Membangun Peradaban Bersama Para Penghafal Al-Qur\'an',
    heroSubheadline: 'Program pendidikan tahfidz Al-Qur\'an bersanad dengan pembinaan adab islami dan kurikulum terpadu.',
    vision: 'Menjadi lembaga pendidikan tahfidz Al-Qur\'an rujukan nasional yang melahirkan generasi mutqin 30 juz, beradab mulia, dan bermanfaat bagi umat.',
    mission: '1. Menyelenggarakan pembelajaran tahsin dan tahfidz bersanad.\n2. Membina akhlak dan adab keseharian santri sesuai sunnah.\n3. Mengintegrasikan kurikulum keislaman dan kecakapan hidup.',
    aboutSummary: 'Rumah Tahfidz berkomitmen membimbing santri dan masyarakat luas dalam membaca, menghafal, dan mengamalkan Al-Qur\'an dengan bimbingan asatidz dan ustadzah bersanad.',
    footerCopyright: '© 2026 Rumah Tahfidz. Hak Cipta Dilindungi.',
    socialInstagram: 'https://instagram.com/rumahtahfidz',
    socialYoutube: 'https://youtube.com/@rumahtahfidz',
    socialFacebook: 'https://facebook.com/rumahtahfidz',
    socialTiktok: 'https://tiktok.com/@rumahtahfidz',
    ppdbWaCenter: '6281234567890'
  };
  const idJson = JSON.stringify(identityObj);
  insertSetting.run('site_identity', idJson, idJson);

  console.log('✅ Database initialization and seeding completed successfully!');
}

// Auto init on import
initDatabase();

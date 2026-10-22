import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  db,
  hashPassword,
  verifyPassword,
  recalculateCampaignTotals,
  logSystemAudit,
  logFinancialAudit
} from './db.js';
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseHealth,
  getSupabasePrograms,
  getSupabaseProgramByIdOrSlug,
  getSupabaseArticles,
  getSupabaseArticleByIdOrSlug,
  getSupabaseCampaigns,
  getSupabaseCampaignByIdOrSlug,
  getSupabaseSiteSettings,
  createSupabaseRegistration,
  createSupabaseDonation,
  getSupabaseUsers,
  getSupabaseUserById,
  getSupabaseUserByEmail,
  createSupabaseUser,
  updateSupabaseUser,
  toggleSupabaseUserStatus,
  deleteSupabaseUser,
  verifySupabaseLogin,
  updateSupabaseProgram,
  toggleSupabaseProgramStatus,
  createSupabaseProgram,
  deleteSupabaseProgram,
  updateSupabaseArticle,
  toggleSupabaseArticleStatus,
  createSupabaseArticle,
  deleteSupabaseArticle,
  updateSupabaseCampaign,
  createSupabaseCampaign,
  deleteSupabaseCampaign,
  updateSupabaseSiteSettings,
  updateSupabaseRegistrationStatus,
  deleteSupabaseRegistration,
  updateSupabaseDonationStatus,
  correctSupabaseDonation
} from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const api = express.Router();
api.use((req, res, next) => {
  if (req.body !== undefined) return next();
  express.json({ limit: '50mb' })(req, res, (err) => {
    if (err) return next(err);
    if (req.body !== undefined) return next();
    express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
  });
});

// In-memory brute force tracker (PRD 5.1 A)
const failedAttemptsMap = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;

// Helper: UUID generator
function uuid() {
  return crypto.randomUUID();
}

// Helper: Date filter SQL builder
function buildDateRangeFilter(columnName, range, from, to) {
  if (from && to) {
    return { clause: ` AND date(${columnName}) >= date(?) AND date(${columnName}) <= date(?)`, params: [from, to] };
  }
  if (!range || range === 'all') {
    return { clause: '', params: [] };
  }
  if (range === 'today') {
    return { clause: ` AND date(${columnName}) = date('now')`, params: [] };
  }
  if (range === '7d') {
    return { clause: ` AND date(${columnName}) >= date('now', '-7 days')`, params: [] };
  }
  if (range === '30d') {
    return { clause: ` AND date(${columnName}) >= date('now', '-30 days')`, params: [] };
  }
  if (range === 'month') {
    return { clause: ` AND strftime('%Y-%m', ${columnName}) = strftime('%Y-%m', 'now')`, params: [] };
  }
  return { clause: '', params: [] };
}

// ============================================================================
// 1. HEALTH & ANALYTICS OVERVIEW (PRD Req #2 - Zero Fabricated Metrics)
// ============================================================================
api.get('/health', async (req, res) => {
  try {
    let supabaseStatus = { connected: false };
    if (isSupabaseConfigured) {
      try {
        supabaseStatus = await getSupabaseHealth();
      } catch (err) {
        supabaseStatus = { connected: false, error: err.message };
      }
    }

    let sqliteCounts = null;
    try {
      sqliteCounts = {
        users: db.prepare('SELECT count(*) as c FROM users').get().c,
        programs: db.prepare('SELECT count(*) as c FROM academic_programs').get().c,
        articles: db.prepare('SELECT count(*) as c FROM articles').get().c,
        donations: db.prepare('SELECT count(*) as c FROM donations').get().c,
        campaigns: db.prepare('SELECT count(*) as c FROM campaigns').get().c,
      };
    } catch {
      // ignore
    }

    res.json({
      status: 'ok',
      engine: supabaseStatus.connected ? 'Supabase PostgreSQL Cloud (@supabase/supabase-js)' : 'SQLite (Local Fallback)',
      database: supabaseStatus.connected ? 'https://bnaaxskyzwjeaduasgru.supabase.co' : 'data/rtm.db',
      supabase: supabaseStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      counts: supabaseStatus.connected ? supabaseStatus.counts : sqliteCounts
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

api.get('/stats', (req, res) => {
  try {
    const { range = 'all', from, to } = req.query;
    const ppdbDateFilter = buildDateRangeFilter('created_at', range, from, to);
    const donDateFilter = buildDateRangeFilter('created_at', range, from, to);

    recalculateCampaignTotals();

    const totalLeads = db.prepare(`SELECT count(*) as c FROM ppdb_registrations WHERE 1=1 ${ppdbDateFilter.clause}`).get(...ppdbDateFilter.params).c;
    const verifiedLeads = db.prepare(`SELECT count(*) as c FROM ppdb_registrations WHERE status IN ('verified', 'accepted') ${ppdbDateFilter.clause}`).get(...ppdbDateFilter.params).c;
    const acceptedLeads = db.prepare(`SELECT count(*) as c FROM ppdb_registrations WHERE status = 'accepted' ${ppdbDateFilter.clause}`).get(...ppdbDateFilter.params).c;
    const pendingLeads = db.prepare(`SELECT count(*) as c FROM ppdb_registrations WHERE status IN ('pending', 'submitted', 'under_review') ${ppdbDateFilter.clause}`).get(...ppdbDateFilter.params).c;
    const needsCorrectionLeads = db.prepare(`SELECT count(*) as c FROM ppdb_registrations WHERE status = 'needs_correction' ${ppdbDateFilter.clause}`).get(...ppdbDateFilter.params).c;

    const donationStats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END), 0) as totalCollected,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END), 0) as pendingAmount,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pendingCount,
        COUNT(CASE WHEN payment_status = 'success' THEN 1 END) as successCount,
        COUNT(*) as totalTransactions
      FROM donations
      WHERE 1=1 ${donDateFilter.clause}
    `).get(...donDateFilter.params);

    const activePrograms = db.prepare("SELECT count(*) as c FROM academic_programs WHERE is_active = 1 AND COALESCE(publication_status, 'published') = 'published'").get().c;
    const totalPrograms = db.prepare('SELECT count(*) as c FROM academic_programs').get().c;

    const totalArticles = db.prepare("SELECT count(*) as c FROM articles WHERE status = 'published'").get().c;
    const draftArticles = db.prepare("SELECT count(*) as c FROM articles WHERE status = 'draft'").get().c;
    const archivedArticles = db.prepare("SELECT count(*) as c FROM articles WHERE status = 'archived'").get().c;

    const activeCampaigns = db.prepare("SELECT count(*) as c FROM campaigns WHERE status IN ('active', 'published')").get().c;
    const closedCampaigns = db.prepare("SELECT count(*) as c FROM campaigns WHERE status IN ('completed', 'closed', 'archived')").get().c;

    const pendingVisits = db.prepare("SELECT count(*) as c FROM visit_reservations WHERE status = 'pending'").get().c;
    const totalUsers = db.prepare('SELECT count(*) as c FROM users').get().c;
    const activeUsers = db.prepare('SELECT count(*) as c FROM users WHERE COALESCE(is_active, 1) = 1').get().c;

    const recentDonations = db.prepare(`
      SELECT id, invoice_number, donor_name, amount, payment_method, payment_source, reference_number, payment_status, created_at, campaign_title
      FROM donations ORDER BY created_at DESC LIMIT 5
    `).all();

    const recentLeads = db.prepare(`
      SELECT id, full_name, phone_whatsapp, program_id, status, created_at
      FROM ppdb_registrations ORDER BY created_at DESC LIMIT 5
    `).all();

    const recentAuditLogs = db.prepare(`
      SELECT id, actor_name, actor_role, module, action, entity_type, entity_id, summary, created_at
      FROM system_audit_logs ORDER BY created_at DESC LIMIT 8
    `).all();

    res.json({
      success: true,
      data: {
        range,
        totalLeads,
        verifiedLeads,
        acceptedLeads,
        pendingLeads,
        needsCorrectionLeads,
        totalDonations: donationStats.totalCollected,
        pendingDonationsAmount: donationStats.pendingAmount,
        pendingDonationsCount: donationStats.pendingCount,
        successDonationsCount: donationStats.successCount,
        totalTransactions: donationStats.totalTransactions,
        activePrograms,
        totalPrograms,
        activeCampaigns,
        closedCampaigns,
        totalArticles,
        draftArticles,
        archivedArticles,
        pendingVisits,
        totalUsers,
        activeUsers,
        recentDonations,
        recentLeads,
        recentAuditLogs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.get('/audit-logs', (req, res) => {
  try {
    const { module, limit = 30 } = req.query;
    let query = 'SELECT * FROM system_audit_logs WHERE 1=1';
    const params = [];
    if (module && module !== 'all') {
      query += ' AND module = ?';
      params.push(module);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit) || 30);
    const logs = db.prepare(query).all(...params);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 2. AUTHENTICATION & SESSION (PRD Req #1)
// ============================================================================
api.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan kata sandi wajib diisi.' });
  }

  const attemptInfo = failedAttemptsMap.get(ip);
  if (attemptInfo && attemptInfo.lockoutUntil && Date.now() < attemptInfo.lockoutUntil) {
    const remainingSeconds = Math.ceil((attemptInfo.lockoutUntil - Date.now()) / 1000);
    return res.status(429).json({
      success: false,
      isLocked: true,
      remainingSeconds,
      message: `Terlalu banyak percobaan gagal. Akses terkunci sementara selama ${remainingSeconds} detik.`
    });
  }

  let user = null;

  // 1. Authenticate with Supabase Cloud first
  if (isSupabaseConfigured) {
    try {
      const supaUser = await verifySupabaseLogin(email, password);
      if (supaUser) {
        user = supaUser;
      }
    } catch (e) {
      console.warn('[Login Supabase error]:', e.message);
    }
  }

  // 2. Fallback to local SQLite if not authenticated via Supabase
  if (!user) {
    try {
      const sqliteUser = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
      if (sqliteUser && verifyPassword(password, sqliteUser.password_hash)) {
        user = sqliteUser;
      }
    } catch {
      // ignore read-only sqlite
    }
  }

  if (!user) {
    const current = failedAttemptsMap.get(ip) || { count: 0, lockoutUntil: 0 };
    current.count++;
    if (current.count >= MAX_ATTEMPTS) {
      current.lockoutUntil = Date.now() + LOCKOUT_MS;
      failedAttemptsMap.set(ip, current);
      return res.status(429).json({
        success: false,
        isLocked: true,
        remainingSeconds: 60,
        message: 'Batas 5 kali percobaan gagal tercapai. Sistem dibatasi 60 detik demi keamanan.'
      });
    }
    failedAttemptsMap.set(ip, current);
    return res.status(401).json({
      success: false,
      message: `Email atau kata sandi tidak valid. Percobaan gagal: ${current.count}/${MAX_ATTEMPTS}.`
    });
  }

  if (user.is_active === 0 || user.is_active === false) {
    return res.status(403).json({
      success: false,
      message: 'Akun Anda sedang dinonaktifkan oleh Super Admin. Hubungi administrator untuk mengaktifkan kembali.'
    });
  }

  failedAttemptsMap.delete(ip);
  try {
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  } catch {
    // ignore read-only SQLite on serverless
  }

  const token = Buffer.from(`${user.id}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`).toString('base64');

  logSystemAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    module: 'auth',
    action: 'LOGIN',
    entityType: 'user',
    entityId: user.id,
    summary: `Pengguna ${user.name} (${user.email}) berhasil login ke sistem.`
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleTitle: user.role_title || user.role,
      avatar: user.avatar,
      is_active: user.is_active
    },
    message: `Ahlan wa Sahlan, ${user.name}!`
  });
});

api.get('/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Tidak terotentikasi.' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');
    const user = db.prepare('SELECT id, name, email, role, role_title, avatar, is_active, last_login_at FROM users WHERE id = ?').get(userId);
    if (!user || user.is_active === 0) {
      return res.status(401).json({ success: false, message: 'Sesi tidak ditemukan, kedaluwarsa, atau akun telah dinonaktifkan.' });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleTitle: user.role_title,
        avatar: user.avatar,
        isActive: user.is_active !== 0,
        lastLoginAt: user.last_login_at
      }
    });
  } catch {
    res.status(401).json({ success: false, message: 'Format token tidak valid.' });
  }
});

// ============================================================================
// SERVER-SIDE ROLE AUTHORIZATION HELPERS (Otorisasi Dipatenkan)
// ============================================================================
export function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');
    const user = db.prepare('SELECT id, name, email, role, role_title, avatar, is_active FROM users WHERE id = ?').get(userId);
    if (!user || user.is_active === 0) return null;
    return user;
  } catch {
    return null;
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Otorisasi diperlukan: Token otentikasi tidak ditemukan. Silakan login kembali.'
      });
    }

    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Sesi otentikasi tidak valid, kedaluwarsa, atau akun telah dinonaktifkan.'
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses Ditolak (403 Forbidden): Peran "${user.role_title || user.role}" tidak berwenang untuk tindakan ini. Otorisasi akun dipatenkan.`
      });
    }

    req.user = user;
    next();
  };
}

export function verifyRoleIfAuthenticated(...allowedRoles) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    const user = getAuthenticatedUser(req);
    if (user && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses Ditolak (403 Forbidden): Peran "${user.role_title || user.role}" tidak berwenang untuk operasi ini. Otorisasi akun dipatenkan.`
      });
    }

    req.user = user;
    next();
  };
}

// ============================================================================
// PROFILE SELF-SERVICE ENDPOINTS (Memperbarui Data Profil Akun Sendiri)
// ============================================================================
const handleProfileUpdate = async (req, res) => {
  try {
    let user = getAuthenticatedUser(req);
    // Fallback if token not passed in headers (e.g. from body id/userId/email)
    if (!user && (req.body.id || req.body.userId || req.body.email)) {
      const searchKey = req.body.id || req.body.userId;
      if (searchKey) {
        try {
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(searchKey);
        } catch {
          // fallback
        }
        if (!user && isSupabaseConfigured) {
          user = await getSupabaseUserById(searchKey);
        }
      } else if (req.body.email) {
        try {
          user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(req.body.email);
        } catch {
          // fallback
        }
        if (!user && isSupabaseConfigured) {
          user = await getSupabaseUserByEmail(req.body.email);
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Otorisasi diperlukan. Silakan login kembali untuk memperbarui profil.'
      });
    }

    if (user.is_active === 0 || user.is_active === false) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda dinonaktifkan oleh administrator.'
      });
    }

    const { name, email, avatar, password, new_password, newPassword } = req.body;
    const finalPassword = password || new_password || newPassword;

    const updates = [];
    const params = [];

    if (name && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      try {
        const conflict = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').get(cleanEmail, user.id);
        if (conflict) {
          return res.status(400).json({
            success: false,
            message: `Email ${cleanEmail} sudah digunakan oleh akun lain.`
          });
        }
      } catch {
        // SQLite read issue ignored in cloud
      }
      updates.push('email = ?');
      params.push(cleanEmail);
    }

    if (avatar && avatar.trim()) {
      updates.push('avatar = ?');
      params.push(avatar.trim());
    }

    if (finalPassword && typeof finalPassword === 'string' && finalPassword.trim().length > 0) {
      if (finalPassword.trim().length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Kata sandi baru minimal 6 karakter.'
        });
      }
      updates.push('password_hash = ?');
      params.push(hashPassword(finalPassword.trim()));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada perubahan data profil yang dikirim.'
      });
    }

    // 1. Persist directly to Supabase Cloud
    let supaUpdated = null;
    if (isSupabaseConfigured) {
      try {
        supaUpdated = await updateSupabaseUser(user.id, {
          name: name ? name.trim() : undefined,
          email: email ? email.trim().toLowerCase() : undefined,
          avatar: avatar ? avatar.trim() : undefined,
          password: finalPassword ? finalPassword.trim() : undefined
        });
      } catch (err) {
        console.warn('[Profile Update] Supabase warning:', err.message);
      }
    }

    // 2. Safe local SQLite write (wrapped for Vercel read-only FS)
    updates.push("updated_at = datetime('now')");
    params.push(user.id);
    try {
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    } catch (sqliteErr) {
      console.warn('[Profile Update] SQLite read-only skipped:', sqliteErr.message);
    }

    let updatedUser = null;
    try {
      updatedUser = db.prepare('SELECT id, name, email, role, role_title, avatar, is_active, last_login_at FROM users WHERE id = ?').get(user.id);
    } catch {
      // ignore
    }

    const finalResult = updatedUser || supaUpdated || {
      id: user.id,
      name: name || user.name,
      email: email || user.email,
      role: user.role,
      role_title: user.role_title || user.roleTitle,
      avatar: avatar || user.avatar,
      is_active: 1,
      last_login_at: user.last_login_at
    };

    logSystemAudit({
      actorId: user.id,
      actorName: finalResult.name,
      actorRole: user.role,
      module: 'profile',
      action: 'UPDATE_PROFILE',
      entityType: 'user',
      entityId: user.id,
      summary: `${finalResult.name} memperbarui data profil akun pribadinya`
    });

    res.json({
      success: true,
      message: 'Profil berhasil diperbarui di Supabase Cloud.',
      user: {
        id: finalResult.id,
        name: finalResult.name,
        email: finalResult.email,
        role: finalResult.role,
        roleTitle: finalResult.role_title || finalResult.roleTitle,
        avatar: finalResult.avatar,
        isActive: finalResult.is_active !== 0 && finalResult.is_active !== false,
        lastLoginAt: finalResult.last_login_at || finalResult.lastLoginAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

api.patch('/auth/profile', handleProfileUpdate);
api.put('/auth/profile', handleProfileUpdate);
api.patch('/profile', handleProfileUpdate);
api.put('/profile', handleProfileUpdate);
api.get('/auth/profile', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Tidak terotentikasi.' });
  res.json({ success: true, user });
});
api.get('/profile', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Tidak terotentikasi.' });
  res.json({ success: true, user });
});

// ============================================================================
// 3. ACADEMIC PROGRAMS & DYNAMIC REGISTRATION FORM SCHEMA (PRD Req #5)
// ============================================================================
api.get('/programs', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try {
        const supaPrograms = await getSupabasePrograms(req.query.category);
        if (supaPrograms && supaPrograms.length > 0) {
          const enriched = supaPrograms.map(p => ({
            ...p,
            name: p.title,
            title: p.title,
            headline: p.summary || p.description,
            shortDescription: p.summary,
            durationClaim: p.duration,
            publicationStatus: (p.status || 'PUBLISHED').toLowerCase(),
            eligibilityCriteria: p.eligibility_criteria || '',
            scheduleInfo: p.schedule_info || '',
            applicationInstructions: p.application_instructions || '',
            formSchema: Array.isArray(p.form_schema) ? p.form_schema : [],
            curriculumPhases: Array.isArray(p.curriculum_syllabus) ? p.curriculum_syllabus : [],
            batches: []
          }));
          return res.json({ success: true, data: enriched, source: 'supabase_cloud' });
        }
      } catch (err) {
        console.warn('[API /programs] Supabase error, falling back to SQLite:', err.message);
      }
    }

    const programs = db.prepare('SELECT * FROM academic_programs ORDER BY category ASC, id ASC').all();
    const phases = db.prepare('SELECT * FROM curriculum_phases ORDER BY phase_number ASC').all();
    const batches = db.prepare('SELECT * FROM program_batches ORDER BY id ASC').all();

    const enriched = programs.map(p => {
      const progPhases = phases.filter(ph => ph.program_id === p.id).map(ph => ({
        phase: ph.phase_number,
        title: ph.phase_title,
        desc: ph.description,
        topics: ph.topics ? JSON.parse(ph.topics) : []
      }));

      const progBatches = batches.filter(b => b.program_id === p.id).map(b => ({
        name: b.batch_name,
        period: b.period,
        quota: b.quota,
        dates: b.dates,
        status: b.status,
        isOpen: b.is_open === 1
      }));

      let formSchema = [];
      try {
        formSchema = p.form_schema ? JSON.parse(p.form_schema) : [];
      } catch {
        formSchema = [];
      }

      return {
        ...p,
        title: p.name,
        publicationStatus: p.publication_status || 'published',
        eligibilityCriteria: p.eligibility_criteria || '',
        scheduleInfo: p.schedule_info || '',
        applicationInstructions: p.application_instructions || '',
        formSchema,
        curriculumPhases: progPhases,
        batches: progBatches
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.get('/programs/:id', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try {
        const program = await getSupabaseProgramByIdOrSlug(req.params.id);
        if (program) {
          return res.json({
            success: true,
            data: {
              ...program,
              name: program.title,
              title: program.title,
              headline: program.summary || program.description,
              shortDescription: program.summary,
              durationClaim: program.duration,
              publicationStatus: (program.status || 'PUBLISHED').toLowerCase(),
              eligibilityCriteria: program.eligibility_criteria || '',
              scheduleInfo: program.schedule_info || '',
              applicationInstructions: program.application_instructions || '',
              formSchema: Array.isArray(program.form_schema) ? program.form_schema : [],
              curriculumPhases: Array.isArray(program.curriculum_syllabus) ? program.curriculum_syllabus : [],
              batches: []
            },
            source: 'supabase_cloud'
          });
        }
      } catch (err) {
        console.warn('[API /programs/:id] Supabase error, falling back to SQLite:', err.message);
      }
    }

    const program = db.prepare('SELECT * FROM academic_programs WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program akademik tidak ditemukan.' });
    }

    const phases = db.prepare('SELECT * FROM curriculum_phases WHERE program_id = ? ORDER BY phase_number ASC').all(program.id);
    const batches = db.prepare('SELECT * FROM program_batches WHERE program_id = ?').all(program.id);

    let formSchema = [];
    try {
      formSchema = program.form_schema ? JSON.parse(program.form_schema) : [];
    } catch {
      formSchema = [];
    }

    res.json({
      success: true,
      data: {
        ...program,
        title: program.name,
        publicationStatus: program.publication_status || 'published',
        eligibilityCriteria: program.eligibility_criteria || '',
        scheduleInfo: program.schedule_info || '',
        applicationInstructions: program.application_instructions || '',
        formSchema,
        curriculumPhases: phases.map(ph => ({
          phase: ph.phase_number,
          title: ph.phase_title,
          desc: ph.description,
          topics: ph.topics ? JSON.parse(ph.topics) : []
        })),
        batches: batches.map(b => ({
          name: b.batch_name,
          period: b.period,
          quota: b.quota,
          dates: b.dates,
          status: b.status,
          isOpen: b.is_open === 1
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/programs', verifyRoleIfAuthenticated('superadmin', 'editor'), async (req, res) => {
  try {
    const rawId = req.body.id || req.body.rawId;
    const name = req.body.name || req.body.title;
    const category = req.body.category === 'formal' ? 'formal' : (req.body.category || 'non_formal');
    const rawSlug = req.body.slug || rawId;
    const badge = req.body.badge || (category === 'formal' ? 'Program Formal' : 'Program Unggulan');
    const headline = req.body.headline || req.body.subtitle || req.body.description || name || '';
    const description = req.body.description || req.body.subtitle || headline || '';
    const eligibility_criteria = req.body.eligibility_criteria || '';
    const duration_claim = req.body.duration_claim || req.body.duration || '3 Tahun';
    const schedule_info = req.body.schedule_info || '';
    const target_participants = req.body.target_participants || 'Muslimah / Umum';
    const application_instructions = req.body.application_instructions || '';
    const form_schema = req.body.form_schema || [];
    const quota = req.body.quota || 30;
    const investment_fee = req.body.investment_fee || 0;
    const syllabus_pdf_url = req.body.syllabus_pdf_url || '';
    const is_active = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : 1;
    const publication_status = req.body.publication_status || 'published';
    const image = req.body.image || req.body.hero_image || '/assets/images/classroom.jpg';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama program wajib diisi.' });
    }

    let existing = null;
    if (rawId || rawSlug) {
      try {
        existing = db.prepare('SELECT id FROM academic_programs WHERE id = ? OR slug = ?').get(rawId || rawSlug, rawId || rawSlug);
      } catch {
        // ignore
      }
    }

    if (existing) {
      if (isSupabaseConfigured) {
        try {
          await updateSupabaseProgram(existing.id, req.body);
        } catch (supaErr) {
          console.warn('[POST /programs] Supabase update warning:', supaErr.message);
        }
      }

      try {
        const formSchemaStr = typeof form_schema === 'string' ? form_schema : JSON.stringify(form_schema || []);
        db.prepare(`
          UPDATE academic_programs SET
            name = COALESCE(?, name),
            category = COALESCE(?, category),
            badge = COALESCE(?, badge),
            headline = COALESCE(?, headline),
            description = COALESCE(?, description),
            eligibility_criteria = COALESCE(?, eligibility_criteria),
            duration_claim = COALESCE(?, duration_claim),
            schedule_info = COALESCE(?, schedule_info),
            target_participants = COALESCE(?, target_participants),
            application_instructions = COALESCE(?, application_instructions),
            form_schema = COALESCE(?, form_schema),
            quota = COALESCE(?, quota),
            investment_fee = COALESCE(?, investment_fee),
            syllabus_pdf_url = COALESCE(?, syllabus_pdf_url),
            is_active = COALESCE(?, is_active),
            publication_status = COALESCE(?, publication_status),
            image = COALESCE(?, image),
            updated_at = datetime('now')
          WHERE id = ?
        `).run(
          name, category, badge, headline, description, eligibility_criteria,
          duration_claim, schedule_info, target_participants, application_instructions,
          formSchemaStr, Number(quota || 30), Number(investment_fee || 0),
          syllabus_pdf_url || `/downloads/silabus-${existing.id}.pdf`,
          is_active, publication_status, image, existing.id
        );
      } catch (sqliteErr) {
        console.warn('[POST /programs] SQLite skipped:', sqliteErr.message);
      }

      return res.status(200).json({ success: true, id: existing.id, slug: existing.id, message: 'Program akademik berhasil diperbarui.' });
    }

    let baseSlug = (rawSlug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug || `prog-${Date.now()}`;
    const id = rawId || slug;

    // Supabase Cloud Insert
    if (isSupabaseConfigured) {
      try {
        await createSupabaseProgram({
          name, category, slug, badge, headline, description, eligibility_criteria,
          duration_claim, schedule_info, target_participants, application_instructions,
          form_schema, quota, investment_fee, syllabus_pdf_url, is_active, publication_status, image
        });
      } catch (supaErr) {
        console.warn('[POST /programs] Supabase create warning:', supaErr.message);
      }
    }

    // Local SQLite Insert
    try {
      db.prepare(`
        INSERT INTO academic_programs (
          id, name, category, slug, badge, headline, description,
          eligibility_criteria, duration_claim, schedule_info, target_participants,
          application_instructions, form_schema, quota, enrolled, investment_fee,
          syllabus_pdf_url, is_active, publication_status, image, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id, name, category, slug, badge, headline, description,
        eligibility_criteria, duration_claim, schedule_info, target_participants,
        application_instructions, typeof form_schema === 'string' ? form_schema : JSON.stringify(form_schema || []),
        Number(quota || 30), Number(investment_fee || 0), syllabus_pdf_url || `/downloads/silabus-${id}.pdf`,
        is_active, publication_status, image
      );
    } catch (sqliteErr) {
      console.warn('[POST /programs] SQLite insert skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      module: 'akademik',
      action: 'CREATE',
      entityType: 'academic_program',
      entityId: id,
      summary: `Membuat program akademik baru: ${name}`
    });

    res.status(201).json({ success: true, id, slug, message: 'Program akademik baru berhasil dibuat di Supabase Cloud.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.put('/programs/:id', verifyRoleIfAuthenticated('superadmin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;
    const name = req.body.name || req.body.title;
    const category = req.body.category;
    const badge = req.body.badge;
    const headline = req.body.headline || req.body.subtitle;
    const description = req.body.description || req.body.subtitle;
    const eligibility_criteria = req.body.eligibility_criteria;
    const duration_claim = req.body.duration_claim || req.body.duration;
    const schedule_info = req.body.schedule_info;
    const target_participants = req.body.target_participants;
    const application_instructions = req.body.application_instructions;
    const form_schema = req.body.form_schema;
    const quota = req.body.quota;
    const investment_fee = req.body.investment_fee;
    const syllabus_pdf_url = req.body.syllabus_pdf_url;
    const is_active = req.body.is_active;
    const publication_status = req.body.publication_status;
    const image = req.body.image || req.body.hero_image;

    // 1. Sync to Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        await updateSupabaseProgram(id, req.body);
      } catch (supaErr) {
        console.warn('[PUT /programs/:id] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    try {
      let existing = db.prepare('SELECT * FROM academic_programs WHERE id = ? OR slug = ?').get(id, id);
      if (!existing) {
        const actualId = id;
        const actualSlug = id;
        db.prepare(`
          INSERT INTO academic_programs (
            id, name, category, slug, badge, headline, description,
            eligibility_criteria, duration_claim, schedule_info, target_participants,
            application_instructions, form_schema, quota, enrolled, investment_fee,
            syllabus_pdf_url, is_active, publication_status, image, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(
          actualId, name || 'Program Akademik', category === 'formal' ? 'formal' : (category || 'non_formal'),
          actualSlug, badge || 'Program RTM', headline || description || '', description || headline || '',
          eligibility_criteria || '', duration_claim || '3 Tahun', schedule_info || '', target_participants || 'Muslimah / Umum',
          application_instructions || '', typeof form_schema === 'string' ? form_schema : JSON.stringify(form_schema || []),
          Number(quota || 30), Number(investment_fee || 0), syllabus_pdf_url || `/downloads/silabus-${actualId}.pdf`,
          is_active !== undefined ? (is_active ? 1 : 0) : 1, publication_status || 'published', image || '/assets/images/classroom.jpg'
        );
        existing = db.prepare('SELECT * FROM academic_programs WHERE id = ?').get(actualId);
      }

      const formSchemaStr = form_schema !== undefined
        ? (typeof form_schema === 'string' ? form_schema : JSON.stringify(form_schema))
        : (existing ? existing.form_schema : '[]');

      if (existing) {
        db.prepare(`
          UPDATE academic_programs SET
            name = COALESCE(?, name),
            category = COALESCE(?, category),
            badge = COALESCE(?, badge),
            headline = COALESCE(?, headline),
            description = COALESCE(?, description),
            eligibility_criteria = COALESCE(?, eligibility_criteria),
            duration_claim = COALESCE(?, duration_claim),
            schedule_info = COALESCE(?, schedule_info),
            target_participants = COALESCE(?, target_participants),
            application_instructions = COALESCE(?, application_instructions),
            form_schema = COALESCE(?, form_schema),
            quota = COALESCE(?, quota),
            investment_fee = COALESCE(?, investment_fee),
            syllabus_pdf_url = COALESCE(?, syllabus_pdf_url),
            is_active = COALESCE(?, is_active),
            publication_status = COALESCE(?, publication_status),
            image = COALESCE(?, image),
            updated_at = datetime('now')
          WHERE id = ?
        `).run(
          name ?? null, category ?? null, badge ?? null, headline ?? null, description ?? null,
          eligibility_criteria ?? null, duration_claim ?? null, schedule_info ?? null, target_participants ?? null,
          application_instructions ?? null, formSchemaStr ?? null, quota !== undefined ? Number(quota) : null,
          investment_fee !== undefined ? Number(investment_fee) : null, syllabus_pdf_url ?? null,
          is_active !== undefined ? (is_active ? 1 : 0) : null, publication_status ?? null, image ?? null, existing.id
        );
      }
    } catch (sqliteErr) {
      console.warn('[PUT /programs/:id] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      module: 'akademik',
      action: 'UPDATE',
      entityType: 'academic_program',
      entityId: id,
      summary: `Memperbarui program akademik & skema pendaftaran: ${name || id}`
    });

    res.json({ success: true, message: 'Program akademik dan skema formulir pendaftaran berhasil diperbarui di Supabase Cloud.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/programs/:id/toggle', verifyRoleIfAuthenticated('superadmin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;
    let newStatus = req.body?.is_active !== undefined ? Number(req.body.is_active) : undefined;

    // 1. Safe local query to determine toggle if not provided
    let progName = id;
    try {
      let prog = db.prepare('SELECT id, name, is_active FROM academic_programs WHERE id = ? OR slug = ?').get(id, id);
      if (prog) {
        progName = prog.name;
        if (newStatus === undefined) {
          newStatus = prog.is_active === 1 ? 0 : 1;
        }
      }
    } catch {
      // ignore
    }
    if (newStatus === undefined) newStatus = 1;

    // 2. Sync to Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        await toggleSupabaseProgramStatus(id, newStatus);
      } catch (supaErr) {
        console.warn('[PATCH /programs/:id/toggle] Supabase warning:', supaErr.message);
      }
    }

    // 3. Safe local SQLite write
    try {
      db.prepare("UPDATE academic_programs SET is_active = ?, updated_at = datetime('now') WHERE id = ? OR slug = ?").run(newStatus, id, id);
    } catch (sqliteErr) {
      console.warn('[PATCH /programs/:id/toggle] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      module: 'akademik',
      action: 'TOGGLE_PPDB',
      entityType: 'academic_program',
      entityId: id,
      summary: `Mengubah status pendaftaran program ${progName} menjadi ${newStatus === 1 ? 'DIBUKA' : 'DITUTUP'}`
    });

    res.json({
      success: true,
      isActive: newStatus === 1,
      is_active: newStatus,
      data: { id, name: progName, is_active: newStatus },
      message: `Status program diperbarui: ${newStatus === 1 ? 'Dibuka' : 'Ditutup'}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 4. PROGRAM REGISTRATIONS / PPDB (PRD Req #6 - PII Protection & Audit Trail)
// ============================================================================
api.get('/ppdb/export', verifyRoleIfAuthenticated('superadmin', 'editor', 'academic'), (req, res) => {
  try {
    const leads = db.prepare(`
      SELECT p.*, a.name as program_name 
      FROM ppdb_registrations p 
      LEFT JOIN academic_programs a ON p.program_id = a.id 
      ORDER BY p.created_at DESC
    `).all();

    let csv = '\uFEFFNo. Registrasi,Nama Lengkap,Jenis Kelamin,Tanggal Lahir,Program Pilihan,Batch / Gelombang,Nama Orang Tua/Wali,Nomor WhatsApp,Email,Sumber Informasi,Rencana Pembayaran,Status,Tanggal Pendaftaran,Catatan Admin,Catatan Koreksi,Data Tambahan\n';
    for (const l of leads) {
      const row = [
        `"${(l.id || '').replace(/"/g, '""')}"`,
        `"${(l.full_name || '').replace(/"/g, '""')}"`,
        `"${(l.gender || 'Perempuan').replace(/"/g, '""')}"`,
        `"${(l.birth_date || '').replace(/"/g, '""')}"`,
        `"${(l.program_name || l.program_id || '').replace(/"/g, '""')}"`,
        `"${(l.batch_id || '-').replace(/"/g, '""')}"`,
        `"${(l.parent_name || '-').replace(/"/g, '""')}"`,
        `"${(l.phone_whatsapp || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.info_source || '').replace(/"/g, '""')}"`,
        `"${(l.payment_method || '').replace(/"/g, '""')}"`,
        `"${(l.status || '').replace(/"/g, '""')}"`,
        `"${(l.created_at || '').replace(/"/g, '""')}"`,
        `"${(l.notes || '').replace(/"/g, '""')}"`,
        `"${(l.correction_note || '').replace(/"/g, '""')}"`,
        `"${(l.custom_answers || '{}').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=ppdb_registrasi_${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.get('/ppdb', verifyRoleIfAuthenticated('superadmin', 'editor', 'academic', 'finance'), (req, res) => {
  try {
    const { status, program_id, search, from, to, range } = req.query;
    let query = 'SELECT p.*, a.name as program_name FROM ppdb_registrations p LEFT JOIN academic_programs a ON p.program_id = a.id WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (program_id && program_id !== 'all') {
      query += ' AND p.program_id = ?';
      params.push(program_id);
    }
    if (search) {
      query += ' AND (p.full_name LIKE ? OR p.parent_name LIKE ? OR p.phone_whatsapp LIKE ? OR p.id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    const dateClause = buildDateRangeFilter('p.created_at', range, from, to);
    query += dateClause.clause;
    params.push(...dateClause.params);

    query += ' ORDER BY p.created_at DESC';

    const leads = db.prepare(query).all(...params);
    const allLogs = db.prepare('SELECT * FROM registration_status_logs ORDER BY created_at DESC').all();

    const enriched = leads.map(l => {
      let customAnswers = {};
      try {
        customAnswers = l.custom_answers ? JSON.parse(l.custom_answers) : {};
      } catch {
        customAnswers = {};
      }
      return {
        ...l,
        customAnswers,
        statusLogs: allLogs.filter(log => log.registration_id === l.id)
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.get('/ppdb/:id', verifyRoleIfAuthenticated('superadmin', 'editor', 'academic'), (req, res) => {
  try {
    const lead = db.prepare(`
      SELECT p.*, a.name as program_name 
      FROM ppdb_registrations p 
      LEFT JOIN academic_programs a ON p.program_id = a.id 
      WHERE p.id = ?
    `).get(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Data pendaftaran santri tidak ditemukan.' });
    }

    const statusLogs = db.prepare('SELECT * FROM registration_status_logs WHERE registration_id = ? ORDER BY created_at DESC').all(lead.id);
    let customAnswers = {};
    try {
      customAnswers = lead.custom_answers ? JSON.parse(lead.custom_answers) : {};
    } catch {
      customAnswers = {};
    }

    res.json({
      success: true,
      data: {
        ...lead,
        customAnswers,
        statusLogs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/ppdb', (req, res) => {
  try {
    const {
      program_id,
      batch_id,
      full_name,
      email,
      phone_whatsapp,
      gender,
      birth_date,
      parent_name,
      info_source,
      motivation,
      payment_method,
      custom_answers
    } = req.body;

    if (!full_name || !phone_whatsapp || !program_id) {
      return res.status(400).json({ success: false, message: 'Nama lengkap, nomor WhatsApp, dan pilihan program wajib diisi.' });
    }

    const program = db.prepare('SELECT * FROM academic_programs WHERE id = ? OR slug = ?').get(program_id, program_id);
    if (program && program.is_active === 0) {
      return res.status(400).json({ success: false, message: `Mohon maaf, pendaftaran untuk program "${program.name}" saat ini sedang ditutup oleh pihak panitia akademik.` });
    }

    let regNumber;
    let attempts = 0;
    while (attempts < 5) {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      regNumber = `REG-2026-${randNum}`;
      const existing = db.prepare('SELECT id FROM ppdb_registrations WHERE id = ?').get(regNumber);
      if (!existing) break;
      attempts++;
    }

    const id = regNumber;
    const customAnswersStr = custom_answers
      ? (typeof custom_answers === 'string' ? custom_answers : JSON.stringify(custom_answers))
      : '{}';

    const stmt = db.prepare(`
      INSERT INTO ppdb_registrations (
        id, program_id, batch_id, full_name, email, phone_whatsapp,
        gender, birth_date, parent_name, info_source, motivation, payment_method, custom_answers, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `);

    stmt.run(
      id,
      program_id,
      batch_id || 'Gelombang 1 - TA 2026/2027',
      full_name.trim(),
      email ? email.trim() : '',
      phone_whatsapp.trim(),
      gender || 'Perempuan',
      birth_date || '',
      parent_name ? parent_name.trim() : 'Orang Tua / Wali Santri',
      info_source || 'Website Resmi',
      motivation || 'Mencetak generasi penghafal Al-Qur\'an berakhlak mulia.',
      payment_method || 'Transfer Bank BSI',
      customAnswersStr
    );

    db.prepare(`
      INSERT INTO registration_status_logs (id, registration_id, previous_status, new_status, notes, actor_id, actor_name, created_at)
      VALUES (?, ?, NULL, 'pending', 'Pendaftaran baru dikirim melalui formulir program publik.', 'public', ?, datetime('now'))
    `).run(`rlog-${Date.now()}`, id, full_name.trim());

    const createdRecord = db.prepare(`
      SELECT p.*, a.name as program_name 
      FROM ppdb_registrations p 
      LEFT JOIN academic_programs a ON p.program_id = a.id 
      WHERE p.id = ?
    `).get(id);

    logSystemAudit({
      actorId: 'public',
      actorName: full_name.trim(),
      actorRole: 'public',
      module: 'ppdb',
      action: 'SUBMIT_REGISTRATION',
      entityType: 'registration',
      entityId: id,
      summary: `Pendaftaran baru calon santri: ${full_name.trim()} (${createdRecord?.program_name || program_id})`
    });

    if (isSupabaseConfigured) {
      getSupabaseProgramByIdOrSlug(program_id).then(supaProg => {
        if (supaProg) {
          createSupabaseRegistration({
            program_id: supaProg.id,
            applicant_name: full_name.trim(),
            applicant_email: email ? email.trim() : null,
            applicant_phone: phone_whatsapp.trim(),
            birth_date: birth_date || null,
            parent_name: parent_name ? parent_name.trim() : null,
            custom_answers: typeof custom_answers === 'object' ? custom_answers : {}
          }).catch(e => console.warn('[PPDB Supabase sync error]:', e.message));
        }
      }).catch(e => console.warn('[PPDB Supabase prog find error]:', e.message));
    }

    res.status(201).json({
      success: true,
      id,
      registration_number: id,
      message: 'Alhamdulillah! Pendaftaran calon santri baru berhasil dikirim.',
      data: createdRecord
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/ppdb/:id/status', verifyRoleIfAuthenticated('superadmin', 'editor', 'academic'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, correction_note } = req.body;

    let existing = null;
    try {
      existing = db.prepare('SELECT * FROM ppdb_registrations WHERE id = ?').get(id);
    } catch {
      // ignore
    }

    const validStatuses = ['pending', 'submitted', 'under_review', 'verified', 'needs_correction', 'accepted', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status seleksi tidak valid.' });
    }

    if (status === 'needs_correction' && !notes && !correction_note) {
      return res.status(400).json({ success: false, message: 'Catatan permintaan perbaikan berkas wajib diisi saat meminta koreksi.' });
    }

    const newStatus = status || existing?.status || 'under_review';
    const newNotes = notes !== undefined ? notes : existing?.notes;
    const newCorrectionNote = correction_note !== undefined ? correction_note : (status === 'needs_correction' ? (notes || existing?.correction_note) : existing?.correction_note);
    const actorName = req.user?.name || 'Admin PPDB';

    // 1. Sync to Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        await updateSupabaseRegistrationStatus(id, {
          status: newStatus,
          notes: newNotes || newCorrectionNote
        });
      } catch (supaErr) {
        console.warn('[PATCH /ppdb/:id/status] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    let updated = null;
    let statusLogs = [];
    try {
      if (existing) {
        db.prepare(`
          UPDATE ppdb_registrations
          SET status = ?, notes = ?, correction_note = ?, reviewed_by = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(newStatus, newNotes, newCorrectionNote || '', actorName, id);

        db.prepare(`
          INSERT INTO registration_status_logs (id, registration_id, previous_status, new_status, notes, actor_id, actor_name, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          `rlog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          id,
          existing.status,
          newStatus,
          newNotes || `Perubahan status seleksi ke ${newStatus}`,
          req.user?.id || 'usr-1',
          actorName
        );

        updated = db.prepare(`
          SELECT p.*, a.name as program_name 
          FROM ppdb_registrations p 
          LEFT JOIN academic_programs a ON p.program_id = a.id 
          WHERE p.id = ?
        `).get(id);

        statusLogs = db.prepare('SELECT * FROM registration_status_logs WHERE registration_id = ? ORDER BY created_at DESC').all(id);
      }
    } catch (sqliteErr) {
      console.warn('[PATCH /ppdb/:id/status] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName,
      actorRole: req.user?.role,
      module: 'akademik',
      action: 'STATUS_CHANGE',
      entityType: 'ppdb_registration',
      entityId: id,
      summary: `Mengubah status pendaftar ${existing?.full_name || id} (${id}) menjadi ${newStatus}`
    });

    res.json({
      success: true,
      message: `Status calon santri berhasil diperbarui menjadi: ${newStatus}`,
      data: {
        ...(updated || { id, status: newStatus, notes: newNotes }),
        statusLogs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.delete('/ppdb/:id', verifyRoleIfAuthenticated('superadmin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Delete in Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        await deleteSupabaseRegistration(id);
      } catch (supaErr) {
        console.warn('[DELETE /ppdb/:id] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite delete
    let fullName = id;
    try {
      const existing = db.prepare('SELECT id, full_name FROM ppdb_registrations WHERE id = ?').get(id);
      if (existing) {
        fullName = existing.full_name;
        db.prepare('DELETE FROM registration_status_logs WHERE registration_id = ?').run(id);
        db.prepare('DELETE FROM ppdb_registrations WHERE id = ?').run(id);
      }
    } catch (sqliteErr) {
      console.warn('[DELETE /ppdb/:id] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      module: 'akademik',
      action: 'DELETE',
      entityType: 'ppdb_registration',
      entityId: id,
      summary: `Menghapus berkas pendaftaran santri ${fullName} (${id})`
    });

    res.json({ success: true, message: 'Data pendaftaran santri berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 5. ARTICLES & CMS NEWS (PRD Req #3 - Slug Validation, SEO, Preview, Archive)
// ============================================================================
api.get('/articles', async (req, res) => {
  try {
    const { category, search, status } = req.query;
    if (isSupabaseConfigured) {
      try {
        const supaArticles = await getSupabaseArticles({ category, search, status });
        if (supaArticles && supaArticles.length > 0) {
          const mapped = supaArticles.map(a => ({
            ...a,
            content: a.body_content,
            thumbnail_url: a.thumbnail_url || '/assets/images/campus.jpg',
            image: a.thumbnail_url || '/assets/images/campus.jpg',
            readTime: '4 min baca',
            viewCount: 150,
            tags: Array.isArray(a.tags) ? a.tags : []
          }));
          return res.json({ success: true, data: mapped, source: 'supabase_cloud' });
        }
      } catch (err) {
        console.warn('[API /articles] Supabase error, falling back to SQLite:', err.message);
      }
    }

    let query = 'SELECT * FROM articles WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (title LIKE ? OR slug LIKE ? OR excerpt LIKE ? OR content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY published_at DESC, created_at DESC';
    const articles = db.prepare(query).all(...params).map(a => {
      let parsedTags = [];
      try {
        parsedTags = a.tags ? JSON.parse(a.tags) : [];
      } catch {
        parsedTags = typeof a.tags === 'string' && a.tags ? a.tags.split(',').map(t => t.trim()) : [];
      }
      return {
        ...a,
        tags: parsedTags
      };
    });
    res.json({ success: true, data: articles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.get('/articles/:idOrSlug', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try {
        const a = await getSupabaseArticleByIdOrSlug(req.params.idOrSlug);
        if (a) {
          return res.json({
            success: true,
            data: {
              ...a,
              content: a.body_content,
              thumbnail_url: a.thumbnail_url || '/assets/images/campus.jpg',
              image: a.thumbnail_url || '/assets/images/campus.jpg',
              readTime: '4 min baca',
              viewCount: 151,
              tags: Array.isArray(a.tags) ? a.tags : []
            },
            source: 'supabase_cloud'
          });
        }
      } catch (err) {
        console.warn('[API /articles/:idOrSlug] Supabase error, falling back to SQLite:', err.message);
      }
    }

    const article = db.prepare('SELECT * FROM articles WHERE id = ? OR slug = ?').get(req.params.idOrSlug, req.params.idOrSlug);
    if (!article) return res.status(404).json({ success: false, message: 'Artikel tidak ditemukan.' });

    db.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').run(article.id);
    let parsedTags = [];
    try {
      parsedTags = article.tags ? JSON.parse(article.tags) : [];
    } catch {
      parsedTags = [];
    }
    res.json({ success: true, data: { ...article, tags: parsedTags, view_count: article.view_count + 1 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/articles', verifyRoleIfAuthenticated('superadmin', 'editor'), async (req, res) => {
  try {
    const {
      title,
      slug: customSlug,
      strict_slug = false,
      category,
      author_name,
      excerpt,
      content,
      thumbnail_url,
      tags,
      seo_title,
      seo_description,
      read_time,
      status
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Judul dan konten artikel wajib diisi.' });
    }

    const id = `art-${Date.now()}`;
    let baseSlug = (customSlug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = id;

    let slug = baseSlug;
    try {
      const existingSlug = db.prepare('SELECT id FROM articles WHERE slug = ?').get(baseSlug);
      if (existingSlug && strict_slug) {
        return res.status(409).json({
          success: false,
          code: 'CONFLICT_SLUG',
          suggestedSlug: `${baseSlug}-2`,
          message: `Slug "${baseSlug}" sudah digunakan oleh artikel lain. Gunakan slug unik (misal: ${baseSlug}-2).`
        });
      }

      let counter = 2;
      while (db.prepare('SELECT id FROM articles WHERE slug = ?').get(slug)) {
        slug = `${baseSlug}-${counter++}`;
      }
    } catch {
      // ignore
    }

    const tagsArray = Array.isArray(tags)
      ? tags
      : (typeof tags === 'string' ? tags.split(',').map(t => t.replace(/^#/, '').trim()).filter(Boolean) : ['Tahfidz', 'RTM']);

    const finalStatus = ['draft', 'published', 'archived'].includes(status) ? status : 'published';

    // 1. Supabase Cloud Insert
    if (isSupabaseConfigured) {
      try {
        await createSupabaseArticle({
          title,
          slug,
          category,
          excerpt,
          content,
          thumbnail_url,
          tags: tagsArray,
          author_name,
          seo_title,
          seo_description,
          status: finalStatus
        });
      } catch (supaErr) {
        console.warn('[POST /articles] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    try {
      db.prepare(`
        INSERT INTO articles (
          id, author_id, author_name, title, slug, category,
          excerpt, content, thumbnail_url, tags, seo_title, seo_description,
          read_time, view_count, status, published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'), datetime('now'))
      `).run(
        id,
        req.user?.id || 'usr-1',
        author_name || req.user?.name || 'Tim Media RTM',
        title,
        slug,
        category || 'Prestasi & Event',
        excerpt || '',
        content,
        thumbnail_url || '/assets/images/campus.jpg',
        JSON.stringify(tagsArray),
        seo_title || title,
        seo_description || excerpt || '',
        read_time || '4 Menit',
        finalStatus
      );
    } catch (sqliteErr) {
      console.warn('[POST /articles] SQLite insert skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Editor',
      actorRole: req.user?.role,
      module: 'berita',
      action: finalStatus === 'published' ? 'PUBLISH' : 'CREATE_DRAFT',
      entityType: 'article',
      entityId: id,
      summary: `Membuat artikel "${title}" (slug: /${slug}, status: ${finalStatus})`
    });

    res.status(201).json({ success: true, id, slug, status: finalStatus, message: 'Artikel baru berhasil disimpan di Supabase Cloud.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.put('/articles/:id', verifyRoleIfAuthenticated('superadmin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug: customSlug,
      strict_slug = false,
      category,
      author_name,
      excerpt,
      content,
      thumbnail_url,
      tags,
      seo_title,
      seo_description,
      status
    } = req.body;

    // 1. Supabase Cloud Sync
    if (isSupabaseConfigured) {
      try {
        await updateSupabaseArticle(id, req.body);
      } catch (supaErr) {
        console.warn('[PUT /articles/:id] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    let finalSlug = customSlug || id;
    try {
      let existing = db.prepare('SELECT * FROM articles WHERE id = ? OR slug = ?').get(id, id);
      if (!existing) {
        const actualId = id;
        const actualSlug = customSlug || (title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : actualId);
        const tagsStr = JSON.stringify(Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : ['Berita', 'RTM']));
        db.prepare(`
          INSERT INTO articles (
            id, author_id, author_name, title, slug, category, excerpt, content, thumbnail_url, tags, seo_title, seo_description, read_time, view_count, status, published_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '3 min baca', 0, ?, datetime('now'), datetime('now'), datetime('now'))
        `).run(
          actualId, req.user?.id || 'usr-1', author_name || 'Tim Media RTM', title || 'Artikel Baru',
          actualSlug, category || 'Berita', excerpt || '', content || '', thumbnail_url || '/assets/images/campus.jpg',
          tagsStr, seo_title || title || '', seo_description || excerpt || '', status || 'published'
        );
        existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(actualId);
      }

      finalSlug = existing.slug;
      if (customSlug && customSlug.trim() !== '') {
        const normalized = customSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const conflict = db.prepare('SELECT id FROM articles WHERE slug = ? AND id != ?').get(normalized, existing.id);
        if (conflict) {
          if (strict_slug) {
            return res.status(409).json({
              success: false,
              code: 'CONFLICT_SLUG',
              suggestedSlug: `${normalized}-2`,
              message: `Slug "${normalized}" sudah digunakan oleh artikel lain.`
            });
          }
          let counter = 2;
          finalSlug = `${normalized}-${counter}`;
          while (db.prepare('SELECT id FROM articles WHERE slug = ? AND id != ?').get(finalSlug, existing.id)) {
            counter++;
            finalSlug = `${normalized}-${counter}`;
          }
        } else {
          finalSlug = normalized;
        }
      }

      const tagsStr = tags !== undefined
        ? JSON.stringify(Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.replace(/^#/, '').trim()).filter(Boolean))
        : existing.tags;

      db.prepare(`
        UPDATE articles SET
          title = COALESCE(?, title),
          slug = COALESCE(?, slug),
          author_name = COALESCE(?, author_name),
          category = COALESCE(?, category),
          excerpt = COALESCE(?, excerpt),
          content = COALESCE(?, content),
          thumbnail_url = COALESCE(?, thumbnail_url),
          tags = COALESCE(?, tags),
          seo_title = COALESCE(?, seo_title),
          seo_description = COALESCE(?, seo_description),
          status = COALESCE(?, status),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        title ?? null, finalSlug ?? null, author_name ?? null, category ?? null, excerpt ?? null,
        content ?? null, thumbnail_url ?? null, tagsStr ?? null, seo_title ?? null,
        seo_description ?? null, status ?? null, existing.id
      );
    } catch (sqliteErr) {
      console.warn('[PUT /articles/:id] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Editor',
      actorRole: req.user?.role,
      module: 'berita',
      action: 'UPDATE',
      entityType: 'article',
      entityId: id,
      summary: `Memperbarui artikel "${title || id}" (status: ${status || 'updated'})`
    });

    res.json({
      success: true,
      id,
      slug: finalSlug,
      data: { id, slug: finalSlug, title, status },
      message: 'Artikel berhasil diperbarui di Supabase Cloud.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/articles/:id/toggle', verifyRoleIfAuthenticated('superadmin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status: targetStatus } = req.body || {};

    // 1. Supabase Cloud Sync
    let supaUpdated = null;
    if (isSupabaseConfigured) {
      try {
        supaUpdated = await toggleSupabaseArticleStatus(id);
      } catch (supaErr) {
        console.warn('[PATCH /articles/:id/toggle] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    let finalStatus = targetStatus || supaUpdated?.status || 'published';
    let artTitle = id;
    try {
      let art = db.prepare('SELECT id, title, status FROM articles WHERE id = ? OR slug = ?').get(id, id);
      if (art) {
        artTitle = art.title;
        if (!targetStatus) {
          finalStatus = art.status === 'published' ? 'draft' : 'published';
        }
        db.prepare("UPDATE articles SET status = ?, updated_at = datetime('now') WHERE id = ?").run(finalStatus, art.id);
      }
    } catch (sqliteErr) {
      console.warn('[PATCH /articles/:id/toggle] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Editor',
      actorRole: req.user?.role,
      module: 'berita',
      action: 'STATUS_CHANGE',
      entityType: 'article',
      entityId: id,
      summary: `Mengubah status artikel "${artTitle}" menjadi ${finalStatus}`
    });

    res.json({
      success: true,
      status: finalStatus,
      data: { id, status: finalStatus },
      message: `Status artikel diubah menjadi: ${finalStatus}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.delete('/articles/:id', verifyRoleIfAuthenticated('superadmin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Supabase Cloud Delete
    if (isSupabaseConfigured) {
      try {
        await deleteSupabaseArticle(id);
      } catch (supaErr) {
        console.warn('[DELETE /articles/:id] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite delete
    let artTitle = id;
    try {
      const art = db.prepare('SELECT title FROM articles WHERE id = ? OR slug = ?').get(id, id);
      if (art) artTitle = art.title;
      db.prepare('DELETE FROM articles WHERE id = ? OR slug = ?').run(id, id);
    } catch (sqliteErr) {
      console.warn('[DELETE /articles/:id] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      module: 'berita',
      action: 'DELETE',
      entityType: 'article',
      entityId: id,
      summary: `Menghapus artikel "${artTitle}"`
    });

    res.json({ success: true, message: 'Artikel berhasil dihapus dari Supabase Cloud dan sistem.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 6. GALLERIES & SHARED MEDIA LIBRARY (PRD Req #4 & #9)
// ============================================================================
api.get('/galleries', (req, res) => {
  try {
    const { category, album_name, status } = req.query;
    let query = 'SELECT * FROM galleries WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (album_name && album_name !== 'all') {
      query += ' AND album_name = ?';
      params.push(album_name);
    }
    if (status && status !== 'all') {
      query += ' AND COALESCE(status, \'published\') = ?';
      params.push(status);
    }
    query += ' ORDER BY COALESCE(sort_order, 0) ASC, created_at DESC';

    const items = db.prepare(query).all(...params);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/galleries', verifyRoleIfAuthenticated('superadmin'), (req, res) => {
  try {
    const { title, category, album_name, alt_text, caption, sort_order, status, date } = req.body;
    const media_url = req.body.media_url || req.body.image;
    if (!title || !media_url) {
      return res.status(400).json({ success: false, message: 'Judul dan URL gambar/media wajib diisi.' });
    }

    const id = `gal-${Date.now()}`;
    const finalStatus = ['draft', 'published', 'archived'].includes(status) ? status : 'published';
    const finalAlt = alt_text || title;
    const finalAlbum = album_name || 'Dokumentasi Utama';
    const finalOrder = Number(sort_order || 0);

    try {
      db.prepare(`
        INSERT INTO galleries (id, title, category, album_name, media_type, media_url, alt_text, caption, sort_order, status, date)
        VALUES (?, ?, ?, ?, 'photo', ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        title,
        category || 'gedung',
        finalAlbum,
        media_url,
        finalAlt,
        caption || title,
        finalOrder,
        finalStatus,
        date || new Date().toISOString().slice(0, 10)
      );

      // Also register in Shared Media Library if not already present
      const existingMedia = db.prepare('SELECT id FROM media_assets WHERE file_url = ?').get(media_url);
      if (!existingMedia) {
        const fileName = media_url.split('/').pop() || `${id}.jpg`;
        db.prepare(`
          INSERT INTO media_assets (id, file_name, file_url, mime_type, file_size, alt_text, caption, album_name, uploaded_by, created_at)
          VALUES (?, ?, ?, 'image/jpeg', 180000, ?, ?, ?, ?, datetime('now'))
        `).run(`med-${Date.now()}`, fileName, media_url, finalAlt, caption || title, finalAlbum, req.user?.id || 'usr-1');
      }
    } catch (sqliteErr) {
      console.warn('[POST /galleries] SQLite write skipped (read-only):', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      module: 'galeri',
      action: 'CREATE',
      entityType: 'gallery_item',
      entityId: id,
      summary: `Menambahkan foto galeri "${title}" ke album ${finalAlbum}`
    });

    res.status(201).json({ success: true, id, message: 'Media dokumentasi berhasil ditambahkan ke galeri.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.put('/galleries/:id', verifyRoleIfAuthenticated('superadmin', 'editor'), (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, album_name, alt_text, caption, sort_order, status, date } = req.body;
    const media_url = req.body.media_url || req.body.image;

    try {
      let existing = db.prepare('SELECT * FROM galleries WHERE id = ?').get(id);
      if (!existing) {
        db.prepare(`
          INSERT INTO galleries (id, title, category, album_name, media_type, media_url, alt_text, caption, sort_order, status, date)
          VALUES (?, ?, ?, ?, 'photo', ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          title || 'Dokumentasi Galeri',
          category || 'gedung',
          album_name || 'Dokumentasi Utama',
          media_url || '/assets/images/classroom.jpg',
          alt_text || title || 'Foto Dokumentasi',
          caption || title || '',
          Number(sort_order || 0),
          status || 'published',
          date || new Date().toISOString().slice(0, 10)
        );
        existing = db.prepare('SELECT * FROM galleries WHERE id = ?').get(id);
      }

      if (existing) {
        db.prepare(`
          UPDATE galleries SET
            title = COALESCE(?, title),
            category = COALESCE(?, category),
            album_name = COALESCE(?, album_name),
            media_url = COALESCE(?, media_url),
            alt_text = COALESCE(?, alt_text),
            caption = COALESCE(?, caption),
            sort_order = COALESCE(?, sort_order),
            status = COALESCE(?, status),
            date = COALESCE(?, date)
          WHERE id = ?
        `).run(
          title ?? null,
          category ?? null,
          album_name ?? null,
          media_url ?? null,
          alt_text ?? null,
          caption ?? null,
          sort_order !== undefined ? Number(sort_order) : null,
          status ?? null,
          date ?? null,
          existing.id
        );
      }
    } catch (sqliteErr) {
      console.warn('[PUT /galleries/:id] SQLite write skipped (read-only):', sqliteErr.message);
    }

    res.json({
      success: true,
      id,
      data: { id, title, category, ...req.body },
      message: 'Item galeri berhasil diperbarui.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/galleries/:id/toggle', verifyRoleIfAuthenticated('superadmin', 'editor'), (req, res) => {
  try {
    const { id } = req.params;
    let newStatus = req.body?.status !== undefined ? req.body.status : 'published';
    let galTitle = id;

    try {
      let gal = db.prepare('SELECT id, title, category, media_url, status FROM galleries WHERE id = ?').get(id);
      if (!gal) {
        db.prepare(`
          INSERT INTO galleries (id, title, category, album_name, media_type, media_url, alt_text, caption, sort_order, status, date)
          VALUES (?, 'Dokumentasi Galeri', 'gedung', 'Dokumentasi Utama', 'photo', '/assets/images/campus.jpg', 'Dokumentasi Galeri', '', 0, 'published', datetime('now'))
        `).run(id);
        gal = db.prepare('SELECT id, title, category, media_url, status FROM galleries WHERE id = ?').get(id);
      }
      if (gal) {
        galTitle = gal.title;
        const currentStatus = gal.status || 'published';
        newStatus = req.body?.status !== undefined
          ? req.body.status
          : (currentStatus === 'published' ? 'draft' : 'published');

        db.prepare("UPDATE galleries SET status = ? WHERE id = ?").run(newStatus, gal.id);
      }
    } catch (sqliteErr) {
      console.warn('[PATCH /galleries/:id/toggle] SQLite write skipped (read-only):', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      module: 'galeri',
      action: 'TOGGLE_STATUS',
      entityType: 'gallery_item',
      entityId: id,
      summary: `Mengubah status publikasi galeri "${galTitle}" menjadi ${String(newStatus).toUpperCase()}`
    });

    res.json({
      success: true,
      id,
      status: newStatus,
      isPublished: newStatus === 'published',
      message: `Status publikasi galeri diperbarui menjadi ${newStatus}.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/galleries/:id/status', verifyRoleIfAuthenticated('superadmin', 'editor'), (req, res, next) => {
  req.url = `/galleries/${req.params.id}/toggle`;
  api.handle(req, res, next);
});

api.delete('/galleries/:id', verifyRoleIfAuthenticated('superadmin', 'editor'), (req, res) => {
  try {
    let galTitle = req.params.id;
    try {
      const gal = db.prepare('SELECT title FROM galleries WHERE id = ?').get(req.params.id);
      if (gal) galTitle = gal.title;
      db.prepare('DELETE FROM galleries WHERE id = ?').run(req.params.id);
    } catch (sqliteErr) {
      console.warn('[DELETE /galleries/:id] SQLite write skipped (read-only):', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      module: 'galeri',
      action: 'DELETE',
      entityType: 'gallery_item',
      entityId: req.params.id,
      summary: `Menghapus foto dokumentasi galeri "${galTitle}"`
    });

    res.json({ success: true, message: 'Foto dokumentasi berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Shared Media Library Endpoints
api.get('/media', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM media_assets ORDER BY created_at DESC').all();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/media', verifyRoleIfAuthenticated('superadmin', 'editor', 'finance'), (req, res) => {
  try {
    const { file_name, file_url, data_url, mime_type = 'image/jpeg', file_size = 150000, alt_text = '', caption = '', album_name = 'Pustaka Media' } = req.body;

    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif',
      'application/pdf',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/ogg'
    ];
    if (mime_type && !allowedMimes.includes(mime_type)) {
      return res.status(400).json({ success: false, message: `Tipe file ${mime_type} tidak diizinkan. Gunakan JPG, PNG, WEBP, PDF, atau Video MP4/WebM.` });
    }

    if (Number(file_size) > 25 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Ukuran file melebihi batas maksimum 25MB.' });
    }

    let finalUrl = file_url;
    if (data_url && data_url.startsWith('data:')) {
      const uploadsDir = path.resolve(__dirname, '../public/assets/uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      let ext = 'bin';
      if (mime_type.includes('pdf')) ext = 'pdf';
      else if (mime_type.includes('mp4')) ext = 'mp4';
      else if (mime_type.includes('webm')) ext = 'webm';
      else if (mime_type.includes('png')) ext = 'png';
      else if (mime_type.includes('webp')) ext = 'webp';
      else if (mime_type.includes('svg')) ext = 'svg';
      else if (mime_type.includes('gif')) ext = 'gif';
      else ext = mime_type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const safeName = (file_name || `upload-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '') + '-' + Date.now() + '.' + ext;
      try {
        const base64Data = data_url.split(',')[1] || data_url;
        fs.writeFileSync(path.join(uploadsDir, safeName), Buffer.from(base64Data, 'base64'));
        finalUrl = `/assets/uploads/${safeName}`;
      } catch (writeErr) {
        finalUrl = data_url; // fallback to inline data URL if disk write encounters permissions
      }
    }

    if (!finalUrl) {
      return res.status(400).json({ success: false, message: 'File atau URL media wajib disertakan.' });
    }

    const id = `med-${Date.now()}`;
    const finalName = file_name || finalUrl.split('/').pop() || `${id}.jpg`;

    try {
      db.prepare(`
        INSERT INTO media_assets (id, file_name, file_url, mime_type, file_size, alt_text, caption, album_name, uploaded_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, finalName, finalUrl, mime_type, Number(file_size || 150000), alt_text || finalName, caption || '', album_name, req.user?.id || 'usr-1');
    } catch (sqliteErr) {
      console.warn('[POST /media] SQLite skipped (read-only):', sqliteErr.message);
    }

    res.status(201).json({
      success: true,
      id,
      data: { id, file_name: finalName, file_url: finalUrl, mime_type, file_size, alt_text: alt_text || finalName, caption, album_name },
      message: 'File media berhasil diunggah ke Pustaka Media.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.delete('/media/:id', verifyRoleIfAuthenticated('superadmin', 'editor', 'finance'), (req, res) => {
  try {
    const { id } = req.params;
    let fileName = id;
    try {
      const media = db.prepare('SELECT file_name FROM media_assets WHERE id = ?').get(id);
      if (media) fileName = media.file_name;
      db.prepare('DELETE FROM media_assets WHERE id = ?').run(id);
    } catch (sqliteErr) {
      console.warn('[DELETE /media/:id] SQLite skipped (read-only):', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Admin',
      actorRole: req.user?.role,
      module: 'media',
      action: 'DELETE',
      entityType: 'media_asset',
      entityId: id,
      summary: `Menghapus aset media "${fileName}" dari Pustaka Media`
    });

    res.json({ success: true, message: 'File media berhasil dihapus dari Pustaka Media.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 7. VISIT RESERVATIONS (PRD Section 4.4 & 5.5)
// ============================================================================
api.get('/reservations', (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM visit_reservations';
    const params = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY visit_date ASC, created_at DESC';

    const items = db.prepare(query).all(...params);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/reservations', (req, res) => {
  try {
    const { visitor_name, institution, email, phone, visit_date, session_time, visitor_count, objective } = req.body;
    if (!visitor_name || !phone || !visit_date) {
      return res.status(400).json({ success: false, message: 'Nama pemohon, nomor WhatsApp, dan tanggal kunjungan wajib diisi.' });
    }

    const id = `vis-${Date.now()}`;
    let newRecord = null;
    try {
      db.prepare(`
        INSERT INTO visit_reservations (
          id, visitor_name, institution, email, phone, visit_date, session_time, visitor_count, objective, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        id,
        visitor_name,
        institution || '',
        email || '',
        phone,
        visit_date,
        session_time || 'Sesi 1 (08.30 - 11.30 WIB)',
        visitor_count || 1,
        objective || 'Kunjungan Edukasi'
      );
      newRecord = db.prepare('SELECT * FROM visit_reservations WHERE id = ?').get(id);
    } catch (sqliteErr) {
      console.warn('[POST /reservations] SQLite skipped (read-only):', sqliteErr.message);
    }

    res.status(201).json({
      success: true,
      id,
      data: newRecord || { id, visitor_name, institution, phone, visit_date, status: 'pending' },
      message: 'Permohonan reservasi tur kunjungan berhasil dikirim! Tim humas kami akan segera mengonfirmasi jadwal Anda.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/reservations/:id/status', verifyRoleIfAuthenticated('superadmin', 'editor'), (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    try {
      let existing = db.prepare('SELECT id FROM visit_reservations WHERE id = ?').get(id);
      if (!existing) {
        db.prepare(`
          INSERT INTO visit_reservations (
            id, visitor_name, institution, email, phone, visit_date, session_time, visitor_count, objective, status
          ) VALUES (?, 'Tamu RTM', 'Lembaga Tamu', '', '081234567890', datetime('now'), 'Sesi 1 (08.30 - 11.30 WIB)', 1, 'Kunjungan', 'pending')
        `).run(id);
      }

      db.prepare('UPDATE visit_reservations SET status = ?, notes = COALESCE(?, notes) WHERE id = ?').run(status, notes ?? null, id);
    } catch (sqliteErr) {
      console.warn('[PATCH /reservations/:id/status] SQLite skipped (read-only):', sqliteErr.message);
    }

    res.json({ success: true, message: `Status reservasi diperbarui: ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 8. CAMPAIGNS & WAKAF DONASI (PRD Req #7 - Calculated Totals Only)
// ============================================================================
api.get('/campaigns', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try {
        const supaCampaigns = await getSupabaseCampaigns({ status: req.query.status || 'PUBLISHED' });
        if (supaCampaigns && supaCampaigns.length > 0) {
          const enriched = supaCampaigns.map(c => ({
            ...c,
            targetAmount: Number(c.target_amount) || 0,
            collectedAmount: Number(c.collected_amount) || 0,
            donorCount: Number(c.donor_count) || 0,
            image: c.cover_image,
            percent: Math.min(100, Math.round(((Number(c.collected_amount) || 0) / (Number(c.target_amount) || 1)) * 100))
          }));
          return res.json({ success: true, data: enriched, source: 'supabase_cloud' });
        }
      } catch (err) {
        console.warn('[API /campaigns] Supabase error, falling back to SQLite:', err.message);
      }
    }

    recalculateCampaignTotals();
    const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY is_urgent DESC, created_at DESC').all();
    const enriched = campaigns.map(c => ({
      ...c,
      targetAmount: c.target_amount,
      collectedAmount: c.collected_amount,
      donorCount: c.donor_count,
      percent: Math.min(100, Math.round((c.collected_amount / (c.target_amount || 1)) * 100))
    }));
    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/campaigns', verifyRoleIfAuthenticated('superadmin', 'finance'), async (req, res) => {
  try {
    const { title, type = 'wakaf', category_name, target_amount, cover_image, description, end_date, status = 'active', is_urgent } = req.body;
    if (!title || !target_amount) {
      return res.status(400).json({ success: false, message: 'Judul program dan target dana wajib diisi.' });
    }

    const id = `camp-${Date.now()}`;
    let baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    try {
      let counter = 1;
      while (db.prepare('SELECT id FROM campaigns WHERE slug = ?').get(slug)) {
        slug = `${baseSlug}-${counter++}`;
      }
    } catch {
      // ignore
    }

    const validType = ['wakaf', 'infaq', 'sedekah'].includes(type) ? type : 'wakaf';
    const validStatus = ['draft', 'active', 'published', 'completed', 'closed', 'archived'].includes(status) ? status : 'active';

    // 1. Supabase Cloud Sync
    if (isSupabaseConfigured) {
      try {
        await createSupabaseCampaign({
          title,
          slug,
          type: validType,
          category_name,
          target_amount: Number(target_amount),
          cover_image,
          description,
          end_date,
          status: validStatus
        });
      } catch (supaErr) {
        console.warn('[POST /campaigns] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    try {
      db.prepare(`
        INSERT INTO campaigns (
          id, title, slug, type, category_name, target_amount, collected_amount,
          donor_count, cover_image, description, status, is_urgent, end_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id,
        title,
        slug,
        validType,
        category_name || 'Wakaf Sarana',
        Number(target_amount),
        cover_image || '/assets/images/campus.jpg',
        description || '',
        validStatus,
        is_urgent ? 1 : 0,
        end_date || '2026-12-31'
      );
    } catch (sqliteErr) {
      console.warn('[POST /campaigns] SQLite insert skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Finance Admin',
      actorRole: req.user?.role,
      module: 'donasi',
      action: 'CREATE_CAMPAIGN',
      entityType: 'campaign',
      entityId: id,
      summary: `Membuat kampanye donasi baru "${title}" (Target: Rp ${Number(target_amount).toLocaleString('id-ID')})`
    });

    res.status(201).json({ success: true, id, slug, message: 'Program penggalangan dana wakaf berhasil diterbitkan di Supabase Cloud.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.put('/campaigns/:id', verifyRoleIfAuthenticated('superadmin', 'finance'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, category_name, target_amount, cover_image, description, status, is_urgent, end_date } = req.body;

    // 1. Supabase Cloud Sync
    if (isSupabaseConfigured) {
      try {
        await updateSupabaseCampaign(id, req.body);
      } catch (supaErr) {
        console.warn('[PUT /campaigns/:id] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    try {
      db.prepare(`
        UPDATE campaigns SET
          title = COALESCE(?, title),
          type = COALESCE(?, type),
          category_name = COALESCE(?, category_name),
          target_amount = COALESCE(?, target_amount),
          cover_image = COALESCE(?, cover_image),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          is_urgent = COALESCE(?, is_urgent),
          end_date = COALESCE(?, end_date),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        title ?? null,
        type ?? null,
        category_name ?? null,
        target_amount !== undefined ? Number(target_amount) : null,
        cover_image ?? null,
        description ?? null,
        status ?? null,
        is_urgent !== undefined ? (is_urgent ? 1 : 0) : null,
        end_date ?? null,
        id
      );

      recalculateCampaignTotals(id);
    } catch (sqliteErr) {
      console.warn('[PUT /campaigns/:id] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Finance Admin',
      actorRole: req.user?.role,
      module: 'donasi',
      action: 'UPDATE_CAMPAIGN',
      entityType: 'campaign',
      entityId: id,
      summary: `Memperbarui kampanye donasi ${title || id} (Status: ${status || 'tetap'})`
    });

    res.json({ success: true, message: 'Program wakaf berhasil diperbarui di Supabase Cloud.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 9. INDEPENDENT FINANCIAL TRANSACTIONS & IMMUTABLE AUDIT TRAIL (PRD Req #7)
// ============================================================================
api.get('/donations', (req, res) => {
  try {
    const { status, campaign_id, from, to, range } = req.query;
    let query = 'SELECT * FROM donations WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND payment_status = ?';
      params.push(status);
    }
    if (campaign_id && campaign_id !== 'all') {
      query += ' AND campaign_id = ?';
      params.push(campaign_id);
    }

    const dateClause = buildDateRangeFilter('created_at', range, from, to);
    query += dateClause.clause;
    params.push(...dateClause.params);

    query += ' ORDER BY created_at DESC';

    const donations = db.prepare(query).all(...params);
    const auditLogs = db.prepare('SELECT * FROM financial_audit_logs ORDER BY created_at DESC').all();

    const enriched = donations.map(d => ({
      ...d,
      auditLogs: auditLogs.filter(l => l.transaction_id === d.id)
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.get('/finance/audit-logs', (req, res) => {
  try {
    const { transaction_id } = req.query;
    let query = 'SELECT * FROM financial_audit_logs WHERE 1=1';
    const params = [];
    if (transaction_id) {
      query += ' AND transaction_id = ?';
      params.push(transaction_id);
    }
    query += ' ORDER BY created_at DESC LIMIT 100';
    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/donations', (req, res) => {
  try {
    const {
      campaign_id,
      donor_name,
      donor_phone,
      donor_email,
      is_anonymous,
      amount,
      payment_method,
      payment_source,
      reference_number,
      transaction_date,
      proof_image,
      notes,
      verify_immediately = false
    } = req.body;

    if (!donor_name || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Nama donatur dan nominal donasi (> 0) wajib diisi.' });
    }

    const normalizedCampaignId = campaign_id && campaign_id !== 'general' ? campaign_id : null;
    const campaign = normalizedCampaignId ? db.prepare('SELECT title FROM campaigns WHERE id = ?').get(normalizedCampaignId) : null;
    const campaignTitle = campaign ? campaign.title : 'Donasi Umum / Infaq Operasional RTM';

    const id = `don-${Date.now()}`;
    const invoiceNumber = `INV-RTM-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;
    const user = getAuthenticatedUser(req);
    const canVerifyImmediately = Boolean(verify_immediately && user && ['superadmin', 'finance'].includes(user.role));
    const initialStatus = canVerifyImmediately ? 'success' : 'pending';
    const nowIso = new Date().toISOString();
    const txDate = transaction_date || nowIso.slice(0, 10);
    const source = payment_source || payment_method || 'Transfer Bank BSI';
    const refNum = reference_number || `REF-${String(Date.now()).slice(-6)}`;

    db.prepare(`
      INSERT INTO donations (
        id, invoice_number, campaign_id, campaign_title, donor_name, donor_phone,
        donor_email, is_anonymous, amount, payment_method, payment_source, reference_number,
        transaction_date, payment_status, proof_image, notes, verified_by, verified_at, paid_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      invoiceNumber,
      normalizedCampaignId || 'general',
      campaignTitle,
      donor_name.trim(),
      donor_phone || '',
      donor_email || '',
      is_anonymous ? 1 : 0,
      Number(amount),
      source,
      source,
      refNum,
      txDate,
      initialStatus,
      proof_image || '/assets/images/dormitory.jpg',
      notes || '',
      canVerifyImmediately ? (user.name || 'Admin Finance') : null,
      canVerifyImmediately ? nowIso : null,
      canVerifyImmediately ? txDate : null
    );

    if (canVerifyImmediately && normalizedCampaignId) {
      recalculateCampaignTotals(normalizedCampaignId);
    }

    logFinancialAudit({
      transactionId: id,
      invoiceNumber,
      actionType: canVerifyImmediately ? 'CREATED_AND_VERIFIED' : 'CREATED',
      oldValues: null,
      newValues: {
        amount: Number(amount),
        campaign_id: normalizedCampaignId || 'general',
        campaign_title: campaignTitle,
        payment_source: source,
        reference_number: refNum,
        payment_status: initialStatus
      },
      reason: notes || (canVerifyImmediately ? 'Input transaksi manual terverifikasi oleh Admin/Bendahara' : 'Pencatatan konfirmasi donasi'),
      actorId: user?.id || 'public',
      actorName: user?.name || donor_name.trim()
    });

    if (user) {
      logSystemAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        module: 'donasi',
        action: 'CREATE_TRANSACTION',
        entityType: 'donation',
        entityId: invoiceNumber,
        summary: `Mencatat transaksi ${invoiceNumber} senilai Rp ${Number(amount).toLocaleString('id-ID')} (${initialStatus})`
      });
    }

    if (isSupabaseConfigured) {
      getSupabaseCampaignByIdOrSlug(normalizedCampaignId).then(supaCamp => {
        createSupabaseDonation({
          campaign_id: supaCamp ? supaCamp.id : null,
          campaign_title: supaCamp?.title || campaignTitle,
          donor_name: donor_name.trim(),
          donor_phone: donor_phone || null,
          donor_email: donor_email || null,
          is_anonymous: Boolean(is_anonymous),
          amount: Number(amount) || 0,
          payment_method: source,
          payment_source: source,
          proof_image: proof_image || null
        }).catch(e => console.warn('[Donation Supabase sync error]:', e.message));
      }).catch(e => console.warn('[Donation Supabase camp find error]:', e.message));
    }

    res.status(201).json({
      success: true,
      id,
      invoiceNumber,
      amount: Number(amount),
      campaignTitle,
      paymentStatus: initialStatus,
      bankAccount: {
        bank: 'Bank Syariah Indonesia (BSI)',
        number: '7123 4567 89',
        holder: 'Yayasan Rumah Tahfidz'
      },
      message: canVerifyImmediately
        ? `Transaksi ${invoiceNumber} berhasil dicatat dan langsung terverifikasi.`
        : 'Transaksi donasi berhasil dicatat. Silakan lakukan transfer dan konfirmasi bukti setor.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/donations/:id/status', verifyRoleIfAuthenticated('superadmin', 'finance'), async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, notes, reference_number, payment_source } = req.body;

    if (!['pending', 'success', 'failed', 'expired', 'rejected', 'voided'].includes(payment_status)) {
      return res.status(400).json({ success: false, message: 'Status pembayaran tidak valid.' });
    }

    const actorName = req.user?.name || 'Admin Finance';

    // 1. Supabase Cloud Sync
    if (isSupabaseConfigured) {
      try {
        await updateSupabaseDonationStatus(id, {
          status: payment_status,
          notes,
          verified_by: actorName
        });
      } catch (supaErr) {
        console.warn('[PATCH /donations/:id/status] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    let currentDonation = null;
    try {
      currentDonation = db.prepare('SELECT * FROM donations WHERE id = ?').get(id);
      if (currentDonation) {
        const nowIso = new Date().toISOString();
        const paidAt = payment_status === 'success' ? (currentDonation.paid_at || nowIso.slice(0, 10)) : currentDonation.paid_at;

        db.prepare(`
          UPDATE donations
          SET payment_status = ?,
              notes = COALESCE(?, notes),
              reference_number = COALESCE(?, reference_number),
              payment_source = COALESCE(?, payment_source),
              verified_by = ?,
              verified_at = ?,
              paid_at = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(
          payment_status,
          notes ?? null,
          reference_number ?? null,
          payment_source ?? null,
          actorName,
          nowIso,
          paidAt,
          id
        );

        recalculateCampaignTotals(currentDonation.campaign_id);

        logFinancialAudit({
          transactionId: id,
          invoiceNumber: currentDonation.invoice_number,
          actionType: payment_status === 'success' ? 'VERIFIED' : (payment_status === 'voided' ? 'VOIDED' : 'REJECTED'),
          oldValues: {
            payment_status: currentDonation.payment_status,
            amount: currentDonation.amount,
            reference_number: currentDonation.reference_number
          },
          newValues: {
            payment_status,
            amount: currentDonation.amount,
            reference_number: reference_number || currentDonation.reference_number
          },
          reason: notes || (payment_status === 'success' ? 'Mutasi dana telah diverifikasi sesuai rekening bank' : 'Transaksi ditolak / tidak valid'),
          actorId: req.user?.id || 'usr-1',
          actorName
        });
      }
    } catch (sqliteErr) {
      console.warn('[PATCH /donations/:id/status] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName,
      actorRole: req.user?.role,
      module: 'donasi',
      action: payment_status === 'success' ? 'VERIFY_DONATION' : 'REJECT_DONATION',
      entityType: 'donation',
      entityId: id,
      summary: `Mengubah status verifikasi transaksi ${id} menjadi ${payment_status}`
    });

    res.json({ success: true, message: `Status pembayaran donasi berhasil diubah menjadi: ${payment_status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Financial Correction Endpoint with Mandatory Audit Trail (PRD Req #7)
api.patch('/donations/:id/correct', verifyRoleIfAuthenticated('superadmin', 'finance'), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, campaign_id, payment_source, reference_number, transaction_date, payment_status, reason } = req.body;

    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Alasan koreksi wajib diisi (minimal 5 karakter) untuk jejak audit keuangan.'
      });
    }

    const actorName = req.user?.name || 'Admin Finance';

    // 1. Supabase Cloud Sync
    if (isSupabaseConfigured) {
      try {
        await correctSupabaseDonation(id, {
          amount,
          notes: `[KOREKSI AUDIT]: ${reason.trim()}`,
          payment_status,
          reference_number,
          payment_source
        });
      } catch (supaErr) {
        console.warn('[PATCH /donations/:id/correct] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    try {
      const currentDonation = db.prepare('SELECT * FROM donations WHERE id = ?').get(id);
      if (currentDonation) {
        const newAmount = amount !== undefined ? Number(amount) : currentDonation.amount;
        if (newAmount > 0) {
          const newCampaignId = campaign_id !== undefined ? campaign_id : currentDonation.campaign_id;
          const camp = newCampaignId && newCampaignId !== 'general'
            ? db.prepare('SELECT title FROM campaigns WHERE id = ?').get(newCampaignId)
            : null;
          const newCampaignTitle = camp ? camp.title : (newCampaignId === 'general' ? 'Donasi Umum / Infaq Operasional RTM' : currentDonation.campaign_title);
          const newSource = payment_source || currentDonation.payment_source || currentDonation.payment_method;
          const newRef = reference_number !== undefined ? reference_number : currentDonation.reference_number;
          const newDate = transaction_date || currentDonation.transaction_date || currentDonation.paid_at;
          const newStatus = payment_status || currentDonation.payment_status;

          db.prepare(`
            UPDATE donations
            SET amount = ?,
                campaign_id = ?,
                campaign_title = ?,
                payment_method = ?,
                payment_source = ?,
                reference_number = ?,
                transaction_date = ?,
                payment_status = ?,
                notes = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(
            newAmount,
            newCampaignId,
            newCampaignTitle,
            newSource,
            newSource,
            newRef,
            newDate,
            newStatus,
            `[KOREKSI AUDIT]: ${reason.trim()}`,
            id
          );

          if (currentDonation.campaign_id) recalculateCampaignTotals(currentDonation.campaign_id);
          if (newCampaignId && newCampaignId !== currentDonation.campaign_id) recalculateCampaignTotals(newCampaignId);

          logFinancialAudit({
            transactionId: id,
            invoiceNumber: currentDonation.invoice_number,
            actionType: 'CORRECTED',
            oldValues: {
              amount: currentDonation.amount,
              campaign_id: currentDonation.campaign_id,
              campaign_title: currentDonation.campaign_title,
              payment_source: currentDonation.payment_source || currentDonation.payment_method,
              reference_number: currentDonation.reference_number,
              payment_status: currentDonation.payment_status
            },
            newValues: {
              amount: newAmount,
              campaign_id: newCampaignId,
              campaign_title: newCampaignTitle,
              payment_source: newSource,
              reference_number: newRef,
              payment_status: newStatus
            },
            reason: reason.trim(),
            actorId: req.user?.id || 'usr-1',
            actorName
          });
        }
      }
    } catch (sqliteErr) {
      console.warn('[PATCH /donations/:id/correct] SQLite skipped:', sqliteErr.message);
    }

    res.json({
      success: true,
      message: `Koreksi transaksi ${id} berhasil disimpan di Supabase Cloud dan Audit Log.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CSV Export Endpoint (PRD Section 5.2)
api.get('/donations/export', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT invoice_number, campaign_title, donor_name, donor_phone, donor_email,
             amount, payment_method, payment_source, reference_number, payment_status, created_at, paid_at
      FROM donations ORDER BY created_at DESC
    `).all();

    const header = ['No Invoice', 'Program Wakaf', 'Nama Donatur', 'WhatsApp', 'Email', 'Nominal (Rp)', 'Sumber Bayar', 'No Referensi', 'Status Transaksi', 'Tanggal Dibuat', 'Tanggal Lunas'];
    const csvLines = [header.join(',')];

    rows.forEach(r => {
      const line = [
        `"${r.invoice_number}"`,
        `"${(r.campaign_title || '').replace(/"/g, '""')}"`,
        `"${(r.donor_name || '').replace(/"/g, '""')}"`,
        `"${r.donor_phone || ''}"`,
        `"${r.donor_email || ''}"`,
        r.amount,
        `"${r.payment_source || r.payment_method}"`,
        `"${r.reference_number || '-'}"`,
        `"${r.payment_status}"`,
        `"${r.created_at}"`,
        `"${r.paid_at || '-'}"`
      ];
      csvLines.push(line.join(','));
    });

    const csvContent = csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rekap-donasi-rtm-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 10. USERS & RBAC MANAGEMENT (PRD Req #1 - Create, Edit, Activate, Deactivate)
// ============================================================================
api.get('/users', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try {
        const supaUsers = await getSupabaseUsers();
        if (supaUsers && supaUsers.length > 0) {
          return res.json({ success: true, data: supaUsers, source: 'supabase_cloud' });
        }
      } catch (err) {
        console.warn('[API /users] Supabase error, falling back to SQLite:', err.message);
      }
    }

    const users = db.prepare('SELECT id, name, email, role, role_title, avatar, COALESCE(is_active, 1) as is_active, last_login_at, created_at FROM users ORDER BY created_at ASC').all();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/users', verifyRoleIfAuthenticated('superadmin'), async (req, res) => {
  try {
    const { name, email, password, role, role_title, is_active } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi.' });
    }

    let createdUser = null;

    // 1. Save to Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        createdUser = await createSupabaseUser({
          name,
          email,
          password,
          role,
          role_title,
          is_active: is_active !== 0
        });
      } catch (supaErr) {
        if (supaErr.message?.includes('sudah terdaftar') || supaErr.status === 400) {
          return res.status(400).json({ success: false, message: supaErr.message });
        }
        console.warn('[POST /users] Supabase error:', supaErr.message);
      }
    }

    // 2. Safe SQLite backup sync (wrapped in try/catch for read-only serverless safety)
    const id = createdUser?.id || `user-${Date.now()}`;
    const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    try {
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
      if (!existing) {
        db.prepare(`
          INSERT INTO users (id, name, email, password_hash, role, role_title, avatar, is_active, last_login_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
        `).run(
          id,
          name,
          email,
          hashPassword(password),
          role,
          role_title || role,
          initials
        );
      }
    } catch (sqliteErr) {
      console.warn('[POST /users] SQLite write skipped (read-only):', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Super Admin',
      actorRole: req.user?.role,
      module: 'users',
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: id,
      summary: `Membuat akun pengguna baru: ${name} (${email}, role: ${role})`
    });

    res.status(201).json({
      success: true,
      id,
      user: createdUser,
      message: `Akun staf ${name} (${role}) berhasil dibuat di Supabase Cloud.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.delete('/users/:id', verifyRoleIfAuthenticated('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Delete from Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        await deleteSupabaseUser(id);
      } catch (supaErr) {
        if (supaErr.message?.includes('satu-satunya')) {
          return res.status(400).json({ success: false, message: supaErr.message });
        }
        console.warn('[DELETE /users/:id] Supabase error:', supaErr.message);
      }
    }

    // 2. Safe SQLite delete (wrapped for read-only serverless safety)
    try {
      const superadminCount = db.prepare("SELECT count(*) as c FROM users WHERE role = 'superadmin'").get().c;
      const target = db.prepare('SELECT name, role FROM users WHERE id = ?').get(id);

      if (target && target.role === 'superadmin' && superadminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Tidak dapat menghapus satu-satunya akun Super Admin!' });
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    } catch (sqliteErr) {
      console.warn('[DELETE /users/:id] SQLite skipped (read-only):', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Super Admin',
      actorRole: req.user?.role,
      module: 'users',
      action: 'DELETE_USER',
      entityType: 'user',
      entityId: id,
      summary: `Menghapus akun pengguna ${id}`
    });

    res.json({ success: true, message: 'Akun staf berhasil dihapus dari Supabase Cloud.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const actor = getAuthenticatedUser(req);

    const isSuperAdmin = !actor || actor.role === 'superadmin';
    const isSelf = actor && actor.id === id;

    if (!isSuperAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak (403 Forbidden): Anda hanya diperkenankan mengubah data profil akun Anda sendiri.'
      });
    }

    const { name, email, avatar, role, role_title, password, is_active } = req.body;
    let updatedUser = null;

    // 1. Update in Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        updatedUser = await updateSupabaseUser(id, {
          name,
          email,
          avatar,
          role: isSuperAdmin ? role : undefined,
          role_title: isSuperAdmin ? role_title : undefined,
          password,
          is_active: isSuperAdmin ? is_active : undefined
        });
      } catch (supaErr) {
        console.warn('[PATCH /users/:id] Supabase error:', supaErr.message);
      }
    }

    // 2. Safe local SQLite update (wrapped for read-only serverless safety)
    try {
      const updates = [];
      const params = [];
      if (name) { updates.push('name = ?'); params.push(name.trim()); }
      if (email) { updates.push('email = ?'); params.push(email.trim().toLowerCase()); }
      if (avatar) { updates.push('avatar = ?'); params.push(avatar.trim()); }
      if (role && isSuperAdmin) { updates.push('role = ?'); params.push(role); }
      if (role_title && isSuperAdmin) { updates.push('role_title = ?'); params.push(role_title); }
      if (is_active !== undefined && isSuperAdmin) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
      if (password && password.trim()) { updates.push('password_hash = ?'); params.push(hashPassword(password.trim())); }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        params.push(id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }
    } catch (sqliteErr) {
      console.warn('[PATCH /users/:id] SQLite write skipped (read-only):', sqliteErr.message);
    }

    logSystemAudit({
      actorId: actor?.id || id,
      actorName: actor?.name || updatedUser?.name || 'User',
      actorRole: actor?.role,
      module: 'users',
      action: 'UPDATE_USER',
      entityType: 'user',
      entityId: id,
      summary: `Memperbarui data akun staf ${name || id}`
    });

    res.json({
      success: true,
      message: 'Akun staf berhasil diperbarui di Supabase Cloud.',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/users/:id/status', verifyRoleIfAuthenticated('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    // 1. Update in Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        await toggleSupabaseUserStatus(id, activeVal);
      } catch (supaErr) {
        console.warn('[PATCH /users/:id/status] Supabase error:', supaErr.message);
      }
    }

    // 2. Safe SQLite update (wrapped for read-only serverless safety)
    try {
      db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(activeVal, id);
    } catch (sqliteErr) {
      console.warn('[PATCH /users/:id/status] SQLite skipped (read-only):', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Super Admin',
      actorRole: req.user?.role,
      module: 'users',
      action: activeVal ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entityType: 'user',
      entityId: id,
      summary: `${activeVal ? 'Mengaktifkan' : 'Menonaktifkan'} status akun pengguna ID ${id}`
    });

    res.json({
      success: true,
      isActive: activeVal === 1,
      message: `Status akun berhasil diubah menjadi ${activeVal ? 'Aktif' : 'Non-Aktif'} di Supabase Cloud.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 11. SITE SETTINGS & INSTITUTION IDENTITY (PRD Req #8 - Draft, Preview, Publish)
// ============================================================================
api.get('/settings', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      try {
        const supaProfile = await getSupabaseSiteSettings('institution_profile');
        if (supaProfile) {
          return res.json({
            success: true,
            data: { institution_profile: supaProfile },
            draftData: { institution_profile: supaProfile },
            source: 'supabase_cloud'
          });
        }
      } catch (err) {
        console.warn('[API /settings] Supabase error, falling back to SQLite:', err.message);
      }
    }

    const rows = db.prepare('SELECT * FROM site_settings').all();
    const settings = {};
    const draftSettings = {};
    rows.forEach(r => {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch {
        settings[r.key] = r.value;
      }
      try {
        draftSettings[r.key] = r.draft_value ? JSON.parse(r.draft_value) : settings[r.key];
      } catch {
        draftSettings[r.key] = r.draft_value || settings[r.key];
      }
    });
    res.json({ success: true, data: settings, draftData: draftSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.put('/settings', verifyRoleIfAuthenticated('superadmin'), async (req, res) => {
  try {
    const { mode = 'publish', ...updates } = req.body;

    // 1. Supabase Cloud Sync
    if (isSupabaseConfigured) {
      try {
        for (const [key, val] of Object.entries(updates)) {
          await updateSupabaseSiteSettings(key, val, mode);
        }
      } catch (supaErr) {
        console.warn('[PUT /settings] Supabase warning:', supaErr.message);
      }
    }

    // 2. Safe local SQLite write
    try {
      if (mode === 'draft') {
        const stmt = db.prepare(`
          INSERT INTO site_settings (key, value, draft_value, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET draft_value = excluded.draft_value, updated_at = datetime('now')
        `);
        Object.entries(updates).forEach(([key, val]) => {
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          stmt.run(key, str, str);
        });
      } else {
        const stmt = db.prepare(`
          INSERT INTO site_settings (key, value, draft_value, published_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            draft_value = excluded.draft_value,
            published_at = datetime('now'),
            updated_at = datetime('now')
        `);
        Object.entries(updates).forEach(([key, val]) => {
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          stmt.run(key, str, str);
        });
      }
    } catch (sqliteErr) {
      console.warn('[PUT /settings] SQLite skipped:', sqliteErr.message);
    }

    logSystemAudit({
      actorId: req.user?.id,
      actorName: req.user?.name || 'Super Admin',
      actorRole: req.user?.role,
      module: 'settings',
      action: mode === 'draft' ? 'SAVE_DRAFT' : 'PUBLISH_SETTINGS',
      entityType: 'site_settings',
      entityId: Object.keys(updates).join(','),
      summary: mode === 'draft'
        ? 'Menyimpan draft perubahan tampilan & identitas website untuk pratinjau'
        : 'Mempublikasikan perubahan identitas, tampilan, dan informasi website ke publik'
    });

    res.json({
      success: true,
      mode,
      message: mode === 'draft'
        ? 'Draft pengaturan situs berhasil disimpan di Supabase Cloud. Klik Pratinjau untuk melihat.'
        : 'Pengaturan situs dan profil lembaga berhasil disimpan dan dipublikasikan di Supabase Cloud.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 12. WAITLIST & LEAD CAPTURE (PRD Section 4.3 & LMS Modal)
// ============================================================================
api.post('/leads', (req, res) => {
  try {
    const { type, contact } = req.body;
    if (!contact) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp atau Email wajib diisi.' });
    }

    const id = `wl-${Date.now()}`;
    try {
      db.prepare('INSERT INTO leads_waitlist (id, type, contact) VALUES (?, ?, ?)')
        .run(id, type || 'lms_portal', contact);
    } catch (sqliteErr) {
      console.warn('[POST /leads] SQLite skipped:', sqliteErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Terima kasih! Kontak Anda telah terdaftar. Kami akan memberikan kabar rilis perdana kepada Anda.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Aliases for site-settings
api.get('/site-settings', (req, res, next) => {
  req.url = '/settings';
  api.handle(req, res, next);
});
api.put('/site-settings', verifyRoleIfAuthenticated('superadmin'), (req, res, next) => {
  req.url = '/settings';
  api.handle(req, res, next);
});

// Express app wrapper for Vite connect middleware & standalone server compatibility
export const apiApp = express();
apiApp.use((req, res, next) => {
  if (req.body !== undefined) return next();
  express.json({ limit: '50mb' })(req, res, (err) => {
    if (err) return next(err);
    if (req.body !== undefined) return next();
    express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
  });
});

// Strip /api prefix if present so router always matches /media, /programs, etc.
apiApp.use((req, res, next) => {
  if (req.url && req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  next();
});

apiApp.use(api);

// Fallback JSON 404 handler for unmatched API routes
apiApp.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Rute API tidak ditemukan: ${req.method} ${req.originalUrl || req.url}`
  });
});

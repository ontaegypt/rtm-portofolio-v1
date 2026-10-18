import express from 'express';
import crypto from 'node:crypto';
import { db, hashPassword, verifyPassword } from './db.js';

export const api = express.Router();
api.use(express.json());

// In-memory brute force tracker (PRD 5.1 A)
const failedAttemptsMap = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;

// Helper: UUID generator
function uuid() {
  return crypto.randomUUID();
}

// ============================================================================
// 1. HEALTH & ANALYTICS OVERVIEW (PRD Section 5)
// ============================================================================
api.get('/health', (req, res) => {
  try {
    const tableCounts = {
      users: db.prepare('SELECT count(*) as c FROM users').get().c,
      programs: db.prepare('SELECT count(*) as c FROM academic_programs').get().c,
      articles: db.prepare('SELECT count(*) as c FROM articles').get().c,
      donations: db.prepare('SELECT count(*) as c FROM donations').get().c,
      campaigns: db.prepare('SELECT count(*) as c FROM campaigns').get().c,
      galleries: db.prepare('SELECT count(*) as c FROM galleries').get().c,
      reservations: db.prepare('SELECT count(*) as c FROM visit_reservations').get().c,
      ppdbLeads: db.prepare('SELECT count(*) as c FROM ppdb_registrations').get().c,
    };
    res.json({
      status: 'ok',
      engine: 'SQLite (Node.js native DatabaseSync)',
      database: 'data/rtm.db',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      counts: tableCounts
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

api.get('/stats', (req, res) => {
  try {
    const totalLeads = db.prepare('SELECT count(*) as c FROM ppdb_registrations').get().c;
    const verifiedLeads = db.prepare("SELECT count(*) as c FROM ppdb_registrations WHERE status = 'verified' OR status = 'accepted'").get().c;
    
    const donationStats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END), 0) as totalCollected,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pendingCount,
        COUNT(CASE WHEN payment_status = 'success' THEN 1 END) as successCount,
        COUNT(*) as totalTransactions
      FROM donations
    `).get();

    const activePrograms = db.prepare('SELECT count(*) as c FROM academic_programs WHERE is_active = 1').get().c;
    const totalArticles = db.prepare("SELECT count(*) as c FROM articles WHERE status = 'published'").get().c;
    const pendingVisits = db.prepare("SELECT count(*) as c FROM visit_reservations WHERE status = 'pending'").get().c;
    const totalUsers = db.prepare('SELECT count(*) as c FROM users').get().c;

    // Recent 5 transactions
    const recentDonations = db.prepare(`
      SELECT id, invoice_number, donor_name, amount, payment_method, payment_status, created_at, campaign_title
      FROM donations ORDER BY created_at DESC LIMIT 5
    `).all();

    // Recent 5 PPDB leads
    const recentLeads = db.prepare(`
      SELECT id, full_name, phone_whatsapp, program_id, status, created_at
      FROM ppdb_registrations ORDER BY created_at DESC LIMIT 5
    `).all();

    res.json({
      success: true,
      data: {
        totalLeads,
        verifiedLeads,
        totalDonations: donationStats.totalCollected,
        pendingDonationsCount: donationStats.pendingCount,
        successDonationsCount: donationStats.successCount,
        activePrograms,
        totalArticles,
        pendingVisits,
        totalUsers,
        recentDonations,
        recentLeads
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 2. AUTHENTICATION & SESSION (PRD Section 5.1)
// ============================================================================
api.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan kata sandi wajib diisi.' });
  }

  // Check rate limiting / lockout
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

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    // Record failed attempt
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

  // Login successful
  failedAttemptsMap.delete(ip);
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);

  // Simple token format: base64 encoded session
  const token = Buffer.from(`${user.id}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`).toString('base64');

  res.json({
    success: true,
    message: `Selamat datang kembali, ${user.name}!`,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleTitle: user.role_title,
      avatar: user.avatar,
      lastLoginAt: user.last_login_at
    }
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
    const user = db.prepare('SELECT id, name, email, role, role_title, avatar, last_login_at FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Sesi tidak ditemukan atau kedaluwarsa.' });
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
        lastLoginAt: user.last_login_at
      }
    });
  } catch {
    res.status(401).json({ success: false, message: 'Format token tidak valid.' });
  }
});

// ============================================================================
// 3. ACADEMIC PROGRAMS & CURRICULUM (PRD Section 5.4 & 6 Branch 2)
// ============================================================================
api.get('/programs', (req, res) => {
  try {
    const programs = db.prepare('SELECT * FROM academic_programs ORDER BY category ASC, id ASC').all();
    const phases = db.prepare('SELECT * FROM curriculum_phases ORDER BY phase_number ASC').all();
    const batches = db.prepare('SELECT * FROM program_batches ORDER BY id ASC').all();

    // Map relations
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

      return {
        ...p,
        title: p.name,
        curriculumPhases: progPhases,
        batches: progBatches
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.get('/programs/:id', (req, res) => {
  try {
    const program = db.prepare('SELECT * FROM academic_programs WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program akademik tidak ditemukan.' });
    }

    const phases = db.prepare('SELECT * FROM curriculum_phases WHERE program_id = ? ORDER BY phase_number ASC').all(program.id);
    const batches = db.prepare('SELECT * FROM program_batches WHERE program_id = ?').all(program.id);

    res.json({
      success: true,
      data: {
        ...program,
        title: program.name,
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

api.put('/programs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, headline, description, duration_claim, target_participants, quota, investment_fee } = req.body;

    const stmt = db.prepare(`
      UPDATE academic_programs SET
        name = COALESCE(?, name),
        headline = COALESCE(?, headline),
        description = COALESCE(?, description),
        duration_claim = COALESCE(?, duration_claim),
        target_participants = COALESCE(?, target_participants),
        quota = COALESCE(?, quota),
        investment_fee = COALESCE(?, investment_fee)
      WHERE id = ?
    `);

    stmt.run(name, headline, description, duration_claim, target_participants, quota, investment_fee, id);
    res.json({ success: true, message: 'Program akademik berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/programs/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const prog = db.prepare('SELECT is_active FROM academic_programs WHERE id = ?').get(id);
    if (!prog) return res.status(404).json({ success: false, message: 'Program tidak ditemukan.' });

    const newStatus = prog.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE academic_programs SET is_active = ? WHERE id = ?').run(newStatus, id);
    res.json({ success: true, isActive: newStatus === 1, message: `Status program diperbarui: ${newStatus === 1 ? 'Dibuka' : 'Ditutup'}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 4. PPDB REGISTRATIONS & LEADS (PRD Section 5.4 & 6 Branch 2)
// ============================================================================
// 4. PPDB REGISTRATIONS & LEADS (PRD Section 4.2 & 6 Branch 2)
// ============================================================================
api.get('/ppdb/export', (req, res) => {
  try {
    const leads = db.prepare(`
      SELECT p.*, a.name as program_name 
      FROM ppdb_registrations p 
      LEFT JOIN academic_programs a ON p.program_id = a.id 
      ORDER BY p.created_at DESC
    `).all();

    let csv = '\uFEFFNo. Registrasi,Nama Lengkap,Jenis Kelamin,Tanggal Lahir,Program Pilihan,Batch / Gelombang,Nama Orang Tua/Wali,Nomor WhatsApp,Email,Sumber Informasi,Rencana Pembayaran,Status,Tanggal Pendaftaran,Catatan Admin\n';
    for (const l of leads) {
      const row = [
        `"${(l.id || '').replace(/"/g, '""')}"`,
        `"${(l.full_name || '').replace(/"/g, '""')}"`,
        `"${(l.gender || 'Laki-laki').replace(/"/g, '""')}"`,
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
        `"${(l.notes || '').replace(/"/g, '""')}"`
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

api.get('/ppdb', (req, res) => {
  try {
    const { status, program_id, search } = req.query;
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
    query += ' ORDER BY p.created_at DESC';

    const leads = db.prepare(query).all(...params);
    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.get('/ppdb/:id', (req, res) => {
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

    res.json({ success: true, data: lead });
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
      payment_method
    } = req.body;

    if (!full_name || !phone_whatsapp || !program_id) {
      return res.status(400).json({ success: false, message: 'Nama lengkap, nomor WhatsApp, dan pilihan program wajib diisi.' });
    }

    // Clean, readable official Registration ID: REG-2026-XXXX
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
    const stmt = db.prepare(`
      INSERT INTO ppdb_registrations (
        id, program_id, batch_id, full_name, email, phone_whatsapp,
        gender, birth_date, parent_name, info_source, motivation, payment_method, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `);

    stmt.run(
      id,
      program_id,
      batch_id || 'Gelombang 1 - TA 2026/2027',
      full_name.trim(),
      email ? email.trim() : '',
      phone_whatsapp.trim(),
      gender || 'Laki-laki',
      birth_date || '',
      parent_name ? parent_name.trim() : 'Orang Tua / Wali Santri',
      info_source || 'Website Resmi',
      motivation || 'Mencetak generasi penghafal Al-Qur\'an berakhlak mulia.',
      payment_method || 'Transfer Bank BSI'
    );

    const createdRecord = db.prepare(`
      SELECT p.*, a.name as program_name 
      FROM ppdb_registrations p 
      LEFT JOIN academic_programs a ON p.program_id = a.id 
      WHERE p.id = ?
    `).get(id);

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

api.patch('/ppdb/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const existing = db.prepare('SELECT * FROM ppdb_registrations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Data santri tidak ditemukan.' });
    }

    if (status && !['pending', 'verified', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    const newStatus = status || existing.status;
    const newNotes = notes !== undefined ? notes : existing.notes;

    db.prepare('UPDATE ppdb_registrations SET status = ?, notes = ? WHERE id = ?').run(newStatus, newNotes, id);

    const updated = db.prepare(`
      SELECT p.*, a.name as program_name 
      FROM ppdb_registrations p 
      LEFT JOIN academic_programs a ON p.program_id = a.id 
      WHERE p.id = ?
    `).get(id);

    res.json({
      success: true,
      message: `Status calon santri berhasil diperbarui menjadi: ${newStatus}`,
      data: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.delete('/ppdb/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM ppdb_registrations WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Data santri tidak ditemukan.' });
    }

    db.prepare('DELETE FROM ppdb_registrations WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Data pendaftaran santri berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 5. ARTICLES & CMS NEWS (PRD Section 5.6 & 6 Branch 3)
// ============================================================================
api.get('/articles', (req, res) => {
  try {
    const { category, search, status } = req.query;
    let query = 'SELECT * FROM articles WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY published_at DESC, created_at DESC';
    const articles = db.prepare(query).all(...params);
    res.json({ success: true, data: articles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.get('/articles/:idOrSlug', (req, res) => {
  try {
    const article = db.prepare('SELECT * FROM articles WHERE id = ? OR slug = ?').get(req.params.idOrSlug, req.params.idOrSlug);
    if (!article) return res.status(404).json({ success: false, message: 'Artikel tidak ditemukan.' });

    // Increment view count
    db.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').run(article.id);
    res.json({ success: true, data: { ...article, view_count: article.view_count + 1 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/articles', (req, res) => {
  try {
    const { title, category, excerpt, content, thumbnail_url, read_time, status } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Judul dan konten artikel wajib diisi.' });
    }

    const id = `art-${Date.now()}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    db.prepare(`
      INSERT INTO articles (
        id, author_id, author_name, title, slug, category,
        excerpt, content, thumbnail_url, read_time, view_count, status, published_at
      ) VALUES (?, 'user-1', 'Tim Media RTM', ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
    `).run(
      id,
      title,
      slug,
      category || 'Prestasi & Event',
      excerpt || '',
      content,
      thumbnail_url || '/assets/images/campus.jpg',
      read_time || '4 Menit',
      status || 'published'
    );

    res.status(201).json({ success: true, id, message: 'Artikel baru berhasil dipublikasikan.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.put('/articles/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, excerpt, content, thumbnail_url, status } = req.body;

    db.prepare(`
      UPDATE articles SET
        title = COALESCE(?, title),
        category = COALESCE(?, category),
        excerpt = COALESCE(?, excerpt),
        content = COALESCE(?, content),
        thumbnail_url = COALESCE(?, thumbnail_url),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(title, category, excerpt, content, thumbnail_url, status, id);

    res.json({ success: true, message: 'Artikel berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/articles/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const art = db.prepare('SELECT status FROM articles WHERE id = ?').get(id);
    if (!art) return res.status(404).json({ success: false, message: 'Artikel tidak ditemukan.' });

    const newStatus = art.status === 'published' ? 'draft' : 'published';
    db.prepare('UPDATE articles SET status = ? WHERE id = ?').run(newStatus, id);
    res.json({ success: true, status: newStatus, message: `Status artikel diubah menjadi: ${newStatus}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.delete('/articles/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Artikel berhasil dihapus dari sistem.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 6. GALLERIES & MEDIA (PRD Section 5.5 & 6 Branch 3)
// ============================================================================
api.get('/galleries', (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM galleries';
    const params = [];

    if (category && category !== 'all') {
      query += ' WHERE category = ?';
      params.push(category);
    }
    query += ' ORDER BY created_at DESC';

    const items = db.prepare(query).all(...params);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/galleries', (req, res) => {
  try {
    const { title, category, media_url, caption, date } = req.body;
    if (!title || !media_url) {
      return res.status(400).json({ success: false, message: 'Judul dan URL gambar/media wajib diisi.' });
    }

    const id = `gal-${Date.now()}`;
    db.prepare(`
      INSERT INTO galleries (id, title, category, media_type, media_url, caption, date)
      VALUES (?, ?, ?, 'photo', ?, ?, ?)
    `).run(
      id,
      title,
      category || 'gedung',
      media_url,
      caption || title,
      date || new Date().toISOString().slice(0, 10)
    );

    res.status(201).json({ success: true, id, message: 'Media dokumentasi berhasil ditambahkan ke galeri.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.delete('/galleries/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM galleries WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Foto dokumentasi berhasil dihapus.' });
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

    res.status(201).json({
      success: true,
      id,
      message: 'Permohonan reservasi tur kunjungan berhasil dikirim! Tim humas kami akan segera mengonfirmasi jadwal Anda.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/reservations/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    db.prepare('UPDATE visit_reservations SET status = ?, notes = COALESCE(?, notes) WHERE id = ?').run(status, notes, id);
    res.json({ success: true, message: `Status reservasi diperbarui: ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 8. CAMPAIGNS & WAKAF DONASI (PRD Section 5.2 & 6 Branch 4)
// ============================================================================
api.get('/campaigns', (req, res) => {
  try {
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

api.post('/campaigns', (req, res) => {
  try {
    const { title, category_name, target_amount, cover_image, description, end_date, is_urgent } = req.body;
    if (!title || !target_amount) {
      return res.status(400).json({ success: false, message: 'Judul program dan target dana wajib diisi.' });
    }

    const id = `camp-${Date.now()}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    db.prepare(`
      INSERT INTO campaigns (
        id, title, slug, type, category_name, target_amount, collected_amount,
        donor_count, cover_image, description, status, is_urgent, end_date
      ) VALUES (?, ?, ?, 'wakaf', ?, ?, 0, 0, ?, ?, 'active', ?, ?)
    `).run(
      id,
      title,
      slug,
      category_name || 'Wakaf Sarana',
      Number(target_amount),
      cover_image || '/assets/images/campus.jpg',
      description || '',
      is_urgent ? 1 : 0,
      end_date || '2026-12-31'
    );

    res.status(201).json({ success: true, id, message: 'Program penggalangan dana wakaf berhasil diterbitkan.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.put('/campaigns/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, category_name, target_amount, cover_image, description, status, is_urgent } = req.body;

    db.prepare(`
      UPDATE campaigns SET
        title = COALESCE(?, title),
        category_name = COALESCE(?, category_name),
        target_amount = COALESCE(?, target_amount),
        cover_image = COALESCE(?, cover_image),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        is_urgent = COALESCE(?, is_urgent)
      WHERE id = ?
    `).run(title, category_name, target_amount, cover_image, description, status, is_urgent, id);

    res.json({ success: true, message: 'Program wakaf berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 9. DONATIONS TRANSACTIONS & EXPORT (PRD Section 5.2 & 6 Branch 4)
// ============================================================================
api.get('/donations', (req, res) => {
  try {
    const { status, campaign_id } = req.query;
    let query = 'SELECT * FROM donations WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND payment_status = ?';
      params.push(status);
    }
    if (campaign_id) {
      query += ' AND campaign_id = ?';
      params.push(campaign_id);
    }
    query += ' ORDER BY created_at DESC';

    const donations = db.prepare(query).all(...params);
    res.json({ success: true, data: donations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/donations', (req, res) => {
  try {
    const { campaign_id, donor_name, donor_phone, donor_email, is_anonymous, amount, payment_method, notes } = req.body;

    if (!campaign_id || !donor_name || !amount) {
      return res.status(400).json({ success: false, message: 'Program, nama donatur, dan nominal wajib diisi.' });
    }

    const campaign = db.prepare('SELECT title FROM campaigns WHERE id = ?').get(campaign_id);
    const campaignTitle = campaign ? campaign.title : 'Wakaf & Donasi Rumah Tahfidz';

    const id = `don-${Date.now()}`;
    const invoiceNumber = `INV-RTM-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;

    db.prepare(`
      INSERT INTO donations (
        id, invoice_number, campaign_id, campaign_title, donor_name, donor_phone,
        donor_email, is_anonymous, amount, payment_method, payment_status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
    `).run(
      id,
      invoiceNumber,
      campaign_id,
      campaignTitle,
      donor_name,
      donor_phone || '',
      donor_email || '',
      is_anonymous ? 1 : 0,
      Number(amount),
      payment_method || 'Transfer Bank BSI',
      notes || ''
    );

    res.status(201).json({
      success: true,
      id,
      invoiceNumber,
      amount: Number(amount),
      campaignTitle,
      bankAccount: {
        bank: 'Bank Syariah Indonesia (BSI)',
        number: '7123 4567 89',
        holder: 'Yayasan Cahaya Hati Bening'
      },
      message: 'Transaksi donasi berhasil dicatat. Silakan lakukan transfer dan konfirmasi bukti setor.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.patch('/donations/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, notes } = req.body;

    if (!['pending', 'success', 'failed', 'expired'].includes(payment_status)) {
      return res.status(400).json({ success: false, message: 'Status pembayaran tidak valid.' });
    }

    const currentDonation = db.prepare('SELECT * FROM donations WHERE id = ?').get(id);
    if (!currentDonation) {
      return res.status(404).json({ success: false, message: 'Transaksi donasi tidak ditemukan.' });
    }

    // Update donation status
    const paidAt = payment_status === 'success' ? new Date().toISOString() : currentDonation.paid_at;
    db.prepare('UPDATE donations SET payment_status = ?, notes = COALESCE(?, notes), paid_at = ? WHERE id = ?')
      .run(payment_status, notes, paidAt, id);

    // If verified to success, atomically increment campaign total
    if (payment_status === 'success' && currentDonation.payment_status !== 'success') {
      db.prepare(`
        UPDATE campaigns 
        SET collected_amount = collected_amount + ?, donor_count = donor_count + 1
        WHERE id = ?
      `).run(currentDonation.amount, currentDonation.campaign_id);
    }

    res.json({ success: true, message: `Status pembayaran donasi berhasil diubah menjadi: ${payment_status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CSV Export Endpoint (PRD Section 5.2)
api.get('/donations/export', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT invoice_number, campaign_title, donor_name, donor_phone, donor_email,
             amount, payment_method, payment_status, created_at, paid_at
      FROM donations ORDER BY created_at DESC
    `).all();

    const header = ['No Invoice', 'Program Wakaf', 'Nama Donatur', 'WhatsApp', 'Email', 'Nominal (Rp)', 'Metode Bayar', 'Status Transaksi', 'Tanggal Dibuat', 'Tanggal Lunas'];
    const csvLines = [header.join(',')];

    rows.forEach(r => {
      const line = [
        `"${r.invoice_number}"`,
        `"${(r.campaign_title || '').replace(/"/g, '""')}"`,
        `"${(r.donor_name || '').replace(/"/g, '""')}"`,
        `"${r.donor_phone || ''}"`,
        `"${r.donor_email || ''}"`,
        r.amount,
        `"${r.payment_method}"`,
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
// 10. USERS & RBAC MANAGEMENT (PRD Section 5.1 & 6 Branch 1)
// ============================================================================
api.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, role, role_title, avatar, last_login_at, created_at FROM users ORDER BY created_at ASC').all();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.post('/users', (req, res) => {
  try {
    const { name, email, password, role, role_title } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar untuk pengguna lain.' });
    }

    const id = `user-${Date.now()}`;
    const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, role_title, avatar, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      name,
      email,
      hashPassword(password),
      role,
      role_title || role,
      initials
    );

    res.status(201).json({ success: true, id, message: `Akun staf ${name} (${role}) berhasil dibuat.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const superadminCount = db.prepare("SELECT count(*) as c FROM users WHERE role = 'superadmin'").get().c;
    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id);

    if (target && target.role === 'superadmin' && superadminCount <= 1) {
      return res.status(400).json({ success: false, message: 'Tidak dapat menghapus satu-satunya akun Super Admin!' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true, message: 'Akun staf berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 11. SITE SETTINGS & INSTITUTION IDENTITY (PRD Section 5.3 & 6 Branch 3)
// ============================================================================
api.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM site_settings').all();
    const settings = {};
    rows.forEach(r => {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch {
        settings[r.key] = r.value;
      }
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

api.put('/settings', (req, res) => {
  try {
    const updates = req.body; // e.g. { site_identity: {...}, institution_profile: {...} }
    const stmt = db.prepare(`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `);

    Object.entries(updates).forEach(([key, val]) => {
      stmt.run(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
    });

    res.json({ success: true, message: 'Pengaturan situs dan profil lembaga berhasil disimpan.' });
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
    db.prepare('INSERT INTO leads_waitlist (id, type, contact) VALUES (?, ?, ?)')
      .run(id, type || 'lms_portal', contact);

    res.status(201).json({
      success: true,
      message: 'Terima kasih! Kontak Anda telah terdaftar. Kami akan memberikan kabar rilis perdana kepada Anda.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Express app wrapper for Vite connect middleware compatibility
export const apiApp = express();
apiApp.use(api);


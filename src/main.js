
function initMotion() {
  if (typeof IntersectionObserver !== "undefined") {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

    document.querySelectorAll("[data-reveal], .shutter, section").forEach((el) => {
      io.observe(el);
    });
  }
}

import {
  INSTITUTION,
  PROGRAMS,
  GALLERIES,
  FACILITIES,
  LEADERSHIP,
  NEWS_ARTICLES,
  PPDB_FLOW,
  ADMIN_USERS,
  CAMPAIGNS,
  DONATION_TRANSACTIONS,
  VISIT_RESERVATIONS,
  PPDB_LEADS
} from './data.js';

import {
  authApi,
  statsApi,
  auditApi,
  mediaApi,
  programsApi,
  articlesApi,
  galleriesApi,
  reservationsApi,
  campaignsApi,
  donationsApi,
  ppdbApi,
  usersApi,
  settingsApi,
  leadsApi,
  client
} from './api-client.js';

// Application State
const state = {
  currentView: 'home',
  activeProgramId: 'smp',
  activeAboutTab: 'materi',
  galleryFilter: 'all',
  newsCategory: 'all',
  newsSearchQuery: '',
  currentLightboxIndex: 0,
  activeAdminModule: 'overview',
  overviewRange: 'all',
  activeDonationStatusFilter: 'all',
  donationCampaignFilter: 'all',
  donationSearchQuery: '',
  adminArticleSearchQuery: '',
  adminArticleCategoryFilter: 'all',
  adminArticleStatusFilter: 'all',
  adminGalleryCategoryFilter: 'all',
  adminGalleryStatusFilter: 'all',
  selectedReceiptTrx: null,
  mediaPickerCallback: null
};

// Mutable CMS Stores (Synchronized with Backend SQLite Database)
let campaignsState = JSON.parse(JSON.stringify(CAMPAIGNS));
let donationsState = JSON.parse(JSON.stringify(DONATION_TRANSACTIONS));
let ppdbState = JSON.parse(JSON.stringify(PPDB_LEADS));
let visitsState = JSON.parse(JSON.stringify(VISIT_RESERVATIONS));
let articlesState = JSON.parse(JSON.stringify(NEWS_ARTICLES));
let galleriesState = JSON.parse(JSON.stringify(GALLERIES));
let usersState = JSON.parse(JSON.stringify(ADMIN_USERS));
let programsState = PROGRAMS.map(p => ({ ...p, ppdbOpen: true, publicationStatus: 'published', formSchema: [] }));
let mediaState = [];
let financialAuditState = [];
let systemAuditState = [];
let settingsState = {};

// Normalizers for full database-to-UI compatibility
function normalizeDonation(d) {
  return {
    ...d,
    invoiceNumber: d.invoice_number || d.invoiceNumber || d.invoice,
    campaignId: d.campaign_id || d.campaignId || 'general',
    campaignTitle: d.campaign_title || d.campaignTitle || 'Infaq & Wakaf Umum Yayasan',
    donorName: d.donor_name || d.donorName,
    donorPhone: d.donor_phone || d.donorPhone || '',
    donorEmail: d.donor_email || d.donorEmail || '',
    paymentMethod: d.payment_method || d.paymentMethod || 'Transfer Bank BSI',
    paymentSource: d.payment_source || d.paymentSource || d.payment_method || 'Transfer Bank BSI',
    referenceNumber: d.reference_number || d.referenceNumber || '',
    paymentStatus: d.payment_status || d.paymentStatus || d.status || 'pending',
    receiptUrl: d.proof_image || d.receiptUrl || d.proofUrl || '',
    notes: d.notes || '',
    paidAt: d.paid_at || d.paidAt || '-'
  };
}

function normalizeLead(l) {
  let parsedAnswers = {};
  if (l.custom_answers) {
    try {
      parsedAnswers = typeof l.custom_answers === 'string' ? JSON.parse(l.custom_answers) : l.custom_answers;
    } catch {
      parsedAnswers = {};
    }
  } else if (l.customAnswers) {
    parsedAnswers = l.customAnswers;
  }
  return {
    ...l,
    id: l.id,
    studentName: l.full_name || l.studentName || l.name || 'Calon Santri',
    gender: l.gender || 'Laki-laki',
    birthDate: l.birth_date || l.birthDate || '',
    parentName: l.parent_name || l.parentName || 'Orang Tua / Wali',
    phone: l.phone_whatsapp || l.phone || '',
    email: l.email || '',
    programId: l.program_id || l.programId || 'smp',
    programName: l.program_name || l.programName || (PROGRAMS.find(p => p.id === (l.program_id || l.programId))?.name || 'Program Tahfidz'),
    batchId: l.batch_id || l.batchId || 'Gelombang 1 - TA 2026/2027',
    infoSource: l.info_source || l.infoSource || 'Website Resmi',
    motivation: l.motivation || '',
    paymentMethod: l.payment_method || l.paymentMethod || 'Transfer Bank BSI',
    customAnswers: parsedAnswers,
    statusHistory: l.status_history || l.statusHistory || [],
    status: l.status || 'pending',
    notes: l.notes || '',
    registeredAt: l.created_at || l.registeredAt || 'Baru Saja'
  };
}

function normalizeVisit(v) {
  return {
    ...v,
    groupName: v.institution || v.groupName || v.visitor_name,
    leaderName: v.visitor_name || v.leaderName || v.name,
    count: v.visitor_count || v.count || v.guests || 1,
    goal: v.objective || v.goal || v.purpose || 'Kunjungan',
    date: v.visit_date || v.date,
    session: v.session_time || v.session || 'Sesi 1'
  };
}

function normalizeCampaign(c) {
  return {
    ...c,
    targetAmount: c.target_amount !== undefined ? c.target_amount : c.targetAmount,
    collectedAmount: c.collected_amount !== undefined ? c.collected_amount : c.collectedAmount,
    donorCount: c.donor_count !== undefined ? c.donor_count : c.donorCount,
    category: c.category_name || c.category,
    image: c.cover_image || c.image,
    deadline: c.end_date || c.deadline
  };
}

function normalizeArticle(a) {
  let tagsArr = [];
  if (Array.isArray(a.tags)) {
    tagsArr = a.tags;
  } else if (typeof a.tags === 'string' && a.tags.trim()) {
    try {
      const parsed = JSON.parse(a.tags);
      tagsArr = Array.isArray(parsed) ? parsed : a.tags.split(',').map(t => t.trim()).filter(Boolean);
    } catch {
      tagsArr = a.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
  }
  return {
    ...a,
    slug: a.slug || a.id,
    image: a.thumbnail_url || a.image || a.thumbnail || '/assets/images/wisuda.jpg',
    readTime: a.read_time || a.readTime || '3 Menit',
    author: a.author_name || a.author || 'Humas Rumah Tahfidz',
    date: a.published_at || a.date || 'Baru Saja',
    tags: tagsArr,
    seoTitle: a.seo_title || a.seoTitle || '',
    seoDescription: a.seo_description || a.seoDescription || '',
    status: a.status || 'published'
  };
}

function normalizeGallery(g) {
  return {
    id: g.id,
    title: g.title,
    category: g.category || 'gedung',
    image: g.media_url || g.image || '/assets/images/campus.jpg',
    caption: g.caption || g.title,
    altText: g.alt_text || g.altText || g.title || '',
    albumName: g.album_name || g.albumName || '',
    sortOrder: g.sort_order !== undefined ? Number(g.sort_order) : (g.sortOrder || 0),
    status: g.status || 'published',
    date: g.date || 'Terbaru'
  };
}

function normalizeProgram(p) {
  const staticProg = PROGRAMS.find(sp => sp.id === p.id) || PROGRAMS[0];
  let parsedSchema = [];
  if (Array.isArray(p.form_schema)) {
    parsedSchema = p.form_schema;
  } else if (typeof p.form_schema === 'string' && p.form_schema.trim()) {
    try {
      parsedSchema = JSON.parse(p.form_schema);
    } catch {
      parsedSchema = [];
    }
  } else if (Array.isArray(p.formSchema)) {
    parsedSchema = p.formSchema;
  }

  let parsedStats = staticProg ? { ...staticProg.stats } : { durasi: '3 Tahun', targetHafalan: '30 Juz', rasioUstadz: '1 : 10', ijazah: 'Syahadah' };
  if (p.stats) {
    try {
      const sObj = typeof p.stats === 'string' ? JSON.parse(p.stats) : p.stats;
      parsedStats = { ...parsedStats, ...sObj };
    } catch {
      // ignore
    }
  }
  if (p.duration) parsedStats.durasi = p.duration;
  if (p.target_hafalan) parsedStats.targetHafalan = p.target_hafalan;

  return {
    ...(staticProg || {}),
    ...p,
    id: p.id,
    name: p.title || p.name || (staticProg ? staticProg.name : 'Program Tahfidz'),
    shortTitle: p.shortTitle || (staticProg ? staticProg.shortTitle : (p.title || p.name || 'Program')),
    headline: p.subtitle || p.headline || (staticProg ? staticProg.headline : ''),
    summary: p.description || p.summary || (staticProg ? staticProg.summary : ''),
    image: p.hero_image || p.image || (staticProg ? staticProg.image : '/assets/images/classroom.jpg'),
    stats: parsedStats,
    eligibilityCriteria: p.eligibility_criteria || p.eligibilityCriteria || (staticProg?.about?.target || ''),
    scheduleInfo: p.schedule_info || p.scheduleInfo || '',
    applicationInstructions: p.application_instructions || p.applicationInstructions || '',
    publicationStatus: p.publication_status || p.publicationStatus || 'published',
    ppdbOpen: p.is_active !== undefined ? p.is_active === 1 : (p.ppdbOpen !== false),
    formSchema: parsedSchema
  };
}

function normalizeUser(u) {
  const roleNameMap = {
    superadmin: 'Admin',
    editor: 'Content',
    finance: 'Finance'
  };
  return {
    ...u,
    isActive: u.is_active !== undefined ? u.is_active !== 0 : (u.isActive !== false),
    roleTitle: roleNameMap[u.role] || u.role_title || u.roleTitle || 'Admin',
    lastLogin: u.last_login_at || u.lastLogin || 'Baru Saja'
  };
}

// Synchronize all CMS stores with Backend SQLite Database
export async function syncDatabaseState() {
  try {
    const [progRes, artRes, galRes, campRes, donRes, visRes, leadRes, userRes, setRes] = await Promise.allSettled([
      programsApi.getAll(),
      articlesApi.getAll(),
      galleriesApi.getAll(),
      campaignsApi.getAll(),
      donationsApi.getAll(),
      reservationsApi.getAll(),
      ppdbApi.getAll(),
      usersApi.getAll(),
      settingsApi.get()
    ]);

    if (progRes.status === 'fulfilled' && progRes.value.data) {
      programsState = progRes.value.data.map(normalizeProgram);
    }
    if (artRes.status === 'fulfilled' && artRes.value.data) {
      articlesState = artRes.value.data.map(normalizeArticle);
    }
    if (galRes.status === 'fulfilled' && galRes.value.data) {
      galleriesState = galRes.value.data.map(normalizeGallery);
    }
    if (campRes.status === 'fulfilled' && campRes.value.data) {
      campaignsState = campRes.value.data.map(normalizeCampaign);
    }
    if (donRes.status === 'fulfilled' && donRes.value.data) {
      donationsState = donRes.value.data.map(normalizeDonation);
    }
    if (visRes.status === 'fulfilled' && visRes.value.data) {
      visitsState = visRes.value.data.map(normalizeVisit);
    }
    if (leadRes.status === 'fulfilled' && leadRes.value.data) {
      ppdbState = leadRes.value.data.map(normalizeLead);
    }
    if (userRes.status === 'fulfilled' && userRes.value.data) {
      usersState = userRes.value.data.map(normalizeUser);
    }
    if (setRes.status === 'fulfilled' && setRes.value.data) {
      settingsState = setRes.value.data;
      applySiteSettingsToDOM(settingsState.site_identity || settingsState);
    }
  } catch (err) {
    console.warn('[Sync] Falling back to initial cache:', err);
  }
}


// RBAC Role Definitions & Permission Maps (PRD Section 5.1 B - Istilah Disederhanakan)
const ROLES_CONFIG = {
  superadmin: {
    role: 'superadmin',
    name: 'Admin',
    badgeClass: 'superadmin',
    allowedModules: ['overview', 'akademik', 'donasi', 'galeri', 'berita', 'tampilan', 'users'],
    defaultModule: 'overview'
  },
  editor: {
    role: 'editor',
    name: 'Content',
    badgeClass: 'editor',
    allowedModules: ['berita', 'akademik', 'galeri'],
    defaultModule: 'berita'
  },
  finance: {
    role: 'finance',
    name: 'Finance',
    badgeClass: 'finance',
    allowedModules: ['donasi'],
    defaultModule: 'donasi'
  }
};

// Authentication & Session Guard Manager (PRD Section 5.1 A)
const auth = {
  getStoredUser() {
    try {
      const stored = localStorage.getItem('rtm_admin_user') || sessionStorage.getItem('rtm_admin_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
  setStoredUser(user, remember = false) {
    const json = JSON.stringify(user);
    if (remember) {
      localStorage.setItem('rtm_admin_user', json);
    } else {
      sessionStorage.setItem('rtm_admin_user', json);
    }
  },
  clearUser() {
    localStorage.removeItem('rtm_admin_user');
    sessionStorage.removeItem('rtm_admin_user');
  },
  getCallbackUrl() {
    return sessionStorage.getItem('rtm_callback_url');
  },
  setCallbackUrl(url) {
    sessionStorage.setItem('rtm_callback_url', url);
  },
  clearCallbackUrl() {
    sessionStorage.removeItem('rtm_callback_url');
  },
  // Brute-force & Rate-Limiting Simulation (PRD 5.1 A)
  failedAttempts: 0,
  lockoutEndTime: 0,
  recordFailedAttempt() {
    this.failedAttempts++;
    if (this.failedAttempts >= 5) {
      this.lockoutEndTime = Date.now() + 60 * 1000; // 60s lockout for testing
    }
  },
  isLocked() {
    if (this.lockoutEndTime && Date.now() < this.lockoutEndTime) {
      return true;
    }
    if (this.lockoutEndTime && Date.now() >= this.lockoutEndTime) {
      this.lockoutEndTime = 0;
      this.failedAttempts = 0;
    }
    return false;
  },
  getRemainingLockSeconds() {
    return Math.max(0, Math.ceil((this.lockoutEndTime - Date.now()) / 1000));
  }
};

// SVG Icon Helper
function getIconSvg(iconName, size = 18) {
  const icons = {
    'heart-handshake': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08v0c.82.82 2.13.85 3 .07l2.07-1.9"/><path d="m14 10 1.25 1.25a2.17 2.17 0 0 0 3.08 0v0a2.17 2.17 0 0 0 0-3.08l-2.5-2.5"/></svg>`,
    'log-in': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
    'graduation-cap': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    'award': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
    'book-open': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    'cpu': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
    'heart': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
    'check-circle': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    'globe': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    'book': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 2v20"/></svg>`,
    'trending-up': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    'shield-check': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>`,
    'gift': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,
    'users': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    'file-text': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    'smile': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    'star': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    'user': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    'clock': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    'headphones': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>`,
    'video': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect width="14" height="12" x="1" y="6" rx="2" ry="2"/></svg>`,
    'chevron-down': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    'chevron-right': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    'building': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>`,
    'home': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    'monitor': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    'target': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    'activity': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    'download': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    'copy': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    'share': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
    'search': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    'x': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  return icons[iconName] || icons['book-open'];
}

// Toast System
export function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span style="color: ${type === 'success' ? '#10B981' : '#F59E0B'}">${getIconSvg('check-circle', 20)}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Server-Side Authoritative Session & Role Lock (Otorisasi Dipatenkan)
let isVerifyingSession = false;
async function verifyAndSyncSession() {
  if (isVerifyingSession) return;
  const token = client.token;
  if (!token) return;

  isVerifyingSession = true;
  try {
    const res = await authApi.getMe();
    if (res && res.success && res.user) {
      const stored = auth.getStoredUser();
      // If local storage was manually tampered, enforce authoritative DB role
      if (!stored || stored.role !== res.user.role || stored.id !== res.user.id || stored.name !== res.user.name) {
        auth.setStoredUser(res.user, true);
        const roleConf = ROLES_CONFIG[res.user.role] || ROLES_CONFIG.superadmin;
        const currentHash = window.location.hash.slice(1);
        if (currentHash.startsWith('admin-')) {
          const mod = currentHash.replace('admin-', '');
          const SUBMODULE_PARENTS = {
            'article-form': 'berita',
            'user-form': 'users',
            'user-detail': 'users',
            'gallery-form': 'galeri',
            'syllabus-form': 'akademik',
            'program-form': 'akademik',
            'campaign-form': 'donasi',
            'profile': 'overview'
          };
          const checkMod = SUBMODULE_PARENTS[mod] || mod;
          if (mod !== 'profile' && !roleConf.allowedModules.includes(checkMod)) {
            showToast(`Akses Ditolak (403): Otorisasi akun Anda (${roleConf.name}) dipatenkan. Mengalihkan ke modul resmi.`, 'warning');
            window.location.hash = `#admin-${roleConf.defaultModule}`;
            return;
          }
        }
        if (state.currentView === 'admin' && state.activeAdminModule) {
          navigateToAdmin(state.activeAdminModule);
        }
      }
    }
  } catch (err) {
    console.warn('[Auth] Server session validation failed:', err.message);
    auth.clearUser();
    client.clearToken();
    showToast('Sesi masuk Anda telah kedaluwarsa. Silakan masuk kembali.', 'warning');
    window.location.hash = '#admin-login';
  } finally {
    isVerifyingSession = false;
  }
}

// Router and Navigation System (Sprint 1 + Sprint 2 Auth Guard)
function initRouter() {
  const handleHashChange = () => {
    const rawHash = window.location.hash.slice(1) || 'home';
    let view = rawHash;
    let programParam = null;

    // A. Route Guard for Admin Login (#admin-login)
    if (rawHash === 'admin-login') {
      const currentUser = auth.getStoredUser();
      if (currentUser && client.token) {
        const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;
        window.location.hash = `#admin-${roleConf.defaultModule}`;
        return;
      }
      navigateTo('admin-login');
      return;
    }

    // B. Route Guard for Backoffice Area (#admin, #admin-*) (PRD 5.1 A - Otorisasi Dipatenkan)
    if (rawHash === 'admin' || rawHash.startsWith('admin-')) {
      const currentUser = auth.getStoredUser();
      if (!currentUser || !client.token) {
        auth.setCallbackUrl(rawHash);
        showToast('Sesi masuk diperlukan untuk mengakses modul administratif.', 'warning');
        window.location.hash = '#admin-login';
        return;
      }

      // Synchronize and verify authoritative role from database
      verifyAndSyncSession();

      // User authenticated: extract target module
      let targetModule = rawHash === 'admin' ? null : rawHash.replace('admin-', '');
      const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;

      if (!targetModule || targetModule === 'admin') {
        targetModule = roleConf.defaultModule;
      }

      const SUBMODULE_PARENTS = {
        'article-form': 'berita',
        'user-form': 'users',
        'user-detail': 'users',
        'gallery-form': 'galeri',
        'syllabus-form': 'akademik',
        'program-form': 'akademik',
        'campaign-form': 'donasi',
        'profile': 'overview'
      };
      const checkModule = SUBMODULE_PARENTS[targetModule] || targetModule;

      // Check Role-Based Access Control (RBAC 403 Forbidden check)
      if (targetModule !== 'profile' && !roleConf.allowedModules.includes(checkModule)) {
        showToast(`Akses Ditolak (403): Role "${roleConf.name}" tidak berwenang mengelola modul ini. Hak akses dipatenkan.`, 'warning');
        window.location.hash = `#admin-${roleConf.defaultModule}`;
        return;
      }

      // Check Superadmin-only sub-pages
      if ((targetModule === 'user-form' || targetModule === 'user-detail' || targetModule === 'gallery-form') && currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        window.location.hash = `#admin-${roleConf.defaultModule}`;
        return;
      }

      // Render Admin Module
      navigateToAdmin(targetModule);
      return;
    }

    // C. Public Academic Program Deep Link (#akademik-smp, etc.)
    if (rawHash.startsWith('akademik')) {
      view = 'akademik';
      const parts = rawHash.split('-');
      if (parts.length > 1) {
        programParam = parts.slice(1).join('-');
      }
    }

    navigateTo(view, programParam);
  };

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

export function navigateTo(viewName, programId = null) {
  state.currentView = viewName;
  if (programId && programsState.some(p => p.id === programId)) {
    state.activeProgramId = programId;
  }

  // Toggle Body Mode Classes
  if (viewName === 'admin-login') {
    document.body.classList.add('auth-mode');
    document.body.classList.remove('admin-mode');
  } else {
    document.body.classList.remove('auth-mode');
    document.body.classList.remove('admin-mode');
  }

  // Update Page Views Visibility
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Update Public Nav Links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-view') === viewName) {
      link.classList.add('active');
    }
  });

  // Re-render sub-views if needed
  if (viewName === 'akademik') {
    renderAkademikView();
  } else if (viewName === 'news') {
    renderNewsGrid();
  }

  // Scroll to Top Smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Close Mobile Drawer
  const drawer = document.getElementById('mobileDrawer');
  if (drawer) drawer.classList.remove('open');
}

export function navigateToAdmin(moduleName) {
  state.currentView = 'admin';
  state.activeAdminModule = moduleName;

  const currentUser = auth.getStoredUser() || usersState[0];
  const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;

  // Set Body Classes
  document.body.classList.add('admin-mode');
  document.body.classList.remove('auth-mode');

  // Activate Admin View Wrapper
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });
  const adminView = document.getElementById('view-admin');
  if (adminView) adminView.classList.add('active');

  // Switch Admin Panels
  document.querySelectorAll('.admin-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const targetPanel = document.getElementById(`admin-panel-${moduleName}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Submodule to parent mapping
  const SUBMODULE_PARENTS = {
    'article-form': 'berita',
    'user-form': 'users',
    'user-detail': 'users',
    'gallery-form': 'galeri',
    'syllabus-form': 'akademik',
    'program-form': 'akademik',
    'campaign-form': 'donasi',
    'profile': 'overview'
  };
  const activeNavModule = SUBMODULE_PARENTS[moduleName] || moduleName;

  // Update Breadcrumb Text
  const breadcrumbTitles = {
    overview: 'Ringkasan / Analytics',
    akademik: 'Kelola Akademik & PPDB',
    donasi: 'Modul Wakaf & Donasi',
    galeri: 'Kelola Galeri & Kunjungan',
    berita: 'Kelola Artikel / Berita',
    tampilan: 'Kelola Tampilan & Identitas',
    users: 'Manajemen Pengguna & RBAC',
    'article-form': 'Kelola Artikel / Berita > Editor Form',
    'user-form': 'Manajemen Pengguna > Form Pengguna',
    'user-detail': 'Manajemen Pengguna > Detail Informasi Akun',
    'gallery-form': 'Kelola Galeri > Form Media Dokumentasi',
    'syllabus-form': 'Kelola Akademik > Unggah Silabus',
    'program-form': 'Kelola Akademik > Editor Program & Skema PPDB',
    'campaign-form': 'Modul Wakaf & Donasi > Form Program Campaign',
    'profile': 'Pengaturan Akun > Ubah Data Profil'
  };
  const breadcrumbEl = document.getElementById('topbarBreadcrumbActive');
  if (breadcrumbEl) {
    breadcrumbEl.textContent = breadcrumbTitles[moduleName] || 'Dashboard Admin';
  }

  // Update Sidebar Navigation & Mobile App Bottom Nav Links
  document.querySelectorAll('.sidebar-menu-link, .mob-nav-item').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-admin-nav') === activeNavModule) {
      link.classList.add('active');
    }
  });

  // Apply RBAC Lock styling to sidebar items
  document.querySelectorAll('.sidebar-menu-item').forEach(item => {
    const mod = item.getAttribute('data-module');
    if (mod && !roleConf.allowedModules.includes(mod)) {
      item.classList.add('restricted-role');
      item.title = `Terkunci: Role ${roleConf.name} tidak memiliki akses ke menu ini`;
    } else {
      item.classList.remove('restricted-role');
      item.removeAttribute('title');
    }
  });

  // Update Sidebar & Topbar User Display
  const sidebarAvatar = document.getElementById('sidebarUserAvatar');
  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarRole = document.getElementById('sidebarUserRole');
  const topbarAvatar = document.getElementById('topbarAvatar');
  const topbarName = document.getElementById('topbarUserName');
  const topbarRole = document.getElementById('topbarUserRole');
  const topbarRoleBadge = document.getElementById('topbarUserRoleBadge');

  if (sidebarAvatar) sidebarAvatar.textContent = currentUser.avatar || 'AD';
  if (sidebarName) sidebarName.textContent = currentUser.name;
  if (sidebarRole) {
    sidebarRole.textContent = roleConf.name;
    sidebarRole.className = `user-role-badge ${roleConf.badgeClass}`;
  }

  const welcomeUserName = document.getElementById('welcomeUserName');
  if (welcomeUserName) {
    welcomeUserName.textContent = currentUser.name;
  }

  if (topbarAvatar) topbarAvatar.textContent = currentUser.avatar || 'AD';
  if (topbarName) topbarName.textContent = currentUser.name;
  if (topbarRole) topbarRole.textContent = roleConf.name;
  if (topbarRoleBadge) {
    topbarRoleBadge.textContent = roleConf.name;
    topbarRoleBadge.className = `user-role-badge ${roleConf.badgeClass}`;
  }

  // Sidebar alert badges removed per user request for clean 1-line menu typography
  const pendingBadge = document.getElementById('sidebarPendingDonationBadge');
  if (pendingBadge) pendingBadge.style.display = 'none';
  const visitBadge = document.getElementById('sidebarVisitCount');
  if (visitBadge) visitBadge.style.display = 'none';

  // Update Topbar Notification Bell
  updateNotificationBell();

  // Render Module Content
  if (moduleName === 'overview') renderAdminOverview();
  if (moduleName === 'akademik') renderAdminAkademik();
  if (moduleName === 'donasi') renderAdminDonasi();
  if (moduleName === 'galeri') renderAdminGaleri();
  if (moduleName === 'berita') renderAdminBerita();
  if (moduleName === 'tampilan') renderAdminTampilan();
  if (moduleName === 'users') renderAdminUsers();
  if (moduleName === 'user-detail') renderUserDetailPage();
  if (moduleName === 'profile') renderAdminProfile();

  // Scroll to top of content area and window
  const contentArea = document.getElementById('adminContentArea');
  if (contentArea) contentArea.scrollTo({ top: 0, behavior: 'smooth' });
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Close Mobile Sidebar
  const sidebar = document.getElementById('adminSidebar');
  if (sidebar) sidebar.classList.remove('open');
}


// Render Academic Program Detail View (10 Blocks)
function renderAkademikView() {
  const container = document.getElementById('akademikProgramContent');
  if (!container) return;

  const program = PROGRAMS.find(p => p.id === state.activeProgramId) || PROGRAMS[0];

  // Render Top Selector Buttons
  const selectorContainer = document.getElementById('academicProgramSelector');
  if (selectorContainer) {
    selectorContainer.innerHTML = PROGRAMS.map(p => `
      <button class="program-tab-btn ${p.id === program.id ? 'active' : ''}" data-program-id="${p.id}">
        ${p.category === 'formal' ? '🏛️' : '📖'} ${p.shortTitle}
      </button>
    `).join('');

    selectorContainer.querySelectorAll('.program-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-program-id');
        state.activeProgramId = id;
        state.activeAboutTab = 'materi';
        window.location.hash = `akademik-${id}`;
        renderAkademikView();
      });
    });
  }

  // Render 10 Comprehensive Blocks
  container.innerHTML = `
    <!-- BLOCK 1: Hero & Stats Counter Bar -->
    <section class="prog-hero-block">
      <div class="container">
        <div class="prog-hero-grid">
          <div>
            <div class="prog-badge-tag">
              <span>${program.category === 'formal' ? 'Pendidikan Formal Terpadu' : 'Pendidikan Non-Formal'}</span>
              <span>•</span>
              <span>${program.badge}</span>
            </div>
            <h2 class="prog-hero-title">${program.name}</h2>
            <p class="prog-claim-text">${program.headline}</p>
            <p class="prog-summary-text">${program.summary}</p>
            
            <div class="prog-stats-counter-bar">
              <div class="prog-counter-item">
                <span class="prog-counter-label">Durasi Program</span>
                <span class="prog-counter-val">${program.stats.durasi}</span>
              </div>
              <div class="prog-counter-item">
                <span class="prog-counter-label">Target Hafalan</span>
                <span class="prog-counter-val">${program.stats.targetHafalan}</span>
              </div>
              <div class="prog-counter-item">
                <span class="prog-counter-label">Rasio Asatidz</span>
                <span class="prog-counter-val">${program.stats.rasioUstadz}</span>
              </div>
              <div class="prog-counter-item">
                <span class="prog-counter-label">Kelulusan & Ijazah</span>
                <span class="prog-counter-val">${program.stats.ijazah}</span>
              </div>
            </div>

            <div class="prog-hero-buttons">
              <a href="#enrollmentFormSection" class="btn btn-primary" onclick="document.getElementById('enrollmentFormSection').scrollIntoView({behavior: 'smooth'})">
                Daftar Program Ini Sekarang
              </a>
              <button class="btn btn-secondary" id="btnDownloadSilabus">
                <span class="btn-icon-leading">${getIconSvg('download', 18)}</span>
                Download PDF Silabus
              </button>
            </div>
          </div>

          <div class="prog-hero-visual">
            <img src="${program.image}" alt="${program.name}" loading="lazy" />
          </div>
        </div>
      </div>
    </section>

    <!-- BLOCK 2: Tentang Program (Segmented Tabs) -->
    <section class="prog-about-block">
      <div class="container">
        <div class="section-header">
          <h3 class="section-title">Tentang Program ${program.shortTitle}</h3>
          <p class="section-description">Pelajari rincian materi esensial, profil peserta, hingga pendekatan belajar yang diterapkan.</p>
        </div>

        <div class="segmented-control-nav" id="aboutSegmentedNav">
          <button class="seg-tab-btn ${state.activeAboutTab === 'materi' ? 'active' : ''}" data-tab="materi">Apa yang Dipelajari</button>
          <button class="seg-tab-btn ${state.activeAboutTab === 'target' ? 'active' : ''}" data-tab="target">Target Peserta</button>
          <button class="seg-tab-btn ${state.activeAboutTab === 'metode' ? 'active' : ''}" data-tab="metode">Metode Belajar</button>
          <button class="seg-tab-btn ${state.activeAboutTab === 'biaya' ? 'active' : ''}" data-tab="biaya">Gambaran Biaya</button>
        </div>

        <div class="seg-tab-content-box" id="aboutTabContent">
          ${renderAboutTabContent(program)}
        </div>
      </div>
    </section>

    <!-- BLOCK 3: Kenapa Belajar Al-Qur'an (Problem & Solution Cards) -->
    <section class="prog-why-block">
      <div class="container">
        <div class="section-header">
          <h3 class="section-title">Tantangan Zaman & Solusi Al-Qur'an</h3>
          <p class="section-description">Menjawab kegelisahan wali santri dalam mencetak generasi tangguh di era serba cepat.</p>
        </div>

        <div class="problem-solution-grid">
          <div class="ps-column problems">
            <div class="ps-header">
              <span style="font-weight: 700; color: var(--primary-purple);">[!]</span>
              <span>Tantangan Umum yang Dihadapi:</span>
            </div>
            ${program.whyQuran.problems.map(prob => `
              <div class="ps-item">
                <span style="font-weight: 700; color: #dc2626;">x</span>
                <span>${prob}</span>
              </div>
            `).join('')}
          </div>

          <div class="ps-column solutions">
            <div class="ps-header">
              <span style="font-weight: 700; color: #059669;">OK</span>
              <span>Solusi Rumah Tahfidz Al-Hikmah:</span>
            </div>
            ${program.whyQuran.solutions.map(sol => `
              <div class="ps-item">
                <span style="font-weight: 700; color: #059669;">OK</span>
                <span>${sol}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- BLOCK 4: Keunggulan Belajar Al-Qur'an di Al-Hikmah (4 Pilar) -->
    <section class="prog-pillars-block">
      <div class="container">
        <div class="section-header">
          <h3 class="section-title">Mengapa Memilih Program Ini?</h3>
          <p class="section-description">Standar mutu pengajaran tinggi dengan sanad keilmuan yang dapat dipertanggungjawabkan.</p>
        </div>

        <div class="four-pillars-grid">
          ${program.pillars.map(pillar => `
            <div class="feature-pillar-box">
              <div class="pillar-icon-box">${getIconSvg(pillar.icon, 24)}</div>
              <h4 class="pillar-title">${pillar.title}</h4>
              <p class="pillar-desc">${pillar.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- BLOCK 5: Runtutan Fase Pembelajaran (Kurikulum Silabus) -->
    <section class="prog-curriculum-block">
      <div class="container">
        <div class="section-header">
          <h3 class="section-title">Runtutan Fase Pembelajaran</h3>
          <p class="section-description">Tahapan kurikulum sistematis dari penguatan tajwid, ziyadah, hingga tasmi' kelulusan.</p>
        </div>

        <div class="curriculum-timeline">
          ${program.curriculumPhases.map((phase, idx) => `
            <div class="curriculum-phase-accordion ${idx === 0 ? 'open' : ''}" data-phase="${phase.phase}">
              <button class="phase-header-btn">
                <div class="phase-header-left">
                  <span class="phase-badge-num">0${phase.phase}</span>
                  <div>
                    <h4 class="phase-title-text">${phase.title}</h4>
                    <p class="phase-desc-sub">${phase.desc}</p>
                  </div>
                </div>
                <span class="phase-chevron">${getIconSvg('chevron-down', 22)}</span>
              </button>
              <div class="phase-body-content">
                <ul class="phase-topics-list">
                  ${phase.topics.map(t => `
                    <li>
                      <span style="color: var(--mint-500)">${getIconSvg('check-circle', 16)}</span>
                      <span>${t}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="pdf-download-action-bar">
          <button class="btn btn-secondary" id="btnDownloadSilabus2">
            <span class="btn-icon-leading">${getIconSvg('download', 18)}</span>
            Unduh Silabus Lengkap Program ${program.shortTitle} (PDF)
          </button>
        </div>
      </div>
    </section>

    <!-- BLOCK 6: Lokasi, Jadwal, dan Biaya Transparan -->
    <section class="prog-schedule-fee-block">
      <div class="container">
        <div class="section-header">
          <h3 class="section-title">Jadwal Batch & Rincian Biaya</h3>
          <p class="section-description">Informasi transparan kuota pendaftaran aktif dan fasilitas yang diperoleh peserta.</p>
        </div>

        <div class="schedule-pricing-grid">
          <div class="batch-cards-container">
            <h4 style="font-size: 1.3rem; margin-bottom: 0.5rem; color: var(--primary-950);">Pilihan Gelombang / Batch:</h4>
            ${program.batches.map(batch => `
              <div class="batch-schedule-card">
                <div class="batch-header">
                  <span class="batch-name-title">${batch.name}</span>
                  <span class="batch-remaining-tag">${batch.remaining}</span>
                </div>
                <div style="font-size: 0.88rem; color: var(--text-muted);">
                  <p><strong>Periode Pendaftaran:</strong> ${batch.period}</p>
                  <p><strong>Kapasitas Kuota:</strong> ${batch.quota}</p>
                  <p><strong>Jadwal Seleksi:</strong> ${batch.dates}</p>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="pricing-table-card">
            <div class="pricing-header">
              <span class="badge-tag-pill" style="background: rgba(255,255,255,0.15); color: #fff;">Investasi Pendidikan</span>
              <h4 style="margin-top: 0.75rem;">SPP / Iuran Program</h4>
            </div>
            <div>
              <div class="pricing-amount-hero">${program.pricing.monthlyFee}</div>
              <p class="pricing-amount-sub">Biaya Pendaftaran Formulir: ${program.pricing.registrationFee}</p>
              <p class="pricing-amount-sub">Uang Pangkal / Fasilitas Awal: ${program.pricing.uangPangkal}</p>
            </div>
            <div>
              <p style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.75rem; color: var(--accent-gold-300);">Fasilitas yang Termasuk:</p>
              <ul class="pricing-features-list">
                ${program.pricing.facilitiesIncluded.map(item => `
                  <li>
                    <span style="color: var(--mint-400)">${getIconSvg('check-circle', 16)}</span>
                    <span>${item}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- BLOCK 7: Alur Pendaftaran (Visual Stepper 4 Langkah) -->
    <section class="prog-stepper-block">
      <div class="container">
        <div class="section-header">
          <h3 class="section-title">4 Langkah Mudah Pendaftaran</h3>
          <p class="section-description">Panduan alur administrasi dari registrasi hingga mulai aktif belajar.</p>
        </div>

        <div class="stepper-horizontal">
          <div class="stepper-node">
            <div class="stepper-icon-circle">1</div>
            <h5 class="step-card-title">Isi Formulir Online</h5>
            <p class="step-card-desc">Lengkapi formulir pendaftaran langsung di bawah ini dengan data diri valid.</p>
          </div>
          <div class="stepper-node">
            <div class="stepper-icon-circle">2</div>
            <h5 class="step-card-title">Verifikasi & Tes Lisan</h5>
            <p class="step-card-desc">Konfirmasi jadwal tes baca Al-Qur'an / wawancara bersama asatidz penguji.</p>
          </div>
          <div class="stepper-node">
            <div class="stepper-icon-circle">3</div>
            <h5 class="step-card-title">Konfirmasi Kelulusan</h5>
            <p class="step-card-desc">Menerima surat keputusan penerimaan santri dan penyelesaian daftar ulang.</p>
          </div>
          <div class="stepper-node">
            <div class="stepper-icon-circle">4</div>
            <h5 class="step-card-title">Mulai Belajar & Talaqqi</h5>
            <p class="step-card-desc">Orientasi santri baru dan memulai langkah mulia menghafal Al-Qur'an.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- BLOCK 8: Testimoni Santri & Wali Program -->
    <section class="prog-testimonials-block">
      <div class="container">
        <div class="section-header">
          <h3 class="section-title">Kata Mereka Tentang ${program.shortTitle}</h3>
          <p class="section-description">Kesan dan transformasi nyata santri serta wali murid yang telah bergabung.</p>
        </div>

        <div class="testimonials-grid">
          ${program.testimonials.map(t => `
            <div class="testimonial-card">
              <span class="rating-stars" aria-label="Rating 5.0"><svg width="14" height="14" viewBox="0 0 24 24" fill="#811ce5" style="display:inline; vertical-align:-2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> 5.0 (Wali Santri)</span>
              <p class="testimonial-text">"${t.quote}"</p>
              <div class="testimonial-author">
                <div class="author-avatar">${t.avatar}</div>
                <div>
                  <div class="author-info-name">${t.name}</div>
                  <div class="author-info-role">${t.role}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- BLOCK 9: Formulir Pendaftaran Langsung (Direct Enrollment Form) -->
    <section class="prog-enrollment-block" id="enrollmentFormSection">
      <div class="container">
        <div class="enrollment-form-container">
          <div class="section-header" style="margin-bottom: 2.5rem;">
            <h3 class="section-title">Daftar Program: ${program.name}</h3>
            <p class="section-description">Silakan isi formulir resmi di bawah ini. Tim panitia PPDB akan segera menghubungi Anda via WhatsApp.</p>
          </div>

          <form id="directEnrollmentForm">
            <input type="hidden" name="programId" value="${program.id}" />
            <input type="hidden" name="programName" value="${program.name}" />

            <div class="form-grid-2col">
              <div class="form-group">
                <label class="form-label">Pilihan Gelombang / Batch Pendaftaran *</label>
                <select name="batchId" class="form-select" required>
                  ${program.batches && program.batches.length ? program.batches.map(b => `
                    <option value="${b.name}">${b.name} (${b.remaining})</option>
                  `).join('') : '<option value="Gelombang 1 - TA 2026/2027">Gelombang 1 - TA 2026/2027</option>'}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Nama Lengkap Calon Santri / Peserta *</label>
                <input type="text" name="fullName" class="form-input" placeholder="Contoh: Muhammad Azzam Fatih" required />
              </div>

              <div class="form-group">
                <label class="form-label">Jenis Kelamin *</label>
                <select name="gender" class="form-select" required>
                  <option value="Laki-laki">Laki-laki (Ikhwan)</option>
                  <option value="Perempuan">Perempuan (Akhwat)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Tanggal Lahir Santri *</label>
                <input type="date" name="birthDate" class="form-input" required />
              </div>

              <div class="form-group">
                <label class="form-label">Nama Lengkap Orang Tua / Wali *</label>
                <input type="text" name="parentName" class="form-input" placeholder="Contoh: H. Joko Purnomo" required />
              </div>

              <div class="form-group">
                <label class="form-label">Nomor Handphone / WhatsApp Aktif Wali *</label>
                <input type="tel" name="phone" class="form-input" placeholder="Contoh: 081234567890" required />
              </div>

              <div class="form-group">
                <label class="form-label">Alamat Email Aktif *</label>
                <input type="email" name="email" class="form-input" placeholder="nama@email.com" required />
              </div>

              <div class="form-group">
                <label class="form-label">Sumber Informasi Pendaftaran *</label>
                <select name="infoSource" class="form-select" required>
                  <option value="Website">Pencarian Website / Google</option>
                  <option value="Instagram">Instagram Resmi</option>
                  <option value="Rekomendasi">Rekomendasi Keluarga / Teman</option>
                  <option value="Brosur / Banner">Brosur / Spanduk</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div class="form-group full-width">
                <label class="form-label">Motivasi Mengikuti Program & Target Hafalan *</label>
                <textarea name="motivation" class="form-textarea" rows="3" placeholder="Ceritakan motivasi calon santri/peserta dalam menghafal Al-Qur'an..." required></textarea>
              </div>

              <div class="form-group full-width">
                <label class="form-label">Pilihan Rencana Metode Pembayaran Biaya *</label>
                <div class="payment-method-selector">
                  <label class="payment-radio-label">
                    <input type="radio" name="paymentMethod" value="Transfer Bank BSI" checked />
                    <span>Transfer Bank (BSI Syariah)</span>
                  </label>
                  <label class="payment-radio-label">
                    <input type="radio" name="paymentMethod" value="Virtual Account" />
                    <span>Virtual Account Otomatis</span>
                  </label>
                  <label class="payment-radio-label">
                    <input type="radio" name="paymentMethod" value="Cicilan Syariah Bertahap" />
                    <span>Opsi Angsuran Bertahap</span>
                  </label>
                </div>
              </div>
            </div>

            <div style="margin-top: 2rem; text-align: center;">
              <button type="submit" class="btn btn-primary" style="padding: 1rem 3rem; font-size: 1.05rem;">
                Kirim Pendaftaran Santri Baru
              </button>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.75rem;">
                Data privasi Anda terlindungi aman sesuai standar kepesantrenan Al-Hikmah.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>

    <!-- BLOCK 10: FAQ (Frequently Asked Questions) Accordion -->
    <section class="prog-faq-block">
      <div class="container">
        <div class="section-header">
          <h3 class="section-title">Pertanyaan yang Sering Diajukan</h3>
          <p class="section-description">Informasi lebih lanjut seputar teknis kurikulum, visitasi asrama, dan perizinan.</p>
        </div>

        <div class="faq-list">
          ${program.faqs.map(faq => `
            <div class="faq-item">
              <button class="faq-question-btn">
                <span>${faq.q}</span>
                <span class="faq-chevron">${getIconSvg('chevron-down', 20)}</span>
              </button>
              <div class="faq-answer-box">
                <p>${faq.a}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;

  // Attach Event Listeners to Accordions and Segmented Tabs
  initAkademikInteractions(program);
}

function renderAboutTabContent(program) {
  if (state.activeAboutTab === 'materi') {
    return `
      <h4 style="font-size: 1.25rem; color: var(--primary-950); margin-bottom: 1.25rem;">Kurikulum Inti & Materi Pembelajaran:</h4>
      <div class="seg-list-grid">
        ${program.about.materi.map(m => `
          <div class="seg-list-item">
            <span class="seg-item-bullet">✓</span>
            <span>${m}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else if (state.activeAboutTab === 'target') {
    return `
      <h4 style="font-size: 1.25rem; color: var(--primary-950); margin-bottom: 0.75rem;">Kriteria & Profil Calon Peserta:</h4>
      <p style="font-size: 1.05rem; line-height: 1.8; color: var(--text-body);">${program.about.target}</p>
    `;
  } else if (state.activeAboutTab === 'metode') {
    return `
      <h4 style="font-size: 1.25rem; color: var(--primary-950); margin-bottom: 0.75rem;">Pendekatan & Metode Belajar:</h4>
      <p style="font-size: 1.05rem; line-height: 1.8; color: var(--text-body);">${program.about.metode}</p>
    `;
  } else {
    return `
      <h4 style="font-size: 1.25rem; color: var(--primary-950); margin-bottom: 0.75rem;">Gambaran Finansial & Beasiswa:</h4>
      <p style="font-size: 1.05rem; line-height: 1.8; color: var(--text-body);">${program.about.biaya}</p>
    `;
  }
}

function initAkademikInteractions(program) {
  // Segmented Tabs
  const segmentedNav = document.getElementById('aboutSegmentedNav');
  if (segmentedNav) {
    segmentedNav.querySelectorAll('.seg-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.getAttribute('data-tab');
        state.activeAboutTab = tab;
        segmentedNav.querySelectorAll('.seg-tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const contentBox = document.getElementById('aboutTabContent');
        if (contentBox) {
          contentBox.innerHTML = renderAboutTabContent(program);
        }
      });
    });
  }

  // Phase Accordions
  document.querySelectorAll('.curriculum-phase-accordion .phase-header-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const accordion = e.currentTarget.closest('.curriculum-phase-accordion');
      accordion.classList.toggle('open');
    });
  });

  // FAQ Accordion
  document.querySelectorAll('.faq-item .faq-question-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const faqItem = e.currentTarget.closest('.faq-item');
      faqItem.classList.toggle('open');
    });
  });

  // Download Silabus Buttons
  const handleDownload = () => {
    showToast(`Dokumen PDF Silabus resmi untuk program ${program.shortTitle} berhasil disiapkan! Silakan cek folder unduhan Anda.`, 'success');
  };
  const d1 = document.getElementById('btnDownloadSilabus');
  const d2 = document.getElementById('btnDownloadSilabus2');
  if (d1) d1.addEventListener('click', handleDownload);
  if (d2) d2.addEventListener('click', handleDownload);

  // Direct Enrollment Form Handler
  const form = document.getElementById('directEnrollmentForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> Mengirim Pendaftaran...';
      }

      try {
        const formData = new FormData(form);
        const customAnswers = {};
        form.querySelectorAll('[data-custom-field-label]').forEach(el => {
          const label = el.getAttribute('data-custom-field-label');
          if (label) customAnswers[label] = el.value?.trim() || '';
        });

        const payload = {
          program_id: formData.get('programId') || program.id,
          batch_id: formData.get('batchId') || 'Gelombang 1 - TA 2026/2027',
          full_name: (formData.get('fullName') || '').trim(),
          gender: formData.get('gender') || 'Laki-laki',
          birth_date: formData.get('birthDate') || '',
          parent_name: (formData.get('parentName') || '').trim(),
          phone_whatsapp: (formData.get('phone') || '').trim(),
          email: (formData.get('email') || '').trim(),
          info_source: formData.get('infoSource') || 'Website',
          motivation: (formData.get('motivation') || '').trim(),
          payment_method: formData.get('paymentMethod') || 'Transfer Bank BSI',
          custom_answers: customAnswers
        };

        const res = await ppdbApi.submit(payload);
        if (res && res.success) {
          showToast(res.message || 'Alhamdulillah, pendaftaran calon santri berhasil dikirim!', 'success');
          form.reset();
          await syncDatabaseState();
          openPPDBSuccessModal(res.data || { ...payload, id: res.id, program_name: program.name });
        } else {
          showToast(res.message || 'Gagal mengirim pendaftaran.', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Terjadi kesalahan sistem saat mendaftar.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }
}

// Render Gallery (Visit Page)
function renderGalleryGrid() {
  const container = document.getElementById('galleryGridContainer');
  if (!container) return;

  const publishedGalleries = galleriesState.filter(g => g.status !== 'draft');
  const filtered = state.galleryFilter === 'all'
    ? publishedGalleries
    : publishedGalleries.filter(g => g.category === state.galleryFilter);

  container.innerHTML = filtered.map((item, idx) => `
    <div class="gallery-card-item" data-index="${idx}" data-id="${item.id}">
      <img src="${item.image}" alt="${item.altText || item.title}" loading="lazy" />
      <div class="gallery-overlay">
        <span class="gallery-overlay-badge">${formatCategoryName(item.category)}</span>
        <h5 class="gallery-overlay-title">${item.title}</h5>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.gallery-card-item').forEach(card => {
    card.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const item = galleriesState.find(g => String(g.id) === String(id));
      if (item) {
        openLightbox(item);
      }
    });
  });
}

function formatCategoryName(cat) {
  const map = {
    'gedung': 'Gedung & Fasilitas',
    'kegiatan_santri': 'Kegiatan Santri',
    'event': 'Event & Wisuda',
    'ekstrakurikuler': 'Ekstrakurikuler'
  };
  return map[cat] || 'Dokumentasi';
}

function openLightbox(item) {
  const modal = document.getElementById('lightboxModal');
  if (!modal) return;

  const img = modal.querySelector('#lightboxImg');
  const caption = modal.querySelector('#lightboxCaption');

  if (img) img.src = item.image;
  if (caption) caption.textContent = `${item.title} - ${item.caption}`;

  modal.classList.add('open');
}

// Render News (News Page)
function renderNewsGrid() {
  const container = document.getElementById('newsGridContainer');
  if (!container) return;

  // Only show published articles on the public website (exclude draft and archived)
  let filtered = articlesState.filter(a => a.status !== 'draft' && a.status !== 'archived');

  if (state.newsCategory !== 'all') {
    filtered = filtered.filter(a => a.category.toLowerCase().includes(state.newsCategory.toLowerCase()));
  }

  if (state.newsSearchQuery.trim()) {
    const q = state.newsSearchQuery.toLowerCase();
    filtered = filtered.filter(a => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1.2rem; font-weight: 700;">Artikel tidak ditemukan</p>
        <p>Coba gunakan kata kunci pencarian lain atau pilih kategori Semua.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(art => `
    <div class="news-card" data-article-id="${art.id}">
      <div class="news-thumb-box">
        <img src="${art.image}" alt="${art.title}" loading="lazy" />
        <span class="news-category-badge">${art.category}</span>
      </div>
      <div class="news-body">
        <div class="news-meta-row">
          <span>${art.date}</span>
          <span>•</span>
          <span>⏱️ ${art.readTime || '3 menit'}</span>
        </div>
        <h4 class="news-title">${art.title}</h4>
        <p class="news-excerpt">${art.excerpt}</p>
        <div class="news-card-footer">
          <span class="read-more-text">
            Baca Selengkapnya ${getIconSvg('chevron-right', 16)}
          </span>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.news-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const artId = e.currentTarget.getAttribute('data-article-id');
      const article = articlesState.find(a => a.id === artId);
      if (article) {
        openArticleReader(article);
      }
    });
  });
}


function openArticleReader(article) {
  const modal = document.getElementById('articleReaderModal');
  if (!modal) return;

  modal.querySelector('#articleModalTitle').textContent = article.title;
  modal.querySelector('#articleModalMeta').innerHTML = `
    <span>${article.category}</span> • <span>${article.date}</span> • <span>Waktu baca: ${article.readTime || '3 Menit'}</span>
  `;
  modal.querySelector('#articleModalImg').src = article.image;
  modal.querySelector('#articleModalBody').innerHTML = article.content;

  const tagsContainer = modal.querySelector('#articleModalTags');
  if (tagsContainer) {
    tagsContainer.innerHTML = (article.tags || []).map(t => `<span class="badge-tag-pill">#${t}</span>`).join(' ');
  }

  modal.classList.add('open');
}

// ============================================================================
// PPDB CLIENT-SIDE CONTROLLERS & WIZARD (PRD Section 4.1 & 4.2)
// ============================================================================

let ppdbActiveStep = 1;
let currentViewingLead = null;
const adminPPDBFilter = {
  search: '',
  program: 'all',
  status: 'all',
  dateRange: 'all'
};

export function openPPDBModal(preselectedProgramId = null) {
  const modal = document.getElementById('ppdbModal');
  if (!modal) return;

  ppdbActiveStep = 1;
  updatePPDBWizardSteps();

  const progSelect = document.getElementById('modalProgramId');
  if (progSelect) {
    if (preselectedProgramId) {
      progSelect.value = preselectedProgramId;
    } else if (state.activeProgramId) {
      progSelect.value = state.activeProgramId;
    }
    updateProgramQuickPreview(progSelect.value);
  }

  modal.classList.add('open');
}

function updatePPDBWizardSteps() {
  for (let i = 1; i <= 3; i++) {
    const ind = document.getElementById(`stepIndicator${i}`);
    const stepDiv = document.getElementById(`wizardStep${i}`);
    if (ind) {
      ind.classList.toggle('active', i === ppdbActiveStep);
      ind.classList.toggle('completed', i < ppdbActiveStep);
    }
    if (stepDiv) {
      stepDiv.style.display = i === ppdbActiveStep ? 'block' : 'none';
    }
  }
}

function updateProgramQuickPreview(progId) {
  const prog = programsState.find(p => p.id === progId) || PROGRAMS.find(p => p.id === progId) || PROGRAMS[0];
  const title = document.getElementById('pqpTitle');
  const desc = document.getElementById('pqpDesc');
  const batchSelect = document.getElementById('modalBatchId');
  const dynamicBox = document.getElementById('modalDynamicProgramFields');

  if (title) title.textContent = prog.name;
  if (desc) desc.textContent = prog.headline || prog.summary;

  if (batchSelect && prog.batches) {
    batchSelect.innerHTML = prog.batches.map(b => `
      <option value="${b.name}">${b.name} (${b.remaining})</option>
    `).join('');
  }

  // Render dynamic form_schema fields configured for this program (Req #5 & #6)
  if (dynamicBox) {
    const schema = Array.isArray(prog.formSchema) ? prog.formSchema : [];
    if (schema.length === 0) {
      dynamicBox.innerHTML = '';
    } else {
      dynamicBox.innerHTML = `
        <div style="border-top: 1px dashed rgba(129, 28, 229, 0.25); padding-top: 0.85rem; margin-top: 0.25rem;">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--primary-purple); text-transform: uppercase; margin-bottom: 0.65rem;">
            Pertanyaan Khusus Program (${prog.shortTitle || prog.name})
          </div>
          ${schema.map((field, idx) => {
            const labelText = field.label || `Pertanyaan ${idx + 1}`;
            const reqAttr = field.required ? 'required' : '';
            const reqStar = field.required ? ' *' : '';
            if (field.type === 'textarea') {
              return `
                <div class="form-group" style="margin-bottom: 0.75rem;">
                  <label class="form-label">${labelText}${reqStar}</label>
                  <textarea class="form-textarea modal-custom-schema-input" data-custom-field-label="${labelText}" rows="2" placeholder="${field.placeholder || ''}" ${reqAttr}></textarea>
                </div>
              `;
            } else if (field.type === 'select') {
              const opts = (field.options || '').split(',').map(o => o.trim()).filter(Boolean);
              return `
                <div class="form-group" style="margin-bottom: 0.75rem;">
                  <label class="form-label">${labelText}${reqStar}</label>
                  <select class="form-select modal-custom-schema-input" data-custom-field-label="${labelText}" ${reqAttr}>
                    ${opts.map(o => `<option value="${o}">${o}</option>`).join('')}
                  </select>
                </div>
              `;
            } else {
              return `
                <div class="form-group" style="margin-bottom: 0.75rem;">
                  <label class="form-label">${labelText}${reqStar}</label>
                  <input type="${field.type === 'number' ? 'number' : 'text'}" class="form-input modal-custom-schema-input" data-custom-field-label="${labelText}" placeholder="${field.placeholder || ''}" ${reqAttr} />
                </div>
              `;
            }
          }).join('')}
        </div>
      `;
    }
  }
}

export function openPPDBSuccessModal(leadData) {
  const modal = document.getElementById('ppdbSuccessModal');
  if (!modal) return;

  const regNumEl = document.getElementById('receiptRegNumber');
  const studentEl = document.getElementById('receiptStudentName');
  const genderEl = document.getElementById('receiptGender');
  const progEl = document.getElementById('receiptProgramName');
  const batchEl = document.getElementById('receiptBatch');
  const parentEl = document.getElementById('receiptParentName');
  const phoneEl = document.getElementById('receiptPhone');
  const paymentEl = document.getElementById('receiptPayment');
  const dateEl = document.getElementById('receiptDate');
  const statusEl = document.getElementById('receiptStatus');

  const regId = leadData.id || leadData.registration_number || `REG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const studentName = leadData.full_name || leadData.studentName || 'Calon Santri';
  const prog = programsState.find(p => p.id === (leadData.program_id || leadData.programId)) || PROGRAMS.find(p => p.id === (leadData.program_id || leadData.programId));
  const progName = leadData.program_name || leadData.programName || (prog ? prog.name : 'Program Tahfidz');
  const parentName = leadData.parent_name || leadData.parentName || 'Orang Tua / Wali';
  const phone = leadData.phone_whatsapp || leadData.phone || '-';

  if (regNumEl) regNumEl.textContent = regId;
  if (studentEl) studentEl.textContent = studentName;
  if (genderEl) genderEl.textContent = leadData.gender || 'Laki-laki';
  if (progEl) progEl.textContent = progName;
  if (batchEl) batchEl.textContent = leadData.batch_id || leadData.batchId || 'Gelombang 1 - TA 2026/2027';
  if (parentEl) parentEl.textContent = parentName;
  if (phoneEl) phoneEl.textContent = phone;
  if (paymentEl) paymentEl.textContent = leadData.payment_method || leadData.paymentMethod || 'Transfer Bank BSI';
  if (dateEl) dateEl.textContent = leadData.created_at || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  if (statusEl) {
    statusEl.textContent = 'Menunggu Verifikasi';
    statusEl.className = 'status-pill status-pending';
  }

  // Pre-fill WhatsApp Confirmation Button
  const btnWA = document.getElementById('btnConfirmWhatsappPPDB');
  if (btnWA) {
    const waNumber = INSTITUTION.whatsappPPDB || '6281234567890';
    const cleanWA = waNumber.replace(/[^0-9]/g, '');
    const msg = `Assalamu'alaikum Warahmatullah Admin PPDB Rumah Tahfidz Madani,\n\nSaya ingin konfirmasi pendaftaran calon santri baru online:\n• No. Registrasi: ${regId}\n• Nama Santri: ${studentName}\n• Jenjang: ${progName}\n• Gelombang: ${leadData.batch_id || leadData.batchId || 'Gelombang 1'}\n• Wali Santri: ${parentName}\n• No. WhatsApp: ${phone}\n\nMohon petunjuk jadwal tes talaqqi Al-Qur'an dan verifikasi berkas selanjutnya. Syukran wa jazakumullah khair.`;
    btnWA.href = `https://wa.me/${cleanWA}?text=${encodeURIComponent(msg)}`;
  }

  modal.classList.add('open');
}

function getPPDBStatusLabel(status) {
  if (status === 'accepted') return 'Diterima';
  if (status === 'verified') return 'Terverifikasi';
  if (status === 'needs_correction') return 'Perlu Revisi Berkas';
  if (status === 'rejected') return 'Ditolak';
  return 'Menunggu';
}

function getPPDBStatusClass(status) {
  if (status === 'accepted') return 'status-success';
  if (status === 'verified') return 'status-active';
  if (status === 'needs_correction') return 'status-pending';
  if (status === 'rejected') return 'status-draft';
  return 'status-pending';
}

export async function openAdminPPDBDetailModal(leadId) {
  let lead = ppdbState.find(l => l.id === leadId);
  if (!lead) return;

  currentViewingLead = lead;
  const modal = document.getElementById('adminPPDBDetailModal');
  if (!modal) return;

  const nameEl = document.getElementById('dossierStudentName');
  const regEl = document.getElementById('dossierRegId');
  const dateEl = document.getElementById('dossierDate');
  const pillEl = document.getElementById('dossierStatusPill');
  const genderEl = document.getElementById('dossierGender');
  const birthEl = document.getElementById('dossierBirthDate');
  const progEl = document.getElementById('dossierProgram');
  const batchEl = document.getElementById('dossierBatch');
  const parentEl = document.getElementById('dossierParentName');
  const phoneEl = document.getElementById('dossierPhone');
  const phoneLink = document.getElementById('dossierPhoneLink');
  const emailEl = document.getElementById('dossierEmail');
  const paymentEl = document.getElementById('dossierPayment');
  const sourceEl = document.getElementById('dossierSource');
  const motivEl = document.getElementById('dossierMotivation');
  const notesEl = document.getElementById('dossierNotesInput');
  const customBox = document.getElementById('dossierCustomAnswersBox');
  const customList = document.getElementById('dossierCustomAnswersList');
  const historyList = document.getElementById('dossierStatusHistoryList');

  if (nameEl) nameEl.textContent = lead.studentName;
  if (regEl) regEl.textContent = lead.id;
  if (dateEl) dateEl.textContent = lead.registeredAt;
  if (pillEl) {
    pillEl.textContent = getPPDBStatusLabel(lead.status);
    pillEl.className = `status-pill ${getPPDBStatusClass(lead.status)}`;
  }
  if (genderEl) genderEl.textContent = lead.gender || 'Laki-laki';
  if (birthEl) birthEl.textContent = lead.birthDate || '-';
  if (progEl) progEl.textContent = lead.programName || lead.programId;
  if (batchEl) batchEl.textContent = lead.batchId || 'Gelombang 1 - TA 2026/2027';
  if (parentEl) parentEl.textContent = lead.parentName || '-';
  if (phoneEl) phoneEl.textContent = lead.phone || '-';
  if (emailEl) emailEl.textContent = lead.email || '-';
  if (paymentEl) paymentEl.textContent = lead.paymentMethod || 'Transfer Bank BSI';
  if (sourceEl) sourceEl.textContent = lead.infoSource || 'Website Resmi';
  if (motivEl) motivEl.textContent = lead.motivation || 'Tidak ada catatan motivasi khusus.';
  if (notesEl) notesEl.value = lead.notes || '';

  const cleanPhone = (lead.phone || '').replace(/^0/, '62').replace(/[^0-9]/g, '');
  if (phoneLink) {
    phoneLink.href = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';
  }

  const btnChat = document.getElementById('btnDossierChatWA');
  if (btnChat) {
    const chatMsg = `Assalamu'alaikum Warahmatullah Bapak/Ibu ${lead.parentName || 'Wali Santri'},\n\nKami dari Sekretariat PPDB Rumah Tahfidz Madani mengenai pendaftaran ananda ${lead.studentName} (No: ${lead.id}) untuk program ${lead.programName}.\n\nKami ingin menginformasikan tahapan seleksi baca Al-Qur'an dan observasi berkas santri.`;
    btnChat.href = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(chatMsg)}` : '#';
  }

  modal.classList.add('open');

  // Fetch authoritative dossier details (custom_answers + status_history) from backend
  try {
    const res = await ppdbApi.getById(leadId);
    if (res && res.data) {
      lead = normalizeLead(res.data);
      currentViewingLead = lead;
    }
  } catch {
    // fallback to local lead
  }

  if (customBox && customList) {
    const entries = Object.entries(lead.customAnswers || {});
    if (entries.length === 0) {
      customBox.style.display = 'none';
      customList.innerHTML = '';
    } else {
      customBox.style.display = 'block';
      customList.innerHTML = entries.map(([k, v]) => `
        <div><strong>${k}:</strong> ${v || '-'}</div>
      `).join('');
    }
  }

  if (historyList) {
    const history = Array.isArray(lead.statusHistory) ? lead.statusHistory : [];
    if (history.length === 0) {
      historyList.innerHTML = `<div>• <strong>${getPPDBStatusLabel(lead.status)}</strong> (${lead.registeredAt}) ${lead.notes ? `— ${lead.notes}` : ''}</div>`;
    } else {
      historyList.innerHTML = history.map(h => `
        <div style="padding: 0.25rem 0; border-bottom: 1px dashed rgba(0,0,0,0.06);">
          <strong>${getPPDBStatusLabel(h.previous_status || 'pending')} → ${getPPDBStatusLabel(h.new_status)}</strong>
          <span style="color: var(--text-muted);"> oleh ${h.changed_by_name || 'Admin'} (${h.created_at || 'Baru saja'})</span>
          ${h.notes ? `<div style="color: var(--text-dark); margin-top: 2px;">Catatan: "${h.notes}"</div>` : ''}
        </div>
      `).join('');
    }
  }
}

export function initPPDBModalEvents() {
  // Wizard Navigation
  const progSelect = document.getElementById('modalProgramId');
  if (progSelect) {
    progSelect.addEventListener('change', (e) => {
      updateProgramQuickPreview(e.target.value);
    });
  }

  const btnNext2 = document.getElementById('btnNextToStep2');
  if (btnNext2) {
    btnNext2.addEventListener('click', () => {
      ppdbActiveStep = 2;
      updatePPDBWizardSteps();
    });
  }

  const btnBack1 = document.getElementById('btnBackToStep1');
  if (btnBack1) {
    btnBack1.addEventListener('click', () => {
      ppdbActiveStep = 1;
      updatePPDBWizardSteps();
    });
  }

  const btnNext3 = document.getElementById('btnNextToStep3');
  if (btnNext3) {
    btnNext3.addEventListener('click', () => {
      const name = document.getElementById('modalFullName')?.value?.trim();
      const phone = document.getElementById('modalPhone')?.value?.trim();
      const parent = document.getElementById('modalParentName')?.value?.trim();

      if (!name || !phone || !parent) {
        showToast('Mohon lengkapi Nama Santri, Nama Orang Tua, dan Nomor WhatsApp aktif.', 'warning');
        return;
      }

      ppdbActiveStep = 3;
      updatePPDBWizardSteps();
    });
  }

  const btnBack2 = document.getElementById('btnBackToStep2');
  if (btnBack2) {
    btnBack2.addEventListener('click', () => {
      ppdbActiveStep = 2;
      updatePPDBWizardSteps();
    });
  }

  // Submit Modal Form
  const modalForm = document.getElementById('modalPPDBForm');
  if (modalForm) {
    modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btnSubmitModalPPDB');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> Mengirim Pendaftaran...';
      }

      try {
        const progId = document.getElementById('modalProgramId').value;
        const batchId = document.getElementById('modalBatchId').value;
        const fullName = document.getElementById('modalFullName').value.trim();
        const gender = document.getElementById('modalGender').value;
        const birthDate = document.getElementById('modalBirthDate').value;
        const parentName = document.getElementById('modalParentName').value.trim();
        const rawPhone = document.getElementById('modalPhone').value.trim();
        const countryCode = document.getElementById('modalPhoneCountryCode')?.value?.trim() || '62';
        let digits = rawPhone.replace(/[^0-9]/g, '');
        if (digits.startsWith('0')) digits = digits.slice(1);
        const phone = digits.startsWith(countryCode) ? digits : (countryCode + digits);
        const email = document.getElementById('modalEmail').value.trim();
        const paymentMethod = document.getElementById('modalPaymentMethod').value;
        const infoSource = document.getElementById('modalInfoSource').value;
        const motivation = document.getElementById('modalMotivation').value.trim();

        const customAnswers = {};
        modalForm.querySelectorAll('.modal-custom-schema-input').forEach(el => {
          const label = el.getAttribute('data-custom-field-label');
          if (label) customAnswers[label] = el.value?.trim() || '';
        });

        const payload = {
          program_id: progId,
          batch_id: batchId,
          full_name: fullName,
          gender,
          birth_date: birthDate,
          parent_name: parentName,
          phone_whatsapp: phone,
          email,
          payment_method: paymentMethod,
          info_source: infoSource,
          motivation,
          custom_answers: customAnswers
        };

        const res = await ppdbApi.submit(payload);

        if (res && res.success) {
          showToast(res.message || 'Alhamdulillah, pendaftaran calon santri berhasil dikirim!', 'success');
          document.getElementById('ppdbModal')?.classList.remove('open');
          modalForm.reset();
          ppdbActiveStep = 1;
          updatePPDBWizardSteps();

          await syncDatabaseState();
          openPPDBSuccessModal(res.data || { ...payload, id: res.id });
        } else {
          showToast(res.message || 'Gagal mengirim pendaftaran.', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Terjadi kesalahan sistem saat mendaftar.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span class="btn-text">Kirim Pendaftaran Santri Baru</span>';
        }
      }
    });
  }

  // Print Receipt Button
  const btnPrint = document.getElementById('btnPrintPPDBReceipt');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  // Close Success Modal Buttons
  const btnCloseSuccess = document.getElementById('btnCloseSuccessPPDB');
  const btnCloseSuccessBtn = document.getElementById('btnCloseSuccessPPDBBtn');
  if (btnCloseSuccess) btnCloseSuccess.addEventListener('click', () => document.getElementById('ppdbSuccessModal')?.classList.remove('open'));
  if (btnCloseSuccessBtn) btnCloseSuccessBtn.addEventListener('click', () => document.getElementById('ppdbSuccessModal')?.classList.remove('open'));

  // Admin Candidate Dossier Modal Action Buttons
  const btnSaveNotes = document.getElementById('btnDossierSaveNotes');
  if (btnSaveNotes) {
    btnSaveNotes.addEventListener('click', async () => {
      if (!currentViewingLead) return;
      const notes = document.getElementById('dossierNotesInput')?.value || '';
      try {
        await ppdbApi.updateStatus(currentViewingLead.id, currentViewingLead.status, notes);
        showToast('Catatan panitia PPDB berhasil disimpan.', 'success');
        currentViewingLead.notes = notes;
        await syncDatabaseState();
        renderAdminAkademik();
      } catch (err) {
        showToast('Gagal menyimpan catatan: ' + err.message, 'error');
      }
    });
  }

  const btnRequestCorrection = document.getElementById('btnDossierRequestCorrection');
  if (btnRequestCorrection) {
    btnRequestCorrection.addEventListener('click', async () => {
      if (!currentViewingLead) return;
      const notes = (document.getElementById('dossierNotesInput')?.value || '').trim();
      if (!notes) {
        showToast('Catatan perbaikan berkas wajib diisi pada kolom Catatan sebelum meminta koreksi.', 'warning');
        document.getElementById('dossierNotesInput')?.focus();
        return;
      }
      try {
        await ppdbApi.updateStatus(currentViewingLead.id, 'needs_correction', notes);
        showToast(`Permintaan revisi berkas untuk ${currentViewingLead.studentName} telah disimpan!`, 'success');
        document.getElementById('adminPPDBDetailModal')?.classList.remove('open');
        await syncDatabaseState();
        renderAdminAkademik();
        renderAdminOverview();
      } catch (err) {
        showToast('Gagal mengirim permintaan revisi: ' + err.message, 'error');
      }
    });
  }

  const btnVerify = document.getElementById('btnDossierVerify');
  if (btnVerify) {
    btnVerify.addEventListener('click', async () => {
      if (!currentViewingLead) return;
      const notes = document.getElementById('dossierNotesInput')?.value || '';
      try {
        await ppdbApi.updateStatus(currentViewingLead.id, 'verified', notes);
        showToast(`Berkas pendaftaran ${currentViewingLead.studentName} telah TERVERIFIKASI!`, 'success');
        document.getElementById('adminPPDBDetailModal')?.classList.remove('open');
        await syncDatabaseState();
        renderAdminAkademik();
        renderAdminOverview();
      } catch (err) {
        showToast('Gagal memverifikasi: ' + err.message, 'error');
      }
    });
  }

  const btnAccept = document.getElementById('btnDossierAccept');
  if (btnAccept) {
    btnAccept.addEventListener('click', async () => {
      if (!currentViewingLead) return;
      const notes = document.getElementById('dossierNotesInput')?.value || '';
      try {
        await ppdbApi.updateStatus(currentViewingLead.id, 'accepted', notes);
        showToast(`Alhamdulillah! Santri ${currentViewingLead.studentName} dinyatakan DITERIMA!`, 'success');
        document.getElementById('adminPPDBDetailModal')?.classList.remove('open');
        await syncDatabaseState();
        renderAdminAkademik();
        renderAdminOverview();
      } catch (err) {
        showToast('Gagal menerima santri: ' + err.message, 'error');
      }
    });
  }

// Interactive Confirmation Modal Helper (Returns Promise<boolean>)
function showInteractiveConfirm({
  title = 'Konfirmasi Hapus Data',
  message = 'Apakah Anda yakin ingin menghapus data ini? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.',
  confirmText = 'Ya, Hapus Sekarang',
  confirmBtnClass = 'btn-danger',
  icon = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('interactiveConfirmModal');
    if (!modal) {
      resolve(window.confirm(message.replace(/<[^>]+>/g, '')));
      return;
    }
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const actionBtn = document.getElementById('confirmModalActionBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const iconEl = modal.querySelector('.confirm-modal-icon-wrap');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.innerHTML = message;
    if (actionBtn) {
      actionBtn.textContent = confirmText;
      actionBtn.style.background = confirmBtnClass === 'btn-danger' ? '#dc2626' : 'var(--primary-purple)';
      actionBtn.style.borderColor = confirmBtnClass === 'btn-danger' ? '#dc2626' : 'var(--primary-purple)';
    }
    if (iconEl && icon) iconEl.innerHTML = icon;

    const cleanup = () => {
      modal.classList.remove('open');
      actionBtn?.removeEventListener('click', onConfirm);
      cancelBtn?.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKeyDown);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
      }
    };

    actionBtn?.addEventListener('click', onConfirm, { once: true });
    cancelBtn?.addEventListener('click', onCancel, { once: true });
    document.addEventListener('keydown', onKeyDown);

    modal.classList.add('open');
  });
}

  const btnReject = document.getElementById('btnDossierReject');
  if (btnReject) {
    btnReject.addEventListener('click', async () => {
      if (!currentViewingLead) return;
      const confirmed = await showInteractiveConfirm({
        title: 'Tolak Pendaftaran Santri',
        message: `Apakah Anda yakin ingin menolak pendaftaran santri <strong>"${currentViewingLead.studentName}"</strong>?`,
        confirmText: 'Ya, Tolak Pendaftaran',
        icon: '⚠️'
      });
      if (!confirmed) return;
      const notes = document.getElementById('dossierNotesInput')?.value || '';
      try {
        await ppdbApi.updateStatus(currentViewingLead.id, 'rejected', notes);
        showToast(`Status pendaftaran ${currentViewingLead.studentName} diperbarui menjadi Ditolak.`, 'info');
        document.getElementById('adminPPDBDetailModal')?.classList.remove('open');
        await syncDatabaseState();
        renderAdminAkademik();
        renderAdminOverview();
      } catch (err) {
        showToast('Gagal menolak: ' + err.message, 'error');
      }
    });
  }

  const btnDelete = document.getElementById('btnDossierDelete');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!currentViewingLead) return;
      const confirmed = await showInteractiveConfirm({
        title: 'Hapus Berkas Pendaftaran',
        message: `Hapus permanen data registrasi santri <strong>"${currentViewingLead.studentName}"</strong>? Tindakan ini tidak dapat dibatalkan.`,
        confirmText: 'Ya, Hapus Registrasi'
      });
      if (!confirmed) return;
      try {
        await ppdbApi.delete(currentViewingLead.id);
        showToast('Data pendaftaran santri berhasil dihapus dari sistem.', 'info');
        document.getElementById('adminPPDBDetailModal')?.classList.remove('open');
        await syncDatabaseState();
        renderAdminAkademik();
        renderAdminOverview();
      } catch (err) {
        showToast('Gagal menghapus data: ' + err.message, 'error');
      }
    });
  }
}

// Modals Initialization
function initModals() {
  // Modal Close Buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.currentTarget.closest('.modal-backdrop');
      if (modal) modal.classList.remove('open');
    });
  });

  // Close modal on background click
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
      }
    });
  });

  // ESC key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
    }
  });

  // PPDB BUTTON CLICKS (Navbar PPDB, Hero PPDB, Section PPDB, Mobile Drawer)
  document.querySelectorAll('.btn-ppdb-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openPPDBModal();
    });
  });

  // DONASI BUTTON CLICKS (Navbar CTA, Banner CTA, Quick actions)
  document.querySelectorAll('.btn-donate-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = document.getElementById('donasiModal');
      if (modal) modal.classList.add('open');
    });
  });

  // LMS BUTTON CLICKS (Navbar Masuk, Student Portal CTA)
  document.querySelectorAll('.btn-lms-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = document.getElementById('lmsModal');
      if (modal) modal.classList.add('open');
    });
  });

  initPPDBModalEvents();

  // Copy BSI Account Number
  const copyBtn = document.getElementById('btnCopyBSI');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const accNum = INSTITUTION.bankAccounts[0].accountNumber.replace(/\s+/g, '');
      navigator.clipboard.writeText(accNum).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Tersalin!';
        copyBtn.style.background = '#10B981';
        showToast('Nomor Rekening Bank BSI berhasil disalin ke clipboard!', 'success');
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.background = '';
        }, 2000);
      });
    });
  }

  // WA Confirm Button
  const waConfirmBtn = document.getElementById('btnWAConfirm');
  if (waConfirmBtn) {
    waConfirmBtn.addEventListener('click', () => {
      const text = encodeURIComponent("Assalamu'alaikum Warahmatullahi Wabarakatuh. Saya ingin konfirmasi sedekah / donasi wakaf untuk Yayasan Rumah Tahfidz Al-Hikmah.");
      window.open(`https://wa.me/${INSTITUTION.whatsappDonasi}?text=${text}`, '_blank');
    });
  }

  // Waitlist Donasi Form
  const donasiWaitlistForm = document.getElementById('donasiWaitlistForm');
  if (donasiWaitlistForm) {
    donasiWaitlistForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = donasiWaitlistForm.querySelector('input[type="text"]');
      if (input && input.value) {
        showToast(`Terima kasih! Kontak ${input.value} telah terdaftar dalam waitlist peluncuran portal donasi & wakaf digital kami.`, 'success');
        donasiWaitlistForm.reset();
        const modal = document.getElementById('donasiModal');
        if (modal) modal.classList.remove('open');
        leadsApi.submitWaitlist(input.value, 'donasi_portal')
          .then(res => showToast(res.message, 'success'))
          .catch(err => showToast(`Terima kasih! Kontak ${input.value} telah dicatat.`, 'success'));
      }
    });
  }

  // LMS Waitlist Form (Sprint 3 API Integration)
  const lmsWaitlistForm = document.getElementById('lmsWaitlistForm');
  if (lmsWaitlistForm) {
    lmsWaitlistForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = lmsWaitlistForm.querySelector('input');
      if (input && input.value) {
        lmsWaitlistForm.reset();
        const modal = document.getElementById('lmsModal');
        if (modal) modal.classList.remove('open');
        try {
          const res = await leadsApi.submitWaitlist(input.value, 'lms_portal');
          showToast(res.message, 'success');
        } catch {
          showToast(`Email ${input.value} tersimpan! Kami akan mengabari saat rilis.`, 'success');
        }
      }
    });
  }

  // Tour Reservation Form (Sprint 3 API Integration)
  const tourForm = document.getElementById('tourReservationForm');
  if (tourForm) {
    tourForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = tourForm.querySelector('input[name="tourName"]')?.value || 'Tamu';
      const org = tourForm.querySelector('input[name="tourOrg"]')?.value || '';
      const phone = tourForm.querySelector('input[name="tourPhone"]')?.value || '';
      const date = tourForm.querySelector('input[name="tourDate"]')?.value || '';
      const count = tourForm.querySelector('input[name="tourCount"]')?.value || '1';
      const goal = tourForm.querySelector('select[name="tourGoal"]')?.value || 'Kunjungan';

      try {
        const res = await reservationsApi.submit({
          visitor_name: name,
          institution: org,
          phone,
          visit_date: date,
          visitor_count: Number(count),
          objective: goal,
          session_time: 'Sesi 1 (08.30 - 11.30 WIB)'
        });
        showToast(res.message, 'success');
        tourForm.reset();
        await syncDatabaseState();
      } catch (err) {
        showToast(`Permohonan kunjungan rombongan ${name} pada ${date} berhasil diajukan!`, 'success');
        tourForm.reset();
      }
    });
  }

  // Share Article Button
  const btnShareWA = document.getElementById('btnShareArticleWA');
  if (btnShareWA) {
    btnShareWA.addEventListener('click', () => {
      const title = document.getElementById('articleModalTitle').textContent;
      const url = window.location.href;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(title + '\n\n' + url)}`, '_blank');
    });
  }

  const btnCopyArticleLink = document.getElementById('btnCopyArticleLink');
  if (btnCopyArticleLink) {
    btnCopyArticleLink.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('Tautan artikel berhasil disalin!', 'success');
      });
    });
  }
}

// Global UI Handlers
function initGlobalUI() {
  // Sticky Header Scroll Listener
  window.addEventListener('scroll', () => {
    const header = document.querySelector('.site-header');
    if (header) {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  });

  // Mobile Drawer Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');
  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.toggle('open');
    });
  }

  // Gallery Filters
  document.querySelectorAll('.gallery-filter-bar .filter-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.gallery-filter-bar .filter-pill-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.galleryFilter = e.target.getAttribute('data-filter');
      renderGalleryGrid();
    });
  });

  // News Category Filter
  document.querySelectorAll('.news-category-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.news-category-pill').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.newsCategory = e.target.getAttribute('data-category');
      renderNewsGrid();
    });
  });

  // News Search
  const searchInput = document.getElementById('newsSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.newsSearchQuery = e.target.value;
      renderNewsGrid();
    });
  }

  // Home Program Catalog Tabs (Formal vs Non-Formal)
  document.querySelectorAll('.catalog-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.catalog-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const cat = e.target.getAttribute('data-category');
      renderHomeProgramCards(cat);
    });
  });

  // Render initial Home Program Cards
  renderHomeProgramCards('all');
}

function renderHomeProgramCards(category) {
  const container = document.getElementById('homeProgramCardsContainer');
  if (!container) return;

  let list = programsState.filter(p => p.publicationStatus !== 'draft' && p.publicationStatus !== 'archived');
  if (list.length === 0) list = PROGRAMS;
  if (category !== 'all') {
    list = list.filter(p => p.category === category);
  }

  container.innerHTML = list.map(p => `
    <div class="program-card">
      <div class="program-card-thumb">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        <span class="program-card-badge">${p.badge || 'Program Unggulan'}</span>
      </div>
      <div class="program-card-body">
        <h4 class="program-card-title">${p.name}</h4>
        <span class="program-card-claim">${p.headline || ''}</span>
        <p class="program-card-summary">${p.summary || ''}</p>
        
        <div class="program-card-specs">
          <span class="spec-item">⏱️ ${p.stats?.durasi || '3 Tahun'}</span>
          <span class="spec-item">${p.stats?.targetHafalan || '30 Juz'}</span>
        </div>

        <a href="#akademik-${p.id}" class="btn-detail-link">
          <span>Lihat Silabus & Detail</span>
          <span>${getIconSvg('chevron-right', 16)}</span>
        </a>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// SPRINT 2: ADMIN CMS & BACKOFFICE LOGIC (PRD Section 5 & 6)
// ============================================================================

// 1. Notification Bell System
function updateNotificationBell() {
  const pendingDonations = donationsState.filter(d => d.paymentStatus === 'pending');
  const pendingVisits = visitsState.filter(v => v.status === 'pending');
  const totalNotif = pendingDonations.length + pendingVisits.length;

  const dot = document.getElementById('notifBadgeDot');
  const countBadge = document.getElementById('notifDropdownCount');
  const listContainer = document.getElementById('notifListContainer');

  if (dot) dot.style.display = totalNotif > 0 ? 'block' : 'none';
  if (countBadge) countBadge.textContent = `${totalNotif} Baru`;

  if (listContainer) {
    if (totalNotif === 0) {
      listContainer.innerHTML = `
        <li style="padding: 1.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.84rem;">
          Semua tugas telah diselesaikan. Tidak ada notifikasi tertunda.
        </li>
      `;
      return;
    }

    let itemsHtml = '';
    pendingDonations.forEach(d => {
      itemsHtml += `
        <li class="notif-item" data-notif-target="donasi">
          <strong>Transfer Donasi Masuk</strong>
          <div>${d.donorName} (${d.invoiceNumber}) - Rp ${d.amount.toLocaleString('id-ID')}</div>
          <div class="notif-item-time">${d.paidAt}</div>
        </li>
      `;
    });

    pendingVisits.forEach(v => {
      itemsHtml += `
        <li class="notif-item" data-notif-target="galeri">
          <strong>Reservasi Kunjungan Kampus</strong>
          <div>${v.groupName} (${v.count} Peserta)</div>
          <div class="notif-item-time">Rencana: ${v.date}</div>
        </li>
      `;
    });

    listContainer.innerHTML = itemsHtml;

    listContainer.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-notif-target');
        const notifDropdown = document.getElementById('notifDropdown');
        if (notifDropdown) notifDropdown.style.display = 'none';
        window.location.hash = `#admin-${target}`;
      });
    });
  }
}

// Helper: Shorten Jenjang names for clean mobile typography (PRD & Wireframe adherence)
export function getShortJenjang(programName, programId) {
  if (!programName && !programId) return '-';
  const name = (programName || '').toLowerCase().trim();
  const id = (programId || '').toLowerCase().trim();

  if (name.startsWith('smp') || id === 'smp') return 'SMP';
  if (name.startsWith('sma') || id === 'sma') return 'SMA';
  if (name.startsWith('mahasantri') || id === 'mahasantri') return 'Mahasantri';
  if (name.includes('halaqoh') || id === 'halaqoh-ibu') return 'Halaqoh Ibu';
  if (name.includes('ngaji') || id === 'online') return 'Ngaji Online';
  if (name.includes('tpa') || id === 'tpa') return 'TPA Anak';

  const words = (programName || id).split(/\s+/);
  if (words.length <= 2) return programName || id.toUpperCase();
  return words[0].length <= 3 && words[1] ? `${words[0]} ${words[1]}` : words[0];
}

// 2. Render Overview Panel (Sprint 3 Live SQLite DB Stats - Zero Fabricated Metrics)
async function renderAdminOverview() {
  const rangeSelect = document.getElementById('overviewDateFilter');
  const rangeVal = rangeSelect ? rangeSelect.value : (state.overviewRange || 'all');

  try {
    const statsRes = await statsApi.getOverview({ range: rangeVal });
    if (statsRes && statsRes.data) {
      const s = statsRes.data;
      const kpiDonasi = document.getElementById('kpiTotalDonasi');
      if (kpiDonasi) kpiDonasi.textContent = `Rp ${Number(s.totalDonations || 0).toLocaleString('id-ID')}`;

      const kpiSubDonasi = document.getElementById('kpiSubDonasi');
      if (kpiSubDonasi) kpiSubDonasi.textContent = `${s.verifiedDonationsCount || 0} transaksi terverifikasi`;

      const kpiPPDB = document.getElementById('kpiTotalPPDB');
      if (kpiPPDB) kpiPPDB.textContent = `${s.totalLeads || 0} Santri`;

      const kpiSubPPDB = document.getElementById('kpiSubPPDB');
      if (kpiSubPPDB && s.ppdbBreakdown) {
        kpiSubPPDB.textContent = `${s.ppdbBreakdown.accepted || 0} Diterima • ${s.ppdbBreakdown.pending || 0} Menunggu`;
      }

      const kpiCamp = document.getElementById('kpiActiveCampaigns');
      if (kpiCamp) kpiCamp.textContent = `${s.activeCampaignsCount !== undefined ? s.activeCampaignsCount : s.activePrograms} Program`;

      const kpiSubCamp = document.getElementById('kpiSubCampaigns');
      if (kpiSubCamp) kpiSubCamp.textContent = `${s.activePrograms || 0} Program Akademik Aktif`;

      const kpiPending = document.getElementById('kpiPendingReceipts');
      if (kpiPending) kpiPending.textContent = `${s.pendingDonationsCount || 0} Transaksi`;

      const ringPctEl = document.getElementById('overviewRingPercent');
      const totalCamps = Math.max(1, campaignsState.length);
      const activeCamps = s.activeCampaignsCount !== undefined ? s.activeCampaignsCount : campaignsState.filter(c => c.status === 'active').length;
      if (ringPctEl) ringPctEl.textContent = `${Math.round((activeCamps / totalCamps) * 100)}%`;

      const contentBadge = document.getElementById('overviewContentSummaryBadge');
      if (contentBadge) {
        contentBadge.textContent = `${s.publishedArticles || 0} Artikel Terbit (${s.draftArticles || 0} Draft) • ${s.publishedGalleries || 0} Galeri • ${s.activePrograms || 0} Program`;
      }

      if (Array.isArray(s.recentAuditLogs)) {
        systemAuditState = s.recentAuditLogs;
      }
    }
  } catch (err) {
    const verifiedTrx = donationsState.filter(d => (d.paymentStatus || d.status) === 'success');
    const totalDonations = verifiedTrx.reduce((sum, d) => sum + d.amount, 0);
    const pendingDonations = donationsState.filter(d => (d.paymentStatus || d.status) === 'pending');
    const activeCampaigns = campaignsState.filter(c => c.status === 'active').length;
    const totalPPDB = ppdbState.length;

    const kpiDonasi = document.getElementById('kpiTotalDonasi');
    if (kpiDonasi) kpiDonasi.textContent = `Rp ${totalDonations.toLocaleString('id-ID')}`;

    const kpiSubDonasi = document.getElementById('kpiSubDonasi');
    if (kpiSubDonasi) kpiSubDonasi.textContent = `${verifiedTrx.length} transaksi terverifikasi`;

    const kpiPPDB = document.getElementById('kpiTotalPPDB');
    if (kpiPPDB) kpiPPDB.textContent = `${totalPPDB} Santri`;

    const kpiCamp = document.getElementById('kpiActiveCampaigns');
    if (kpiCamp) kpiCamp.textContent = `${activeCampaigns} Program`;

    const kpiPending = document.getElementById('kpiPendingReceipts');
    if (kpiPending) kpiPending.textContent = `${pendingDonations.length} Transaksi`;
  }

  // Render Recent Administrative Activity Table (#overviewAuditLogTableBody)
  const auditBody = document.getElementById('overviewAuditLogTableBody');
  if (auditBody) {
    if (!systemAuditState || systemAuditState.length === 0) {
      auditBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.25rem;">Belum ada log aktivitas administratif terbaru.</td></tr>`;
    } else {
      auditBody.innerHTML = systemAuditState.slice(0, 8).map(log => `
        <tr>
          <td style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">${log.created_at || 'Baru Saja'}</td>
          <td><strong>${log.actor_name || 'Admin'}</strong> <span style="font-size: 0.72rem; color: var(--text-muted);">(${log.actor_role || 'admin'})</span></td>
          <td><span class="badge-tag-pill" style="font-size: 0.7rem;">${log.module || 'system'}</span></td>
          <td><code style="font-size: 0.75rem; color: var(--primary-purple);">${log.action || '-'}</code></td>
          <td style="font-size: 0.8rem;">${log.summary || '-'}</td>
        </tr>
      `).join('');
    }
  }

  const pendingDonations = donationsState.filter(d => (d.paymentStatus || d.status) === 'pending');

  // Render Overview Pending Table
  const pendingTable = document.getElementById('overviewPendingDonationsTable');
  if (pendingTable) {
    if (pendingDonations.length === 0) {
      pendingTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Tidak ada donasi transfer pending.</td></tr>`;
    } else {
      pendingTable.innerHTML = pendingDonations.map(t => `
        <tr>
          <td>
            <strong>${t.donorName}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${t.invoiceNumber}</div>
          </td>
          <td class="col-desktop-only">${(t.campaignTitle || '').substring(0, 24)}...</td>
          <td><strong style="color: #059669;">Rp ${t.amount.toLocaleString('id-ID')}</strong></td>
          <td class="col-desktop-only"><span class="status-pill status-pending">Menunggu Verifikasi</span></td>
          <td>
            <button class="btn btn-primary btn-sm btn-inspect-receipt" data-id="${t.id}" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;">
              Periksa Struk
            </button>
          </td>
        </tr>
      `).join('');

      pendingTable.querySelectorAll('.btn-inspect-receipt').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          openReceiptModal(id);
        });
      });
    }
  }

  // Render Overview PPDB Table
  const ppdbTable = document.getElementById('overviewPPDBTable');
  if (ppdbTable) {
    ppdbTable.innerHTML = ppdbState.slice(0, 6).map(p => {
      const shortJenjang = getShortJenjang(p.programName, p.programId);
      return `
        <tr class="ppdb-overview-row" data-id="${p.id}" style="cursor: pointer;">
          <td style="white-space: nowrap;">
            <strong style="white-space: nowrap; font-size: 0.82rem;">${p.studentName}</strong>
          </td>
          <td style="white-space: nowrap; text-align: center;">
            <span class="badge-tag-pill" style="font-size: 0.72rem; white-space: nowrap; padding: 0.2rem 0.5rem;">${shortJenjang}</span>
          </td>
          <td class="col-desktop-only">${p.parentName}</td>
          <td class="col-desktop-only">${p.registeredAt}</td>
          <td style="white-space: nowrap; text-align: right;">
            <span class="status-pill ${getPPDBStatusClass(p.status)}" style="white-space: nowrap; font-size: 0.72rem;">
              ${getPPDBStatusLabel(p.status)}
            </span>
          </td>
          <td class="col-desktop-only">
            <button class="btn-icon-action btn-inspect-ppdb-overview" data-id="${p.id}" title="Lihat Dossier Calon Santri">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    ppdbTable.querySelectorAll('.ppdb-overview-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        openAdminPPDBDetailModal(id);
      });
    });

    ppdbTable.querySelectorAll('.btn-inspect-ppdb-overview').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        openAdminPPDBDetailModal(id);
      });
    });
  }
}

// 3. Render Akademik Panel & Program Editor
function renderAdminAkademik() {
  const tbody = document.getElementById('adminProgramsTableBody');
  if (tbody) {
    tbody.innerHTML = programsState.map(p => `
      <tr>
        <td>
          <strong>${p.name}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${p.shortTitle || p.id} • <span style="color: ${p.publicationStatus === 'draft' ? '#d97706' : '#059669'};">${p.publicationStatus || 'published'}</span></div>
        </td>
        <td class="col-desktop-only"><span class="badge-tag-pill" style="font-size: 0.72rem;">${p.category === 'formal' ? 'Formal' : 'Non-Formal'}</span></td>
        <td class="col-desktop-only">${p.stats?.targetHafalan || '30 Juz'}</td>
        <td class="col-desktop-only">${p.stats?.durasi || '3 Tahun'}</td>
        <td>
          <label class="switch-label">
            <div class="switch-toggle">
              <input type="checkbox" class="program-ppdb-switch" data-id="${p.id}" ${p.ppdbOpen ? 'checked' : ''} />
              <span class="switch-slider"></span>
            </div>
            <span class="switch-text">${p.ppdbOpen ? 'Buka' : 'Tutup'}</span>
          </label>
        </td>
        <td class="col-desktop-only">
          <a href="#" class="btn-download-syllabus" data-id="${p.id}" style="color: var(--primary-600); font-weight: 700; text-decoration: underline; font-size: 0.82rem;">
            Silabus-${p.id.toUpperCase()}.pdf
          </a>
        </td>
        <td>
          <div class="table-action-btns">
            <button class="btn-icon-action btn-edit-program-detail" data-id="${p.id}" title="Kelola Detail Program & Skema Form PPDB">✏️</button>
            <button class="btn-icon-action btn-upload-single-syllabus" data-id="${p.id}" title="Unggah Revisi Silabus">
              ${getIconSvg('download', 14)}
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Toggle switch listeners (wired to backend API)
    tbody.querySelectorAll('.program-ppdb-switch').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const prog = programsState.find(p => p.id === id);
        if (prog) {
          prog.ppdbOpen = e.target.checked;
          const label = e.target.closest('.switch-label').querySelector('.switch-text');
          if (label) label.textContent = prog.ppdbOpen ? 'Buka' : 'Tutup';
          try {
            await programsApi.toggleStatus(id);
          } catch {
            // offline fallback
          }
          showToast(`Status PPDB ${prog.name} berhasil diubah menjadi: ${prog.ppdbOpen ? 'Buka' : 'Tutup'}`, 'success');
        }
      });
    });

    tbody.querySelectorAll('.btn-edit-program-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openProgramEditPage(id);
      });
    });

    tbody.querySelectorAll('.btn-download-syllabus').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.getAttribute('data-id');
        const prog = programsState.find(p => p.id === id);
        showToast(`Mengunduh dokumen Silabus Kurikulum Resmi ${prog ? prog.name : ''}...`, 'success');
      });
    });

    tbody.querySelectorAll('.btn-upload-single-syllabus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const select = document.getElementById('syllabusProgramSelect');
        if (select) select.value = id;
        const modal = document.getElementById('adminSyllabusModal');
        if (modal) modal.classList.add('open');
      });
    });
  }

  // Render PPDB Table
  renderAdminPPDBTable();
}

function renderCustomSchemaRowHtml(field = {}) {
  const label = field.label || '';
  const type = field.type || 'text';
  const required = field.required !== false;
  const options = field.options || '';
  return `
    <div class="program-custom-field-row" style="display: grid; grid-template-columns: 2fr 1fr 1.5fr auto auto; gap: 0.5rem; align-items: center; background: #fff; padding: 0.55rem; border-radius: 6px; border: 1px solid rgba(0,0,0,0.08);">
      <input type="text" class="form-input custom-field-label" placeholder="Label Pertanyaan (misal: Hafalan Saat Ini)" value="${label}" required style="padding: 0.4rem 0.6rem; font-size: 0.82rem;" />
      <select class="form-select custom-field-type" style="padding: 0.4rem 0.6rem; font-size: 0.82rem;">
        <option value="text" ${type === 'text' ? 'selected' : ''}>Teks Singkat</option>
        <option value="textarea" ${type === 'textarea' ? 'selected' : ''}>Teks Panjang</option>
        <option value="select" ${type === 'select' ? 'selected' : ''}>Pilihan Dropdown</option>
        <option value="number" ${type === 'number' ? 'selected' : ''}>Angka</option>
      </select>
      <input type="text" class="form-input custom-field-options" placeholder="Opsi koma (jika dropdown)" value="${options}" style="padding: 0.4rem 0.6rem; font-size: 0.82rem;" />
      <label style="font-size: 0.78rem; display: flex; align-items: center; gap: 0.25rem; white-space: nowrap;">
        <input type="checkbox" class="custom-field-required" ${required ? 'checked' : ''} /> Wajib
      </label>
      <button type="button" class="btn-icon-action btn-remove-custom-field" title="Hapus Pertanyaan" style="color: #dc2626;">✕</button>
    </div>
  `;
}

export function openProgramEditPage(programId = null) {
  const form = document.getElementById('adminProgramEditForm');
  const titleHeading = document.getElementById('programFormTitleHeading');
  const idInput = document.getElementById('programFormIdInput');
  const customContainer = document.getElementById('programCustomFieldsContainer');
  if (!form) return;

  if (programId) {
    const p = programsState.find(item => item.id === programId) || PROGRAMS.find(item => item.id === programId);
    if (p) {
      if (titleHeading) titleHeading.textContent = `Edit Program Akademik: ${p.name}`;
      if (idInput) {
        idInput.value = p.id;
        idInput.readOnly = true;
      }
      document.getElementById('programFormTitle').value = p.name || '';
      document.getElementById('programFormCategory').value = p.category || 'formal';
      document.getElementById('programFormTarget').value = p.stats?.targetHafalan || '30 Juz';
      document.getElementById('programFormDuration').value = p.stats?.durasi || '3 Tahun';
      document.getElementById('programFormSubtitle').value = p.headline || p.summary || '';
      document.getElementById('programFormEligibility').value = p.eligibilityCriteria || p.about?.target || '';
      document.getElementById('programFormSchedule').value = p.scheduleInfo || '';
      document.getElementById('programFormInstructions').value = p.applicationInstructions || '';
      document.getElementById('programFormImage').value = p.image || '/assets/images/classroom.jpg';
      document.getElementById('programFormPubStatus').value = p.publicationStatus || 'published';
      document.getElementById('programFormIsOpen').value = p.ppdbOpen !== false ? '1' : '0';

      if (customContainer) {
        const schema = Array.isArray(p.formSchema) ? p.formSchema : [];
        customContainer.innerHTML = schema.map(f => renderCustomSchemaRowHtml(f)).join('');
        customContainer.querySelectorAll('.btn-remove-custom-field').forEach(btn => {
          btn.addEventListener('click', (e) => e.currentTarget.closest('.program-custom-field-row')?.remove());
        });
      }
    }
  } else {
    if (titleHeading) titleHeading.textContent = 'Tambah Program Akademik Baru';
    form.reset();
    if (idInput) {
      idInput.value = '';
      idInput.readOnly = false;
    }
    document.getElementById('programFormImage').value = '/assets/images/classroom.jpg';
    if (customContainer) customContainer.innerHTML = '';
  }

  window.location.hash = '#admin-program-form';
}

function renderAdminPPDBTable() {
  const ppdbBody = document.getElementById('adminPPDBTableBody');
  const countBadge = document.getElementById('adminPPDBCountBadge');
  const searchInput = document.getElementById('filterPPDBSearch');
  const progFilter = document.getElementById('filterPPDBProgram');
  const statusFilter = document.getElementById('filterPPDBStatus');
  const dateFilter = document.getElementById('filterPPDBDateRange');
  const btnExport = document.getElementById('btnExportPPDB');

  if (btnExport && !btnExport.dataset.initialized) {
    btnExport.dataset.initialized = 'true';
    btnExport.addEventListener('click', () => {
      window.open(ppdbApi.exportCsvUrl, '_blank');
      showToast('Mengunduh data pendaftar santri PPDB...', 'info');
    });
  }

  // Bind filter events once
  if (searchInput && !searchInput.dataset.initialized) {
    searchInput.dataset.initialized = 'true';
    searchInput.addEventListener('input', (e) => {
      adminPPDBFilter.search = e.target.value.toLowerCase().trim();
      renderAdminPPDBTable();
    });
  }
  if (progFilter && !progFilter.dataset.initialized) {
    progFilter.dataset.initialized = 'true';
    progFilter.addEventListener('change', (e) => {
      adminPPDBFilter.program = e.target.value;
      renderAdminPPDBTable();
    });
  }
  if (statusFilter && !statusFilter.dataset.initialized) {
    statusFilter.dataset.initialized = 'true';
    statusFilter.addEventListener('change', (e) => {
      adminPPDBFilter.status = e.target.value;
      renderAdminPPDBTable();
    });
  }
  if (dateFilter && !dateFilter.dataset.initialized) {
    dateFilter.dataset.initialized = 'true';
    dateFilter.addEventListener('change', (e) => {
      adminPPDBFilter.dateRange = e.target.value;
      renderAdminPPDBTable();
    });
  }

  if (!ppdbBody) return;

  // Filter leads
  const filtered = ppdbState.filter(l => {
    if (adminPPDBFilter.status !== 'all' && l.status !== adminPPDBFilter.status) {
      return false;
    }
    if (adminPPDBFilter.program !== 'all' && l.programId !== adminPPDBFilter.program) {
      return false;
    }
    if (adminPPDBFilter.search) {
      const s = adminPPDBFilter.search;
      const matchName = (l.studentName || '').toLowerCase().includes(s);
      const matchParent = (l.parentName || '').toLowerCase().includes(s);
      const matchPhone = (l.phone || '').toLowerCase().includes(s);
      const matchId = (l.id || '').toLowerCase().includes(s);
      if (!matchName && !matchParent && !matchPhone && !matchId) {
        return false;
      }
    }
    return true;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length} Pendaftar`;
  }

  if (filtered.length === 0) {
    ppdbBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          Tidak ada data calon santri yang cocok dengan filter yang dipilih.
        </td>
      </tr>
    `;
    return;
  }

  ppdbBody.innerHTML = filtered.map(lead => {
    let cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith('8')) {
      cleanPhone = '62' + cleanPhone;
    }
    const waText = encodeURIComponent(`Assalamu'alaikum Warahmatullah Bapak/Ibu ${lead.parentName || 'Wali Santri'}, kami dari Panitia PPDB Rumah Tahfidz Madani terkait pendaftaran ananda ${lead.studentName}...`);
    return `
      <tr class="ppdb-table-row" data-id="${lead.id}" style="cursor: pointer;">
        <td class="col-desktop-only"><code style="font-size: 0.78rem; font-weight: 700; color: var(--primary-purple);">${lead.id}</code></td>
        <td>
          <strong style="white-space: nowrap;">${lead.studentName}</strong>
          <div style="font-size: 0.72rem; color: var(--text-muted); white-space: nowrap;">${lead.gender} • ${getShortJenjang(lead.programName, lead.programId)}</div>
        </td>
        <td class="col-desktop-only col-ppdb-program">
          <div class="ppdb-program-cell">
            <span class="badge-tag-pill ppdb-program-badge" title="${lead.programName}">${lead.programName}</span>
            <div class="ppdb-batch-subtitle">${lead.batchId}</div>
          </div>
        </td>
        <td class="col-desktop-only">${lead.parentName}</td>
        <td class="col-desktop-only">
          <a href="https://wa.me/${cleanPhone}?text=${waText}" target="_blank" rel="noopener noreferrer" class="ppdb-wa-link" title="Chat langsung via WhatsApp" onclick="event.stopPropagation();">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.001.572 1.77.877 2.806.877 3.182 0 5.768-2.587 5.768-5.766.001-3.18-2.585-5.76-5.768-5.76zm3.393 8.354c-.144.405-.837.774-1.17.824-.312.045-.694.074-2.158-.535-1.748-.727-2.88-2.5-2.967-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.087-.177.183-.076.357.101.174.45 0.742.965 1.201.662.59 1.221.774 1.394.86.173.086.275.073.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086.159.058 1.011.477 1.184.564.173.087.289.13.332.202.043.073.043.419-.101.824z"/></svg>
            <span>${lead.phone}</span>
          </a>
        </td>
        <td class="col-desktop-only">${lead.registeredAt}</td>
        <td>
          <span class="status-pill ${getPPDBStatusClass(lead.status)}">
            ${getPPDBStatusLabel(lead.status)}
          </span>
        </td>
        <td>
          <div class="table-action-btns">
            <button class="btn-icon-action btn-view-lead" data-id="${lead.id}" title="Lihat Dossier Calon Santri">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-icon-action approve-btn btn-accept-lead" data-id="${lead.id}" title="Terima / Ceklis Santri" style="color: #059669;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button class="btn-icon-action btn-delete-lead" data-id="${lead.id}" title="Hapus / Buang Data Santri" style="color: #dc2626;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Row click opens dossier modal
  ppdbBody.querySelectorAll('.ppdb-table-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      const id = row.getAttribute('data-id');
      openAdminPPDBDetailModal(id);
    });
  });

  // Attach table row actions
  ppdbBody.querySelectorAll('.btn-view-lead').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      openAdminPPDBDetailModal(id);
    });
  });

  ppdbBody.querySelectorAll('.btn-accept-lead').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const lead = ppdbState.find(l => l.id === id);
      try {
        await ppdbApi.updateStatus(id, 'accepted');
        showToast(`Alhamdulillah! Santri ${lead ? lead.studentName : ''} dinyatakan DITERIMA!`, 'success');
        await syncDatabaseState();
        renderAdminPPDBTable();
        renderAdminOverview();
      } catch (err) {
        showToast('Gagal menerima santri: ' + err.message, 'error');
      }
    });
  });

  ppdbBody.querySelectorAll('.btn-verify-lead').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const lead = ppdbState.find(l => l.id === id);
      try {
        await ppdbApi.updateStatus(id, 'verified');
        showToast(`Berkas santri ${lead ? lead.studentName : ''} berhasil DIVERIFIKASI!`, 'success');
        await syncDatabaseState();
        renderAdminPPDBTable();
        renderAdminOverview();
      } catch (err) {
        showToast('Gagal memverifikasi: ' + err.message, 'error');
      }
    });
  });

  ppdbBody.querySelectorAll('.btn-delete-lead').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }
      const id = e.currentTarget.getAttribute('data-id');
      const lead = ppdbState.find(l => l.id === id);
      const confirmed = await showInteractiveConfirm({
        title: 'Hapus Calon Santri',
        message: `Hapus permanen berkas pendaftaran calon santri <strong>"${lead ? lead.studentName : id}"</strong>? Tindakan ini tidak dapat dibatalkan.`,
        confirmText: 'Ya, Hapus Pendaftaran'
      });
      if (!confirmed) return;
      try {
        await ppdbApi.delete(id);
        showToast('Data pendaftaran santri berhasil dihapus.', 'info');
        await syncDatabaseState();
        renderAdminPPDBTable();
        renderAdminOverview();
      } catch (err) {
        showToast('Gagal menghapus data: ' + err.message, 'error');
      }
    });
  });
}

// 4. Render Modul Wakaf & Donasi Panel (Independent Financial Ledger + Audit Trail)
function renderAdminDonasi() {
  // Populate Campaign Filter Dropdown & Manual Donation Campaign Select
  const campFilterSelect = document.getElementById('donationCampaignFilter');
  if (campFilterSelect) {
    const currentVal = state.donationCampaignFilter || 'all';
    campFilterSelect.innerHTML = `
      <option value="all">Semua Campaign & Infaq</option>
      <option value="general">Infaq & Wakaf Umum (Tanpa Campaign)</option>
      ${campaignsState.map(c => `<option value="${c.id}">${c.title}</option>`).join('')}
    `;
    campFilterSelect.value = currentVal;
  }

  const manualCampSelect = document.getElementById('manualTrxCampaign');
  if (manualCampSelect) {
    manualCampSelect.innerHTML = `
      <option value="general">Infaq & Wakaf Umum (Non-Campaign)</option>
      ${campaignsState.map(c => `<option value="${c.id}">${c.title}</option>`).join('')}
    `;
  }

  // Render Campaign Cards Grid
  const campGrid = document.getElementById('adminCampaignsGrid');
  const campBadge = document.getElementById('campaignsCountBadge');
  if (campBadge) campBadge.textContent = `${campaignsState.length} Program Terdaftar`;

  const campStatusLabel = (st) => {
    if (st === 'active') return 'Aktif';
    if (st === 'completed') return 'Selesai';
    if (st === 'closed') return 'Ditutup';
    if (st === 'archived') return 'Diarsipkan';
    return 'Draft';
  };

  if (campGrid) {
    campGrid.innerHTML = campaignsState.map(c => {
      const pct = Math.min(100, (c.collectedAmount / Math.max(1, c.targetAmount) * 100)).toFixed(1);
      return `
        <div class="admin-campaign-card" data-id="${c.id}" style="cursor: pointer;">
          <div class="campaign-card-thumb">
            <img src="${c.image}" alt="${c.title}" />
            <span class="campaign-card-category-badge">${c.category}</span>
          </div>
          <div class="campaign-card-body">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="badge-tag-pill" style="font-size: 0.72rem; text-transform: uppercase;">${c.type}</span>
              <span class="status-pill ${c.status === 'active' ? 'status-active' : (c.status === 'completed' ? 'status-success' : 'status-draft')}">
                ${campStatusLabel(c.status)}
              </span>
            </div>
            <h4 class="campaign-card-title">${c.title}</h4>
            <div class="admin-progress-box">
              <div class="admin-progress-bar">
                <div class="admin-progress-fill" style="width: ${pct}%;"></div>
              </div>
              <div class="admin-progress-meta">
                <span class="campaign-progress-collected">Terkumpul: <strong>Rp ${c.collectedAmount.toLocaleString('id-ID')}</strong></span>
                <span><strong>${pct}%</strong></span>
              </div>
            </div>
            <div class="campaign-card-meta-secondary" style="display: flex; justify-content: space-between; font-size: 0.76rem; color: var(--text-muted); border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.5rem;">
              <span>Target: Rp ${c.targetAmount.toLocaleString('id-ID')}</span>
              <span>Donatur: ${c.donorCount} Orang</span>
            </div>
            <button class="btn btn-secondary btn-sm btn-edit-campaign" data-id="${c.id}" style="margin-top: 0.25rem;">
              Kelola & Edit
            </button>
          </div>
        </div>
      `;
    }).join('');

    campGrid.querySelectorAll('.admin-campaign-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        openCampaignModal(id);
      });
    });

    campGrid.querySelectorAll('.btn-edit-campaign').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        openCampaignModal(id);
      });
    });
  }

  // Render Donations Table & Financial Audit Trail
  renderDonationTransactionsTable();
  renderFinancialAuditTable();
}

async function renderFinancialAuditTable() {
  const tbody = document.getElementById('adminFinancialAuditTableBody');
  if (!tbody) return;

  try {
    const res = await donationsApi.getAuditLogs();
    if (res && Array.isArray(res.data)) {
      financialAuditState = res.data;
    }
  } catch {
    // offline fallback
  }

  if (!financialAuditState || financialAuditState.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.25rem;">Belum ada riwayat verifikasi atau koreksi finansial.</td></tr>`;
    return;
  }

  tbody.innerHTML = financialAuditState.slice(0, 15).map(log => {
    let prevStr = '-';
    let newStr = '-';
    try {
      const p = typeof log.previous_value === 'string' ? JSON.parse(log.previous_value) : (log.previous_value || {});
      const n = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : (log.new_value || {});
      prevStr = p.payment_status ? `${p.payment_status} (Rp ${Number(p.amount || 0).toLocaleString('id-ID')})` : JSON.stringify(p);
      newStr = n.payment_status ? `${n.payment_status} (Rp ${Number(n.amount || 0).toLocaleString('id-ID')})` : JSON.stringify(n);
    } catch {
      // ignore
    }
    return `
      <tr>
        <td style="font-size: 0.76rem; color: var(--text-muted); white-space: nowrap;">${log.created_at || 'Baru Saja'}</td>
        <td><code style="font-size: 0.75rem;">${log.invoice_number || log.donation_id}</code></td>
        <td><span class="badge-tag-pill" style="font-size: 0.7rem;">${log.action_type}</span></td>
        <td style="font-size: 0.76rem;">${prevStr} → <strong>${newStr}</strong></td>
        <td style="font-size: 0.78rem;">${log.reason || '-'}</td>
        <td style="font-size: 0.78rem;"><strong>${log.actor_name || 'Admin'}</strong></td>
      </tr>
    `;
  }).join('');
}

function renderDonationTransactionsTable() {
  const tbody = document.getElementById('adminDonationTableBody');
  if (!tbody) return;

  let filtered = donationsState;

  if (state.activeDonationStatusFilter !== 'all') {
    if (state.activeDonationStatusFilter === 'rejected') {
      filtered = filtered.filter(d => d.paymentStatus === 'rejected' || d.paymentStatus === 'failed' || d.paymentStatus === 'voided');
    } else {
      filtered = filtered.filter(d => d.paymentStatus === state.activeDonationStatusFilter);
    }
  }

  if (state.donationCampaignFilter && state.donationCampaignFilter !== 'all') {
    filtered = filtered.filter(d => (d.campaignId || 'general') === state.donationCampaignFilter);
  }

  if (state.donationSearchQuery.trim()) {
    const q = state.donationSearchQuery.toLowerCase();
    filtered = filtered.filter(d =>
      (d.invoiceNumber || '').toLowerCase().includes(q) ||
      (d.donorName || '').toLowerCase().includes(q) ||
      (d.campaignTitle || '').toLowerCase().includes(q) ||
      (d.referenceNumber || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Tidak ada transaksi donasi sesuai filter.</td></tr>`;
    return;
  }

  const getDonStatusLabel = (st) => {
    if (st === 'success') return 'Sukses';
    if (st === 'pending') return 'Menunggu';
    if (st === 'voided') return 'Void / Batal';
    return 'Ditolak / Gagal';
  };

  tbody.innerHTML = filtered.map(t => `
    <tr class="donation-table-row" data-id="${t.id}" style="cursor: pointer;">
      <td class="col-desktop-only"><code>${t.invoiceNumber}</code></td>
      <td>
        <strong>${t.donorName}</strong>
        ${t.isAnonymous ? '<span class="badge-tag-pill" style="font-size: 0.65rem; margin-left: 0.25rem;">Hamba Allah</span>' : ''}
        <div style="font-size: 0.74rem; color: var(--text-muted);">${t.donorPhone}${t.referenceNumber ? ` • Ref: ${t.referenceNumber}` : ''}</div>
      </td>
      <td class="col-desktop-only">${t.campaignTitle.substring(0, 28)}...</td>
      <td><strong style="color: #059669; font-size: 0.95rem;">Rp ${t.amount.toLocaleString('id-ID')}</strong></td>
      <td class="col-desktop-only"><span style="font-size: 0.82rem;">${t.paymentSource || t.paymentMethod}</span></td>
      <td class="col-desktop-only"><span style="font-size: 0.78rem; color: var(--text-muted);">${t.paidAt}</span></td>
      <td>
        <span class="status-pill ${t.paymentStatus === 'success' ? 'status-success' : (t.paymentStatus === 'pending' ? 'status-pending' : 'status-failed')}">
          ${getDonStatusLabel(t.paymentStatus)}
        </span>
      </td>
      <td>
        <div class="table-action-btns">
          ${t.paymentStatus === 'pending' ? `
            <button class="btn btn-primary btn-sm btn-inspect-receipt" data-id="${t.id}" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;">
              Periksa Struk
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm btn-inspect-receipt" data-id="${t.id}" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">
              Detail / Koreksi
            </button>
          `}
          <button class="btn-icon-action btn-send-wa-receipt" data-id="${t.id}" title="Kirim Kwitansi Donasi WA">
            💬
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Row click opens receipt modal
  tbody.querySelectorAll('.donation-table-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      const id = row.getAttribute('data-id');
      openReceiptModal(id);
    });
  });

  tbody.querySelectorAll('.btn-inspect-receipt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      openReceiptModal(id);
    });
  });

  tbody.querySelectorAll('.btn-send-wa-receipt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      const trx = donationsState.find(d => d.id === id);
      if (trx) {
        const text = encodeURIComponent(`Assalamu'alaikum wr. wb. Terima kasih kepada Bapak/Ibu ${trx.donorName} atas donasi wakaf sebesar Rp ${trx.amount.toLocaleString('id-ID')} (${trx.invoiceNumber}) untuk ${trx.campaignTitle}. Jazakumullah Khairan Katsiran.`);
        window.open(`https://wa.me/${(trx.donorPhone || '').replace(/^0/, '62')}?text=${text}`, '_blank');
      }
    });
  });
}

// 5. Render Galeri & Kunjungan Panel + Shared Media Library
function renderAdminGaleri() {
  const visitBody = document.getElementById('adminVisitTableBody');
  if (visitBody) {
    visitBody.innerHTML = visitsState.map(v => `
      <tr>
        <td><strong>${v.groupName}</strong></td>
        <td class="col-desktop-only">${v.leaderName}</td>
        <td class="col-desktop-only"><a href="https://wa.me/${(v.phone || '').replace(/^0/, '62')}" target="_blank" style="color: #059669; font-weight: 600;">${v.phone}</a></td>
        <td><strong>${v.date}</strong></td>
        <td class="col-desktop-only">${v.count} Orang</td>
        <td class="col-desktop-only" style="max-width: 220px; font-size: 0.8rem;">${v.goal}</td>
        <td>
          <span class="status-pill ${v.status === 'confirmed' ? 'status-success' : 'status-pending'}">
            ${v.status === 'confirmed' ? 'Disetujui' : 'Menunggu'}
          </span>
        </td>
        <td>
          ${v.status === 'pending' ? `
            <button class="btn btn-primary btn-sm btn-confirm-visit-action" data-id="${v.id}" style="font-size: 0.75rem; background: #10b981; border-color: #10b981;">
              ✓ Setujui Jadwal
            </button>
          ` : `
            <span style="font-size: 0.78rem; color: #059669; font-weight: 700;">✓ Terkonfirmasi</span>
          `}
        </td>
      </tr>
    `).join('');

    visitBody.querySelectorAll('.btn-confirm-visit-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const v = visitsState.find(item => item.id === id);
        if (v) {
          v.status = 'confirmed';
          showToast(`Kunjungan rombongan ${v.groupName} pada ${v.date} telah DISETUJUI.`, 'success');
          renderAdminGaleri();
          updateNotificationBell();
        }
      });
    });
  }

  // Mini Media Grid in Admin Panel Galeri
  const mediaGrid = document.getElementById('adminMediaMiniGrid');
  if (mediaGrid) {
    let items = (galleriesState && galleriesState.length > 0) ? [...galleriesState] : [...GALLERIES];
    if (state.adminGalleryCategoryFilter && state.adminGalleryCategoryFilter !== 'all') {
      items = items.filter(g => g.category === state.adminGalleryCategoryFilter);
    }
    if (state.adminGalleryStatusFilter && state.adminGalleryStatusFilter !== 'all') {
      items = items.filter(g => (g.status || 'published') === state.adminGalleryStatusFilter);
    }
    items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    mediaGrid.innerHTML = items.map(g => `
      <div class="admin-media-card" style="border-radius: var(--radius-md); overflow: hidden; border: 1px solid rgba(0,0,0,0.08); background: #000; height: 120px; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <img src="${g.image}" alt="${g.altText || g.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/assets/images/campus.jpg';" />
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.85) 100%); pointer-events: none;"></div>
        <button type="button" class="btn-edit-gal-item" data-id="${g.id}" title="Edit Metadata & Urutan" style="position: absolute; top: 6px; left: 6px; background: rgba(15, 23, 42, 0.78); color: #fff; border: none; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.72rem;">
          ✏️
        </button>
        <button type="button" class="btn-delete-gal-item" data-id="${g.id}" title="Hapus Media Galeri" style="position: absolute; top: 6px; right: 6px; background: rgba(220, 38, 38, 0.85); color: #fff; border: none; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; transition: background 0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='rgba(220,38,38,0.85)'">
          🗑️
        </button>
        <div style="position: absolute; bottom: 6px; left: 6px; right: 6px; display: flex; justify-content: space-between; align-items: flex-end;">
          <span style="color: #fff; font-size: 0.7rem; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">
            ${g.title}
          </span>
          <span style="background: ${g.status === 'draft' ? 'rgba(217, 119, 6, 0.9)' : 'rgba(16, 185, 129, 0.85)'}; color: #fff; font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 600; text-transform: uppercase;">
            ${g.status === 'draft' ? 'Draft' : (g.category || 'Galeri')}
          </span>
        </div>
      </div>
    `).join('');

    mediaGrid.querySelectorAll('.btn-edit-gal-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const gId = e.currentTarget.getAttribute('data-id');
        const gItem = (galleriesState || []).find(item => String(item.id) === String(gId));
        if (!gItem) return;
        const galleryModal = document.getElementById('adminGalleryModal');
        document.getElementById('galleryFormId').value = gItem.id;
        document.getElementById('galleryFormTitle').value = gItem.title || '';
        document.getElementById('galleryFormCategory').value = gItem.category || 'gedung';
        document.getElementById('galleryFormAlbum').value = gItem.albumName || '';
        document.getElementById('galleryFormSortOrder').value = gItem.sortOrder || 0;
        document.getElementById('galleryFormStatus').value = gItem.status || 'published';
        document.getElementById('galleryFormDate').value = gItem.date || '';
        document.getElementById('galleryFormUrl').value = gItem.image || '';
        document.getElementById('galleryFormAltText').value = gItem.altText || gItem.title || '';
        document.getElementById('galleryFormCaption').value = gItem.caption || '';
        if (galleryModal) galleryModal.classList.add('open');
        window.location.hash = '#admin-gallery-form';
      });
    });

    mediaGrid.querySelectorAll('.btn-delete-gal-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const currentUser = auth.getStoredUser() || usersState[0];
        if (currentUser.role !== 'superadmin') {
          showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
          return;
        }
        const gId = e.currentTarget.getAttribute('data-id');
        const gItem = (galleriesState || []).find(item => String(item.id) === String(gId));
        const confirmed = await showInteractiveConfirm({
          title: 'Hapus Media Galeri',
          message: `Hapus media dokumentasi <strong>"${gItem ? gItem.title : 'ini'}"</strong> secara permanen dari server?`,
          confirmText: 'Ya, Hapus Media'
        });
        if (!confirmed) return;
        try {
          await galleriesApi.delete(gId);
          showToast('Media galeri berhasil dihapus dari sistem.', 'success');
          await syncDatabaseState();
          renderAdminGaleri();
          renderGalleryGrid();
        } catch (err) {
          showToast(err.message, 'warning');
        }
      });
    });
  }
}

export async function openMediaLibraryModal(onSelectCallback = null) {
  state.mediaPickerCallback = onSelectCallback;
  const modal = document.getElementById('mediaLibraryPickerModal');
  const grid = document.getElementById('mediaLibraryGrid');
  if (!modal || !grid) return;

  modal.classList.add('open');
  grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">Memuat pustaka media...</div>`;

  try {
    const res = await mediaApi.getAll();
    if (res && Array.isArray(res.data)) {
      mediaState = res.data;
    }
  } catch {
    // fallback
  }

  const defaultAssets = [
    { id: 'def-1', file_name: 'Campus RTM', file_url: '/assets/images/campus.jpg', alt_text: 'Kampus Rumah Tahfidz' },
    { id: 'def-2', file_name: 'Halaqoh Classroom', file_url: '/assets/images/classroom.jpg', alt_text: 'Suasana Halaqoh' },
    { id: 'def-3', file_name: 'Asrama Santri', file_url: '/assets/images/dormitory.jpg', alt_text: 'Asrama Tahfidz' },
    { id: 'def-4', file_name: 'Wisuda Akbar', file_url: '/assets/images/wisuda.jpg', alt_text: 'Wisuda Tahfidz' }
  ];
  const allMedia = [...mediaState, ...defaultAssets.filter(d => !mediaState.some(m => m.file_url === d.file_url))];

  grid.innerHTML = allMedia.map(m => `
    <div class="media-lib-item" data-url="${m.file_url}" data-alt="${m.alt_text || m.file_name}" style="border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; background: #fff; display: flex; flex-direction: column;">
      <div style="height: 100px; background: #0f172a; position: relative;">
        <img src="${m.file_url}" alt="${m.alt_text || m.file_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/assets/images/campus.jpg';" />
      </div>
      <div style="padding: 0.5rem; font-size: 0.74rem; display: flex; flex-direction: column; gap: 0.35rem; flex: 1; justify-content: space-between;">
        <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${m.file_name}">${m.file_name}</div>
        <div style="display: flex; gap: 0.25rem;">
          <button type="button" class="btn btn-primary btn-sm btn-select-media-asset" data-url="${m.file_url}" data-alt="${m.alt_text || m.file_name}" style="flex: 1; font-size: 0.7rem; padding: 0.25rem 0.4rem;">
            ${onSelectCallback ? 'Pilih' : 'Salin URL'}
          </button>
          ${!String(m.id).startsWith('def-') ? `<button type="button" class="btn btn-secondary btn-sm btn-delete-media-asset" data-id="${m.id}" style="font-size: 0.7rem; padding: 0.25rem 0.4rem; color: #dc2626;">🗑️</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.btn-select-media-asset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.currentTarget.getAttribute('data-url');
      const alt = e.currentTarget.getAttribute('data-alt');
      if (typeof state.mediaPickerCallback === 'function') {
        state.mediaPickerCallback(url, alt);
        modal.classList.remove('open');
        showToast('Media berhasil dipilih!', 'success');
      } else {
        navigator.clipboard?.writeText(url);
        showToast(`URL Media disalin: ${url}`, 'success');
      }
    });
  });

  grid.querySelectorAll('.btn-delete-media-asset').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      try {
        await mediaApi.delete(id);
        showToast('Aset media berhasil dihapus.', 'info');
        openMediaLibraryModal(state.mediaPickerCallback);
      } catch (err) {
        showToast('Gagal menghapus media: ' + err.message, 'warning');
      }
    });
  });
}

// 6. Render Artikel / Berita Panel
function renderAdminBerita() {
  const tbody = document.getElementById('adminArticlesTableBody');
  const badge = document.getElementById('adminArticleCountBadge');
  if (badge) badge.textContent = `${articlesState.length} Berita Terdaftar`;

  if (!tbody) return;

  let filtered = articlesState;
  if (state.adminArticleCategoryFilter && state.adminArticleCategoryFilter !== 'all') {
    filtered = filtered.filter(a => (a.category || '').toLowerCase() === state.adminArticleCategoryFilter.toLowerCase());
  }
  if (state.adminArticleStatusFilter && state.adminArticleStatusFilter !== 'all') {
    filtered = filtered.filter(a => (a.status || 'published') === state.adminArticleStatusFilter);
  }
  if (state.adminArticleSearchQuery.trim()) {
    const q = state.adminArticleSearchQuery.toLowerCase();
    filtered = filtered.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.category || '').toLowerCase().includes(q) ||
      (a.slug || '').toLowerCase().includes(q)
    );
  }

  tbody.innerHTML = filtered.map(art => `
    <tr>
      <td class="col-desktop-only">
        <div style="width: 50px; height: 40px; border-radius: 6px; overflow: hidden;">
          <img src="${art.image}" alt="${art.title}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
      </td>
      <td>
        <strong>${art.title}</strong>
        <div style="font-size: 0.74rem; color: var(--text-muted); font-family: monospace;">/${art.slug || art.id}</div>
      </td>
      <td class="col-desktop-only"><span class="badge-tag-pill" style="font-size: 0.72rem;">${art.category}</span></td>
      <td class="col-desktop-only">${art.author || 'Admin Media'}</td>
      <td class="col-desktop-only"><span style="font-size: 0.78rem; color: var(--text-muted);">${art.date}</span></td>
      <td>
        <label class="switch-label">
          <div class="switch-toggle">
            <input type="checkbox" class="article-publish-toggle" data-id="${art.id}" ${art.status === 'published' ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </div>
          <span class="switch-text">${art.status === 'published' ? 'Published' : (art.status === 'archived' ? 'Archived' : 'Draft')}</span>
        </label>
      </td>
      <td>
        <div class="table-action-btns">
          <button class="btn-icon-action btn-edit-article" data-id="${art.id}" title="Edit Artikel">✏️</button>
          <button class="btn-icon-action btn-delete-article" data-id="${art.id}" title="Hapus Artikel" style="color: #ef4444;">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Article publish toggle listener (persisted via API)
  tbody.querySelectorAll('.article-publish-toggle').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const art = articlesState.find(a => a.id === id);
      if (art) {
        art.status = e.target.checked ? 'published' : 'draft';
        const label = e.target.closest('.switch-label').querySelector('.switch-text');
        if (label) label.textContent = art.status === 'published' ? 'Published' : 'Draft';
        try {
          await articlesApi.toggleStatus(id, art.status);
        } catch {
          // fallback
        }
        showToast(`Status artikel "${art.title}" diubah menjadi: ${art.status.toUpperCase()}`, 'success');
        renderNewsGrid();
      }
    });
  });

  tbody.querySelectorAll('.btn-edit-article').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      openArticleModal(id);
    });
  });

  tbody.querySelectorAll('.btn-delete-article').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }
      const id = e.currentTarget.getAttribute('data-id');
      const targetArticle = articlesState.find(a => a.id === id);
      const artTitle = targetArticle ? targetArticle.title : 'artikel ini';
      const confirmed = await showInteractiveConfirm({
        title: 'Hapus Artikel Berita',
        message: `Apakah Anda yakin ingin menghapus artikel <strong>"${artTitle}"</strong>? Data artikel akan dihapus secara permanen dari sistem publikasi yayasan.`,
        confirmText: 'Ya, Hapus Artikel',
        confirmBtnClass: 'btn-danger'
      });
      if (confirmed) {
        try {
          await articlesApi.delete(id);
        } catch {
          // fallback
        }
        articlesState = articlesState.filter(a => a.id !== id);
        showToast('Artikel berhasil dihapus dari sistem.', 'success');
        renderAdminBerita();
        renderNewsGrid();
      }
    });
  });
}

// 7. Render Tampilan & Identitas Panel + Apply Published Settings to Public DOM
function applySiteSettingsToDOM(siteConf = {}) {
  if (!siteConf || typeof siteConf !== 'object') return;
  if (siteConf.title) INSTITUTION.name = siteConf.title;
  if (siteConf.shortTitle) INSTITUTION.shortName = siteConf.shortTitle;
  if (siteConf.tagline) INSTITUTION.tagline = siteConf.tagline;
  if (siteConf.mudir) INSTITUTION.mudir = siteConf.mudir;
  if (siteConf.whatsappPPDB) INSTITUTION.whatsappPPDB = siteConf.whatsappPPDB;
  if (siteConf.whatsappDonasi) INSTITUTION.whatsappDonasi = siteConf.whatsappDonasi;
  if (siteConf.email) INSTITUTION.email = siteConf.email;
  if (siteConf.address) INSTITUTION.address = siteConf.address;

  const heroTitleEl = document.querySelector('#view-home .hero-title');
  if (heroTitleEl && siteConf.heroTitle) {
    heroTitleEl.textContent = siteConf.heroTitle;
  }
  const footerCopyEl = document.querySelector('.site-footer .footer-bottom p');
  if (footerCopyEl && siteConf.footerCopyright) {
    footerCopyEl.textContent = siteConf.footerCopyright;
  }
}

function getAppearanceFormPayload() {
  return {
    title: document.getElementById('settingInstitutionName')?.value || INSTITUTION.name,
    shortTitle: document.getElementById('settingShortName')?.value || INSTITUTION.shortName,
    tagline: document.getElementById('settingTagline')?.value || INSTITUTION.tagline,
    mudir: document.getElementById('settingMudir')?.value || INSTITUTION.mudir,
    logoUrl: document.getElementById('settingLogoUrl')?.value || '/assets/images/logo-rtm.svg',
    whatsappPPDB: document.getElementById('settingWhatsappPPDB')?.value || INSTITUTION.whatsappPPDB,
    whatsappDonasi: document.getElementById('settingWhatsappDonasi')?.value || INSTITUTION.whatsappDonasi,
    email: document.getElementById('settingEmail')?.value || INSTITUTION.email,
    address: document.getElementById('settingAddress')?.value || INSTITUTION.address,
    bankAccountInfo: document.getElementById('settingBankAccountInfo')?.value || 'BSI 7199 8822 11 a.n. Yayasan Rumah Tahfidz Al-Hikmah',
    heroTitle: document.getElementById('settingHeroTitle')?.value || '',
    aboutSummary: document.getElementById('settingAboutSummary')?.value || '',
    vision: document.getElementById('settingVision')?.value || '',
    mission: document.getElementById('settingMission')?.value || '',
    socialInstagram: document.getElementById('settingSocialInstagram')?.value || '',
    socialYoutube: document.getElementById('settingSocialYoutube')?.value || '',
    navCtaLabel: document.getElementById('settingNavCtaLabel')?.value || 'Daftar PPDB Online',
    footerCopyright: document.getElementById('settingFooterCopyright')?.value || '© 2026 Yayasan Rumah Tahfidz Al-Hikmah. Hak Cipta Dilindungi.'
  };
}

function renderAdminTampilan() {
  const draftOrLive = settingsState.site_identity_draft || settingsState.site_identity || {};
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  };

  setVal('settingInstitutionName', draftOrLive.title || INSTITUTION.name);
  setVal('settingShortName', draftOrLive.shortTitle || INSTITUTION.shortName);
  setVal('settingTagline', draftOrLive.tagline || INSTITUTION.tagline);
  setVal('settingMudir', draftOrLive.mudir || INSTITUTION.mudir);
  setVal('settingLogoUrl', draftOrLive.logoUrl || '/assets/images/logo-rtm.svg');
  setVal('settingWhatsappPPDB', draftOrLive.whatsappPPDB || INSTITUTION.whatsappPPDB);
  setVal('settingWhatsappDonasi', draftOrLive.whatsappDonasi || INSTITUTION.whatsappDonasi);
  setVal('settingEmail', draftOrLive.email || INSTITUTION.email);
  setVal('settingAddress', draftOrLive.address || INSTITUTION.address);
  setVal('settingBankAccountInfo', draftOrLive.bankAccountInfo || 'BSI 7199 8822 11 a.n. Yayasan Rumah Tahfidz Al-Hikmah');
  if (draftOrLive.heroTitle) setVal('settingHeroTitle', draftOrLive.heroTitle);
  if (draftOrLive.aboutSummary) setVal('settingAboutSummary', draftOrLive.aboutSummary);
  if (draftOrLive.vision) setVal('settingVision', draftOrLive.vision);
  if (draftOrLive.mission) setVal('settingMission', draftOrLive.mission);
  if (draftOrLive.socialInstagram) setVal('settingSocialInstagram', draftOrLive.socialInstagram);
  if (draftOrLive.socialYoutube) setVal('settingSocialYoutube', draftOrLive.socialYoutube);
  if (draftOrLive.navCtaLabel) setVal('settingNavCtaLabel', draftOrLive.navCtaLabel);
  if (draftOrLive.footerCopyright) setVal('settingFooterCopyright', draftOrLive.footerCopyright);
}

// 8. Render Users & RBAC Panel
let selectedUserIdForDetail = 'usr-1';

function renderAdminUsers() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  const roleDescriptions = {
    superadmin: 'Full Access (Semua 7 Modul & Pengaturan Sistem)',
    editor: 'Artikel Berita, Akademik, dan Galeri Kegiatan',
    finance: 'Modul Wakaf & Donasi, Verifikasi Transfer Bank'
  };

  tbody.innerHTML = usersState.map(u => {
    const statusCellHtml = u.isActive === false
      ? `<td class="col-desktop-only"><span class="status-pill status-draft">Nonaktif</span></td>`
      : `<td class="col-desktop-only"><span class="status-pill status-success">Aktif</span></td>`;
    return `
    <tr class="user-table-row" data-id="${u.id}" style="cursor: pointer;">
      <td>
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">${u.avatar || u.name.substring(0, 2).toUpperCase()}</div>
          <div>
            <strong>${u.name}</strong>
          </div>
        </div>
      </td>
      <td class="col-desktop-only"><code>${u.email}</code></td>
      <td><span class="user-role-badge ${u.role}">${u.roleTitle || (u.role === 'superadmin' ? 'Admin' : (u.role === 'editor' ? 'Content' : 'Finance'))}</span></td>
      <td class="col-desktop-only" style="font-size: 0.78rem; color: var(--text-dark);">${roleDescriptions[u.role] || '-'}</td>
      <td class="col-desktop-only"><span style="font-size: 0.78rem; color: var(--text-muted);">${u.lastLogin}</span></td>
      ${statusCellHtml}
      <td>
        <div class="table-action-btns" style="display: flex; gap: 0.35rem; align-items: center;">
          <button type="button" class="btn btn-secondary btn-sm btn-edit-user-action" data-id="${u.id}" title="Ubah Akun Pengguna" style="font-size: 0.75rem; padding: 0.2rem 0.55rem;">
            ✏️ Ubah
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-delete-user-action" data-id="${u.id}" title="Hapus Pengguna" style="font-size: 0.75rem; padding: 0.2rem 0.55rem; color: #dc2626; border-color: rgba(220, 38, 38, 0.3);">
            🗑️ Hapus
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join('');

  // Row click navigates to user detail page
  tbody.querySelectorAll('.user-table-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      const id = row.getAttribute('data-id');
      selectedUserIdForDetail = id;
      window.location.hash = '#admin-user-detail';
    });
  });

  // Wire Ubah & Hapus action buttons
  tbody.querySelectorAll('.btn-edit-user-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }
      const id = e.currentTarget.getAttribute('data-id');
      const targetUser = usersState.find(u => u.id === id);
      if (targetUser) {
        openEditUserModal(targetUser);
      }
    });
  });

  tbody.querySelectorAll('.btn-delete-user-action').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }
      const id = e.currentTarget.getAttribute('data-id');
      const targetUser = usersState.find(u => u.id === id);
      if (!targetUser) return;
      if (targetUser.id === 'usr-1' || targetUser.id === currentUser.id) {
        showToast('Akun Admin utama atau akun aktif tidak dapat dihapus.', 'warning');
        return;
      }
      const confirmed = await showInteractiveConfirm({
        title: 'Hapus Akun Pengguna',
        message: `Apakah Anda yakin ingin menghapus akun <strong>"${targetUser.name}"</strong> (${targetUser.roleTitle || targetUser.role})? Akses masuk dan wewenang akun ini akan dicabut permanen.`,
        confirmText: 'Ya, Hapus Pengguna',
        confirmBtnClass: 'btn-danger'
      });
      if (!confirmed) return;
      try {
        await usersApi.delete(id);
        showToast(`Akun pengguna ${targetUser.name} berhasil dihapus.`, 'success');
        await syncDatabaseState();
        renderAdminUsers();
      } catch (err) {
        showToast(err.message, 'warning');
      }
    });
  });
}

export function renderUserDetailPage(userId) {
  if (userId) selectedUserIdForDetail = userId;
  const user = usersState.find(u => u.id === selectedUserIdForDetail) || usersState[0];
  if (!user) return;

  const roleConf = ROLES_CONFIG[user.role] || ROLES_CONFIG.superadmin;
  
  const avatarEl = document.getElementById('userDetailAvatar');
  const nameEl = document.getElementById('userDetailName');
  const roleBadgeEl = document.getElementById('userDetailRoleBadge');
  const emailSubEl = document.getElementById('userDetailEmailSubtitle');
  const idEl = document.getElementById('userDetailId');
  const emailEl = document.getElementById('userDetailEmail');
  const roleNameEl = document.getElementById('userDetailRoleName');
  const scopeEl = document.getElementById('userDetailScope');
  const forbiddenEl = document.getElementById('userDetailForbidden');
  const lastLoginEl = document.getElementById('userDetailLastLogin');
  const activePillEl = document.getElementById('userDetailActiveStatusPill');
  const opStatusEl = document.getElementById('userDetailOperationalStatus');
  const toggleActiveBtn = document.getElementById('btnDetailToggleUserActive');

  if (avatarEl) avatarEl.textContent = user.avatar || user.name.substring(0, 2).toUpperCase();
  if (nameEl) nameEl.textContent = user.name;
  if (roleBadgeEl) {
    roleBadgeEl.textContent = roleConf.name;
    roleBadgeEl.className = `user-role-badge ${roleConf.badgeClass}`;
  }
  if (emailSubEl) emailSubEl.textContent = user.email;
  if (idEl) idEl.textContent = user.id;
  if (emailEl) emailEl.textContent = user.email;
  if (roleNameEl) roleNameEl.textContent = `${roleConf.name} (${user.roleTitle || user.role})`;

  const isUserActive = user.isActive !== false;
  if (activePillEl) {
    activePillEl.textContent = isUserActive ? 'Aktif' : 'Nonaktif';
    activePillEl.className = `status-pill ${isUserActive ? 'status-success' : 'status-draft'}`;
  }
  if (opStatusEl) {
    opStatusEl.textContent = isUserActive ? 'Aktif & Terverifikasi' : 'Dinonaktifkan Sementara';
    opStatusEl.style.color = isUserActive ? '#059669' : '#d97706';
  }
  if (toggleActiveBtn) {
    toggleActiveBtn.textContent = isUserActive ? '🔒 Nonaktifkan Akun' : '🔓 Aktifkan Akun';
    toggleActiveBtn.onclick = async () => {
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }
      if (user.id === 'usr-1' || user.id === currentUser.id) {
        showToast('Akun Admin utama atau akun yang sedang login tidak dapat dinonaktifkan.', 'warning');
        return;
      }
      try {
        await usersApi.toggleStatus(user.id, !isUserActive);
        showToast(`Status akun ${user.name} berhasil diubah menjadi ${!isUserActive ? 'AKTIF' : 'NONAKTIF'}.`, 'success');
        await syncDatabaseState();
        renderUserDetailPage(user.id);
        renderAdminUsers();
      } catch (err) {
        showToast(err.message, 'warning');
      }
    };
  }

  const scopeMap = {
    superadmin: 'Akses Penuh (Full Access) ke seluruh 7 modul sistem',
    editor: 'Modul Artikel Berita, Akademik & Silabus, Galeri & Kunjungan',
    finance: 'Modul Wakaf & Donasi, Verifikasi Transfer Bank, Pembukuan CSV'
  };
  const forbiddenMap = {
    superadmin: 'Tidak ada batasan (Super Admin)',
    editor: 'Wakaf & Donasi Finansial, Manajemen Pengguna & RBAC',
    finance: 'Artikel Berita, Akademik & PPDB (PII Santri), Manajemen Pengguna & RBAC'
  };

  if (scopeEl) scopeEl.textContent = scopeMap[user.role] || '-';
  if (forbiddenEl) forbiddenEl.textContent = forbiddenMap[user.role] || '-';
  if (lastLoginEl) lastLoginEl.textContent = user.lastLogin || '-';

  // Wire detail action buttons
  const editBtn = document.getElementById('btnDetailEditUser');
  if (editBtn) {
    editBtn.onclick = () => {
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }
      openEditUserModal(user);
    };
  }

  const deleteBtn = document.getElementById('btnDetailDeleteUser');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }
      if (user.id === 'usr-1' || user.id === currentUser.id) {
        showToast('Akun Admin utama atau akun aktif tidak dapat dihapus.', 'warning');
        return;
      }
      const confirmed = await showInteractiveConfirm({
        title: 'Hapus Akun Pengguna',
        message: `Apakah Anda yakin ingin menghapus akun <strong>"${user.name}"</strong> (${user.roleTitle || user.role})? Akses masuk dan wewenang akun ini akan dicabut permanen.`,
        confirmText: 'Ya, Hapus Pengguna',
        confirmBtnClass: 'btn-danger'
      });
      if (!confirmed) return;
      try {
        await usersApi.delete(user.id);
        showToast(`Akun pengguna ${user.name} berhasil dihapus.`, 'success');
        await syncDatabaseState();
        renderAdminUsers();
        window.location.hash = '#admin-users';
      } catch (err) {
        showToast(err.message, 'warning');
      }
    };
  }
}

function openEditUserModal(user) {
  const userModal = document.getElementById('adminUserModal');
  if (!userModal) return;
  const title = document.getElementById('userModalTitle');
  const idInput = document.getElementById('userFormUserId');
  const nameInput = document.getElementById('userFormName');
  const emailInput = document.getElementById('userFormEmail');
  const passInput = document.getElementById('userFormPassword');
  const roleSelect = document.getElementById('userFormRole');
  const activeSelect = document.getElementById('userFormActiveStatus');

  if (title) title.textContent = 'Ubah Akun Pengguna';
  if (idInput) idInput.value = user.id;
  if (nameInput) nameInput.value = user.name;
  if (emailInput) emailInput.value = user.email;
  if (roleSelect) roleSelect.value = user.role;
  if (activeSelect) activeSelect.value = user.isActive === false ? '0' : '1';
  if (passInput) {
    passInput.value = '';
    passInput.required = false;
    passInput.placeholder = 'Kosongkan jika kata sandi tidak diubah...';
  }
  if (userModal) userModal.classList.add('open');
  window.location.hash = '#admin-user-form';
}

export function renderAdminProfile() {
  const currentUser = auth.getStoredUser() || usersState[0];
  const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;

  const nameInput = document.getElementById('profileFormName');
  const emailInput = document.getElementById('profileFormEmail');
  const previewAvatar = document.getElementById('profilePageAvatarPreview');
  const previewName = document.getElementById('profilePageDisplayName');
  const previewRole = document.getElementById('profilePageRoleBadge');

  if (nameInput) nameInput.value = currentUser.name || '';
  if (emailInput) emailInput.value = currentUser.email || '';
  if (previewAvatar) previewAvatar.textContent = currentUser.avatar || 'AD';
  if (previewName) previewName.textContent = currentUser.name || 'Pengguna Admin';
  if (previewRole) {
    previewRole.textContent = roleConf.name;
    previewRole.className = `user-role-badge ${roleConf.badgeClass}`;
  }

  const newPass = document.getElementById('profileFormNewPass');
  const confirmPass = document.getElementById('profileFormConfirmPass');
  if (newPass) newPass.value = '';
  if (confirmPass) confirmPass.value = '';
}

// 9. Receipt Verification & Financial Correction Modal Handlers
async function openReceiptModal(transactionId) {
  const trx = donationsState.find(d => d.id === transactionId);
  if (!trx) return;

  state.selectedReceiptTrx = trx;

  const modal = document.getElementById('adminReceiptModal');
  if (!modal) return;

  const img = modal.querySelector('#adminReceiptImg');
  const inv = modal.querySelector('#receiptModalInvoice');
  const statusPill = modal.querySelector('#receiptModalStatusPill');
  const donor = modal.querySelector('#receiptModalDonor');
  const camp = modal.querySelector('#receiptModalCampaign');
  const amount = modal.querySelector('#receiptModalAmount');
  const method = modal.querySelector('#receiptModalMethod');
  const refEl = modal.querySelector('#receiptModalRef');
  const time = modal.querySelector('#receiptModalTime');
  const notesInput = modal.querySelector('#receiptModalNotesInput');
  const waBtn = modal.querySelector('#btnSendWAReceipt');
  const correctAmount = modal.querySelector('#correctTrxAmount');
  const correctRef = modal.querySelector('#correctTrxRef');
  const correctStatus = modal.querySelector('#correctTrxStatus');
  const correctReason = modal.querySelector('#correctTrxReason');
  const auditList = modal.querySelector('#receiptModalAuditList');

  if (img) img.src = trx.receiptUrl || '/assets/images/dormitory.jpg';
  if (inv) inv.textContent = trx.invoiceNumber;
  if (statusPill) {
    statusPill.textContent = trx.paymentStatus === 'success' ? 'Terverifikasi (Sukses)' : (trx.paymentStatus === 'pending' ? 'Menunggu Verifikasi' : `Status: ${trx.paymentStatus}`);
    statusPill.className = `status-pill ${trx.paymentStatus === 'success' ? 'status-success' : (trx.paymentStatus === 'pending' ? 'status-pending' : 'status-failed')}`;
  }
  if (donor) donor.textContent = trx.donorName;
  if (camp) camp.textContent = trx.campaignTitle;
  if (amount) amount.textContent = `Rp ${trx.amount.toLocaleString('id-ID')}`;
  if (method) method.textContent = trx.paymentSource || trx.paymentMethod;
  if (refEl) refEl.textContent = trx.referenceNumber || '-';
  if (time) time.textContent = trx.paidAt;
  if (notesInput) notesInput.value = trx.notes || '';
  if (correctAmount) correctAmount.value = trx.amount || 0;
  if (correctRef) correctRef.value = trx.referenceNumber || '';
  if (correctStatus) correctStatus.value = trx.paymentStatus || 'success';
  if (correctReason) correctReason.value = '';

  if (waBtn) {
    const text = encodeURIComponent(`Assalamu'alaikum. Konfirmasi penerimaan donasi ${trx.invoiceNumber} sebesar Rp ${trx.amount.toLocaleString('id-ID')} telah disetujui.`);
    waBtn.href = `https://wa.me/${(trx.donorPhone || '').replace(/^0/, '62')}?text=${text}`;
  }

  modal.classList.add('open');

  // Populate transaction-specific audit logs
  if (auditList) {
    try {
      const res = await donationsApi.getAuditLogs(trx.id);
      const logs = (res && Array.isArray(res.data)) ? res.data : [];
      if (logs.length === 0) {
        auditList.innerHTML = '<div>Belum ada koreksi atau log verifikasi pada transaksi ini.</div>';
      } else {
        auditList.innerHTML = logs.map(l => `
          <div style="padding: 0.25rem 0; border-bottom: 1px dashed rgba(0,0,0,0.06);">
            <strong>[${l.action_type}]</strong> oleh ${l.actor_name || 'Admin'} (${l.created_at || 'Baru saja'})
            <div style="color: var(--text-dark);">Alasan: "${l.reason || '-'}"</div>
          </div>
        `).join('');
      }
    } catch {
      auditList.innerHTML = '<div>Log audit tersimpan di server.</div>';
    }
  }
}

// 10. Campaign Modal Handlers
function openCampaignModal(campaignId = null) {
  const modal = document.getElementById('adminCampaignModal');
  const titleEl = document.getElementById('adminCampaignModalTitle');
  const form = document.getElementById('adminCampaignForm');
  if (!modal || !form) return;

  if (campaignId) {
    const camp = campaignsState.find(c => c.id === campaignId);
    if (camp) {
      if (titleEl) titleEl.textContent = 'Edit Program Campaign Wakaf';
      document.getElementById('campaignFormId').value = camp.id;
      document.getElementById('campaignFormTitle').value = camp.title;
      document.getElementById('campaignFormType').value = camp.type;
      document.getElementById('campaignFormCategory').value = camp.category;
      document.getElementById('campaignFormTarget').value = camp.targetAmount;
      document.getElementById('campaignFormDeadline').value = camp.deadline;
      document.getElementById('campaignFormImage').value = camp.image;
      document.getElementById('campaignFormDesc').value = camp.description;
      document.getElementById('campaignFormStatus').value = camp.status;
    }
  } else {
    if (titleEl) titleEl.textContent = 'Buat Program Campaign Wakaf Baru';
    form.reset();
    document.getElementById('campaignFormId').value = '';
    document.getElementById('campaignFormImage').value = '/assets/images/campus.jpg';
  }

  if (modal) modal.classList.add('open');
  window.location.hash = '#admin-campaign-form';
}

// 11. Article Modal Handlers (with Slug, SEO Metadata, Status Select)
export function generateSlugFromTitle(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function openArticleModal(articleId = null) {
  const modal = document.getElementById('adminArticleModal');
  const titleEl = document.getElementById('adminArticleModalTitle');
  const form = document.getElementById('adminArticleForm');
  const slugFeedback = document.getElementById('articleSlugFeedback');
  if (!modal || !form) return;

  if (slugFeedback) {
    slugFeedback.textContent = 'Slug unik digunakan sebagai URL permanen artikel.';
    slugFeedback.style.color = 'var(--text-muted)';
  }

  if (articleId) {
    const art = articlesState.find(a => a.id === articleId);
    if (art) {
      if (titleEl) titleEl.textContent = 'Edit Artikel Berita';
      document.getElementById('articleFormId').value = art.id;
      document.getElementById('articleFormTitle').value = art.title;
      const slugInput = document.getElementById('articleFormSlug');
      if (slugInput) slugInput.value = art.slug || generateSlugFromTitle(art.title);
      document.getElementById('articleFormCategory').value = art.category;
      document.getElementById('articleFormAuthor').value = art.author || 'Humas Rumah Tahfidz';
      document.getElementById('articleFormExcerpt').value = art.excerpt;
      document.getElementById('articleFormBody').value = (art.content || '').replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<[^>]+>/g, '');
      document.getElementById('articleFormImage').value = art.image;
      document.getElementById('articleFormTags').value = (art.tags || []).join(', ');
      const seoTitle = document.getElementById('articleFormSeoTitle');
      const seoDesc = document.getElementById('articleFormSeoDesc');
      const statusSelect = document.getElementById('articleFormStatusSelect');
      if (seoTitle) seoTitle.value = art.seoTitle || '';
      if (seoDesc) seoDesc.value = art.seoDescription || '';
      if (statusSelect) statusSelect.value = art.status || 'published';
      document.getElementById('articleFormPublishToggle').checked = art.status === 'published';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Tulis Artikel Berita Baru';
    form.reset();
    document.getElementById('articleFormId').value = '';
    const slugInput = document.getElementById('articleFormSlug');
    if (slugInput) slugInput.value = '';
    document.getElementById('articleFormImage').value = '/assets/images/wisuda.jpg';
    const statusSelect = document.getElementById('articleFormStatusSelect');
    if (statusSelect) statusSelect.value = 'published';
    document.getElementById('articleFormPublishToggle').checked = true;
  }

  if (modal) modal.classList.add('open');
  window.location.hash = '#admin-article-form';
}

// 12. Export CSV Functionality (PRD Section 5.2 - Live Backend Stream)
function exportDonationsCSV() {
  window.open(donationsApi.exportCsvUrl, '_blank');
  showToast('Mengunduh data rekap donasi resmi dari server database...', 'success');
}

// 13. Initialize Admin UI and Event Listeners
function initAdminUI() {
  // A. Admin Login Form Handling (Sprint 3 API Integration)
  const loginForm = document.getElementById('adminLoginForm');
  const loginAlertBox = document.getElementById('loginAlertBox');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const rememberMe = document.getElementById('rememberMeCheckbox').checked;

      try {
        const res = await authApi.login(email, password);
        if (res.success) {
          auth.failedAttempts = 0;
          auth.lockoutEndTime = 0;
          if (loginAlertBox) loginAlertBox.style.display = 'none';

          client.setToken(res.token, rememberMe);
          auth.setStoredUser(res.user, rememberMe);
          showToast(res.message, 'success');

          const callback = auth.getCallbackUrl();
          auth.clearCallbackUrl();

          const roleConf = ROLES_CONFIG[res.user.role] || ROLES_CONFIG.superadmin;
          if (callback && callback !== 'admin-login') {
            window.location.hash = `#${callback.replace('#', '')}`;
          } else {
            window.location.hash = `#admin-${roleConf.defaultModule}`;
          }
        }
      } catch (err) {
        if (loginAlertBox) {
          loginAlertBox.style.display = 'flex';
          loginAlertBox.innerHTML = `${err.message}`;
        }
      }
    });
  }

  // Quick Demo Role Pills on Login Page
  document.querySelectorAll('.demo-role-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const email = e.currentTarget.getAttribute('data-email');
      const pass = e.currentTarget.getAttribute('data-pass');
      const emailInput = document.getElementById('loginEmail');
      const passInput = document.getElementById('loginPassword');

      if (emailInput && passInput) {
        emailInput.value = email;
        passInput.value = pass;
        showToast(`Mengisi akun demo: ${email}`, 'success');
      }
    });
  });

  // Toggle Password Visibility
  const togglePassBtn = document.getElementById('togglePasswordBtn');
  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', () => {
      const passInput = document.getElementById('loginPassword');
      if (passInput) {
        if (passInput.type === 'password') {
          passInput.type = 'text';
          togglePassBtn.setAttribute('aria-label', 'Sembunyikan kata sandi');
          togglePassBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        } else {
          passInput.type = 'password';
          togglePassBtn.setAttribute('aria-label', 'Lihat kata sandi');
          togglePassBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
      }
    });
  }

  // B. Logout Button (Clears session & token completely)
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      auth.clearUser();
      client.clearToken();
      showToast('Sesi administrasi ditutup. Anda telah berhasil keluar.', 'success');
      window.location.hash = '#admin-login';
    });
  }

  // C. Intercept Restricted Role Menu Items (Otorisasi Terkunci & Dipatenkan)
  document.querySelectorAll('.sidebar-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (item.classList.contains('restricted-role')) {
        e.preventDefault();
        e.stopPropagation();
        const currentUser = auth.getStoredUser() || usersState[0];
        const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;
        showToast(`Akses Ditolak (403): Role "${roleConf.name}" tidak memiliki hak akses ke modul ini. Otorisasi telah dipatenkan.`, 'warning');
      }
    });
  });

  // Back to allowed module button from 403 alert banner
  const btnBackAllowed = document.getElementById('btnBackToAllowed');
  if (btnBackAllowed) {
    btnBackAllowed.addEventListener('click', () => {
      const currentUser = auth.getStoredUser() || usersState[0];
      const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;
      window.location.hash = `#admin-${roleConf.defaultModule}`;
    });
  }

  // D. Notification Bell Toggle
  const notifBellBtn = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  if (notifBellBtn && notifDropdown) {
    notifBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.style.display = notifDropdown.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && e.target !== notifBellBtn) {
        notifDropdown.style.display = 'none';
      }
    });
  }

  // E. Mobile Sidebar Toggle & Backdrop
  const sidebarToggleBtn = document.getElementById('adminSidebarToggleBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const sidebar = document.getElementById('adminSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  function openAdminSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.classList.add('admin-sidebar-open');
  }

  function closeAdminSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.classList.remove('admin-sidebar-open');
  }

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', openAdminSidebar);
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeAdminSidebar);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeAdminSidebar);
  }

  // Auto-close sidebar on mobile/iPad when any navigation item is clicked
  if (sidebar) {
    sidebar.querySelectorAll('.sidebar-menu-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          closeAdminSidebar();
        }
      });
    });
  }

  // Floating Mobile App Bottom Navigation Bar Handlers
  document.querySelectorAll('.mob-nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const navTarget = link.getAttribute('data-admin-nav');
      if (navTarget) {
        window.location.hash = `#admin-${navTarget}`;
      }
    });
  });

  const mobQuickActionFab = document.getElementById('mobQuickActionFab');
  if (mobQuickActionFab) {
    mobQuickActionFab.addEventListener('click', () => {
      openPPDBModal();
    });
  }

  // F. Receipt Modal Approval, Rejection & Financial Correction Handlers (PRD Req #7)
  const btnApproveReceipt = document.getElementById('btnApproveReceiptAction');
  const btnRejectReceipt = document.getElementById('btnRejectReceiptAction');
  const btnSubmitCorrection = document.getElementById('btnSubmitTrxCorrection');
  const btnCloseReceipt = document.getElementById('btnCloseReceiptModal');
  const receiptModal = document.getElementById('adminReceiptModal');

  if (btnApproveReceipt) {
    btnApproveReceipt.addEventListener('click', async () => {
      if (state.selectedReceiptTrx) {
        const notes = document.getElementById('receiptModalNotesInput')?.value || '';
        try {
          await donationsApi.verify(state.selectedReceiptTrx.id, 'success', notes);
          showToast(`Bukti transfer ${state.selectedReceiptTrx.invoiceNumber} berhasil diverifikasi! Tercatat di database.`, 'success');
          if (receiptModal) receiptModal.classList.remove('open');
          await syncDatabaseState();
          renderAdminDonasi();
          await renderAdminOverview();
          updateNotificationBell();
        } catch (err) {
          showToast(`Gagal verifikasi donasi: ${err.message}`, 'warning');
        }
      }
    });
  }

  if (btnRejectReceipt) {
    btnRejectReceipt.addEventListener('click', async () => {
      if (state.selectedReceiptTrx) {
        const notes = document.getElementById('receiptModalNotesInput')?.value || '';
        try {
          await donationsApi.verify(state.selectedReceiptTrx.id, 'rejected', notes);
          showToast(`Transaksi ${state.selectedReceiptTrx.invoiceNumber} telah ditolak.`, 'warning');
          if (receiptModal) receiptModal.classList.remove('open');
          await syncDatabaseState();
          renderAdminDonasi();
          await renderAdminOverview();
          updateNotificationBell();
        } catch (err) {
          showToast(`Gagal menolak transaksi: ${err.message}`, 'warning');
        }
      }
    });
  }

  if (btnSubmitCorrection) {
    btnSubmitCorrection.addEventListener('click', async () => {
      if (!state.selectedReceiptTrx) return;
      const amount = Number(document.getElementById('correctTrxAmount')?.value || 0);
      const ref = (document.getElementById('correctTrxRef')?.value || '').trim();
      const newStatus = document.getElementById('correctTrxStatus')?.value || 'success';
      const reason = (document.getElementById('correctTrxReason')?.value || '').trim();

      if (!reason || reason.length < 5) {
        showToast('Alasan koreksi finansial wajib diisi (minimal 5 karakter) untuk jejak audit.', 'warning');
        document.getElementById('correctTrxReason')?.focus();
        return;
      }

      try {
        await donationsApi.correct(state.selectedReceiptTrx.id, {
          amount,
          reference_number: ref,
          payment_status: newStatus,
          reason
        });
        showToast(`Koreksi transaksi ${state.selectedReceiptTrx.invoiceNumber} berhasil disimpan ke Financial Audit Log!`, 'success');
        if (receiptModal) receiptModal.classList.remove('open');
        await syncDatabaseState();
        renderAdminDonasi();
        await renderAdminOverview();
        updateNotificationBell();
      } catch (err) {
        showToast(`Gagal menyimpan koreksi: ${err.message}`, 'warning');
      }
    });
  }

  if (btnCloseReceipt && receiptModal) {
    btnCloseReceipt.addEventListener('click', () => receiptModal.classList.remove('open'));
  }

  // G. Campaign Create / Edit Modal Form (Sprint 3 API Integration)
  const campaignForm = document.getElementById('adminCampaignForm');
  const campaignModal = document.getElementById('adminCampaignModal');
  const btnCreateCamp = document.getElementById('btnCreateCampaign');
  const btnCloseCamp = document.getElementById('btnCloseCampaignModal');
  const btnCancelCamp = document.getElementById('btnCancelCampaign');
  const btnPickMediaCamp = document.getElementById('btnPickMediaForCampaign');

  if (btnCreateCamp) {
    btnCreateCamp.addEventListener('click', () => openCampaignModal());
  }

  if (btnPickMediaCamp) {
    btnPickMediaCamp.addEventListener('click', () => {
      openMediaLibraryModal((url) => {
        const input = document.getElementById('campaignFormImage');
        if (input) input.value = url;
      });
    });
  }

  if (btnCloseCamp) {
    btnCloseCamp.addEventListener('click', () => {
      if (campaignModal) campaignModal.classList.remove('open');
      window.location.hash = '#admin-donasi';
    });
  }

  if (btnCancelCamp) {
    btnCancelCamp.addEventListener('click', (e) => {
      e.preventDefault();
      if (campaignModal) campaignModal.classList.remove('open');
      window.location.hash = '#admin-donasi';
    });
  }

  if (campaignForm) {
    campaignForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('campaignFormId').value;
      const title = document.getElementById('campaignFormTitle').value;
      const type = document.getElementById('campaignFormType').value;
      const category = document.getElementById('campaignFormCategory').value;
      const target = parseFloat(document.getElementById('campaignFormTarget').value) || 100000000;
      const deadline = document.getElementById('campaignFormDeadline').value;
      const image = document.getElementById('campaignFormImage').value;
      const desc = document.getElementById('campaignFormDesc').value;
      const campStatus = document.getElementById('campaignFormStatus').value;

      try {
        if (id) {
          await campaignsApi.update(id, {
            title,
            type,
            category_name: category,
            target_amount: target,
            cover_image: image,
            description: desc,
            status: campStatus,
            end_date: deadline
          });
          showToast(`Program campaign "${title}" berhasil diperbarui di database.`, 'success');
        } else {
          await campaignsApi.create({
            title,
            type,
            category_name: category,
            target_amount: target,
            cover_image: image,
            description: desc,
            status: campStatus,
            end_date: deadline
          });
          showToast(`Program campaign baru "${title}" berhasil disimpan di database!`, 'success');
        }

        await syncDatabaseState();
        if (campaignModal) campaignModal.classList.remove('open');
        renderAdminDonasi();
        await renderAdminOverview();
        window.location.hash = '#admin-donasi';
      } catch (err) {
        showToast(err.message, 'warning');
      }
    });
  }

  // H. Article Create / Edit Modal Form (with Slug, Rich-Text Toolbar, SEO, Preview)
  const articleForm = document.getElementById('adminArticleForm');
  const articleModal = document.getElementById('adminArticleModal');
  const btnCreateArt = document.getElementById('btnCreateArticle');
  const btnCloseArt = document.getElementById('btnCloseArticleModal');
  const btnCancelArt = document.getElementById('btnCancelArticle');
  const btnGenSlug = document.getElementById('btnGenerateSlug');
  const articleTitleInput = document.getElementById('articleFormTitle');
  const articleSlugInput = document.getElementById('articleFormSlug');
  const articleSlugFeedback = document.getElementById('articleSlugFeedback');
  const articleStatusSelect = document.getElementById('articleFormStatusSelect');
  const articlePublishToggle = document.getElementById('articleFormPublishToggle');
  const btnPreviewArt = document.getElementById('btnPreviewArticle');
  const btnPickMediaArt = document.getElementById('btnPickMediaForArticle');
  const btnInsertMediaArt = document.getElementById('btnInsertMediaToArticle');

  if (btnCreateArt) {
    btnCreateArt.addEventListener('click', () => openArticleModal());
  }

  const checkSlugDuplicate = () => {
    if (!articleSlugInput || !articleSlugFeedback) return;
    const currentId = document.getElementById('articleFormId')?.value || '';
    const candidate = generateSlugFromTitle(articleSlugInput.value || articleTitleInput?.value || '');
    articleSlugInput.value = candidate;
    if (!candidate) {
      articleSlugFeedback.textContent = 'Slug akan dibuat otomatis dari judul artikel.';
      articleSlugFeedback.style.color = 'var(--text-muted)';
      return;
    }
    const conflict = articlesState.find(a => a.slug === candidate && String(a.id) !== String(currentId));
    if (conflict) {
      articleSlugFeedback.textContent = `⚠️ Slug "/${candidate}" sudah digunakan oleh artikel "${conflict.title}". Mohon ubah agar unik.`;
      articleSlugFeedback.style.color = '#dc2626';
    } else {
      articleSlugFeedback.textContent = `✓ Slug "/${candidate}" tersedia dan unik.`;
      articleSlugFeedback.style.color = '#059669';
    }
  };

  if (btnGenSlug) {
    btnGenSlug.addEventListener('click', () => {
      if (articleSlugInput && articleTitleInput) {
        articleSlugInput.value = generateSlugFromTitle(articleTitleInput.value);
        checkSlugDuplicate();
      }
    });
  }
  if (articleTitleInput) {
    articleTitleInput.addEventListener('input', () => {
      const currentId = document.getElementById('articleFormId')?.value || '';
      if (!currentId && articleSlugInput) {
        articleSlugInput.value = generateSlugFromTitle(articleTitleInput.value);
        checkSlugDuplicate();
      }
    });
  }
  if (articleSlugInput) {
    articleSlugInput.addEventListener('change', checkSlugDuplicate);
  }

  // Sync status dropdown <-> checkbox toggle
  if (articleStatusSelect && articlePublishToggle) {
    articleStatusSelect.addEventListener('change', () => {
      articlePublishToggle.checked = articleStatusSelect.value === 'published';
    });
    articlePublishToggle.addEventListener('change', () => {
      articleStatusSelect.value = articlePublishToggle.checked ? 'published' : 'draft';
    });
  }

  // Rich-Text Formatting Toolbar Buttons
  document.querySelectorAll('.btn-rte-format').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tag = e.currentTarget.getAttribute('data-tag');
      const textarea = document.getElementById('articleFormBody');
      if (!textarea || !tag) return;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const selected = textarea.value.substring(start, end) || 'Teks di sini';
      const replacement = `<${tag}>${selected}</${tag}>`;
      textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
      textarea.focus();
    });
  });

  if (btnPickMediaArt) {
    btnPickMediaArt.addEventListener('click', () => {
      openMediaLibraryModal((url) => {
        const input = document.getElementById('articleFormImage');
        if (input) input.value = url;
      });
    });
  }

  if (btnInsertMediaArt) {
    btnInsertMediaArt.addEventListener('click', () => {
      openMediaLibraryModal((url, alt) => {
        const textarea = document.getElementById('articleFormBody');
        if (textarea) {
          textarea.value += `\n\n<figure><img src="${url}" alt="${alt || 'Dokumentasi RTM'}" style="max-width:100%; border-radius:8px;" /><figcaption>${alt || ''}</figcaption></figure>`;
        }
      });
    });
  }

  if (btnPreviewArt) {
    btnPreviewArt.addEventListener('click', () => {
      const title = document.getElementById('articleFormTitle')?.value || 'Pratinjau Artikel';
      const category = document.getElementById('articleFormCategory')?.value || 'Warta Utama';
      const bodyRaw = document.getElementById('articleFormBody')?.value || '';
      const image = document.getElementById('articleFormImage')?.value || '/assets/images/wisuda.jpg';
      const tagsRaw = document.getElementById('articleFormTags')?.value || '';
      const content = bodyRaw.includes('<p>') ? bodyRaw : bodyRaw.split('\n\n').map(p => `<p>${p}</p>`).join('');
      openArticleReader({
        title: `[PREVIEW] ${title}`,
        category,
        date: 'Pratinjau Draft',
        readTime: '3 Menit',
        image,
        content,
        tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      });
    });
  }

  if (btnCloseArt) {
    btnCloseArt.addEventListener('click', () => {
      if (articleModal) articleModal.classList.remove('open');
      window.location.hash = '#admin-berita';
    });
  }

  if (btnCancelArt) {
    btnCancelArt.addEventListener('click', (e) => {
      e.preventDefault();
      if (articleModal) articleModal.classList.remove('open');
      window.location.hash = '#admin-berita';
    });
  }

  if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('articleFormId').value;
      const title = document.getElementById('articleFormTitle').value.trim();
      const slug = generateSlugFromTitle(document.getElementById('articleFormSlug')?.value || title);
      const category = document.getElementById('articleFormCategory').value;
      const author = document.getElementById('articleFormAuthor').value.trim() || 'Humas Rumah Tahfidz';
      const excerpt = document.getElementById('articleFormExcerpt').value.trim();
      const bodyContent = document.getElementById('articleFormBody').value;
      const image = document.getElementById('articleFormImage').value.trim();
      const tagsRaw = document.getElementById('articleFormTags')?.value || '';
      const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      const seoTitle = document.getElementById('articleFormSeoTitle')?.value?.trim() || title;
      const seoDescription = document.getElementById('articleFormSeoDesc')?.value?.trim() || excerpt;
      const statusSelectVal = document.getElementById('articleFormStatusSelect')?.value;
      const isPublished = document.getElementById('articleFormPublishToggle').checked;
      const finalStatus = statusSelectVal || (isPublished ? 'published' : 'draft');

      const paragraphs = bodyContent.includes('<p>') ? bodyContent : bodyContent.split('\n\n').map(p => `<p>${p}</p>`).join('');

      const payload = {
        title,
        slug,
        category,
        author_name: author,
        excerpt,
        content: paragraphs,
        thumbnail_url: image,
        tags,
        seo_title: seoTitle,
        seo_description: seoDescription,
        read_time: '3 Menit',
        status: finalStatus
      };

      try {
        if (id) {
          await articlesApi.update(id, payload);
          showToast(`Artikel "${title}" berhasil diperbarui di database.`, 'success');
        } else {
          await articlesApi.create(payload);
          showToast(`Artikel "${title}" (${finalStatus.toUpperCase()}) berhasil disimpan di database!`, 'success');
        }

        await syncDatabaseState();
        if (articleModal) articleModal.classList.remove('open');
        renderAdminBerita();
        renderNewsGrid();
        window.location.hash = '#admin-berita';
      } catch (err) {
        if (err.code === 'CONFLICT_SLUG' || (err.message && err.message.toLowerCase().includes('slug'))) {
          if (articleSlugFeedback) {
            articleSlugFeedback.textContent = `⚠️ ${err.message}`;
            articleSlugFeedback.style.color = '#dc2626';
          }
        }
        showToast(err.message, 'warning');
      }
    });
  }

  // I. Syllabus Upload Modal & Academic Program Editor (#adminProgramEditForm)
  const syllabusModal = document.getElementById('adminSyllabusModal');
  const btnUploadSyllabus = document.getElementById('btnUploadSyllabus');
  const btnCloseSyllabus = document.getElementById('btnCloseSyllabusModal');
  const btnCancelSyllabus = document.getElementById('btnCancelSyllabus');
  const syllabusForm = document.getElementById('adminSyllabusForm');

  if (btnUploadSyllabus) {
    btnUploadSyllabus.addEventListener('click', () => {
      if (syllabusModal) syllabusModal.classList.add('open');
      window.location.hash = '#admin-syllabus-form';
    });
  }
  if (btnCloseSyllabus) {
    btnCloseSyllabus.addEventListener('click', () => {
      if (syllabusModal) syllabusModal.classList.remove('open');
      window.location.hash = '#admin-akademik';
    });
  }
  if (btnCancelSyllabus) {
    btnCancelSyllabus.addEventListener('click', (e) => {
      e.preventDefault();
      if (syllabusModal) syllabusModal.classList.remove('open');
      window.location.hash = '#admin-akademik';
    });
  }
  if (syllabusForm) {
    syllabusForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const progId = document.getElementById('syllabusProgramSelect').value;
      const prog = programsState.find(p => p.id === progId);
      showToast(`Silabus Kurikulum Baru untuk ${prog ? prog.name : ''} berhasil diunggah & dipublikasikan.`, 'success');
      if (syllabusModal) syllabusModal.classList.remove('open');
      window.location.hash = '#admin-akademik';
    });
  }

  // Academic Program Editor Handlers
  const btnCreateNewProgram = document.getElementById('btnCreateNewProgram');
  const btnAddCustomField = document.getElementById('btnAddProgramCustomField');
  const btnPickMediaProgram = document.getElementById('btnPickMediaForProgram');
  const programEditForm = document.getElementById('adminProgramEditForm');

  if (btnCreateNewProgram) {
    btnCreateNewProgram.addEventListener('click', () => openProgramEditPage(null));
  }

  if (btnAddCustomField) {
    btnAddCustomField.addEventListener('click', () => {
      const container = document.getElementById('programCustomFieldsContainer');
      if (!container) return;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderCustomSchemaRowHtml({ label: '', type: 'text', required: true, options: '' });
      const row = wrapper.firstElementChild;
      row.querySelector('.btn-remove-custom-field')?.addEventListener('click', () => row.remove());
      container.appendChild(row);
    });
  }

  if (btnPickMediaProgram) {
    btnPickMediaProgram.addEventListener('click', () => {
      openMediaLibraryModal((url) => {
        const input = document.getElementById('programFormImage');
        if (input) input.value = url;
      });
    });
  }

  if (programEditForm) {
    programEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawId = document.getElementById('programFormIdInput')?.value?.trim();
      const title = document.getElementById('programFormTitle')?.value?.trim();
      const category = document.getElementById('programFormCategory')?.value || 'formal';
      const targetHafalan = document.getElementById('programFormTarget')?.value?.trim() || '30 Juz';
      const duration = document.getElementById('programFormDuration')?.value?.trim() || '3 Tahun';
      const subtitle = document.getElementById('programFormSubtitle')?.value?.trim() || '';
      const eligibility = document.getElementById('programFormEligibility')?.value?.trim() || '';
      const schedule = document.getElementById('programFormSchedule')?.value?.trim() || '';
      const instructions = document.getElementById('programFormInstructions')?.value?.trim() || '';
      const heroImage = document.getElementById('programFormImage')?.value?.trim() || '/assets/images/classroom.jpg';
      const pubStatus = document.getElementById('programFormPubStatus')?.value || 'published';
      const isOpen = document.getElementById('programFormIsOpen')?.value === '1' ? 1 : 0;

      const formSchema = [];
      document.querySelectorAll('#programCustomFieldsContainer .program-custom-field-row').forEach(row => {
        const lbl = row.querySelector('.custom-field-label')?.value?.trim();
        const tp = row.querySelector('.custom-field-type')?.value || 'text';
        const opts = row.querySelector('.custom-field-options')?.value?.trim() || '';
        const req = row.querySelector('.custom-field-required')?.checked || false;
        if (lbl) {
          formSchema.push({ label: lbl, type: tp, options: opts, required: req });
        }
      });

      const payload = {
        id: rawId || generateSlugFromTitle(title),
        title,
        subtitle,
        category,
        target_hafalan: targetHafalan,
        duration,
        description: subtitle,
        hero_image: heroImage,
        eligibility_criteria: eligibility,
        schedule_info: schedule,
        application_instructions: instructions,
        publication_status: pubStatus,
        is_active: isOpen,
        form_schema: formSchema
      };

      try {
        const existing = programsState.some(p => p.id === payload.id);
        if (existing) {
          await programsApi.update(payload.id, payload);
          showToast(`Program akademik "${title}" & skema PPDB berhasil diperbarui!`, 'success');
        } else {
          await programsApi.create(payload);
          showToast(`Program akademik baru "${title}" berhasil ditambahkan!`, 'success');
        }
        await syncDatabaseState();
        renderAdminAkademik();
        renderHomeProgramCards('all');
        window.location.hash = '#admin-akademik';
      } catch (err) {
        showToast('Gagal menyimpan program: ' + err.message, 'warning');
      }
    });
  }

  // J. User Creation & Edit Modal (Super Admin Only)
  const userModal = document.getElementById('adminUserModal');
  const btnCreateUser = document.getElementById('btnCreateUser');
  const btnCloseUser = document.getElementById('btnCloseUserModal');
  const btnCancelUser = document.getElementById('btnCancelUser');
  const userForm = document.getElementById('adminUserForm');

  if (btnCreateUser) {
    btnCreateUser.addEventListener('click', () => {
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }
      const title = document.getElementById('userModalTitle');
      const idInput = document.getElementById('userFormUserId');
      const passInput = document.getElementById('userFormPassword');
      const activeSelect = document.getElementById('userFormActiveStatus');
      if (title) title.textContent = 'Tambah Pengguna Baru';
      if (idInput) idInput.value = '';
      if (activeSelect) activeSelect.value = '1';
      if (passInput) {
        passInput.value = '';
        passInput.required = true;
        passInput.placeholder = 'Min. 6 Karakter...';
      }
      if (userForm) userForm.reset();
      if (userModal) userModal.classList.add('open');
      window.location.hash = '#admin-user-form';
    });
  }
  if (btnCloseUser) {
    btnCloseUser.addEventListener('click', () => {
      if (userModal) userModal.classList.remove('open');
      window.location.hash = '#admin-users';
    });
  }
  if (btnCancelUser) {
    btnCancelUser.addEventListener('click', (e) => {
      e.preventDefault();
      if (userModal) userModal.classList.remove('open');
      window.location.hash = '#admin-users';
    });
  }
  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }

      const userId = document.getElementById('userFormUserId')?.value;
      const name = document.getElementById('userFormName').value.trim();
      const email = document.getElementById('userFormEmail').value.trim();
      const pass = document.getElementById('userFormPassword').value;
      const role = document.getElementById('userFormRole').value;
      const isActiveVal = document.getElementById('userFormActiveStatus')?.value !== '0';

      const roleTitles = {
        superadmin: 'Admin',
        editor: 'Content',
        finance: 'Finance'
      };

      try {
        if (userId) {
          const payload = {
            name,
            email,
            role,
            role_title: roleTitles[role] || role,
            is_active: isActiveVal ? 1 : 0
          };
          if (pass && pass.trim()) {
            payload.password = pass.trim();
          }
          await usersApi.update(userId, payload);
          showToast(`Akun pengguna ${name} berhasil diperbarui!`, 'success');
        } else {
          await usersApi.create({
            name,
            email,
            password: pass,
            role,
            role_title: roleTitles[role] || role,
            is_active: isActiveVal ? 1 : 0
          });
          showToast(`Akun pengguna ${name} (${roleTitles[role] || role}) berhasil didaftarkan ke sistem!`, 'success');
        }
        userForm.reset();
        if (userModal) userModal.classList.remove('open');
        await syncDatabaseState();
        renderAdminUsers();
        window.location.hash = '#admin-users';
      } catch (err) {
        showToast(err.message, 'warning');
      }
    });
  }

  // K. Gallery Documentation Modal & Shared Media Library (#adminGalleryModal, #mediaLibraryPickerModal)
  const galleryModal = document.getElementById('adminGalleryModal');
  const btnAddGalleryMedia = document.getElementById('btnAddGalleryMedia');
  const btnCloseGalleryModal = document.getElementById('btnCloseGalleryModal');
  const btnCancelGallery = document.getElementById('btnCancelGallery');
  const adminGalleryForm = document.getElementById('adminGalleryForm');
  const btnOpenMediaLib = document.getElementById('btnOpenMediaLibrary');
  const btnPickMediaGal = document.getElementById('btnPickMediaForGallery');
  const galCatFilter = document.getElementById('adminGalleryCategoryFilter');
  const galStatusFilter = document.getElementById('adminGalleryStatusFilter');
  const mediaUploadForm = document.getElementById('mediaLibraryUploadForm');

  if (btnOpenMediaLib) {
    btnOpenMediaLib.addEventListener('click', () => openMediaLibraryModal(null));
  }

  if (btnPickMediaGal) {
    btnPickMediaGal.addEventListener('click', () => {
      openMediaLibraryModal((url, alt) => {
        const urlInput = document.getElementById('galleryFormUrl');
        const altInput = document.getElementById('galleryFormAltText');
        if (urlInput) urlInput.value = url;
        if (altInput && !altInput.value) altInput.value = alt || '';
      });
    });
  }

  if (galCatFilter) {
    galCatFilter.addEventListener('change', (e) => {
      state.adminGalleryCategoryFilter = e.target.value;
      renderAdminGaleri();
    });
  }

  if (galStatusFilter) {
    galStatusFilter.addEventListener('change', (e) => {
      state.adminGalleryStatusFilter = e.target.value;
      renderAdminGaleri();
    });
  }

  if (mediaUploadForm) {
    mediaUploadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('mediaUploadFileInput');
      const altText = document.getElementById('mediaUploadAltInput')?.value?.trim() || '';
      const file = fileInput?.files?.[0];
      if (!file) {
        showToast('Pilih file gambar terlebih dahulu.', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await mediaApi.upload({
            file_name: file.name,
            file_data: reader.result,
            alt_text: altText || file.name,
            category: 'general'
          });
          showToast(`File media "${file.name}" berhasil diunggah ke Pustaka Media!`, 'success');
          mediaUploadForm.reset();
          openMediaLibraryModal(state.mediaPickerCallback);
        } catch (err) {
          showToast('Gagal mengunggah media: ' + err.message, 'warning');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnAddGalleryMedia) {
    btnAddGalleryMedia.addEventListener('click', () => {
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin' && currentUser.role !== 'editor') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }
      if (adminGalleryForm) adminGalleryForm.reset();
      const idInput = document.getElementById('galleryFormId');
      if (idInput) idInput.value = '';
      const dateInput = document.getElementById('galleryFormDate');
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      if (galleryModal) galleryModal.classList.add('open');
      window.location.hash = '#admin-gallery-form';
    });
  }

  if (btnCloseGalleryModal) {
    btnCloseGalleryModal.addEventListener('click', () => {
      if (galleryModal) galleryModal.classList.remove('open');
      window.location.hash = '#admin-galeri';
    });
  }

  if (btnCancelGallery) {
    btnCancelGallery.addEventListener('click', (e) => {
      e.preventDefault();
      if (galleryModal) galleryModal.classList.remove('open');
      window.location.hash = '#admin-galeri';
    });
  }

  // Quick preset buttons for image URL
  document.querySelectorAll('.btn-quick-gal-img').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const imgPath = e.currentTarget.getAttribute('data-img');
      const urlInput = document.getElementById('galleryFormUrl');
      if (urlInput && imgPath) {
        urlInput.value = imgPath;
      }
    });
  });

  if (adminGalleryForm) {
    adminGalleryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentUser = auth.getStoredUser() || usersState[0];
      if (currentUser.role !== 'superadmin' && currentUser.role !== 'editor') {
        showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
        return;
      }

      const editId = document.getElementById('galleryFormId')?.value || '';
      const title = document.getElementById('galleryFormTitle').value.trim();
      const category = document.getElementById('galleryFormCategory').value;
      const albumName = document.getElementById('galleryFormAlbum')?.value?.trim() || '';
      const sortOrder = Number(document.getElementById('galleryFormSortOrder')?.value || 0);
      const status = document.getElementById('galleryFormStatus')?.value || 'published';
      const date = document.getElementById('galleryFormDate').value || new Date().toISOString().split('T')[0];
      const image = document.getElementById('galleryFormUrl').value.trim();
      const altText = document.getElementById('galleryFormAltText')?.value?.trim() || title;
      const caption = document.getElementById('galleryFormCaption')?.value.trim() || '';

      if (!title || !image) {
        showToast('Judul dan URL Media Gambar wajib diisi.', 'warning');
        return;
      }

      const payload = {
        title,
        category,
        album_name: albumName,
        sort_order: sortOrder,
        status,
        date,
        image,
        media_url: image,
        alt_text: altText,
        caption
      };

      try {
        if (editId) {
          await galleriesApi.update(editId, payload);
          showToast(`Media galeri "${title}" berhasil diperbarui!`, 'success');
        } else {
          await galleriesApi.create(payload);
          showToast(`Foto galeri "${title}" berhasil ditambahkan ke database!`, 'success');
        }
        adminGalleryForm.reset();
        if (galleryModal) galleryModal.classList.remove('open');
        await syncDatabaseState();
        renderAdminGaleri();
        renderGalleryGrid();
        window.location.hash = '#admin-galeri';
      } catch (err) {
        showToast('Gagal menyimpan galeri: ' + err.message, 'warning');
      }
    });
  }

  // K2. CSV Export Buttons
  const btnExportCSV = document.getElementById('btnExportDonationCSV');
  const btnQuickCSV = document.getElementById('btnQuickExportCSV');
  if (btnExportCSV) btnExportCSV.addEventListener('click', exportDonationsCSV);
  if (btnQuickCSV) btnQuickCSV.addEventListener('click', exportDonationsCSV);

  // L. Donation Search, Filter & Manual Transaction Entry (#adminManualDonationModal)
  const donSearch = document.getElementById('donationSearchInput');
  if (donSearch) {
    donSearch.addEventListener('input', (e) => {
      state.donationSearchQuery = e.target.value;
      renderDonationTransactionsTable();
    });
  }

  const donCampFilter = document.getElementById('donationCampaignFilter');
  if (donCampFilter) {
    donCampFilter.addEventListener('change', (e) => {
      state.donationCampaignFilter = e.target.value;
      renderDonationTransactionsTable();
    });
  }

  document.querySelectorAll('.donation-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.donation-filter-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.activeDonationStatusFilter = e.currentTarget.getAttribute('data-status');
      renderDonationTransactionsTable();
    });
  });

  const btnOpenManualTrx = document.getElementById('btnOpenManualTransaction');
  const manualDonModal = document.getElementById('adminManualDonationModal');
  const manualDonForm = document.getElementById('adminManualDonationForm');

  if (btnOpenManualTrx && manualDonModal) {
    btnOpenManualTrx.addEventListener('click', () => {
      renderAdminDonasi();
      manualDonModal.classList.add('open');
    });
  }

  if (manualDonForm) {
    manualDonForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const donorName = document.getElementById('manualTrxDonorName')?.value?.trim();
      const donorPhone = document.getElementById('manualTrxDonorPhone')?.value?.trim() || '';
      const campaignId = document.getElementById('manualTrxCampaign')?.value || 'general';
      const amount = Number(document.getElementById('manualTrxAmount')?.value || 0);
      const source = document.getElementById('manualTrxSource')?.value || 'Transfer Bank BSI';
      const refNum = document.getElementById('manualTrxRef')?.value?.trim() || '';
      const proofUrl = document.getElementById('manualTrxProof')?.value?.trim() || '/assets/images/dormitory.jpg';
      const notes = document.getElementById('manualTrxNotes')?.value?.trim() || '';
      const verifyNow = document.getElementById('manualTrxVerifyNow')?.checked || false;

      try {
        await donationsApi.submit({
          campaign_id: campaignId,
          donor_name: donorName,
          donor_phone: donorPhone,
          amount,
          payment_method: source,
          payment_source: source,
          reference_number: refNum,
          proof_image: proofUrl,
          notes,
          verify_immediately: verifyNow
        });
        showToast(`Transaksi donasi manual (${donorName}) berhasil dicatat!`, 'success');
        manualDonForm.reset();
        if (manualDonModal) manualDonModal.classList.remove('open');
        await syncDatabaseState();
        renderAdminDonasi();
        await renderAdminOverview();
        updateNotificationBell();
      } catch (err) {
        showToast('Gagal mencatat donasi: ' + err.message, 'warning');
      }
    });
  }

  // M. Article Search & Filters in Admin
  const artSearch = document.getElementById('adminArticleSearchInput');
  const artCatFilter = document.getElementById('adminArticleCategoryFilter');
  const artStatusFilter = document.getElementById('adminArticleStatusFilter');

  if (artSearch) {
    artSearch.addEventListener('input', (e) => {
      state.adminArticleSearchQuery = e.target.value;
      renderAdminBerita();
    });
  }
  if (artCatFilter) {
    artCatFilter.addEventListener('change', (e) => {
      state.adminArticleCategoryFilter = e.target.value;
      renderAdminBerita();
    });
  }
  if (artStatusFilter) {
    artStatusFilter.addEventListener('change', (e) => {
      state.adminArticleStatusFilter = e.target.value;
      renderAdminBerita();
    });
  }

  // N. Appearance Settings Save Draft, Preview & Publish (PRD Req #8)
  const btnSaveAppearance = document.getElementById('btnSaveAppearanceSettings');
  const btnSaveSettingsDraft = document.getElementById('btnSaveSettingsDraft');
  const btnPreviewSettings = document.getElementById('btnPreviewSiteSettings');
  const btnPickMediaLogo = document.getElementById('btnPickMediaForLogo');

  if (btnPickMediaLogo) {
    btnPickMediaLogo.addEventListener('click', () => {
      openMediaLibraryModal((url) => {
        const input = document.getElementById('settingLogoUrl');
        if (input) input.value = url;
      });
    });
  }

  if (btnPreviewSettings) {
    btnPreviewSettings.addEventListener('click', () => {
      const payload = getAppearanceFormPayload();
      applySiteSettingsToDOM(payload);
      showToast('Menampilkan pratinjau perubahan pengaturan pada halaman publik...', 'success');
      window.location.hash = '#home';
    });
  }

  if (btnSaveSettingsDraft) {
    btnSaveSettingsDraft.addEventListener('click', async () => {
      const payload = getAppearanceFormPayload();
      try {
        await settingsApi.saveDraft({ site_identity: payload });
        showToast('Draft pengaturan tampilan berhasil disimpan (belum dipublikasikan).', 'success');
        await syncDatabaseState();
      } catch (err) {
        showToast('Draft pengaturan disimpan secara lokal.', 'success');
      }
    });
  }

  if (btnSaveAppearance) {
    btnSaveAppearance.addEventListener('click', async () => {
      const payload = getAppearanceFormPayload();
      try {
        await settingsApi.update({
          mode: 'publish',
          site_identity: payload
        });
        applySiteSettingsToDOM(payload);
        showToast('Pengaturan identitas berhasil disimpan ke database SQLite server.', 'success');
      } catch (err) {
        showToast('Pengaturan identitas dan tampilan yayasan berhasil disimpan.', 'success');
      }
    });
  }

  // O. Overview Date Filter, Quick Actions & Refresh (PRD Req #2)
  const overviewDateFilter = document.getElementById('overviewDateFilter');
  if (overviewDateFilter) {
    overviewDateFilter.addEventListener('change', async (e) => {
      state.overviewRange = e.target.value;
      await renderAdminOverview();
    });
  }

  document.getElementById('btnQuickWriteArticle')?.addEventListener('click', () => openArticleModal());
  document.getElementById('btnQuickManualDonation')?.addEventListener('click', () => {
    renderAdminDonasi();
    document.getElementById('adminManualDonationModal')?.classList.add('open');
  });
  document.getElementById('btnQuickNewCampaign')?.addEventListener('click', () => openCampaignModal());
  document.getElementById('btnQuickManageProgram')?.addEventListener('click', () => openProgramEditPage('smp'));
  document.getElementById('btnQuickMediaLibrary')?.addEventListener('click', () => openMediaLibraryModal(null));

  const btnRefresh = document.getElementById('btnRefreshOverview');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      await syncDatabaseState();
      await renderAdminOverview();
      showToast('Data ringkasan eksekutif telah disinkronkan dengan database.', 'success');
    });
  }

  // P. 403 Forbidden return button
  const btnBack403 = document.getElementById('btnBackToAllowed');
  if (btnBack403) {
    btnBack403.addEventListener('click', () => {
      const currentUser = auth.getStoredUser() || usersState[0];
      const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;
      window.location.hash = `#admin-${roleConf.defaultModule}`;
    });
  }

  // Q. Profile Form Submit Handler (#adminProfileForm)
  const profileForm = document.getElementById('adminProfileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentUser = auth.getStoredUser() || usersState[0];
      const newName = document.getElementById('profileFormName').value.trim();
      const newEmail = document.getElementById('profileFormEmail').value.trim();
      const newPass = document.getElementById('profileFormNewPass')?.value;
      const confirmPass = document.getElementById('profileFormConfirmPass')?.value;

      if (!newName || !newEmail) {
        showToast('Nama dan email wajib diisi.', 'warning');
        return;
      }

      if (newPass) {
        if (newPass.length < 6) {
          showToast('Kata sandi baru minimal 6 karakter.', 'warning');
          return;
        }
        if (newPass !== confirmPass) {
          showToast('Konfirmasi kata sandi tidak cocok.', 'warning');
          return;
        }
      }

      // Generate initials for avatar
      const initials = newName.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AD';

      try {
        const payload = {
          name: newName,
          email: newEmail,
          avatar: initials
        };
        if (newPass) {
          payload.password = newPass;
        }

        // Update in backend database API
        try {
          await usersApi.update(currentUser.id, payload);
        } catch (apiErr) {
          console.warn('[Profile] API update notice:', apiErr.message);
        }

        // Update local session user
        const updatedUser = {
          ...currentUser,
          name: newName,
          email: newEmail,
          avatar: initials
        };
        auth.setStoredUser(updatedUser, true);

        // Also update usersState if found
        const uIdx = usersState.findIndex(u => u.id === currentUser.id);
        if (uIdx !== -1) {
          usersState[uIdx] = { ...usersState[uIdx], ...updatedUser };
        }

        // Update topbar and cockpit UI
        const topbarAvatar = document.getElementById('topbarAvatar');
        const topbarName = document.getElementById('topbarUserName');
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        const sidebarName = document.getElementById('sidebarUserName');
        const welcomeUserName = document.getElementById('welcomeUserName');

        if (topbarAvatar) topbarAvatar.textContent = initials;
        if (topbarName) topbarName.textContent = newName;
        if (sidebarAvatar) sidebarAvatar.textContent = initials;
        if (sidebarName) sidebarName.textContent = newName;
        if (welcomeUserName) welcomeUserName.textContent = newName;

        renderAdminProfile();
        showToast('Data profil Anda berhasil diperbarui!', 'success');
      } catch (err) {
        showToast(`Gagal memperbarui profil: ${err.message}`, 'warning');
      }
    });
  }
}

// Initial Boot (Sprint 3 Full Integration)
document.addEventListener('DOMContentLoaded', async () => {
  initMotion();
  initGlobalUI();
  initModals();
  initAdminUI();
  renderGalleryGrid();
  renderNewsGrid();
  initRouter();

  // Background Database Sync
  try {
    await syncDatabaseState();
    renderGalleryGrid();
    renderNewsGrid();
    if (state.currentView === 'akademik') renderAkademikView();
  } catch (err) {
    console.log('[Boot] Initial load ready, offline fallback active');
  }
});


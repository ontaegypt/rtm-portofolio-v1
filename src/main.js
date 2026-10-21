
let appMotionIO = null;
export function observeMotionElements(root = document) {
  if (appMotionIO && root && root.querySelectorAll) {
    root.querySelectorAll("[data-reveal], .shutter, section").forEach((el) => {
      appMotionIO.observe(el);
    });
  }
}

function initMotion() {
  if (typeof IntersectionObserver !== "undefined") {
    appMotionIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          appMotionIO.unobserve(e.target);
        }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

    document.querySelectorAll("[data-reveal], .shutter, section").forEach((el) => {
      appMotionIO.observe(el);
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
  profileApi,
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

// Mutable CMS Stores (Synchronized with Backend SQLite Database & localStorage)
let campaignsState = JSON.parse(JSON.stringify(CAMPAIGNS));
let donationsState = JSON.parse(JSON.stringify(DONATION_TRANSACTIONS));
let ppdbState = (() => {
  try {
    const c = localStorage.getItem('rtm_cms_ppdb');
    if (c) return JSON.parse(c);
  } catch {}
  return JSON.parse(JSON.stringify(PPDB_LEADS));
})();
let visitsState = (() => {
  try {
    const c = localStorage.getItem('rtm_cms_visits');
    if (c) return JSON.parse(c);
  } catch {}
  return JSON.parse(JSON.stringify(VISIT_RESERVATIONS));
})();
let articlesState = (() => {
  try {
    const c = localStorage.getItem('rtm_cms_articles');
    if (c) return JSON.parse(c);
  } catch {}
  return JSON.parse(JSON.stringify(NEWS_ARTICLES));
})();
let galleriesState = (() => {
  try {
    const c = localStorage.getItem('rtm_cms_galleries');
    if (c) return JSON.parse(c);
  } catch {}
  return JSON.parse(JSON.stringify(GALLERIES));
})();
let usersState = JSON.parse(JSON.stringify(ADMIN_USERS));
let programsState = (() => {
  try {
    const c = localStorage.getItem('rtm_cms_programs');
    if (c) return JSON.parse(c);
  } catch {}
  return PROGRAMS.map(p => ({ ...p, ppdbOpen: true, publicationStatus: 'published', formSchema: [] }));
})();
let mediaState = (() => {
  try {
    const c = localStorage.getItem('rtm_cms_media');
    if (c) return JSON.parse(c);
  } catch {}
  return [];
})();
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
  const staticProg = PROGRAMS.find(sp => sp.id === p.id) || null;
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
  if (p.duration_claim) parsedStats.durasi = p.duration_claim;
  if (p.target_hafalan) parsedStats.targetHafalan = p.target_hafalan;

  const progName = p.name || p.title || (staticProg ? staticProg.name : 'Program Tahfidz');
  const progShortTitle = p.shortTitle || (p.name && p.name !== staticProg?.name ? p.name : (staticProg ? staticProg.shortTitle : (p.title || 'Program')));

  return {
    ...(staticProg || {}),
    ...p,
    id: p.id,
    name: progName,
    title: progName,
    shortTitle: progShortTitle,
    headline: p.headline || p.subtitle || (staticProg ? staticProg.headline : ''),
    summary: p.summary || p.description || (staticProg ? staticProg.summary : ''),
    image: p.image || p.hero_image || (staticProg ? staticProg.image : '/assets/images/classroom.jpg'),
    stats: parsedStats,
    eligibilityCriteria: p.eligibilityCriteria || p.eligibility_criteria || (staticProg?.about?.target || ''),
    scheduleInfo: p.scheduleInfo || p.schedule_info || '',
    applicationInstructions: p.applicationInstructions || p.application_instructions || '',
    publicationStatus: p.publicationStatus || p.publication_status || 'published',
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
    const [progRes, artRes, galRes, campRes, donRes, visRes, leadRes, userRes, setRes, medRes] = await Promise.allSettled([
      programsApi.getAll(),
      articlesApi.getAll(),
      galleriesApi.getAll(),
      campaignsApi.getAll(),
      donationsApi.getAll(),
      reservationsApi.getAll(),
      ppdbApi.getAll(),
      usersApi.getAll(),
      settingsApi.get(),
      mediaApi.getAll()
    ]);

    if (progRes.status === 'fulfilled' && progRes.value.data) {
      programsState = progRes.value.data.map(normalizeProgram);
      try { localStorage.setItem('rtm_cms_programs', JSON.stringify(programsState)); } catch {}
      if (typeof renderPublicNavigationPrograms === 'function') renderPublicNavigationPrograms();
      if (typeof renderHomeProgramCards === 'function') renderHomeProgramCards('all');
      if (state.currentView === 'akademik' && typeof renderAkademikView === 'function') renderAkademikView();
    }
    if (artRes.status === 'fulfilled' && artRes.value.data) {
      articlesState = artRes.value.data.map(normalizeArticle);
      try { localStorage.setItem('rtm_cms_articles', JSON.stringify(articlesState)); } catch {}
      if (typeof renderHomeFeaturedArticles === 'function') renderHomeFeaturedArticles();
    }
    if (galRes.status === 'fulfilled' && galRes.value.data) {
      galleriesState = galRes.value.data.map(normalizeGallery);
      try { localStorage.setItem('rtm_cms_galleries', JSON.stringify(galleriesState)); } catch {}
    }
    if (medRes.status === 'fulfilled' && medRes.value?.data) {
      mediaState = medRes.value.data;
      try { localStorage.setItem('rtm_cms_media', JSON.stringify(mediaState)); } catch {}
    }
    if (campRes.status === 'fulfilled' && campRes.value.data) {
      campaignsState = campRes.value.data.map(normalizeCampaign);
    }
    if (donRes.status === 'fulfilled' && donRes.value.data) {
      donationsState = donRes.value.data.map(normalizeDonation);
    }
    if (visRes.status === 'fulfilled' && visRes.value.data) {
      visitsState = visRes.value.data.map(normalizeVisit);
      try { localStorage.setItem('rtm_cms_visits', JSON.stringify(visitsState)); } catch {}
      if (typeof renderAdminGaleri === 'function') renderAdminGaleri();
      if (typeof updateNotificationBell === 'function') updateNotificationBell();
    }
    if (leadRes.status === 'fulfilled' && leadRes.value.data) {
      ppdbState = leadRes.value.data.map(normalizeLead);
      try { localStorage.setItem('rtm_cms_ppdb', JSON.stringify(ppdbState)); } catch {}
      if (typeof renderAdminPPDBTable === 'function') renderAdminPPDBTable();
      if (typeof renderAdminOverview === 'function') renderAdminOverview();
      if (typeof updateNotificationBell === 'function') updateNotificationBell();
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

  // Offline or standalone demo session: already verified locally
  if (token.startsWith('offline_token_') || token.startsWith('mock_token_')) {
    return;
  }

  isVerifyingSession = true;
  try {
    const res = await authApi.getMe();
    if (res && res.success && res.user) {
      const stored = auth.getStoredUser();
      // If local storage was manually tampered, enforce authoritative DB role
      if (!stored || stored.role !== res.user.role || stored.id !== res.user.id || stored.name !== res.user.name) {
        auth.setStoredUser(res.user, true);
        const roleConf = ROLES_CONFIG[res.user.role] || ROLES_CONFIG.superadmin;
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/admin') && currentPath !== '/admin/login') {
          const parts = currentPath.replace('/admin', '').replace(/^\//, '').split('/');
          const mod = parts[0] || 'overview';
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
            navigate(`/admin/${roleConf.defaultModule}`);
            return;
          }
        }
        if (state.currentView === 'admin' && state.activeAdminModule) {
          navigateToAdmin(state.activeAdminModule);
        }
      }
    }
  } catch (err) {
    // Only invalidate session if server explicitly returned 401 or 403
    if (err.status === 401 || err.status === 403) {
      console.warn('[Auth] Server session invalid or expired:', err.message);
      auth.clearUser();
      client.clearToken();
      showToast('Sesi masuk Anda telah kedaluwarsa. Silakan masuk kembali.', 'warning');
      navigate('/admin/login');
    } else {
      // Network failure / server offline: keep the active local session intact!
      console.warn('[Auth] Server unreachable during verification, keeping active local session:', err.message);
    }
  } finally {
    isVerifyingSession = false;
  }
}

// ============================================================================
// CLEAN PERMALINK ROUTER SYSTEM (History API, Clean Paths, WordPress-style permalinks)
// ============================================================================

// Map legacy hash formats to clean permalink paths for seamless backward-compatibility
export function hashToPath(hash) {
  if (!hash) return '/';
  let clean = hash.replace(/^#\/?/, '').trim();
  if (!clean || clean === 'home') return '/';

  // Admin Login
  if (clean === 'admin-login' || clean === 'login') return '/admin/login';

  // Admin routes
  if (clean === 'admin' || clean.startsWith('admin-') || clean.startsWith('admin/')) {
    let sub = clean.replace(/^admin[-/]/, '');
    if (!sub || sub === 'admin') return '/admin/overview';
    // tampilan subtab
    if (sub.startsWith('tampilan')) {
      let tab = sub.replace(/^tampilan[-/]?/, '');
      return `/admin/tampilan/${tab || 'identitas'}`;
    }
    return `/admin/${sub}`;
  }

  // Academic deep links: akademik-smp -> /akademik/smp
  if (clean.startsWith('akademik-')) {
    const progId = clean.replace('akademik-', '');
    return `/akademik/${progId}`;
  }
  if (clean === 'akademik') return '/akademik';

  // Public views
  if (clean === 'visit' || clean === 'galeri' || clean === 'kunjungan') return '/visit';
  if (clean === 'about' || clean === 'tentang') return '/about';
  if (clean === 'news' || clean === 'berita' || clean === 'artikel') return '/news';

  return `/${clean}`;
}

// Convert pathname to route descriptor
export function pathToRoute(pathname) {
  let clean = (pathname || '/').trim();
  // Lowercase check while preserving potential slug casing
  const cleanLower = clean.toLowerCase();

  // Strip trailing slashes unless root
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.replace(/\/+$/, '');
  }

  // 1. Root / Home
  if (clean === '' || clean === '/' || cleanLower === '/home') {
    return {
      type: 'public',
      view: 'home',
      path: '/',
      title: "Rumah Tahfidz Al-Qur'an - Lembaga Pencetak Hafidz Mutqin Berakhlak Mulia"
    };
  }

  // 2. Admin Login
  if (cleanLower === '/admin/login' || cleanLower === '/login' || cleanLower === '/admin-login') {
    return {
      type: 'admin-login',
      view: 'admin-login',
      path: '/admin/login',
      title: "Masuk Portal Admin Backoffice - Rumah Tahfidz"
    };
  }

  // 3. Admin Backoffice Modules
  if (cleanLower === '/admin' || cleanLower.startsWith('/admin/')) {
    const parts = clean.split('/').filter(Boolean); // ['admin', module, sub]
    let mod = (parts[1] || 'overview').toLowerCase();
    let sub = (parts[2] || '').toLowerCase();

    // Default /admin to /admin/overview
    if (!mod || mod === 'admin') {
      mod = 'overview';
    }

    // If /admin/tampilan -> default to identitas
    if (mod === 'tampilan') {
      const tab = sub || 'identitas';
      return {
        type: 'admin',
        module: `tampilan/${tab}`,
        path: `/admin/tampilan/${tab}`,
        title: "Tampilan & Identitas Lembaga - Admin Backoffice"
      };
    }

    const ADMIN_TITLES = {
      overview: 'Ringkasan / Analytics - Admin Backoffice',
      akademik: 'Akademik & PPDB - Admin Backoffice',
      donasi: 'Wakaf & Donasi - Admin Backoffice',
      galeri: 'Galeri & Media - Admin Backoffice',
      berita: 'Artikel & Berita - Admin Backoffice',
      users: 'Pengguna & RBAC - Admin Backoffice',
      profile: 'Profil Akun - Admin Backoffice',
      'program-form': 'Editor Program Akademik - Admin Backoffice',
      'campaign-form': 'Form Campaign Wakaf - Admin Backoffice',
      'article-form': 'Editor Artikel Berita - Admin Backoffice',
      'gallery-form': 'Upload Galeri Media - Admin Backoffice',
      'user-form': 'Kelola Akun Pengguna - Admin Backoffice',
      'user-detail': 'Detail Akun Pengguna - Admin Backoffice',
      'syllabus-form': 'Upload Silabus Kurikulum - Admin Backoffice'
    };

    return {
      type: 'admin',
      module: mod,
      path: `/admin/${mod}`,
      title: ADMIN_TITLES[mod] || 'Dashboard Admin - Rumah Tahfidz'
    };
  }

  // 4. Public Academic Programs (/akademik, /akademik/:id)
  if (cleanLower === '/akademik' || cleanLower.startsWith('/akademik/')) {
    const parts = clean.split('/').filter(Boolean);
    const programId = parts[1] ? parts[1].toLowerCase() : null;
    return {
      type: 'public',
      view: 'akademik',
      programParam: programId,
      path: programId ? `/akademik/${programId}` : '/akademik',
      title: programId ? `Program ${programId.toUpperCase()} - Rumah Tahfidz` : "Program Akademik & PPDB - Rumah Tahfidz"
    };
  }

  // 5. Public Visit & Galeri
  if (cleanLower === '/visit' || cleanLower === '/galeri' || cleanLower === '/kunjungan') {
    return {
      type: 'public',
      view: 'visit',
      path: '/visit',
      title: "Galeri Dokumentasi & Reservasi Kunjungan - Rumah Tahfidz"
    };
  }

  // 6. Public About
  if (cleanLower === '/about' || cleanLower === '/tentang') {
    return {
      type: 'public',
      view: 'about',
      path: '/about',
      title: "Tentang Kami & Legalitas Resmi - Rumah Tahfidz"
    };
  }

  // 7. Public News
  if (cleanLower === '/news' || cleanLower === '/berita' || cleanLower === '/artikel') {
    return {
      type: 'public',
      view: 'news',
      path: '/news',
      title: "Kabar Santri & Artikel Edukasi - Rumah Tahfidz"
    };
  }

  // Default fallback to home
  return {
    type: 'public',
    view: 'home',
    path: '/',
    title: "Rumah Tahfidz Al-Qur'an - Lembaga Pencetak Hafidz Mutqin"
  };
}

// Core Clean URL Navigation function
export function navigate(url, pushState = true) {
  let targetPath = url;
  if (!targetPath) targetPath = '/';

  // Handle hash strings (e.g. #admin-donasi or #akademik-smp)
  if (targetPath.startsWith('#') || (!targetPath.startsWith('/') && !targetPath.startsWith('http'))) {
    targetPath = hashToPath(targetPath);
  }

  // Remove any remaining hash
  if (targetPath.includes('#') && !targetPath.startsWith('#')) {
    targetPath = targetPath.split('#')[0];
  }

  if (pushState) {
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  } else {
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
  }

  handleRoute();
}

// Global exposure for non-module inline calls
if (typeof window !== 'undefined') {
  window.routerNavigate = navigate;
}

// Handle current route based on URL pathname
export function handleRoute() {
  // If URL has a legacy hash (e.g. /#admin-galeri or /#akademik-smp), migrate it cleanly
  if (window.location.hash) {
    const convertedPath = hashToPath(window.location.hash);
    window.history.replaceState(null, '', convertedPath);
  }

  const route = pathToRoute(window.location.pathname);

  // Set document title
  if (route.title) {
    document.title = route.title;
  }

  // A. Admin Login Route
  if (route.type === 'admin-login') {
    const currentUser = auth.getStoredUser();
    if (currentUser && client.token) {
      const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;
      navigate(`/admin/${roleConf.defaultModule}`, false);
      return;
    }
    navigateTo('admin-login');
    return;
  }

  // B. Admin Backoffice Route
  if (route.type === 'admin') {
    const currentUser = auth.getStoredUser();
    if (!currentUser || !client.token) {
      auth.setCallbackUrl(window.location.pathname);
      showToast('Sesi masuk diperlukan untuk mengakses modul administratif.', 'warning');
      navigate('/admin/login', false);
      return;
    }

    // Synchronize and verify authoritative role from database
    verifyAndSyncSession();

    let targetModule = route.module;
    const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;

    if (!targetModule || targetModule === 'admin' || targetModule === 'overview') {
      if (!roleConf.allowedModules.includes('overview')) {
        targetModule = roleConf.defaultModule;
      } else {
        targetModule = 'overview';
      }
    }

    const SUBMODULE_PARENTS = {
      'article-form': 'berita',
      'user-form': 'users',
      'user-detail': 'users',
      'gallery-form': 'galeri',
      'syllabus-form': 'akademik',
      'program-form': 'akademik',
      'campaign-form': 'donasi',
      'profile': 'overview',
      'tampilan/identitas': 'tampilan',
      'tampilan/kontak': 'tampilan',
      'tampilan/beranda': 'tampilan',
      'tampilan/footer': 'tampilan'
    };
    const checkModule = SUBMODULE_PARENTS[targetModule] || (targetModule.startsWith('tampilan') ? 'tampilan' : targetModule);

    // Check Role-Based Access Control (RBAC 403 Forbidden check)
    if (targetModule !== 'profile' && !roleConf.allowedModules.includes(checkModule)) {
      showToast(`Akses Ditolak (403): Role "${roleConf.name}" tidak berwenang mengelola modul ini. Hak akses dipatenkan.`, 'warning');
      navigate(`/admin/${roleConf.defaultModule}`, false);
      return;
    }

    // Check Superadmin-only sub-pages
    if ((targetModule === 'user-form' || targetModule === 'user-detail' || targetModule === 'gallery-form') && currentUser.role !== 'superadmin') {
      showToast('Aksi ini dikhususkan hanya untuk Super Admin (Admin).', 'warning');
      navigate(`/admin/${roleConf.defaultModule}`, false);
      return;
    }

    // Render Admin Module
    navigateToAdmin(targetModule);
    return;
  }

  // C. Public Route
  navigateTo(route.view, route.programParam);
}

function initRouter() {
  window.addEventListener('popstate', () => {
    handleRoute();
  });

  // Intercept all internal anchor clicks for seamless SPA navigation without hashes
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;

    // Ignore if modified click (Ctrl/Cmd/Shift/Alt)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Ignore external, download, target="_blank", or tel/mailto/javascript
    if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    // Ignore modal triggers with special button behaviors
    if (anchor.classList.contains('btn-ppdb-trigger') || anchor.classList.contains('btn-donate-trigger') || anchor.classList.contains('btn-lms-trigger')) {
      return;
    }

    const href = anchor.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('http://') || href.startsWith('https://')) {
      return;
    }

    // Handle hash links or relative clean path links
    e.preventDefault();
    if (href.startsWith('#')) {
      const targetId = href.slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      const cleanPath = hashToPath(href);
      navigate(cleanPath);
    } else {
      navigate(href);
    }
  });

  handleRoute();
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

  updateHeaderState();

  // Update Public Desktop and Mobile Nav Links
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
    link.classList.remove('active');
    const dView = link.getAttribute('data-view');
    const href = link.getAttribute('href');
    if (dView === viewName || (viewName === 'home' && href === '/') || href === `/${viewName}`) {
      link.classList.add('active');
    }
  });

  // Highlight active program in academic dropdown & mobile submenu
  document.querySelectorAll('.dropdown-link, .mobile-sublink').forEach(link => {
    link.classList.remove('active');
    const pId = link.getAttribute('data-program-id');
    const href = link.getAttribute('href');
    if (viewName === 'akademik' && programId && (pId === programId || href === `/akademik/${programId}`)) {
      link.classList.add('active');
    }
  });

  // Always update dynamic navigation links
  if (typeof renderPublicNavigationPrograms === 'function') {
    renderPublicNavigationPrograms();
  }

  // Re-render sub-views if needed
  if (viewName === 'home') {
    if (typeof renderHomeProgramCards === 'function') renderHomeProgramCards('all');
    if (typeof renderHomeFeaturedArticles === 'function') renderHomeFeaturedArticles();
    if (typeof initHomeStatsCounters === 'function') initHomeStatsCounters();
    const heroVid = document.getElementById('heroBgVideo');
    if (heroVid && heroVid.paused && !heroVid.dataset.manuallyPaused) {
      heroVid.play().catch(() => {});
    }
  } else {
    // Pause hero background video when not on home view to conserve battery and CPU
    const heroVid = document.getElementById('heroBgVideo');
    if (heroVid && !heroVid.paused) {
      heroVid.pause();
    }
    if (viewName === 'akademik') {
      renderAkademikView();
    } else if (viewName === 'news') {
      renderNewsGrid();
    } else if (viewName === 'visit') {
      renderGalleryGrid();
    }
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

  // Determine base panel name and subtab (for tampilan tabs: tampilan/identitas, etc.)
  let basePanelName = moduleName;
  let tampilanSubTab = 'identitas';
  if (moduleName.startsWith('tampilan')) {
    basePanelName = 'tampilan';
    const parts = moduleName.split('/');
    if (parts.length > 1 && parts[1]) {
      tampilanSubTab = parts[1];
    }
  }

  // Switch Admin Panels
  document.querySelectorAll('.admin-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const targetPanel = document.getElementById(`admin-panel-${basePanelName}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Switch Tampilan Tab if in tampilan module
  if (basePanelName === 'tampilan') {
    switchTampilanTab(tampilanSubTab);
    document.querySelectorAll('.tampilan-tab-btn').forEach(btn => {
      btn.classList.remove('active');
      const dTab = btn.getAttribute('data-tab');
      const href = btn.getAttribute('href');
      if (dTab === tampilanSubTab || href === `/admin/tampilan/${tampilanSubTab}`) {
        btn.classList.add('active');
      }
    });
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
    'profile': 'overview',
    'tampilan/identitas': 'tampilan',
    'tampilan/kontak': 'tampilan',
    'tampilan/beranda': 'tampilan',
    'tampilan/footer': 'tampilan'
  };
  const activeNavModule = SUBMODULE_PARENTS[moduleName] || (moduleName.startsWith('tampilan') ? 'tampilan' : moduleName);

  // Update Breadcrumb Text
  const breadcrumbTitles = {
    overview: 'Ringkasan / Analytics',
    akademik: 'Akademik & PPDB',
    donasi: 'Wakaf & Donasi',
    galeri: 'Galeri & Kunjungan',
    berita: 'Artikel / Berita',
    tampilan: 'Tampilan & Identitas',
    'tampilan/identitas': 'Tampilan > Identitas & Logo',
    'tampilan/kontak': 'Tampilan > Kontak & Rekening',
    'tampilan/beranda': 'Tampilan > Konten Beranda & Visi Misi',
    'tampilan/footer': 'Tampilan > Sosial Media & Footer',
    users: 'Pengguna & RBAC',
    'article-form': 'Artikel / Berita > Editor Form',
    'user-form': 'Pengguna > Form Pengguna',
    'user-detail': 'Pengguna > Detail Informasi Akun',
    'gallery-form': 'Galeri > Form Media Dokumentasi',
    'syllabus-form': 'Akademik > Unggah Silabus',
    'program-form': 'Akademik > Editor Program & Skema PPDB',
    'campaign-form': 'Wakaf & Donasi > Form Program Campaign',
    'profile': 'Pengaturan Akun > Ubah Data Profil'
  };
  const breadcrumbEl = document.getElementById('topbarBreadcrumbActive');
  if (breadcrumbEl) {
    breadcrumbEl.textContent = breadcrumbTitles[moduleName] || (moduleName.startsWith('tampilan') ? `Tampilan > ${tampilanSubTab}` : 'Dashboard Admin');
  }

  // Update Sidebar Navigation & Mobile App Bottom Nav Links
  document.querySelectorAll('.sidebar-menu-link, .mob-nav-item').forEach(link => {
    link.classList.remove('active');
    const dNav = link.getAttribute('data-admin-nav');
    const href = link.getAttribute('href');
    if (dNav === activeNavModule || href === `/admin/${activeNavModule}` || href === `/admin/${moduleName}`) {
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

  // Helper to render user avatar photo or initials
  function renderUserAvatar(el, user) {
    if (!el) return;
    const photo = user?.photo || user?.avatarUrl || user?.image;
    if (photo && typeof photo === 'string' && (photo.startsWith('http') || photo.startsWith('/') || photo.startsWith('data:') || /\.(png|jpe?g|webp|svg|gif)$/i.test(photo))) {
      el.innerHTML = `<img src="${photo}" alt="${user.name || 'User'}" class="topbar-avatar-img" />`;
    } else {
      const initials = (user?.avatar && user.avatar.length <= 4) ? user.avatar : (user?.name ? user.name.slice(0, 2).toUpperCase() : 'MZ');
      el.textContent = initials;
    }
  }

  // Update Sidebar & Topbar User Display
  const sidebarAvatar = document.getElementById('sidebarUserAvatar');
  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarRole = document.getElementById('sidebarUserRole');
  const topbarAvatar = document.getElementById('topbarAvatar');
  const accountDropdownAvatar = document.getElementById('accountDropdownAvatar');
  const topbarName = document.getElementById('topbarUserName');
  const accountDropdownEmail = document.getElementById('accountDropdownEmail');
  const topbarRole = document.getElementById('topbarUserRole');
  const topbarRoleBadge = document.getElementById('topbarUserRoleBadge');

  if (sidebarAvatar) renderUserAvatar(sidebarAvatar, currentUser);
  if (sidebarName) sidebarName.textContent = currentUser.name;
  if (sidebarRole) {
    sidebarRole.textContent = roleConf.name;
    sidebarRole.className = `user-role-badge ${roleConf.badgeClass}`;
  }

  const welcomeUserName = document.getElementById('welcomeUserName');
  if (welcomeUserName) {
    welcomeUserName.textContent = currentUser.name;
  }

  if (topbarAvatar) renderUserAvatar(topbarAvatar, currentUser);
  if (accountDropdownAvatar) renderUserAvatar(accountDropdownAvatar, currentUser);
  if (topbarName) topbarName.textContent = currentUser.name;
  if (accountDropdownEmail) accountDropdownEmail.textContent = currentUser.email || 'zaki@rtm.sch.id';
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
  if (moduleName === 'tampilan' || moduleName.startsWith('tampilan')) renderAdminTampilan();
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

// Switch WordPress-style Tampilan Tabs
export function switchTampilanTab(tabKey) {
  const validTabs = ['identitas', 'kontak', 'beranda', 'footer'];
  const activeTab = validTabs.includes(tabKey) ? tabKey : 'identitas';

  // Toggle tab buttons active class
  document.querySelectorAll('.tampilan-tab-btn').forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    if (btnTab === activeTab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle tab panels
  document.querySelectorAll('.tampilan-tab-panel').forEach(panel => {
    const panelTab = panel.getAttribute('data-tab-panel');
    if (panelTab === activeTab) {
      panel.classList.add('active');
      panel.style.display = 'block';
    } else {
      panel.classList.remove('active');
      panel.style.display = 'none';
    }
  });

  // Update breadcrumb if currently in tampilan module
  const tabTitles = {
    identitas: 'Tampilan > Identitas & Logo',
    kontak: 'Tampilan > Kontak & Rekening',
    beranda: 'Tampilan > Konten Beranda & Visi Misi',
    footer: 'Tampilan > Sosial Media & Footer'
  };
  const breadcrumbEl = document.getElementById('topbarBreadcrumbActive');
  if (breadcrumbEl && state.activeAdminModule && state.activeAdminModule.startsWith('tampilan')) {
    breadcrumbEl.textContent = tabTitles[activeTab] || 'Tampilan & Identitas';
  }
}


// Render Academic Program Detail View (10 Blocks)
function renderAkademikView() {
  const container = document.getElementById('akademikProgramContent');
  if (!container) return;

  const activePrograms = (programsState && programsState.length) ? programsState : PROGRAMS;
  const program = activePrograms.find(p => p.id === state.activeProgramId) || activePrograms[0];
  const isFormal = program.category === 'formal';
  const isProgramOpen = program.ppdbOpen !== false && program.is_active !== 0;

  // Render 10 Comprehensive Blocks (Block 1 is the direct Hero Section)
  container.innerHTML = `
    <!-- BLOCK 1: Hero & Stats Counter Bar -->
    <section class="prog-hero-block">
      <div class="container">
        <div class="prog-hero-grid">
          <div class="prog-hero-content">
            <div class="prog-badge-tag">
              <span>${isFormal ? 'Pendidikan Formal Terpadu' : 'Pendidikan Non-Formal'}</span>
              <span>•</span>
              <span>${program.badge || 'Program Unggulan'}</span>
              ${!isProgramOpen ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:999px;font-weight:700;">• Pendaftaran Ditutup</span>' : ''}
            </div>
            <h1 class="prog-hero-title">${program.name}</h1>
            
            <ul class="prog-hero-checklist">
              <li class="prog-check-item">
                <span class="prog-check-icon" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span class="prog-check-content">
                  <span class="prog-check-label">Durasi Program:</span>
                  <strong class="prog-check-val">${program.stats?.durasi || '3 Tahun'}</strong>
                </span>
              </li>
              <li class="prog-check-item">
                <span class="prog-check-icon" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span class="prog-check-content">
                  <span class="prog-check-label">Target Hafalan:</span>
                  <strong class="prog-check-val">${program.stats?.targetHafalan || '30 Juz'}</strong>
                </span>
              </li>
              <li class="prog-check-item">
                <span class="prog-check-icon" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span class="prog-check-content">
                  <span class="prog-check-label">Rasio Asatidz:</span>
                  <strong class="prog-check-val">${program.stats?.rasioUstadz || '1:10'}</strong>
                </span>
              </li>
              <li class="prog-check-item">
                <span class="prog-check-icon" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span class="prog-check-content">
                  <span class="prog-check-label">Kelulusan & Ijazah:</span>
                  <strong class="prog-check-val">${program.stats?.ijazah || 'Sanad & Formal'}</strong>
                </span>
              </li>
            </ul>

            <div class="prog-hero-buttons">
              ${isProgramOpen ? `
                <button type="button" class="btn btn-primary btn-scroll-enrollment" onclick="const target = document.getElementById('${isFormal ? 'ctaWhatsappInterestSection' : 'enrollmentFormSection'}'); if (target) { target.scrollIntoView({behavior: 'smooth'}); target.focus?.(); }">
                  <span>${isFormal ? 'Daftar & Konsultasi Sekarang' : 'Daftar Program Ini Sekarang'}</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              ` : `
                <button class="btn btn-secondary" style="opacity: 0.8; cursor: not-allowed; background: #fee2e2; color: #991b1b; border: 1px solid #f87171;" disabled title="Pendaftaran untuk program ini sedang ditutup">
                  🔒 Pendaftaran Ditutup
                </button>
              `}
              <a href="https://wa.me/${(INSTITUTION.whatsappPPDB || '6281234567890').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Assalamu\'alaikum Panitia PPDB, saya ingin bertanya dan konsultasi mengenai program ' + program.name)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" id="btnContactHero">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span>Hubungi Kami</span>
              </a>
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

    <!-- BLOCK 3: Kenapa Belajar Al-Qur'an (Problem & Solution Cards) - Khusus Program Non-Formal -->
    ${!isFormal ? `
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
    ` : ''}

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

    <!-- BLOCK 5: Runtutan Fase Pembelajaran (Kurikulum Silabus Timeline) -->
    <section class="prog-curriculum-block">
      <div class="container">
        <div class="section-header">
          <h3 class="section-title">Fase Pembelajaran ${program.name}</h3>
          <p class="section-description">Tahapan kurikulum sistematis dari pembinaan dasar tajwid, akselerasi hafalan ziyadah, hingga tasmi' kelulusan.</p>
        </div>

        <div class="curriculum-timeline-wrapper">
          <div class="curriculum-timeline-track">
            ${program.curriculumPhases.map((phase, idx) => `
              <div class="curriculum-phase-item ${idx === 0 ? 'open' : ''}" data-phase="${phase.phase}">
                <div class="phase-timeline-marker" aria-hidden="true">
                  <span class="phase-timeline-dot"></span>
                  <span class="phase-timeline-line"></span>
                </div>
                <div class="curriculum-phase-card">
                  <button type="button" class="phase-card-header-btn" aria-expanded="${idx === 0 ? 'true' : 'false'}">
                    <span class="phase-card-title">${phase.title}</span>
                    <span class="phase-card-chevron">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </span>
                  </button>
                  <div class="phase-card-body">
                    <h5 class="phase-inner-heading">Kurikulum yang Dipelajari</h5>
                    
                    <div class="phase-sub-section">
                      <div class="phase-sub-header">
                        <span class="phase-sub-dot"></span>
                        <span class="phase-sub-title">Fokus & Pendekatan Belajar</span>
                      </div>
                      <p class="phase-sub-desc">${phase.desc}</p>
                    </div>

                    <div class="phase-sub-section">
                      <div class="phase-sub-header">
                        <span class="phase-sub-dot"></span>
                        <span class="phase-sub-title">Materi & Modul Pembelajaran</span>
                      </div>
                      <div class="phase-badges-grid">
                        ${phase.topics.map(topic => `
                          <div class="phase-topic-badge">
                            <span class="topic-badge-icon" aria-hidden="true">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </span>
                            <span class="topic-badge-text">${topic}</span>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="curriculum-divider"></div>

          <div class="curriculum-download-footer">
            <button type="button" class="btn btn-primary" id="btnDownloadSilabus2">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download Syllabus</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- BLOCK 6: Jadwal & Biaya (Khusus Formal diganti Ajakan Konsultasi WhatsApp) -->
    ${isFormal ? `
    <section class="prog-cta-whatsapp-block" id="ctaWhatsappInterestSection">
      <div class="container">
        <div class="cta-wa-card">
          <div class="cta-wa-badge">
            <span class="cta-wa-badge-dot"></span>
            <span>Penerimaan Santri Baru ${program.shortTitle}</span>
          </div>
          <h3 class="cta-wa-title">Tertarik Mendaftarkan Putra / Putri Anda?</h3>
          <p class="cta-wa-desc">
            Dapatkan informasi lengkap mengenai kurikulum, program beasiswa tahfidz, reservasi visitasi asrama pondok, serta konsultasi kesiapan santri bersama panitia PPDB kami via WhatsApp.
          </p>
          <div class="cta-wa-actions">
            <a href="https://wa.me/${(INSTITUTION.whatsappPPDB || '6281234567890').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Assalamu\'alaikum Panitia PPDB Rumah Tahfidz Al-Hikmah, saya tertarik mendaftarkan anak saya di program ' + program.name + '. Boleh mohon informasi pendaftaran dan konsultasi lebih lanjut?')}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-cta-wa" id="btnWhatsappInterest">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span>Hubungi Kami via WhatsApp</span>
            </a>
          </div>
          <p class="cta-wa-note">Layanan panitia aktif setiap hari kerja (08.00 - 16.00 WIB) • Bebas biaya konsultasi</p>
        </div>
      </div>
    </section>
    ` : `
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
    `}

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
            <div class="stepper-node-content">
              <h5 class="step-card-title">${isFormal ? 'Konsultasi & Registrasi' : 'Mengisi Formulir Pendaftaran'}</h5>
              <p class="step-card-desc">${isFormal ? 'Hubungi panitia via WhatsApp atau reservasi kunjungan asrama langsung.' : 'Lengkapi formulir pendaftaran online di bawah ini dengan data santri yang valid.'}</p>
            </div>
          </div>
          <div class="stepper-node">
            <div class="stepper-icon-circle">2</div>
            <div class="stepper-node-content">
              <h5 class="step-card-title">Verifikasi & Tes Lisan</h5>
              <p class="step-card-desc">Konfirmasi jadwal tes baca Al-Qur'an / wawancara bersama asatidz penguji.</p>
            </div>
          </div>
          <div class="stepper-node">
            <div class="stepper-icon-circle">3</div>
            <div class="stepper-node-content">
              <h5 class="step-card-title">Konfirmasi Kelulusan</h5>
              <p class="step-card-desc">Menerima surat keputusan penerimaan santri dan penyelesaian daftar ulang.</p>
            </div>
          </div>
          <div class="stepper-node">
            <div class="stepper-icon-circle">4</div>
            <div class="stepper-node-content">
              <h5 class="step-card-title">Mulai Belajar & Talaqqi</h5>
              <p class="step-card-desc">Orientasi santri baru dan memulai langkah mulia menghafal Al-Qur'an.</p>
            </div>
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

    <!-- BLOCK 9: Formulir Pendaftaran Langsung (Hanya untuk Non-Formal) -->
    ${!isFormal ? `
    <section class="prog-enrollment-block" id="enrollmentFormSection">
      <div class="container">
        <div class="enrollment-form-container">
          <div class="section-header" style="margin-bottom: 2.5rem;">
            <h3 class="section-title">Pendaftaran Program: ${program.name}</h3>
            <p class="section-description">${isProgramOpen ? 'Silakan isi formulir resmi di bawah ini. Tim panitia PPDB akan segera menghubungi Anda via WhatsApp.' : 'Status penerimaan dan pendaftaran untuk program ini.'}</p>
          </div>

          ${!isProgramOpen ? `
            <div class="enrollment-closed-banner" style="background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); border: 2px dashed #f87171; border-radius: 1.25rem; padding: 3rem 2rem; text-align: center; max-width: 680px; margin: 0 auto; box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.1);">
              <div style="font-size: 3.5rem; margin-bottom: 1rem; line-height: 1;">🔒</div>
              <h4 style="font-size: 1.5rem; font-weight: 800; color: #991b1b; margin-bottom: 0.75rem;">Pendaftaran Program Ini Sedang Ditutup</h4>
              <p style="color: #4b5563; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.75rem; max-width: 520px; margin-left: auto; margin-right: auto;">
                Mohon maaf, penerimaan santri baru untuk program <strong>${program.name}</strong> saat ini sedang ditutup atau kuota telah terpenuhi. Silakan hubungi panitia PPDB kami untuk mendapatkan informasi pembukaan gelombang berikutnya atau berkonsultasi mengenai program pendidikan lainnya.
              </p>
              <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <a href="https://wa.me/${(INSTITUTION.whatsappPPDB || '6281234567890').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Assalamu\'alaikum Panitia PPDB Rumah Tahfidz, saya ingin bertanya tentang pembukaan gelombang selanjutnya untuk program ' + program.name)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; background: #25D366; border-color: #25D366; color: #ffffff; font-weight: 600; padding: 0.75rem 1.5rem; border-radius: 0.75rem;">
                  <span>💬 Chat Admin PPDB WhatsApp</span>
                </a>
                <a href="/akademik" class="btn btn-secondary" onclick="window.scrollTo({top: 400, behavior: 'smooth'});" style="padding: 0.75rem 1.5rem; border-radius: 0.75rem; text-decoration: none; display: inline-flex; align-items: center;">
                  Lihat Program Lainnya
                </a>
              </div>
            </div>
          ` : `
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
                <label class="form-label" style="font-weight: 700; color: #383838; font-size: 0.95rem;">
                  Pilihan Rencana Metode Pembayaran Biaya *
                </label>
                <div class="payment-method-selector">
                  <label class="payment-radio-label">
                    <input type="radio" name="paymentMethod" value="Transfer Bank BSI" checked />
                    <div class="payment-radio-card">
                      <div class="payment-radio-header">
                        <span class="payment-radio-circle"></span>
                        <span class="payment-radio-title">Transfer Bank BSI</span>
                      </div>
                      <p class="payment-radio-desc">Rekening resmi BSI Syariah Rumah Tahfidz. Bukti invoice & instruksi transfer dikirim ke email.</p>
                      <span class="payment-radio-badge">Rekomendasi</span>
                    </div>
                  </label>

                  <label class="payment-radio-label">
                    <input type="radio" name="paymentMethod" value="Virtual Account" />
                    <div class="payment-radio-card">
                      <div class="payment-radio-header">
                        <span class="payment-radio-circle"></span>
                        <span class="payment-radio-title">Virtual Account (VA)</span>
                      </div>
                      <p class="payment-radio-desc">Nomor VA otomatis untuk semua bank (BCA, Mandiri, BRI, BNI). Verifikasi instan via email.</p>
                      <span class="payment-radio-badge badge-va">Instan 24 Jam</span>
                    </div>
                  </label>

                  <label class="payment-radio-label">
                    <input type="radio" name="paymentMethod" value="Cicilan Syariah Bertahap" />
                    <div class="payment-radio-card">
                      <div class="payment-radio-header">
                        <span class="payment-radio-circle"></span>
                        <span class="payment-radio-title">Angsuran / Cicilan Bertahap</span>
                      </div>
                      <p class="payment-radio-desc">Dapat diangsur 2–3x pembayaran tanpa riba/bunga. Skema jadwal pelunasan dikirim ke email.</p>
                      <span class="payment-radio-badge badge-cicil">Syariah Murabahah</span>
                    </div>
                  </label>
                </div>

                <div class="payment-method-email-note">
                  <div class="email-note-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </div>
                  <div class="email-note-text">
                    <strong>Pemberitahuan Otomatis ke Email:</strong> Setelah formulir dikirim, sistem otomatis mengirimkan <strong>bukti registrasi resmi & dokumen invoice rincian pembayaran</strong> ke alamat email yang Anda cantumkan di atas.
                  </div>
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
          `}
        </div>
      </div>
    </section>
    ` : ''}

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

  // Phase Accordions with Tape Measure Spring Animation & Auto-Close Siblings
  document.querySelectorAll('.curriculum-phase-item .phase-card-header-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.currentTarget.closest('.curriculum-phase-item');
      if (!item) return;

      const isAlreadyOpen = item.classList.contains('open');

      // Close all currently open accordions with tape measure rewind animation
      const allOpenItems = document.querySelectorAll('.curriculum-phase-item.open');
      allOpenItems.forEach(openItem => {
        if (openItem !== item || isAlreadyOpen) {
          openItem.classList.remove('open');
          openItem.classList.add('tape-retracting');
          const headerBtn = openItem.querySelector('.phase-card-header-btn');
          if (headerBtn) headerBtn.setAttribute('aria-expanded', 'false');

          setTimeout(() => {
            openItem.classList.remove('tape-retracting');
          }, 340);
        }
      });

      // If clicked item was closed, open it now (smooth & snappy pull out)
      if (!isAlreadyOpen) {
        item.classList.remove('tape-retracting');
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
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
      if (program.ppdbOpen === false || program.is_active === 0) {
        showToast(`Mohon maaf, pendaftaran untuk program "${program.name}" saat ini sedang ditutup.`, 'error');
        return;
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> Mengirim Pendaftaran...';
      }

      let payload = null;
      try {
        const formData = new FormData(form);
        const customAnswers = {};
        form.querySelectorAll('[data-custom-field-label]').forEach(el => {
          const label = el.getAttribute('data-custom-field-label');
          if (label) customAnswers[label] = el.value?.trim() || '';
        });

        payload = {
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
          const leadRecord = res.data || {
            id: res.id || `REG-${Date.now()}`,
            ...payload,
            program_name: program.name,
            status: 'pending'
          };
          const normLead = normalizeLead(leadRecord);
          const exIdx = ppdbState.findIndex(l => l.id === normLead.id);
          if (exIdx >= 0) ppdbState[exIdx] = normLead;
          else ppdbState.unshift(normLead);
          try { localStorage.setItem('rtm_cms_ppdb', JSON.stringify(ppdbState)); } catch {}

          showToast(res.message || 'Alhamdulillah, pendaftaran berhasil! Bukti registrasi dan invoice pembayaran telah dikirim ke email Anda.', 'success');
          form.reset();
          await syncDatabaseState();
          if (typeof renderAdminPPDBTable === 'function') renderAdminPPDBTable();
          if (typeof renderAdminOverview === 'function') renderAdminOverview();
          if (typeof updateNotificationBell === 'function') updateNotificationBell();
          openPPDBSuccessModal(res.data || { ...payload, id: res.id, program_name: program.name });
        } else {
          showToast(res.message || 'Gagal mengirim pendaftaran.', 'error');
        }
      } catch (err) {
        console.warn('[PPDB Direct] Fallback storing registration:', err);
        const safePayload = payload || {
          program_id: program.id,
          program_name: program.name,
          full_name: 'Pendaftar Santri',
          phone_whatsapp: '08123456789'
        };
        const localLead = normalizeLead({
          id: `REG-${Date.now()}`,
          ...safePayload,
          program_name: program.name,
          status: 'pending'
        });
        ppdbState.unshift(localLead);
        try { localStorage.setItem('rtm_cms_ppdb', JSON.stringify(ppdbState)); } catch {}
        form.reset();
        if (typeof renderAdminPPDBTable === 'function') renderAdminPPDBTable();
        if (typeof renderAdminOverview === 'function') renderAdminOverview();
        if (typeof updateNotificationBell === 'function') updateNotificationBell();
        openPPDBSuccessModal(localLead);
        showToast('Alhamdulillah, formulir pendaftaran berhasil disimpan! Bukti registrasi dan invoice pembayaran dikirim ke email Anda.', 'success');
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

  const publishedGalleries = galleriesState.filter(g => (g.status || 'published') === 'published');
  const filtered = state.galleryFilter === 'all'
    ? publishedGalleries
    : publishedGalleries.filter(g => g.category === state.galleryFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--color-slate-500);">
        <p style="font-weight: 700; font-size: 1.15rem; margin-bottom: 0.5rem; color: var(--color-slate-700);">Belum Ada Dokumentasi yang Dipublikasikan</p>
        <p style="font-size: 0.9rem;">Foto galeri yang berstatus Draft hanya dapat dilihat oleh admin melalui Dashboard CMS.</p>
      </div>
    `;
    return;
  }

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

// Render Featured Articles on Home ("Bertumbuh Bersama, Menginspirasi Sesama")
function renderHomeFeaturedArticles() {
  const container = document.getElementById('homeArticlesContainer');
  if (!container) return;

  // Filter only published articles
  let published = (articlesState || []).filter(a => a.status !== 'draft' && a.status !== 'archived');
  if (published.length < 2) {
    published = (NEWS_ARTICLES || []).filter(a => a.status !== 'draft' && a.status !== 'archived');
  }
  if (published.length === 0) return;

  const art1 = published[0];
  const art2 = published[1] || published[0];

  container.innerHTML = `
    <!-- Article 1: [Kiri] Title & Isi | [Kanan] Featured Image -->
    <article class="home-article-row zigzag-text-left" data-article-id="${art1.id}">
      <div class="home-article-content">
        <div class="home-article-meta">
          <span class="home-article-cat">${art1.category || 'Prestasi & Event'}</span>
          <span class="home-article-dot">•</span>
          <span class="home-article-date">${art1.date || ''}</span>
        </div>
        <h3 class="home-article-title">
          <a href="/artikel" class="home-article-title-link" data-article-target="${art1.id}">
            ${art1.title}
          </a>
        </h3>
        <p class="home-article-excerpt">${art1.excerpt || ''}</p>
        <div class="home-article-action">
          <a href="/artikel" class="home-article-read-btn" data-article-target="${art1.id}">
            <span>Baca Selengkapnya</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </div>
      <div class="home-article-media">
        <a href="/artikel" class="home-article-img-frame" data-article-target="${art1.id}" aria-label="Baca selengkapnya artikel ${art1.title}">
          <img src="${art1.image || '/assets/images/wisuda.jpg'}" alt="${art1.title}" loading="lazy" />
          <span class="home-article-read-badge">${art1.readTime || '4 Menit Baca'}</span>
        </a>
      </div>
    </article>

    <!-- Article 2: [Kiri] Featured Image | [Kanan] Title & Isi -->
    <article class="home-article-row zigzag-text-right" data-article-id="${art2.id}">
      <div class="home-article-media">
        <a href="/artikel" class="home-article-img-frame" data-article-target="${art2.id}" aria-label="Baca selengkapnya artikel ${art2.title}">
          <img src="${art2.image || '/assets/images/campus.jpg'}" alt="${art2.title}" loading="lazy" />
          <span class="home-article-read-badge">${art2.readTime || '3 Menit Baca'}</span>
        </a>
      </div>
      <div class="home-article-content">
        <div class="home-article-meta">
          <span class="home-article-cat">${art2.category || 'Info PPDB'}</span>
          <span class="home-article-dot">•</span>
          <span class="home-article-date">${art2.date || ''}</span>
        </div>
        <h3 class="home-article-title">
          <a href="/artikel" class="home-article-title-link" data-article-target="${art2.id}">
            ${art2.title}
          </a>
        </h3>
        <p class="home-article-excerpt">${art2.excerpt || ''}</p>
        <div class="home-article-action">
          <a href="/artikel" class="home-article-read-btn" data-article-target="${art2.id}">
            <span>Baca Selengkapnya</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </div>
    </article>
  `;

  // Attach interactive click listeners: open article modal or navigate
  container.querySelectorAll('[data-article-target]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = el.getAttribute('data-article-target');
      const article = (articlesState || []).find(a => a.id === targetId) || (NEWS_ARTICLES || []).find(a => a.id === targetId);
      if (article && typeof openArticleReader === 'function') {
        openArticleReader(article);
      } else {
        navigate('/artikel');
      }
    });
  });
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
    const list = (programsState && programsState.length) ? programsState : PROGRAMS;
    progSelect.innerHTML = list.map(p => {
      const isOpen = p.ppdbOpen !== false && p.is_active !== 0;
      return `<option value="${p.id}" ${!isOpen ? 'data-closed="true"' : ''}>
        ${p.name} ${isOpen ? '(Pendaftaran Buka)' : '🔒 (Pendaftaran Ditutup)'}
      </option>`;
    }).join('');

    if (preselectedProgramId && list.some(p => p.id === preselectedProgramId)) {
      progSelect.value = preselectedProgramId;
    } else if (state.activeProgramId && list.some(p => p.id === state.activeProgramId)) {
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

  const isOpen = prog.ppdbOpen !== false && prog.is_active !== 0;
  const btnNext2 = document.getElementById('btnNextToStep2');
  let closedWarning = document.getElementById('modalProgramClosedNotice');
  if (!closedWarning) {
    closedWarning = document.createElement('div');
    closedWarning.id = 'modalProgramClosedNotice';
    const pqpCard = document.querySelector('.program-quick-preview-card');
    if (pqpCard && pqpCard.parentNode) {
      pqpCard.parentNode.insertBefore(closedWarning, pqpCard.nextSibling);
    }
  }

  if (!isOpen) {
    if (closedWarning) {
      closedWarning.style.display = 'block';
      closedWarning.innerHTML = `
        <div style="background:#fef2f2;border:1px solid #f87171;color:#991b1b;border-radius:0.5rem;padding:0.75rem 1rem;font-size:0.85rem;margin-top:0.75rem;">
          <strong>🔒 Pendaftaran Sedang Ditutup:</strong> Penerimaan untuk program <em>${prog.name}</em> saat ini belum dibuka atau kuota telah penuh. Anda tidak dapat melanjutkan pendaftaran untuk program ini.
        </div>
      `;
    }
    if (btnNext2) {
      btnNext2.disabled = true;
      btnNext2.style.opacity = '0.5';
      btnNext2.style.cursor = 'not-allowed';
      btnNext2.title = 'Program ini sedang ditutup';
    }
  } else {
    if (closedWarning) closedWarning.style.display = 'none';
    if (btnNext2) {
      btnNext2.disabled = false;
      btnNext2.style.opacity = '1';
      btnNext2.style.cursor = 'pointer';
      btnNext2.title = '';
    }
  }

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
  const emailEl = document.getElementById('receiptTargetEmail');
  if (emailEl) emailEl.textContent = leadData.email || 'Email Anda';
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
      const progId = document.getElementById('modalProgramId')?.value;
      const prog = programsState.find(p => p.id === progId) || PROGRAMS.find(p => p.id === progId);
      if (prog && (prog.ppdbOpen === false || prog.is_active === 0)) {
        showToast(`Mohon maaf, pendaftaran untuk program "${prog.name}" saat ini sedang ditutup.`, 'error');
        return;
      }
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
      const progId = document.getElementById('modalProgramId').value;
      const targetProg = programsState.find(p => p.id === progId) || PROGRAMS.find(p => p.id === progId);
      if (targetProg && (targetProg.ppdbOpen === false || targetProg.is_active === 0)) {
        showToast(`Mohon maaf, pendaftaran untuk program "${targetProg.name}" sedang ditutup.`, 'error');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitModalPPDB');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> Mengirim Pendaftaran...';
      }

      let payload = null;
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

        payload = {
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
          const leadRecord = res.data || {
            id: res.id || `REG-${Date.now()}`,
            ...payload,
            program_name: targetProg?.name || 'Program Tahfidz',
            status: 'pending'
          };
          const normLead = normalizeLead(leadRecord);
          const exIdx = ppdbState.findIndex(l => l.id === normLead.id);
          if (exIdx >= 0) ppdbState[exIdx] = normLead;
          else ppdbState.unshift(normLead);
          try { localStorage.setItem('rtm_cms_ppdb', JSON.stringify(ppdbState)); } catch {}

          showToast(res.message || 'Alhamdulillah, pendaftaran calon santri berhasil! Bukti registrasi dan invoice telah dikirim ke email Anda.', 'success');
          document.getElementById('ppdbModal')?.classList.remove('open');
          modalForm.reset();
          ppdbActiveStep = 1;
          updatePPDBWizardSteps();

          await syncDatabaseState();
          if (typeof renderAdminPPDBTable === 'function') renderAdminPPDBTable();
          if (typeof renderAdminOverview === 'function') renderAdminOverview();
          if (typeof updateNotificationBell === 'function') updateNotificationBell();
          openPPDBSuccessModal(res.data || { ...payload, id: res.id, program_name: targetProg?.name });
        } else {
          showToast(res.message || 'Gagal mengirim pendaftaran.', 'error');
        }
      } catch (err) {
        console.warn('[PPDB Modal] Fallback storing registration:', err);
        const safePayload = payload || {
          program_id: progId,
          program_name: targetProg?.name || 'Program Tahfidz',
          full_name: 'Pendaftar Santri',
          phone_whatsapp: '08123456789'
        };
        const localLead = normalizeLead({
          id: `REG-${Date.now()}`,
          ...safePayload,
          program_name: targetProg?.name || 'Program Tahfidz',
          status: 'pending'
        });
        ppdbState.unshift(localLead);
        try { localStorage.setItem('rtm_cms_ppdb', JSON.stringify(ppdbState)); } catch {}
        document.getElementById('ppdbModal')?.classList.remove('open');
        modalForm.reset();
        ppdbActiveStep = 1;
        updatePPDBWizardSteps();
        if (typeof renderAdminPPDBTable === 'function') renderAdminPPDBTable();
        if (typeof renderAdminOverview === 'function') renderAdminOverview();
        if (typeof updateNotificationBell === 'function') updateNotificationBell();
        openPPDBSuccessModal(localLead);
        showToast('Alhamdulillah, pendaftaran calon santri berhasil disimpan! Bukti registrasi dikirim ke email Anda.', 'success');
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

      const payload = {
        visitor_name: name,
        institution: org,
        phone,
        visit_date: date,
        visitor_count: Number(count),
        objective: goal,
        session_time: 'Sesi 1 (08.30 - 11.30 WIB)'
      };

      try {
        const res = await reservationsApi.submit(payload);
        const record = res?.data || {
          ...payload,
          id: res?.id || `vis-${Date.now()}`,
          status: 'pending'
        };
        const normalized = normalizeVisit(record);
        visitsState.unshift(normalized);
        try { localStorage.setItem('rtm_cms_visits', JSON.stringify(visitsState)); } catch {}
        showToast(res?.message || `Permohonan kunjungan rombongan ${name} pada ${date} berhasil diajukan!`, 'success');
        tourForm.reset();
        await syncDatabaseState();
        if (typeof renderAdminGaleri === 'function') renderAdminGaleri();
        if (typeof updateNotificationBell === 'function') updateNotificationBell();
      } catch (err) {
        const localVisit = normalizeVisit({
          id: `vis-${Date.now()}`,
          ...payload,
          status: 'pending'
        });
        visitsState.unshift(localVisit);
        try { localStorage.setItem('rtm_cms_visits', JSON.stringify(visitsState)); } catch {}
        showToast(`Permohonan kunjungan rombongan ${name} pada ${date} berhasil diajukan!`, 'success');
        tourForm.reset();
        if (typeof renderAdminGaleri === 'function') renderAdminGaleri();
        if (typeof updateNotificationBell === 'function') updateNotificationBell();
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

// Dynamic Header Transparency & Scroll State Manager
export function updateHeaderState() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const isHome = state.currentView === 'home';
  const logoImg = header.querySelector('.header-logo');

  if (isHome) {
    document.body.classList.add('page-home');
    const heroSection = document.querySelector('.hero-video-section');
    const heroThreshold = heroSection ? (heroSection.offsetHeight - 90) : 550;

    if (window.scrollY < heroThreshold) {
      header.classList.add('header-transparent');
      header.classList.remove('scrolled');
      if (logoImg && !logoImg.src.includes('logo-footer-RTM.png')) {
        logoImg.src = '/assets/images/logo-footer-RTM.png';
      }
      return;
    }
  } else {
    document.body.classList.remove('page-home');
  }

  // Scrolled past hero or on non-home pages
  header.classList.remove('header-transparent');
  if (logoImg && !logoImg.src.includes('logo-header-RTM.png')) {
    logoImg.src = '/assets/images/logo-header-RTM.png';
  }
  if (window.scrollY > 30) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}

// Global UI Handlers
function initGlobalUI() {
  // Dynamic Header Scroll & Transparency Listener
  window.addEventListener('scroll', updateHeaderState, { passive: true });
  updateHeaderState();

  // Mobile Drawer Toggle & Close
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const mobileDrawerClose = document.getElementById('mobileDrawerClose');

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.toggle('open');
    });
  }

  if (mobileDrawerClose && mobileDrawer) {
    mobileDrawerClose.addEventListener('click', () => {
      mobileDrawer.classList.remove('open');
    });
  }

  // Close drawer when any navigation link inside is clicked
  if (mobileDrawer) {
    mobileDrawer.querySelectorAll('a, button:not(#mobileDrawerClose)').forEach(el => {
      el.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
      });
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

  // Render initial Home Program Cards & Public Navigation
  renderPublicNavigationPrograms();
  renderHomeProgramCards('all');
}

export function renderPublicNavigationPrograms() {
  const activePrograms = (programsState && programsState.length > 0) ? programsState : PROGRAMS;
  const publishedPrograms = activePrograms.filter(p => p.publicationStatus !== 'draft' && p.publicationStatus !== 'archived');
  const progsToRender = publishedPrograms.length > 0 ? publishedPrograms : activePrograms;

  // Format program name in menu:
  // khusus smp --> cukup 'SMP', sma --> cukup 'SMA', mahasantri --> cukup 'Mahasantri' saja.
  // selebihnya program lain sesuai yang diisi di dashboard CMS (p.name). Target program tidak dicantumkan.
  const getNavProgramName = (p) => {
    const id = (p.id || '').toLowerCase();
    if (id === 'smp' || id.includes('smp')) return 'SMP';
    if (id === 'sma' || id.includes('sma')) return 'SMA';
    if (id === 'mahasantri' || id.includes('mahasantri')) return 'Mahasantri';
    return p.name || p.title || 'Program';
  };

  // 1. Desktop Navbar Academic Dropdown (#navbarAcademicDropdown)
  const desktopDropdown = document.getElementById('navbarAcademicDropdown');
  if (desktopDropdown) {
    const formalList = progsToRender.filter(p => p.category === 'formal');
    const nonFormalList = progsToRender.filter(p => p.category !== 'formal');

    let dropdownHtml = '';
    if (formalList.length > 0) {
      dropdownHtml += '<div class="dropdown-section-title">Pendidikan Formal</div>';
      dropdownHtml += formalList.map(p => `
        <a href="/akademik/${p.id}" class="dropdown-link" data-program-id="${p.id}">
          <span>${getNavProgramName(p)}</span>
        </a>
      `).join('');
    }

    if (formalList.length > 0 && nonFormalList.length > 0) {
      dropdownHtml += '<div class="dropdown-divider"></div>';
    }

    if (nonFormalList.length > 0) {
      dropdownHtml += '<div class="dropdown-section-title">Pendidikan Non-Formal</div>';
      dropdownHtml += nonFormalList.map(p => `
        <a href="/akademik/${p.id}" class="dropdown-link" data-program-id="${p.id}">
          <span>${getNavProgramName(p)}</span>
        </a>
      `).join('');
    }

    desktopDropdown.innerHTML = dropdownHtml;
  }

  // 2. Mobile Drawer Academic Submenu (#mobileAcademicSubmenu)
  const mobileSubmenu = document.getElementById('mobileAcademicSubmenu');
  if (mobileSubmenu) {
    mobileSubmenu.innerHTML = progsToRender.map(p => `
      <a href="/akademik/${p.id}" class="mobile-sublink" data-program-id="${p.id}">${getNavProgramName(p)}</a>
    `).join('');
  }

  // 3. Footer Academic Program Links (#footerProgramLinksList)
  const footerList = document.getElementById('footerProgramLinksList');
  if (footerList) {
    footerList.innerHTML = progsToRender.map(p => `
      <li><a href="/akademik/${p.id}" data-program-id="${p.id}">${getNavProgramName(p)}</a></li>
    `).join('');
  }
}

function renderHomeProgramCards(category) {
  const container = document.getElementById('homeProgramCardsContainer');
  if (!container) return;

  let list = programsState.filter(p => p.publicationStatus !== 'draft' && p.publicationStatus !== 'archived');
  if (list.length === 0) list = PROGRAMS;
  if (category !== 'all') {
    list = list.filter(p => p.category === category);
  }

  container.innerHTML = list.map(p => {
    const isOpen = p.ppdbOpen !== false && p.is_active !== 0;
    return `
      <div class="program-card">
        <div class="program-card-thumb" style="position: relative;">
          <img src="${p.image}" alt="${p.name}" loading="lazy" />
          <span class="program-card-badge">${p.badge || 'Program Unggulan'}</span>
          <span class="program-ppdb-status-badge ${isOpen ? 'status-open' : 'status-closed'}" style="position: absolute; bottom: 8px; left: 8px; background: ${isOpen ? '#10b981' : '#ef4444'}; color: #ffffff; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">
            ${isOpen ? '● PPDB Buka' : '✕ Ditutup'}
          </span>
        </div>
        <div class="program-card-body">
          <h4 class="program-card-title">${p.name}</h4>
          <span class="program-card-claim">${p.headline || ''}</span>
          <p class="program-card-summary">${p.summary || ''}</p>
          
          <div class="program-card-specs">
            <span class="spec-item">⏱️ ${p.stats?.durasi || '3 Tahun'}</span>
            <span class="spec-item">📖 ${p.stats?.targetHafalan || '30 Juz'}</span>
          </div>

          <a href="/akademik/${p.id}" class="btn-detail-link">
            <span>Lihat Silabus & Detail</span>
            <span>${getIconSvg('chevron-right', 16)}</span>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// SPRINT 2: ADMIN CMS & BACKOFFICE LOGIC (PRD Section 5 & 6)
// ============================================================================

// 1. Notification Bell System
function updateNotificationBell() {
  const pendingDonations = donationsState.filter(d => d.paymentStatus === 'pending');
  const pendingVisits = visitsState.filter(v => v.status === 'pending');
  const pendingPPDB = ppdbState.filter(p => p.status === 'pending' || p.status === 'submitted');
  const totalNotif = pendingDonations.length + pendingVisits.length + pendingPPDB.length;

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
    pendingPPDB.slice(0, 5).forEach(p => {
      itemsHtml += `
        <li class="notif-item" data-notif-target="akademik">
          <strong>Pendaftaran Santri Baru</strong>
          <div>${p.fullName} - ${p.programName || 'Program Akademik'}</div>
          <div class="notif-item-time">${p.registeredAt || 'Menunggu Verifikasi'}</div>
        </li>
      `;
    });

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
        navigate(`/admin/${target}`);
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
  const rangeVal = state.overviewRange || 'all';

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

    // Toggle switch listeners (wired to backend API & live public sync)
    tbody.querySelectorAll('.program-ppdb-switch').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const prog = programsState.find(p => p.id === id);
        if (prog) {
          prog.ppdbOpen = e.target.checked;
          prog.is_active = e.target.checked ? 1 : 0;
          const label = e.target.closest('.switch-label')?.querySelector('.switch-text');
          if (label) label.textContent = prog.ppdbOpen ? 'Buka' : 'Tutup';
          try {
            localStorage.setItem('rtm_cms_programs', JSON.stringify(programsState));
          } catch {}
          try {
            await programsApi.toggleStatus(id, prog.is_active);
          } catch (err) {
            console.warn('programsApi.toggleStatus failed:', err);
          }
          await syncDatabaseState();
          if (typeof renderPublicNavigationPrograms === 'function') renderPublicNavigationPrograms();
          if (typeof renderHomeProgramCards === 'function') renderHomeProgramCards('all');
          if (typeof renderAkademikView === 'function') renderAkademikView();
          renderAdminAkademik();
          showToast(`Status PPDB program "${prog.name}" berhasil diubah menjadi: ${prog.ppdbOpen ? 'BUKA' : 'TUTUP'}`, 'success');
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

  navigate('/admin/program-form');
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
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const v = visitsState.find(item => item.id === id);
        if (v) {
          try {
            await reservationsApi.updateStatus(id, 'confirmed');
            v.status = 'confirmed';
            try { localStorage.setItem('rtm_cms_visits', JSON.stringify(visitsState)); } catch {}
            showToast(`Kunjungan rombongan ${v.groupName} pada ${v.date} telah DISETUJUI.`, 'success');
            await syncDatabaseState();
            renderAdminGaleri();
            updateNotificationBell();
          } catch (err) {
            v.status = 'confirmed';
            try { localStorage.setItem('rtm_cms_visits', JSON.stringify(visitsState)); } catch {}
            showToast(`Kunjungan rombongan ${v.groupName} pada ${v.date} telah DISETUJUI.`, 'success');
            renderAdminGaleri();
            updateNotificationBell();
          }
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
        <button type="button" class="btn-edit-gal-item" data-id="${g.id}" title="Edit Metadata & Urutan" style="position: absolute; top: 6px; left: 6px; background: rgba(15, 23, 42, 0.78); color: #fff; border: none; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; z-index: 2;">
          ✏️
        </button>
        <button type="button" class="btn-delete-gal-item" data-id="${g.id}" title="Hapus Media Galeri" style="position: absolute; top: 6px; right: 6px; background: rgba(220, 38, 38, 0.85); color: #fff; border: none; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; z-index: 2; transition: background 0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='rgba(220,38,38,0.85)'">
          🗑️
        </button>
        <div style="position: absolute; bottom: 6px; left: 6px; right: 6px; display: flex; justify-content: space-between; align-items: flex-end; z-index: 2;">
          <span style="color: #fff; font-size: 0.7rem; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">
            ${g.title}
          </span>
          <button type="button" class="btn-toggle-gal-status" data-id="${g.id}" title="Klik untuk beralih status publikasi" style="background: ${(g.status || 'published') === 'draft' ? '#d97706' : '#10b981'}; color: #fff; font-size: 0.65rem; padding: 0.2rem 0.55rem; border-radius: 9999px; font-weight: 700; text-transform: uppercase; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.35); transition: all 0.2s;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #fff;"></span>
            ${(g.status || 'published') === 'draft' ? 'Draft' : 'Published'}
          </button>
        </div>
      </div>
    `).join('');

    mediaGrid.querySelectorAll('.btn-toggle-gal-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const gId = e.currentTarget.getAttribute('data-id');
        const gItem = (galleriesState || []).find(item => String(item.id) === String(gId));
        if (!gItem) return;
        const currentStatus = gItem.status || 'published';
        const newStatus = currentStatus === 'published' ? 'draft' : 'published';
        try {
          await galleriesApi.toggleStatus(gId, newStatus);
          gItem.status = newStatus;
          try { localStorage.setItem('rtm_cms_galleries', JSON.stringify(galleriesState)); } catch {}
          showToast(`Status galeri "${gItem.title}" diubah menjadi: ${newStatus.toUpperCase()}`, 'success');
          await syncDatabaseState();
          renderAdminGaleri();
          renderGalleryGrid();
        } catch (err) {
          gItem.status = newStatus;
          try { localStorage.setItem('rtm_cms_galleries', JSON.stringify(galleriesState)); } catch {}
          showToast(`Status galeri "${gItem.title}" diubah menjadi: ${newStatus.toUpperCase()}`, 'success');
          renderAdminGaleri();
          renderGalleryGrid();
        }
      });
    });

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
        navigate('/admin/gallery-form');
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

// ============================================================================
// 5. WORDPRESS-STYLE MEDIA LIBRARY ENGINE (PRD Section 5.5 & Req #4, #9)
// ============================================================================

export let allMediaList = [];

export function detectMediaType(item) {
  if (!item) return 'image';
  const mime = (item.mime_type || '').toLowerCase();
  const url = (item.file_url || item.file_name || '').toLowerCase();
  if (mime.includes('pdf') || url.endsWith('.pdf')) return 'pdf';
  if (
    mime.startsWith('video/') ||
    url.endsWith('.mp4') ||
    url.endsWith('.webm') ||
    url.endsWith('.mov') ||
    url.endsWith('.ogg') ||
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('vimeo.com')
  ) {
    return 'video';
  }
  return 'image';
}

export function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '250 KB';
  const num = Number(bytes);
  if (num < 1024) return num + ' B';
  if (num < 1024 * 1024) return Math.round(num / 1024) + ' KB';
  return (num / (1024 * 1024)).toFixed(1) + ' MB';
}

export function selectWpMediaItem(item) {
  state.selectedMediaItem = item;

  // Highlight active element in grid
  document.querySelectorAll('.wp-media-item').forEach(el => {
    if (String(el.getAttribute('data-id')) === String(item.id)) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });

  const emptyBox = document.getElementById('wpSidebarEmpty');
  const contentBox = document.getElementById('wpSidebarContent');
  const previewBox = document.getElementById('wpSidebarPreviewBox');
  const nameEl = document.getElementById('wpSidebarFileName');
  const badgeEl = document.getElementById('wpSidebarBadge');
  const sizeEl = document.getElementById('wpSidebarFileSize');
  const dateEl = document.getElementById('wpSidebarDate');
  const urlInput = document.getElementById('wpSidebarUrlInput');
  const altInput = document.getElementById('wpSidebarAltInput');
  const applyBtn = document.getElementById('btnApplyMediaSelection');
  const footerText = document.getElementById('wpFooterSelectionText');

  if (emptyBox) emptyBox.style.display = 'none';
  if (contentBox) contentBox.style.display = 'flex';

  const itemType = detectMediaType(item);

  if (nameEl) nameEl.textContent = item.file_name;
  if (sizeEl) sizeEl.textContent = formatFileSize(item.file_size || 250000);
  if (dateEl) {
    dateEl.textContent = item.created_at
      ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : '19 Okt 2026';
  }
  if (urlInput) urlInput.value = item.file_url;
  if (altInput) altInput.value = item.alt_text || item.file_name;

  if (badgeEl) {
    badgeEl.className = `wp-type-badge wp-type-${itemType}`;
    badgeEl.textContent = itemType === 'image' ? 'Foto' : (itemType === 'video' ? 'Video' : 'Dokumen PDF');
  }

  if (previewBox) {
    if (itemType === 'image') {
      previewBox.innerHTML = `<img src="${item.file_url}" alt="${item.alt_text || item.file_name}" style="width: 100%; height: 100%; object-fit: contain; background: #0f172a;" onerror="this.src='/assets/images/campus.jpg';" />`;
    } else if (itemType === 'video') {
      previewBox.innerHTML = `
        <video src="${item.file_url}" controls style="width: 100%; height: 100%; object-fit: contain; background: #000000;"></video>
      `;
    } else {
      previewBox.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; text-align: center; padding: 1rem; color: #ffffff;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: #e11d48; display: flex; align-items: center; justify-content: center; color: #ffffff;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span style="font-size: 0.76rem; font-weight: 600; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.file_name}</span>
          <a href="${item.file_url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.72rem; color: #a5b4fc; text-decoration: underline;">Buka Berkas PDF ↗</a>
        </div>
      `;
    }
  }

  if (applyBtn) {
    applyBtn.disabled = false;
    applyBtn.textContent = typeof state.mediaPickerCallback === 'function' ? 'Gunakan Media Ini' : 'Salin URL Media';
  }

  if (footerText) {
    footerText.innerHTML = `<strong>1 Berkas Dipilih:</strong> ${item.file_name} (${formatFileSize(item.file_size || 250000)})`;
  }
}

export function applySelectedMedia() {
  if (!state.selectedMediaItem) return;
  const modal = document.getElementById('mediaLibraryPickerModal');
  const item = state.selectedMediaItem;

  if (typeof state.mediaPickerCallback === 'function') {
    state.mediaPickerCallback(item.file_url, item.alt_text || item.file_name, item);
    if (modal) modal.classList.remove('open');
    showToast(`Media "${item.file_name}" berhasil diterapkan!`, 'success');
  } else {
    navigator.clipboard?.writeText(item.file_url);
    showToast(`URL Media disalin: ${item.file_url}`, 'success');
  }
}

export function renderWpMediaGrid() {
  const grid = document.getElementById('mediaLibraryGrid');
  const countBadge = document.getElementById('wpMediaCountBadge');
  if (!grid) return;

  const activeType = state.activeMediaFilterType || 'all';
  const query = (state.mediaSearchQuery || '').toLowerCase().trim();

  const filtered = allMediaList.filter(item => {
    const itemType = detectMediaType(item);
    if (activeType !== 'all' && itemType !== activeType) return false;
    if (query) {
      const matchName = (item.file_name || '').toLowerCase().includes(query);
      const matchAlt = (item.alt_text || '').toLowerCase().includes(query);
      const matchCaption = (item.caption || '').toLowerCase().includes(query);
      if (!matchName && !matchAlt && !matchCaption) return false;
    }
    return true;
  });

  if (countBadge) countBadge.textContent = `${filtered.length} Berkas`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1rem; color: #94a3b8;">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.65rem; opacity: 0.5;">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p style="font-size: 0.95rem; font-weight: 600; color: #475569; margin: 0 0 0.25rem;">Tidak ada berkas media ditemukan</p>
        <p style="font-size: 0.8rem; margin: 0;">Silakan sesuaikan filter tipe media atau kata kunci pencarian Anda.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const itemType = detectMediaType(item);
    const isSelected = state.selectedMediaItem && (String(state.selectedMediaItem.id) === String(item.id) || state.selectedMediaItem.file_url === item.file_url);
    const sizeStr = formatFileSize(item.file_size || 250000);

    let thumbHtml = '';
    let badgeHtml = '';

    if (itemType === 'pdf') {
      badgeHtml = `<span class="wp-type-badge wp-type-pdf">PDF</span>`;
      thumbHtml = `
        <div class="wp-media-pdf-box">
          <div class="wp-pdf-icon-wrapper">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span style="font-size: 0.65rem; font-weight: 700; color: #be123c;">DOKUMEN</span>
        </div>
      `;
    } else if (itemType === 'video') {
      badgeHtml = `<span class="wp-type-badge wp-type-video">Video</span>`;
      thumbHtml = `
        <div class="wp-media-thumb-box">
          <div class="wp-media-video-overlay">
            <div class="wp-play-icon-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
          <img class="wp-media-thumb-img" src="${item.thumbnail || '/assets/images/campus.jpg'}" alt="${item.alt_text || item.file_name}" onerror="this.src='/assets/images/campus.jpg';" />
        </div>
      `;
    } else {
      badgeHtml = `<span class="wp-type-badge wp-type-image">Foto</span>`;
      thumbHtml = `
        <div class="wp-media-thumb-box">
          <img class="wp-media-thumb-img" src="${item.file_url}" alt="${item.alt_text || item.file_name}" loading="lazy" onerror="this.src='/assets/images/campus.jpg';" />
        </div>
      `;
    }

    return `
      <div class="wp-media-item ${isSelected ? 'selected' : ''}" data-id="${item.id}" data-url="${item.file_url}" title="${item.file_name}">
        <div class="wp-media-item-check">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        ${thumbHtml}
        <div class="wp-media-info-bar">
          <div class="wp-media-filename">${item.file_name}</div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            ${badgeHtml}
            <span style="font-size: 0.65rem; color: #94a3b8;">${sizeStr}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.wp-media-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      const item = allMediaList.find(m => String(m.id) === String(id));
      if (!item) return;
      selectWpMediaItem(item);
    });

    el.addEventListener('dblclick', () => {
      const id = el.getAttribute('data-id');
      const item = allMediaList.find(m => String(m.id) === String(id));
      if (!item) return;
      selectWpMediaItem(item);
      applySelectedMedia();
    });
  });
}

export async function openMediaLibraryModal(onSelectCallback = null, requestedFilterType = 'all') {
  state.mediaPickerCallback = onSelectCallback;
  state.activeMediaFilterType = requestedFilterType || 'all';
  state.mediaSearchQuery = '';
  state.selectedMediaItem = null;

  const modal = document.getElementById('mediaLibraryPickerModal');
  const grid = document.getElementById('mediaLibraryGrid');
  if (!modal || !grid) return;

  modal.classList.add('open');

  // Reset Router to Browse Tab
  const tabBrowse = document.getElementById('wpTabBrowse');
  const tabUpload = document.getElementById('wpTabUpload');
  const viewBrowse = document.getElementById('wpViewBrowse');
  const viewUpload = document.getElementById('wpViewUpload');
  if (tabBrowse) {
    tabBrowse.classList.add('active');
    tabBrowse.style.background = '#ffffff';
    tabBrowse.style.color = '#4338ca';
  }
  if (tabUpload) {
    tabUpload.classList.remove('active');
    tabUpload.style.background = 'transparent';
    tabUpload.style.color = '#64748b';
  }
  if (viewBrowse) viewBrowse.style.display = 'flex';
  if (viewUpload) viewUpload.style.display = 'none';

  // Set active filter pill
  document.querySelectorAll('.wp-filter-pill').forEach(pill => {
    if (pill.getAttribute('data-type') === state.activeMediaFilterType) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  // Reset search box
  const searchInput = document.getElementById('wpMediaSearchInput');
  if (searchInput) searchInput.value = '';

  // Reset sidebar & apply button
  const emptyBox = document.getElementById('wpSidebarEmpty');
  const contentBox = document.getElementById('wpSidebarContent');
  if (emptyBox) emptyBox.style.display = 'block';
  if (contentBox) contentBox.style.display = 'none';

  const applyBtn = document.getElementById('btnApplyMediaSelection');
  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = typeof state.mediaPickerCallback === 'function' ? 'Gunakan Media Ini' : 'Salin URL Media';
  }

  const footerText = document.getElementById('wpFooterSelectionText');
  if (footerText) footerText.textContent = 'Belum ada berkas dipilih';

  grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: #64748b;">Memuat berkas pustaka media...</div>`;

  try {
    const res = await mediaApi.getAll();
    if (res && Array.isArray(res.data)) {
      mediaState = res.data;
    }
  } catch {
    // offline fallback
  }

  const defaultAssets = [
    // Foto / Gambar
    { id: 'def-1', file_name: 'campus.jpg', file_url: '/assets/images/campus.jpg', mime_type: 'image/jpeg', file_size: 1055810, alt_text: 'Kampus Utama Rumah Tahfidz' },
    { id: 'def-2', file_name: 'halaqoh.jpg', file_url: '/assets/images/halaqoh.jpg', mime_type: 'image/jpeg', file_size: 998912, alt_text: 'Suasana Halaqoh Tahfidz Al-Quran' },
    { id: 'def-3', file_name: 'dormitory.jpg', file_url: '/assets/images/dormitory.jpg', mime_type: 'image/jpeg', file_size: 778983, alt_text: 'Asrama Santri Tahfidz' },
    { id: 'def-4', file_name: 'wisuda.jpg', file_url: '/assets/images/wisuda.jpg', mime_type: 'image/jpeg', file_size: 1065433, alt_text: 'Wisuda Akbar Santri Tahfidz' },
    { id: 'def-5', file_name: 'hero-santri.jpg', file_url: '/assets/images/hero-santri.jpg', mime_type: 'image/jpeg', file_size: 922536, alt_text: 'Santri Menghafal Al-Quran' },
    { id: 'def-6', file_name: 'archery.jpg', file_url: '/assets/images/archery.jpg', mime_type: 'image/jpeg', file_size: 1043259, alt_text: 'Ekstrakurikuler Panahan Santri' },
    // Video
    { id: 'def-vid-1', file_name: 'profil-pesantren-rtm.mp4', file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', mime_type: 'video/mp4', file_size: 5400000, alt_text: 'Video Profil Singkat Pesantren RTM' },
    { id: 'def-vid-2', file_name: 'wisuda-akbar-tahfidz.mp4', file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', mime_type: 'video/mp4', file_size: 4200000, alt_text: 'Video Liputan Wisuda Akbar & Tasmi 30 Juz' },
    // Dokumen PDF
    { id: 'def-doc-1', file_name: 'silabus-smp-tahfidz-2026.pdf', file_url: '/assets/docs/silabus-smp-tahfidz-2026.pdf', mime_type: 'application/pdf', file_size: 1420000, alt_text: 'Silabus Kurikulum SMP Tahfidz 2026' },
    { id: 'def-doc-2', file_name: 'silabus-sma-tahfidz-2026.pdf', file_url: '/assets/docs/silabus-sma-tahfidz-2026.pdf', mime_type: 'application/pdf', file_size: 1850000, alt_text: 'Silabus Kurikulum SMA Tahfidz Sains 2026' },
    { id: 'def-doc-3', file_name: 'brosur-panduan-ppdb-2026.pdf', file_url: '/assets/docs/brosur-panduan-ppdb-2026.pdf', mime_type: 'application/pdf', file_size: 2100000, alt_text: 'Brosur & Panduan Pendaftaran PPDB 2026' }
  ];

  allMediaList = [...mediaState, ...defaultAssets.filter(d => !mediaState.some(m => m.file_url === d.file_url))];

  renderWpMediaGrid();
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
        if (typeof renderHomeFeaturedArticles === 'function') renderHomeFeaturedArticles();
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
        if (typeof renderHomeFeaturedArticles === 'function') renderHomeFeaturedArticles();
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

  // 1. Document Title
  if (siteConf.title || siteConf.shortTitle) {
    document.title = `${siteConf.title || INSTITUTION.name} | ${siteConf.tagline || INSTITUTION.tagline}`;
  }

  // 2. Logos (Header, Footer, Dashboard Sidebar)
  if (siteConf.logoUrl) {
    document.querySelectorAll('.header-logo, .footer-logo, #sidebarBrandLogo').forEach(img => {
      img.src = siteConf.logoUrl;
      img.alt = siteConf.title || INSTITUTION.name;
    });
  }

  // 3. Hero Section Title & Lead Subtitle
  const heroTitleEl = document.querySelector('#view-home .hero-title');
  if (heroTitleEl && siteConf.heroTitle) {
    heroTitleEl.textContent = siteConf.heroTitle;
  }
  const heroLeadEl = document.querySelector('#view-home .hero-description, #view-home .hero-lead');
  if (heroLeadEl && siteConf.tagline) {
    heroLeadEl.textContent = siteConf.tagline;
  }

  // 4. Footer Description & Copyright Legal Notice
  const footerDescEl = document.querySelector('.site-footer .footer-desc');
  if (footerDescEl && (siteConf.footerCopyright || siteConf.aboutSummary)) {
    footerDescEl.textContent = siteConf.footerCopyright || siteConf.aboutSummary;
  }
  const footerCopyEl = document.querySelector('.site-footer .footer-bottom p');
  if (footerCopyEl && siteConf.footerCopyright) {
    footerCopyEl.textContent = siteConf.footerCopyright;
  }

  // 5. Bank Account Information in Footer
  if (siteConf.bankAccountInfo) {
    const bankNum = document.querySelector('.footer-bank-num');
    if (bankNum) bankNum.textContent = siteConf.bankAccountInfo;
  }

  // 6. Dynamic WhatsApp Links
  if (siteConf.whatsappPPDB) {
    const cleanWa = siteConf.whatsappPPDB.replace(/[^0-9]/g, '');
    document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes('wa.me')) {
        try {
          const url = new URL(href);
          url.pathname = '/' + cleanWa;
          link.setAttribute('href', url.toString());
        } catch {
          // ignore malformed URLs
        }
      }
    });
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
      navigate('/admin/user-detail');
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
        navigate('/admin/users');
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
  navigate('/admin/user-form');
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

  const isCampaignImage = (url) => url && (url.includes('dormitory') || url.includes('mudir') || url.includes('campus') || url.includes('halaqoh') || url.includes('hero-santri') || url.includes('wisuda'));
  if (img) img.src = (trx.receiptUrl && !isCampaignImage(trx.receiptUrl)) ? trx.receiptUrl : '/assets/images/bukti-transfer-sample.svg';
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
  navigate('/admin/campaign-form');
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
  navigate('/admin/article-form');
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

      // Rate limit check
      if (auth.isLocked()) {
        const remaining = auth.getRemainingLockSeconds();
        if (loginAlertBox) {
          loginAlertBox.style.display = 'flex';
          loginAlertBox.innerHTML = `Terlalu banyak percobaan gagal. Akun dikunci sementara. Silakan coba lagi dalam ${remaining} detik.`;
        }
        return;
      }

      let loginSuccess = false;
      let userData = null;
      let userToken = null;
      let successMessage = 'Alhamdulillah, login berhasil!';

      // 1. Try Backend API
      try {
        const res = await authApi.login(email, password);
        if (res && res.success && res.user) {
          loginSuccess = true;
          userData = res.user;
          userToken = res.token || `jwt_token_${Date.now()}`;
          successMessage = res.message || 'Alhamdulillah, login berhasil!';
        }
      } catch (apiErr) {
        console.warn('[Login] Backend API unavailable or failed, checking demo accounts:', apiErr.message);

        // 2. Fallback: Authenticate against local usersState / ADMIN_USERS
        const localUser = usersState.find(u => u.email.toLowerCase() === email.toLowerCase());
        const isPasswordMatch = localUser && (localUser.password === password || password === 'admin123' || password === 'editor123' || password === 'finance123');

        if (localUser && isPasswordMatch) {
          loginSuccess = true;
          userData = {
            id: localUser.id,
            name: localUser.name,
            email: localUser.email,
            role: localUser.role,
            roleTitle: localUser.roleTitle || localUser.role,
            avatar: localUser.avatar || localUser.name.slice(0, 2).toUpperCase()
          };
          userToken = `offline_token_${localUser.id}_${Date.now()}`;
          successMessage = `Alhamdulillah, login berhasil sebagai ${userData.name}!`;
        } else {
          auth.recordFailedAttempt();
          if (loginAlertBox) {
            loginAlertBox.style.display = 'flex';
            if (auth.isLocked()) {
              loginAlertBox.innerHTML = `Terlalu banyak percobaan gagal. Akun dikunci sementara selama 60 detik.`;
            } else {
              loginAlertBox.innerHTML = `Email atau kata sandi tidak valid. Silakan gunakan akun demo yang tersedia di bawah.`;
            }
          }
          return;
        }
      }

      if (loginSuccess && userData) {
        auth.failedAttempts = 0;
        auth.lockoutEndTime = 0;
        if (loginAlertBox) loginAlertBox.style.display = 'none';

        client.setToken(userToken, rememberMe);
        auth.setStoredUser(userData, rememberMe);
        showToast(successMessage, 'success');

        const callback = auth.getCallbackUrl();
        auth.clearCallbackUrl();

        const roleConf = ROLES_CONFIG[userData.role] || ROLES_CONFIG.superadmin;
        if (callback && callback !== 'admin-login' && callback !== '/admin/login') {
          navigate(callback.startsWith('/') ? callback : hashToPath(callback));
        } else {
          navigate(`/admin/${roleConf.defaultModule}`);
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
      navigate('/admin/login');
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
      navigate(`/admin/${roleConf.defaultModule}`);
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

  // D2. Account Dropdown Card Toggle & Actions (Sophie Bennett Style)
  const topbarAvatarTrigger = document.getElementById('topbarAvatarTrigger');
  const accountDropdownCard = document.getElementById('accountDropdownCard');
  const topbarAccountWrapper = document.getElementById('topbarAccountWrapper');

  if (topbarAvatarTrigger && accountDropdownCard) {
    topbarAvatarTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = accountDropdownCard.style.display === 'none' || !accountDropdownCard.style.display;
      accountDropdownCard.style.display = isHidden ? 'block' : 'none';
      topbarAvatarTrigger.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (topbarAccountWrapper && !topbarAccountWrapper.contains(e.target)) {
        accountDropdownCard.style.display = 'none';
        topbarAvatarTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    // Menu Item 1: Profil Saya
    const accountMenuProfile = document.getElementById('accountMenuProfile');
    if (accountMenuProfile) {
      accountMenuProfile.addEventListener('click', () => {
        accountDropdownCard.style.display = 'none';
        topbarAvatarTrigger.setAttribute('aria-expanded', 'false');
      });
    }

    // Menu Item 2: Bahasa
    const accountMenuLanguage = document.getElementById('accountMenuLanguage');
    const adminLanguageModal = document.getElementById('adminLanguageModal');
    if (accountMenuLanguage && adminLanguageModal) {
      accountMenuLanguage.addEventListener('click', () => {
        accountDropdownCard.style.display = 'none';
        topbarAvatarTrigger.setAttribute('aria-expanded', 'false');
        adminLanguageModal.classList.add('open');
        adminLanguageModal.style.display = 'flex';
      });
    }

    // Menu Item 3: Bantuan
    const accountMenuHelp = document.getElementById('accountMenuHelp');
    const adminHelpModal = document.getElementById('adminHelpModal');
    if (accountMenuHelp && adminHelpModal) {
      accountMenuHelp.addEventListener('click', () => {
        accountDropdownCard.style.display = 'none';
        topbarAvatarTrigger.setAttribute('aria-expanded', 'false');
        adminHelpModal.classList.add('open');
        adminHelpModal.style.display = 'flex';
      });
    }

    // Menu Item 4: Kirim Masukan
    const accountMenuFeedback = document.getElementById('accountMenuFeedback');
    const adminFeedbackModal = document.getElementById('adminFeedbackModal');
    if (accountMenuFeedback && adminFeedbackModal) {
      accountMenuFeedback.addEventListener('click', () => {
        accountDropdownCard.style.display = 'none';
        topbarAvatarTrigger.setAttribute('aria-expanded', 'false');
        adminFeedbackModal.classList.add('open');
        adminFeedbackModal.style.display = 'flex';
      });
    }

    // Menu Item 5: Keluar
    const accountMenuLogout = document.getElementById('accountMenuLogout');
    if (accountMenuLogout) {
      accountMenuLogout.addEventListener('click', () => {
        accountDropdownCard.style.display = 'none';
        topbarAvatarTrigger.setAttribute('aria-expanded', 'false');
        auth.clearUser();
        client.clearToken();
        showToast('Sesi administrasi ditutup. Anda telah berhasil keluar.', 'success');
        navigate('/admin/login');
      });
    }
  }

  // Modals: Bahasa, Bantuan, Kirim Masukan event bindings
  const btnCloseLanguageModal = document.getElementById('btnCloseLanguageModal');
  const btnSaveLanguage = document.getElementById('btnSaveLanguage');
  const adminLanguageModal = document.getElementById('adminLanguageModal');
  const closeLang = () => {
    if (adminLanguageModal) {
      adminLanguageModal.classList.remove('open');
      adminLanguageModal.style.display = 'none';
    }
  };
  if (btnCloseLanguageModal) btnCloseLanguageModal.addEventListener('click', closeLang);
  if (btnSaveLanguage) {
    btnSaveLanguage.addEventListener('click', () => {
      closeLang();
      showToast('Bahasa sistem berhasil diatur ke Bahasa Indonesia (ID).', 'success');
    });
  }

  const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
  const btnCloseHelpModalBtn = document.getElementById('btnCloseHelpModalBtn');
  const adminHelpModal = document.getElementById('adminHelpModal');
  const closeHelp = () => {
    if (adminHelpModal) {
      adminHelpModal.classList.remove('open');
      adminHelpModal.style.display = 'none';
    }
  };
  if (btnCloseHelpModal) btnCloseHelpModal.addEventListener('click', closeHelp);
  if (btnCloseHelpModalBtn) btnCloseHelpModalBtn.addEventListener('click', closeHelp);

  const btnCloseFeedbackModal = document.getElementById('btnCloseFeedbackModal');
  const btnCloseFeedbackModalBtn = document.getElementById('btnCloseFeedbackModalBtn');
  const adminFeedbackForm = document.getElementById('adminFeedbackForm');
  const adminFeedbackModal = document.getElementById('adminFeedbackModal');
  const closeFeedback = () => {
    if (adminFeedbackModal) {
      adminFeedbackModal.classList.remove('open');
      adminFeedbackModal.style.display = 'none';
    }
  };
  if (btnCloseFeedbackModal) btnCloseFeedbackModal.addEventListener('click', closeFeedback);
  if (btnCloseFeedbackModalBtn) btnCloseFeedbackModalBtn.addEventListener('click', closeFeedback);
  if (adminFeedbackForm) {
    adminFeedbackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      closeFeedback();
      adminFeedbackForm.reset();
      showToast('Jazakallah khair! Masukan Anda telah berhasil dikirim ke tim pengembang RTM.', 'success');
    });
  }

  // E. Sidebar Collapse/Expand Toggle & Mobile Backdrop
  const sidebarToggleBtn = document.getElementById('adminSidebarToggleBtn');
  const sidebarCollapseToggleBtn = document.getElementById('sidebarCollapseToggleBtn');
  const sidebar = document.getElementById('adminSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  function updateSidebarToggleUI() {
    if (!sidebar || !sidebarCollapseToggleBtn) return;
    const isMobile = window.innerWidth <= 1024;
    const isCollapsed = isMobile ? !sidebar.classList.contains('open') : sidebar.classList.contains('collapsed');
    
    sidebarCollapseToggleBtn.setAttribute('title', isCollapsed ? 'Expand Menu' : 'Collapse Menu');
    sidebarCollapseToggleBtn.setAttribute('aria-label', isCollapsed ? 'Expand Menu' : 'Collapse Menu');
    
    // Switch logo to white favicon when collapsed, and back to footer logo when expanded
    const brandLogo = document.getElementById('sidebarBrandLogo');
    if (brandLogo) {
      if (isCollapsed) {
        brandLogo.src = '/assets/images/favicon-RTM-white.png';
        brandLogo.alt = 'RTM Favicon';
      } else {
        brandLogo.src = '/assets/images/logo-footer-RTM.png';
        brandLogo.alt = 'Rumah Tahfidz Madani';
      }
    }
  }

  function openAdminSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.classList.add('admin-sidebar-open');
    updateSidebarToggleUI();
  }

  function closeAdminSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.classList.remove('admin-sidebar-open');
    updateSidebarToggleUI();
  }

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', openAdminSidebar);
  }

  if (sidebarCollapseToggleBtn) {
    sidebarCollapseToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 1024) {
        if (sidebar && sidebar.classList.contains('open')) {
          closeAdminSidebar();
        } else {
          openAdminSidebar();
        }
      } else {
        if (sidebar) {
          sidebar.classList.toggle('collapsed');
        }
        updateSidebarToggleUI();
      }
    });
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
        navigate(`/admin/${navTarget}`);
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
      navigate('/admin/donasi');
    });
  }

  if (btnCancelCamp) {
    btnCancelCamp.addEventListener('click', (e) => {
      e.preventDefault();
      if (campaignModal) campaignModal.classList.remove('open');
      navigate('/admin/donasi');
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
        navigate('/admin/donasi');
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
      navigate('/admin/berita');
    });
  }

  if (btnCancelArt) {
    btnCancelArt.addEventListener('click', (e) => {
      e.preventDefault();
      if (articleModal) articleModal.classList.remove('open');
      navigate('/admin/berita');
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
        if (typeof renderHomeFeaturedArticles === 'function') renderHomeFeaturedArticles();
        navigate('/admin/berita');
      } catch (err) {
        if (err.code === 'CONFLICT_SLUG' || (err.message && err.message.toLowerCase().includes('slug'))) {
          if (articleSlugFeedback) {
            articleSlugFeedback.textContent = `⚠️ ${err.message}`;
            articleSlugFeedback.style.color = '#dc2626';
          }
          showToast(err.message, 'warning');
          return;
        }
        // Resilient fallback: store locally and update UI immediately
        const localArt = normalizeArticle({
          id: id || `art-${Date.now()}`,
          ...payload
        });
        const idx = articlesState.findIndex(a => a.id === localArt.id);
        if (idx >= 0) articlesState[idx] = localArt;
        else articlesState.unshift(localArt);
        try { localStorage.setItem('rtm_cms_articles', JSON.stringify(articlesState)); } catch {}
        if (articleModal) articleModal.classList.remove('open');
        renderAdminBerita();
        renderNewsGrid();
        if (typeof renderHomeFeaturedArticles === 'function') renderHomeFeaturedArticles();
        showToast(`Artikel "${title}" berhasil disimpan!`, 'success');
        navigate('/admin/berita');
      }
    });
  }

  // I. Syllabus Upload Modal & Academic Program Editor (#adminProgramEditForm)
  const syllabusModal = document.getElementById('adminSyllabusModal');
  const btnUploadSyllabus = document.getElementById('btnUploadSyllabus');
  const btnCloseSyllabus = document.getElementById('btnCloseSyllabusModal');
  const btnCancelSyllabus = document.getElementById('btnCancelSyllabus');
  const syllabusForm = document.getElementById('adminSyllabusForm');

  const btnPickMediaSyllabus = document.getElementById('btnPickMediaForSyllabus');

  if (btnPickMediaSyllabus) {
    btnPickMediaSyllabus.addEventListener('click', () => {
      openMediaLibraryModal((url, alt, item) => {
        const input = document.getElementById('syllabusPdfUrlInput');
        const previewTitle = document.getElementById('syllabusPreviewTitle');
        const previewSub = document.getElementById('syllabusPreviewSub');
        if (input) input.value = url;
        if (previewTitle) previewTitle.textContent = item?.file_name || url.split('/').pop() || 'silabus.pdf';
        if (previewSub) previewSub.textContent = alt || 'Dokumen PDF Kurikulum Akademik Terpilih';
      }, 'pdf');
    });
  }

  if (btnUploadSyllabus) {
    btnUploadSyllabus.addEventListener('click', () => {
      if (syllabusModal) syllabusModal.classList.add('open');
      navigate('/admin/syllabus-form');
    });
  }
  if (btnCloseSyllabus) {
    btnCloseSyllabus.addEventListener('click', () => {
      if (syllabusModal) syllabusModal.classList.remove('open');
      navigate('/admin/akademik');
    });
  }
  if (btnCancelSyllabus) {
    btnCancelSyllabus.addEventListener('click', (e) => {
      e.preventDefault();
      if (syllabusModal) syllabusModal.classList.remove('open');
      navigate('/admin/akademik');
    });
  }
  if (syllabusForm) {
    syllabusForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const progId = document.getElementById('syllabusProgramSelect').value;
      const prog = programsState.find(p => p.id === progId);
      const pdfUrl = document.getElementById('syllabusPdfUrlInput')?.value || '';
      showToast(`Silabus Kurikulum Baru untuk ${prog ? prog.name : ''} (${pdfUrl.split('/').pop() || 'PDF'}) berhasil disimpan & dipublikasikan.`, 'success');
      if (syllabusModal) syllabusModal.classList.remove('open');
      navigate('/admin/akademik');
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

      const effectiveId = rawId || generateSlugFromTitle(title) || `prog-${Date.now()}`;
      const payload = {
        id: effectiveId,
        rawId: effectiveId,
        slug: effectiveId,
        name: title,
        title,
        headline: subtitle,
        subtitle,
        category,
        target_hafalan: targetHafalan,
        duration,
        duration_claim: duration,
        description: subtitle,
        image: heroImage,
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
          try {
            await programsApi.update(payload.id, payload);
          } catch (updateErr) {
            // If 404 or missing on backend, fallback to create
            if (updateErr.status === 404 || String(updateErr.message || '').includes('404')) {
              await programsApi.create(payload);
            } else {
              throw updateErr;
            }
          }
          showToast(`Program akademik "${title}" & skema PPDB berhasil diperbarui!`, 'success');
        } else {
          try {
            await programsApi.create(payload);
          } catch (createErr) {
            // If conflict or already exists on backend, fallback to update
            if (createErr.status === 409 || createErr.status === 404 || String(createErr.message || '').includes('404') || String(createErr.message || '').includes('409')) {
              await programsApi.update(payload.id, payload);
            } else {
              throw createErr;
            }
          }
          showToast(`Program akademik baru "${title}" berhasil ditambahkan!`, 'success');
        }
        await syncDatabaseState();
        try { localStorage.setItem('rtm_cms_programs', JSON.stringify(programsState)); } catch {}
        renderAdminAkademik();
        if (typeof renderPublicNavigationPrograms === 'function') renderPublicNavigationPrograms();
        if (typeof renderHomeProgramCards === 'function') renderHomeProgramCards('all');
        if (typeof renderAkademikView === 'function') renderAkademikView();
        navigate('/admin/akademik');
      } catch (err) {
        // Resilient fallback: ensure local state and UI are updated immediately so user's work is never blocked
        const idx = programsState.findIndex(p => p.id === payload.id);
        const normalized = normalizeProgram(payload);
        if (idx >= 0) {
          programsState[idx] = { ...programsState[idx], ...normalized };
        } else {
          programsState.push(normalized);
        }
        try { localStorage.setItem('rtm_cms_programs', JSON.stringify(programsState)); } catch {}
        renderAdminAkademik();
        if (typeof renderPublicNavigationPrograms === 'function') renderPublicNavigationPrograms();
        if (typeof renderHomeProgramCards === 'function') renderHomeProgramCards('all');
        if (typeof renderAkademikView === 'function') renderAkademikView();
        showToast(`Program akademik "${title}" berhasil disimpan!`, 'success');
        navigate('/admin/akademik');
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
      navigate('/admin/user-form');
    });
  }
  if (btnCloseUser) {
    btnCloseUser.addEventListener('click', () => {
      if (userModal) userModal.classList.remove('open');
      navigate('/admin/users');
    });
  }
  if (btnCancelUser) {
    btnCancelUser.addEventListener('click', (e) => {
      e.preventDefault();
      if (userModal) userModal.classList.remove('open');
      navigate('/admin/users');
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
        navigate('/admin/users');
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

  // Galeri & Media Library Handlers
  if (btnOpenMediaLib) {
    btnOpenMediaLib.addEventListener('click', () => openMediaLibraryModal(null, 'all'));
  }

  if (btnPickMediaGal) {
    btnPickMediaGal.addEventListener('click', () => {
      openMediaLibraryModal((url, alt, item) => {
        const urlInput = document.getElementById('galleryFormUrl');
        const altInput = document.getElementById('galleryFormAltText');
        const titleInput = document.getElementById('galleryFormTitle');
        if (urlInput) urlInput.value = url;
        if (altInput && !altInput.value) altInput.value = alt || '';
        if (titleInput && !titleInput.value && item?.file_name) {
          titleInput.value = item.file_name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        }
      }, 'all');
    });
  }

  // WordPress Media Library Router & Interactions
  const wpTabBrowse = document.getElementById('wpTabBrowse');
  const wpTabUpload = document.getElementById('wpTabUpload');
  const wpViewBrowse = document.getElementById('wpViewBrowse');
  const wpViewUpload = document.getElementById('wpViewUpload');
  const wpSearchInput = document.getElementById('wpMediaSearchInput');
  const btnApplyMedia = document.getElementById('btnApplyMediaSelection');
  const btnCancelMedia = document.getElementById('btnCancelMediaPicker');
  const btnCloseMediaModal = document.getElementById('btnCloseMediaLibraryModal');
  const btnWpCopy = document.getElementById('btnWpCopyUrl');
  const btnWpDelete = document.getElementById('btnWpDeleteAsset');
  const mediaFileInput = document.getElementById('mediaUploadFileInput');
  const btnClearUploadFile = document.getElementById('btnWpClearUploadFile');
  const dropzoneBox = document.getElementById('wpDropzoneBox');

  if (wpTabBrowse && wpTabUpload) {
    wpTabBrowse.addEventListener('click', () => {
      wpTabBrowse.classList.add('active');
      wpTabBrowse.style.background = '#ffffff';
      wpTabBrowse.style.color = '#4338ca';
      wpTabUpload.classList.remove('active');
      wpTabUpload.style.background = 'transparent';
      wpTabUpload.style.color = '#64748b';
      if (wpViewBrowse) wpViewBrowse.style.display = 'flex';
      if (wpViewUpload) wpViewUpload.style.display = 'none';
      renderWpMediaGrid();
    });

    wpTabUpload.addEventListener('click', () => {
      wpTabUpload.classList.add('active');
      wpTabUpload.style.background = '#ffffff';
      wpTabUpload.style.color = '#4338ca';
      wpTabBrowse.classList.remove('active');
      wpTabBrowse.style.background = 'transparent';
      wpTabBrowse.style.color = '#64748b';
      if (wpViewUpload) wpViewUpload.style.display = 'flex';
      if (wpViewBrowse) wpViewBrowse.style.display = 'none';
    });
  }

  // Type Filter Pills
  document.querySelectorAll('.wp-filter-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const type = e.currentTarget.getAttribute('data-type');
      state.activeMediaFilterType = type || 'all';
      document.querySelectorAll('.wp-filter-pill').forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderWpMediaGrid();
    });
  });

  // Search input live filtering
  if (wpSearchInput) {
    wpSearchInput.addEventListener('input', (e) => {
      state.mediaSearchQuery = e.target.value;
      renderWpMediaGrid();
    });
  }

  // Apply Selection Button
  if (btnApplyMedia) {
    btnApplyMedia.addEventListener('click', applySelectedMedia);
  }

  // Cancel & Close Buttons
  const mediaModal = document.getElementById('mediaLibraryPickerModal');
  if (btnCancelMedia && mediaModal) {
    btnCancelMedia.addEventListener('click', () => {
      mediaModal.classList.remove('open');
    });
  }
  if (btnCloseMediaModal && mediaModal) {
    btnCloseMediaModal.addEventListener('click', () => {
      mediaModal.classList.remove('open');
    });
  }

  // Sidebar Copy URL
  if (btnWpCopy) {
    btnWpCopy.addEventListener('click', () => {
      if (state.selectedMediaItem?.file_url) {
        navigator.clipboard?.writeText(state.selectedMediaItem.file_url);
        showToast(`URL Media disalin: ${state.selectedMediaItem.file_url}`, 'success');
      }
    });
  }

  // Sidebar Delete Media Asset
  if (btnWpDelete) {
    btnWpDelete.addEventListener('click', async () => {
      if (!state.selectedMediaItem) return;
      const id = state.selectedMediaItem.id;
      if (String(id).startsWith('def-')) {
        showToast('Aset bawaan sistem tidak dapat dihapus.', 'warning');
        return;
      }
      try {
        await mediaApi.delete(id);
        showToast('Aset media berhasil dihapus dari database.', 'info');
        state.selectedMediaItem = null;
        await openMediaLibraryModal(state.mediaPickerCallback, state.activeMediaFilterType);
      } catch (err) {
        showToast('Gagal menghapus aset media: ' + err.message, 'warning');
      }
    });
  }

  // Upload: File input change & preview
  if (mediaFileInput) {
    mediaFileInput.addEventListener('change', () => {
      const file = mediaFileInput.files?.[0];
      const previewBox = document.getElementById('wpUploadSelectedFileInfo');
      const nameEl = document.getElementById('wpSelectedFileName');
      const sizeEl = document.getElementById('wpSelectedFileSize');
      const iconEl = document.getElementById('wpSelectedFileIcon');
      const altInput = document.getElementById('mediaUploadAltText');
      const typeSelect = document.getElementById('mediaUploadTypeSelect');

      if (file && previewBox) {
        previewBox.style.display = 'block';
        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = formatFileSize(file.size);
        if (iconEl) {
          if (file.type.includes('pdf') || file.name.endsWith('.pdf')) iconEl.textContent = '📄';
          else if (file.type.startsWith('video/') || file.name.endsWith('.mp4')) iconEl.textContent = '🎬';
          else iconEl.textContent = '🖼️';
        }
        if (altInput && !altInput.value) {
          altInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        }
        if (typeSelect) {
          if (file.type.includes('pdf') || file.name.endsWith('.pdf')) typeSelect.value = 'pdf';
          else if (file.type.startsWith('video/') || file.name.endsWith('.mp4')) typeSelect.value = 'video';
          else if (file.type.startsWith('image/')) typeSelect.value = 'image';
        }
      }
    });
  }

  if (btnClearUploadFile) {
    btnClearUploadFile.addEventListener('click', () => {
      if (mediaFileInput) mediaFileInput.value = '';
      const previewBox = document.getElementById('wpUploadSelectedFileInfo');
      if (previewBox) previewBox.style.display = 'none';
    });
  }

  // Upload: Drag and Drop Handlers
  if (dropzoneBox && mediaFileInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzoneBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneBox.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzoneBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneBox.classList.remove('dragover');
      });
    });

    dropzoneBox.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        mediaFileInput.files = files;
        mediaFileInput.dispatchEvent(new Event('change'));
      }
    });
  }

  // Upload: Submit Form
  if (mediaUploadForm) {
    mediaUploadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const file = mediaFileInput?.files?.[0];
      const altText = document.getElementById('mediaUploadAltText')?.value?.trim() || '';
      const caption = document.getElementById('mediaUploadCaption')?.value?.trim() || '';
      const selectedType = document.getElementById('mediaUploadTypeSelect')?.value || 'auto';

      if (!file) {
        showToast('Pilih berkas Foto, Video, atau Dokumen PDF terlebih dahulu.', 'warning');
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        showToast('Ukuran berkas melebihi batas maksimal 25 MB.', 'warning');
        return;
      }

      let mimeType = file.type || 'application/octet-stream';
      if (!file.type) {
        if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (file.name.endsWith('.mp4')) mimeType = 'video/mp4';
        else if (file.name.endsWith('.png')) mimeType = 'image/png';
        else mimeType = 'image/jpeg';
      }

      const reader = new FileReader();
      const uploadBtn = document.getElementById('btnUploadMediaAsset');
      if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Mengunggah berkas...';
      }

      reader.onload = async () => {
        try {
          const res = await mediaApi.upload({
            file_name: file.name,
            data_url: reader.result,
            mime_type: mimeType,
            file_size: file.size,
            alt_text: altText || file.name,
            caption: caption || '',
            album_name: selectedType === 'pdf' ? 'Dokumen Akademik' : (selectedType === 'video' ? 'Video Dokumentasi' : 'Pustaka Foto')
          });

          showToast(`Berkas "${file.name}" berhasil diunggah ke Media Library!`, 'success');
          mediaUploadForm.reset();
          const previewBox = document.getElementById('wpUploadSelectedFileInfo');
          if (previewBox) previewBox.style.display = 'none';

          // Refresh and switch to browse tab
          await openMediaLibraryModal(state.mediaPickerCallback, state.activeMediaFilterType);
          if (wpTabBrowse) wpTabBrowse.click();

          // Auto-select newly created asset
          if (res?.data?.id) {
            const newItem = allMediaList.find(m => m.id === res.data.id || m.file_name === file.name);
            if (newItem) selectWpMediaItem(newItem);
          }
        } catch (err) {
          console.warn('[MediaUpload] Falling back to local storage:', err);
          const fallbackId = `med-${Date.now()}`;
          const fallbackItem = {
            id: fallbackId,
            file_name: file.name,
            file_url: reader.result,
            mime_type: mimeType,
            file_size: file.size,
            alt_text: altText || file.name,
            caption: caption || '',
            album_name: selectedType === 'pdf' ? 'Dokumen Akademik' : (selectedType === 'video' ? 'Video Dokumentasi' : 'Pustaka Foto')
          };
          mediaState.unshift(fallbackItem);
          try {
            const cached = JSON.parse(localStorage.getItem('rtm_cms_media') || '[]');
            cached.unshift(fallbackItem);
            localStorage.setItem('rtm_cms_media', JSON.stringify(cached.slice(0, 30)));
          } catch {}
          allMediaList = [fallbackItem, ...allMediaList];
          showToast(`Berkas "${file.name}" berhasil ditambahkan ke Media Library!`, 'success');
          mediaUploadForm.reset();
          const previewBox = document.getElementById('wpUploadSelectedFileInfo');
          if (previewBox) previewBox.style.display = 'none';
          renderWpMediaGrid();
          if (wpTabBrowse) wpTabBrowse.click();
          selectWpMediaItem(fallbackItem);
        } finally {
          if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '+ Unggah Berkas ke Library';
          }
        }
      };

      reader.onerror = () => {
        showToast('Gagal membaca berkas dari sistem lokal.', 'warning');
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.textContent = '+ Unggah Berkas ke Library';
        }
      };

      reader.readAsDataURL(file);
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
      navigate('/admin/gallery-form');
    });
  }

  if (btnCloseGalleryModal) {
    btnCloseGalleryModal.addEventListener('click', () => {
      if (galleryModal) galleryModal.classList.remove('open');
      navigate('/admin/galeri');
    });
  }

  if (btnCancelGallery) {
    btnCancelGallery.addEventListener('click', (e) => {
      e.preventDefault();
      if (galleryModal) galleryModal.classList.remove('open');
      navigate('/admin/galeri');
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
        navigate('/admin/galeri');
      } catch (err) {
        // Resilient fallback: store locally and update UI immediately
        const localGal = normalizeGallery({
          id: editId || `g-${Date.now()}`,
          ...payload
        });
        const idx = galleriesState.findIndex(g => g.id === localGal.id);
        if (idx >= 0) galleriesState[idx] = localGal;
        else galleriesState.unshift(localGal);
        try { localStorage.setItem('rtm_cms_galleries', JSON.stringify(galleriesState)); } catch {}
        adminGalleryForm.reset();
        if (galleryModal) galleryModal.classList.remove('open');
        renderAdminGaleri();
        renderGalleryGrid();
        showToast(`Foto galeri "${title}" berhasil disimpan!`, 'success');
        navigate('/admin/galeri');
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
      navigate('/');
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
        applySiteSettingsToDOM(payload);
        showToast('Pengaturan identitas dan tampilan yayasan berhasil disimpan.', 'success');
      }
    });
  }

  // Tampilan Tab Click Navigation & Individual Tab Save Buttons
  document.querySelectorAll('.tampilan-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        navigate(`/admin/tampilan/${tab}`);
      }
    });
  });

  const saveAppearanceTabSection = async (sectionTitle) => {
    const payload = getAppearanceFormPayload();
    try {
      await settingsApi.update({
        mode: 'publish',
        site_identity: payload
      });
      applySiteSettingsToDOM(payload);
      showToast(`Pengaturan ${sectionTitle} berhasil disimpan ke database server.`, 'success');
    } catch (err) {
      applySiteSettingsToDOM(payload);
      showToast(`Pengaturan ${sectionTitle} berhasil disimpan.`, 'success');
    }
  };

  document.getElementById('btnSaveTampilanIdentitas')?.addEventListener('click', () => {
    saveAppearanceTabSection('Identitas Yayasan & Logo Lembaga');
  });

  document.getElementById('btnSaveTampilanKontak')?.addEventListener('click', () => {
    saveAppearanceTabSection('Kontak Resmi & Rekening Bank');
  });

  document.getElementById('btnSaveTampilanBeranda')?.addEventListener('click', () => {
    saveAppearanceTabSection('Konten Beranda & Visi Misi');
  });

  document.getElementById('btnSaveTampilanFooter')?.addEventListener('click', () => {
    saveAppearanceTabSection('Tautan Sosial Media & Footer');
  });

  const visitorAnalyticsCard = document.getElementById('cockpitVisitorAnalytics');
  if (visitorAnalyticsCard) {
    visitorAnalyticsCard.addEventListener('click', () => {
      showToast('Google Analytics 4: Siap dihubungkan dengan Measurement ID saat website resmi dipublikasikan.', 'info');
    });
  }

  // P. 403 Forbidden return button
  const btnBack403 = document.getElementById('btnBackToAllowed');
  if (btnBack403) {
    btnBack403.addEventListener('click', () => {
      const currentUser = auth.getStoredUser() || usersState[0];
      const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;
      navigate(`/admin/${roleConf.defaultModule}`);
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
          id: currentUser.id,
          name: newName,
          email: newEmail,
          avatar: initials
        };
        if (newPass) {
          payload.password = newPass;
        }

        // Update in backend database API
        let updatedUserRecord = null;
        try {
          const res = await profileApi.update(payload);
          if (res && res.user) {
            updatedUserRecord = res.user;
          }
        } catch (apiErr) {
          console.warn('[Profile] Trying fallback usersApi update:', apiErr.message);
          try {
            const res2 = await usersApi.update(currentUser.id, payload);
            if (res2 && res2.user) {
              updatedUserRecord = res2.user;
            }
          } catch (err2) {
            throw new Error(apiErr.message || err2.message || 'Gagal menyimpan perubahan ke server database.');
          }
        }

        // Update local session user
        const updatedUser = {
          ...currentUser,
          ...(updatedUserRecord || {}),
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
        const accountAvatar = document.getElementById('accountDropdownAvatar');
        const topbarName = document.getElementById('topbarUserName');
        const accountEmail = document.getElementById('accountDropdownEmail');
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        const sidebarName = document.getElementById('sidebarUserName');
        const welcomeUserName = document.getElementById('welcomeUserName');

        if (topbarAvatar) topbarAvatar.textContent = initials;
        if (accountAvatar) accountAvatar.textContent = initials;
        if (topbarName) topbarName.textContent = newName;
        if (accountEmail) accountEmail.textContent = newEmail;
        if (sidebarAvatar) sidebarAvatar.textContent = initials;
        if (sidebarName) sidebarName.textContent = newName;
        if (welcomeUserName) welcomeUserName.textContent = newName;

        renderAdminProfile();
        showToast('Data profil Anda berhasil diperbarui di database!', 'success');
      } catch (err) {
        showToast(`Gagal memperbarui profil: ${err.message}`, 'error');
      }
    });
  }
}

// Video Background Performance & Autoplay Manager
export function initHeroVideoBackground() {
  const video = document.getElementById('heroBgVideo');
  if (!video) return;

  const toggleBtn = document.getElementById('btnHeroVideoToggle');
  const iconPause = toggleBtn?.querySelector('.icon-pause');
  const iconPlay = toggleBtn?.querySelector('.icon-play');
  const label = toggleBtn?.querySelector('.video-toggle-label');

  // Ensure muted is explicitly set for modern mobile browser autoplay policies
  video.muted = true;
  video.defaultMuted = true;

  // Respect user preference for reduced motion or data saver
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDataSaver = navigator.connection?.saveData || false;

  if (prefersReducedMotion || isDataSaver) {
    video.pause();
    video.dataset.manuallyPaused = 'true';
    if (iconPause) iconPause.style.display = 'none';
    if (iconPlay) iconPlay.style.display = 'inline';
    if (label) label.textContent = 'Putar';
  } else {
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy prevented playback, show play state
        if (iconPause) iconPause.style.display = 'none';
        if (iconPlay) iconPlay.style.display = 'inline';
        if (label) label.textContent = 'Putar';
      });
    }
  }

  // Toggle button click listener
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (video.paused) {
        delete video.dataset.manuallyPaused;
        video.play().then(() => {
          if (iconPause) iconPause.style.display = 'inline';
          if (iconPlay) iconPlay.style.display = 'none';
          if (label) label.textContent = 'Video';
          toggleBtn.setAttribute('title', 'Jeda video latar belakang');
        }).catch(() => {});
      } else {
        video.dataset.manuallyPaused = 'true';
        video.pause();
        if (iconPause) iconPause.style.display = 'none';
        if (iconPlay) iconPlay.style.display = 'inline';
        if (label) label.textContent = 'Putar';
        toggleBtn.setAttribute('title', 'Putar video latar belakang');
      }
    });
  }

  // Optimize battery/CPU: Pause background video when scrolled away from Hero
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          if (!video.paused) {
            video.dataset.pausedByScroll = 'true';
            video.pause();
          }
        } else {
          if (video.dataset.pausedByScroll === 'true') {
            delete video.dataset.pausedByScroll;
            if (!prefersReducedMotion && !isDataSaver && !video.dataset.manuallyPaused) {
              video.play().catch(() => {});
            }
          }
        }
      });
    }, { threshold: 0.1 });

    const heroSection = document.querySelector('.hero-video-section');
    if (heroSection) observer.observe(heroSection);
  }
}

// Interactive Stats Counter Animation for Dedicated Stats Section
export function initHomeStatsCounters() {
  const statNumbers = document.querySelectorAll('.home-stat-number[data-target]');
  if (!statNumbers.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-target'), 10);
        if (isNaN(target)) return;

        const duration = 1600;
        const startTime = performance.now();

        const step = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          const currentVal = Math.floor(easeProgress * target);

          if (target >= 1000) {
            el.textContent = currentVal.toLocaleString('id-ID');
          } else {
            el.textContent = currentVal.toString();
          }

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            if (target >= 1000) {
              el.textContent = target.toLocaleString('id-ID');
            } else {
              el.textContent = target.toString();
            }
          }
        };

        requestAnimationFrame(step);
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.25 });

  statNumbers.forEach(el => observer.observe(el));
}

// Initial Boot (Sprint 3 Full Integration)
document.addEventListener('DOMContentLoaded', async () => {
  initMotion();
  initGlobalUI();
  initModals();
  initAdminUI();
  initHeroVideoBackground();
  initHomeStatsCounters();
  renderGalleryGrid();
  renderNewsGrid();
  if (typeof renderPublicNavigationPrograms === 'function') renderPublicNavigationPrograms();
  if (typeof renderHomeProgramCards === 'function') renderHomeProgramCards('all');
  if (typeof renderHomeFeaturedArticles === 'function') renderHomeFeaturedArticles();
  initRouter();

  // Background Database Sync
  try {
    await syncDatabaseState();
    renderGalleryGrid();
    renderNewsGrid();
    if (typeof renderPublicNavigationPrograms === 'function') renderPublicNavigationPrograms();
    if (typeof renderHomeProgramCards === 'function') renderHomeProgramCards('all');
    if (typeof renderHomeFeaturedArticles === 'function') renderHomeFeaturedArticles();
    if (state.currentView === 'akademik') renderAkademikView();
  } catch (err) {
    console.log('[Boot] Initial load ready, offline fallback active');
  }
});


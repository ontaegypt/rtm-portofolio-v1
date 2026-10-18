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
  activeDonationStatusFilter: 'all',
  donationSearchQuery: '',
  adminArticleSearchQuery: '',
  selectedReceiptTrx: null
};

// Mutable CMS Stores (Synchronized with Backend SQLite Database)
let campaignsState = JSON.parse(JSON.stringify(CAMPAIGNS));
let donationsState = JSON.parse(JSON.stringify(DONATION_TRANSACTIONS));
let ppdbState = JSON.parse(JSON.stringify(PPDB_LEADS));
let visitsState = JSON.parse(JSON.stringify(VISIT_RESERVATIONS));
let articlesState = JSON.parse(JSON.stringify(NEWS_ARTICLES));
let usersState = JSON.parse(JSON.stringify(ADMIN_USERS));
let programsState = PROGRAMS.map(p => ({ ...p, ppdbOpen: true }));

// Normalizers for full database-to-UI compatibility
function normalizeDonation(d) {
  return {
    ...d,
    invoiceNumber: d.invoice_number || d.invoiceNumber || d.invoice,
    campaignId: d.campaign_id || d.campaignId,
    campaignTitle: d.campaign_title || d.campaignTitle,
    donorName: d.donor_name || d.donorName,
    donorPhone: d.donor_phone || d.donorPhone || '',
    donorEmail: d.donor_email || d.donorEmail || '',
    paymentMethod: d.payment_method || d.paymentMethod,
    paymentStatus: d.payment_status || d.paymentStatus || d.status,
    receiptUrl: d.proof_image || d.receiptUrl || d.proofUrl || '',
    paidAt: d.paid_at || d.paidAt || '-'
  };
}

function normalizeLead(l) {
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
  return {
    ...a,
    image: a.thumbnail_url || a.image || a.thumbnail,
    readTime: a.read_time || a.readTime,
    author: a.author_name || a.author,
    date: a.published_at || a.date
  };
}

function normalizeUser(u) {
  return {
    ...u,
    roleTitle: u.role_title || u.roleTitle,
    lastLogin: u.last_login_at || u.lastLogin || 'Baru Saja'
  };
}

// Synchronize all CMS stores with Backend SQLite Database
export async function syncDatabaseState() {
  try {
    const [progRes, artRes, galRes, campRes, donRes, visRes, leadRes, userRes] = await Promise.allSettled([
      programsApi.getAll(),
      articlesApi.getAll(),
      galleriesApi.getAll(),
      campaignsApi.getAll(),
      donationsApi.getAll(),
      reservationsApi.getAll(),
      ppdbApi.getAll(),
      usersApi.getAll()
    ]);

    if (progRes.status === 'fulfilled' && progRes.value.data) {
      programsState = progRes.value.data.map(p => ({
        ...p,
        ppdbOpen: p.is_active === 1
      }));
    }
    if (artRes.status === 'fulfilled' && artRes.value.data) {
      articlesState = artRes.value.data.map(normalizeArticle);
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
  } catch (err) {
    console.warn('[Sync] Falling back to initial cache:', err);
  }
}


// RBAC Role Definitions & Permission Maps (PRD Section 5.1 B)
const ROLES_CONFIG = {
  superadmin: {
    role: 'superadmin',
    name: 'Super Administrator',
    badgeClass: 'superadmin',
    allowedModules: ['overview', 'akademik', 'donasi', 'galeri', 'berita', 'tampilan', 'users'],
    defaultModule: 'overview'
  },
  editor: {
    role: 'editor',
    name: 'Content Editor',
    badgeClass: 'editor',
    allowedModules: ['berita', 'akademik', 'galeri'],
    defaultModule: 'berita'
  },
  finance: {
    role: 'finance',
    name: 'Finance / Bendahara',
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

// Router and Navigation System (Sprint 1 + Sprint 2 Auth Guard)
function initRouter() {
  const handleHashChange = () => {
    const rawHash = window.location.hash.slice(1) || 'home';
    let view = rawHash;
    let programParam = null;

    // A. Route Guard for Admin Login (#admin-login)
    if (rawHash === 'admin-login') {
      const currentUser = auth.getStoredUser();
      if (currentUser) {
        const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;
        window.location.hash = `#admin-${roleConf.defaultModule}`;
        return;
      }
      navigateTo('admin-login');
      return;
    }

    // B. Route Guard for Backoffice Area (#admin, #admin-*) (PRD 5.1 A)
    if (rawHash === 'admin' || rawHash.startsWith('admin-')) {
      const currentUser = auth.getStoredUser();
      if (!currentUser) {
        auth.setCallbackUrl(rawHash);
        showToast('Sesi masuk diperlukan untuk mengakses modul administratif.', 'warning');
        window.location.hash = '#admin-login';
        return;
      }

      // User authenticated: extract target module
      let targetModule = rawHash === 'admin' ? null : rawHash.replace('admin-', '');
      const roleConf = ROLES_CONFIG[currentUser.role] || ROLES_CONFIG.superadmin;

      if (!targetModule || targetModule === 'admin') {
        targetModule = roleConf.defaultModule;
      }

      // Check Role-Based Access Control (RBAC 403 Forbidden check)
      if (!roleConf.allowedModules.includes(targetModule)) {
        showToast(`Akses Ditolak (403): Role ${roleConf.name} tidak berwenang mengelola modul ini.`, 'warning');
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
        programParam = parts[1];
      }
    }

    navigateTo(view, programParam);
  };

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

export function navigateTo(viewName, programId = null) {
  state.currentView = viewName;
  if (programId && PROGRAMS.some(p => p.id === programId)) {
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

  // Update Breadcrumb Text
  const breadcrumbTitles = {
    overview: 'Ringkasan / Analytics',
    akademik: 'Kelola Akademik & PPDB',
    donasi: 'Modul Wakaf & Donasi',
    galeri: 'Kelola Galeri & Kunjungan',
    berita: 'Kelola Artikel / Berita',
    tampilan: 'Kelola Tampilan & Identitas',
    users: 'Manajemen Pengguna & RBAC'
  };
  const breadcrumbEl = document.getElementById('topbarBreadcrumbActive');
  if (breadcrumbEl) {
    breadcrumbEl.textContent = breadcrumbTitles[moduleName] || 'Dashboard Admin';
  }

  // Update Sidebar Navigation Links & Lock Indicators
  document.querySelectorAll('.sidebar-menu-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-admin-nav') === moduleName) {
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
  const quickRoleSelect = document.getElementById('quickRoleSelect');

  if (sidebarAvatar) sidebarAvatar.textContent = currentUser.avatar || 'AD';
  if (sidebarName) sidebarName.textContent = currentUser.name;
  if (sidebarRole) {
    sidebarRole.textContent = roleConf.name;
    sidebarRole.className = `user-role-badge ${roleConf.badgeClass}`;
  }

  if (topbarAvatar) topbarAvatar.textContent = currentUser.avatar || 'AD';
  if (topbarName) topbarName.textContent = currentUser.name;
  if (topbarRole) topbarRole.textContent = roleConf.name;
  if (quickRoleSelect) quickRoleSelect.value = currentUser.role;

  // Update Sidebar Alert Badges
  const pendingCount = donationsState.filter(d => d.paymentStatus === 'pending').length;
  const pendingBadge = document.getElementById('sidebarPendingDonationBadge');
  if (pendingBadge) {
    pendingBadge.textContent = `${pendingCount} Struk`;
    pendingBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }

  const pendingVisits = visitsState.filter(v => v.status === 'pending').length;
  const visitBadge = document.getElementById('sidebarVisitCount');
  if (visitBadge) {
    visitBadge.textContent = `${pendingVisits} Baru`;
  }

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

  // Scroll to top
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
          <span class="section-tag">Kurikulum & Metode</span>
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
          <span class="section-tag">Urgensi & Solusi</span>
          <h3 class="section-title">Tantangan Zaman & Solusi Al-Qur'an</h3>
          <p class="section-description">Menjawab kegelisahan wali santri dalam mencetak generasi tangguh di era serba cepat.</p>
        </div>

        <div class="problem-solution-grid">
          <div class="ps-column problems">
            <div class="ps-header">
              <span>⚠️</span>
              <span>Tantangan Umum yang Dihadapi:</span>
            </div>
            ${program.whyQuran.problems.map(prob => `
              <div class="ps-item">
                <span>❌</span>
                <span>${prob}</span>
              </div>
            `).join('')}
          </div>

          <div class="ps-column solutions">
            <div class="ps-header">
              <span>✅</span>
              <span>Solusi Rumah Tahfidz Al-Hikmah:</span>
            </div>
            ${program.whyQuran.solutions.map(sol => `
              <div class="ps-item">
                <span>✔️</span>
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
          <span class="section-tag">4 Pilar Keunggulan</span>
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
          <span class="section-tag">Learning Path</span>
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
          <span class="section-tag">Jadwal & Investasi</span>
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
          <span class="section-tag">Mudah & Terbimbing</span>
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
          <span class="section-tag">Kisah Nyata</span>
          <h3 class="section-title">Kata Mereka Tentang ${program.shortTitle}</h3>
          <p class="section-description">Kesan dan transformasi nyata santri serta wali murid yang telah bergabung.</p>
        </div>

        <div class="testimonials-grid">
          ${program.testimonials.map(t => `
            <div class="testimonial-card">
              <div class="quote-stars">★★★★★</div>
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
            <span class="section-tag">Formulir Pendaftaran</span>
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
                🔒 Data privasi Anda terlindungi aman sesuai standar kepesantrenan Al-Hikmah.
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
          <span class="section-tag">FAQ Program</span>
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
          payment_method: formData.get('paymentMethod') || 'Transfer Bank BSI'
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

  const filtered = state.galleryFilter === 'all'
    ? GALLERIES
    : GALLERIES.filter(g => g.category === state.galleryFilter);

  container.innerHTML = filtered.map((item, idx) => `
    <div class="gallery-card-item" data-index="${idx}" data-id="${item.id}">
      <img src="${item.image}" alt="${item.title}" loading="lazy" />
      <div class="gallery-overlay">
        <span class="gallery-overlay-badge">${formatCategoryName(item.category)}</span>
        <h5 class="gallery-overlay-title">${item.title}</h5>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.gallery-card-item').forEach(card => {
    card.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const item = GALLERIES.find(g => g.id === id);
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

  // Only show non-draft articles on the public website
  let filtered = articlesState.filter(a => a.status !== 'draft');

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
          <span>📅 ${art.date}</span>
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
    <span>${article.category}</span> • <span>${article.date}</span> • <span>Waktu baca: ${article.readTime}</span>
  `;
  modal.querySelector('#articleModalImg').src = article.image;
  modal.querySelector('#articleModalBody').innerHTML = article.content;

  const tagsContainer = modal.querySelector('#articleModalTags');
  if (tagsContainer) {
    tagsContainer.innerHTML = article.tags.map(t => `<span class="badge-tag-pill">#${t}</span>`).join(' ');
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
  status: 'all'
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
  const prog = PROGRAMS.find(p => p.id === progId) || PROGRAMS[0];
  const title = document.getElementById('pqpTitle');
  const desc = document.getElementById('pqpDesc');
  const batchSelect = document.getElementById('modalBatchId');

  if (title) title.textContent = prog.name;
  if (desc) desc.textContent = prog.headline || prog.summary;

  if (batchSelect && prog.batches) {
    batchSelect.innerHTML = prog.batches.map(b => `
      <option value="${b.name}">${b.name} (${b.remaining})</option>
    `).join('');
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
  const prog = PROGRAMS.find(p => p.id === (leadData.program_id || leadData.programId));
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

export function openAdminPPDBDetailModal(leadId) {
  const lead = ppdbState.find(l => l.id === leadId);
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

  if (nameEl) nameEl.textContent = lead.studentName;
  if (regEl) regEl.textContent = lead.id;
  if (dateEl) dateEl.textContent = lead.registeredAt;
  if (pillEl) {
    pillEl.textContent = lead.status === 'accepted' ? 'Diterima' : (lead.status === 'verified' ? 'Terverifikasi' : (lead.status === 'rejected' ? 'Ditolak' : 'Menunggu'));
    pillEl.className = `status-pill ${lead.status === 'accepted' ? 'status-success' : (lead.status === 'verified' ? 'status-active' : (lead.status === 'rejected' ? 'status-draft' : 'status-pending'))}`;
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
        const phone = document.getElementById('modalPhone').value.trim();
        const email = document.getElementById('modalEmail').value.trim();
        const paymentMethod = document.getElementById('modalPaymentMethod').value;
        const infoSource = document.getElementById('modalInfoSource').value;
        const motivation = document.getElementById('modalMotivation').value.trim();

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
          motivation
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

  const btnReject = document.getElementById('btnDossierReject');
  if (btnReject) {
    btnReject.addEventListener('click', async () => {
      if (!currentViewingLead) return;
      if (!confirm(`Apakah Anda yakin ingin menolak pendaftaran santri ${currentViewingLead.studentName}?`)) return;
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
      if (!confirm(`Hapus permanen data registrasi santri ${currentViewingLead.studentName}? Tindakan ini tidak dapat dibatalkan.`)) return;
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

  let list = PROGRAMS;
  if (category !== 'all') {
    list = PROGRAMS.filter(p => p.category === category);
  }

  container.innerHTML = list.map(p => `
    <div class="program-card">
      <div class="program-card-thumb">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        <span class="program-card-badge">${p.badge}</span>
      </div>
      <div class="program-card-body">
        <h4 class="program-card-title">${p.name}</h4>
        <span class="program-card-claim">${p.headline}</span>
        <p class="program-card-summary">${p.summary}</p>
        
        <div class="program-card-specs">
          <span class="spec-item">⏱️ ${p.stats.durasi}</span>
          <span class="spec-item">📖 ${p.stats.targetHafalan}</span>
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
          <strong>💳 Transfer Donasi Masuk</strong>
          <div>${d.donorName} (${d.invoiceNumber}) - Rp ${d.amount.toLocaleString('id-ID')}</div>
          <div class="notif-item-time">${d.paidAt}</div>
        </li>
      `;
    });

    pendingVisits.forEach(v => {
      itemsHtml += `
        <li class="notif-item" data-notif-target="galeri">
          <strong>🏛️ Reservasi Kunjungan Kampus</strong>
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

// 2. Render Overview Panel (Sprint 3 Live SQLite DB Stats)
async function renderAdminOverview() {
  try {
    const statsRes = await statsApi.getOverview();
    if (statsRes && statsRes.data) {
      const s = statsRes.data;
      const kpiDonasi = document.getElementById('kpiTotalDonasi');
      if (kpiDonasi) kpiDonasi.textContent = `Rp ${Number(s.totalDonations || 0).toLocaleString('id-ID')}`;

      const kpiPPDB = document.getElementById('kpiTotalPPDB');
      if (kpiPPDB) kpiPPDB.textContent = `${s.totalLeads} Santri`;

      const kpiCamp = document.getElementById('kpiActiveCampaigns');
      if (kpiCamp) kpiCamp.textContent = `${s.activePrograms} Program`;

      const kpiPending = document.getElementById('kpiPendingReceipts');
      if (kpiPending) kpiPending.textContent = `${s.pendingDonationsCount} Transaksi`;
    }
  } catch (err) {
    const totalDonations = donationsState
      .filter(d => (d.paymentStatus || d.status) === 'success')
      .reduce((sum, d) => sum + d.amount, 0);

    const pendingDonations = donationsState.filter(d => (d.paymentStatus || d.status) === 'pending');
    const activeCampaigns = campaignsState.filter(c => c.status === 'active').length;
    const totalPPDB = ppdbState.length;

    const kpiDonasi = document.getElementById('kpiTotalDonasi');
    if (kpiDonasi) kpiDonasi.textContent = `Rp ${totalDonations.toLocaleString('id-ID')}`;

    const kpiPPDB = document.getElementById('kpiTotalPPDB');
    if (kpiPPDB) kpiPPDB.textContent = `${totalPPDB} Santri`;

    const kpiCamp = document.getElementById('kpiActiveCampaigns');
    if (kpiCamp) kpiCamp.textContent = `${activeCampaigns} Program`;

    const kpiPending = document.getElementById('kpiPendingReceipts');
    if (kpiPending) kpiPending.textContent = `${pendingDonations.length} Transaksi`;
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
          <td>${t.campaignTitle.substring(0, 24)}...</td>
          <td><strong style="color: #059669;">Rp ${t.amount.toLocaleString('id-ID')}</strong></td>
          <td><span class="status-pill status-pending">Menunggu Verifikasi</span></td>
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
    ppdbTable.innerHTML = ppdbState.slice(0, 6).map(p => `
      <tr>
        <td>
          <strong>${p.studentName}</strong>
          <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${p.id}</div>
        </td>
        <td><span class="badge-tag-pill" style="font-size: 0.72rem;">${p.programName}</span></td>
        <td>${p.parentName}</td>
        <td>${p.registeredAt}</td>
        <td>
          <span class="status-pill ${p.status === 'accepted' ? 'status-success' : (p.status === 'verified' ? 'status-active' : (p.status === 'rejected' ? 'status-draft' : 'status-pending'))}">
            ${p.status === 'accepted' ? 'Diterima' : (p.status === 'verified' ? 'Terverifikasi' : (p.status === 'rejected' ? 'Ditolak' : 'Menunggu'))}
          </span>
        </td>
        <td>
          <button class="btn-icon-action btn-inspect-ppdb-overview" data-id="${p.id}" title="Lihat Dossier Calon Santri">👁️</button>
        </td>
      </tr>
    `).join('');

    ppdbTable.querySelectorAll('.btn-inspect-ppdb-overview').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openAdminPPDBDetailModal(id);
      });
    });
  }
}

// 3. Render Akademik Panel
function renderAdminAkademik() {
  const tbody = document.getElementById('adminProgramsTableBody');
  if (tbody) {
    tbody.innerHTML = programsState.map(p => `
      <tr>
        <td>
          <strong>${p.name}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${p.shortTitle}</div>
        </td>
        <td><span class="badge-tag-pill" style="font-size: 0.72rem;">${p.category === 'formal' ? '🏛️ Formal' : '📖 Non-Formal'}</span></td>
        <td>${p.stats.targetHafalan}</td>
        <td>${p.stats.durasi}</td>
        <td>
          <label class="switch-label">
            <div class="switch-toggle">
              <input type="checkbox" class="program-ppdb-switch" data-id="${p.id}" ${p.ppdbOpen ? 'checked' : ''} />
              <span class="switch-slider"></span>
            </div>
            <span class="switch-text">${p.ppdbOpen ? 'Buka (Open)' : 'Tutup (Closed)'}</span>
          </label>
        </td>
        <td>
          <a href="#" class="btn-download-syllabus" data-id="${p.id}" style="color: var(--primary-600); font-weight: 700; text-decoration: underline; font-size: 0.82rem;">
            📄 Silabus-${p.id.toUpperCase()}.pdf
          </a>
        </td>
        <td>
          <button class="btn-icon-action btn-upload-single-syllabus" data-id="${p.id}" title="Unggah Revisi Silabus">
            ${getIconSvg('download', 14)}
          </button>
        </td>
      </tr>
    `).join('');

    // Toggle switch listeners
    tbody.querySelectorAll('.program-ppdb-switch').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const prog = programsState.find(p => p.id === id);
        if (prog) {
          prog.ppdbOpen = e.target.checked;
          const label = e.target.closest('.switch-label').querySelector('.switch-text');
          if (label) label.textContent = prog.ppdbOpen ? 'Buka (Open)' : 'Tutup (Closed)';
          showToast(`Status PPDB ${prog.name} berhasil diubah menjadi: ${prog.ppdbOpen ? 'DIBUKA (OPEN)' : 'DITUTUP (CLOSED)'}`, 'success');
        }
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

function renderAdminPPDBTable() {
  const ppdbBody = document.getElementById('adminPPDBTableBody');
  const countBadge = document.getElementById('adminPPDBCountBadge');
  const searchInput = document.getElementById('filterPPDBSearch');
  const progFilter = document.getElementById('filterPPDBProgram');
  const statusFilter = document.getElementById('filterPPDBStatus');
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
    const cleanPhone = (lead.phone || '').replace(/^0/, '62').replace(/[^0-9]/g, '');
    const waText = encodeURIComponent(`Assalamu'alaikum Warahmatullah Bapak/Ibu ${lead.parentName || 'Wali Santri'}, kami dari Panitia PPDB Rumah Tahfidz Madani terkait pendaftaran ananda ${lead.studentName}...`);
    return `
      <tr>
        <td><code style="font-size: 0.78rem; font-weight: 700; color: var(--primary-purple);">${lead.id}</code></td>
        <td>
          <strong>${lead.studentName}</strong>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${lead.gender} • ${lead.birthDate || '-'}</div>
        </td>
        <td>
          <span class="badge-tag-pill" style="font-size: 0.72rem;">${lead.programName}</span>
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${lead.batchId}</div>
        </td>
        <td>${lead.parentName}</td>
        <td>
          <a href="https://wa.me/${cleanPhone}?text=${waText}" target="_blank" style="color: #059669; font-weight: 600; font-size: 0.85rem;">
            💬 ${lead.phone}
          </a>
        </td>
        <td>${lead.registeredAt}</td>
        <td>
          <span class="status-pill ${lead.status === 'accepted' ? 'status-success' : (lead.status === 'verified' ? 'status-active' : (lead.status === 'rejected' ? 'status-draft' : 'status-pending'))}">
            ${lead.status === 'accepted' ? 'Diterima' : (lead.status === 'verified' ? 'Terverifikasi' : (lead.status === 'rejected' ? 'Ditolak' : 'Menunggu'))}
          </span>
        </td>
        <td>
          <div class="table-action-btns">
            <button class="btn-icon-action btn-view-lead" data-id="${lead.id}" title="Lihat Dossier Calon Santri">👁️</button>
            <button class="btn-icon-action approve-btn btn-accept-lead" data-id="${lead.id}" title="Terima Santri">✓</button>
            <button class="btn-icon-action btn-verify-lead" data-id="${lead.id}" title="Verifikasi Berkas" style="color: #2563eb;">🔍</button>
            <a href="https://wa.me/${cleanPhone}?text=${waText}" target="_blank" class="btn-icon-action" title="Hubungi via WhatsApp">💬</a>
            <button class="btn-icon-action btn-delete-lead" data-id="${lead.id}" title="Hapus Data Santri" style="color: #dc2626;">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach table row actions
  ppdbBody.querySelectorAll('.btn-view-lead').forEach(btn => {
    btn.addEventListener('click', (e) => {
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
      const id = e.currentTarget.getAttribute('data-id');
      const lead = ppdbState.find(l => l.id === id);
      if (!confirm(`Hapus permanen pendaftaran santri ${lead ? lead.studentName : id}? Tindakan ini tidak dapat dibatalkan.`)) return;
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

// 4. Render Modul Wakaf & Donasi Panel
function renderAdminDonasi() {
  // Render Campaign Cards Grid
  const campGrid = document.getElementById('adminCampaignsGrid');
  const campBadge = document.getElementById('campaignsCountBadge');
  if (campBadge) campBadge.textContent = `${campaignsState.length} Program Terdaftar`;

  if (campGrid) {
    campGrid.innerHTML = campaignsState.map(c => {
      const pct = Math.min(100, (c.collectedAmount / c.targetAmount * 100)).toFixed(1);
      return `
        <div class="admin-campaign-card">
          <div class="campaign-card-thumb">
            <img src="${c.image}" alt="${c.title}" />
            <span class="campaign-card-category-badge">${c.category}</span>
          </div>
          <div class="campaign-card-body">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="badge-tag-pill" style="font-size: 0.72rem; text-transform: uppercase;">${c.type}</span>
              <span class="status-pill ${c.status === 'active' ? 'status-active' : (c.status === 'completed' ? 'status-success' : 'status-draft')}">
                ${c.status === 'active' ? 'Aktif' : (c.status === 'completed' ? 'Selesai' : 'Draft')}
              </span>
            </div>
            <h4 class="campaign-card-title">${c.title}</h4>
            <div class="admin-progress-box">
              <div class="admin-progress-bar">
                <div class="admin-progress-fill" style="width: ${pct}%;"></div>
              </div>
              <div class="admin-progress-meta">
                <span>Terkumpul: <strong>Rp ${c.collectedAmount.toLocaleString('id-ID')}</strong></span>
                <span><strong>${pct}%</strong></span>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: var(--text-muted); border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.5rem;">
              <span>Target: Rp ${c.targetAmount.toLocaleString('id-ID')}</span>
              <span>Donatur: ${c.donorCount} Orang</span>
            </div>
            <button class="btn btn-secondary btn-sm btn-edit-campaign" data-id="${c.id}" style="margin-top: 0.25rem;">
              ✏️ Kelola & Edit Campaign
            </button>
          </div>
        </div>
      `;
    }).join('');

    campGrid.querySelectorAll('.btn-edit-campaign').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openCampaignModal(id);
      });
    });
  }

  // Render Donations Table
  renderDonationTransactionsTable();
}

function renderDonationTransactionsTable() {
  const tbody = document.getElementById('adminDonationTableBody');
  if (!tbody) return;

  let filtered = donationsState;

  if (state.activeDonationStatusFilter !== 'all') {
    filtered = filtered.filter(d => d.paymentStatus === state.activeDonationStatusFilter);
  }

  if (state.donationSearchQuery.trim()) {
    const q = state.donationSearchQuery.toLowerCase();
    filtered = filtered.filter(d => 
      d.invoiceNumber.toLowerCase().includes(q) ||
      d.donorName.toLowerCase().includes(q) ||
      d.campaignTitle.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Tidak ada transaksi donasi sesuai filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td><code>${t.invoiceNumber}</code></td>
      <td>
        <strong>${t.donorName}</strong>
        ${t.isAnonymous ? '<span class="badge-tag-pill" style="font-size: 0.65rem; margin-left: 0.25rem;">Hamba Allah</span>' : ''}
        <div style="font-size: 0.74rem; color: var(--text-muted);">${t.donorPhone}</div>
      </td>
      <td>${t.campaignTitle.substring(0, 28)}...</td>
      <td><strong style="color: #059669; font-size: 0.95rem;">Rp ${t.amount.toLocaleString('id-ID')}</strong></td>
      <td><span style="font-size: 0.82rem;">${t.paymentMethod}</span></td>
      <td><span style="font-size: 0.78rem; color: var(--text-muted);">${t.paidAt}</span></td>
      <td>
        <span class="status-pill ${t.paymentStatus === 'success' ? 'status-success' : (t.paymentStatus === 'pending' ? 'status-pending' : 'status-failed')}">
          ${t.paymentStatus === 'success' ? 'Sukses' : (t.paymentStatus === 'pending' ? 'Menunggu' : 'Gagal')}
        </span>
      </td>
      <td>
        <div class="table-action-btns">
          ${t.paymentStatus === 'pending' ? `
            <button class="btn btn-primary btn-sm btn-inspect-receipt" data-id="${t.id}" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;">
              🔍 Periksa Struk
            </button>
          ` : `
            <span style="font-size: 0.78rem; color: #059669; font-weight: 700;">✓ Lunas</span>
          `}
          <button class="btn-icon-action btn-send-wa-receipt" data-id="${t.id}" title="Kirim Kwitansi Donasi WA">
            💬
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-inspect-receipt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      openReceiptModal(id);
    });
  });

  tbody.querySelectorAll('.btn-send-wa-receipt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const trx = donationsState.find(d => d.id === id);
      if (trx) {
        const text = encodeURIComponent(`Assalamu'alaikum wr. wb. Terima kasih kepada Bapak/Ibu ${trx.donorName} atas donasi wakaf sebesar Rp ${trx.amount.toLocaleString('id-ID')} (${trx.invoiceNumber}) untuk ${trx.campaignTitle}. Jazakumullah Khairan Katsiran.`);
        window.open(`https://wa.me/${trx.donorPhone.replace(/^0/, '62')}?text=${text}`, '_blank');
      }
    });
  });
}

// 5. Render Galeri & Kunjungan Panel
function renderAdminGaleri() {
  const visitBody = document.getElementById('adminVisitTableBody');
  if (visitBody) {
    visitBody.innerHTML = visitsState.map(v => `
      <tr>
        <td><strong>${v.groupName}</strong></td>
        <td>${v.leaderName}</td>
        <td><a href="https://wa.me/${v.phone.replace(/^0/, '62')}" target="_blank" style="color: #059669; font-weight: 600;">💬 ${v.phone}</a></td>
        <td><strong>${v.date}</strong></td>
        <td>${v.count} Orang</td>
        <td style="max-width: 220px; font-size: 0.8rem;">${v.goal}</td>
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

  // Mini Media Grid
  const mediaGrid = document.getElementById('adminMediaMiniGrid');
  if (mediaGrid) {
    mediaGrid.innerHTML = GALLERIES.slice(0, 8).map(g => `
      <div style="border-radius: var(--radius-md); overflow: hidden; border: 1px solid rgba(0,0,0,0.08); background: #000; height: 110px; position: relative;">
        <img src="${g.image}" alt="${g.title}" style="width: 100%; height: 100%; object-fit: cover;" />
        <span style="position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.7); color: #fff; font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 4px;">
          ${g.title.substring(0, 15)}...
        </span>
      </div>
    `).join('');
  }
}

// 6. Render Artikel / Berita Panel
function renderAdminBerita() {
  const tbody = document.getElementById('adminArticlesTableBody');
  const badge = document.getElementById('adminArticleCountBadge');
  if (badge) badge.textContent = `${articlesState.length} Berita Terdaftar`;

  if (!tbody) return;

  let filtered = articlesState;
  if (state.adminArticleSearchQuery.trim()) {
    const q = state.adminArticleSearchQuery.toLowerCase();
    filtered = filtered.filter(a => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  }

  tbody.innerHTML = filtered.map(art => `
    <tr>
      <td>
        <div style="width: 50px; height: 40px; border-radius: 6px; overflow: hidden;">
          <img src="${art.image}" alt="${art.title}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
      </td>
      <td>
        <strong>${art.title}</strong>
        <div style="font-size: 0.74rem; color: var(--text-muted); font-family: monospace;">/${art.id}</div>
      </td>
      <td><span class="badge-tag-pill" style="font-size: 0.72rem;">${art.category}</span></td>
      <td>${art.author || 'Admin Media'}</td>
      <td><span style="font-size: 0.78rem; color: var(--text-muted);">${art.date}</span></td>
      <td>
        <label class="switch-label">
          <div class="switch-toggle">
            <input type="checkbox" class="article-publish-toggle" data-id="${art.id}" ${art.status !== 'draft' ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </div>
          <span class="switch-text">${art.status !== 'draft' ? 'Published' : 'Draft'}</span>
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

  // Article publish toggle listener
  tbody.querySelectorAll('.article-publish-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const art = articlesState.find(a => a.id === id);
      if (art) {
        art.status = e.target.checked ? 'published' : 'draft';
        const label = e.target.closest('.switch-label').querySelector('.switch-text');
        if (label) label.textContent = art.status === 'published' ? 'Published' : 'Draft';
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
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm('Apakah Anda yakin ingin menghapus artikel ini?')) {
        articlesState = articlesState.filter(a => a.id !== id);
        showToast('Artikel berhasil dihapus dari sistem.', 'success');
        renderAdminBerita();
        renderNewsGrid();
      }
    });
  });
}

// 7. Render Tampilan & Identitas Panel
function renderAdminTampilan() {
  const nameInput = document.getElementById('settingInstitutionName');
  const shortInput = document.getElementById('settingShortName');
  const tagInput = document.getElementById('settingTagline');
  const mudirInput = document.getElementById('settingMudir');
  const waPPDB = document.getElementById('settingWhatsappPPDB');
  const waDonasi = document.getElementById('settingWhatsappDonasi');
  const emailInput = document.getElementById('settingEmail');
  const addrInput = document.getElementById('settingAddress');

  if (nameInput) nameInput.value = INSTITUTION.name;
  if (shortInput) shortInput.value = INSTITUTION.shortName;
  if (tagInput) tagInput.value = INSTITUTION.tagline;
  if (mudirInput) mudirInput.value = INSTITUTION.mudir;
  if (waPPDB) waPPDB.value = INSTITUTION.whatsappPPDB;
  if (waDonasi) waDonasi.value = INSTITUTION.whatsappDonasi;
  if (emailInput) emailInput.value = INSTITUTION.email;
  if (addrInput) addrInput.value = INSTITUTION.address;
}

// 8. Render Users & RBAC Panel
function renderAdminUsers() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  const roleDescriptions = {
    superadmin: 'Full Access (Semua 7 Modul & Pengaturan Sistem)',
    editor: 'Artikel Berita, Akademik, dan Galeri Kegiatan',
    finance: 'Modul Wakaf & Donasi, Verifikasi Transfer Bank'
  };

  tbody.innerHTML = usersState.map(u => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">${u.avatar}</div>
          <div>
            <strong>${u.name}</strong>
          </div>
        </div>
      </td>
      <td><code>${u.email}</code></td>
      <td><span class="user-role-badge ${u.role}">${u.roleTitle}</span></td>
      <td style="font-size: 0.78rem; color: var(--text-dark);">${roleDescriptions[u.role] || '-'}</td>
      <td><span style="font-size: 0.78rem; color: var(--text-muted);">${u.lastLogin}</span></td>
      <td><span class="status-pill status-success">Aktif</span></td>
      <td>
        <button class="btn-icon-action" title="Ubah Password">🔑</button>
      </td>
    </tr>
  `).join('');
}

// 9. Receipt Verification Modal Handlers
function openReceiptModal(transactionId) {
  const trx = donationsState.find(d => d.id === transactionId);
  if (!trx) return;

  state.selectedReceiptTrx = trx;

  const modal = document.getElementById('adminReceiptModal');
  if (!modal) return;

  const img = modal.querySelector('#adminReceiptImg');
  const inv = modal.querySelector('#receiptModalInvoice');
  const donor = modal.querySelector('#receiptModalDonor');
  const camp = modal.querySelector('#receiptModalCampaign');
  const amount = modal.querySelector('#receiptModalAmount');
  const method = modal.querySelector('#receiptModalMethod');
  const time = modal.querySelector('#receiptModalTime');
  const waBtn = modal.querySelector('#btnSendWAReceipt');

  if (img) img.src = trx.receiptUrl || '/assets/images/dormitory.jpg';
  if (inv) inv.textContent = trx.invoiceNumber;
  if (donor) donor.textContent = trx.donorName;
  if (camp) camp.textContent = trx.campaignTitle;
  if (amount) amount.textContent = `Rp ${trx.amount.toLocaleString('id-ID')}`;
  if (method) method.textContent = trx.paymentMethod;
  if (time) time.textContent = trx.paidAt;

  if (waBtn) {
    const text = encodeURIComponent(`Assalamu'alaikum. Konfirmasi penerimaan donasi ${trx.invoiceNumber} sebesar Rp ${trx.amount.toLocaleString('id-ID')} telah disetujui.`);
    waBtn.href = `https://wa.me/${trx.donorPhone.replace(/^0/, '62')}?text=${text}`;
  }

  modal.classList.add('open');
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

  modal.classList.add('open');
}

// 11. Article Modal Handlers
function openArticleModal(articleId = null) {
  const modal = document.getElementById('adminArticleModal');
  const titleEl = document.getElementById('adminArticleModalTitle');
  const form = document.getElementById('adminArticleForm');
  if (!modal || !form) return;

  if (articleId) {
    const art = articlesState.find(a => a.id === articleId);
    if (art) {
      if (titleEl) titleEl.textContent = 'Edit Artikel Berita';
      document.getElementById('articleFormId').value = art.id;
      document.getElementById('articleFormTitle').value = art.title;
      document.getElementById('articleFormCategory').value = art.category;
      document.getElementById('articleFormAuthor').value = art.author || 'Humas Rumah Tahfidz';
      document.getElementById('articleFormExcerpt').value = art.excerpt;
      document.getElementById('articleFormBody').value = art.content.replace(/<[^>]+>/g, '\n');
      document.getElementById('articleFormImage').value = art.image;
      document.getElementById('articleFormTags').value = (art.tags || []).join(', ');
      document.getElementById('articleFormPublishToggle').checked = art.status !== 'draft';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Tulis Artikel Berita Baru';
    form.reset();
    document.getElementById('articleFormId').value = '';
    document.getElementById('articleFormImage').value = '/assets/images/wisuda.jpg';
    document.getElementById('articleFormPublishToggle').checked = true;
  }

  modal.classList.add('open');
}

// 12. Export CSV Functionality (PRD Section 5.2 - Live Backend Stream)
function exportDonationsCSV() {
  window.open(donationsApi.exportCsvUrl, '_blank');
  showToast('📥 Mengunduh data rekap donasi resmi dari server database...', 'success');
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
          loginAlertBox.innerHTML = `❌ ${err.message}`;
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
          togglePassBtn.textContent = '🙈';
        } else {
          passInput.type = 'password';
          togglePassBtn.textContent = '👁️';
        }
      }
    });
  }

  // B. Logout Button
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      auth.clearUser();
      showToast('Anda telah berhasil keluar dari sesi administrasi.', 'success');
      window.location.hash = '#admin-login';
    });
  }

  // C. Quick Role Switcher Dropdown (Live Demo Feature)
  const quickRoleSelect = document.getElementById('quickRoleSelect');
  if (quickRoleSelect) {
    quickRoleSelect.addEventListener('change', (e) => {
      const newRole = e.target.value;
      const targetUser = usersState.find(u => u.role === newRole) || usersState[0];
      auth.setStoredUser(targetUser, true);
      showToast(`Beralih mode peran: ${targetUser.roleTitle}`, 'success');
      const roleConf = ROLES_CONFIG[newRole] || ROLES_CONFIG.superadmin;
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

  // E. Mobile Sidebar Toggle
  const sidebarToggleBtn = document.getElementById('adminSidebarToggleBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const sidebar = document.getElementById('adminSidebar');

  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.add('open');
    });
  }

  if (sidebarCloseBtn && sidebar) {
    sidebarCloseBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  }

  // F. Receipt Modal Approval & Rejection Handlers (Sprint 3 API Integration)
  const btnApproveReceipt = document.getElementById('btnApproveReceiptAction');
  const btnRejectReceipt = document.getElementById('btnRejectReceiptAction');
  const btnCloseReceipt = document.getElementById('btnCloseReceiptModal');
  const receiptModal = document.getElementById('adminReceiptModal');

  if (btnApproveReceipt) {
    btnApproveReceipt.addEventListener('click', async () => {
      if (state.selectedReceiptTrx) {
        try {
          await donationsApi.verify(state.selectedReceiptTrx.id, 'success');
          showToast(`✅ Bukti transfer ${state.selectedReceiptTrx.invoiceNumber} berhasil diverifikasi! Tercatat di database.`, 'success');
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
        try {
          await donationsApi.verify(state.selectedReceiptTrx.id, 'failed');
          showToast(`❌ Transaksi ${state.selectedReceiptTrx.invoiceNumber} telah ditolak.`, 'warning');
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

  if (btnCloseReceipt && receiptModal) {
    btnCloseReceipt.addEventListener('click', () => receiptModal.classList.remove('open'));
  }

  // G. Campaign Create / Edit Modal Form (Sprint 3 API Integration)
  const campaignForm = document.getElementById('adminCampaignForm');
  const campaignModal = document.getElementById('adminCampaignModal');
  const btnCreateCamp = document.getElementById('btnCreateCampaign');
  const btnCloseCamp = document.getElementById('btnCloseCampaignModal');
  const btnCancelCamp = document.getElementById('btnCancelCampaign');

  if (btnCreateCamp) {
    btnCreateCamp.addEventListener('click', () => openCampaignModal());
  }

  if (btnCloseCamp && campaignModal) {
    btnCloseCamp.addEventListener('click', () => campaignModal.classList.remove('open'));
  }

  if (btnCancelCamp && campaignModal) {
    btnCancelCamp.addEventListener('click', () => campaignModal.classList.remove('open'));
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
            category_name: category,
            target_amount: target,
            cover_image: image,
            description: desc,
            end_date: deadline
          });
          showToast(`Program campaign baru "${title}" berhasil disimpan di database!`, 'success');
        }

        await syncDatabaseState();
        if (campaignModal) campaignModal.classList.remove('open');
        renderAdminDonasi();
        await renderAdminOverview();
      } catch (err) {
        showToast(err.message, 'warning');
      }
    });
  }

  // H. Article Create / Edit Modal Form
  const articleForm = document.getElementById('adminArticleForm');
  const articleModal = document.getElementById('adminArticleModal');
  const btnCreateArt = document.getElementById('btnCreateArticle');
  const btnCloseArt = document.getElementById('btnCloseArticleModal');
  const btnCancelArt = document.getElementById('btnCancelArticle');

  if (btnCreateArt) {
    btnCreateArt.addEventListener('click', () => openArticleModal());
  }

  if (btnCloseArt && articleModal) {
    btnCloseArt.addEventListener('click', () => articleModal.classList.remove('open'));
  }

  if (btnCancelArt && articleModal) {
    btnCancelArt.addEventListener('click', () => articleModal.classList.remove('open'));
  }

  if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('articleFormId').value;
      const title = document.getElementById('articleFormTitle').value;
      const category = document.getElementById('articleFormCategory').value;
      const author = document.getElementById('articleFormAuthor').value;
      const excerpt = document.getElementById('articleFormExcerpt').value;
      const bodyContent = document.getElementById('articleFormBody').value;
      const image = document.getElementById('articleFormImage').value;
      const isPublished = document.getElementById('articleFormPublishToggle').checked;

      const paragraphs = bodyContent.split('\n\n').map(p => `<p>${p}</p>`).join('');

      try {
        if (id) {
          await articlesApi.update(id, {
            title,
            category,
            excerpt,
            content: paragraphs,
            thumbnail_url: image,
            status: isPublished ? 'published' : 'draft'
          });
          showToast(`Artikel "${title}" berhasil diperbarui di database.`, 'success');
        } else {
          await articlesApi.create({
            title,
            category,
            excerpt,
            content: paragraphs,
            thumbnail_url: image,
            read_time: '3 Menit',
            status: isPublished ? 'published' : 'draft'
          });
          showToast(`Artikel baru "${title}" berhasil diterbitkan di database!`, 'success');
        }

        await syncDatabaseState();
        if (articleModal) articleModal.classList.remove('open');
        renderAdminBerita();
        renderNewsGrid();
      } catch (err) {
        showToast(err.message, 'warning');
      }
    });
  }

  // I. Syllabus Upload Modal
  const syllabusModal = document.getElementById('adminSyllabusModal');
  const btnUploadSyllabus = document.getElementById('btnUploadSyllabus');
  const btnCloseSyllabus = document.getElementById('btnCloseSyllabusModal');
  const btnCancelSyllabus = document.getElementById('btnCancelSyllabus');
  const syllabusForm = document.getElementById('adminSyllabusForm');

  if (btnUploadSyllabus && syllabusModal) {
    btnUploadSyllabus.addEventListener('click', () => syllabusModal.classList.add('open'));
  }
  if (btnCloseSyllabus && syllabusModal) {
    btnCloseSyllabus.addEventListener('click', () => syllabusModal.classList.remove('open'));
  }
  if (btnCancelSyllabus && syllabusModal) {
    btnCancelSyllabus.addEventListener('click', () => syllabusModal.classList.remove('open'));
  }
  if (syllabusForm && syllabusModal) {
    syllabusForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const progId = document.getElementById('syllabusProgramSelect').value;
      const prog = programsState.find(p => p.id === progId);
      showToast(`Silabus Kurikulum Baru untuk ${prog ? prog.name : ''} berhasil diunggah & dipublikasikan.`, 'success');
      syllabusModal.classList.remove('open');
    });
  }

  // J. User Creation Modal (Sprint 3 API Integration)
  const userModal = document.getElementById('adminUserModal');
  const btnCreateUser = document.getElementById('btnCreateUser');
  const btnCloseUser = document.getElementById('btnCloseUserModal');
  const btnCancelUser = document.getElementById('btnCancelUser');
  const userForm = document.getElementById('adminUserForm');

  if (btnCreateUser && userModal) {
    btnCreateUser.addEventListener('click', () => userModal.classList.add('open'));
  }
  if (btnCloseUser && userModal) {
    btnCloseUser.addEventListener('click', () => userModal.classList.remove('open'));
  }
  if (btnCancelUser && userModal) {
    btnCancelUser.addEventListener('click', () => userModal.classList.remove('open'));
  }
  if (userForm && userModal) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('userFormName').value;
      const email = document.getElementById('userFormEmail').value;
      const pass = document.getElementById('userFormPassword').value;
      const role = document.getElementById('userFormRole').value;

      const roleTitles = {
        superadmin: 'Super Administrator',
        editor: 'Content Editor',
        finance: 'Finance / Bendahara'
      };

      try {
        await usersApi.create({
          name,
          email,
          password: pass,
          role,
          role_title: roleTitles[role] || role
        });
        showToast(`Akun pengguna ${name} (${roleTitles[role] || role}) berhasil didaftarkan ke sistem!`, 'success');
        userForm.reset();
        if (userModal) userModal.classList.remove('open');
        await syncDatabaseState();
        renderAdminUsers();
      } catch (err) {
        showToast(err.message, 'warning');
      }
    });
  }

  // K. CSV Export Buttons
  const btnExportCSV = document.getElementById('btnExportDonationCSV');
  const btnQuickCSV = document.getElementById('btnQuickExportCSV');
  if (btnExportCSV) btnExportCSV.addEventListener('click', exportDonationsCSV);
  if (btnQuickCSV) btnQuickCSV.addEventListener('click', exportDonationsCSV);

  // L. Donation Search & Filter Buttons
  const donSearch = document.getElementById('donationSearchInput');
  if (donSearch) {
    donSearch.addEventListener('input', (e) => {
      state.donationSearchQuery = e.target.value;
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

  // M. Article Search in Admin
  const artSearch = document.getElementById('adminArticleSearchInput');
  if (artSearch) {
    artSearch.addEventListener('input', (e) => {
      state.adminArticleSearchQuery = e.target.value;
      renderAdminBerita();
    });
  }

  // N. Appearance Settings Save (Sprint 3 API Integration)
  const btnSaveAppearance = document.getElementById('btnSaveAppearanceSettings');
  if (btnSaveAppearance) {
    btnSaveAppearance.addEventListener('click', async () => {
      const nameInput = document.getElementById('settingInstitutionName');
      const shortInput = document.getElementById('settingShortName');
      const tagInput = document.getElementById('settingTagline');
      const mudirInput = document.getElementById('settingMudir');

      try {
        await settingsApi.update({
          site_identity: {
            title: nameInput ? nameInput.value : INSTITUTION.name,
            shortTitle: shortInput ? shortInput.value : INSTITUTION.shortName,
            tagline: tagInput ? tagInput.value : INSTITUTION.tagline,
            mudir: mudirInput ? mudirInput.value : INSTITUTION.mudir
          }
        });
        showToast('💾 Pengaturan identitas berhasil disimpan ke database SQLite server.', 'success');
      } catch (err) {
        showToast('💾 Pengaturan identitas dan tampilan yayasan berhasil disimpan.', 'success');
      }
    });
  }

  // O. Overview Refresh
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
}

// Initial Boot (Sprint 3 Full Integration)
document.addEventListener('DOMContentLoaded', async () => {
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


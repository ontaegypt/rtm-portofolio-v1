// ============================================================================
// RUMAH TAHFIDZ MADANI (RTM) - REST API CLIENT SERVICE (SPRINT 3 INTEGRATION)
// Handles all network communication, token auth, and backend data synchronization
// ============================================================================

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('rtm_auth_token') || sessionStorage.getItem('rtm_auth_token') || null;
  }

  setToken(token, remember = true) {
    this.token = token;
    if (remember) {
      localStorage.setItem('rtm_auth_token', token);
    } else {
      sessionStorage.setItem('rtm_auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('rtm_auth_token');
    sessionStorage.removeItem('rtm_auth_token');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.warn(`[ApiClient] Request to ${endpoint} failed:`, error.message);
      throw error;
    }
  }

  get(endpoint, params = null) {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, val);
        }
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const client = new ApiClient();

// High-level Domain Services
export const authApi = {
  login: (email, password) => client.post('/auth/login', { email, password }),
  getMe: () => client.get('/auth/me'),
  logout: () => client.clearToken()
};

export const statsApi = {
  getOverview: () => client.get('/stats'),
  getHealth: () => client.get('/health')
};

export const programsApi = {
  getAll: () => client.get('/programs'),
  getById: (id) => client.get(`/programs/${id}`),
  update: (id, data) => client.put(`/programs/${id}`, data),
  toggleStatus: (id) => client.patch(`/programs/${id}/toggle`)
};

export const articlesApi = {
  getAll: (params) => client.get('/articles', params),
  getById: (idOrSlug) => client.get(`/articles/${idOrSlug}`),
  create: (data) => client.post('/articles', data),
  update: (id, data) => client.put(`/articles/${id}`, data),
  toggleStatus: (id) => client.patch(`/articles/${id}/toggle`),
  delete: (id) => client.delete(`/articles/${id}`)
};

export const galleriesApi = {
  getAll: (category) => client.get('/galleries', category ? { category } : null),
  create: (data) => client.post('/galleries', data),
  delete: (id) => client.delete(`/galleries/${id}`)
};

export const reservationsApi = {
  getAll: (status) => client.get('/reservations', status ? { status } : null),
  submit: (data) => client.post('/reservations', data),
  updateStatus: (id, status, notes) => client.patch(`/reservations/${id}/status`, { status, notes })
};

export const campaignsApi = {
  getAll: () => client.get('/campaigns'),
  create: (data) => client.post('/campaigns', data),
  update: (id, data) => client.put(`/campaigns/${id}`, data)
};

export const donationsApi = {
  getAll: (params) => client.get('/donations', params),
  submit: (data) => client.post('/donations', data),
  verify: (id, payment_status, notes) => client.patch(`/donations/${id}/status`, { payment_status, notes }),
  exportCsvUrl: `${API_BASE}/donations/export`
};

export const ppdbApi = {
  getAll: (params) => client.get('/ppdb', params),
  getById: (id) => client.get(`/ppdb/${id}`),
  submit: (data) => client.post('/ppdb', data),
  updateStatus: (id, status, notes) => client.patch(`/ppdb/${id}/status`, { status, notes }),
  delete: (id) => client.delete(`/ppdb/${id}`),
  exportCsvUrl: `${API_BASE}/ppdb/export`
};

export const usersApi = {
  getAll: () => client.get('/users'),
  create: (data) => client.post('/users', data),
  delete: (id) => client.delete(`/users/${id}`)
};

export const settingsApi = {
  get: () => client.get('/settings'),
  update: (data) => client.put('/settings', data)
};

export const leadsApi = {
  submitWaitlist: (contact, type = 'lms_portal') => client.post('/leads', { contact, type })
};

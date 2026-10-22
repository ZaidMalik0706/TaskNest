// Small fetch wrapper used by every page. It attaches the JWT and normalises errors.
const API_BASE = '/api';
const TOKEN_KEY = 'tasknest_token';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function parseErrorBody(text, status) {
  if (!text) return `Request failed (${status}).`;

  try {
    const data = JSON.parse(text);
    if (data.errors) return Object.values(data.errors).flat().join(' ');
    if (data.message) return data.message;
    if (data.title) return data.title;
  } catch {
    return text;
  }

  return `Request failed (${status}).`;
}

async function request(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  const headers = {};
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    // status 0 means "network failed"; callers use this to queue offline work.
    throw new ApiError('Network unavailable. Your changes will sync when you are back online.', 0);
  }

  if (response.status === 401 && redirectOn401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('tasknest_user');
    if (!/\/(login|register)\.html$/.test(location.pathname)) {
      location.replace('/login.html');
    }
    throw new ApiError('Your session expired. Please log in again.', 401);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(parseErrorBody(text, response.status), response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}

window.api = {
  auth: {
    register: data => request(`${API_BASE}/auth/register`, {
      method: 'POST', body: data, redirectOn401: false
    }),
    login: data => request(`${API_BASE}/auth/login`, {
      method: 'POST', body: data, redirectOn401: false
    }),
    me: () => request(`${API_BASE}/auth/me`)
  },

  tasks: {
    list(params = {}) {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.category) query.set('category', params.category);
      if (params.q) query.set('q', params.q);
      const suffix = query.toString();
      return request(`${API_BASE}/tasks${suffix ? `?${suffix}` : ''}`);
    },
    get: id => request(`${API_BASE}/tasks/${id}`),
    create: task => request(`${API_BASE}/tasks`, { method: 'POST', body: task }),
    update: (id, task) => request(`${API_BASE}/tasks/${id}`, { method: 'PUT', body: { ...task, id } }),
    toggle: id => request(`${API_BASE}/tasks/${id}/toggle`, { method: 'PATCH' }),
    remove: id => request(`${API_BASE}/tasks/${id}`, { method: 'DELETE' }),

    addSubtask: (taskId, subtask) => request(`${API_BASE}/tasks/${taskId}/subtasks`, {
      method: 'POST', body: subtask
    }),
    updateSubtask: (taskId, subtaskId, changes) => request(
      `${API_BASE}/tasks/${taskId}/subtasks/${subtaskId}`,
      { method: 'PATCH', body: changes }
    ),
    removeSubtask: (taskId, subtaskId) => request(
      `${API_BASE}/tasks/${taskId}/subtasks/${subtaskId}`,
      { method: 'DELETE' }
    )
  },

  focus: {
    log: data => request(`${API_BASE}/focus`, { method: 'POST', body: data })
  },

  stats: {
    get: () => request(`${API_BASE}/stats`)
  },

  // Used by the offline queue to replay a saved mutation exactly as it was made.
  raw: (path, { method, body } = {}) => request(path, { method, body })
};

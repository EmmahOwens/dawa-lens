/**
 * Central API service that communicates with the Express/MongoDB backend.
 * All functions return typed data or throw on error.
 */

const BASE_URL = 'http://localhost:5000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json() as Promise<T>;
}

// --- Auth ---
export const authApi = {
  register: (email: string, password: string) =>
    request<{ _id: string; email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ _id: string; email: string; languagePreference: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

// --- Medicines ---
export const medicinesApi = {
  getAll: (userId: string) =>
    request<any[]>(`/medicines?userId=${userId}`),

  create: (data: Record<string, unknown>) =>
    request<any>('/medicines', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    request<any>(`/medicines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: string) =>
    request<void>(`/medicines/${id}`, { method: 'DELETE' }),
};

// --- Reminders ---
export const remindersApi = {
  getAll: (userId: string) =>
    request<any[]>(`/reminders?userId=${userId}`),

  create: (data: Record<string, unknown>) =>
    request<any>('/reminders', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    request<any>(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: string) =>
    request<void>(`/reminders/${id}`, { method: 'DELETE' }),
};

// --- Dose Logs ---
export const doseLogsApi = {
  getAll: (userId: string) =>
    request<any[]>(`/doselogs?userId=${userId}`),

  create: (data: Record<string, unknown>) =>
    request<any>('/doselogs', { method: 'POST', body: JSON.stringify(data) }),
};

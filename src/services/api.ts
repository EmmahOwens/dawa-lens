/**
 * Central API service that communicates with the Express/MongoDB backend.
 * All functions return typed data or throw on error.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/** Custom error that carries extra fields from the backend JSON response. */
class ApiError extends Error {
  [key: string]: any;
  constructor(data: Record<string, any>) {
    super(data.error || 'Request failed');
    Object.assign(this, data);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Network error' }));
    throw new ApiError(data);
  }
  return res.json() as Promise<T>;
}



// --- Users ---
export const usersApi = {
  getProfile: (uid: string) =>
    request<any>(`/users/${uid}`),

  upsertProfile: (data: Record<string, unknown>) =>
    request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
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

// --- Vision AI ---
export const visionApi = {
  identifyPill: (data: { image: string }) =>
    request<any>('/vision/pill-id', { method: 'POST', body: JSON.stringify(data) }),
};

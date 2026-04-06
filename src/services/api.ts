/**
 * Central API service that communicates with the Express/MongoDB backend.
 * All functions return typed data or throw on error.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/** Custom error that carries extra fields from the backend JSON response. */
class ApiError extends Error {
  [key: string]: any;
  code?: string;
  constructor(data: Record<string, any>) {
    super(data.error || 'Request failed');
    this.code = data.code;
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

// --- Patients (Family/CHW Profiles) ---
export const patientsApi = {
  getAll: (managedBy: string) => 
    request<any[]>(`/patients?managedBy=${managedBy}`),
  create: (data: Record<string, unknown>) => 
    request<any>('/patients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => 
    request<any>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => 
    request<void>(`/patients/${id}`, { method: 'DELETE' }),
};

// --- Medicines ---
export const medicinesApi = {
  getAll: (userId: string, patientId?: string) => {
    const url = `/medicines?userId=${userId}${patientId ? `&patientId=${patientId}` : ''}`;
    return request<any[]>(url);
  },

  create: (data: Record<string, unknown>) =>
    request<any>('/medicines', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    request<any>(`/medicines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: string) =>
    request<void>(`/medicines/${id}`, { method: 'DELETE' }),
};

// --- Reminders ---
export const remindersApi = {
  getAll: (userId: string, patientId?: string) => {
    const url = `/reminders?userId=${userId}${patientId ? `&patientId=${patientId}` : ''}`;
    return request<any[]>(url);
  },

  create: (data: Record<string, unknown>) =>
    request<any>('/reminders', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    request<any>(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: string) =>
    request<void>(`/reminders/${id}`, { method: 'DELETE' }),
};

// --- Dose Logs ---
export const doseLogsApi = {
  getAll: (userId: string, patientId?: string) => {
    const url = `/doselogs?userId=${userId}${patientId ? `&patientId=${patientId}` : ''}`;
    return request<any[]>(url);
  },

  create: (data: Record<string, unknown>) =>
    request<any>('/doselogs', { method: 'POST', body: JSON.stringify(data) }),
};

// --- Vision AI ---
export const visionApi = {
  identifyPill: (data: { image: string }) =>
    request<any>('/vision/pill-id', { method: 'POST', body: JSON.stringify(data) }),
};

// --- Generative AI (Coaching & Holistic Safety) ---
export const aiApi = {
  getCoachAdvice: (data: { logs: any[]; medicines: any[]; userName?: string }) =>
    request<any>('/ai/coach', { method: 'POST', body: JSON.stringify(data) }),
  
  checkHolisticSafety: (data: { medicines: any[]; lifestyleFactors: string[] }) =>
    request<any>('/ai/holistic-safety', { method: 'POST', body: JSON.stringify(data) }),

  getTravelAdvice: (data: { 
    medicines: any[]; 
    destination: string; 
    currentCity?: string; 
    homeTimezone?: string; 
    targetTimezone?: string;
  }) =>
    request<any>('/ai/travel', { method: 'POST', body: JSON.stringify(data) }),
};

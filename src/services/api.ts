import { auth } from "@/lib/firebase";
import { Capacitor } from "@capacitor/core";
import { Medicine, Reminder, UserProfile, DoseLog, WellnessLog, Patient } from "../contexts/AppContext";
import { AIAction } from "./aiAssistantService";

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/v1') ? envUrl : `${envUrl}/v1`;
  }
  
  if (typeof window !== 'undefined' && 
      !Capacitor.isNativePlatform() &&
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' || 
       window.location.hostname === '::1')) {
    return 'http://localhost:5000/api/v1';
  }
  
  return 'https://dawa-lens.onrender.com/api/v1';
};

const BASE_URL = getBaseUrl();

/** Custom error that carries extra fields from the backend JSON response. */
class ApiError extends Error {
  [key: string]: unknown;
  code?: string;
  statusCode?: number;
  constructor(data: Record<string, unknown>, statusCode?: number) {
    super((data.error as string) || (data.message as string) || 'Request failed');
    this.code = data.code as string;
    this.statusCode = statusCode;
    Object.assign(this, data);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers as Record<string, string>,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Network error' }));
    throw new ApiError(data, res.status);
  }
  return res.json() as Promise<T>;
}

async function streamRequest(path: string, options?: RequestInit): Promise<ReadableStream> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers as Record<string, string>,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Network error' }));
    throw new ApiError(data, res.status);
  }

  if (!res.body) {
    throw new Error('Response body is empty');
  }

  return res.body;
}

// --- Users ---
export const usersApi = {
  getProfile: (uid: string) =>
    request<UserProfile>(`/users/${uid}`),

  upsertProfile: (data: Record<string, unknown>) =>
    request<UserProfile>('/users', { method: 'POST', body: JSON.stringify(data) }),
};

// --- Patients (Family/CHW Profiles) ---
export const patientsApi = {
  getAll: (managedBy: string) => 
    request<Patient[]>(`/patients?managedBy=${managedBy}`),
  create: (data: Record<string, unknown>) => 
    request<Patient>('/patients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => 
    request<Patient>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => 
    request<void>(`/patients/${id}`, { method: 'DELETE' }),
};

// --- Medicines ---
export const medicinesApi = {
  getAll: (userId: string, patientId?: string) => {
    const url = `/medicines?userId=${userId}${patientId ? `&patientId=${patientId}` : ''}`;
    return request<Medicine[]>(url);
  },

  create: (data: Record<string, unknown>) =>
    request<Medicine>('/medicines', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    request<Medicine>(`/medicines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: string) =>
    request<void>(`/medicines/${id}`, { method: 'DELETE' }),
};

// --- Reminders ---
export const remindersApi = {
  getAll: (userId: string, patientId?: string) => {
    const url = `/reminders?userId=${userId}${patientId ? `&patientId=${patientId}` : ''}`;
    return request<Reminder[]>(url);
  },

  create: (data: Record<string, unknown>) =>
    request<Reminder>('/reminders', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    request<Reminder>(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: string) =>
    request<void>(`/reminders/${id}`, { method: 'DELETE' }),
};

// --- Dose Logs ---
export const doseLogsApi = {
  getAll: (userId: string, patientId?: string) => {
    const url = `/doselogs?userId=${userId}${patientId ? `&patientId=${patientId}` : ''}`;
    return request<DoseLog[]>(url);
  },

  create: (data: Record<string, unknown>) =>
    request<DoseLog>('/doselogs', { method: 'POST', body: JSON.stringify(data) }),

  remove: (id: string) =>
    request<void>(`/doselogs/${id}`, { method: 'DELETE' }),
};

// --- Wellness Journals (Food/Symptoms) ---
export const wellnessApi = {
  getAll: (userId: string, patientId?: string) => {
    const url = `/wellness?userId=${userId}${patientId ? `&patientId=${patientId}` : ''}`;
    return request<WellnessLog[]>(url);
  },
  
  log: (data: Record<string, unknown>) => 
    request<WellnessLog>('/wellness', { method: 'POST', body: JSON.stringify(data) }),

  remove: (id: string) => 
    request<void>(`/wellness/${id}`, { method: 'DELETE' }),
};

// --- Vision AI ---
export const visionApi = {
  identifyPill: (data: { image: string, patientAge?: string }) =>
    request<unknown>('/vision/pill-id', { method: 'POST', body: JSON.stringify(data) }),
};

// --- Generative AI (Coaching & Holistic Safety) ---
export const aiApi = {
  getCoachAdvice: (data: { logs: DoseLog[]; medicines: Medicine[]; userName?: string }) =>
    request<{ advice: string; patterns: string[]; adherenceScore: number }>('/ai/coach', { method: 'POST', body: JSON.stringify(data) }),
  
  checkHolisticSafety: (data: { medicines: Medicine[]; lifestyleFactors: string[] }) =>
    request<unknown>('/ai/holistic-safety', { method: 'POST', body: JSON.stringify(data) }),

  getTravelAdvice: (data: { 
    medicines: Medicine[]; 
    destination: string; 
    currentCity?: string; 
    homeTimezone?: string; 
    targetTimezone?: string;
  }) =>
    request<unknown>('/ai/travel', { method: 'POST', body: JSON.stringify(data) }),

  getWellnessInsight: (data: { doseLogs: DoseLog[]; wellnessLogs: WellnessLog[]; medicines: Medicine[] }) =>
    request<unknown>('/ai/wellness-insight', { method: 'POST', body: JSON.stringify(data) }),

  checkMealSafety: (data: { medicines: Medicine[]; mealDescription: string }) =>
    request<unknown>('/ai/meal-check', { method: 'POST', body: JSON.stringify(data) }),

  getNutritionalGuidance: (data: { medicines: Medicine[] }) =>
    request<unknown>('/ai/nutritional-guidance', { method: 'POST', body: JSON.stringify(data) }),

  chat: (data: {
    messages: unknown[];
    medicines: Medicine[];
    userProfile: UserProfile | null;
    doseLogs: DoseLog[];
    reminders?: Reminder[];
    wellnessLogs?: WellnessLog[];
    patients?: Patient[];
  }) =>
    request<{
      text: string;
      source: string;
      suggestions: string[];
      action?: AIAction;
    }>('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),

  chatStream: (data: {
    messages: unknown[];
    medicines: Medicine[];
    userProfile: UserProfile | null;
    doseLogs: DoseLog[];
    reminders?: Reminder[];
    wellnessLogs?: WellnessLog[];
    patients?: Patient[];
  }) =>
    streamRequest('/ai/chat/stream', { method: 'POST', body: JSON.stringify(data) }),
};

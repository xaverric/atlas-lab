import { getUserManager } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DMS_URL = process.env.NEXT_PUBLIC_DMS_URL || 'http://localhost:4001';
const SCHEDULER_URL = process.env.NEXT_PUBLIC_SCHEDULER_URL || 'http://localhost:4002';
const NOTIFY_URL = process.env.NEXT_PUBLIC_NOTIFY_URL || 'http://localhost:4003';
const NOTES_URL = process.env.NEXT_PUBLIC_NOTES_URL || 'http://localhost:4004';
const TRACKER_URL = process.env.NEXT_PUBLIC_TRACKER_URL || 'http://localhost:4006';

const resolveBaseUrl = (path: string): string => {
  if (path.startsWith('/api/v1/files')) return DMS_URL;
  if (path.startsWith('/api/v1/dms')) return DMS_URL;
  if (path.startsWith('/api/v1/scheduler')) return SCHEDULER_URL;
  if (path.startsWith('/api/v1/notifications')) return NOTIFY_URL;
  if (path.startsWith('/api/v1/notes')) return NOTES_URL;
  if (path.startsWith('/api/v1/tracker')) return TRACKER_URL;
  return API_URL;
};

export const api = async <T = unknown>(path: string, options: RequestInit = {}): Promise<T> => {
  const um = getUserManager();
  let user;
  try {
    user = await um.getUser();
  } catch {
    user = null;
  }
  const baseUrl = resolveBaseUrl(path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (user?.access_token) {
    headers['Authorization'] = `Bearer ${user.access_token}`;
  }

  let res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (res.status === 401 && user) {
    try {
      const refreshed = await um.signinSilent();
      if (refreshed?.access_token) {
        headers['Authorization'] = `Bearer ${refreshed.access_token}`;
        res = await fetch(`${baseUrl}${path}`, { ...options, headers });
      }
    } catch {
      await um.signoutRedirect();
      throw new Error('Session expired');
    }
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }

  return res.json();
};

export const uploadFile = async <T = unknown>(path: string, formData: FormData): Promise<T> => {
  const um = getUserManager();
  let user;
  try { user = await um.getUser(); } catch { user = null; }
  const baseUrl = resolveBaseUrl(path);

  const headers: Record<string, string> = {};
  if (user?.access_token) {
    headers['Authorization'] = `Bearer ${user.access_token}`;
  }

  let res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: formData });

  if (res.status === 401 && user) {
    try {
      const refreshed = await um.signinSilent();
      if (refreshed?.access_token) {
        headers['Authorization'] = `Bearer ${refreshed.access_token}`;
        res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: formData });
      }
    } catch {
      await um.signoutRedirect();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }

  return res.json();
};

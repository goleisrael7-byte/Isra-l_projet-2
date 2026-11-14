import type { AuthUser } from '../types';

const ACCESS_KEY = 'academia_ha_access_token';
const REFRESH_KEY = 'academia_ha_refresh_token';
const USER_KEY = 'academia_ha_user';

export function getStoredSession(): {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
} {
  const accessToken = sessionStorage.getItem(ACCESS_KEY);
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);
  const rawUser = sessionStorage.getItem(USER_KEY);
  let user: AuthUser | null = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as AuthUser;
    } catch {
      user = null;
    }
  }
  return { accessToken, refreshToken, user };
}

export function saveSession(accessToken: string, refreshToken: string, user: AuthUser) {
  sessionStorage.setItem(ACCESS_KEY, accessToken);
  sessionStorage.setItem(REFRESH_KEY, refreshToken);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearSession();
        return null;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      sessionStorage.setItem(ACCESS_KEY, data.accessToken);
      sessionStorage.setItem(REFRESH_KEY, data.refreshToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem(ACCESS_KEY);
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && token) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers });
    }
  }

  if (!res.ok) {
    let message = `Erreur HTTP ${res.status}`;
    let fieldErrors: Record<string, string> | undefined;
    try {
      const errBody = (await res.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (errBody?.error) message = errBody.error;
      if (errBody?.fieldErrors) fieldErrors = errBody.fieldErrors;
    } catch {
      // ignore json parse error
    }
    throw new ApiError(message, res.status, fieldErrors);
  }

  return (await res.json()) as T;
}

export async function apiDownloadCsv(url: string, filename: string) {
  const token = sessionStorage.getItem(ACCESS_KEY);
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Erreur lors du téléchargement.');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

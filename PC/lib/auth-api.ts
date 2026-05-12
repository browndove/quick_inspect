import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExpoExtra = { apiUrl?: string };

/** FastAPI 422 uses `detail`; our handlers use `error`. */
function formatApiErrorBody(data: {
  error?: string;
  detail?: string | Array<{ msg?: string; loc?: unknown[] }>;
}): string {
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  const d = data.detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (Array.isArray(d)) {
    const parts = d
      .map((x) => (typeof x?.msg === 'string' ? x.msg : ''))
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  return 'Request failed';
}

function apiBase(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
  const fromExtra = (Constants.expoConfig?.extra as ExpoExtra | undefined)?.apiUrl?.trim() ?? '';
  const raw = (fromEnv || fromExtra).replace(/\/$/, '');
  if (!raw) return null;
  return raw;
}

async function fetchPostJson(base: string, path: string, body: unknown): Promise<Response> {
  const url = `${base}${path}`;
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  };
  try {
    return await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const transient =
      msg.includes('Network request failed') ||
      msg.includes('Failed to fetch') ||
      msg === 'Load failed';
    if (!transient) throw e;
    await new Promise((r) => setTimeout(r, 750));
    return await fetch(url, init);
  }
}

/** Physical phone (not simulator / not web). */
function isPhysicalDevice(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.isDevice === true;
}

function assertReachableBaseUrl(base: string): void {
  if (!isPhysicalDevice()) return;
  let host = '';
  try {
    const u = new URL(base.includes('://') ? base : `http://${base}`);
    host = u.hostname.toLowerCase();
  } catch {
    return;
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    throw new Error(
      'EXPO_PUBLIC_API_URL points to this phone (localhost/127.0.0.1). Use your computer’s Wi‑Fi IP instead, e.g. http://192.168.1.12:3002 — same Wi‑Fi as this device.',
    );
  }
}

function mapNetworkFailure(err: unknown, base: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const isNetFail =
    raw.includes('Network request failed') ||
    raw.includes('Failed to fetch') ||
    raw === 'Load failed' ||
    raw.includes('ECONNREFUSED');

  if (!isNetFail) return raw || 'Request failed';

  const isPublicHttps = /^https:\/\//i.test(base);
  const hint = isPublicHttps
    ? 'Check your connection, Railway/API deployment status, and that EXPO_PUBLIC_API_URL has no typo.'
    : 'Start the API from the repo root (`npm run dev:backend` for FastAPI, or `npm run dev:server` for legacy Express), use the same Wi‑Fi as this device, and put your computer’s LAN IP in EXPO_PUBLIC_API_URL (not localhost on a real phone).';
  return ['Cannot reach the API.', `Trying: ${base}`, hint].join(' ');
}

export function isApiConfigured(): boolean {
  return apiBase() !== null;
}

export function getApiErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

export async function apiLogin(email: string, password: string): Promise<{ token: string }> {
  const base = apiBase();
  if (!base) throw new Error('EXPO_PUBLIC_API_URL is not set');
  assertReachableBaseUrl(base);

  let res: Response;
  try {
    res = await fetchPostJson(base, '/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
  } catch (e) {
    throw new Error(mapNetworkFailure(e, base));
  }

  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    error?: string;
    detail?: string | Array<{ msg?: string; loc?: unknown[] }>;
  };
  if (!res.ok) {
    throw new Error(formatApiErrorBody(data));
  }
  if (typeof data.token !== 'string' || !data.token) {
    throw new Error('Invalid response from server');
  }
  return { token: data.token };
}

export async function apiSignup(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ token: string }> {
  const base = apiBase();
  if (!base) throw new Error('EXPO_PUBLIC_API_URL is not set');
  assertReachableBaseUrl(base);

  let res: Response;
  try {
    res = await fetchPostJson(base, '/auth/signup', {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
    });
  } catch (e) {
    throw new Error(mapNetworkFailure(e, base));
  }

  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    error?: string;
    detail?: string | Array<{ msg?: string; loc?: unknown[] }>;
  };
  if (!res.ok) {
    throw new Error(formatApiErrorBody(data));
  }
  if (typeof data.token !== 'string' || !data.token) {
    throw new Error('Invalid response from server');
  }
  return { token: data.token };
}

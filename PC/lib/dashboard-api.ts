import { formatApiErrorBody, getApiOrigin } from '@/lib/auth-api';

export type InspectorMe = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  phone: string | null;
  signatureUrl: string | null;
  createdAt: string | null;
};

export type FacilityRow = {
  id: string;
  name: string;
  region: string | null;
  mmda: string | null;
  created_at: string | null;
};

export type InspectionRow = {
  id: string;
  inspectorId: string;
  facilityId: string | null;
  type: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  submittedAt: string | null;
};

async function authedGet<T>(token: string, path: string): Promise<T> {
  const base = getApiOrigin();
  if (!base) throw new Error('EXPO_PUBLIC_API_URL is not set');
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
    detail?: unknown;
  };
  if (!res.ok) {
    throw new Error(`${formatApiErrorBody(data as Parameters<typeof formatApiErrorBody>[0])} [HTTP ${res.status}]`);
  }
  return data as T;
}

export async function apiGetMe(token: string): Promise<InspectorMe> {
  return authedGet<InspectorMe>(token, '/auth/me');
}

export async function apiListFacilities(token: string): Promise<FacilityRow[]> {
  const out = await authedGet<{ facilities: FacilityRow[] }>(token, '/facilities');
  return out.facilities ?? [];
}

export async function apiListInspections(token: string): Promise<InspectionRow[]> {
  const out = await authedGet<{ inspections: InspectionRow[] }>(token, '/inspections');
  return out.inspections ?? [];
}

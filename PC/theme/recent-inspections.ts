export type InspectionSiteType = 'pharmacy' | 'otcm';

export interface RecentInspectionItem {
  id: string;
  type: InspectionSiteType;
  facilityName: string;
  region: string;
  /** Display date, e.g. "8 May 2026" */
  dateLabel: string;
}

/** Demo timeline — replace with API / store. */
export const MOCK_RECENT_INSPECTIONS: RecentInspectionItem[] = [
  {
    id: '1',
    type: 'pharmacy',
    facilityName: 'Sunrise Pharmacy Ltd.',
    region: 'Greater Accra',
    dateLabel: '8 May 2026',
  },
  {
    id: '2',
    type: 'otcm',
    facilityName: 'Community Medicine Outlet',
    region: 'Ashanti',
    dateLabel: '5 May 2026',
  },
  {
    id: '3',
    type: 'pharmacy',
    facilityName: 'Harbour View Pharmacy',
    region: 'Western',
    dateLabel: '28 Apr 2026',
  },
];

export function inspectionTypeLabel(type: InspectionSiteType): string {
  return type === 'pharmacy' ? 'Pharmacy' : 'OTCM';
}

/** Map FastAPI inspection ``type`` (e.g. ``pharmacy_routine``) to dashboard pills. */
export function mapApiInspectionType(type: string): InspectionSiteType {
  const t = type.toLowerCase();
  if (t.includes('otc')) return 'otcm';
  return 'pharmacy';
}

/** e.g. ``8 May 2026`` from an ISO timestamp */
export function formatInspectionShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

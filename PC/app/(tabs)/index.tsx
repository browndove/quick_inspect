import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  useFonts,
} from '@expo-google-fonts/montserrat';

import { FrostedCard } from '@/components/frosted-card';
import { InspectionBento } from '@/components/inspection-bento';
import { useAuthSession } from '@/context/auth-session';
import { getApiErrorMessage } from '@/lib/auth-api';
import { apiLoadDashboard, type FacilityRow, type InspectionRow, type InspectorMe } from '@/lib/dashboard-api';
import { Calm } from '@/theme/calm';
import { useScaledStyles } from '@/hooks/useResponsive';
import { getTimeGreeting, inspectorInitials } from '@/theme/inspector-display';
import {
  formatInspectionShortDate,
  inspectionTypeLabel,
  mapApiInspectionType,
  type RecentInspectionItem,
} from '@/theme/recent-inspections';

function inspectorDisplayName(p: InspectorMe | null): string {
  if (!p) return 'Inspector';
  const combined = (p.fullName ?? `${p.firstName ?? ''} ${p.lastName ?? ''}`).trim();
  if (combined) return combined;
  return p.email?.trim() || 'Inspector';
}

/** First tab: Home — live summary from the FastAPI backend. */
export default function HomeTabScreen() {
  const styles = useScaledStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const { token } = useAuthSession();
  const [loaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  const [profile, setProfile] = useState<InspectorMe | null>(null);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialError, setPartialError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setProfile(null);
      setFacilities([]);
      setInspections([]);
      setLoading(false);
      setError('Not signed in');
      return;
    }
    setError(null);
    setPartialError(null);
    setLoading(true);
    try {
      const { profile: me, facilities: facs, inspections: insps, partialError: pe } = await apiLoadDashboard(token);
      setProfile(me);
      setFacilities(facs);
      setInspections(insps);
      setPartialError(pe);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setProfile(null);
      setFacilities([]);
      setInspections([]);
      setPartialError(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const { facilityLookup, recentTimeline, draftCount, monthVisitCount, lastInspection } = useMemo(() => {
    const lookup = new Map<string, { name: string; region: string | null; mmda: string | null }>();
    for (const f of facilities) {
      lookup.set(f.id, { name: f.name, region: f.region, mmda: f.mmda });
    }
    const now = new Date();
    let drafts = 0;
    let month = 0;
    for (const row of inspections) {
      if (row.status === 'draft') drafts += 1;
      if (row.createdAt) {
        const d = new Date(row.createdAt);
        if (!Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          month += 1;
        }
      }
    }
    const list: RecentInspectionItem[] = [];
    for (const row of inspections.slice(0, 8)) {
      const fid = row.facilityId;
      const fac = fid ? lookup.get(fid) : undefined;
      list.push({
        id: row.id,
        type: mapApiInspectionType(row.type),
        facilityName: fac?.name ?? (fid ? 'Linked facility' : 'No facility linked'),
        region: fac?.region?.trim() || '—',
        dateLabel: formatInspectionShortDate(row.createdAt),
      });
    }
    return {
      facilityLookup: lookup,
      recentTimeline: list,
      draftCount: drafts,
      monthVisitCount: month,
      lastInspection: inspections[0] ?? null,
    };
  }, [inspections, facilities]);

  const displayName = useMemo(() => inspectorDisplayName(profile), [profile]);
  const greetingPrefix = useMemo(() => `${getTimeGreeting()},`, []);
  const initials = useMemo(() => inspectorInitials(displayName), [displayName]);

  const lastFacility = useMemo(() => {
    const fid = lastInspection?.facilityId;
    if (!fid) return null;
    return facilityLookup.get(fid) ?? null;
  }, [lastInspection, facilityLookup]);

  if (!loaded) {
    return null;
  }

  const lastTypeUi = lastInspection ? mapApiInspectionType(lastInspection.type) : 'pharmacy';
  const lastRegionLine = lastFacility
    ? [lastFacility.region, lastFacility.mmda].filter(Boolean).join(' · ') || '—'
    : '—';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.decor} pointerEvents="none">
        <View style={styles.decorBlobA} />
        <View style={styles.decorBlobB} />
        <View style={styles.decorBlobC} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Calm.primary} />}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greetingHint}>{greetingPrefix}</Text>
            <Text style={styles.nameLine} numberOfLines={2}>
              {displayName}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconCircle}
              onPress={() => { }}
              accessibilityRole="button"
              accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={22} color={Calm.primary} />
              {draftCount > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{draftCount > 9 ? '9+' : String(draftCount)}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={styles.iconCircle}
              onPress={() => router.push('/(tabs)/explore')}
              accessibilityRole="button"
              accessibilityLabel="Account and more">
              <Text style={styles.initialsText}>{initials}</Text>
            </Pressable>
          </View>
        </View>

        {loading && !profile ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Calm.primary} />
            <Text style={styles.loadingText}>Loading your dashboard…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={18} color="#b71c1c" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()} hitSlop={8} style={styles.retryHit}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!error && partialError ? (
          <View style={styles.warnBanner}>
            <Ionicons name="information-circle-outline" size={18} color={Calm.primary} />
            <Text style={styles.warnText}>{partialError}</Text>
            <Pressable onPress={() => void load()} hitSlop={8} style={styles.retryHit}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {draftCount > 0
              ? `${draftCount} draft report${draftCount === 1 ? '' : 's'}`
              : inspections.length > 0
                ? `${inspections.length} inspection${inspections.length === 1 ? '' : 's'} on file`
                : 'No inspections yet'}
          </Text>
        </View>

        <Text style={styles.subtitle}>
          {inspections.length === 0
            ? 'Start a routine visit when you are on site. Pull down to refresh after saving on the server.'
            : 'Pull down to refresh. Inspection types below open your paper-style workflows.'}
        </Text>

        <InspectionBento />

        <FrostedCard style={styles.statsCard}>
          <View style={styles.statsInner}>
            <Image
              source={require('@/assets/images/pharmacy-council-logo.png')}
              style={styles.statsWatermark}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.statsSectionLabel}>Inspection activity</Text>
            <View style={styles.statsBlock}>
              <Text style={styles.statsMeta}>Last inspection</Text>
              <View style={styles.statsTypeRow}>
                <View
                  style={[
                    styles.typePill,
                    lastTypeUi === 'pharmacy' ? styles.typePillPharmacy : styles.typePillOtcm,
                  ]}>
                  <Text
                    style={
                      lastTypeUi === 'pharmacy' ? styles.typePillTextPharmacy : styles.typePillTextOtcm
                    }>
                    {lastInspection ? inspectionTypeLabel(lastTypeUi) : '—'}
                  </Text>
                </View>
              </View>
              <Text style={styles.statsHighlight}>
                {lastInspection ? formatInspectionShortDate(lastInspection.createdAt) : '—'}
              </Text>
              <Text style={styles.statsFacility}>
                {lastFacility?.name ?? (lastInspection ? 'No facility linked' : 'No data yet')}
              </Text>
              <Text style={styles.statsRegion}>{lastRegionLine}</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsRow}>
              <View style={styles.statsRowItem}>
                <Text style={styles.statsMeta}>Visits this month</Text>
                <Text style={styles.statsRowValue}>{monthVisitCount}</Text>
              </View>
              <View style={styles.statsRowSep} />
              <View style={styles.statsRowItem}>
                <Text style={styles.statsMeta}>Draft reports</Text>
                <Text style={styles.statsRowValue}>{draftCount}</Text>
              </View>
            </View>
          </View>
        </FrostedCard>

        <FrostedCard style={styles.recentCard}>
          <View style={styles.recentInner}>
            <Text style={styles.recentTitle}>Recent inspections</Text>
            <Text style={styles.recentSubtitle}>Newest first · from your account on the server</Text>

            <View style={styles.timeline}>
              {recentTimeline.length === 0 ? (
                <Text style={styles.emptyList}>No inspections yet. They will appear here after you create them on the server.</Text>
              ) : (
                recentTimeline.map((item, index) => {
                  const isLast = index === recentTimeline.length - 1;
                  return (
                    <View key={item.id} style={styles.timelineRow}>
                      <View style={styles.rail}>
                        <View style={styles.storyRing}>
                          <View style={styles.storyDot} />
                        </View>
                        {!isLast ? <View style={styles.spine} /> : null}
                      </View>
                      <View style={styles.storyBubble}>
                        <View style={styles.storyTop}>
                          <View
                            style={[
                              styles.typePill,
                              item.type === 'pharmacy' ? styles.typePillPharmacy : styles.typePillOtcm,
                            ]}>
                            <Text
                              style={
                                item.type === 'pharmacy'
                                  ? styles.typePillTextPharmacy
                                  : styles.typePillTextOtcm
                              }>
                              {inspectionTypeLabel(item.type)}
                            </Text>
                          </View>
                          <Text style={styles.storyDate}>{item.dateLabel}</Text>
                        </View>
                        <Text style={styles.storyFacility}>{item.facilityName}</Text>
                        <Text style={styles.storyRegion}>{item.region}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </FrostedCard>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef2f8',
  },
  decor: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  decorBlobA: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Calm.primarySoft,
    opacity: 0.09,
    top: -80,
    right: -100,
  },
  decorBlobB: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Calm.primary,
    opacity: 0.05,
    top: 240,
    left: -90,
  },
  decorBlobC: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Calm.primarySoft,
    opacity: 0.07,
    bottom: -120,
    right: -80,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'stretch',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 14,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_400Regular',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(183, 28, 28, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(183, 28, 28, 0.2)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#b71c1c',
    fontFamily: 'Montserrat_400Regular',
  },
  retryHit: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: Calm.primary,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
  },
  warnText: {
    flex: 1,
    fontSize: 12,
    color: Calm.text,
    fontFamily: 'Montserrat_400Regular',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  greetingHint: {
    fontSize: 14,
    lineHeight: 20,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_400Regular',
  },
  nameLine: {
    marginTop: 4,
    fontSize: 22,
    lineHeight: 28,
    color: Calm.primary,
    fontFamily: 'Montserrat_700Bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  initialsText: {
    fontSize: 15,
    fontFamily: 'Montserrat_700Bold',
    color: Calm.primary,
    letterSpacing: 0.5,
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Montserrat_600SemiBold',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Calm.primarySoft,
    opacity: 0.85,
  },
  statusText: {
    fontSize: 14,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_500Medium',
  },
  subtitle: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 22,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_400Regular',
    textAlign: 'left',
  },
  statsCard: {
    marginTop: 22,
  },
  statsInner: {
    padding: 20,
    paddingBottom: 22,
    position: 'relative',
    overflow: 'hidden',
  },
  statsWatermark: {
    position: 'absolute',
    width: 148,
    height: 148,
    right: -28,
    bottom: -32,
    opacity: 0.08,
    zIndex: 0,
  },
  statsSectionLabel: {
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Calm.textSubtle,
    fontFamily: 'Montserrat_600SemiBold',
    marginBottom: 14,
    zIndex: 1,
  },
  statsBlock: {
    gap: 4,
    zIndex: 1,
  },
  statsTypeRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 2,
  },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typePillPharmacy: {
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
  },
  typePillOtcm: {
    backgroundColor: 'rgba(12, 45, 92, 0.1)',
  },
  typePillTextPharmacy: {
    fontSize: 11,
    fontFamily: 'Montserrat_700Bold',
    color: Calm.primarySoft,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  typePillTextOtcm: {
    fontSize: 11,
    fontFamily: 'Montserrat_700Bold',
    color: Calm.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statsMeta: {
    fontSize: 13,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_400Regular',
  },
  statsHighlight: {
    fontSize: 18,
    lineHeight: 24,
    color: Calm.primary,
    fontFamily: 'Montserrat_700Bold',
    marginTop: 2,
  },
  statsFacility: {
    fontSize: 14,
    color: Calm.text,
    fontFamily: 'Montserrat_600SemiBold',
    marginTop: 8,
  },
  statsRegion: {
    fontSize: 13,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_400Regular',
    marginTop: 2,
  },
  statsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(12, 45, 92, 0.1)',
    marginVertical: 16,
    zIndex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    zIndex: 1,
  },
  statsRowItem: {
    flex: 1,
    gap: 4,
  },
  statsRowSep: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(12, 45, 92, 0.1)',
    marginHorizontal: 16,
  },
  statsRowValue: {
    fontSize: 20,
    color: Calm.primary,
    fontFamily: 'Montserrat_700Bold',
  },
  recentCard: {
    marginTop: 16,
  },
  recentInner: {
    padding: 20,
    paddingBottom: 22,
  },
  recentTitle: {
    fontSize: 17,
    color: Calm.primary,
    fontFamily: 'Montserrat_700Bold',
  },
  recentSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_400Regular',
  },
  emptyList: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_400Regular',
  },
  timeline: {
    marginTop: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rail: {
    width: 36,
    alignItems: 'center',
  },
  storyRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Calm.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      default: {},
    }),
  },
  storyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Calm.primarySoft,
  },
  spine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    marginTop: 4,
    backgroundColor: 'rgba(12, 45, 92, 0.12)',
    borderRadius: 1,
  },
  storyBubble: {
    flex: 1,
    marginLeft: 4,
    marginBottom: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  storyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  storyDate: {
    fontSize: 12,
    color: Calm.textSubtle,
    fontFamily: 'Montserrat_500Medium',
  },
  storyFacility: {
    marginTop: 8,
    fontSize: 15,
    color: Calm.text,
    fontFamily: 'Montserrat_600SemiBold',
  },
  storyRegion: {
    marginTop: 2,
    fontSize: 13,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_400Regular',
  },
});

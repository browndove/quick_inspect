import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Montserrat_400Regular,
  Montserrat_600SemiBold,
  useFonts,
} from '@expo-google-fonts/montserrat';

import { useAuthSession } from '@/context/auth-session';
import { Calm } from '@/theme/calm';

/** Second tab — account shortcuts (Home tab stays the dashboard). */
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthSession();
  const [loaded] = useFonts({ Montserrat_400Regular, Montserrat_600SemiBold });

  if (!loaded) return null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.sub}>Account and app shortcuts will live here.</Text>

        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={async () => {
            await signOut();
            router.replace('/login');
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={22} color={Calm.primary} />
          <Text style={styles.rowLabel}>Sign out</Text>
          <Ionicons name="chevron-forward" size={20} color={Calm.textSubtle} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef2f8',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Montserrat_600SemiBold',
    color: Calm.primary,
  },
  sub: {
    marginTop: 8,
    fontSize: 15,
    color: Calm.textMuted,
    fontFamily: 'Montserrat_400Regular',
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8ECF2',
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_600SemiBold',
    color: Calm.text,
  },
});

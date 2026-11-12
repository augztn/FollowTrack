import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { compareRelationships } from './src/domain/compare';
import type { RelationshipSnapshot, RelationshipTab } from './src/domain/types';
import { pickInstagramExport } from './src/features/import/readInstagramZip';

const TABS: { id: RelationshipTab; label: string; description: string }[] = [
  { id: 'not-following-back', label: 'Not following back', description: 'You follow them' },
  { id: 'not-followed-back', label: 'You don’t follow back', description: 'They follow you' },
  { id: 'mutual', label: 'Mutual', description: 'You follow each other' },
];

export default function App() {
  const [snapshot, setSnapshot] = useState<RelationshipSnapshot | null>(null);
  const [tab, setTab] = useState<RelationshipTab>('not-following-back');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => snapshot ? compareRelationships(snapshot) : null, [snapshot]);
  const rows = useMemo(() => {
    if (!summary) return [];
    const source = tab === 'not-following-back'
      ? summary.notFollowingBack
      : tab === 'not-followed-back' ? summary.notFollowedBack : summary.mutual;
    const normalizedQuery = query.trim().replace(/^@/, '').toLocaleLowerCase('en-US');
    return source.filter((name) => name.toLocaleLowerCase('en-US').includes(normalizedQuery));
  }, [summary, tab, query]);

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const next = await pickInstagramExport();
      if (next) {
        setSnapshot(next);
        setQuery('');
        setTab('not-following-back');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed. Please try another export.');
    } finally {
      setBusy(false);
    }
  }

  const activeTab = TABS.find((item) => item.id === tab);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>PRIVATE BY DESIGN</Text>
            <Text style={styles.title}>FollowTrack</Text>
            <Text style={styles.subtitle}>Your audience, clearly understood.</Text>
          </View>
          <View style={styles.logo}><Text style={styles.logoText}>FT</Text></View>
        </View>

        {!summary ? (
          <View style={styles.emptyCard}>
            <View style={styles.iconCircle}><Text style={styles.importIcon}>↥</Text></View>
            <Text style={styles.cardTitle}>Start with your Instagram export</Text>
            <Text style={styles.body}>Import your official Followers and following ZIP. Everything is analysed on this device.</Text>
            <Pressable accessibilityRole="button" disabled={busy} onPress={handleImport} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color="#07110E" /> : <Text style={styles.primaryButtonText}>Import Instagram ZIP</Text>}
            </Pressable>
            <Text style={styles.privacyNote}>No password · No scraping · No uploads</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Stat label="FOLLOWERS" value={summary.followersCount} />
              <Stat label="FOLLOWING" value={summary.followingCount} />
              <Stat label="NOT FOLLOWING" value={summary.notFollowingBack.length} accent />
            </View>
            <View style={styles.listCard}>
              <Text style={styles.sectionTitle}>Relationship breakdown</Text>
              <View style={styles.tabRow}>
                {TABS.map((item) => {
                  const selected = tab === item.id;
                  const count = item.id === 'not-following-back' ? summary.notFollowingBack.length
                    : item.id === 'not-followed-back' ? summary.notFollowedBack.length : summary.mutual.length;
                  return (
                    <Pressable key={item.id} onPress={() => { setTab(item.id); setQuery(''); }} style={[styles.tab, selected && styles.selectedTab]}>
                      <Text numberOfLines={2} style={[styles.tabLabel, selected && styles.selectedTabLabel]}>{item.label}</Text>
                      <Text style={[styles.tabCount, selected && styles.selectedTabLabel]}>{count.toLocaleString()}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                accessibilityLabel="Search usernames"
                value={query}
                onChangeText={setQuery}
                placeholder="Search username"
                placeholderTextColor="#718078"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.search}
              />
              <View style={styles.listHeading}>
                <Text style={styles.listHeadingText}>{activeTab?.description ?? 'Accounts'}</Text>
                <Text style={styles.listHeadingText}>{rows.length.toLocaleString()} RESULTS</Text>
              </View>
              <FlatList
                data={rows}
                keyExtractor={(item) => item.toLocaleLowerCase('en-US')}
                keyboardShouldPersistTaps="handled"
                style={styles.results}
                contentContainerStyle={rows.length === 0 ? styles.noResults : undefined}
                ListEmptyComponent={<Text style={styles.emptyText}>No accounts in this view.</Text>}
                renderItem={({ item, index }) => (
                  <View style={styles.userRow}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{item.slice(0, 1).toUpperCase()}</Text></View>
                    <Text style={styles.username}>@{item}</Text>
                    <Text style={styles.rowNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                )}
              />
              <Pressable accessibilityRole="button" onPress={handleImport} disabled={busy} style={styles.secondaryButton}>
                {busy ? <ActivityIndicator color="#B9F5D4" /> : <Text style={styles.secondaryButtonText}>Import a newer export</Text>}
              </Pressable>
            </View>
            <Text style={styles.snapshotText}>Snapshot imported {new Date(snapshot.importedAt).toLocaleString()}</Text>
          </>
        )}

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.footer}>FollowTrack is independent and not affiliated with Instagram or Meta.</Text>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && styles.statAccent]}>{value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08110E' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  eyebrow: { color: '#91B4A3', fontSize: 10, fontWeight: '800', letterSpacing: 2.2, marginBottom: 7 },
  title: { color: '#F3F8F5', fontSize: 30, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: '#94A69C', fontSize: 13, marginTop: 4 },
  logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#B9F5D4', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#08110E', fontSize: 17, fontWeight: '900', letterSpacing: -1 },
  emptyCard: { flex: 1, maxHeight: 440, backgroundColor: '#111D18', borderRadius: 26, padding: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#23372D' },
  iconCircle: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#1B3328', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  importIcon: { color: '#B9F5D4', fontSize: 34, fontWeight: '300' },
  cardTitle: { color: '#F3F8F5', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  body: { color: '#9EADA5', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  primaryButton: { backgroundColor: '#B9F5D4', borderRadius: 15, paddingVertical: 16, paddingHorizontal: 22, width: '100%', alignItems: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
  primaryButtonText: { color: '#08110E', fontWeight: '800', fontSize: 15 },
  privacyNote: { color: '#8CA296', fontSize: 11, marginTop: 18, letterSpacing: 0.3 },
  statsRow: { flexDirection: 'row', gap: 9, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#111D18', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#23372D' },
  statLabel: { color: '#8FA398', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { color: '#F3F8F5', fontSize: 23, fontWeight: '800', marginTop: 7 },
  statAccent: { color: '#B9F5D4' },
  listCard: { flex: 1, minHeight: 240, backgroundColor: '#111D18', borderRadius: 22, padding: 15, borderWidth: 1, borderColor: '#23372D' },
  sectionTitle: { color: '#F3F8F5', fontSize: 17, fontWeight: '800', marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, minHeight: 68, borderRadius: 12, padding: 8, backgroundColor: '#17251E', justifyContent: 'space-between' },
  selectedTab: { backgroundColor: '#254536', borderWidth: 1, borderColor: '#4A8D6C' },
  tabLabel: { color: '#A7B8AE', fontSize: 9, fontWeight: '700', lineHeight: 13 },
  selectedTabLabel: { color: '#C8F7DE' },
  tabCount: { color: '#F3F8F5', fontSize: 17, fontWeight: '800', marginTop: 5 },
  search: { backgroundColor: '#0B1510', borderRadius: 12, borderWidth: 1, borderColor: '#2B4035', paddingHorizontal: 14, paddingVertical: 12, color: '#F3F8F5', marginTop: 14, fontSize: 14 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  listHeadingText: { color: '#82998C', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  results: { flex: 1 },
  noResults: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#91A399', fontSize: 13 },
  userRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#22332A', gap: 11 },
  avatar: { width: 32, height: 32, borderRadius: 12, backgroundColor: '#263D30', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#B9F5D4', fontSize: 13, fontWeight: '800' },
  username: { color: '#E8F0EB', fontSize: 14, fontWeight: '600', flex: 1 },
  rowNumber: { color: '#61776A', fontSize: 10, fontVariant: ['tabular-nums'] },
  secondaryButton: { marginTop: 12, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#426B55', alignItems: 'center' },
  secondaryButtonText: { color: '#B9F5D4', fontSize: 13, fontWeight: '700' },
  snapshotText: { color: '#71867A', textAlign: 'center', fontSize: 10, marginTop: 10 },
  error: { color: '#FF9B9B', fontSize: 12, marginTop: 12, lineHeight: 18 },
  footer: { color: '#61756A', fontSize: 10, textAlign: 'center', marginTop: 14, lineHeight: 15 },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { compareRelationships } from './src/domain/compare';
import { buildHistoricalInsights } from './src/domain/history';
import type { AccountProfile, RelationshipSnapshot, RelationshipTab } from './src/domain/types';
import { pickInstagramExport } from './src/features/import/readInstagramZip';
import { loadProfiles, saveProfiles } from './src/features/accounts/profileStorage';

const TABS: { id: RelationshipTab; label: string; description: string }[] = [
  { id: 'not-following-back', label: 'Not following back', description: 'You follow them, they do not follow you' },
  { id: 'not-followed-back', label: 'Not followed back', description: 'They follow you, you do not follow them' },
  { id: 'mutual', label: 'Mutual', description: 'You follow each other' },
  { id: 'pending-requests', label: 'Pending requests', description: 'Follow requests you have sent' },
  { id: 'unfollowers', label: 'Unfollowers', description: 'Followers missing from the previous import' },
  { id: 'blocked', label: 'Blocked', description: 'Accounts listed as blocked in your export' },
  { id: 'oldest-followers', label: 'Oldest followers', description: 'Earliest follower records with available dates' },
];

type Row = { username: string; timestamp?: number | null };

export default function App() {
  const [profiles, setProfiles] = useState<AccountProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [tab, setTab] = useState<RelationshipTab>('not-following-back');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadProfiles()
      .then((saved) => {
        if (!mounted) return;
        setProfiles(saved);
        setActiveId(saved[0]?.id ?? null);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : 'Could not load saved profiles.');
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => { mounted = false; };
  }, []);

  const activeProfile = profiles.find((profile) => profile.id === activeId) ?? null;
  const snapshots = activeProfile?.snapshots ?? [];
  const current = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : undefined;
  const summary = useMemo(() => current ? compareRelationships(current) : null, [current]);
  const insights = useMemo(
    () => current ? buildHistoricalInsights(current, previous) : null,
    [current, previous],
  );

  const rows = useMemo<Row[]>(() => {
    if (!current || !summary || !insights) return [];
    let source: Row[];
    switch (tab) {
      case 'not-following-back':
        source = summary.notFollowingBack.map((username) => ({ username }));
        break;
      case 'not-followed-back':
        source = summary.notFollowedBack.map((username) => ({ username }));
        break;
      case 'mutual':
        source = summary.mutual.map((username) => ({ username }));
        break;
      case 'pending-requests':
        source = insights.pendingFollowRequests.map((username) => ({ username }));
        break;
      case 'unfollowers':
        source = insights.unfollowers.map((username) => ({ username }));
        break;
      case 'blocked':
        source = insights.blockedAccounts.map((username) => ({ username }));
        break;
      case 'oldest-followers':
        source = insights.oldestFollowers.map((item) => ({ username: item.username, timestamp: item.timestamp }));
        break;
    }
    const normalizedQuery = query.trim().replace(/^@/, '').toLocaleLowerCase('en-US');
    return source.filter((item) => item.username.toLocaleLowerCase('en-US').includes(normalizedQuery));
  }, [current, summary, insights, tab, query]);

  async function persist(next: AccountProfile[]) {
    await saveProfiles(next);
    setProfiles(next);
  }

  async function createProfile() {
    const name = profileName.trim();
    const username = profileUsername.trim().replace(/^@/, '');
    if (!name) {
      setError('Enter a profile name first.');
      return;
    }
    const profile: AccountProfile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      username,
      createdAt: new Date().toISOString(),
      snapshots: [],
    };
    setBusy(true);
    setError(null);
    try {
      await persist([...profiles, profile]);
      setActiveId(profile.id);
      setProfileName('');
      setProfileUsername('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this profile.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!activeProfile) {
      setError('Create or select a profile before importing data.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await pickInstagramExport();
      if (!next) return;
      const updated = profiles.map((profile) => profile.id === activeProfile.id
        ? { ...profile, snapshots: [...profile.snapshots, next] }
        : profile);
      await persist(updated);
      setQuery('');
      setTab('not-following-back');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed. Please try another export.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteProfile(profile: AccountProfile) {
    Alert.alert(
      'Delete profile?',
      `This permanently removes ${profile.name} and its local import history from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const next = profiles.filter((item) => item.id !== profile.id);
            persist(next)
              .then(() => setActiveId(next[0]?.id ?? null))
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not delete profile.'));
          },
        },
      ],
    );
  }

  const activeTab = TABS.find((item) => item.id === tab);
  const countFor = (id: RelationshipTab): number => {
    if (!summary || !insights) return 0;
    switch (id) {
      case 'not-following-back': return summary.notFollowingBack.length;
      case 'not-followed-back': return summary.notFollowedBack.length;
      case 'mutual': return summary.mutual.length;
      case 'pending-requests': return insights.pendingFollowRequests.length;
      case 'unfollowers': return insights.unfollowers.length;
      case 'blocked': return insights.blockedAccounts.length;
      case 'oldest-followers': return insights.oldestFollowers.length;
    }
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loading}><ActivityIndicator color="#B9F5D4" /><Text style={styles.muted}>Loading local profiles…</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>PRIVATE BY DESIGN</Text>
            <Text style={styles.title}>FollowTrack</Text>
            <Text style={styles.subtitle}>Understand every connection.</Text>
          </View>
          <View style={styles.logo}><Text style={styles.logoText}>FT</Text></View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your profiles</Text>
          <Text style={styles.muted}>{profiles.length} saved</Text>
        </View>
        {profiles.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profileScroller}>
            {profiles.map((profile) => (
              <Pressable
                key={profile.id}
                onPress={() => { setActiveId(profile.id); setTab('not-following-back'); setQuery(''); setError(null); }}
                onLongPress={() => confirmDeleteProfile(profile)}
                style={[styles.profileChip, profile.id === activeId && styles.profileChipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${profile.name}; long press to delete`}
              >
                <Text style={[styles.profileChipName, profile.id === activeId && styles.activeText]}>{profile.name}</Text>
                {profile.username ? <Text style={styles.profileChipUsername}>@{profile.username}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.createCard}>
          <Text style={styles.cardTitle}>{profiles.length ? 'Add another profile' : 'Create your first profile'}</Text>
          <View style={styles.formRow}>
            <TextInput value={profileName} onChangeText={setProfileName} placeholder="Profile name" placeholderTextColor="#718078" style={[styles.search, styles.formInput]} maxLength={40} />
            <TextInput value={profileUsername} onChangeText={setProfileUsername} placeholder="Username (optional)" placeholderTextColor="#718078" autoCapitalize="none" autoCorrect={false} style={[styles.search, styles.formInput]} maxLength={30} />
          </View>
          <Pressable accessibilityRole="button" onPress={createProfile} disabled={busy} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>+ Add profile</Text>
          </Pressable>
        </View>

        {!activeProfile ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Keep each account separate</Text>
            <Text style={styles.body}>Create a profile, then import its official data export. Profiles and history stay on this device.</Text>
          </View>
        ) : !current ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Import your account data</Text>
            <Text style={styles.body}>Import the JSON ZIP export for {activeProfile.name}. FollowTrack analyses it locally and stores a snapshot for future comparisons.</Text>
            <Pressable accessibilityRole="button" disabled={busy} onPress={handleImport} style={[styles.primaryButton, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color="#07110E" /> : <Text style={styles.primaryButtonText}>Import data ZIP</Text>}
            </Pressable>
            <Text style={styles.privacyNote}>No password · No scraping · No uploads</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Stat label="FOLLOWERS" value={summary?.followersCount ?? 0} />
              <Stat label="FOLLOWING" value={summary?.followingCount ?? 0} />
              <Stat label="NOT FOLLOWING" value={summary?.notFollowingBack.length ?? 0} accent />
            </View>
            <View style={styles.listCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Insights</Text>
                <Text style={styles.muted}>{snapshots.length} imports</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroller}>
                {TABS.map((item) => {
                  const selected = tab === item.id;
                  return (
                    <Pressable key={item.id} onPress={() => { setTab(item.id); setQuery(''); }} style={[styles.tab, selected && styles.selectedTab]}>
                      <Text style={[styles.tabLabel, selected && styles.selectedTabLabel]}>{item.label}</Text>
                      <Text style={[styles.tabCount, selected && styles.selectedTabLabel]}>{countFor(item.id).toLocaleString()}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <TextInput
                accessibilityLabel="Search accounts"
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
                keyExtractor={(item) => item.username.toLocaleLowerCase('en-US')}
                keyboardShouldPersistTaps="handled"
                style={styles.results}
                contentContainerStyle={rows.length === 0 ? styles.noResults : undefined}
                ListEmptyComponent={<Text style={styles.emptyText}>{tab === 'unfollowers' && !insights?.hasPreviousSnapshot ? 'Import again later to compare follower changes.' : 'No accounts in this view.'}</Text>}
                renderItem={({ item, index }) => (
                  <View style={styles.userRow}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{item.username.slice(0, 1).toUpperCase()}</Text></View>
                    <Text style={styles.username}>@{item.username}</Text>
                    {item.timestamp !== undefined && item.timestamp !== null
                      ? <Text style={styles.rowDate}>{new Date(item.timestamp * 1000).toLocaleDateString()}</Text>
                      : <Text style={styles.rowNumber}>{String(index + 1).padStart(2, '0')}</Text>}
                  </View>
                )}
              />
              <Pressable accessibilityRole="button" onPress={handleImport} disabled={busy} style={styles.secondaryButton}>
                {busy ? <ActivityIndicator color="#B9F5D4" /> : <Text style={styles.secondaryButtonText}>Import newer snapshot</Text>}
              </Pressable>
              <Text style={styles.snapshotText}>Latest import: {new Date(current.importedAt).toLocaleString()}</Text>
              <View style={styles.historyStrip}>
                <Text style={styles.listHeadingText}>IMPORT HISTORY</Text>
                {snapshots.slice(-5).reverse().map((snapshot, index) => (
                  <Text key={snapshot.importedAt + index} style={styles.historyText}>{new Date(snapshot.importedAt).toLocaleString()}</Text>
                ))}
              </View>
            </View>
          </>
        )}

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.footer}>All analysis is local. FollowTrack is independent and not affiliated with Instagram or Meta.</Text>
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
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  eyebrow: { color: '#91B4A3', fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  title: { color: '#F3F8F5', fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: '#94A69C', fontSize: 12, marginTop: 2 },
  logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#B9F5D4', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#08110E', fontSize: 16, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: '#F3F8F5', fontSize: 15, fontWeight: '800' },
  muted: { color: '#81958A', fontSize: 10 },
  profileScroller: { maxHeight: 58, marginBottom: 10 },
  profileChip: { backgroundColor: '#111D18', borderColor: '#263B30', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, marginRight: 7, minWidth: 95 },
  profileChipActive: { backgroundColor: '#254536', borderColor: '#4A8D6C' },
  profileChipName: { color: '#E3ECE6', fontSize: 11, fontWeight: '800' },
  profileChipUsername: { color: '#92A79B', fontSize: 9, marginTop: 2 },
  activeText: { color: '#C8F7DE' },
  createCard: { backgroundColor: '#111D18', borderRadius: 15, padding: 11, borderWidth: 1, borderColor: '#23372D', marginBottom: 10 },
  cardTitle: { color: '#F3F8F5', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  formRow: { flexDirection: 'row', gap: 7 },
  formInput: { flex: 1, marginTop: 0, paddingHorizontal: 9, paddingVertical: 10, fontSize: 11 },
  emptyCard: { flex: 1, maxHeight: 260, backgroundColor: '#111D18', borderRadius: 20, padding: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#23372D', marginTop: 8 },
  body: { color: '#9EADA5', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 18 },
  primaryButton: { backgroundColor: '#B9F5D4', borderRadius: 13, paddingVertical: 14, paddingHorizontal: 20, width: '100%', alignItems: 'center' },
  primaryButtonText: { color: '#08110E', fontWeight: '800', fontSize: 14 },
  privacyNote: { color: '#8CA296', fontSize: 10, marginTop: 14 },
  statsRow: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  statCard: { flex: 1, backgroundColor: '#111D18', borderRadius: 13, padding: 10, borderWidth: 1, borderColor: '#23372D' },
  statLabel: { color: '#8FA398', fontSize: 7, fontWeight: '800', letterSpacing: 0.5 },
  statValue: { color: '#F3F8F5', fontSize: 21, fontWeight: '800', marginTop: 5 },
  statAccent: { color: '#B9F5D4' },
  listCard: { flex: 1, minHeight: 200, backgroundColor: '#111D18', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: '#23372D' },
  tabsScroller: { maxHeight: 66, marginBottom: 8 },
  tab: { minWidth: 104, borderRadius: 10, padding: 8, marginRight: 6, backgroundColor: '#17251E', justifyContent: 'space-between' },
  selectedTab: { backgroundColor: '#254536', borderWidth: 1, borderColor: '#4A8D6C' },
  tabLabel: { color: '#A7B8AE', fontSize: 9, fontWeight: '700' },
  selectedTabLabel: { color: '#C8F7DE' },
  tabCount: { color: '#F3F8F5', fontSize: 15, fontWeight: '800', marginTop: 4 },
  search: { backgroundColor: '#0B1510', borderRadius: 10, borderWidth: 1, borderColor: '#2B4035', paddingHorizontal: 12, paddingVertical: 10, color: '#F3F8F5', marginTop: 8, fontSize: 13 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  listHeadingText: { color: '#82998C', fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  results: { flex: 1 },
  noResults: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#91A399', fontSize: 12, textAlign: 'center', padding: 14 },
  userRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#22332A', gap: 9 },
  avatar: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#263D30', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#B9F5D4', fontSize: 12, fontWeight: '800' },
  username: { color: '#E8F0EB', fontSize: 12, fontWeight: '600', flex: 1 },
  rowNumber: { color: '#61776A', fontSize: 9, fontVariant: ['tabular-nums'] },
  rowDate: { color: '#8FA398', fontSize: 9 },
  secondaryButton: { marginTop: 8, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#426B55', alignItems: 'center' },
  secondaryButtonText: { color: '#B9F5D4', fontSize: 11, fontWeight: '700' },
  snapshotText: { color: '#71867A', textAlign: 'center', fontSize: 9, marginTop: 7 },
  historyStrip: { borderTopWidth: 1, borderTopColor: '#24372D', marginTop: 7, paddingTop: 6 },
  historyText: { color: '#82998C', fontSize: 8, marginTop: 3 },
  error: { color: '#FF9B9B', fontSize: 11, marginTop: 8, lineHeight: 16 },
  footer: { color: '#61756A', fontSize: 8, textAlign: 'center', marginTop: 8, lineHeight: 12 },
  disabled: { opacity: 0.6 },
});

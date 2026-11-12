import type { HistoricalInsights, RelationshipSnapshot, TimestampedAccount } from './types';

function normalize(username: string): string {
  return username.trim().replace(/^@/, '').toLocaleLowerCase('en-US');
}

function unique(values: readonly string[]): string[] {
  const result = new Map<string, string>();
  for (const value of values) {
    const clean = value.trim().replace(/^@/, '');
    const key = normalize(clean);
    if (key && !result.has(key)) result.set(key, clean);
  }
  return [...result.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function buildHistoricalInsights(
  current: RelationshipSnapshot,
  previous?: RelationshipSnapshot,
): HistoricalInsights {
  const currentFollowers = new Set(current.followers.map(normalize));
  const unfollowers = previous
    ? unique(previous.followers.filter((name) => !currentFollowers.has(normalize(name))))
    : [];

  const followerRecords: TimestampedAccount[] = current.followerRecords?.length
    ? current.followerRecords
    : current.followers.map((username) => ({ username, timestamp: null }));

  const oldestFollowers = [...followerRecords]
    .filter((record) => record.timestamp !== null && Number.isFinite(record.timestamp))
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  return {
    unfollowers,
    blockedAccounts: unique(current.blockedAccounts ?? []),
    oldestFollowers,
    pendingFollowRequests: unique(current.pendingFollowRequests ?? []),
    hasPreviousSnapshot: Boolean(previous),
  };
}

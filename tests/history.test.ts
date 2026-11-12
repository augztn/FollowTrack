import { describe, expect, it } from 'vitest';
import { buildHistoricalInsights } from '../src/domain/history';
import type { RelationshipSnapshot } from '../src/domain/types';

const snapshot: RelationshipSnapshot = {
  followers: ['alice', 'carol'],
  following: ['alice', 'bob'],
  importedAt: '2026-11-12T00:00:00.000Z',
  sourceTimestamp: null,
  pendingFollowRequests: ['dave'],
  blockedAccounts: ['eve'],
  followerRecords: [
    { username: 'carol', timestamp: 1700000200 },
    { username: 'alice', timestamp: 1600000000 },
  ],
};

describe('buildHistoricalInsights', () => {
  it('detects followers missing from the next snapshot', () => {
    const previous: RelationshipSnapshot = {
      ...snapshot,
      followers: ['alice', 'bob', 'zoe'],
    };
    const result = buildHistoricalInsights(snapshot, previous);
    expect(result.unfollowers).toEqual(['bob', 'zoe']);
    expect(result.hasPreviousSnapshot).toBe(true);
  });

  it('sorts dated followers oldest first and returns pending and blocked accounts', () => {
    const result = buildHistoricalInsights(snapshot);
    expect(result.oldestFollowers.map((item) => item.username)).toEqual(['alice', 'carol']);
    expect(result.pendingFollowRequests).toEqual(['dave']);
    expect(result.blockedAccounts).toEqual(['eve']);
    expect(result.hasPreviousSnapshot).toBe(false);
  });

  it('does not infer unfollowers from a single snapshot', () => {
    expect(buildHistoricalInsights(snapshot).unfollowers).toEqual([]);
  });
});

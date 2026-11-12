import { describe, expect, it } from 'vitest';
import { compareRelationships } from '../src/domain/compare';
import type { RelationshipSnapshot } from '../src/domain/types';

const snapshot: RelationshipSnapshot = {
  followers: ['alice', 'Bob', 'alice'],
  following: ['Alice', 'carol', '@dave'],
  importedAt: '2026-01-01T00:00:00.000Z',
  sourceTimestamp: null,
};

describe('compareRelationships', () => {
  it('computes both one-way relationships and mutuals case-insensitively', () => {
    const result = compareRelationships(snapshot);
    expect(result.followersCount).toBe(2);
    expect(result.followingCount).toBe(3);
    expect(result.notFollowingBack).toEqual(['carol', 'dave']);
    expect(result.notFollowedBack).toEqual(['Bob']);
    expect(result.mutual).toEqual(['Alice']);
  });

  it('handles empty inputs', () => {
    const result = compareRelationships({ ...snapshot, followers: [], following: [] });
    expect(result.notFollowingBack).toEqual([]);
    expect(result.notFollowedBack).toEqual([]);
    expect(result.mutual).toEqual([]);
  });
});

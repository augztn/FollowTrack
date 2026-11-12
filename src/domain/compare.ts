import type { RelationshipSummary, RelationshipSnapshot } from './types';

function uniqueNormalized(values: readonly string[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of values) {
    const username = raw.trim().replace(/^@/, '');
    const key = username.toLocaleLowerCase('en-US');
    if (username && !byKey.has(key)) byKey.set(key, username);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function compareRelationships(snapshot: RelationshipSnapshot): RelationshipSummary {
  const followers = uniqueNormalized(snapshot.followers);
  const following = uniqueNormalized(snapshot.following);
  const followerKeys = new Set(followers.map((name) => name.toLocaleLowerCase('en-US')));
  const followingKeys = new Set(following.map((name) => name.toLocaleLowerCase('en-US')));

  return {
    followersCount: followers.length,
    followingCount: following.length,
    notFollowingBack: following.filter((name) => !followerKeys.has(name.toLocaleLowerCase('en-US'))),
    notFollowedBack: followers.filter((name) => !followingKeys.has(name.toLocaleLowerCase('en-US'))),
    mutual: following.filter((name) => followerKeys.has(name.toLocaleLowerCase('en-US'))),
  };
}

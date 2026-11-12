export interface TimestampedAccount {
  username: string;
  timestamp: number | null;
}

export interface RelationshipSnapshot {
  followers: string[];
  following: string[];
  importedAt: string;
  sourceTimestamp: number | null;
  pendingFollowRequests?: string[];
  blockedAccounts?: string[];
  followerRecords?: TimestampedAccount[];
}

export type RelationshipTab =
  | 'not-following-back'
  | 'not-followed-back'
  | 'mutual'
  | 'pending-requests'
  | 'unfollowers'
  | 'blocked'
  | 'oldest-followers';

export interface RelationshipSummary {
  followersCount: number;
  followingCount: number;
  notFollowingBack: string[];
  notFollowedBack: string[];
  mutual: string[];
}

export interface AccountProfile {
  id: string;
  name: string;
  username: string;
  createdAt: string;
  snapshots: RelationshipSnapshot[];
}

export interface HistoricalInsights {
  unfollowers: string[];
  blockedAccounts: string[];
  oldestFollowers: TimestampedAccount[];
  pendingFollowRequests: string[];
  hasPreviousSnapshot: boolean;
}

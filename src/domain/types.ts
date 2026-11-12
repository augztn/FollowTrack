export interface RelationshipSnapshot {
  followers: string[];
  following: string[];
  importedAt: string;
  sourceTimestamp: number | null;
}

export type RelationshipTab = 'not-following-back' | 'not-followed-back' | 'mutual';

export interface RelationshipSummary {
  followersCount: number;
  followingCount: number;
  notFollowingBack: string[];
  notFollowedBack: string[];
  mutual: string[];
}

import { strFromU8, unzipSync } from 'fflate';
import type { RelationshipSnapshot, TimestampedAccount } from './types';

type JsonRecord = Record<string, unknown>;
type ParsedRecords = { accounts: TimestampedAccount[]; timestamp: number | null };

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function recordsFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  const preferredKeys = [
    'relationships_following',
    'relationships_follow_requests_sent',
    'relationships_follow_requests_received',
    'relationships_blocked_users',
    'relationships_blocked_profiles',
    'relationships_close_friends',
    'relationships_followers',
  ];
  for (const key of preferredKeys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  const firstArray = Object.values(record).find(Array.isArray);
  return Array.isArray(firstArray) ? firstArray : [];
}

function usernamesFromRecords(value: unknown): ParsedRecords {
  const records = recordsFrom(value);
  const accounts: TimestampedAccount[] = [];
  let newestTimestamp: number | null = null;

  for (const item of records) {
    const record = asRecord(item);
    if (!record) continue;

    const title = typeof record.title === 'string' ? record.title : null;
    const listData = Array.isArray(record.string_list_data) ? record.string_list_data : [];
    let found = false;

    for (const rawEntry of listData) {
      const entry = asRecord(rawEntry);
      if (!entry) continue;
      if (typeof entry.value === 'string' && entry.value.trim()) {
        const timestamp = typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)
          ? entry.timestamp
          : null;
        accounts.push({ username: entry.value.trim(), timestamp });
        found = true;
        if (timestamp !== null) newestTimestamp = Math.max(newestTimestamp ?? timestamp, timestamp);
      }
    }

    if (!found && title?.trim()) accounts.push({ username: title.trim(), timestamp: null });
  }

  return { accounts, timestamp: newestTimestamp };
}

function parseJson(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes)) as unknown;
  } catch {
    throw new Error(`Invalid JSON in ${path}`);
  }
}

function uniqueNames(accounts: readonly TimestampedAccount[]): string[] {
  const names = new Map<string, string>();
  for (const account of accounts) {
    const username = account.username.trim().replace(/^@/, '');
    const key = username.toLocaleLowerCase('en-US');
    if (username && !names.has(key)) names.set(key, username);
  }
  return [...names.values()];
}

export function parseInstagramExport(zipBytes: Uint8Array): RelationshipSnapshot {
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(zipBytes, { filter: (file) => !file.name.endsWith('/') });
  } catch {
    throw new Error('The selected file is not a valid ZIP archive.');
  }

  const entries = Object.entries(archive).filter(([path]) => !path.endsWith('/'));
  const followerFiles = entries
    .filter(([path]) => /(^|\/)followers(?:_\d+)?\.json$/i.test(path))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const followingFile = entries.find(([path]) => /(^|\/)following\.json$/i.test(path));
  const pendingFile = entries.find(([path]) => /(^|\/)(?:pending_follow_requests|follow_requests_sent|follow_requests_you.?ve_sent)\.json$/i.test(path));
  const blockedFile = entries.find(([path]) => /(^|\/)blocked_(?:profiles|accounts|users)\.json$/i.test(path));

  if (followerFiles.length === 0 || !followingFile) {
    throw new Error('Could not find followers_*.json and following.json. Export Followers and following in JSON format.');
  }

  const followerRecords: TimestampedAccount[] = [];
  let sourceTimestamp: number | null = null;
  for (const [path, bytes] of followerFiles) {
    const result = usernamesFromRecords(parseJson(bytes, path));
    followerRecords.push(...result.accounts);
    if (result.timestamp !== null) sourceTimestamp = Math.max(sourceTimestamp ?? result.timestamp, result.timestamp);
  }

  const [followingPath, followingBytes] = followingFile;
  const followingJson = asRecord(parseJson(followingBytes, followingPath));
  const relationships = followingJson?.relationships_following;
  if (!Array.isArray(relationships)) {
    throw new Error('following.json has an unsupported structure. Expected relationships_following.');
  }
  const followingResult = usernamesFromRecords(relationships);
  if (followingResult.timestamp !== null) {
    sourceTimestamp = Math.max(sourceTimestamp ?? followingResult.timestamp, followingResult.timestamp);
  }

  const pendingFollowRequests = pendingFile
    ? uniqueNames(usernamesFromRecords(parseJson(pendingFile[1], pendingFile[0])).accounts)
    : [];
  const blockedAccounts = blockedFile
    ? uniqueNames(usernamesFromRecords(parseJson(blockedFile[1], blockedFile[0])).accounts)
    : [];

  const followers = uniqueNames(followerRecords);
  const following = uniqueNames(followingResult.accounts);
  if (followers.length === 0 && following.length === 0) {
    throw new Error('No usernames were found in this export.');
  }

  return {
    followers,
    following,
    pendingFollowRequests,
    blockedAccounts,
    followerRecords,
    importedAt: new Date().toISOString(),
    sourceTimestamp,
  };
}

import { strFromU8, unzipSync } from 'fflate';
import type { RelationshipSnapshot } from './types';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function usernamesFromRecords(value: unknown): { usernames: string[]; timestamp: number | null } {
  const records = Array.isArray(value) ? value : [];
  const usernames: string[] = [];
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
        usernames.push(entry.value);
        found = true;
      }
      if (typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)) {
        newestTimestamp = Math.max(newestTimestamp ?? 0, entry.timestamp);
      }
    }

    if (!found && title?.trim()) usernames.push(title);
  }

  return { usernames, timestamp: newestTimestamp };
}

function parseJson(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes)) as unknown;
  } catch {
    throw new Error(`Invalid JSON in ${path}`);
  }
}

export function parseInstagramExport(zipBytes: Uint8Array): RelationshipSnapshot {
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(zipBytes);
  } catch {
    throw new Error('The selected file is not a valid ZIP archive.');
  }

  const entries = Object.entries(archive).filter(([path]) => !path.endsWith('/'));
  const followerFiles = entries
    .filter(([path]) => /(^|\/)followers(?:_\d+)?\.json$/i.test(path))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const followingFile = entries.find(([path]) => /(^|\/)following\.json$/i.test(path));

  if (followerFiles.length === 0 || !followingFile) {
    throw new Error('Could not find followers_*.json and following.json. Export Followers and following in JSON format from Instagram.');
  }

  const followers: string[] = [];
  let sourceTimestamp: number | null = null;
  for (const [path, bytes] of followerFiles) {
    const parsed = parseJson(bytes, path);
    const result = usernamesFromRecords(parsed);
    followers.push(...result.usernames);
    if (result.timestamp !== null) sourceTimestamp = Math.max(sourceTimestamp ?? 0, result.timestamp);
  }

  const [followingPath, followingBytes] = followingFile;
  const followingJson = asRecord(parseJson(followingBytes, followingPath));
  const relationships = followingJson?.relationships_following;
  if (!Array.isArray(relationships)) {
    throw new Error('following.json has an unsupported structure. Expected relationships_following.');
  }

  const followingResult = usernamesFromRecords(relationships);
  if (followingResult.timestamp !== null) {
    sourceTimestamp = Math.max(sourceTimestamp ?? 0, followingResult.timestamp);
  }

  if (followers.length === 0 && followingResult.usernames.length === 0) {
    throw new Error('No usernames were found in this export.');
  }

  return {
    followers,
    following: followingResult.usernames,
    importedAt: new Date().toISOString(),
    sourceTimestamp,
  };
}

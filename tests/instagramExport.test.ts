import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { parseInstagramExport } from '../src/domain/instagramExport';

describe('parseInstagramExport', () => {
  it('reads followers and following JSON from an Instagram ZIP', () => {
    const zip = zipSync({
      'connections/followers_and_following/followers_1.json': strToU8(JSON.stringify([
        { string_list_data: [{ value: 'alice', timestamp: 1700000000 }] },
        { string_list_data: [{ value: 'bob', timestamp: 1700000001 }] },
      ])),
      'connections/followers_and_following/following.json': strToU8(JSON.stringify({
        relationships_following: [
          { title: 'alice', string_list_data: [{ value: 'alice', timestamp: 1700000002 }] },
          { title: 'carol', string_list_data: [{ value: 'carol', timestamp: 1700000003 }] },
        ],
      })),
    });

    const result = parseInstagramExport(zip);
    expect(result.followers).toEqual(['alice', 'bob']);
    expect(result.following).toEqual(['alice', 'carol']);
    expect(result.sourceTimestamp).toBe(1700000003);
  });

  it('reads pending requests, blocked accounts, and follower timestamps when present', () => {
    const zip = zipSync({
      'followers_and_following/followers_1.json': strToU8(JSON.stringify([
        { string_list_data: [{ value: 'older', timestamp: 1500000000 }] },
        { string_list_data: [{ value: 'newer', timestamp: 1700000000 }] },
      ])),
      'followers_and_following/following.json': strToU8(JSON.stringify({
        relationships_following: [{ string_list_data: [{ value: 'friend' }] }],
      })),
      'followers_and_following/pending_follow_requests.json': strToU8(JSON.stringify({
        relationships_follow_requests_sent: [{ string_list_data: [{ value: 'pending_user' }] }],
      })),
      'followers_and_following/blocked_profiles.json': strToU8(JSON.stringify([
        { string_list_data: [{ value: 'blocked_user' }] },
      ])),
    });
    const result = parseInstagramExport(zip);
    expect(result.pendingFollowRequests).toEqual(['pending_user']);
    expect(result.blockedAccounts).toEqual(['blocked_user']);
    expect(result.followerRecords?.map((item) => item.username)).toEqual(['older', 'newer']);
  });

  it('rejects a ZIP without the expected export files', () => {
    const zip = zipSync({ 'readme.txt': strToU8('not an export') });
    expect(() => parseInstagramExport(zip)).toThrow(/Could not find followers/);
  });

  it('rejects malformed ZIP bytes', () => {
    expect(() => parseInstagramExport(new Uint8Array([1, 2, 3]))).toThrow(/valid ZIP/);
  });
});

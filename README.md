# FollowTrack

A privacy-first Android app for understanding follower relationships from an official account data export.

FollowTrack does not request account passwords, log in to social platforms, scrape websites, or upload personal exports. Data is parsed and stored locally on the device.

## Features

- Import a JSON ZIP export.
- Compare followers and following:
  - Not following back
  - Not followed back
  - Mutual connections
- Review outgoing pending follow requests when included in the export.
- Compare consecutive imports to identify accounts missing from the latest follower list.
- View explicitly exported blocked accounts.
- Rank followers by their earliest available follow timestamp.
- Maintain multiple local profiles with separate import histories.
- Search each report by username.
- Keep unlimited local snapshots without a subscription or upload quota.

Historical reports require multiple imports. A single export cannot establish who unfollowed you in the past. An account missing from a later follower list is reported as an unfollower; the app does not claim to know why that account disappeared. Blocked accounts are shown only when the export explicitly includes them.

## Privacy and data handling

- No credentials, passwords, session cookies, or direct account access.
- No scraping, remote analytics, or app backend.
- ZIP parsing happens on-device.
- Extracted account names and import history are stored in local app storage.
- Deleting a profile removes its local snapshots from the app's storage.
- Exports may contain sensitive personal information. Do not share an unredacted archive or debug logs.

## Stack

- Expo SDK 58 / React Native 0.88
- TypeScript (strict)
- Expo Document Picker and File System
- fflate ZIP parsing
- AsyncStorage for local profile and history persistence
- Vitest for domain and parser tests

## Development

Requirements: Node.js 24, npm, Java 17, and Android SDK for local Android builds.

```bash
npm install
npm run typecheck
npm test
npx expo-doctor
npx expo start
```

## Build Android APK locally

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

GitHub Actions builds a debug APK on pushes to `main`, pull requests, and manual workflow dispatch. The APK is uploaded as a workflow artifact. Debug builds are for testing and are not signed production releases.

## Prepare a compatible data export

1. Open your social account's official account center.
2. Find the data download or export section.
3. Select follower and following relationship data.
4. Choose JSON format and download the archive.
5. Import the ZIP into the matching FollowTrack profile.

Export folder names and JSON structures can vary by platform and over time. Unsupported layouts produce an import error rather than silently generating incomplete reports.

## Report semantics

- Not following back = following − followers
- Not followed back = followers − following
- Mutual = followers ∩ following
- Unfollowers = previous followers − current followers
- Oldest followers = ascending order by available follower timestamp

All username comparisons are case-insensitive. Results reflect the selected export, not live account state.

## Limitations

- No live tracking or automatic background refresh.
- Historical changes require at least two imports for the same profile.
- A missing follower does not establish whether they unfollowed, deactivated, or otherwise changed account visibility.
- Blocked-account reporting depends on the export containing a blocked-account dataset.
- Oldest-follower ranking includes only records with usable timestamps.
- Cloud sync, account recovery, and signed production distribution are not included.

## License

MIT. See [LICENSE](LICENSE).

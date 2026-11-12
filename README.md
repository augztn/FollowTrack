# FollowTrack

An open-source Android app for analysing Instagram follower relationships from your **official Instagram data export**.

FollowTrack does not ask for your Instagram password, log in to Instagram, scrape Instagram, or upload your export. Analysis runs on-device.

> **Status: early MVP.** Android debug builds run in GitHub Actions on pushes to `main` and can be triggered manually. ZIP import, relationship comparison, search, and an Android build workflow are included. Validate against your own export before relying on results. No signed production release is available yet.

## Features

- Import the ZIP downloaded through Instagram Accounts Center.
- Compare followers and following:
  - **Not following back** — accounts you follow that do not follow you.
  - **You don't follow back** — accounts that follow you but are not followed by you.
  - **Mutual** — accounts in both lists.
- Search results by username.
- Display counts and source snapshot date.
- Process the export locally; no app backend or analytics SDK.

## Stack

- Expo SDK 58 / React Native 0.88
- TypeScript (strict)
- Expo Document Picker and File System
- fflate ZIP parsing
- Vitest for domain/parser tests

## Requirements

- Node.js 22.13+ (or 24.3+)
- npm 10+
- Android Studio + Android SDK for local Android builds

## Development

```bash
npm install
npm run typecheck
npm test
npx expo-doctor
npx expo start
```

## Build an Android APK locally

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

A GitHub Actions workflow also builds a debug APK on pushes and pull requests. The APK is uploaded as a workflow artifact. Debug APKs are for testing, not Play Store distribution.

## Import your Instagram export

1. Open Instagram **Settings and activity**.
2. Open **Accounts Center** → **Your information and permissions**.
3. Choose **Download your information**.
4. Select the Instagram profile and **Some of your information**.
5. Include **Followers and following**.
6. Choose **All time** and **JSON** format.
7. Download the ZIP and import it in FollowTrack.

Instagram changes export layouts occasionally. If an import fails, report the issue with a redacted sample structure. Never publish an unredacted export: it contains personal information.

## Comparison semantics

- Not following back = following − followers
- You don't follow back = followers − following
- Mutual = followers ∩ following

Usernames are compared case-insensitively. Results represent the date of the imported export, not live Instagram state. Import a new export to refresh.

## Privacy

- No Instagram credentials are requested or accepted.
- No Instagram API, scraping, or background account access.
- The ZIP is parsed locally and not transmitted by this app.
- This MVP does not include a remote service or cloud backup.

## Limitations

- This is an independent implementation, not affiliated with Instagram or Meta.
- No live follower tracking.
- Export format variations may require parser updates.
- Local data persistence, history, CSV export, and signed release distribution are not yet implemented.

## License

MIT. See [LICENSE](LICENSE).

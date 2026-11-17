# Product Requirements Document (PRD)

**Product:** MediaVault (working name)
**Version:** 0.1 (draft)
**Platforms:** Android (store + APK), iOS (store)

## 1. Vision

One polished app to download media, organize every file on the phone, manage documents, and keep private files safe, with a design that feels premium rather than ad-ridden.

## 2. Problem

- Downloader apps are cluttered with ads, look cheap, and break often.
- File managers and document tools live in separate apps.
- Users have no private, secure place for sensitive media and documents.

## 3. Goals and non-goals

**Goals**

1. Fastest path from "I have a link" to "file saved".
2. A file and document manager good enough to replace the stock one.
3. A premium, dark-first UI that stands out in screenshots.
4. Sustainable revenue via a fair Pro tier.

**Non-goals (v1)**

- Social features, accounts required to use the app, cloud media hosting, video editing, DRM-protected content.

## 4. Personas

| Persona                              | Need                                                       |
| ------------------------------------ | ---------------------------------------------------------- |
| **Casual saver (Ada, 22)**           | Save clips from social apps via share sheet, watch offline |
| **Student/professional (Tunde, 28)** | Keep PDFs and notes organized, scan documents              |
| **Privacy-minded user (Mary, 35)**   | Hide personal files behind biometrics                      |

## 5. Feature requirements

Priority: **P0** = MVP, **P1** = v1.1, **P2** = later.
Flavor: **S** = store, **D** = direct, **B** = both.

### 5.1 Downloader

| ID    | Requirement                                                          | Pri | Flavor |
| ----- | -------------------------------------------------------------------- | --- | ------ |
| DL-01 | Paste link, see preview (thumbnail, title, duration), choose quality | P0  | B      |
| DL-02 | Direct-file link download (mp4, mp3, pdf, zip, images)               | P0  | B      |
| DL-03 | Social platform extraction (TikTok, Instagram, Facebook, X, etc.)    | P0  | D      |
| DL-04 | Share-sheet intent: share a link from any app into MediaVault        | P0  | B      |
| DL-05 | Clipboard link detection prompt                                      | P0  | B      |
| DL-06 | Download queue with pause, resume, cancel, retry                     | P0  | B      |
| DL-07 | Background downloads with progress notification                      | P0  | B      |
| DL-08 | Audio-only extraction (MP3/M4A)                                      | P1  | B      |
| DL-09 | Built-in browser with "download this video" detection                | P1  | D      |
| DL-10 | Batch/playlist download                                              | P1  | D      |
| DL-11 | Wi-Fi only option, speed limit, concurrent download limit            | P1  | B      |
| DL-12 | Scheduled downloads                                                  | P2  | B      |

### 5.2 File manager

| ID    | Requirement                                                    | Pri |
| ----- | -------------------------------------------------------------- | --- |
| FM-01 | Browse app library by type (video, audio, images, docs, other) | P0  |
| FM-02 | Folders: create, rename, move, copy, delete                    | P0  |
| FM-03 | Search, sort, filter (name, date, size, source)                | P0  |
| FM-04 | Multi-select and bulk actions                                  | P0  |
| FM-05 | Storage dashboard (used, free, by category)                    | P1  |
| FM-06 | Duplicate finder and cleanup suggestions                       | P1  |
| FM-07 | Auto-sort rules (by source platform or type)                   | P1  |
| FM-08 | Trash with 30-day restore                                      | P1  |

### 5.3 Document manager

| ID    | Requirement                                                 | Pri |
| ----- | ----------------------------------------------------------- | --- |
| DM-01 | View PDF, images, plain text                                | P0  |
| DM-02 | View DOCX, XLSX, PPTX (render or hand off to system viewer) | P1  |
| DM-03 | Scan to PDF with edge detection, multi-page                 | P1  |
| DM-04 | Merge, split, reorder PDF pages                             | P1  |
| DM-05 | Convert image to PDF, PDF to images                         | P1  |
| DM-06 | Annotate PDF (highlight, draw, sign)                        | P2  |
| DM-07 | OCR text extraction                                         | P2  |

### 5.4 Player

| ID    | Requirement                                                     | Pri |
| ----- | --------------------------------------------------------------- | --- |
| PL-01 | Video playback, fullscreen, gestures (seek, brightness, volume) | P0  |
| PL-02 | Playback speed, subtitles (external SRT)                        | P1  |
| PL-03 | Audio background play with lock-screen controls                 | P1  |
| PL-04 | Picture-in-picture                                              | P1  |

### 5.5 Private vault

| ID    | Requirement                                                      | Pri |
| ----- | ---------------------------------------------------------------- | --- |
| VT-01 | PIN and biometric lock                                           | P0  |
| VT-02 | Move files into encrypted vault, hidden from library and gallery | P0  |
| VT-03 | Auto-lock on background, screenshot blocking                     | P1  |
| VT-04 | Decoy PIN / break-in attempt log                                 | P2  |

### 5.6 App-level

| ID    | Requirement                                                         | Pri         |
| ----- | ------------------------------------------------------------------- | ----------- |
| AP-01 | Onboarding (3 screens max) and permissions with clear rationale     | P0          |
| AP-02 | Dark/light/system theme                                             | P0          |
| AP-03 | Pro paywall and entitlement handling                                | P0          |
| AP-04 | Settings (download path, quality defaults, network rules, language) | P0          |
| AP-05 | In-app updater with signature verification                          | P0 (D only) |
| AP-06 | Localization (English first, then French, Hausa, Yoruba, Swahili)   | P2          |

## 6. Monetization

|              | Free                     | Pro                  |
| ------------ | ------------------------ | -------------------- |
| Downloads    | Up to 720p, 10/day       | Up to 4K, unlimited  |
| Concurrent   | 1                        | 5                    |
| File manager | Full                     | Full                 |
| Doc tools    | View, scan 3/day         | All tools, unlimited |
| Vault        | 20 items                 | Unlimited            |
| Ads          | None or one small banner | None                 |

Options: weekly, monthly, yearly, lifetime. Offer a 3-day trial on yearly.

## 7. Success metrics

- Activation: 60% of new users complete a first download or import within 24h
- D1 / D7 / D30 retention: 40% / 20% / 10%
- Free-to-Pro conversion: 3 to 5%
- Crash-free sessions: above 99.5%
- Extraction success rate: above 95% on supported platforms
- Time from link paste to download start: under 3 seconds (p75)

## 8. Constraints and risks

| Risk                                  | Impact | Mitigation                                                         |
| ------------------------------------- | ------ | ------------------------------------------------------------------ |
| Store rejection or takedown           | High   | Store flavor with no platform extraction, separate package IDs     |
| Platform changes break extraction     | High   | Remote extractor, canary tests, hourly health checks               |
| Legal / copyright complaints          | High   | Terms of use, takedown contact, no hosting of media, no DRM bypass |
| Scraping blocks from platforms        | Medium | Rotating egress, client-side extraction fallback, graceful errors  |
| Background download limits on iOS     | Medium | Use native background sessions, set expectations in UX             |
| Storage permission changes on Android | Medium | Use scoped storage and MediaStore, avoid broad permissions         |

## 9. MVP acceptance criteria

1. User can paste or share a link and download a video to the library.
2. Downloads continue in the background and survive app restarts.
3. User can create folders, move files, search, and bulk delete.
4. User can open a PDF and an image inside the app.
5. User can lock files in the vault with PIN or biometrics.
6. Both flavors build from the same repo via separate build profiles.
7. Pro purchase unlocks entitlements in each flavor's billing system.

## 10. Open questions

- Final name, brand, and domain
- Which platforms are officially supported in the direct flavor at launch
- Server-side vs on-device extraction as the default
- Which markets to launch in first

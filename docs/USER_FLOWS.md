# User Flows

## 1. First launch and onboarding

```mermaid
flowchart TD
    A[Open app] --> B[3 onboarding slides]
    B --> C[Home screen]
    C --> D[Contextual hint: Paste a link]
    D --> E[Permission asked only when first needed]
```

## 2. Download from a pasted link

```mermaid
flowchart TD
    A[Paste or clipboard banner] --> B{Valid URL?}
    B -- No --> B1[Inline error]
    B -- Yes --> C{Flavor and source allowed?}
    C -- No --> C1[Show unsupported source message]
    C -- Yes --> D[Resolve metadata]
    D -- Fail --> D1[Retry or report issue]
    D -- OK --> E[Preview sheet: quality, format, folder]
    E --> F{Quality locked behind Pro?}
    F -- Yes --> F1[Paywall] --> E
    F -- No --> G[Add to queue]
    G --> H[Download in background]
    H --> I[Save to library, notify]
    I --> J[Open / Share / Move]
```

## 3. Share-sheet flow

```mermaid
flowchart LR
    A[Other app: Share] --> B[Choose MediaVault]
    B --> C[App opens to Preview sheet]
    C --> D[Confirm quality]
    D --> E[Queued, user returns to previous app]
```

## 4. Queue management

```mermaid
flowchart TD
    A[Task queued] --> B{Slot free under concurrency limit?}
    B -- No --> B1[Waiting]
    B1 --> B
    B -- Yes --> C[Downloading]
    C --> D{Network lost or app killed?}
    D -- Yes --> E[Paused automatically]
    E --> F[Resume when network returns]
    F --> C
    D -- No --> G{Completed?}
    G -- Yes --> H[Verify file, index in library]
    G -- Error --> I[Failed: retry with backoff, max 3]
```

## 5. Vault

```mermaid
flowchart TD
    A[Tap Vault tab] --> B{PIN set?}
    B -- No --> C[Create PIN, enable biometrics] --> D
    B -- Yes --> D[Unlock with biometrics or PIN]
    D -- Fail x5 --> D1[Cooldown timer, log attempt]
    D -- OK --> E[Vault contents]
    E --> F[Add files from library]
    F --> G[Encrypt, remove from library index]
    E --> H[Export file back to library]
    E --> I[Auto-lock on background after N seconds]
```

## 6. Scan to PDF

```mermaid
flowchart LR
    A[Documents: Scan] --> B[Camera permission]
    B --> C[Auto-detect edges, capture]
    C --> D{More pages?}
    D -- Yes --> C
    D -- No --> E[Review: crop, filter, reorder]
    E --> F[Name and save as PDF]
    F --> G[Open in viewer]
```

## 7. Upgrade to Pro

```mermaid
flowchart TD
    A[Trigger: locked quality, daily limit, tool] --> B[Paywall with contextual headline]
    B --> C{Flavor}
    C -- Store --> D[Play Billing / Apple IAP via RevenueCat]
    C -- Direct --> E[Paystack / Stripe checkout, license key]
    D --> F[Entitlement active]
    E --> F
    F --> G[Unlock features, return to previous screen]
```

## 8. Direct flavor: app update

```mermaid
flowchart TD
    A[App start or manual check] --> B[GET /v1/app/latest]
    B --> C{Newer version?}
    C -- No --> Z[Done]
    C -- Yes --> D[Show update sheet with changelog]
    D --> E[Download APK]
    E --> F[Verify SHA-256 and signing certificate]
    F -- Fail --> F1[Abort, warn user]
    F -- OK --> G[Hand off to Android installer]
```

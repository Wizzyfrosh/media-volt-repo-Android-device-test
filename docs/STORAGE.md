# Storage and Permissions

How MediaVault keeps files on the phone, and why it asks for so few permissions.

## Where files live

| What                                        | Where                                            | Why                                                            |
| ------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Library files                               | App-private `Paths.document/library/<id>.<ext>`  | Private to the app, survives app updates, no permission needed |
| Thumbnails                                  | App-private `Paths.document/thumbnails/<id>.jpg` | Same                                                           |
| Metadata (names, folders, favorites, trash) | SQLite database `mediavault.db`                  | Fast search and sorting                                        |
| Vault (Phase 2c)                            | App-private, encrypted                           | See SECURITY.md                                                |

**Files are stored by id, not by name.** The display name and the folder exist only in the database.
Renaming or moving a file never touches the disk, so it is instant and cannot half-fail.
Two files can share a display name in different folders, and a malicious name can never write outside the library folder.

Everything that changes the library goes through `FileService`, which keeps the database and the disk in step
(for example, if the database refuses a new row, the copied file is removed again).

## Permissions

We use **scoped storage**: the app reads and writes its own folder with no permission at all.

| Need                                            | Approach                                                                    | Permission                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Save downloads, scans, imports                  | App-private folder                                                          | None                                                                |
| Pick a document or video from the phone         | System file picker (Phase 1c/3)                                             | None, the user grants that single file                              |
| Show a file in the phone's gallery or music app | "Save to gallery" copies the file into MediaStore (Android) or Photos (iOS) | Write-only. Android 10+ needs none. We never read the user's photos |

We deliberately do **not** request `MANAGE_EXTERNAL_STORAGE` ("all files access"). Google Play restricts it to
a short list of app types and a file manager that only handles its own library is not one of them.
Browsing the whole phone's storage is not part of the plan. If we ever add it, it would live in the direct (APK) flavor only.

The Android manifest for this build was generated and checked:

- `READ_EXTERNAL_STORAGE` and `READ_MEDIA_VISUAL_USER_SELECTED` are removed.
- `WRITE_EXTERNAL_STORAGE` is limited to Android 12 and older (needed only for saving to the gallery there).

Before a store release, also review the default `SYSTEM_ALERT_WINDOW` and `VIBRATE` permissions that Expo adds,
and remove any the release build does not need.

## Trash

Deleting moves a file to the trash (a timestamp in the database). The bytes stay on disk, so restore is instant.
Items older than 30 days are removed for good when the app starts. "Empty trash" removes everything immediately.
Deleting a folder sends its files to the trash, and they come back at the top level on restore.

## Testing

`FileService` and the repositories are tested on real SQLite (Node's built-in engine) with an in-memory file system:
migrations, rollbacks, name clashes, folder cycles, trash and purge, orphan cleanup, and a simulated app restart.
The device adapters (`services/adapters/`) are thin wrappers over Expo modules. They compile and bundle, but they need
a check on a real Android phone and an iPhone, which is the first thing to do with the Developer tools screen.

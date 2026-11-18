# Library and File Manager (Phase 1d)

The Library tab is now real: it shows the files in your database, and it updates by itself when a download finishes
or anything changes. (PRD: FM-01 to FM-04, plus trash.)

## What you can do

| Feature          | How                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Browse by folder | Folders come first, then files. Tap a folder to open it                                                                       |
| Filter           | Chips: All, Favorites, Videos, Audio, Images, Documents, Archives, Other. The category tiles do the same                      |
| Search           | Search icon in the header. Looks in every folder, ignores case, treats `%` and `_` literally                                  |
| Sort             | Name, Date added or Size, ascending or descending. Remembered between launches                                                |
| Grid or list     | Toggle next to Sort. Remembered between launches                                                                              |
| Select           | Long-press an item, then tap others. "Select all" in the header. Android back leaves selection first                          |
| Bulk actions     | Favorite/Unfavorite, Move, Rename (one item), Delete                                                                          |
| Move             | Pick a folder or the top level. A folder cannot be moved into itself or inside itself                                         |
| Delete           | Files go to Trash with an Undo message. Deleting a folder asks first, because its files go to Trash and the folder is removed |
| Trash            | Library > Trash. Restore, Delete forever (asks first), or Empty. Items are removed for good after 30 days                     |
| New folder       | Folder icon in the header. Creates it inside the folder you are viewing                                                       |

Name clashes never fail: the second "Clip.mp4" becomes "Clip (1).mp4", on import, rename, move and restore.

## States

Every list handles: loading (placeholder rows), error (with Try again), empty library (with a "Paste a link" button),
empty folder, and "No matches" (with Clear filters). The list keeps showing the old data while it reloads, so it never flashes empty.

## How it stays in sync

`FileService` announces every change (import, rename, move, favorite, trash, restore, purge, folder changes).
`useLibrary` listens and reloads. Anything that changes the library gets a live screen for free, including the download engine.

## Performance

**Measured here** (Node on a laptop, real SQLite, 5,000 files, 20 folders): the database side of a screen load takes
6 ms for a filtered list, 18 ms for a search across all files and 19 ms for the top-level view.
Phones are slower, but there is a lot of room.

**Built for scale, not yet measured on a phone:**

- The list is a virtualized `FlatList`: only about a screenful of rows is on screen at once (`windowSize` 7, batches of 12).
- Items are memoized, with stable callbacks, so selecting or scrolling re-renders only what changed.
- Grid tiles have a fixed size and a fixed caption height. `removeClippedSubviews` is on for Android.
- Thumbnails come from `expo-image`, which caches in memory and on disk, and recycles views.
- Search waits 200 ms after you stop typing.

**To check on your phone:**

1. Settings > Developer tools > **Add 5,000 test files** (development builds only).
2. Open Library. Scroll fast in grid and in list. Try search, sort, and Select all.
3. Turn on the performance monitor (shake the phone > Show Perf Monitor) and watch the JS and UI frame rates while scrolling.
4. **Remove test files** when done.

If scrolling is not smooth on a mid-range Android phone, the next step is swapping `FlatList` for FlashList.
That is one extra dependency, and I did not add it without evidence that it is needed.

**Known limits:** all matching files load in one query (no paging), which is fine at 5,000 but would need paging
at roughly 50,000. Any change reloads the whole list. The test files have no thumbnails, so thumbnail loading
is not part of that check. Use real photos and videos for that.

## Not in this phase

- The selection bar has Favorite, Move, Rename and Delete. Copy and "Save to gallery" exist in `FileService` and have no button yet.
- The Move picker cannot create a folder. Create one first, then move.
- Search results do not show which folder a file is in.
- Opening a file goes to the player or viewer screens, which are still placeholders (Phase 2c).
- Drag and drop and swipe actions.

## Tests

- `library-logic.test.ts`: queries, filters, search, sorting, counts, selection, folder tree, change events, 5,000-file timing
- `file-browser.test.tsx`: the real screen on a real database: browse, open, filter, search, select, delete with undo, favorite, rename, new folder, move, folder delete, live refresh
- `trash-screen.test.tsx`: restore, delete forever with confirmation, cancel, empty
- `.maestro/library-organize.yaml`: end-to-end flow (not yet run)

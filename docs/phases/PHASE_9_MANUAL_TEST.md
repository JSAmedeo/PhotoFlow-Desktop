# Phase 9 — Manual Test Guide

**Runtime:** `npm run tauri:dev` (Tauri desktop only — all steps assume the app is running in desktop mode)

**Watch folder used in examples:** `C:\PhotoFlow Desktop\Import\Area1` (configured as a stream named "Area1")

---

## Setup

1. Launch `npm run tauri:dev`
2. Open the **Streams** tab
3. Confirm at least one stream is configured with a watched folder and the toggle is ON
4. Switch each stream card to the **ACTIVITY** tab so results are visible in real time

---

## 1 — Standard session-coded filenames. Results: all passed

These are the "happy path" — filenames containing a recognisable `[A-Z]{3}\d{6}` session code.

| Drop this file | Expected result |
|---|---|
| `SAZ482823_01.jpg` | OK · session `SAZ482823` created (or matched) · sequence 1 |
| `SAZ482823_02.jpg` | OK · routes to the **same** session `SAZ482823` · sequence 2 |
| `XYZ297729_05.jpg` | OK · new session `XYZ297729` |
| `IMG_4021_ABC123456_03.jpg` | OK · session code extracted from mid-filename · `ABC123456` seq 3 |

**Verify in Gallery:** Each session listed above appears. Photos are inside the correct session.

---

## 2 — Lowercase and mixed-case session codes. Results: all passed

| Drop this file | Expected result |
|---|---|
| `saz482823_01.jpg` | OK · normalised to `SAZ482823` · routes to same session as above |
| `Xyz297729_05.jpg` | OK · normalised to `XYZ297729` |

**Verify:** No duplicate sessions created for the same code in different cases.

---

## 3 — Fallback routing (no recognisable session code). Results: all passed

Any image file without a `[A-Z]{3}\d{6}` pattern now creates a session from the filename stem instead of being skipped.

| Drop this file | Session key created | Expected result |
|---|---|---|
| `holiday_photo.jpg` | `HOLIDAY-PHOTO` | OK · new session named `HOLIDAY-PHOTO` |
| `io31erhfuinl_33_2dfds.jpg` | `IO31ERHFUINL-33-2DFDS` | OK · new session |
| `test.jpg` | `TEST` | OK · new session named `TEST` |
| `IMG_0042.jpg` | `IMG-0042` | OK · new session |

**Verify in Gallery:** Each fallback session appears with the derived name. Photos are inside.

**Verify in ACTIVITY tab:** All entries show **OK**, not SKIP. No "No valid session ID" errors.

---

## 4 — Duplicate file handling. Results: Duplicate file was hanging in watcher folder. no error indicating issue. Copied same file over the one hanging, it then imported. Unsure if issue is related to duplication or an issue with the watcher folder updating/refreshing. 

Drop a file that was already imported. The second drop should import as `filename_2.ext`, not skip.

**Steps:**
1. Drop `SAZ482823_01.jpg` → ACTIVITY shows OK (first import)
2. Wait for the file to be removed from the watched folder (a few seconds)
3. Copy `SAZ482823_01.jpg` back into the watched folder
4. ACTIVITY shows a second **OK** entry for `SAZ482823_01.jpg`

**Verify in Gallery:** Session `SAZ482823` now contains **two photos** — the original and one named `SAZ482823_01_2.jpg` (or per the stream's file renaming rules).

**Repeat:** Drop the file a third time → third import as `_3`.

---

## 5 — Same fallback-routed file dropped twice. Results: all passed

1. Drop `test.jpg` → OK · session `TEST` created
2. Wait for removal, then drop `test.jpg` again
3. ACTIVITY shows second **OK** for `test.jpg`

**Verify:** Session `TEST` contains two photos; second is named `test_2.jpg`.

---

## 6 — Watch folder on a secondary drive. Results: setting watcher to non C drive functions (path is recognized, test image imports with expected behavior), but clicking the folder button to bring up the file explorer generates this error in console: [PhotoFlow] Could not reveal path in explorer: Path is outside the allowed managed storage area: D:\test-watcher

1. Configure a stream with a watch path on a non-C: drive (e.g. `D:\test-watcher`)
2. Toggle stream ON
3. Check console — no "forbidden path" errors
4. Drop an image into `D:\test-watcher`
5. ACTIVITY shows OK

---

## 7 — ACTIVITY tab badge and error visibility. Results - dropped .pdf file into active watcher folder. file was shown in folder preview window but nothing else happened (no error, no line in activity window at all, it did not import, no error in console - file just stayed in folder)

1. Drop an unsupported file type (e.g. `document.pdf`) into the watched folder
2. ACTIVITY shows **SKIP · Unsupported watched-folder file type.**
3. Amber badge appears on the ACTIVITY tab with count = 1

**Verify:** Badge clears only if you resolve the underlying issue (not just by switching tabs).

---

## 8 — Stream stats update. Results: IN, OK and sparkline are working as expected. ERR number has remained at 6 from previous issues. The logic to clear this is not working. 

After the imports above:
- **IN** counter reflects total files detected
- **OK** counter reflects successful imports
- **ERR** counter reflects any failures
- Sparkline in the top-right of the stream card shows recent activity

---

## 9 — Gallery filtering by stream. Results: all passed

1. Select a stream in the left panel location dropdown
2. Gallery shows only sessions from that stream
3. Select "All Locations" — all sessions visible

---

## 10 — Workshop smoke test. Results: all passed

1. Click any imported session in Gallery → opens in Workshop
2. Filmstrip shows thumbnails for all photos in that session
3. No crashes or blank panels

---

## Known limitations (do not flag as failures)

- If `remove()` fails on a file (e.g. the file is held open by another process), the watcher will re-import it as `_2`, `_3`, etc. every ~10 seconds. This is visible in the ACTIVITY tab and is by design — the operator can investigate the source.
- The **Reveal** button on a stream card will show an error for watch folders outside `C:\PhotoFlow Desktop` and `%LOCALAPPDATA%`. This is a known limitation of the `reveal_in_explorer` path guard.

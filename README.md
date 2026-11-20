# Inkwell

A local-first studio for writing novels. It pairs a Reedsy-Studio-style focused writing and planning experience (goals, formatting and export) with Scrivener-style power tools (binder, corkboard, outliner, inspector, snapshots, split editor, scrivenings, compile).

Everything is stored in your browser's IndexedDB. There is no backend, no login, and nothing leaves your device unless you turn on the optional AI assistant and supply your own key.

## Run it

Requires **Node.js 20 or 22 LTS** (verified on 20.18; npm may print a harmless engine warning for a transitive dependency on Node 20).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: data layer, word counts, goals, analysis, compile
npm run build      # type-check (strict) + production build into dist/
npm run preview    # serve the production build
```

## Desktop app (Windows .exe)

Inkwell also ships as a standalone Windows program built with Electron.

```bash
npm run exe              # → release/Inkwell.exe (single portable file, no install needed; fast, uncompressed, ~45 s)
npm run exe:small        # the same exe, compressed (~110 MB instead of ~330 MB, but a ~5 min build)
npm run release          # publish a new version that running copies update to (see below)
npm run exe:installer    # → release/Inkwell-Setup-<version>.exe (Start-menu install + .inkwell file association)
npm run exe:if-changed   # rebuilds release/Inkwell.exe only if sources changed since the last build
npm run desktop          # build and run the desktop app without packaging
```

- **Data:** the desktop app keeps its projects in your Windows profile (`%APPDATA%\Inkwell`; **Help → Open data folder**). This is separate from projects in a browser; move them with **Format & Export → Download backup / Restore**.
- **Safety:** pending writing and whiteboards are saved before the window closes. Right-click shows spelling suggestions, links open in your browser, and exports ask where to save.
- **Opening backups:** double-clicking a `.inkwell` file opens it with the installed app (installer build), or run `Inkwell.exe path\to\file.inkwell`.
- **Automatic rebuilds:** a Claude Code Stop hook (`.claude/settings.json`) runs `npm run exe:if-changed` in the background after every Claude turn, so `release/Inkwell.exe` always matches the code. The log is in `release/build.log`. If a rebuild fails, close any running Inkwell (Windows locks a running exe) and run `npm run exe`.
- **Fast rebuilds:** everyday builds skip compression, which was most of the 5-minute build time. Releases are compressed, so downloads stay small.
- **Automatic updates:** the portable exe checks the latest [GitHub release](https://github.com/Freezblue1/Inkwell/releases) when it starts and every 6 hours. A newer `Inkwell.exe` downloads in the background and is checked against the size and SHA-256 GitHub reports. It then replaces the running exe when you close Inkwell, or straight away with **Restart now**. Turn checks off, or check by hand, in **Settings → App** or **Help → Check for updates…**. The exe must sit in a folder you can write to (not Program Files).
- **Publishing a version:** commit your changes, then run `npm run release` (or `npm run release -- minor`, `-- 2.0.0`, `-- --notes "What's new"`). It runs the tests, bumps the version in `package.json`, builds the compressed exe, commits and tags `vX.Y.Z`, pushes, and creates the GitHub release with `Inkwell.exe` attached. Without `--notes`, the release notes list the commits since the last release.
- **Unsigned:** the exe isn't code-signed, so Windows SmartScreen may warn on first launch (More info → Run anyway).

## Projects folder (sync across PCs)

**Settings → Projects folder → Choose folder…** mirrors every project to a folder you pick, such as OneDrive, Dropbox, Google Drive or a USB stick. It works in the desktop app and in Chrome or Edge (File System Access API). Firefox and Safari can't write to folders.

- **Real files:** each project is saved as `Title.inkwell`, the same format as a backup. Inkwell writes a few seconds after you stop typing, and at least every 20 seconds while you type.
- **Sync:** Inkwell checks the folder every few seconds (desktop) or every 10 seconds (browser), and again whenever you switch back to it. Point Inkwell on another PC, or in the browser, at the same folder: their projects appear, and edits travel both ways. The open project reloads when its file changes, but only if you have no unsaved changes here.
- **Conflicts:** if a project changed both here and on another device since the last sync, this device's version keeps the file. The other version is added as “Title (other device, date)”, so nothing is lost. Before Inkwell replaces a project with the folder's version, it takes a rolling backup (History).
- **Deleting:** a project deleted in Inkwell has its file moved to `Deleted projects/` and is recorded in `.inkwell-sync.json`, so other devices delete it too. Their copy of the file stays in `Deleted projects/`.
- **Stays on each device:** the sample novel, snapshots, undo history and rolling backups.
- **Matching:** files are matched to projects by the project id inside, not by file name. Renaming a project renames its file. **Stop using folder** leaves the files in place. If you choose the same folder again later, the most recently edited version of each project wins, and the older file is moved to `Deleted projects/`.
- **Code:** `src/features/folderSync/engine.ts` (sync rules, tested in `engine.test.ts`), `adapters.ts` (desktop IPC and browser handles), `electron/folders.cjs` (file access limited to the chosen folder).

## Home

Inkwell opens on **Home**, a page with all your projects. Get back to it from any project with the **Home** button (house icon) at the left of the top bar, **⋮ → Home**, **Ctrl+Alt+H**, Ctrl+K → "Home", or **Go to Home** in the project switcher. Leaving a project saves everything first.

- **Continue writing:** the project you opened last, with its word count, goal progress and a button to jump back in.
- **All projects:** a card per project with a cover colour, author, word count, goal progress, series and when you last opened it. Search (with four or more projects) and sort by recently opened, title, newest or most words; the sort is remembered. Each card's ⋮ menu has Open, Duplicate, Download backup and Delete.
- **Actions:** New project, Import manuscript, Restore backup, and open or remove the sample novel. Settings are on the gear button. With no projects yet, Home shows the new-project form straight away.
- App-icon shortcuts (New scene, Writing goals…) still open your last project directly.

## Continuity checker and dialogue view

Plan → **Continuity** (or Ctrl+K → "Continuity", "Appearances", "Dialogue"). It reads the whole manuscript and uses the Story Bible's characters.

- **Checks:**
  - **Described two different ways:** a character's eyes or hair given different colours in different scenes, or different from their Story Bible "Appearance" ("grey eyes" in the Bible, "blue eyes" in chapter 3). Inkwell links each description to the character named just before it.
  - **Name spelled two ways:** words that look like a misspelt character name ("Tobias" for "Tobiah", "Macleod" for "MacLeod"), ignoring other characters' names and common words.
  - **Missing for a while:** characters who vanish for several chapters (you choose how many), or regulars who are never seen again near the end.
  - Every finding lists the passages with a button that opens the scene with the words selected. Dismiss anything that's intentional; dismissed findings are remembered per project.
- **Appearances:** one row per character, one square per chapter, darker where they're named more often. Dashed red squares mark flagged absences; click a square to jump to that chapter.
- **Dialogue:** pick a character to see only their lines, chapter by chapter, with measures of their voice: words per line and per sentence, questions, exclamations, contractions, the words they use more than anyone else and the phrases they repeat (click one to filter). Speakers come from dialogue tags ("…," Mara said); without a tag Inkwell guesses from who is named nearby, action beats and back-and-forth exchanges. Guessed lines are marked and can be hidden.

## Revision mode

Tracked changes in colour-coded passes, like Scrivener's revision colours. Turn it on from the **Revision mode** button in the editor toolbar (pick First…Fifth revision), **Ctrl+Alt+R**, or Ctrl+K → "Revision mode".

- **While it's on:** new text appears in the pass colour (blue, red, green, purple, orange) with a dotted underline; deleted text stays visible, struck through in the pass colour. Deleting text you added in the same pass simply removes it. The status bar shows the active pass (click it to turn revision mode off). The pass is remembered per project.
- **Review:** click into a change for an **Accept / Reject** bubble; select text to accept or reject every change inside it; **Ctrl+Alt+. / Ctrl+Alt+,** jump to the next / previous change. The menu also accepts or rejects everything in the document or the whole project, for every pass or one pass only (project-wide snapshots each changed document first).
- **Show changes** off gives the final view: colours gone, deletions hidden.
- Word counts, search and compiled exports already leave out deleted text. Paragraph joins and formatting changes aren't tracked.

## Importing a manuscript

**Import manuscript…** on the welcome screen or in the project list, binder **+ → Import manuscript…**, or Ctrl+K → "Import". Pick where the book is now, choose the file, check the preview, then import it as a new project or add it to the end of the open one.

| From | What to give Inkwell | What comes along |
|---|---|---|
| **Microsoft Word** | `.docx` | Headings (Title, Heading 1–3, "Chapter Title" styles) or "Chapter …" lines → chapters; italics, bold, underline, footnotes, quotes, lists |
| **Google Docs** | File → Download → Word (`.docx`), or the Markdown / OpenDocument / Web page (`.zip`) / EPUB / plain-text download, or copy and paste the document into the box | Same as Word; pasted text keeps Google Docs' italics, bold and headings |
| **Reedsy Studio** | Its EPUB export (best), or a Word or PDF export | The EPUB's table of contents gives chapter titles, parts, front and back matter |
| **Scrivener** | The `.scriv` folder (choose or drop it) or a `.zip` of it; Scrivener 1–3, Windows or Mac | Manuscript folders → parts and chapters, documents → scenes, plus synopses, document notes and statuses; Research and other top-level folders → notes |
| **Markdown** | `.md` | `#`/`##` headings → chapters, `***` or a lone `#` → scene breaks, YAML front matter `title:`/`author:` |
| **PDF** | A PDF with selectable text (not a scan) | Paragraphs rebuilt from the layout; page numbers and running heads removed; chapters from larger heading text or "Chapter …" lines. Italics and bold aren't kept |

Also: RTF, OpenDocument (`.odt`), EPUB from any app, HTML and plain text. Choose several files at once to get one chapter per file (in name order).

- **Finding the structure:** parts ("Part One", "Book II"), chapters (headings, or lines like "Chapter Twelve", "XIV", "3. The Storm"; a "Chapter 3" line followed by its name becomes "The Storm"), scenes (at `***`, `#`, `⁂`, `~` or a scene-break style), prologues, epilogues, interludes, forewords and afterwords (as special chapters), and front and back matter (dedication, copyright, acknowledgements, about the author…). A table of contents and a bare title page are skipped, since Inkwell generates both on export.
- **Preview:** shows the binder that will be created, with word counts. Untick anything you don't want, select an item to read its text or rename it, and change how chapters are found (automatically, at headings, at "Chapter …" lines, or not at all) and whether scene breaks start new scenes.
- **Left out:** pictures (add them to Research), comments and Scrivener annotations, labels and snapshots. Old `.doc` and Pages files need saving as `.docx` first; the importer explains how.
- **Code:** readers live in `src/lib/import/` (one per format, all producing the same block model), `structure.ts` finds chapters and scenes, and `src/db/importManuscript.ts` writes the result. Word uses mammoth, Markdown uses marked, PDF uses pdf.js (loaded only when you import a PDF; cached for offline use).

## Whiteboard, special chapters and illustrated themes

- **Whiteboard** (Plan → Whiteboard): an infinite canvas for brainstorming and story maps. Boards are **tabs**: **+** adds one; double-click a tab (or F2) to rename; right-click to save a copy as a new tab, move it left or right, close it or delete it. Closing a tab keeps the board saved under **All boards** (the folder icon), where you can reopen it. Each tab keeps its own undo history and autosaves; a dot marks unsaved changes, and Ctrl+S or the save icon saves all boards immediately. Tools: select (V), pan (H or hold Space), pen (P), rectangle (R), ellipse (O), arrow (A), sticky note (N, or double-click), text (T), frame (F), eraser (E), picture (I). Drag to move, use the corner handle to resize, drag the round handle above a selection to **rotate** it (Shift snaps to 15°, and it settles on right angles; double-click the handle to straighten; `[` / `]` turn 15°, with Shift 90°; or use the rotate buttons in the toolbar). Arrows attached to a rotated shape follow its turned outline, and frames stay upright while their contents turn. The fill button fills new shapes or the selected ones, and changing a filled shape's colour changes its fill too. Shift-click or drag a box to multi-select, Ctrl+D to duplicate, Delete to remove, arrow keys to nudge, Ctrl+Z / Ctrl+Shift+Z to undo and redo. Ctrl+wheel zooms; the wheel pans. Boards autosave, are included in `.inkwell` backups and export to PNG.
  - **Attached arrows:** start or end an arrow on a note, shape, card or picture and it stays attached when you move things (the target lights up while you draw). Drag an arrow's end handle to re-attach it; dragging an arrow on its own lets go. Double-click an arrow (or press Enter) to give it a label.
  - **Frames** (F): titled areas for grouping. Moving a frame by its title bar moves everything inside it; clicks in the middle still reach what's inside. Double-click the title to rename it.
  - **Pictures:** the picture button (or I), drag-and-drop, or paste. They're saved in the project and keep their proportions when resized.
  - **Cards:** **Add scene card** drops a note linked to a scene (its ↗ corner opens the scene). **Add Story Bible card** shows a character, place, item or lore entry with its portrait, kept up to date; ↗ or double-click opens the entry.
  - **Minimap** (M): an overview in the corner; click or drag it to move the view.
  - **Templates:** plot diagram, three-act structure, murder board, family tree, and a character web built from your Story Bible characters and relationships.
- **Special chapters:** binder **+ → Special chapters** (Prologue, Foreword, Introduction, Interlude, Epilogue, Afterword, or a custom heading such as "Coda"). Prologues and forewords go before chapter one, epilogues and afterwords at the end, and interludes after the chapter you're in. You can also convert any chapter: right-click → **Chapter type**, or Inspector → Metadata. Special chapters are compiled unnumbered under their own heading ("Prologue", with the title underneath) and don't affect "Chapter One, Two…" numbering, including in the table of contents.
- **Illustrated themes:** theme menu (top bar) or Settings → Appearance. Each has its own palette, heading font, textured app bar and navigation rail, themed dialogs and writing page, and animated decorations:
  - **Jungle:** canopy greens, mango accents, parchment pages, a bamboo rail, hanging vines with hibiscus flowers, corner foliage and fireflies.
  - **Ocean:** deep-sea blues and coral, a sea-foam page, sun rays from the surface, rising bubbles, swaying kelp, a school of fish and a drifting jellyfish.
  - **Space:** a starfield with nebula glows, violet and star-gold accents, a night-sky page, twinkling and shooting stars, a ringed planet with an orbiting moon and a floating astronaut.
  - **Cozy Library:** dark wood, brass and burgundy, a bookshelf rail, an aged-paper page, a swaying pendant lamp, a flickering candle, dust motes and a sleeping cat on a stack of books.
  - **Sakura:** a light theme in blossom pink with a cherry branch, drifting petals and a faint distant mountain.
  Decorations never block clicks, stay clear of the toolbar buttons, stop moving if you prefer reduced motion, and can be switched off in Settings. Themes live in `src/theme/scenes.ts`; decorations in `src/features/shell/decor/`.

## Install as an app (PWA)

Inkwell is a Progressive Web App: installable, and it works fully offline once loaded.

- **Install:** use the browser's install icon in the address bar, **⋮ → Install Inkwell app** in the top bar, or **Settings → App**. On iPhone or iPad, tap **Share → Add to Home Screen**.
- **Offline:** the service worker precaches the whole app, every code-split view and exporter included. Fonts are cached on first use. Only dictionary lookups (which reuse cached answers) and the AI assistant need a connection. An **Offline** chip appears in the top bar when you lose the network.
- **Updates:** when a new version is deployed, Inkwell shows *"A new version is ready — Update"*. It saves everything before reloading and never updates mid-sentence on its own.
- **App-icon shortcuts:** New scene, Scratchpad, Writing goals.
- **File handling:** the installed app (Chromium desktop) can open `.inkwell` backups double-clicked in your file manager. Each one opens as a new copy.
- **Testing the PWA locally:** the service worker only runs in production builds, so use `npm run build` then `npm run preview` (http://localhost:4173). `npm run dev` doesn't register it, which keeps hot reload predictable.
- **Deploying:** `dist/` is a static site. Host it on any HTTPS server (Netlify, Vercel, GitHub Pages, Cloudflare Pages…); service workers require HTTPS everywhere except localhost.
- **Icons** are generated from `public/icon.svg` with `npm run generate-pwa-assets` (config in `pwa-assets.config.ts`).

On first launch, choose **Open sample novel** to explore *The Salt Archive*: chapters, characters, plot threads, three weeks of writing history, and a goal. Remove it later with **Delete demo content** in the project picker.

## Assumptions

- **Browser-only.** IndexedDB (via Dexie) is the database. Inkwell asks for persistent storage and warns at 85% quota. Use **Format & Export → Download backup** for an off-device copy.
- **TipTap 2.x** (stable), with MUI v6, React 18, Zustand 5 and Dexie 4.
- **Text is stored apart from metadata.** A binder document's TipTap JSON lives in a separate `contents` table, so a 150k-word project loads its binder instantly and only parses the text you open.
- **Scrivenings** shows one editor per section, stacked into a continuous page with subtle dividers. Each section saves to its own document. Off-screen sections mount lazily.
- **PDF export has two paths.** *Export → PDF* builds a direct download with jsPDF, using its own layout engine (Times or Courier). *Print* (in the preview) uses print CSS, so "Save as PDF" reproduces the preview's exact typography, drop caps included.
- **Spelling suggestions** come from the browser's native spellcheck (right-click a word). Proofreading mode adds an offline list of common misspellings, plus adverb, filler, repeat and passive-voice highlighting.
- **Dictionary lookups** use dictionaryapi.dev and Datamuse when online, with a built-in synonym list as the offline fallback.
- **The AI assistant** is optional, off by default, and provider-agnostic: Anthropic, or anything OpenAI-compatible. Calls go straight from the browser to the provider with your own key.
- **Series:** books in the same series share bible entries that have "Share with series" turned on.
- **Persistent undo:** Ctrl+Z works normally. Once the in-memory history runs out (for example after reopening the app), Ctrl+Z steps back through saved revisions (up to 40 per document, roughly one per minute of writing).

## Features by area

| Area | What's there |
|---|---|
| **Shell** | App bar with an inline-editable title, save status, Ctrl/Cmd+K command palette, project search, theme menu (light/dark/system), word-count chip and focus button. M3 navigation rail on desktop, drawers on tablet, bottom navigation on mobile. Comfortable and compact density. Skip link, visible focus rings, reduced-motion support. |
| **Binder** | Front Matter / Manuscript / Back Matter / Notes / Trash. Virtualized tree; drag to reorder and drag sideways to re-nest. Context menu (open, split, scrivenings, add, rename, duplicate, split at cursor, merge with next, status, label, icon and color, word target, trash). Full keyboard control. Filter, collapse/expand all, per-item word counts, status chips, label dots and target progress bars. |
| **Editor** | TipTap: StarterKit (with History), Underline, TextAlign, Highlight, Typography, CharacterCount, Placeholder, Link, plus custom **Footnote** (node), **Comment** (mark), **Scene Break** (node), @-**Mention**, find/replace highlighting, focus dimming, proofreading highlights and persistent undo. Toolbar, floating bubble menu and shortcuts. Autosave 1.2 s after typing stops, on blur and on tab hide, with a localStorage recovery copy on unload. |
| **Views** | Scrivenings, split editor (vertical or horizontal; also shows research images and PDFs), and focus mode (typewriter scrolling, paragraph/sentence dimming, and 11 focus themes chosen from the palette button: Plain, Paper, Typewriter (Courier on a sheet), Candlelight (embers), Rainy window, Midnight (stars), Snowfall, Forest (fireflies), Ocean (light rays), Dusk and Terminal (green phosphor), plus your illustrated app theme. Each theme has a matching sound, synthesised offline: rain, fireplace, waves, wind or soft noise. Any sound can be picked. Animations follow the decorations setting and reduce-motion). |
| **Find & replace** | Match case, whole word, regex (with `$1` groups); document or whole-project scope. Project-wide replace snapshots every changed document first. |
| **Inspector** | Synopsis index card and notes. Metadata (status, label, POV, location, story date and time, tags, word target, custom fields). Snapshots (take, compare with a diff, restore, rename, delete). Links (manual links plus @-mentions). Comments (edit, resolve, reopen, jump to text, delete). |
| **Plan** | Corkboard (grid grouped by chapter/part/flat, drag across groups; freeform board with saved positions). Outliner (sortable, column picker, inline editing, virtualized). Plot grid (threads, characters or POV × scenes, with cell notes). Timeline (story order vs. manuscript order, flags flashbacks). Story Bible (characters, locations, items, lore; image upload; cross-links; relationships). Relationship map (force-directed, draggable). Structure templates (Three-Act, Save the Cat, Hero's Journey, Story Circle). |
| **Research** | Folder tree of notes, web links, images and PDFs, all stored in IndexedDB; drag and drop to upload. A floating scratchpad (Ctrl+.) is available anywhere and can be saved as a binder note. |
| **Goals** | Project target and deadline; writing days; auto-calculated daily target; Pomodoro sprints with session target; streaks; 26-week heatmap; words-per-day and cumulative-vs-target charts; per-chapter targets. |
| **Format & Export** | Live paginated preview. Templates: Standard Manuscript Format, Paperback (trim sizes, mirrored margins, drop caps, running heads) and eBook. Controls for title, copyright and dedication pages, TOC, chapter-heading style, scene-break glyph, fonts and spacing. Compile dialog with status/label filters, a document checklist and front/back-matter selection. Exports DOCX, EPUB 3, PDF, Markdown and plain text. `.inkwell` backup and restore. |
| **Import** | Word, Google Docs (download or paste), Reedsy Studio (EPUB/Word/PDF), Scrivener (`.scriv` folder or zip), Markdown, PDF, RTF, ODT, EPUB, HTML, plain text and several files at once. Finds parts, chapters, scenes, special chapters and front/back matter; preview with untick/rename; new project or append to the open one. |
| **History** | Timeline of document and project snapshots (manual, daily auto, major-edit auto, pre-restore safety). Diff and restore at document or project level. Rolling backups every 10 minutes (latest 5), restorable as a copy. |
| **Tools** | Command palette, project-wide search with scope filters and highlighted snippets, name generator, dictionary and thesaurus, writing analysis (overused words, adverbs, fillers, sentence variety, Flesch scores, repeated phrases, dialogue ratio), a "to fix" list built from comments, a shortcut cheat sheet (`?`), multiple projects with templates (Novel, Novella, Short story, Series) and the AI assistant. |

## File tree

```
inkwell/
├─ index.html · package.json · tsconfig.json · vite.config.ts · README.md
├─ public/favicon.svg
└─ src/
   ├─ main.tsx · App.tsx · vite-env.d.ts
   ├─ types/models.ts                 # documented data model
   ├─ db/
   │  ├─ db.ts                        # Dexie schema + versioned migrations
   │  ├─ bundle.ts                    # .inkwell backup/import, rolling backups, delete
   │  ├─ builder.ts · templates.ts · sample.ts
   │  ├─ repos/ documents · snapshots · story · goals · assets · settings · search
   │  └─ db.test.ts
   ├─ store/                          # Zustand slices
   │  ├─ index.ts · types.ts
   │  └─ projectSlice · storySlice · editorSlice · uiSlice · goalsSlice
   ├─ theme/ theme.ts · AppThemeProvider.tsx
   ├─ components/ ErrorBoundary · EmptyState · ResizeHandle · ViewSkeleton · DialogHost
   │              SnackbarHost · StatusChip · DiffView · LazyMount
   ├─ hooks/ useLayoutMode · useDebounced · useAssetUrl
   ├─ lib/
   │  ├─ wordCount · text · tree · goals · analysis · proofread · wordLists · findRegex
   │  ├─ fuzzy · names · thesaurus · bible · structureTemplates · graphLayout · dates · ids · defaults
   │  ├─ compile/ blocks.ts · compile.ts (+ test)
   │  └─ export/ docx · epub · pdf · markdown · html · trim · download · index
   └─ features/
      ├─ shell/      AppShell · TopBar · NavRail · BottomNav · SaveIndicator · ProjectTitle
      │              Bootstrap · BackgroundTasks · GlobalDialogs · SettingsDialog · navigation
      ├─ projects/   WelcomeScreen · ProjectPicker · ProjectList · NewProjectForm
      ├─ binder/     Binder · BinderRow · BinderContextMenu · binderDnd · docIcons
      ├─ editor/     WriteView · DocumentPage · DocumentHeader · DocEditor · EditorToolbar
      │              EditorBubbleMenu · EditorSurface · EditorSettingsForm · StatsBar
      │              FootnoteDialog · editorActions · autosave
      │              extensions/ SceneBreak · Footnote · Comment · InkMention · MentionList
      │                          SearchHighlight · FocusHighlight · AnalysisHighlight
      │                          PersistentUndo · textblocks · index
      │              scrivenings/ · split/ · focus/ · find/
      ├─ inspector/  Inspector · SynopsisTab · MetadataTab · SnapshotsTab · SnapshotDialog
      │              LinksTab · CommentsTab
      ├─ plan/       PlanView · corkboard/ · outliner/ · plotgrid/ · timeline/ · bible/
      │              relationships/ · structure/
      ├─ research/   ResearchView · ResearchViewer · Scratchpad
      ├─ goals/      GoalsView · GoalCharts · Heatmap · SprintTimer
      ├─ export/     ExportView · ProfileControls · BookPreview · paginate · printBook
      │              CompileDialog · BackupCard · profileStore
      ├─ history/    HistoryView
      └─ tools/      CommandPalette · GlobalSearch · ShortcutsDialog · NameGenerator
                     LookupDialog · AnalysisDrawer · AIAssistant · ai · shortcuts
                     useGlobalShortcuts
```

## Data model

All types are documented in [`src/types/models.ts`](src/types/models.ts). In code, `Document` is named `InkDocument`, `Comment` is `InkComment` and `Location` is `LocationEntry`, so none of them shadows a DOM global.

| Table | Key / indexes | Holds |
|---|---|---|
| `projects` | `id, updatedAt, lastOpenedAt, seriesId` | `Project`: title, author, kind, series, statuses, labels, custom-field definitions, demo flag |
| `series` | `id` | `Series` |
| `documents` | `id, projectId, parentId, [projectId+type], updatedAt` | `InkDocument`: binder node (type part/chapter/scene/note/research/frontmatter/backmatter, title, synopsis, status, label, order, wordCount, targetWordCount, metadata, trashed) |
| `contents` | `docId, projectId, updatedAt, *words` | TipTap JSON + plain text; `*words` is a multi-entry full-text index |
| `revisions` | `id, docId, [docId+createdAt]` | rolling history used by persistent undo (v2) |
| `snapshots` | `id, projectId, docId, [docId+createdAt], [projectId+scope]` | `Snapshot` of a document or the whole project |
| `bible` | `id, projectId, seriesId, kind` | `Character`, `LocationEntry`, `ItemEntry`, `LoreNote` |
| `tags` · `plotThreads` · `comments` | `id, projectId[, docId]` | `Tag`, `PlotThread` (cells by scene id), `InkComment` |
| `goals` · `sessions` | `id, projectId[, date, [projectId+date]]` | `Goal`, `WritingSession` (daily added/removed/net/sprints) |
| `exportProfiles` | `id, projectId` | `ExportProfile` (template, trim, margins, fonts, compile filters) |
| `assets` | `id, projectId` | images and PDFs as Blobs |
| `backups` | `id, projectId, createdAt` | rolling project backups (v2) |
| `settings` | `id` | `Settings` singleton (theme, density, editor, layout, AI, scratchpad) |

**Migrations:** `db.ts` declares `version(1)` (the initial schema) and `version(2)` (adds `revisions` and `backups`, and normalizes document metadata in `.upgrade()`). To change the schema, add a new `version(n)` block and never edit a shipped one.

## Reliability and performance

- **No data loss:** debounced saves (1.2 s); flush on blur, tab hide, `pagehide` and `beforeunload`; a synchronous localStorage recovery copy restored on next open; saves chained per document; quota errors surfaced with a retry; daily project snapshots, major-edit snapshots and rolling backups.
- **Big manuscripts:** lazy-loaded content, a virtualized binder and outliner, lazily mounted scrivenings sections, `shouldRerenderOnTransaction: false` and selector-based toolbar state (keystrokes don't re-render React), throttled stats, cached tree indexes, code-split views and exporters, and batched preview pagination.

## Build phases and what to test

1. **Scaffold:** theme (light/dark/system; sepia paper in the editor), shell, Dexie schema, Zustand slices. *Test:* switch theme and density, resize the window (desktop → tablet drawers → mobile bottom bar), reload and confirm settings persist.
2. **Binder, editor, autosave, inspector:** *Test:* create, rename and drag scenes (drag right to nest); watch the "Saved" indicator; reload mid-sentence; edit the synopsis and metadata; set a word target and see the binder progress bar.
3. **Scrivenings, split, focus, find, comments, footnotes:** *Test:* breadcrumb → chapter scrivenings; Ctrl+\ split with a note; Ctrl+Shift+Enter focus with sentence dimming and typewriter scrolling; Ctrl+H with regex; select text → comment → resolve; Ctrl+Alt+F footnote.
4. **Corkboard, outliner, story bible, plot grid, timeline, @-mentions:** *Test:* drag cards between chapters; edit cells in the outliner; add a character with a photo and relationships; type `@Ma` in a scene; generate a Save the Cat outline.
5. **Snapshots, history, research, goals:** *Test:* take a snapshot, change text, compare and restore; snapshot the project in History; upload an image or PDF to Research and open it in the split pane; set a deadline and run a sprint.
6. **Format preview, compile, exports, backup:** *Test:* switch Manuscript/Paperback/eBook and watch the preview repaginate; Compile with status filters to DOCX/EPUB/PDF/MD/TXT; download a `.inkwell` backup and restore it.
7. **Palette, analysis, shortcuts, accessibility, performance, tests:** *Test:* Ctrl+K, Ctrl+Shift+F, `?`; proofreading mode; Writing analysis → To fix; `npm test`.

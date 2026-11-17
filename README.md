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
npm run exe              # → release/Inkwell.exe (single portable file, no install needed)
npm run exe:installer    # → release/Inkwell-Setup-<version>.exe (Start-menu install + .inkwell file association)
npm run exe:if-changed   # rebuilds release/Inkwell.exe only if sources changed since the last build
npm run desktop          # build and run the desktop app without packaging
```

- **Data:** the desktop app keeps its projects in your Windows profile (`%APPDATA%\Inkwell`; **Help → Open data folder**). This is separate from projects in a browser; move them with **Format & Export → Download backup / Restore**.
- **Safety:** pending writing and whiteboards are saved before the window closes. Right-click shows spelling suggestions, links open in your browser, and exports ask where to save.
- **Opening backups:** double-clicking a `.inkwell` file opens it with the installed app (installer build), or run `Inkwell.exe path\to\file.inkwell`.
- **Automatic rebuilds:** a Claude Code Stop hook (`.claude/settings.json`) runs `npm run exe:if-changed` in the background after every Claude turn, so `release/Inkwell.exe` always matches the code. The log is in `release/build.log`. If a rebuild fails, close any running Inkwell (Windows locks a running exe) and run `npm run exe`.
- **Unsigned:** the exe isn't code-signed, so Windows SmartScreen may warn on first launch (More info → Run anyway).

## Home

Inkwell opens on **Home**, a page with all your projects. Get back to it from any project with the **Home** button (house icon) at the left of the top bar, **⋮ → Home**, **Ctrl+Shift+H**, Ctrl+K → "Home", or **Go to Home** in the project switcher. Leaving a project saves everything first.

- **Continue writing:** the project you opened last, with its word count, goal progress and a button to jump back in.
- **All projects:** a card per project with a cover colour, author, word count, goal progress, series and when you last opened it. Search (with four or more projects) and sort by recently opened, title, newest or most words; the sort is remembered. Each card's ⋮ menu has Open, Duplicate, Download backup and Delete.
- **Actions:** New project, Import manuscript, Restore backup, and open or remove the sample novel. Settings are on the gear button. With no projects yet, Home shows the new-project form straight away.
- App-icon shortcuts (New scene, Writing goals…) still open your last project directly.

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

## Whiteboard, special chapters and the jungle theme

- **Whiteboard** (Plan → Whiteboard): an infinite canvas for brainstorming and story maps. Boards are **tabs**: **+** adds one; double-click a tab (or F2) to rename; right-click to save a copy as a new tab, move it left or right, close it or delete it. Closing a tab keeps the board saved under **All boards** (the folder icon), where you can reopen it. Each tab keeps its own undo history and autosaves; a dot marks unsaved changes, and Ctrl+S or the save icon saves all boards immediately. Tools: select (V), pan (H or hold Space), pen (P), rectangle (R), ellipse (O), arrow (A), sticky note (N, or double-click), text (T), eraser (E). Drag to move, use the corner handle to resize, Shift-click or drag a box to multi-select, Ctrl+D to duplicate, Delete to remove, arrow keys to nudge, Ctrl+Z / Ctrl+Shift+Z to undo and redo. Ctrl+wheel zooms; the wheel pans. **Add scene card** drops a note linked to a scene (click its ↗ corner to open the scene). Boards autosave, are included in `.inkwell` backups and export to PNG.
- **Special chapters:** binder **+ → Special chapters** (Prologue, Foreword, Introduction, Interlude, Epilogue, Afterword, or a custom heading such as "Coda"). Prologues and forewords go before chapter one, epilogues and afterwords at the end, and interludes after the chapter you're in. You can also convert any chapter: right-click → **Chapter type**, or Inspector → Metadata. Special chapters are compiled unnumbered under their own heading ("Prologue", with the title underneath) and don't affect "Chapter One, Two…" numbering, including in the table of contents.
- **Jungle theme:** theme menu → **Jungle**, or Settings → Theme. Canopy greens, mango accents, parchment pages, adventure-style headings, a bamboo navigation rail, hanging vines with hibiscus flowers, corner foliage and fireflies. The decorations never block clicks, stop swaying if you prefer reduced motion, and can be switched off in Settings.

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
| **Views** | Scrivenings, split editor (vertical or horizontal; also shows research images and PDFs), and focus mode (typewriter scrolling, paragraph/sentence dimming, ambient backgrounds, optional rain sound). |
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

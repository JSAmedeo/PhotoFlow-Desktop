# Prompt for Claude Code — PhotoFlow Desktop Phase 1 Setup + Visual MVP Shell

You are working in a new VS Code project directory for **PhotoFlow Desktop**.

Read `CLAUDE.md` and `CONTEXT.md` first. Follow them as the project instructions.

## Situation

I am starting a new desktop application project. I need the first stage to be UI-first because I need to see the product visually from the beginning. The first goal is not a complete backend. The first goal is a clean, impressive, visible MVP shell that uses the Claude Design handoff as UI direction.

A Claude Design handoff zip is available and should be used as visual reference:

`Photo Processing Application-handoff.zip`

Extract it into:

`design-handoff/photo-processing-application/`

Then inspect the handoff before building.

The handoff README says the primary file is likely:

`photo-processing-application/project/snapdesk.html`

Read that file fully. Then follow its imports and inspect:

- `snapdesk.app.jsx`
- `snapdesk.gallery.jsx`
- `snapdesk.data.jsx`
- `snapdesk.icons.jsx`
- `snapdesk.photo.jsx`
- `PhotoFlow Desktop.html`
- `PhotoFlow Desktop (Standalone).html`
- included assets and uploads

Do not treat the handoff as production code. Treat it as design direction.

## First Stage Goal

Set up the IDE/project and create a visible PhotoFlow Desktop visual MVP shell.

The app should show a polished dark desktop UI with:

- Gallery/home screen
- Mock sessions
- Mock photos
- Large selected photo preview
- Session details panel
- Basic operator correction controls
- Import/ingest placeholder controls
- Local status indicators
- Clear empty/error/demo states where useful

This should feel like a real operational photography product from first launch.

## Recommended Stack

Unless you find a strong reason not to, use:

- React
- TypeScript
- Vite
- Tailwind CSS v3 (not v4 — use `tailwindcss@3` explicitly to avoid breaking setup differences) or clean CSS modules

Do not add Electron or Tauri yet unless it is very low-risk. A Vite browser dev app is acceptable for Stage 1. We can wrap it as desktop later.

If using Tailwind CSS, install it as: `npm install -D tailwindcss@3 postcss autoprefixer` and initialize with `npx tailwindcss init -p`. Do not use the Tailwind v4 (`@tailwindcss/vite`) plugin — the setup is different and not yet widely documented.

## Implementation Tasks

### 1. Inspect Current Directory

Check what files exist. Do not overwrite important files without explaining the change.

### 2. Create Project if Needed

If the directory is empty or not yet a frontend app, initialize a Vite React TypeScript project.

### 3. Preserve Design Handoff

Create:

```text
design-handoff/
```

Extract the Claude Design zip there if it exists in the project root.

### 4. Add Project Documentation

Ensure these files exist in the project root:

- `CLAUDE.md`
- `CONTEXT.md`
- `README.md`

The README should explain:

- what the project is
- how to install dependencies
- how to run the dev server
- where the design handoff lives
- current stage: Phase 1 Visual MVP Shell

### 5. Build the Initial UI Shell

Create a clean component structure. Suggested structure:

```text
src/
  components/        # shared, reusable UI primitives
  features/
    gallery/         # gallery screen and photo grid
    sessions/        # session list, session details
    operator-corrections/  # move/merge/relink/flag tools
    ingest/          # import controls and status
  data/
    mockData.ts      # sessions, photos, operator actions
  styles/            # global CSS or Tailwind base config
  main.tsx           # app entry point
  App.tsx            # root layout and routing
```

Remove `src/app/` — it overlaps with `App.tsx` and `features/` and would create confusion. Use `App.tsx` at the `src/` root as the shell layout component.

The UI should include realistic mock data for:

- sessions
- photos
- capture locations
- ingest status
- operator actions

### 6. Match the Design Direction

Use the Claude Design handoff as the visual baseline. Pull forward useful layout ideas, colors, spacing, and component behavior.

Do not copy blindly. Recreate it cleanly in the new app structure.

### 7. Keep It Runnable

After implementation:

- install dependencies: `npm install`
- verify types with: `npx tsc --noEmit` (do not use `vite build` as a typecheck — it does not surface all errors)
- start the dev server: `npm run dev`
- fix any TypeScript errors before reporting complete
- the app must load in the browser without crashing

### 8. Final Response

When finished, summarize:

- what you created
- where the key files are
- how I run it
- what I should visually check
- known limitations
- recommended next step

## Hard Constraints

Do not build backend services yet.
Do not add cloud sync.
Do not add auth/licensing.
Do not build print management beyond placeholders.
Do not hide progress in infrastructure-only work.
Do not ignore the handoff zip.

## Definition of Done

Phase 1 setup is done when:

- The app opens locally
- A polished PhotoFlow Desktop UI shell is visible
- Mock gallery/session data appears
- The design handoff is preserved and referenced
- The codebase structure is understandable
- README run instructions work

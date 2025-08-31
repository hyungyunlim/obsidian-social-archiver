# Repository Guidelines

## Project Structure & Module Organization
- Root: planning docs live in `docs/` and `reference/`.
- Planned code layout (see PROJECT_SETUP.md): `src/` with `components/` (Svelte), `services/` (SRP classes), `hooks/`, `errors/`, `workers/`; plus `manifest.json`, `tsconfig.json`, `vite.config.ts`, `.env.example`.
- Tests: colocate `*.test.ts` next to sources or under `tests/` mirroring `src/`.

## Build, Test, and Development Commands
- `npm install`: install Node deps (Node 20+).
- `npm run dev`: start Vite dev server for the Obsidian plugin UI.
- `npm run build`: production build for distribution.
- `npm test`: run unit/integration tests with Vitest.
- `npm run svelte-check`: type and Svelte diagnostics.

## Coding Style & Naming Conventions
- TypeScript strict; Svelte 5 (Runes). Indent 2 spaces.
- Components: PascalCase `*.svelte` (e.g., `ArchiveModal.svelte`).
- Services/hooks: camelCase files in `src/services` and `src/hooks` (e.g., `archiveService.ts`, `useArchiveState.ts`).
- Constants/env: SCREAMING_SNAKE_CASE; CSS via Tailwind + Obsidian vars.
- SRP first: each class/module owns one responsibility (e.g., `MarkdownConverter` only converts).

## Testing Guidelines
- Frameworks: Vitest + @testing-library/svelte; optional E2E via Playwright.
- Coverage: target ≥ 90% (goal 95% at launch).
- File names: `Foo.test.ts` for units; integration tests end with `.int.test.ts`.
- Run: `npm test` for all; `vitest --ui` for focused runs.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Keep commits scoped and atomic; include rationale in body when non-trivial.
- PRs: clear description, linked issues (`Closes #123`), before/after screenshots for UI, and test evidence (commands or artifacts). Keep PRs under ~400 lines when possible.

## Security & Configuration Tips
- Never commit secrets. Copy `.env.example` to `.env.local`; document required keys (e.g., BrightData, Perplexity, Gumroad).
- Obsidian policy: free community plugin; handle payments externally (Gumroad). No in-app payments.
- Validate external inputs; centralize errors in `src/errors/`.

## Architecture Overview
- Tech: Svelte 5 + Vite + TypeScript; Cloudflare Workers backend; SRP-oriented services.
- Reference: see `docs/social-archiver.md` and `PROJECT_SETUP.md` for detailed flows, URL patterns, and examples.


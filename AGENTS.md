# AGENTS.md

Always-loaded instructions for Codex agents working in this repository.

## Project Snapshot

- Stack: Laravel, Sail, MySQL, Redis, Breeze, Inertia, React, TypeScript, Tailwind CSS v4, Vite.
- Local development: Laravel Sail. Prefer `./vendor/bin/sail ...` for Composer, Artisan, NPM, tests, and builds.
- Auth: Breeze session auth unless the user requests OAuth or another provider.

## Autonomy

- Assume permission to scaffold, edit, and wire app files needed for the user's request.
- Ask only when a decision is destructive, needs secrets or paid services, affects unrelated user work, or cannot be inferred.

## Implementation Defaults

- Prefer Laravel conventions: controllers, form requests, policies, resources when useful, Eloquent relationships/scopes, migrations, factories, and feature tests.
- Prefer Inertia patterns: typed page props, `Head`, `Link`, `useForm`, Ziggy `route()`, and shared props for auth/flash/config.
- Prefer reusable React components under `resources/js/Components` and pages under `resources/js/Pages`.
- Keep TypeScript strict and accessible React markup.
- Use Tailwind CSS v4 tokens/CSS variables for reusable styling.

## Quality Bar

- Preserve user work; never revert unrelated changes.
- Do not commit secrets or real `.env` values.
- Run the most relevant verification for the change: tests, lint/typecheck, build, route checks, or browser checks. Report anything that could not be run.

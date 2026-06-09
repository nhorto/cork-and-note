---
name: SupabaseCLI
description: Use the Supabase CLI against this project's Cork & Note backend — authenticate, link the right cloud project, run the local stack, pull/push schema, write and apply migrations, deploy the `chat` edge function and set its secrets, and generate TypeScript types. USE WHEN the user wants to run any `supabase` command, log into the Supabase CLI, link or switch projects, create/apply a database migration, change the remote schema, deploy or serve an edge function, set function secrets, generate database types, start or stop the local Supabase stack, or troubleshoot the macOS keychain login prompt — even if they don't name the CLI explicitly.
---

# Supabase CLI (Cork & Note)

This project (`testProject`, the **Cork & Note** wine app — Expo / React Native)
uses the Supabase CLI to manage a hosted Postgres database, auth, storage, and a
single edge function. This skill captures the project-specific facts so you run
the **right** command against the **right** project without guessing.

The CLI is installed (`supabase --version` → 2.x). Run all commands from the repo
root so the CLI finds `supabase/config.toml`.

## Project facts — memorize these

| Thing | Value |
|---|---|
| **Current cloud project** (linked target) | `ixecayqpogkiawempzgc` — "Cork and Note", East US (Ohio), created 2026‑06‑08 |
| **Old / paused project — do NOT target** | `basevzvvmeiqhulshkkx` — "Cork & Note", 2025‑05‑13 (pre‑redesign) |
| Local config | `supabase/config.toml` (`project_id = "testProject"`, Postgres **17**, API port `54321`) |
| Migrations | `supabase/migrations/*.sql` (timestamp‑prefixed, applied in filename order) |
| Edge function | `chat` — Anthropic/Claude proxy ("AI sommelier") at `supabase/functions/chat/index.ts` |
| App client | `lib/supabase.js` — reads `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Schema reference | `DataBase Schema.txt` at repo root |

There are **two** cloud projects with nearly identical names. This is the single
biggest footgun: a stray `--project-id basevzvvmeiqhulshkkx` or relinking to the
old one will read/write the wrong database. When a command takes a project ref,
it should be `ixecayqpogkiawempzgc` unless the user explicitly says otherwise.

## Authentication

Auth is already set up on this machine via a personal access token exported in
`~/.zshrc`:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
```

**Why this matters for you:** when `SUPABASE_ACCESS_TOKEN` is set, the CLI uses it
directly and does **not** read the macOS Keychain — so commands run silently with
no password popup. If you ever shell out and the var isn't present, `source
~/.zshrc` first, or prefix the command inline: `SUPABASE_ACCESS_TOKEN=sbp_... supabase ...`.

- **Interactive login** (only needed on a new machine / after revoking the token):
  `supabase login` — opens the browser, you paste a verification code. This stores
  the token in the **macOS Keychain**, which is why bare `supabase` commands then
  trigger a "supabase wants to use your confidential information" dialog asking for
  the **Mac login password**. Click **Always Allow** (not just Allow) to stop the
  repeated prompts — or prefer the env-var approach above to skip the keychain
  entirely.
- **Token-based login** (headless / CI): `supabase login --token sbp_...`, or just
  set `SUPABASE_ACCESS_TOKEN`. Generate tokens at
  https://supabase.com/dashboard/account/tokens.
- **Verify auth:** `supabase projects list` (the linked project shows a ● in the
  LINKED column).

## Linking

The repo is already linked to `ixecayqpogkiawempzgc`. The link lives in
`supabase/.temp/` (gitignored), so a fresh clone — or a new git worktree — won't
have it and must be relinked.

```bash
supabase link --project-ref ixecayqpogkiawempzgc   # prompts for DB password; Enter skips it
supabase projects list                              # confirm the ● is on the right row
```

To switch projects, just `link` again with the other ref. There is no separate
"unlink the old one" step needed before relinking, but `supabase unlink` exists if
you want a clean slate.

## Local development stack (optional, needs Docker)

`supabase start` boots a full local stack (Postgres, Auth, Storage, Studio, the
edge runtime) in Docker — useful for testing migrations and functions without
touching the cloud. It requires Docker Desktop running.

```bash
supabase start        # boot local stack; prints local URLs + keys
supabase status       # show running containers and local credentials
supabase stop         # shut it down
```

Local API is at `http://localhost:54321`, Studio UI at `http://localhost:54323`.
If the user just wants to change the real backend, you can skip the local stack
and work against the linked project directly (`db pull` / `db push`).

## Database & migrations

Migrations are plain SQL files in `supabase/migrations/`, applied in filename
(timestamp) order. The workflow is: **write a migration → test locally → push to
the cloud.**

```bash
# Create a new, empty migration to hand-write SQL into:
supabase migration new <descriptive_name>     # e.g. add_tasting_notes_column

# See which migrations exist locally vs. applied on the remote:
supabase migration list

# Apply pending migrations to the LOCAL db (needs `supabase start`):
supabase migration up

# Reset the LOCAL db: drop, recreate, replay all migrations + seed.
# LOCAL ONLY — safe to run; it never touches the cloud:
supabase db reset

# Push local migrations to the LINKED cloud project:
supabase db push

# Pull the remote schema down into a new migration file
# (captures changes made in the dashboard so they're tracked in git):
supabase db pull

# Diff local schema changes into SQL without writing a migration:
supabase db diff -f <name>
```

**Safety:** `db reset` only ever affects the **local** database. `db push` is the
command that mutates the **cloud** schema — pause and confirm with the user before
pushing, and make sure you're linked to `ixecayqpogkiawempzgc`, not the old
project. Never hand-edit a migration that's already been pushed; write a new one.

## Edge functions

There's one function, `chat` (a Claude/Anthropic proxy powering the AI
sommelier). It reads `ANTHROPIC_API_KEY` from its environment; `SUPABASE_URL` and
`SUPABASE_ANON_KEY` are injected automatically by the platform, so the only secret
you need to manage is the Anthropic key.

```bash
# Run functions locally (needs the local stack / Docker):
supabase functions serve chat

# Deploy to the linked cloud project:
supabase functions deploy chat

# Manage the function's secrets on the cloud project:
supabase secrets list
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets unset SOME_KEY

# Scaffold a new function:
supabase functions new <name>
```

For **local** function runs, secrets come from a local env file rather than
`supabase secrets`. If a locally-served function needs `ANTHROPIC_API_KEY`, pass
an env file: `supabase functions serve chat --env-file supabase/functions/.env`
(keep that file out of git).

## Generating TypeScript types

The app code is currently plain JS (`lib/*.js`), so generated types aren't wired
in yet — but if the user wants typed Supabase queries, generate them from the
linked project:

```bash
supabase gen types --linked --lang typescript > lib/database.types.ts
```

Use `--local` instead of `--linked` to generate from the local stack, or
`--project-id ixecayqpogkiawempzgc` to be explicit about the target. Default
language is TypeScript; `--lang` also supports go, swift, python.

## Conventions for this repo

- **Run from the repo root** so `supabase/config.toml` is picked up.
- **Always target `ixecayqpogkiawempzgc`** unless told otherwise — the old
  `basevzvvmeiqhulshkkx` project shares almost the same name and is a trap.
- **Confirm before cloud-mutating commands** (`db push`, `functions deploy`,
  `secrets set`) — these change the live backend that the app and real users hit.
- **Keep secrets out of git.** Tokens and `ANTHROPIC_API_KEY` belong in
  `~/.zshrc`, the dashboard, or gitignored env files — never in a migration,
  committed config, or a function's source.
- When schema changes, capture them as a tracked migration (`db pull` or a
  hand-written `migration new`) rather than leaving them dashboard-only, so the
  repo stays the source of truth.

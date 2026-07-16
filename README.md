# Cork & Note

Cork & Note is a wine tasting journal for iOS and Android, built with
[Expo](https://expo.dev) (SDK 53) and [Supabase](https://supabase.com).

- **Log winery visits and tastings** — record wines, varietals, ratings,
  flavor notes, and photos; scan tasting cards to prefill entries.
- **Cellar tracking** — keep an inventory of bottles you own, link them to
  prior tastings, and track consumption.
- **AI sommelier** — chat about your wines and get pairing suggestions,
  powered by a Supabase Edge Function.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root with your Supabase credentials:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

3. Start the app (a development build is required — the app uses native
   modules like maps and camera, so Expo Go won't work):

   ```bash
   npm run dev      # expo start --dev-client
   npm start        # plain expo start
   ```

### Builds

Cloud builds run through [EAS](https://docs.expo.dev/eas/):

```bash
npm run build:dev                     # development build
eas build --profile production       # store build (channel: production)
```

## Building the native iOS dev client

The iOS build has two environment requirements that are handled for you by
`scripts/ios-build.sh` (run it via `npm run ios:build`):

```bash
npm run ios:build            # build + launch on a simulator
npm run ios:build -- --clean # regenerate ios/ from scratch first
```

What the script (and the project config) take care of:

1. **UTF-8 locale.** CocoaPods crashes ("Unicode Normalization not appropriate
   for ASCII-8BIT") unless the shell uses a UTF-8 locale. The script exports
   `LANG`/`LC_ALL=en_US.UTF-8`. If you run `npx expo run:ios` directly instead,
   export these yourself first:

   ```bash
   export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
   ```

2. **fmt `consteval` compile error.** react-native 0.79.x pins the `fmt` pod to
   git tag `11.0.2` (this does **not** change between 0.79.4–0.79.7). With the
   current Xcode/Apple-Clang, fmt 11.0.2's `consteval`-based `FMT_STRING` fails
   to compile (`call to consteval function ... is not a constant expression` in
   `ios/Pods/fmt/include/fmt/format-inl.h`). The
   [`plugins/withFmtConstevalFix`](plugins/withFmtConstevalFix.js) Expo config
   plugin injects a CocoaPods `post_install` hook that forces
   `FMT_USE_CONSTEVAL 0` in `Pods/fmt/include/fmt/base.h` on every `pod install`,
   so the fix survives `expo prebuild --clean`. (A `-DFMT_USE_CONSTEVAL=0`
   compiler flag does not work — base.h `#define`s the macro unconditionally
   with no `#ifndef` guard, so the header value always wins.)

## Supabase backend

The backend lives in `supabase/`:

- **`supabase/migrations/`** — SQL migrations for the database schema
  (visits, wines, cellar inventory, chat, storage buckets, RLS policies).
  Apply them with the Supabase CLI: `supabase db push` (remote) or
  `supabase db reset` (local stack).
- **`supabase/functions/chat/`** — the Edge Function behind the AI sommelier.
  Deploy with `supabase functions deploy chat`.

Link the CLI to your project first with `supabase link`.

## Project layout

- `app/` — screens (Expo Router file-based routing; tabs live in `app/(tabs)/`)
- `components/` — shared UI components
- `lib/` — Supabase client and data services
- `styles/theme.js` — the "Château Label" design system (colors, typography)
- `plugins/` — local Expo config plugins

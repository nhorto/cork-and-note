# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

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

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

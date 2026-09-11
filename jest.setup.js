// jest.setup.js: mocks every test needs and none should have to re-declare.
//
// AsyncStorage is a native module with no implementation under jest; the
// official in-memory mock is what twelve test files were each registering by
// hand. Registering it here means a test that forgets it fails with a real
// assertion instead of "NativeModule: AsyncStorage is null". A test file's own
// jest.mock of the same module still wins, so nothing existing changes.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// react-native-reanimated's real native side is absent under jest.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

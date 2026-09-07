// lib/updates.js triggers a reload when a new bundle is ready, so its guards
// matter: firing during development would reload the app out from under a
// reload cycle. Jest runs with __DEV__ true, which is exactly that case.
jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

import * as Updates from 'expo-updates';
import { checkForUpdate } from '../lib/updates';

describe('checkForUpdate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('never touches the update server in development', async () => {
    expect(__DEV__).toBe(true);
    await expect(checkForUpdate({ force: true })).resolves.toBe(false);
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });
});

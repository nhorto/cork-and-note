import { configureMetaAppEvents } from '../lib/metaAppEventsCore';

const settings = () => ({
  setAdvertiserIDCollectionEnabled: jest.fn(),
  setAutoLogAppEventsEnabled: jest.fn(),
  setAdvertiserTrackingEnabled: jest.fn().mockResolvedValue(true),
  initializeSDK: jest.fn(),
});

describe('Meta app-event consent boundary', () => {
  it('enables advertiser identifiers only after iOS permission is granted', async () => {
    const sdk = settings();
    const result = await configureMetaAppEvents({
      platform: 'ios',
      enabled: true,
      requestPermission: jest.fn().mockResolvedValue({ status: 'granted' }),
      settings: sdk,
    });

    expect(sdk.setAdvertiserIDCollectionEnabled).toHaveBeenCalledWith(true);
    expect(sdk.setAdvertiserTrackingEnabled).toHaveBeenCalledWith(true);
    expect(sdk.setAutoLogAppEventsEnabled).toHaveBeenCalledWith(true);
    expect(sdk.initializeSDK).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ initialized: true, permissionStatus: 'granted', trackingAllowed: true });
  });

  it('keeps advertiser identifiers disabled when permission is denied', async () => {
    const sdk = settings();
    const result = await configureMetaAppEvents({
      platform: 'ios',
      enabled: true,
      requestPermission: jest.fn().mockResolvedValue({ status: 'denied' }),
      settings: sdk,
    });

    expect(sdk.setAdvertiserIDCollectionEnabled).toHaveBeenCalledWith(false);
    expect(sdk.setAdvertiserTrackingEnabled).toHaveBeenCalledWith(false);
    expect(sdk.initializeSDK).toHaveBeenCalledTimes(1);
    expect(result.trackingAllowed).toBe(false);
  });

  it('does nothing in builds without Meta configuration', async () => {
    const sdk = settings();
    const requestPermission = jest.fn();
    const result = await configureMetaAppEvents({
      platform: 'ios',
      enabled: false,
      requestPermission,
      settings: sdk,
    });

    expect(requestPermission).not.toHaveBeenCalled();
    expect(sdk.initializeSDK).not.toHaveBeenCalled();
    expect(result).toEqual({ initialized: false, reason: 'not-configured' });
  });
});

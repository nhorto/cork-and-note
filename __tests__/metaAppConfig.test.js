const configureApp = require('../app.config');

const originalMetaAppId = process.env.META_APP_ID;
const originalMetaClientToken = process.env.META_CLIENT_TOKEN;

function baseConfig() {
  return {
    plugins: ['expo-router'],
    extra: { existing: true },
  };
}

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore('META_APP_ID', originalMetaAppId);
  restore('META_CLIENT_TOKEN', originalMetaClientToken);
});

describe('Meta native build configuration', () => {
  it('leaves Meta disabled when neither build value exists', () => {
    delete process.env.META_APP_ID;
    delete process.env.META_CLIENT_TOKEN;

    const config = configureApp({ config: baseConfig() });

    expect(config.extra.metaAppEventsEnabled).toBe(false);
    expect(config.plugins).toEqual(['expo-router']);
  });

  it('fails the build when only one Meta value exists', () => {
    process.env.META_APP_ID = '123456789';
    delete process.env.META_CLIENT_TOKEN;

    expect(() => configureApp({ config: baseConfig() })).toThrow(
      'META_APP_ID and META_CLIENT_TOKEN must either both be set or both be absent.',
    );
  });

  it('injects consent-first iOS settings when both values exist', () => {
    process.env.META_APP_ID = '123456789';
    process.env.META_CLIENT_TOKEN = 'client-token';

    const config = configureApp({ config: baseConfig() });
    const [, props] = config.plugins.find(([name]) => name === 'react-native-fbsdk-next');

    expect(config.extra).toMatchObject({ existing: true, metaAppEventsEnabled: true });
    expect(props).toMatchObject({
      appID: '123456789',
      clientToken: 'client-token',
      displayName: 'Cork & Note',
      scheme: 'fb123456789',
      advertiserIDCollectionEnabled: false,
      autoLogAppEventsEnabled: true,
      isAutoInitEnabled: false,
    });
    expect(props.iosUserTrackingPermission).toContain('measure which ads lead to app downloads');
  });
});

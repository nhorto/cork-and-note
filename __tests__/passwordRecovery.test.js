import { establishPasswordRecovery, parseRecoveryParams } from '../lib/passwordRecovery';

describe('password recovery', () => {
  const recovery = 'corkandnote://reset-password#access_token=test-access&refresh_token=test-refresh&type=recovery';
  it('uses the reset link even when another account is already signed in', async () => {
    const auth = {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'other-user' } } } }),
      setSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'recovering-user' } } } }),
    };
    await expect(establishPasswordRecovery(recovery, auth)).resolves.toMatchObject({ user: { id: 'recovering-user' } });
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'test-access', refresh_token: 'test-refresh' });
  });
  it('does not authorize a reset from a bare route, expired link, or signup token', async () => {
    const auth = { setSession: jest.fn(), exchangeCodeForSession: jest.fn() };
    for (const url of [null, 'corkandnote://reset-password', recovery.replace('type=recovery', 'type=signup'), 'corkandnote://reset-password#error=access_denied']) {
      await expect(establishPasswordRecovery(url, auth)).rejects.toThrow();
    }
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('exchanges PKCE links and rejects failed or empty exchanges', async () => {
    const auth = { exchangeCodeForSession: jest.fn().mockResolvedValue({ data: { session: null }, error: new Error('Expired') }) };
    await expect(establishPasswordRecovery('corkandnote://reset-password?code=one-time-code', auth)).rejects.toThrow('Expired');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('one-time-code');
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null } });
    await expect(establishPasswordRecovery('corkandnote://reset-password?code=empty', auth)).rejects.toThrow();
    expect(parseRecoveryParams('not a url')).toBeNull();
  });
});

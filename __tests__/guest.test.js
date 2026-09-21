// Guest accounts (epic #316): what each helper asks Supabase for, that the
// link path preserves the user id, that a sign-in from a guest stamps a claim
// BEFORE switching sessions and merges AFTER, and that a merge failure never
// turns a successful sign-in into an error.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dismissGuestCard,
  isGuestCardDismissed,
  isGuestUser,
  linkGuestAccount,
  noteGuestFirstLog,
  signInFromGuest,
  startGuestSession,
  takeGuestFirstLogNudge,
} from '../lib/guest';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const fake = () => ({
  auth: {
    signInAnonymously: jest.fn(),
    updateUser: jest.fn(),
    signInWithPassword: jest.fn(),
  },
  rpc: jest.fn(),
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('isGuestUser', () => {
  it('is true only for an anonymous Supabase user', () => {
    expect(isGuestUser({ id: 'g', is_anonymous: true })).toBe(true);
    expect(isGuestUser({ id: 'u', is_anonymous: false })).toBe(false);
    expect(isGuestUser({ id: 'u' })).toBe(false);
    expect(isGuestUser(null)).toBe(false);
  });
});

describe('startGuestSession', () => {
  it('returns the anonymous session and user', async () => {
    const sb = fake();
    sb.auth.signInAnonymously.mockResolvedValue({
      data: { session: { access_token: 't' }, user: { id: 'g', is_anonymous: true } },
      error: null,
    });
    const r = await startGuestSession(sb);
    expect(r.error).toBeNull();
    expect(r.user.id).toBe('g');
  });

  it('reports an offline failure instead of throwing', async () => {
    const sb = fake();
    sb.auth.signInAnonymously.mockRejectedValue(new Error('Network request failed'));
    const r = await startGuestSession(sb);
    expect(r.error.message).toMatch(/Network/);
    expect(r.session).toBeNull();
  });
});

describe('linkGuestAccount', () => {
  it('links email + password + name onto the CURRENT user (no signUp, so the id is kept)', async () => {
    const sb = fake();
    sb.auth.updateUser.mockResolvedValue({
      data: { user: { id: 'g', is_anonymous: false, email: 'a@b.co' } },
      error: null,
    });
    const r = await linkGuestAccount(sb, { email: 'a@b.co', password: 'Passw0rd', name: 'Nick' });
    expect(sb.auth.updateUser).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'Passw0rd',
      data: { name: 'Nick' },
    });
    expect(r.data.user.id).toBe('g');
    expect(r.data.user.is_anonymous).toBe(false);
  });

  it('normalises a taken address to the message the register screen already handles', async () => {
    const sb = fake();
    sb.auth.updateUser.mockResolvedValue({
      data: null,
      error: { code: 'email_exists', message: 'A user with this email address has already been registered' },
    });
    const r = await linkGuestAccount(sb, { email: 'a@b.co', password: 'x', name: '' });
    expect(r.error.message).toBe('User already registered');
  });
});

describe('signInFromGuest', () => {
  it('stamps a claim while still a guest, signs in, then merges into the real account', async () => {
    const sb = fake();
    const order = [];
    sb.rpc.mockImplementation(async (name, args) => {
      order.push(name);
      if (name === 'stamp_guest_claim') return { data: 'tok-1', error: null };
      if (name === 'merge_guest_account') {
        expect(args).toEqual({ p_guest_id: 'guest-1', p_token: 'tok-1' });
        return { data: { visits: 3 }, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    });
    sb.auth.signInWithPassword.mockImplementation(async () => {
      order.push('signIn');
      return { data: { user: { id: 'real-1', is_anonymous: false } }, error: null };
    });

    const r = await signInFromGuest(sb, { guestId: 'guest-1', email: 'a@b.co', password: 'p' });
    expect(order).toEqual(['stamp_guest_claim', 'signIn', 'merge_guest_account']);
    expect(r.error).toBeNull();
    expect(r.merged).toEqual({ moved: { visits: 3 } });
  });

  it('does not stamp or merge when there is no guest (plain sign-in)', async () => {
    const sb = fake();
    sb.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'real-1' } }, error: null });
    const r = await signInFromGuest(sb, { email: 'a@b.co', password: 'p' });
    expect(sb.rpc).not.toHaveBeenCalled();
    expect(r.merged).toBeNull();
  });

  it('surfaces a wrong password without touching the merge', async () => {
    const sb = fake();
    sb.rpc.mockResolvedValue({ data: 'tok', error: null });
    sb.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });
    const r = await signInFromGuest(sb, { guestId: 'g', email: 'a@b.co', password: 'bad' });
    expect(r.error.message).toMatch(/Invalid/);
    expect(sb.rpc).toHaveBeenCalledTimes(1); // the stamp only
  });

  it('keeps the sign-in successful when the merge itself fails', async () => {
    const sb = fake();
    sb.rpc.mockImplementation(async (name) =>
      name === 'stamp_guest_claim'
        ? { data: 'tok', error: null }
        : { data: null, error: { message: 'invalid or expired guest claim' } }
    );
    sb.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'real' } }, error: null });
    const r = await signInFromGuest(sb, { guestId: 'g', email: 'a@b.co', password: 'p' });
    expect(r.error).toBeNull();
    expect(r.merged).toEqual({ error: 'invalid or expired guest claim' });
  });

  it('skips the merge when the signed-in user IS the guest (linked account signing back in)', async () => {
    const sb = fake();
    sb.rpc.mockResolvedValue({ data: 'tok', error: null });
    sb.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'g' } }, error: null });
    const r = await signInFromGuest(sb, { guestId: 'g', email: 'a@b.co', password: 'p' });
    expect(r.merged).toBeNull();
    expect(sb.rpc).not.toHaveBeenCalledWith('merge_guest_account', expect.anything());
  });
});

describe('nudge bookkeeping', () => {
  it('the first-log sheet is pending after the first save and consumed exactly once', async () => {
    expect(await noteGuestFirstLog()).toBe(true);
    expect(await noteGuestFirstLog()).toBe(false);
    expect(await takeGuestFirstLogNudge()).toBe(true);
    expect(await takeGuestFirstLogNudge()).toBe(false);
    // A later save must not re-arm it.
    expect(await noteGuestFirstLog()).toBe(false);
    expect(await takeGuestFirstLogNudge()).toBe(false);
  });

  it('the Home card stays dismissed', async () => {
    expect(await isGuestCardDismissed()).toBe(false);
    await dismissGuestCard();
    expect(await isGuestCardDismissed()).toBe(true);
  });
});

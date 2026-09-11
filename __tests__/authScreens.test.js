// Behaviour tests for the auth screens: what each button actually asks the
// auth context / Supabase for, how the email is normalised, the three sign-up
// outcomes, and that every screen that sets a password applies the SAME rule.
import { act, create } from 'react-test-renderer';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { establishPasswordRecovery } from '../lib/passwordRecovery';
import { AuthContext } from '../app/_layout';
import LoginScreen from '../app/login';
import RegisterScreen from '../app/register';
import ForgotPasswordScreen from '../app/forgot-password';
import ResetPasswordScreen from '../app/reset-password';
import ChangePasswordScreen from '../app/profile/change-password';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, setParams: jest.fn() }),
  Link: ({ children }) => children,
  useFocusEffect: (callback) => require('react').useEffect(callback, []),
}));
jest.mock('expo-linking', () => ({
  useURL: () => 'corkandnote://reset-password#access_token=a&refresh_token=r&type=recovery',
  getInitialURL: jest.fn().mockResolvedValue(null),
}));
// The root layout drags in the whole app; the screens only need the context object.
jest.mock('../app/_layout', () => ({ AuthContext: require('react').createContext({}) }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../lib/passwordRecovery', () => ({ establishPasswordRecovery: jest.fn() }));
jest.mock('../lib/supabase', () => ({
  supabase: { auth: { updateUser: jest.fn(), signInWithPassword: jest.fn() }, from: jest.fn(), functions: {} },
}));

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const input = (tree, placeholder) =>
  tree.root.findAllByType(TextInput).find((n) => n.props.placeholder === placeholder);
const type = async (tree, placeholder, value) => {
  await act(async () => input(tree, placeholder).props.onChangeText(value));
};
const pressText = async (tree, label) => {
  const btn = tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => n.findAllByType(Text).some((t) => t.props.children === label));
  if (!btn) throw new Error(`No button labelled ${label}`);
  await act(async () => btn.props.onPress());
  await flush();
};

const renderWithAuth = async (element, auth) => {
  let tree;
  await act(async () => {
    tree = create(<AuthContext.Provider value={auth}>{element}</AuthContext.Provider>);
  });
  await flush();
  return tree;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('LoginScreen', () => {
  it('refuses an empty form without calling signIn', async () => {
    const signIn = jest.fn();
    const tree = await renderWithAuth(<LoginScreen />, { signIn });
    await pressText(tree, 'Log in');
    expect(signIn).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter both email and password');
  });

  it('trims and lowercases the email before signing in, and surfaces the auth error', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: { message: 'Invalid email or password.' } });
    const tree = await renderWithAuth(<LoginScreen />, { signIn });
    await type(tree, 'Email address', '  Nick@Example.com ');
    await type(tree, 'Password', 'Secret123');
    await pressText(tree, 'Log in');
    expect(signIn).toHaveBeenCalledWith('nick@example.com', 'Secret123');
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid email or password.');
  });

  it('does not alert on success and leaves navigation to the guard', async () => {
    const signIn = jest.fn().mockResolvedValue({ error: null, data: {} });
    const tree = await renderWithAuth(<LoginScreen />, { signIn });
    await type(tree, 'Email address', 'nick@example.com');
    await type(tree, 'Password', 'Secret123');
    await pressText(tree, 'Log in');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('RegisterScreen', () => {
  const fill = async (tree, { password = 'Secret123', confirm = password } = {}) => {
    await type(tree, 'Full name', 'Nick');
    await type(tree, 'Email address', ' Nick@Example.com ');
    await type(tree, 'Password', password);
    await type(tree, 'Confirm password', confirm);
  };

  it('rejects a password with no uppercase or digit and never calls signUp', async () => {
    const signUp = jest.fn();
    const tree = await renderWithAuth(<RegisterScreen />, { signUp, signIn: jest.fn() });
    await fill(tree, { password: 'password' });
    await pressText(tree, 'Sign up');
    expect(signUp).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Password Requirements Not Met',
      expect.stringContaining('one uppercase letter')
    );
    expect(Alert.alert.mock.calls[0][1]).toContain('one number');
    // The live checklist under the field agrees with the validator.
    const all = texts(tree);
    expect(all).toContain('One uppercase letter');
    expect(all).toContain('One number');
  });

  it('rejects mismatched confirmation before touching the network', async () => {
    const signUp = jest.fn();
    const tree = await renderWithAuth(<RegisterScreen />, { signUp, signIn: jest.fn() });
    await fill(tree, { password: 'Secret123', confirm: 'Secret124' });
    await pressText(tree, 'Sign up');
    expect(signUp).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Passwords do not match');
  });

  it('treats an empty identities array as an existing account and offers sign-in', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: null, data: { user: { id: 'u1', identities: [] }, session: null } });
    const signIn = jest.fn();
    const tree = await renderWithAuth(<RegisterScreen />, { signUp, signIn });
    await fill(tree);
    await pressText(tree, 'Sign up');
    expect(signUp).toHaveBeenCalledWith('nick@example.com', 'Secret123', 'Nick');
    expect(signIn).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Account Already Exists',
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ text: 'Sign In' })])
    );
    const buttons = Alert.alert.mock.calls[0][2];
    buttons.find((b) => b.text === 'Sign In').onPress();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('shows the same existing-account prompt for the explicit "User already registered" error', async () => {
    const signUp = jest.fn().mockResolvedValue({ error: { message: 'User already registered' } });
    const tree = await renderWithAuth(<RegisterScreen />, { signUp, signIn: jest.fn() });
    await fill(tree);
    await pressText(tree, 'Sign up');
    expect(Alert.alert).toHaveBeenCalledWith('Account Already Exists', expect.any(String), expect.any(Array));
  });

  it('does nothing further when a session comes back (the nav guard takes over)', async () => {
    const signUp = jest.fn().mockResolvedValue({
      error: null,
      data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: { access_token: 't' } },
    });
    const signIn = jest.fn();
    const tree = await renderWithAuth(<RegisterScreen />, { signUp, signIn });
    await fill(tree);
    await pressText(tree, 'Sign up');
    expect(signIn).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('auto signs in when no session comes back, and explains email confirmation if that fails', async () => {
    const signUp = jest.fn().mockResolvedValue({
      error: null,
      data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: null },
    });
    const signIn = jest.fn().mockResolvedValue({ error: { message: 'Email not confirmed' } });
    const tree = await renderWithAuth(<RegisterScreen />, { signUp, signIn });
    await fill(tree);
    await pressText(tree, 'Sign up');
    expect(signIn).toHaveBeenCalledWith('nick@example.com', 'Secret123');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Confirm your email',
      expect.stringContaining('confirmation link'),
      expect.any(Array)
    );
    Alert.alert.mock.calls[0][2][0].onPress();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('stays quiet when the auto sign-in succeeds', async () => {
    const signUp = jest.fn().mockResolvedValue({
      error: null,
      data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: null },
    });
    const signIn = jest.fn().mockResolvedValue({ error: null });
    const tree = await renderWithAuth(<RegisterScreen />, { signUp, signIn });
    await fill(tree);
    await pressText(tree, 'Sign up');
    expect(signIn).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('ForgotPasswordScreen', () => {
  it('requires an email, normalises it, then shows the sent state', async () => {
    const resetPassword = jest.fn().mockResolvedValue({ error: null });
    const tree = await renderWithAuth(<ForgotPasswordScreen />, { resetPassword });
    await pressText(tree, 'Send reset link');
    expect(resetPassword).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter your email address');

    await type(tree, 'Email address', ' Nick@Example.com ');
    await pressText(tree, 'Send reset link');
    expect(resetPassword).toHaveBeenCalledWith('nick@example.com');
    expect(texts(tree)).toContain('Check your email');
    await pressText(tree, 'Back to login');
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('keeps the form and alerts when the reset request fails', async () => {
    const resetPassword = jest.fn().mockResolvedValue({ error: { message: 'Rate limited' } });
    const tree = await renderWithAuth(<ForgotPasswordScreen />, { resetPassword });
    await type(tree, 'Email address', 'nick@example.com');
    await pressText(tree, 'Send reset link');
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Rate limited');
    expect(texts(tree)).not.toContain('Check your email');
    expect(input(tree, 'Email address')).toBeDefined();
  });
});

describe('ResetPasswordScreen', () => {
  const render = async () => {
    let tree;
    await act(async () => {
      tree = create(<ResetPasswordScreen />);
    });
    await flush();
    return tree;
  };

  it('shows the expired-link state and routes to a new request when the exchange fails', async () => {
    establishPasswordRecovery.mockRejectedValue(new Error('expired'));
    const tree = await render();
    expect(texts(tree)).toContain('Link expired');
    await pressText(tree, 'Request a new link');
    expect(mockReplace).toHaveBeenCalledWith('/forgot-password');
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('applies the same password rule as sign-up: "password1" has no uppercase, so it is refused', async () => {
    establishPasswordRecovery.mockResolvedValue({ user: { id: 'u1' } });
    const tree = await render();
    await type(tree, 'New password', 'password1');
    await type(tree, 'Confirm new password', 'password1');
    await pressText(tree, 'Update password');
    // Sign-up would have rejected this password; the reset form must too.
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(texts(tree).some((t) => /uppercase/i.test(t))).toBe(true);
  });

  it('updates the password, confirms, and lands on Home', async () => {
    establishPasswordRecovery.mockResolvedValue({ user: { id: 'u1' } });
    supabase.auth.updateUser.mockResolvedValue({ error: null });
    const tree = await render();
    await type(tree, 'New password', 'Secret123');
    await type(tree, 'Confirm new password', 'Secret123');
    await pressText(tree, 'Update password');
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'Secret123' });
    expect(Alert.alert).toHaveBeenCalledWith('Password updated', expect.any(String));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('shows the server error inline and stays on the form', async () => {
    establishPasswordRecovery.mockResolvedValue({ user: { id: 'u1' } });
    supabase.auth.updateUser.mockResolvedValue({ error: { message: 'New password should be different.' } });
    const tree = await render();
    await type(tree, 'New password', 'Secret123');
    await type(tree, 'Confirm new password', 'Secret123');
    await pressText(tree, 'Update password');
    expect(texts(tree)).toContain('New password should be different.');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('ChangePasswordScreen', () => {
  const user = { email: 'nick@example.com' };
  const fill = async (tree, { current = 'OldSecret1', next = 'Secret123', confirm = next } = {}) => {
    await type(tree, 'Enter your current password', current);
    await type(tree, 'Enter your new password', next);
    await type(tree, 'Confirm your new password', confirm);
  };

  it('applies the sign-up password rule to the new password', async () => {
    const tree = await renderWithAuth(<ChangePasswordScreen />, { user });
    await fill(tree, { next: 'password1' });
    await pressText(tree, 'Update password');
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Password Requirements Not Met',
      expect.stringContaining('one uppercase letter')
    );
  });

  it('refuses when the current password is wrong and never calls updateUser', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const tree = await renderWithAuth(<ChangePasswordScreen />, { user });
    await fill(tree);
    await pressText(tree, 'Update password');
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'nick@example.com', password: 'OldSecret1' });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Current password is incorrect');
  });

  it('verifies the current password, updates, and goes back on OK', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: null });
    supabase.auth.updateUser.mockResolvedValue({ error: null });
    const tree = await renderWithAuth(<ChangePasswordScreen />, { user });
    await fill(tree);
    await pressText(tree, 'Update password');
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'Secret123' });
    expect(Alert.alert).toHaveBeenCalledWith('Success', expect.any(String), expect.any(Array));
    const [, , buttons] = Alert.alert.mock.calls.find((c) => c[0] === 'Success');
    act(() => buttons[0].onPress());
    expect(mockBack).toHaveBeenCalled();
  });
});

/** Validate the link itself; an unrelated existing login is never recovery proof. */
export function parseRecoveryParams(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const fragment = new URLSearchParams(parsed.hash.slice(1));
    if (fragment.get('error') || parsed.searchParams.get('error')) return null;
    const access_token = fragment.get('access_token');
    const refresh_token = fragment.get('refresh_token');
    if (fragment.get('type') === 'recovery' && access_token && refresh_token) {
      return { access_token, refresh_token };
    }
    // `{{ .TokenHash }}` form. The email can link straight at the app scheme
    // with the hash as a QUERY parameter, skipping the Supabase /verify hop and
    // the browser entirely, so nothing depends on a URL fragment surviving a
    // redirect into the app and no link-scanner can burn the one-time token by
    // fetching it. Supported here so the recovery email template can be
    // switched server-side, with no new build, if the implicit flow above ever
    // proves unreliable on a real device.
    const token_hash = parsed.searchParams.get('token_hash');
    if (token_hash && parsed.searchParams.get('type') === 'recovery') {
      return { token_hash };
    }
    const code = parsed.searchParams.get('code');
    return code ? { code } : null;
  } catch { return null; }
}

export async function establishPasswordRecovery(url, auth) {
  const credentials = parseRecoveryParams(url);
  if (!credentials) throw new Error('This password reset link is invalid or expired.');
  let result;
  if (credentials.code) {
    result = await auth.exchangeCodeForSession(credentials.code);
  } else if (credentials.token_hash) {
    result = await auth.verifyOtp({ token_hash: credentials.token_hash, type: 'recovery' });
  } else {
    result = await auth.setSession(credentials);
  }
  const { data, error } = result;
  if (error) throw error;
  if (!data?.session) throw new Error('Could not open the password reset session.');
  return data.session;
}

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
    const code = parsed.searchParams.get('code');
    return code ? { code } : null;
  } catch { return null; }
}

export async function establishPasswordRecovery(url, auth) {
  const credentials = parseRecoveryParams(url);
  if (!credentials) throw new Error('This password reset link is invalid or expired.');
  const { data, error } = credentials.code
    ? await auth.exchangeCodeForSession(credentials.code)
    : await auth.setSession(credentials);
  if (error) throw error;
  if (!data?.session) throw new Error('Could not open the password reset session.');
  return data.session;
}

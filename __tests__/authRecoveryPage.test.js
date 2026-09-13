const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(process.cwd(), 'site/auth-recovery.js'), 'utf8');
function open(href) {
  const button = {}, message = {}, replaceState = jest.fn();
  vm.runInNewContext(script, {
    URL, URLSearchParams,
    window: { location: { href }, history: { replaceState } },
    document: { getElementById: (id) => id === 'open-reset' ? button : message },
  });
  return { button, message, replaceState };
}
test('recovery tokens go only to the app and are cleared from browser history', () => {
  const result = open('https://cork-and-note.vercel.app/reset-password?redirect=https://invalid.example#type=recovery&access_token=access&refresh_token=refresh&extra=omit');
  const target = new URL(result.button.href);
  expect(target.protocol).toBe('corkandnote:');
  expect(target.host).toBe('reset-password');
  expect(target.search).toBe('');
  expect(new URLSearchParams(target.hash.slice(1)).get('extra')).toBeNull();
  expect(new URLSearchParams(target.hash.slice(1)).get('access_token')).toBe('access');
  expect(result.replaceState).toHaveBeenCalledWith(null, '', '/reset-password');
});
test('PKCE codes are handed to the original app without arbitrary query parameters', () => {
  const { button } = open('https://cork-and-note.vercel.app/reset-password?code=one-time&next=https://invalid.example');
  expect(button.href).toBe('corkandnote://reset-password?code=one-time');
});
test.each([
  '', '#type=signup&access_token=access&refresh_token=refresh',
  '#type=recovery&access_token=access',
  '#error=access_denied&type=recovery&access_token=access&refresh_token=refresh',
  '?error=access_denied&code=one-time',
])('missing or invalid credentials lead to a new reset request: %s', (suffix) => {
  const { button, replaceState } = open(`https://cork-and-note.vercel.app/reset-password${suffix}`);
  expect(button.href).toBe('corkandnote://forgot-password');
  expect(replaceState).toHaveBeenCalledWith(null, '', '/reset-password');
});

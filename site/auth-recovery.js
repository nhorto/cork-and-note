// Recovery credentials stay on this page and are handed only to the installed
// app after an explicit tap. No network requests, analytics or auto redirects.
(() => {
  const button = document.getElementById('open-reset');
  const message = document.getElementById('reset-message');
  const incoming = new URL(window.location.href);
  const fragment = new URLSearchParams(incoming.hash.slice(1));
  const target = new URL('corkandnote://reset-password');
  let valid = false;
  if (!incoming.searchParams.has('error') && !fragment.has('error')) {
    if (fragment.get('type') === 'recovery' && fragment.get('access_token') && fragment.get('refresh_token')) {
      target.hash = new URLSearchParams({
        type: 'recovery',
        access_token: fragment.get('access_token'),
        refresh_token: fragment.get('refresh_token'),
      }).toString();
      valid = true;
    } else if (incoming.searchParams.get('code')) {
      target.searchParams.set('code', incoming.searchParams.get('code'));
      valid = true;
    }
  }
  // Clear tokens/codes/errors from browser history after constructing the
  // app-only target. Never forward arbitrary redirect or tracking parameters.
  window.history.replaceState(null, '', incoming.pathname);
  if (valid) {
    button.href = target.href;
    button.textContent = 'Open password reset in Cork & Note';
    message.textContent = 'Continue on the iPhone or Android phone where Cork & Note is installed. If you are on a computer, open the original reset email on your phone.';
  } else {
    button.href = 'corkandnote://forgot-password';
    button.textContent = 'Request a new reset link in the app';
    message.textContent = 'Open your password-reset email on the iPhone or Android phone where Cork & Note is installed. If the link has expired or was already used, request a new one.';
  }
})();

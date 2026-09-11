// lib/password.js: the one password rule every screen that sets a password
// applies. Sign-up, "change password" and the reset-link screen used to carry
// their own copies, and the reset screen had drifted to "8 characters, anything
// goes", so a reset could set a password that sign-up would have refused.
export const PASSWORD_MIN_LENGTH = 8;

const RULES = [
  {
    text: `At least ${PASSWORD_MIN_LENGTH} characters`,
    error: `at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  { text: 'One uppercase letter', error: 'one uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { text: 'One lowercase letter', error: 'one lowercase letter', test: (p) => /[a-z]/.test(p) },
  { text: 'One number', error: 'one number', test: (p) => /\d/.test(p) },
];

/** `{ isValid, errors }` where errors are the unmet rules, worded for a bullet list. */
export function validatePassword(password) {
  const value = typeof password === 'string' ? password : '';
  const errors = RULES.filter((rule) => !rule.test(value)).map((rule) => rule.error);
  return { isValid: errors.length === 0, errors };
}

/** The live checklist shown under a password field: `[{ text, met }]`. */
export function passwordRequirements(password) {
  const value = typeof password === 'string' ? password : '';
  return RULES.map((rule) => ({ text: rule.text, met: rule.test(value) }));
}

# Authentication email and password recovery

Updated September 13, 2026. Production project: **ixecayqpogkiawempzgc**.

## Live sender configured and delivery verified

The owner purchased **corkandnote.com** in their personal Cloudflare account. Its active zone is `7b9656677a87622b372d7702994e574f`. The dedicated Resend sending domain **auth.corkandnote.com** (ID `78fdd252-ab71-43be-a461-ccf3c9bfab7b`) is verified: all four provider-required DNS records passed, and the CNAME is DNS-only. An initial `v=DMARC1; p=none;` policy is installed at `_dmarc.auth`. Receiving, open tracking and click tracking are disabled. The unrelated staging domain was left untouched.

Supabase now sends from **Cork & Note <noreply@auth.corkandnote.com>** through `smtp.resend.com:465`, username `resend`, using a dedicated domain-restricted sending credential. The initial limit is **30 messages/hour**. Signup auto-confirm and existing redirect allow-lists remain unchanged. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

The recovery, confirmation and email-change templates and subjects were published and read back exactly. Preview copies are in `~/Downloads/Cork-and-Note-Auth-Emails/`. The earlier HTTP 400 template restriction was resolved by configuring custom SMTP.

A real password-reset request for a disposable Gmail alias reached provider status **delivered**. The actual email contained the branded Android/iPhone template and expected sender. Its recovery link established the correct mobile recovery session; the new password worked, the old password failed, and the consumed link could not be reused. The fixture's auth account and profile were deleted. No existing customer password was changed. [Sanitized evidence](../audits/2026-09-13-auth-email-live.json).

**Limits:** provider delivery means the recipient mail server accepted the message; inbox-versus-spam placement was not inspected. Actual email-to-app dispatch and password entry on the physical iOS 27 / Android 7 candidates still need acceptance. This setup provides outbound authentication mail, not a support inbox or a website on the new domain.

## Recovery flow and repeatable checks

The website provides `/reset-password` at `https://cork-and-note.vercel.app`, matching the allow-listed URL. It supports mobile recovery fragments and PKCE codes through an explicit app-opening link, strips unrelated parameters, clears credentials from browser history and sends no recovery credentials over the network. Missing/expired links lead to requesting a new reset inside the app. Direct `corkandnote://reset-password` links remain supported.

`node scripts/verify-password-recovery.mjs` runs the no-email disposable-account protocol check with the existing management credential. It also checks rejection of untrusted redirects. `node scripts/auth-emails.mjs --push` republishes the prepared templates. Neither command prints credentials or recovery links.

## Remaining acceptance

- Inspect a fresh reset email in the intended mailbox, including spam placement and branding.
- Complete the email link and password change on both physical store candidates, including app cold start and expired/reused links.
- Confirm sending limits against expected launch traffic and monitor provider failures/bounces.
- Keep signup verification as the existing v1 choice unless deliberately changed; publishing its template does not enable it.

The temporary Cloudflare DNS token was supplied through chat. Revoke it after setup; it is not used by the running email service. SMTP uses a separate restricted Resend credential stored outside the repository.

// scripts/auth-emails.mjs — build (and optionally push) the Supabase Auth email
// templates in the Royal Velvet palette.
//
// Supabase's stock emails are unstyled black-on-white with a bare link, which is
// the first thing a new user sees from us. The template BODY costs nothing on any
// plan — only the SENDER address ("noreply@mail.app.supabase.io") needs custom
// SMTP, which is tracked separately as a launch blocker.
//
// Colours mirror the Royal Velvet light palette in styles/theme.js. The markup is
// deliberately table-based with inline styles: Outlook and Gmail strip <style>
// blocks, flexbox and most modern CSS.
//
//   node scripts/auth-emails.mjs            # write previews to .agent/auth-emails/
//   node scripts/auth-emails.mjs --push     # also PATCH them onto the live project
//
// --push needs a Supabase personal access token in SUPABASE_ACCESS_TOKEN or
// ~/.supabase/access-token.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_REF = 'ixecayqpogkiawempzgc';
const SITE = 'https://cork-and-note.vercel.app';

const VELVET = '#54258A';
const VELVET_DEEP = '#421B70';
const GOLD = '#D6B45D';
const GOLD_SOFT = '#E8D9B4';
const CREAM = '#FAF8F4';
const INK = '#2E2438';
const INK_SOFT = '#5E506A';
const INK_FAINT = '#746779';

/**
 * One shell for every auth email: velvet header, gold rule, message, gold
 * button, plain-text fallback link, footer.
 *
 * `preheader` is the grey line mail clients show next to the subject in the
 * inbox list — without it they scrape the first visible words, which would be
 * the logo alt text.
 */
function shell({ preheader, heading, body, cta, url, footnote }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid ${GOLD_SOFT};">

        <tr>
          <td align="center" style="background-color:${VELVET};padding:28px 24px 22px 24px;">
            <img src="${SITE}/assets/logo.jpg" width="64" height="64" alt="Cork &amp; Note"
                 style="display:block;border:0;border-radius:12px;margin-bottom:12px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;color:#FFFFFF;letter-spacing:0.4px;">
              Cork &amp; Note
            </div>
          </td>
        </tr>
        <tr><td style="height:3px;background-color:${GOLD};line-height:3px;font-size:0;">&nbsp;</td></tr>

        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <h1 style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:30px;font-weight:600;color:${INK};">
              ${heading}
            </h1>
            <p style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:${INK_SOFT};">
              ${body}
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 32px 24px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background-color:${VELVET};border-radius:10px;">
                  <a href="${url}"
                     style="display:inline-block;padding:15px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:10px;border:1px solid ${VELVET_DEEP};">
                    ${cta}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 28px 32px;">
            <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${INK_FAINT};">
              Button not working? Paste this into your browser:
            </p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;word-break:break-all;">
              <a href="${url}" style="color:${VELVET};text-decoration:underline;">${url}</a>
            </p>
          </td>
        </tr>

        <tr><td style="height:1px;background-color:${GOLD_SOFT};line-height:1px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:20px 32px 26px 32px;">
            <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${INK_FAINT};">
              ${footnote}
            </p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:${INK_FAINT};">
              <a href="${SITE}/support" style="color:${VELVET};text-decoration:underline;">Support</a>
              &nbsp;·&nbsp;
              <a href="${SITE}/privacy" style="color:${VELVET};text-decoration:underline;">Privacy</a>
              &nbsp;·&nbsp; Taste, note, and remember every wine.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// `{{ .ConfirmationURL }}` is Supabase's Go-template placeholder for the signed
// action link; it is substituted server-side when the mail is sent.
const LINK = '{{ .ConfirmationURL }}';

export const templates = {
  recovery: {
    subject: 'Reset your Cork & Note password',
    contentKey: 'mailer_templates_recovery_content',
    subjectKey: 'mailer_subjects_recovery',
    html: shell({
      preheader: 'Choose a new password for your Cork & Note account.',
      heading: 'Reset your password',
      body: 'Tap the button below on your iPhone and Cork &amp; Note will open so you can choose a new password. The link is good for one hour and can only be used once.',
      cta: 'Choose a new password',
      url: LINK,
      footnote:
        'Open this email on the iPhone where Cork &amp; Note is installed — the link hands the reset straight to the app. If you did not ask to reset your password you can ignore this email; your password stays as it is.',
    }),
  },
  confirmation: {
    subject: 'Confirm your Cork & Note email',
    contentKey: 'mailer_templates_confirmation_content',
    subjectKey: 'mailer_subjects_confirmation',
    html: shell({
      preheader: 'One tap to confirm your email and start your wine journal.',
      heading: 'Confirm your email',
      body: 'Welcome to Cork &amp; Note. Confirm this address and your journal, cellar and sommelier are ready to go.',
      cta: 'Confirm my email',
      url: LINK,
      footnote:
        'If you did not create a Cork &amp; Note account, you can safely ignore this email.',
    }),
  },
  email_change: {
    subject: 'Confirm your new Cork & Note email',
    contentKey: 'mailer_templates_email_change_content',
    subjectKey: 'mailer_subjects_email_change',
    html: shell({
      preheader: 'Confirm the new address for your Cork & Note account.',
      heading: 'Confirm your new email',
      body: 'You asked to change the email address on your Cork &amp; Note account. Confirm the new address to finish the change.',
      cta: 'Confirm new email',
      url: LINK,
      footnote:
        'If you did not request this change, ignore this email and your address will stay as it is.',
    }),
  },
};

function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    return readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
  } catch {
    return null;
  }
}

const OUT = join(process.cwd(), '.agent', 'auth-emails');
mkdirSync(OUT, { recursive: true });
for (const [name, t] of Object.entries(templates)) {
  writeFileSync(join(OUT, `${name}.html`), t.html);
}
console.log(`Wrote ${Object.keys(templates).length} previews to .agent/auth-emails/`);

if (process.argv.includes('--push')) {
  const token = accessToken();
  if (!token) {
    console.error('No Supabase access token (SUPABASE_ACCESS_TOKEN or ~/.supabase/access-token).');
    process.exit(1);
  }
  const payload = {};
  for (const t of Object.values(templates)) {
    payload[t.contentKey] = t.html;
    payload[t.subjectKey] = t.subject;
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`Push failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`Pushed ${Object.keys(templates).length} templates to project ${PROJECT_REF}.`);
}

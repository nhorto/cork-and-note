// Email-based invitation requests. Nothing is sent or saved by this page.
// Keep the send step explicit; a mailto link cannot confirm delivery.
const form = document.querySelector('#beta-request');
const platform = form.elements.platform;
const commitment = form.elements.commitment;
const draft = document.querySelector('#email-draft');
form.hidden = false;

function updatePlatform() {
  const android = platform.value === 'Android';
  document.querySelector('#android-commitment').hidden = !android;
  commitment.required = android;
  if (!android) commitment.checked = false;
}
platform.addEventListener('change', updatePlatform);
form.addEventListener('input', () => { draft.hidden = true; });
updatePlatform();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const body = [
    'I would like to join the Cork & Note early tester group.',
    '',
    `Phone: ${platform.value}`,
    `Invitation email: ${form.elements.email.value.trim()}`,
    `Phone model: ${form.elements.device.value.trim() || 'Not provided'}`,
    'I confirm I am 21+ and based in the US.',
    ...(platform.value === 'Android' ? ['I can participate over two weeks and remain opted in to the closed test for 14 consecutive days.'] : []),
    '',
    'Please contact me about this testing request.',
  ].join('\n');
  document.querySelector('#beta-message').value = body;
  const link = document.querySelector('#open-beta-email');
  // Use the support link rendered from the shared legal-content configuration.
  const emailLink = document.querySelector('#request a[href^="mailto:"]');
  const recipient = emailLink.getAttribute('href').split('?')[0];
  link.href = `${recipient}?subject=${encodeURIComponent('Cork & Note early tester: ' + platform.value)}&body=${encodeURIComponent(body)}`;
  draft.hidden = false;
  link.focus();
});

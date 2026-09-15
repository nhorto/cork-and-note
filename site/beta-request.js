const form = document.querySelector('#beta-request');
const platform = form.elements.platform;
const interest = form.elements.interest;
const commitment = form.elements.commitment;
const status = document.querySelector('#signup-status');
const button = form.querySelector('button[type=submit]');
form.hidden = false;
const requestedPlatform = new URLSearchParams(location.search).get('platform');
if (['Android', 'iPhone'].includes(requestedPlatform)) platform.value = requestedPlatform;

function updateOptions() {
  const testing = interest.value === 'testing';
  const android = platform.value === 'Android' && testing;
  document.querySelector('#android-commitment').hidden = !android;
  document.querySelector('#email-help').hidden = !android;
  commitment.required = android;
  if (!android) commitment.checked = false;
  button.textContent = testing ? 'Request early access' : 'Notify me at launch';
}
form.addEventListener('change', updateOptions);
updateOptions();
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity() || button.disabled) return;
  button.disabled = true;
  status.textContent = 'Saving your request…';
  const selectedInterest = interest.value;
  const selectedPlatform = platform.value;
  const attribution = {};
  const params = new URLSearchParams(location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = params.get(key);
    if (value && /^[a-zA-Z0-9_.-]{1,100}$/.test(value)) attribution[key] = value;
  }
  try {
    const response = await fetch('/api/early-access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ email: form.elements.email.value.trim(), platform: selectedPlatform,
        interest: selectedInterest, adult: form.elements.adult.checked, consent: form.elements.consent.checked,
        commitment: commitment.checked, website: form.elements.website.value, attribution }),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.error || 'Could not save your request. Please try again.');
    form.hidden = true;
    status.textContent = selectedInterest === 'launch'
      ? 'You’re on the launch list. We’ll email you when Cork & Note is available for your phone.'
      : selectedPlatform === 'Android'
        ? 'Your request is saved. We’ll email your invitation and Google Play installation steps when your place is ready. Your 14-day testing period starts when you join the closed test—not when you submit this form.'
        : 'Your request is saved. We’ll email a TestFlight invitation and installation steps when your place is ready. TestFlight purchases are free test transactions.';
    status.focus();
  } catch (error) {
    status.textContent = error.name === 'TimeoutError'
      ? 'The connection timed out. Please retry; duplicate requests won’t create duplicate entries.'
      : (error.message || 'Could not save your request. Please try again.');
  } finally { button.disabled = false; }
});

// The wine-entry chat needs a stronger contract than the general sommelier.
// It cannot mutate React state itself, but the app can turn a structured
// `wine_suggestions` block into a review-and-apply action. Keeping that detail
// in the prompt prevents the model from truthfully-but-unhelpfully saying it
// cannot fill the form.

export function buildWineEntryAssistantPrompt(basePrompt = '', currentWineData = {}) {
  const d = currentWineData || {};
  const nonZeroRatings = Object.entries(d.ratings || {}).filter(([, value]) => Number(value) > 0);
  const lines = ['The user is currently logging a wine. Here is what is already on the tasting form:'];

  if (d.winemaker) lines.push(`- Winemaker: ${d.winemaker}`);
  if (d.name) lines.push(`- Wine name: ${d.name}`);
  lines.push(`- Wine type: ${d.type || '(not set)'}`);
  if (d.varietal) lines.push(`- Varietal: ${d.varietal}`);
  if (d.year) lines.push(`- Year: ${d.year}`);
  if (Number(d.overallRating) > 0) lines.push(`- Overall rating: ${d.overallRating}/5`);
  if (nonZeroRatings.length > 0) {
    lines.push(`- Detailed ratings: ${nonZeroRatings.map(([key, value]) => `${key}: ${value}/5`).join(', ')}`);
  }
  if (d.flavorNotes?.length > 0) lines.push(`- Flavor notes: ${d.flavorNotes.join(', ')}`);
  if (d.additionalNotes) lines.push(`- Notes: "${d.additionalNotes}"`);
  if (Number(d.photoCount) > 0) lines.push(`- Photos already attached to the entry: ${d.photoCount}`);

  const hasAnyData = Boolean(
    d.winemaker || d.name || d.varietal || d.year || Number(d.overallRating) > 0 ||
    nonZeroRatings.length > 0 || d.flavorNotes?.length > 0 || d.additionalNotes
  );
  if (!hasAnyData) lines.push('- The form is otherwise blank.');

  lines.push(
    '',
    'Every non-empty identity value above is an authoritative fact supplied by the user. Do not infer or substitute a different producer, cuvee, vintage, wine type, or varietal, even if another bottling from that producer seems familiar. Do not ask for a winery, location, vintage, type, or grape that is already present. Ask only for genuinely missing information.',
    '',
    'You are embedded in this tasting form, and the app CAN fill its fields from your response. When the user asks you to fill, add, change, update, use, or apply tasting details, do not say that you cannot edit or access the form. Instead, provide the helpful conversational response and include the `wine_suggestions` block described above. The app will show those values for the user to review and apply. Do not claim the tasting is already saved.',
    '',
    'Structured suggestions should fill missing fields. Never propose a different value for a non-empty identity field unless the user explicitly asks to replace or correct that exact field. Treat follow-up corrections as form instructions too. Include every field you can support from the label, the current form, and the conversation; use null for unknown fields. Preserve user-supplied ratings and notes when returning an updated block.',
    '',
    'When the user asks for help tasting the wine, guide them through what they actually perceive: ask short questions about aroma, fruit/savory notes, sweetness, acidity, tannin, body, and finish as appropriate. Use their answers to build the notes and ratings. Typical varietal clues can be offered as possibilities, but never turn those possibilities into a different wine identity.',
    '',
    'If the form is blank or the wine is unclear, ask for its label/photo, producer, name, or varietal rather than inventing details.'
  );

  return `${basePrompt}\n\n${lines.join('\n')}`;
}

const IDENTITY_FIELDS = [
  ['winemaker', 'winemaker', ['winemaker', 'winery', 'producer']],
  ['wine_name', 'name', ['wine name', 'name', 'cuvee', 'cuvée', 'bottling']],
  ['wine_type', 'type', ['wine type', 'type', 'style']],
  ['varietal', 'varietal', ['varietal', 'grape']],
  ['year', 'year', ['year', 'vintage']],
];

const normalized = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function explicitlyReplacesField(text, aliases) {
  const plain = normalized(text);
  const replacementIntent = /(?:change|replace|correct|update|fix|actually|should be|wrong)/.test(plain) ||
    /\bnot\b.{0,30}\bbut\b/.test(plain);
  if (!replacementIntent) return false;
  return aliases.some((alias) => plain.includes(normalized(alias)));
}

// Defense in depth for a model that disregards the prompt. Existing identity
// values are removed from the actionable payload unless the user's latest
// message explicitly names that field as a correction. This means an old or
// malformed reply cannot put a speculative cuvee/type into the review sheet.
export function protectWineEntrySuggestions(suggestions, currentWineData = {}, userText = '', { hasPhotos = false } = {}) {
  if (!suggestions || typeof suggestions !== 'object' || Array.isArray(suggestions)) return null;
  const safe = { ...suggestions };
  const replacements = [];

  for (const [suggestionKey, formKey, aliases] of IDENTITY_FIELDS) {
    const current = currentWineData?.[formKey];
    const incoming = safe[suggestionKey];
    if (!normalized(current) || !normalized(incoming) || normalized(current) === normalized(incoming)) continue;
    if (explicitlyReplacesField(userText, aliases)) {
      replacements.push(suggestionKey);
    } else {
      delete safe[suggestionKey];
    }
  }

  // A producer plus grape/year is not evidence for a named cuvee. Only let an
  // empty wine-name field be filled when the user actually supplied that name
  // in text or attached a label for the model to read.
  if (
    !normalized(currentWineData?.name) && normalized(safe.wine_name) && !hasPhotos &&
    !normalized(userText).includes(normalized(safe.wine_name)) &&
    (normalized(currentWineData?.winemaker) || normalized(currentWineData?.varietal) || normalized(currentWineData?.year))
  ) {
    delete safe.wine_name;
  }

  if (replacements.length > 0) safe._replace_fields = replacements;
  else delete safe._replace_fields;
  return safe;
}

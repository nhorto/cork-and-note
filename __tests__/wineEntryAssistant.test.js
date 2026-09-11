import { buildWineEntryAssistantPrompt, protectWineEntrySuggestions } from '../lib/wineEntryAssistant';

describe('wine-entry assistant contract', () => {
  test('tells the model to use the app action instead of refusing to fill the form', () => {
    const prompt = buildWineEntryAssistantPrompt('GENERAL SOMMELIER PROMPT', {
      winemaker: 'Paradise Springs',
      name: 'Cabernet Franc',
      type: 'Red',
      varietal: 'Cabernet Franc',
      year: '2022',
      overallRating: 4,
      ratings: { sweetness: 0, tannins: 3.5, acidity: 3 },
      flavorNotes: ['raspberry', 'pepper'],
      additionalNotes: 'Bright and savory',
      photoCount: 1,
    });

    expect(prompt).toContain('GENERAL SOMMELIER PROMPT');
    expect(prompt).toContain('Winemaker: Paradise Springs');
    expect(prompt).toContain('Overall rating: 4/5');
    expect(prompt).toContain('tannins: 3.5/5');
    expect(prompt).not.toContain('sweetness: 0/5');
    expect(prompt).toContain('app CAN fill its fields');
    expect(prompt).toContain('do not say that you cannot edit or access the form');
    expect(prompt).toContain('include the `wine_suggestions` block');
    expect(prompt).toContain('Do not claim the tasting is already saved');
    expect(prompt).toContain('Preserve user-supplied ratings and notes');
    expect(prompt).toContain('authoritative fact supplied by the user');
    expect(prompt).toContain('Do not ask for a winery, location, vintage, type, or grape that is already present');
    expect(prompt).toContain('guide them through what they actually perceive');
  });

  test('describes a blank form without inventing a wine', () => {
    const prompt = buildWineEntryAssistantPrompt('BASE');
    expect(prompt).toContain('Wine type: (not set)');
    expect(prompt).toContain('The form is otherwise blank');
    expect(prompt).toContain('ask for its label/photo, producer, name, or varietal');
  });
});

describe('protectWineEntrySuggestions', () => {
  const current = {
    winemaker: 'Paradise Springs',
    name: '',
    type: 'Red',
    varietal: 'Cabernet Sauvignon',
    year: '2020',
  };

  test('removes a speculative cuvee and conflicting identity from a generic tasting-help reply', () => {
    const safe = protectWineEntrySuggestions({
      winemaker: 'Another Winery',
      wine_name: 'Petit Verdot Reserve',
      wine_type: 'Red Blend',
      varietal: 'Petit Verdot',
      year: '2021',
      flavor_tags: ['blackberry', 'cedar'],
      characteristics: { tannins: 4 },
    }, current, 'Help me taste this wine');

    expect(safe).toEqual({
      flavor_tags: ['blackberry', 'cedar'],
      characteristics: { tannins: 4 },
    });
  });

  test('permits only the exact identity field the user explicitly corrects', () => {
    const safe = protectWineEntrySuggestions({
      wine_type: 'Red Blend',
      varietal: 'Cabernet Franc',
      year: '2022',
    }, current, 'Actually, correct the vintage to 2022');

    expect(safe).toEqual({ year: '2022', _replace_fields: ['year'] });
  });

  test('allows a missing wine name when it came from the user or a label photo', () => {
    expect(protectWineEntrySuggestions(
      { wine_name: 'Petit Verdot Reserve' }, current, 'This is the Petit Verdot Reserve'
    )).toEqual({ wine_name: 'Petit Verdot Reserve' });
    expect(protectWineEntrySuggestions(
      { wine_name: 'Petit Verdot Reserve' }, current, 'What is this?', { hasPhotos: true }
    )).toEqual({ wine_name: 'Petit Verdot Reserve' });
  });
});

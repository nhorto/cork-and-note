import { formatMarkdownForMobile } from '../lib/chatMarkdown';

describe('formatMarkdownForMobile', () => {
  test('turns a wide Markdown table into readable labelled rows', () => {
    const input = [
      'Here is the comparison:',
      '',
      '| Characteristic | Your Rating | Typical Range | Assessment |',
      '| --- | ---: | :--- | --- |',
      '| Sweetness | 2.5 / 5 | 1–2.5 | ✅ Reasonable |',
      '| Tannins | 1.5 / 5 | 0.5–1.5 | ✅ Spot on |',
      '',
      'Trust your palate.',
    ].join('\n');

    expect(formatMarkdownForMobile(input)).toBe([
      'Here is the comparison:',
      '',
      '**Sweetness**',
      '- **Your Rating:** 2.5 / 5',
      '- **Typical Range:** 1–2.5',
      '- **Assessment:** ✅ Reasonable',
      '',
      '**Tannins**',
      '- **Your Rating:** 1.5 / 5',
      '- **Typical Range:** 0.5–1.5',
      '- **Assessment:** ✅ Spot on',
      '',
      'Trust your palate.',
    ].join('\n'));
  });

  test('leaves ordinary Markdown untouched', () => {
    const input = '**Bold**\n\n- one\n- two';
    expect(formatMarkdownForMobile(input)).toBe(input);
  });
});

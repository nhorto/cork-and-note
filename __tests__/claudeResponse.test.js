// Reading a searched reply out of Claude's response.
//
// These use the real block shapes the Messages API returns with the
// web_search_20260209 tool, because every bug this code can have is a shape
// bug: an error result that is an object where success is an array, an answer
// split across text blocks at citation boundaries, a turn that paused halfway.
import {
  MAX_SOURCES,
  collectSources,
  textFromContent,
  webSearchRequestCount,
} from '../supabase/functions/_shared/claudeResponse.ts';

const searchResult = (url, title) => ({ type: 'web_search_result', url, title });
const citation = (url, title) => ({ type: 'web_search_result_location', url, title });

describe('textFromContent', () => {
  it('ignores tool blocks and returns only what the user should read', () => {
    const content = [
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'Octagon' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [searchResult('https://bvwine.com/octagon', 'Octagon')] },
      { type: 'text', text: 'Barboursville Octagon is their Bordeaux-style flagship blend.' },
    ];
    expect(textFromContent(content)).toBe(
      'Barboursville Octagon is their Bordeaux-style flagship blend.'
    );
  });

  it('rejoins an answer the API split at citation boundaries', () => {
    // The API splits text mid-sentence to attach a citation to the cited span.
    // Joining with a newline here would chop the sentence in half on screen.
    const content = [
      { type: 'text', text: 'The 2021 vintage was ' },
      { type: 'text', text: 'a cool, wet year in Virginia', citations: [citation('https://vawine.org/2021', '2021 Harvest')] },
      { type: 'text', text: ', so expect lighter reds.' },
    ];
    expect(textFromContent(content)).toBe(
      'The 2021 vintage was a cool, wet year in Virginia, so expect lighter reds.'
    );
  });

  it('survives the shapes that should never happen', () => {
    expect(textFromContent(null)).toBe('');
    expect(textFromContent(undefined)).toBe('');
    expect(textFromContent('not a list')).toBe('');
    expect(textFromContent([null, undefined, { type: 'text' }])).toBe('');
  });
});

describe('collectSources', () => {
  it('puts what Claude actually cited ahead of what it merely searched', () => {
    const content = [
      {
        type: 'web_search_tool_result',
        content: [
          searchResult('https://randomblog.example/post', 'A blog'),
          searchResult('https://bvwine.com/octagon', 'Octagon — Barboursville'),
        ],
      },
      {
        type: 'text',
        text: 'Octagon is a Merlot-led blend.',
        citations: [citation('https://bvwine.com/octagon', 'Octagon — Barboursville')],
      },
    ];
    // The cited winery page leads even though the blog was returned first.
    expect(collectSources(content)).toEqual([
      { url: 'https://bvwine.com/octagon', title: 'Octagon — Barboursville' },
      { url: 'https://randomblog.example/post', title: 'A blog' },
    ]);
  });

  it('lists a page once however many times it is cited', () => {
    const content = [
      { type: 'text', text: 'One.', citations: [citation('https://a.example/x', 'A')] },
      { type: 'text', text: 'Two.', citations: [citation('https://a.example/x', 'A')] },
      { type: 'web_search_tool_result', content: [searchResult('https://a.example/x', 'A')] },
    ];
    expect(collectSources(content)).toEqual([{ url: 'https://a.example/x', title: 'A' }]);
  });

  it('does not throw on a FAILED search, whose content is an object not a list', () => {
    // This is the trap: a server-tool failure arrives as a normal HTTP 200 with
    // an error object where the result list would be. Indexing it blindly would
    // throw inside an otherwise successful request.
    const content = [
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } },
      { type: 'text', text: "I couldn't look that up just now." },
    ];
    expect(() => collectSources(content)).not.toThrow();
    expect(collectSources(content)).toEqual([]);
    expect(textFromContent(content)).toBe("I couldn't look that up just now.");
  });

  it('keeps only real http(s) links, and normalises a missing title to null', () => {
    const content = [
      {
        type: 'web_search_tool_result',
        content: [
          searchResult('https://ok.example/a', '  Spaced  '),
          searchResult('javascript:alert(1)', 'nope'),
          searchResult('/relative/path', 'nope'),
          searchResult('https://ok.example/b', ''),
          searchResult(null, 'nope'),
        ],
      },
    ];
    expect(collectSources(content)).toEqual([
      { url: 'https://ok.example/a', title: 'Spaced' },
      { url: 'https://ok.example/b', title: null },
    ]);
  });

  it('caps how many sources a single reply can show', () => {
    const many = Array.from({ length: MAX_SOURCES + 4 }, (_, i) =>
      searchResult(`https://example.com/${i}`, `Result ${i}`)
    );
    expect(collectSources([{ type: 'web_search_tool_result', content: many }])).toHaveLength(
      MAX_SOURCES
    );
  });

  it('reads a paused-and-resumed turn as one reply', () => {
    // The edge function concatenates the content of every turn before parsing,
    // so a pause_turn resume must not produce a duplicated source or a seam in
    // the text.
    const firstTurn = [
      { type: 'text', text: 'Looking at the 2021, ' },
      { type: 'web_search_tool_result', content: [searchResult('https://bvwine.com/octagon', 'Octagon')] },
    ];
    const resumedTurn = [
      {
        type: 'text',
        text: 'it drinks well now.',
        citations: [citation('https://bvwine.com/octagon', 'Octagon')],
      },
    ];
    const all = [...firstTurn, ...resumedTurn];
    expect(textFromContent(all)).toBe('Looking at the 2021, it drinks well now.');
    expect(collectSources(all)).toEqual([
      { url: 'https://bvwine.com/octagon', title: 'Octagon' },
    ]);
  });

  it('returns nothing for an ordinary unsearched reply', () => {
    expect(collectSources([{ type: 'text', text: 'Cabernet Franc is herbaceous.' }])).toEqual([]);
    expect(collectSources(null)).toEqual([]);
  });
});

describe('webSearchRequestCount', () => {
  it('reads the billed search count off usage', () => {
    expect(webSearchRequestCount({ input_tokens: 900, server_tool_use: { web_search_requests: 2 } })).toBe(2);
  });

  it('is zero when the model did not search, or did not say', () => {
    expect(webSearchRequestCount({ input_tokens: 900 })).toBe(0);
    expect(webSearchRequestCount({ server_tool_use: {} })).toBe(0);
    expect(webSearchRequestCount(undefined)).toBe(0);
    expect(webSearchRequestCount({ server_tool_use: { web_search_requests: 'two' } })).toBe(0);
    expect(webSearchRequestCount({ server_tool_use: { web_search_requests: -1 } })).toBe(0);
  });
});

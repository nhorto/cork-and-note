// The shared foundation for the guided Pro tools (2026-09-11): the four new
// metered tasks exist on both sides of the wire, are Pro-only, and the
// fenced-JSON helper the tools parse their results with behaves under the
// failure modes that matter (truncation, tagless replies, garbage).
import { aiService } from '../lib/ai';
import { FREE_TIER_LIMITS, PRO_ONLY_TASKS } from '../lib/pro';
import {
  FAIR_USE_DAILY_CAPS,
  gateAiRequest,
  limitReachedMessage,
  normalizeTask,
} from '../supabase/functions/_shared/entitlements.ts';

jest.mock('../lib/supabase', () => ({ supabase: { auth: {}, from: jest.fn(), functions: {} } }));
jest.mock('../lib/visits', () => ({ visitsService: {} }));
jest.mock('../lib/cellar', () => ({ cellarService: {}, describeBottleForPrompt: () => '' }));
jest.mock('../lib/aiConsent', () => ({
  aiConsentError: () => new Error('consent'),
  getAiConsent: jest.fn(),
  requireAiConsent: jest.fn(),
}));

const NEW_TASKS = ['wine_list_scan', 'wine_list_pick', 'taste_report', 'trip_plan'];
const NOW = Date.UTC(2026, 8, 11, 12, 0, 0);

describe('guided-tool tasks', () => {
  it.each(NEW_TASKS)('%s is a recognised task, not silently billed as chat', (task) => {
    expect(normalizeTask(task)).toBe(task);
  });

  it('still refuses to let an unknown task buy a cheaper allowance', () => {
    expect(normalizeTask('wine_list')).toBe('chat');
    expect(normalizeTask('taste')).toBe('chat');
  });

  it.each(NEW_TASKS)('%s is Pro-only on both sides', (task) => {
    expect(FREE_TIER_LIMITS[task]).toBe(0);
    expect(PRO_ONLY_TASKS).toContain(task);
    expect(FAIR_USE_DAILY_CAPS[task]).toBeGreaterThan(0);
  });

  it.each(NEW_TASKS)('%s opens the paywall for a free user and passes for Pro', (task) => {
    const counts = { burst: 0, day: 0, window: 0 };
    const free = gateAiRequest({ nowMs: NOW, task, hasImages: false, entitlement: null, counts });
    expect(free.allowed).toBe(false);
    expect(free.status).toBe(402);
    expect(free.body.code).toBe('free_limit_reached');
    expect(free.body.error).toBe(limitReachedMessage(task));

    const pro = gateAiRequest({
      nowMs: NOW,
      task,
      hasImages: task === 'wine_list_scan',
      entitlement: { is_pro: true, expires_at: null },
      counts,
    });
    expect(pro.allowed).toBe(true);
  });

  it('caps a Pro user who grinds a tool all day', () => {
    const verdict = gateAiRequest({
      nowMs: NOW,
      task: 'taste_report',
      hasImages: false,
      entitlement: { is_pro: true, expires_at: null },
      counts: { burst: 0, day: FAIR_USE_DAILY_CAPS.taste_report, window: 0 },
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.status).toBe(429);
  });
});

describe('aiService.parseFencedJson', () => {
  it('parses a tagged block and ignores prose around it', () => {
    const text = 'Here you go.\n```wine_list\n{"entries":[{"entry_id":"e1"}]}\n```\nEnjoy.';
    expect(aiService.parseFencedJson(text, 'wine_list')).toEqual({
      value: { entries: [{ entry_id: 'e1' }] },
      truncated: false,
    });
  });

  it('reports truncation when the fence never closes, rather than a partial value', () => {
    const text = '```wine_list\n{"entries":[{"entry_id":"e1"},{"entry_id":"e2"';
    expect(aiService.parseFencedJson(text, 'wine_list')).toEqual({ value: null, truncated: true });
  });

  it('accepts a bare JSON reply as a fallback', () => {
    expect(aiService.parseFencedJson('{"ok":true}', 'taste_report')).toEqual({
      value: { ok: true },
      truncated: false,
    });
  });

  it('returns null for garbage and for the wrong tag', () => {
    expect(aiService.parseFencedJson('```wine_list\nnot json\n```', 'wine_list').value).toBeNull();
    expect(aiService.parseFencedJson('```wine_list\n{}\n```', 'trip_plan').value).toBeNull();
    expect(aiService.parseFencedJson('', 'trip_plan').value).toBeNull();
  });

  it('strips the new tags from display text', () => {
    const text = 'Intro\n```taste_report\n{"a":1}\n```\nOutro';
    expect(aiService.getDisplayText(text)).toBe('Intro\n\nOutro');
  });
});

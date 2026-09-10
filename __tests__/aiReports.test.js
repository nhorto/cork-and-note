// Tests for lib/aiReports.js — the insert path behind "Report this response"
// (Google Play AI-generated content policy). Two things worth pinning: the
// client reason list must stay in lockstep with the ai_response_reports check
// constraint (a drifted value passes client validation and then fails at the
// DB), and reportResponse must never throw — a failed report tells the user,
// it doesn't crash the chat.
const mockGetUser = jest.fn();
const mockInsert = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...args) => mockGetUser(...args) },
    from: jest.fn(() => ({ insert: (...args) => mockInsert(...args) })),
  },
}));

const fs = require('fs');
const path = require('path');
const { AI_REPORT_REASONS, aiReportsService } = require('../lib/aiReports');
const { supabase } = require('../lib/supabase');

const MIGRATION = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260910130000_ai_response_reports.sql'
);

describe('reason list', () => {
  test('every client reason value is allowed by the DB check constraint', () => {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const m = sql.match(/reason text not null check \(reason in \(([^)]+)\)\)/);
    expect(m).not.toBeNull();
    const dbReasons = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
    expect(AI_REPORT_REASONS.map((r) => r.value).sort()).toEqual(dbReasons.sort());
  });

  test('reasons have user-facing labels', () => {
    for (const r of AI_REPORT_REASONS) {
      expect(typeof r.label).toBe('string');
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});

describe('reportResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  test('inserts the report as the signed-in user', async () => {
    const res = await aiReportsService.reportResponse({
      messageContent: 'Try pairing oysters with a tannic Cabernet.',
      context: 'What should I drink with oysters?',
      reason: 'inaccurate',
      details: '  Tannin and oysters clash.  ',
    });
    expect(res).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith('ai_response_reports');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      message_content: 'Try pairing oysters with a tannic Cabernet.',
      context: 'What should I drink with oysters?',
      reason: 'inaccurate',
      details: 'Tannin and oysters clash.',
    });
  });

  test('missing context and blank details insert as null', async () => {
    await aiReportsService.reportResponse({
      messageContent: 'A reply',
      reason: 'unsafe',
      details: '   ',
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ context: null, details: null })
    );
  });

  test('rejects an unknown reason before touching the network', async () => {
    const res = await aiReportsService.reportResponse({
      messageContent: 'A reply',
      reason: 'spam', // not in AI_REPORT_REASONS
    });
    expect(res.success).toBe(false);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('rejects an empty message content', async () => {
    const res = await aiReportsService.reportResponse({
      messageContent: '   ',
      reason: 'other',
    });
    expect(res.success).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('fails softly when signed out', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await aiReportsService.reportResponse({
      messageContent: 'A reply',
      reason: 'other',
    });
    expect(res.success).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('fails softly (no throw) when the insert errors, e.g. offline', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockInsert.mockResolvedValue({ error: new Error('Network request failed') });
    const res = await aiReportsService.reportResponse({
      messageContent: 'A reply',
      reason: 'inappropriate',
    });
    expect(res).toEqual({ success: false, error: 'Network request failed' });
  });
});

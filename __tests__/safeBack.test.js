// The guided Pro tools must never strand the user. A deep link, a cold start,
// or the screenshot tooling's router.replace can put a tool screen at the root
// of the stack, where router.back() throws "GO_BACK was not handled by any
// navigator" and the header chevron does nothing (owner hit exactly this on
// the taste screen, 2026-09-11).
import { act, create } from 'react-test-renderer';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
}));

import { useSafeBack } from '../hooks/useSafeBack';

// react-test-renderer has no renderHook, so a one-line harness stands in.
let handler;
function Harness({ fallback }) {
  handler = useSafeBack(fallback);
  return null;
}
const render = (fallback) => {
  act(() => {
    create(<Harness fallback={fallback} />);
  });
  return handler;
};

describe('useSafeBack', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  it('goes back when there is something behind this screen', () => {
    mockCanGoBack = true;
    render('/(tabs)/sommelier')();
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to a known tab when the stack is empty, instead of throwing', () => {
    mockCanGoBack = false;
    render('/(tabs)/sommelier')();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/sommelier');
  });

  it('defaults to the Somm tab when no fallback is given', () => {
    mockCanGoBack = false;
    render(undefined)();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/sommelier');
  });
});

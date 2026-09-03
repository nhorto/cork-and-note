# Navigation options — "How do I get to the wines I've tasted?"

**Date:** 2026-09-03 · **Status:** awaiting owner pick · Context: [`../../../business/launch-plan-2026-09.md`](../../../business/launch-plan-2026-09.md) §3

Two candidate fixes, mocked pixel-for-pixel against `styles/theme.js` and the shipped Home / Profile / Wines / tab-bar styles:

- **Option A — findability fixes** on today's five tabs: labeled Home tiles, a "Your journal" section in Profile, a new *Your places* list screen, and a Browse row in the ＋ sheet.
- **Option B — Journal tab** (recommended): Home · Journal · ＋ · Explore · Profile, where Journal has Tastings / Places / Wishlist segments and Cellar moves to Home, Profile and the ＋ sheet.
- **Both:** the pin sheet reordered (view notes first, log second) and the winery page with *Your visits* above *About*.

Live canvas (Claude Design preview): https://claude.ai/code/artifact/f5282092-c780-4f98-88de-e961584a85af

`gen.py` regenerates every `*.dc.html` artboard and `canvas.json`; the artboards are the source for the canvas. All names, wines and counts are sample data.

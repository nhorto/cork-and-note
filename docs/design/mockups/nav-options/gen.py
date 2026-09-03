#!/usr/bin/env python3
"""Generate the navigation-option artboards for Cork & Note.
Every value is lifted from styles/theme.js and the tab/home/profile/wines screens."""
import json, os, pathlib

OUT = pathlib.Path(__file__).parent
C = dict(burgundy="#722F37", wine="#8B1A1A", rose="#D4A5A5",
         gold="#C9A962", goldmuted="#D4C4A8", goldlight="#E8DCC8", goldshimmer="#B8976A", goldtext="#7E6430",
         cream="#FAF8F5", parchment="#F5F2ED", linen="#EDE8E0", stone="#D8D2C8",
         charcoal="#2C2C2C", graphite="#4A4A4A", pewter="#6E6E6E", silver="#A8A8A8",
         sage="#5B7B5B", slate="#6B7B8B", error="#9B3B3B")
SERIF = "Georgia, Times, serif"
SANS = "-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif"

ICONS = {
 "home":"<path d='M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'/>",
 "cellar":"<rect x='3' y='4' width='18' height='6' rx='1'/><rect x='3' y='14' width='18' height='6' rx='1'/><path d='M7 7h.01M7 17h.01'/>",
 "map":"<path d='M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z'/><path d='M9 4v14M15 6v14'/>",
 "person":"<circle cx='12' cy='8' r='4'/><path d='M4 21c0-4 4-6 8-6s8 2 8 6'/>",
 "journal":"<path d='M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z'/><path d='M5 17V4M9 9h6'/>",
 "add":"<path d='M12 5v14M5 12h14'/>",
 "chevron":"<path d='M9 6l6 6-6 6'/>",
 "back":"<path d='M15 6l-6 6 6 6'/>",
 "wine":"<path d='M8 3h8l-1 7a3 3 0 0 1-6 0z'/><path d='M12 13v6M9 21h6'/>",
 "pin":"<path d='M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z'/><circle cx='12' cy='10' r='2.5'/>",
 "bookmark":"<path d='M6 4h12v17l-6-4-6 4z'/>",
 "sparkles":"<path d='M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'/><path d='M19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z'/>",
 "settings":"<circle cx='12' cy='12' r='3'/><path d='M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'/>",
 "search":"<circle cx='11' cy='11' r='7'/><path d='M20 20l-3.5-3.5'/>",
 "filter":"<path d='M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0'/><circle cx='16' cy='7' r='2'/><circle cx='10' cy='12' r='2'/><circle cx='18' cy='17' r='2'/>",
 "help":"<circle cx='12' cy='12' r='9'/><path d='M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01'/>",
 "star":"<path d='M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'/>",
 "trash":"<path d='M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'/>",
 "list":"<path d='M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'/>",
 "camera":"<path d='M4 8h3l2-3h6l2 3h3v11H4z'/><circle cx='12' cy='13' r='3.5'/>",
 "calendar":"<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M3 10h18M8 3v4M16 3v4'/>",
}
def icon(name, size=24, color=C["charcoal"], fill=False):
    f = color if fill else "none"
    return (f"<svg width='{size}' height='{size}' viewBox='0 0 24 24' fill='{f}' stroke='{color}' "
            f"stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='flex-shrink:0'>{ICONS[name]}</svg>")

def caption(text, color=C["goldtext"]):
    return f"<div style='font-family:{SANS};font-size:11px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;line-height:14px;color:{color}'>{text}</div>"

def tabbar(active, layout):
    """layout: 'A' = Home Cellar + Explore Profile ; 'B' = Home Journal + Explore Profile"""
    tabs = [("home","Home","home"), ("cellar","Cellar","cellar") if layout=="A" else ("journal","Journal","journal"),
            None, ("map","Explore","map"), ("person","Profile","person")]
    cells = []
    for t in tabs:
        if t is None:
            cells.append(f"<div style='flex:1;display:flex;justify-content:center;align-items:flex-start'>"
                         f"<div style='margin-top:-18px;width:56px;height:56px;border-radius:28px;background:{C['burgundy']};border:3px solid {C['cream']};display:flex;align-items:center;justify-content:center;box-shadow:0 6px 10px rgba(114,47,55,0.35)'>{icon('add',30,C['cream'])}</div></div>")
            continue
        ic, label, key = t
        on = key == active
        col = C["burgundy"] if on else C["pewter"]
        dot = f"<div style='position:absolute;bottom:-6px;width:4px;height:4px;border-radius:2px;background:{C['burgundy']}'></div>" if on else ""
        cells.append(f"<div style='flex:1;display:flex;flex-direction:column;align-items:center;gap:4px'>"
                     f"<div style='position:relative;display:flex;align-items:center;justify-content:center;margin-top:2px'>{icon(ic,24,col)}{dot}</div>"
                     f"<div style='font-family:{SANS};font-size:11px;font-weight:600;color:{col};margin-top:2px'>{label}</div></div>")
    return (f"<div style='position:absolute;left:0;right:0;bottom:0;height:88px;background:{C['cream']};border-top:1px solid {C['goldmuted']};"
            f"padding:8px 0 28px;display:flex;flex-direction:row;box-shadow:0 -2px 8px rgba(44,44,44,0.05)'>{''.join(cells)}</div>")

def screen_header(title, left_icon="wine", right=None, back=False):
    left = (f"<div style='width:40px;height:40px;border-radius:20px;background:{C['parchment']};border:1px solid {C['goldmuted']};display:flex;align-items:center;justify-content:center'>{icon('back' if back else left_icon,20,C['burgundy'])}</div>")
    r = right if right is not None else "<div style='width:40px;height:40px'></div>"
    return (f"<div style='padding-top:60px;background:{C['cream']}'>"
            f"<div style='display:flex;flex-direction:row;align-items:center;justify-content:space-between;padding:16px 24px'>{left}"
            f"<div style='font-family:{SERIF};font-size:20px;font-weight:500;letter-spacing:0.3px;line-height:28px;color:{C['charcoal']}'>{title}</div>{r}</div>"
            f"<div style='height:1px;background:{C['goldmuted']};margin:0 24px'></div></div>")

def round_btn(ic, border=C["stone"], bg=None, color=C["charcoal"]):
    bg = bg or C["parchment"]
    return f"<div style='width:40px;height:40px;border-radius:20px;background:{bg};border:1px solid {border};display:flex;align-items:center;justify-content:center'>{icon(ic,20,color)}</div>"

def section(label, action=None, mt=32):
    a = f"<div style='font-family:{SANS};font-size:13px;line-height:18px;color:{C['burgundy']}'>{action}</div>" if action else ""
    return f"<div style='display:flex;flex-direction:row;justify-content:space-between;align-items:center;margin-top:{mt}px;margin-bottom:8px'>{caption(label)}{a}</div>"

def stat(n, label, arrow):
    arrow_html = f"<span style='color:{C['goldshimmer']};margin-left:2px'>›</span>" if arrow else ""
    return (f"<div style='flex:1;background:{C['parchment']};border:1px solid {C['stone']};border-radius:12px;padding:16px 0;display:flex;flex-direction:column;align-items:center'>"
            f"<div style='font-family:{SERIF};font-size:24px;line-height:28px;color:{C['burgundy']}'>{n}</div>"
            f"<div style='font-family:{SANS};font-size:11px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;line-height:14px;color:{C['pewter']};margin-top:4px'>{label}{arrow_html}</div></div>")

def stats(labels, arrow):
    (a,b,c) = labels
    return f"<div style='display:flex;flex-direction:row;gap:8px;margin-top:24px'>{stat('47',a,arrow)}{stat('12',b,arrow)}{stat('5',c,arrow)}</div>"

def hero():
    return (f"<div style='display:flex;flex-direction:row;align-items:center;gap:16px;background:{C['burgundy']};border-radius:12px;padding:16px;margin-top:24px;box-shadow:0 4px 12px rgba(44,44,44,0.08)'>"
            f"{icon('wine',26,C['gold'])}<div style='flex:1'><div style='font-family:{SERIF};font-size:17px;font-weight:600;letter-spacing:0.2px;line-height:24px;color:{C['cream']}'>Log a wine</div>"
            f"<div style='font-family:{SANS};font-size:13px;line-height:18px;color:{C['rose']};margin-top:2px'>Had something good? Capture it.</div></div>{icon('chevron',20,C['gold'])}</div>")

def info_card(ic, title, sub):
    return (f"<div style='display:flex;flex-direction:row;align-items:center;gap:16px;background:{C['parchment']};border:1px solid {C['stone']};border-radius:12px;padding:16px'>"
            f"<div style='width:40px;height:40px;border-radius:8px;background:{C['goldlight']};display:flex;align-items:center;justify-content:center'>{icon(ic,20,C['burgundy'])}</div>"
            f"<div style='flex:1;min-width:0'><div style='font-family:{SANS};font-size:15px;font-weight:600;line-height:22px;color:{C['charcoal']}'>{title}</div>"
            f"<div style='font-family:{SANS};font-size:13px;line-height:18px;color:{C['pewter']};margin-top:1px'>{sub}</div></div>{icon('chevron',18,C['silver'])}</div>")

def wine_card(name, detail, score, mb=8):
    return (f"<div style='display:flex;flex-direction:row;align-items:center;gap:16px;background:{C['parchment']};border:1px solid {C['stone']};border-radius:8px;padding:16px;margin-bottom:{mb}px'>"
            f"<div style='width:36px;height:36px;border-radius:8px;background:{C['goldlight']};display:flex;align-items:center;justify-content:center'>{icon('wine',18,C['burgundy'])}</div>"
            f"<div style='flex:1;min-width:0'><div style='font-family:{SANS};font-size:15px;font-weight:600;line-height:22px;color:{C['charcoal']};white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>{name}</div>"
            f"<div style='font-family:{SANS};font-size:13px;line-height:18px;color:{C['pewter']};margin-top:1px'>{detail}</div></div>"
            f"<div style='font-family:{SERIF};font-size:16px;color:{C['burgundy']}'>{score}</div></div>")

def menu(rows):
    items = []
    for i,(ic,title,sub) in enumerate(rows):
        bb = f"border-bottom:1px solid {C['linen']}" if i < len(rows)-1 else ""
        items.append(f"<div style='display:flex;flex-direction:row;align-items:center;padding:16px;{bb}'>"
                     f"<div style='width:40px;height:40px;border-radius:20px;background:{C['cream']};border:1px solid {C['goldmuted']};display:flex;align-items:center;justify-content:center;margin-right:16px'>{icon(ic,20,C['burgundy'])}</div>"
                     f"<div style='flex:1'><div style='font-family:{SANS};font-size:15px;font-weight:500;line-height:22px;color:{C['charcoal']};margin-bottom:2px'>{title}</div>"
                     f"<div style='font-family:{SANS};font-size:13px;line-height:18px;color:{C['pewter']}'>{sub}</div></div>{icon('chevron',18,C['goldshimmer'])}</div>")
    return f"<div style='background:{C['parchment']};border-radius:12px;border:1px solid {C['stone']};overflow:hidden;box-shadow:0 2px 8px rgba(44,44,44,0.06)'>{''.join(items)}</div>"

def search(placeholder):
    return (f"<div style='display:flex;flex-direction:row;align-items:center;gap:10px;background:{C['parchment']};border:1px solid {C['stone']};border-radius:12px;padding:0 14px;height:44px'>"
            f"{icon('search',18,C['pewter'])}<div style='font-family:{SANS};font-size:15px;color:{C['silver']}'>{placeholder}</div></div>")

def segmented(active):
    segs = []
    for s in ("Tastings","Places","Wishlist"):
        on = s == active
        segs.append(f"<div style='flex:1;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:{C['burgundy'] if on else 'transparent'};"
                    f"font-family:{SANS};font-size:13px;font-weight:600;color:{C['cream'] if on else C['graphite']}'>{s}</div>")
    return f"<div style='display:flex;flex-direction:row;gap:4px;background:{C['parchment']};border:1px solid {C['stone']};border-radius:999px;padding:4px'>{''.join(segs)}</div>"

def place_row(name, sub, count, last=False):
    bb = "" if last else f"border-bottom:1px solid {C['linen']}"
    return (f"<div style='display:flex;flex-direction:row;align-items:center;gap:16px;padding:14px 16px;{bb}'>"
            f"<div style='width:36px;height:36px;border-radius:18px;background:{C['goldlight']};display:flex;align-items:center;justify-content:center'>{icon('pin',18,C['burgundy'])}</div>"
            f"<div style='flex:1;min-width:0'><div style='font-family:{SANS};font-size:15px;font-weight:600;line-height:22px;color:{C['charcoal']};white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>{name}</div>"
            f"<div style='font-family:{SANS};font-size:13px;line-height:18px;color:{C['pewter']};margin-top:1px'>{sub}</div></div>"
            f"<div style='display:flex;flex-direction:column;align-items:flex-end'><div style='font-family:{SERIF};font-size:16px;color:{C['burgundy']}'>{count}</div><div style='font-family:{SANS};font-size:11px;color:{C['pewter']}'>visits</div></div>"
            f"{icon('chevron',18,C['silver'])}</div>")

PLACES = [("Ridgeline Estate","Aug 24 · 5 wines tasted","3"),
          ("Hollow Creek Vineyards","Jul 12 · 4 wines tasted","2"),
          ("Marchetti Family Cellars","Jun 28 · 6 wines tasted","2"),
          ("Stonebridge Winery","May 30 · 3 wines tasted","1"),
          ("Old Mill Vineyard","Apr 19 · 4 wines tasted","1"),
          ("Cedar Row Farm & Winery","Mar 8 · 2 wines tasted","1")]
WINES = [("2021 Cabernet Franc Reserve","Ridgeline Estate · Red","4.5"),
         ("2023 Viognier","Ridgeline Estate · White","4.0"),
         ("Estate Petit Verdot","Ridgeline Estate · Red","3.5"),
         ("2022 Chambourcin","Hollow Creek Vineyards · Red","4.0"),
         ("Dry Rosé of Merlot","Hollow Creek Vineyards · Rosé","3.5")]

def frame(body, tab, layout, note=None):
    return (f"<div style='position:relative;width:390px;height:844px;overflow:hidden;background:{C['cream']};font-family:{SANS};color:{C['charcoal']}'>"
            f"{body}{tabbar(tab, layout)}</div>")

def wrap(inner):
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    body {{ margin: 0; background: {C['cream']}; }}
    a {{ color: {C['burgundy']}; }} a:hover {{ color: {C['wine']}; }}
  </style>
</helmet>
{inner}
</x-dc>
</body>
</html>
"""

def home(layout):
    labels = ("Wines tasted","Places visited","Wishlist")
    body = (f"<div style='padding-top:60px'><div style='display:flex;flex-direction:row;justify-content:space-between;align-items:center;padding:16px 24px'>"
            f"<div>{caption('Welcome back', C['pewter'])}<div style='font-family:{SERIF};font-size:26px;letter-spacing:0.5px;line-height:34px;color:{C['charcoal']};margin-top:2px'>Nick</div></div>"
            f"<div style='width:42px;height:42px;border-radius:21px;background:{C['goldlight']};border:1px solid {C['goldmuted']};display:flex;align-items:center;justify-content:center;font-family:{SERIF};font-size:18px;color:{C['burgundy']}'>NH</div></div>"
            f"<div style='height:1px;background:{C['goldmuted']};margin:0 24px'></div></div>"
            f"<div style='padding:0 24px'>{stats(labels, True)}{hero()}"
            f"{section('Your cellar','Open')}{info_card('cellar','18 bottles','6 ready to drink · 2 past peak')}"
            f"{section('Recent','See all')}{wine_card(*WINES[0])}{wine_card(*WINES[1])}{wine_card(*WINES[3], mb=0)}"
            f"{section('Where you’ve been','Explore')}{info_card('pin','Ridgeline Estate','Most recent · 12 places on your map')}</div>")
    return frame(body, "home", layout)

def profile(layout):
    hdr = screen_header("Profile", right=round_btn("settings"))
    avatar = (f"<div style='display:flex;flex-direction:column;align-items:center;padding:32px 24px 24px'>"
              f"<div style='width:108px;height:108px;border-radius:54px;border:2px solid {C['goldmuted']};display:flex;align-items:center;justify-content:center;margin-bottom:16px'>"
              f"<div style='width:96px;height:96px;border-radius:48px;background:{C['burgundy']};display:flex;align-items:center;justify-content:center;font-family:{SERIF};font-size:32px;font-weight:300;letter-spacing:2px;color:{C['cream']}'>NH</div></div>"
              f"<div style='font-family:{SERIF};font-size:26px;letter-spacing:0.5px;line-height:34px;color:{C['charcoal']}'>Nick</div>"
              f"<div style='font-family:{SANS};font-size:15px;line-height:22px;color:{C['pewter']};margin-top:4px'>nick@example.com</div>"
              f"<div style='display:flex;flex-direction:row;align-items:center;width:120px;margin-top:24px'><div style='flex:1;height:1px;background:{C['goldmuted']}'></div><div style='width:6px;height:6px;background:{C['gold']};transform:rotate(45deg);margin:0 8px'></div><div style='flex:1;height:1px;background:{C['goldmuted']}'></div></div></div>")
    if layout == "A":
        journal = menu([("wine","Your tastings","47 wines, newest first"),("pin","Your places","12 wineries you've visited"),
                        ("bookmark","Wishlist","5 places you want to visit"),("cellar","Cellar","18 bottles at home")])
        first = section("Your journal", mt=0) + journal
    else:
        first = section("Your cellar", mt=0) + menu([("cellar","Cellar","18 bottles · 6 ready to drink")])
    body = (hdr + avatar + f"<div style='padding:0 24px'>{first}"
            f"{section('Sommelier', mt=24)}{menu([('sparkles','Ask the sommelier','Personalized to the wines you’ve rated')])}"
            f"{section('Settings', mt=24)}{menu([('settings','Account settings','Manage your account preferences'),('help','Help & support','Get assistance and FAQs')])}</div>")
    return frame(body, "person", layout)

def places_list_body():
    rows = "".join(place_row(n,s,c, last=(i==len(PLACES)-1)) for i,(n,s,c) in enumerate(PLACES))
    return f"<div style='background:{C['parchment']};border:1px solid {C['stone']};border-radius:12px;overflow:hidden;margin-top:12px'>{rows}</div>"

def places_screen_A():
    hdr = screen_header("Your places", back=True, right=round_btn("map"))
    body = hdr + f"<div style='padding:16px 24px 0'>{search('Search wineries you’ve visited')}{places_list_body()}</div>"
    return frame(body, "person", "A")

def hub_A():
    # dimmed Home behind + sheet
    home_body = home("A")
    sheet_rows = [("wine",C["burgundy"],"Log a wine","Capture a wine you tasted"),
                  ("cellar",C["gold"],"Add a bottle","Add a bottle to your cellar"),
                  ("bookmark",C["slate"],"Add to wishlist","Save a winery you'd like to visit"),
                  ("sparkles",C["goldshimmer"],"Ask the sommelier","Personalized to the wines you've rated")]
    items = []
    for i,(ic,col,t,s) in enumerate(sheet_rows):
        bb = f"border-bottom:1px solid {C['linen']}" if i < len(sheet_rows)-1 else ""
        items.append(f"<div style='display:flex;flex-direction:row;align-items:center;gap:14px;padding:14px 0;{bb}'>"
                     f"<div style='width:40px;height:40px;border-radius:12px;background:{col};display:flex;align-items:center;justify-content:center'>{icon(ic,20,C['cream'])}</div>"
                     f"<div style='flex:1'><div style='font-family:{SANS};font-size:15px;font-weight:600;color:{C['charcoal']}'>{t}</div><div style='font-family:{SANS};font-size:13px;color:{C['pewter']};margin-top:1px'>{s}</div></div>{icon('chevron',18,C['silver'])}</div>")
    chips = "".join(f"<div style='flex:1;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;height:44px;border-radius:999px;background:{C['parchment']};border:1px solid {C['stone']};font-family:{SANS};font-size:13px;font-weight:600;color:{C['burgundy']}'>{icon(ic,16,C['burgundy'])}{t}</div>"
                    for ic,t in (("wine","Tastings"),("pin","Places"),("bookmark","Wishlist")))
    sheet = (f"<div style='position:absolute;inset:0;background:rgba(44,44,44,0.6)'></div>"
             f"<div style='position:absolute;left:0;right:0;bottom:0;background:{C['cream']};border-radius:16px 16px 0 0;padding:8px 24px 48px;box-shadow:0 -8px 24px rgba(44,44,44,0.18)'>"
             f"<div style='width:40px;height:4px;border-radius:2px;background:{C['stone']};margin:0 auto 16px'></div>"
             f"<div style='font-family:{SERIF};font-size:20px;font-weight:500;color:{C['charcoal']};margin-bottom:4px'>Quick actions</div>{''.join(items)}"
             f"<div style='margin-top:20px'>{caption('Browse your journal')}</div><div style='display:flex;flex-direction:row;gap:8px;margin-top:10px'>{chips}</div></div>")
    return home_body.replace("</div>" + tabbar("home","A"), "</div>" + tabbar("home","A") + sheet) if False else \
        (f"<div style='position:relative;width:390px;height:844px;overflow:hidden;background:{C['cream']};font-family:{SANS}'>{home_body}{sheet}</div>")

def journal_B(segment):
    hdr = screen_header("Journal", left_icon="journal", right=round_btn("filter"))
    if segment == "Tastings":
        groups = [("Ridgeline Estate","Sun, Aug 24", WINES[0:3]), ("Hollow Creek Vineyards","Sat, Jul 12", WINES[3:5])]
        content = ""
        for i,(place, date, ws) in enumerate(groups):
            content += (f"<div style='display:flex;flex-direction:row;justify-content:space-between;align-items:baseline;margin:{20 if i else 16}px 0 8px'>"
                        f"<div style='font-family:{SERIF};font-size:17px;font-weight:600;color:{C['charcoal']}'>{place}</div>"
                        f"<div style='font-family:{SANS};font-size:13px;color:{C['pewter']}'>{date}</div></div>")
            for j,w in enumerate(ws): content += wine_card(*w, mb=8)
        body = hdr + f"<div style='padding:16px 24px 0'>{segmented('Tastings')}<div style='margin-top:12px'>{search('Search wines, wineries, varietals')}</div>{content}</div>"
    else:
        body = hdr + f"<div style='padding:16px 24px 0'>{segmented('Places')}<div style='margin-top:12px'>{search('Search wineries you’ve visited')}</div>{places_list_body()}</div>"
    return frame(body, "journal", "B")

def pin_sheet():
    # map background: linen with faint road strokes and three pins
    roads = ("<svg width='390' height='844' viewBox='0 0 390 844' style='position:absolute;inset:0'>"
             f"<rect width='390' height='844' fill='{C['linen']}'/>"
             f"<path d='M-20 220 C120 180 220 300 410 240' stroke='{C['cream']}' stroke-width='14' fill='none'/>"
             f"<path d='M60 -10 C90 200 40 400 120 600' stroke='{C['cream']}' stroke-width='10' fill='none'/>"
             f"<path d='M-10 480 L400 420' stroke='{C['cream']}' stroke-width='8' fill='none'/>"
             f"<path d='M250 -10 C300 200 230 350 330 520' stroke='{C['cream']}' stroke-width='8' fill='none'/>"
             f"<circle cx='300' cy='150' r='60' fill='{C['stone']}' opacity='0.35'/><circle cx='90' cy='560' r='80' fill='{C['stone']}' opacity='0.3'/>"
             "</svg>")
    def pin(x,y,col,big=False):
        s = 44 if big else 32
        return f"<div style='position:absolute;left:{x}px;top:{y}px'>{icon('pin',s,col,fill=True)}</div>"
    pins = pin(180,300,C["burgundy"],True) + pin(70,180,C["sage"]) + pin(290,380,C["sage"]) + pin(120,460,C["slate"])
    pill = (f"<div style='position:absolute;left:24px;right:24px;top:64px;height:44px;border-radius:999px;background:{C['cream']};border:1px solid {C['goldmuted']};display:flex;align-items:center;gap:10px;padding:0 14px;box-shadow:0 2px 8px rgba(44,44,44,0.08)'>"
            f"{icon('search',18,C['pewter'])}<div style='font-family:{SANS};font-size:15px;color:{C['silver']}'>Search wineries</div></div>")
    helpbtn = f"<div style='position:absolute;right:24px;top:124px'>{round_btn('help', border=C['goldmuted'], bg=C['cream'], color=C['burgundy'])}</div>"
    rows = [("wine",C["burgundy"],"View winery & your notes","3 visits · 12 wines tasted", True),
            ("add",C["gold"],"Log a visit here","Start a tasting at Ridgeline Estate", False),
            ("bookmark",C["slate"],"Add to wishlist","Save it for a future trip", False),
            ("trash",C["error"],"Remove pin","", False)]
    items = []
    for i,(ic,col,t,s,primary) in enumerate(rows):
        bb = f"border-bottom:1px solid {C['linen']}" if i < len(rows)-1 else ""
        bg = C["parchment"] if primary else "transparent"
        items.append(f"<div style='display:flex;flex-direction:row;align-items:center;gap:14px;padding:14px 12px;margin:0 -12px;border-radius:10px;background:{bg};{bb}'>"
                     f"<div style='width:40px;height:40px;border-radius:12px;background:{col};display:flex;align-items:center;justify-content:center'>{icon(ic,20,C['cream'])}</div>"
                     f"<div style='flex:1'><div style='font-family:{SANS};font-size:15px;font-weight:600;color:{C['error'] if ic=='trash' else C['charcoal']}'>{t}</div>"
                     + (f"<div style='font-family:{SANS};font-size:13px;color:{C['pewter']};margin-top:1px'>{s}</div>" if s else "") + f"</div>{icon('chevron',18,C['silver']) if ic!='trash' else ''}</div>")
    sheet = (f"<div style='position:absolute;inset:0;background:rgba(44,44,44,0.35)'></div>"
             f"<div style='position:absolute;left:0;right:0;bottom:0;background:{C['cream']};border-radius:16px 16px 0 0;padding:8px 24px 40px;box-shadow:0 -8px 24px rgba(44,44,44,0.18)'>"
             f"<div style='width:40px;height:4px;border-radius:2px;background:{C['stone']};margin:0 auto 16px'></div>"
             f"<div style='display:flex;flex-direction:row;align-items:center;gap:8px;margin-bottom:2px'><div style='font-family:{SERIF};font-size:20px;font-weight:500;color:{C['charcoal']}'>Ridgeline Estate</div>"
             f"<div style='font-family:{SANS};font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:{C['cream']};background:{C['sage']};border-radius:999px;padding:3px 8px'>Visited</div></div>"
             f"<div style='font-family:{SANS};font-size:13px;color:{C['pewter']};margin-bottom:8px'>Last visit Aug 24 · Loudoun County</div>{''.join(items)}</div>")
    return f"<div style='position:relative;width:390px;height:844px;overflow:hidden;background:{C['linen']};font-family:{SANS}'>{roads}{pins}{pill}{helpbtn}{sheet}</div>"

def winery_page():
    hdr = screen_header("Ridgeline Estate", back=True, right=round_btn("bookmark"))
    hero_img = (f"<div style='height:150px;border-radius:12px;background:linear-gradient(160deg,{C['goldlight']},{C['stone']});display:flex;align-items:flex-end;padding:14px;margin-top:16px'>"
                f"<div style='font-family:{SANS};font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:{C['cream']};background:{C['sage']};border-radius:999px;padding:4px 10px'>Visited · 3 times</div></div>")
    actions = (f"<div style='display:flex;flex-direction:row;gap:8px;margin-top:12px'>"
               f"<div style='flex:1;height:44px;border-radius:8px;background:{C['burgundy']};display:flex;align-items:center;justify-content:center;gap:8px;font-family:{SERIF};font-size:15px;color:{C['cream']}'>{icon('add',18,C['cream'])}Log a visit</div>"
               f"<div style='flex:1;height:44px;border-radius:8px;background:{C['parchment']};border:1px solid {C['stone']};display:flex;align-items:center;justify-content:center;gap:8px;font-family:{SERIF};font-size:15px;color:{C['burgundy']}'>{icon('map',18,C['burgundy'])}Directions</div></div>")
    visit_open = (f"<div style='background:{C['parchment']};border:1px solid {C['stone']};border-radius:12px;overflow:hidden'>"
                  f"<div style='display:flex;flex-direction:row;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid {C['linen']}'>{icon('calendar',18,C['burgundy'])}"
                  f"<div style='flex:1'><div style='font-family:{SANS};font-size:15px;font-weight:600;color:{C['charcoal']}'>Sunday, Aug 24</div><div style='font-family:{SANS};font-size:13px;color:{C['pewter']}'>3 wines · with Sarah</div></div>"
                  f"<div style='font-family:{SANS};font-size:13px;color:{C['burgundy']}'>Edit</div></div>"
                  f"<div style='padding:12px 16px 4px;font-family:{SANS};font-size:14px;line-height:20px;color:{C['graphite']};font-style:italic'>“Quiet on a Sunday afternoon. Sat on the back patio; the Cab Franc was the standout again.”</div>"
                  f"<div style='padding:8px 16px 8px'>{wine_card(*WINES[0])}{wine_card(*WINES[1])}{wine_card(*WINES[2], mb=0)}</div></div>")
    def closed(date, sub):
        return (f"<div style='display:flex;flex-direction:row;align-items:center;gap:12px;padding:14px 16px;background:{C['parchment']};border:1px solid {C['stone']};border-radius:12px;margin-top:8px'>{icon('calendar',18,C['burgundy'])}"
                f"<div style='flex:1'><div style='font-family:{SANS};font-size:15px;font-weight:600;color:{C['charcoal']}'>{date}</div><div style='font-family:{SANS};font-size:13px;color:{C['pewter']}'>{sub}</div></div>{icon('chevron',18,C['silver'])}</div>")
    body = (hdr + f"<div style='padding:0 24px'>{hero_img}{actions}"
            f"{section('Your visits', '3 visits · 12 wines', mt=24)}{visit_open}{closed('Saturday, May 3','5 wines · Spring release')}{closed('Sunday, Oct 12, 2025','4 wines')}"
            f"{section('About', mt=24)}<div style='font-family:{SANS};font-size:14px;line-height:20px;color:{C['graphite']}'>Loudoun County, VA · Open Thu–Sun 11–6</div></div>")
    return frame(body, "map", "A")

# ---- write files ----
files = {
  "OptionA_Home.dc.html": home("A"),
  "OptionA_Profile.dc.html": profile("A"),
  "OptionA_Places.dc.html": places_screen_A(),
  "OptionA_QuickActions.dc.html": hub_A(),
  "OptionB_Home.dc.html": home("B"),
  "OptionB_JournalTastings.dc.html": journal_B("Tastings"),
  "OptionB_JournalPlaces.dc.html": journal_B("Places"),
  "OptionB_Profile.dc.html": profile("B"),
  "Main.dc.html": pin_sheet(),
  "Both_WineryPage.dc.html": winery_page(),
}
for name, inner in files.items():
    (OUT/name).write_text(wrap(inner))

W,H,GAP = 390,844,80
def row(y, names):
    return [{"file":n,"x":320+i*(W+GAP),"y":y,"w":W,"h":H} for i,n in enumerate(names)]
boards = (row(0, ["OptionA_Home.dc.html","OptionA_Profile.dc.html","OptionA_Places.dc.html","OptionA_QuickActions.dc.html"])
        + row(1040, ["OptionB_Home.dc.html","OptionB_JournalTastings.dc.html","OptionB_JournalPlaces.dc.html","OptionB_Profile.dc.html"])
        + row(2080, ["Main.dc.html","Both_WineryPage.dc.html"]))
titles = {"OptionA_Home.dc.html":"A · Home","OptionA_Profile.dc.html":"A · Profile","OptionA_Places.dc.html":"A · Your places (new)","OptionA_QuickActions.dc.html":"A · Quick actions",
          "OptionB_Home.dc.html":"B · Home","OptionB_JournalTastings.dc.html":"B · Journal › Tastings","OptionB_JournalPlaces.dc.html":"B · Journal › Places","OptionB_Profile.dc.html":"B · Profile",
          "Main.dc.html":"Both · Pin sheet, reordered","Both_WineryPage.dc.html":"Both · Winery page, visits first"}
for b in boards: b["title"] = titles[b["file"]]
canvas = {
  "artboards": boards,
  "annotations": [
    {"id":"note-a","x":0,"y":0,"w":260,"text":"OPTION A — Findability fixes\nKeeps today's five tabs (Home · Cellar · + · Explore · Profile).\n\nWhat changes: Home tiles become labeled links, Profile gets a 'Your journal' section, a new Your places list screen, and the + sheet gains a Browse row.\n\nWhy: 1–2 days, no structural risk, nothing testers already know moves.\nTradeoff: tastings still have no tab of their own; the main route stays 'Home tile' or 'Profile row'."},
    {"id":"note-b","x":0,"y":1040,"w":260,"text":"OPTION B — Journal tab (recommended)\nHome · Journal · + · Explore · Profile.\n\nJournal is one screen with Tastings / Places / Wishlist segments, grouped by visit. Cellar leaves the bar and lives in a Home card, a Profile row, and the + sheet.\n\nWhy: the thing people create most gets a tab; 'where are my wines' becomes one obvious tap.\nTradeoff: cellar users lose a dedicated tab (still one tap from Home); +2–3 days."},
    {"id":"note-both","x":0,"y":2080,"w":260,"text":"APPLIES TO BOTH\nPin sheet: 'View winery & your notes' is the primary row; 'Log a visit here' goes straight into the log flow. A persistent ? on the map brings the drop-pin hint back.\n\nWinery page: Your visits sits above About, the latest visit is expanded, and the canned About sentence is gone.\n\nAll names, wines and counts here are sample data."},
  ],
  "launch": {"view":"canvas"}
}
(OUT/"canvas.json").write_text(json.dumps(canvas, indent=2))
print("wrote", len(files), "artboards")

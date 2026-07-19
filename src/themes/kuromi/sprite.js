// sprite.js — the pixel-imp atelier. Kuromi's stand-in is an original
// jester-hood imp (black hood, pink skull patch, lavender face, one
// fang), drawn on a 28×24 grid with a 10-color palette. Every mood
// frame is baked ONCE to a tiny data-URL and cached forever; the UI
// swaps frames on a slow stepped interval — no per-frame rendering,
// no canvas loops. Under reduced-motion a single static frame shows.
//
// Mood is an honest function of the day's real state (see chrome.jsx):
// bored (nothing to do) · plot (work pending) · work (some done)
// · win (slate cleared) · idle (fallback).

const PAL = {
  K: "#2a1e38", // hood
  D: "#150e20", // outline / sockets / pupils
  P: "#ff4d9e", // hot pink (horn tips, hearts)
  p: "#ff85c0", // skull patch pink / tongue
  L: "#eddcf7", // face lavender
  W: "#ffffff", // fang / teeth
  Y: "#ffd23f", // arcade yellow (z's)
  ".": null,
};

const FRAMES = {
  idle_a: [
    "P..........................P",
    "PK........................KP",
    "PKK......................KKP",
    ".KKK....................KKK.",
    ".KKKK..................KKKK.",
    "..KKKKK..............KKKKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKKLLLLLLLLLLLLKKKKKK..",
    "..KKKLLDDLLLLDDLLLKKKKK...",
    "..KKKLLDDLLLLDDLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDDDWLLLKKK.......",
    "...KKLLLLLLLLLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
  idle_b: [
    "P..........................P",
    "PK........................KP",
    "PKK......................KKP",
    ".KKK....................KKK.",
    ".KKKK..................KKKK.",
    "..KKKKK..............KKKKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKKLLLLLLLLLLLLKKKKKK..",
    "..KKKLLLDLLLLLLLLLKKKKK...",
    "..KKKLDDDLLLLDDLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDDDWLLLKKK.......",
    "...KKLLLLLLLLLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
  plot_a: [
    "P..........................P",
    "PK........................KP",
    "PKK......................KKP",
    ".KKK....................KKK.",
    ".KKKK..................KKKK.",
    "..KKKKK..............KKKKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKKLLLLLLLLLLLLKKKKKK..",
    "..KKKLDDDLLLLDDLLLKKKKK...",
    "..KKKLLLDLLLLLLLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDDDDLLLKKK.......",
    "...KKLLLLLWLWLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
  plot_b: [
    "P..........................P",
    "PK........................KP",
    "PKK......................KKP",
    ".KKK....................KKK.",
    ".KKKK..................KKKK.",
    "..KKKKK..............KKKKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKKLLLLLLLLLLLLKKKKKK..",
    "..KKKLDDDLLLLDDLLLKKKKK...",
    "..KKKLLLDLLLLLLLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDDDDLLLKKK.......",
    "...KKLLLLWWWWLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
  work_a: [
    "P..........................P",
    "PK........................KP",
    "PKK......................KKP",
    ".KKK....................KKK.",
    ".KKKK..................KKKK.",
    "..KKKKK..............KKKKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKKLLLLLLLLLLLLKKKKKK..",
    "..KKKLLDDLLLLDDLLLKKKKK...",
    "..KKKLLDDLLLLDDLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDDDWLLLKKK.......",
    "...KKLLLLLppLLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
  work_b: [
    "P..........................P",
    "PK........................KP",
    "PKK......................KKP",
    ".KKK....................KKK.",
    ".KKKK..................KKKK.",
    "..KKKKK..............KKKKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKKLLLLLLLLLLLLKKKKKK..",
    "..KKKLLDDLLLLDDLLLKKKKK...",
    "..KKKLLDDLLLLDDLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDDDWLLLKKK.......",
    "...KKLLLLppLLLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
  win_a: [
    "P..........................P",
    "PK........................KP",
    "PKKP.P...................KKP",
    ".KKPPP................P.PKK.",
    ".KKKP.................PPPKK.",
    "..KKKKK..............KKPKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKKLLLLLLLLLLLLKKKKKK..",
    "..KKKLDLDLLLLDLLLLKKKKK...",
    "..KKKLLDDLLLLLDLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDWWDLLLKKK.......",
    "...KKLLLLLLLLLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
  win_b: [
    "P..........................P",
    "PK...................P.P..KP",
    "PKK..................PPP.KKP",
    ".KK...................P.PKK.",
    ".KKK..................PPPKK.",
    "..KKKKK..............KKPKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKKLLLLLLLLLLLLKKKKKK..",
    "..KKKLDLDLLLLDLLLLKKKKK...",
    "..KKKLLDDLLLLLDLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDWWDLLLKKK.......",
    "...KKLLLLLLLLLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
  bored_a: [
    "P..........................P",
    "PK........................KP",
    "PKK......................KKP",
    ".KKK.................YYYKKK.",
    ".KKKK.................YKKKK.",
    "..KKKKK..............YYYKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKKLLLLLLLLLLLLKKKKKK..",
    "..KKKLLLDLLLLLLLLLKKKKK...",
    "..KKKLLDDLLLLDDLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDDDWLLLKKK.......",
    "...KKLLLLLLLLLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
  bored_b: [
    "P..........................P",
    "PK........................KP",
    "PKK...................YYYKKP",
    ".KKK...................YKKK.",
    ".KKKK.................YYYKK.",
    "..KKKKK..............KKKKK..",
    "..KKKKKKKKKKKKKKKKKKKKKKKK..",
    "...KKKKKKKKKKKKKKKKKKKKKK...",
    "...KKKKKKKppppKKKKKKKKKKK...",
    "..KKKKKKKppppppKKKKKKKKKK..",
    "..KKKKKKppDppDppKKKKKKKKK..",
    "..KKKKKKKpppDpppKKKKKKKK..",
    "...KKKKKKpppppKKKKKKKKK...",
    "..KKKKKKLLLLLLLLKKKKKKKK..",
    "..KKKLLLDLLLLLLLLLKKKKK...",
    "..KKKLLDDLLLLDDLLLKKK.....",
    "..KKKLLLLLLLLLLLLKKK......",
    "..KKKLLLLDDDWLLLKKK.......",
    "...KKLLLLLLLLLLKK..........",
    "...KKKLLLLLLLKKK...........",
    "....KKKKKKKKKK............",
    ".....KKK..KKK.............",
    "....KKK....KKK............",
  ],
};

/* small glyphs, single color ("X" = ink pixel) */

export const GLYPH_SKULL = [
  ".XXXXXX.",
  "XXXXXXXX",
  "XX.XX.XX",
  "XXXXXXXX",
  ".XXXXXX.",
  ".X.X.X.X",
];

export const GLYPH_HEART = [
  "X.X",
  "XXX",
  ".X.",
];

export const GLYPH_STAR = [
  "..X..",
  ".XXX.",
  "XXXXX",
  ".XXX.",
  ".X.X.",
];

/* the oven: rows + color map → 1px-per-cell PNG data URL, cached */

const cache = new Map();

export function bakeGlyph(rows, colorMap) {
  const key = JSON.stringify([rows, colorMap]);
  const hit = cache.get(key);
  if (hit) return hit;
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = colorMap[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const url = cv.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

// A mood frame of the imp, as a CSS backgroundImage value.
export function impFrame(name) {
  return bakeGlyph(FRAMES[name] || FRAMES.idle_a, PAL);
}

// A one-color glyph (skull / heart / star) recolored on demand.
export function glyph(rows, color) {
  return bakeGlyph(rows, { X: color });
}

export function spriteCacheSize() { return cache.size; }

// journey/cards/icons.js — the single owner of the chip glyph data.
//
// U01c (2026-08-22): the `I()` helper and the `CARD_ICONS` table used to sit at
// the foot of journey/cards/index.js, below the idle-warming scheduler. They
// are lifted here whole, byte-for-byte, so the glyph data has one owner and
// index.js is left as the package face that re-exports it. Nothing about what
// the table CONTAINS changed: same six keys (agent and app added 2026-10-26: eight now), same key order, same markup, same
// `I()` signature. See tools/test-card-icons.mjs for the key/markup/signature
// proof against the pre-move bytes.
//
// DATA ONLY, AND THAT IS THE ACCEPTANCE CRITERION, NOT A STYLE NOTE. U01c's
// definition is "move card icon metadata behind one data-only owner ... NO
// WARMING SIDE EFFECT". This module therefore imports nothing, schedules
// nothing, fetches nothing and reads no ambient global: evaluating it is
// observationally inert. The idle-warming cascade and its import-time
// self-start stay exactly where U01a left them, in journey/cards/index.js,
// with the same 1500 ms epoch — module evaluation of index.js. Moving that
// call site is D116's subject and belongs to U06; it is deliberately NOT
// touched here. tools/test-card-icons.mjs measures the inertness directly
// (import this module under recording clock/idle/fetch/document doubles and
// every counter must read zero) rather than asserting it in a comment.
//
// ACYCLIC BY CONSTRUCTION: this module is a leaf. It has no imports at all, so
// it cannot participate in a cycle — index.js depends on it, never the reverse.
//
// CONTRACT (consumed by ui.js's chip builder and rail.js's marker builder, both
// via journey/cards/index.js): CARD_ICONS[nodeId] is a complete `<svg>` string,
// assigned straight to `.innerHTML`. A node with no entry here keeps the plain
// dot — both consumers test `CARD_ICONS[id]` for presence first — so this table
// is allowed to be partial, and adding a key is what lights a node's chip up.

/* Chip glyphs (Hannah, 2026-08-18: "imagine if we had minimalistic icons
   instead [of the white dots], one custom to each … all the same colour and
   elegant but minimalistic"). One hairline pictograph per initiative, all
   drawn in the same hand: 12-unit grid, single stroke weight, round joins,
   currentColor (the chip paints them house-gold, cards.css .j-hot-ico).
   ui.js drops one into the chip's dot slot when the node has an entry here;
   every other hotspot keeps the plain dot. */
const I = (paths) =>
  `<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">${paths}</svg>`;

export const CARD_ICONS = {
  // a torch — the mark arcagidan.com puts above its own wordmark; the
  // flame tapers to a point so it cannot read as a keyhole
  arca: I('<path d="M6 1c.95 1.25 1.4 2.25 1.4 3.05a1.4 1.4 0 0 1-2.8 0C4.6 3.25 5.05 2.25 6 1Z"/><path d="M4.55 6.2h2.9M6 6.2v4.3"/>'),
  // a bare die — compute, pins out
  artcompute: I('<rect x="3.4" y="3.4" width="5.2" height="5.2" rx="0.8"/><path d="M5 3.4V1.8M7 3.4V1.8M5 10.2V8.6M7 10.2V8.6M3.4 5H1.8M3.4 7H1.8M10.2 5H8.6M10.2 7H8.6"/>'),
  // an open spread — the publication
  tworp: I('<path d="M6 3.1C5.05 2.25 3.75 1.95 2.3 2.05v7.1c1.45-.1 2.75.2 3.7 1.05.95-.85 2.25-1.15 3.7-1.05v-7.1C8.25 1.95 6.95 2.25 6 3.1Z"/><path d="M6 3.1v7.1"/>'),
  // a place pin — gatherings in the real world
  ados: I('<path d="M6 1.7a3.2 3.2 0 0 1 3.2 3.2C9.2 7.1 6 10.3 6 10.3S2.8 7.1 2.8 4.9A3.2 3.2 0 0 1 6 1.7Z"/><circle cx="6" cy="4.9" r="1.05"/>'),
  // a hive cell holding one point of light
  hivemind: I('<path d="M6 1.45 9.85 3.7v4.6L6 10.55 2.15 8.3V3.7Z"/><circle cx="6" cy="6" r="1.1"/>'),
  // a speech bubble — the room where the talk happens
  discord: I('<path d="M2.1 3.5C2.1 2.7 2.75 2.05 3.55 2.05h4.9c.8 0 1.45.65 1.45 1.45v3.2c0 .8-.65 1.45-1.45 1.45H5.7L3.55 9.95V8.15C2.75 8.15 2.1 7.5 2.1 6.7Z"/>'),
  // a small robot head — the Astrid agent (the LOWER Equip chip; was the
  // unbuilt `quark` glyph, 2026-10-05)
  agent: I('<path d="M6 1.25v1.6"/><rect x="2.5" y="2.85" width="7" height="6.1" rx="1.5"/><circle cx="4.55" cy="5.6" r="0.6"/><circle cx="7.45" cy="5.6" r="0.6"/><path d="M4.85 7.45h2.3M1.35 5.05v1.75M10.65 5.05v1.75"/>'),
  // a toolbox — the Astrid app (the UPPER Equip chip; was `brotchen`)
  app: I('<path d="M4.45 4.1V2.95c0-.4.3-.7.7-.7h1.7c.4 0 .7.3.7.7V4.1"/><rect x="1.7" y="4.1" width="8.6" height="5.75" rx="1"/><path d="M1.7 6.75h3.35M6.95 6.75h3.35"/><rect x="5.05" y="6.05" width="1.9" height="1.4" rx="0.35"/>'),
};

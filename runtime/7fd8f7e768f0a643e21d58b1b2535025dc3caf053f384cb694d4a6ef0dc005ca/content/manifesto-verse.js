// THE MANIFESTO IS VERSE (2026-11-12). Each entry of CONTENT.manifesto.lines
// is one stanza; `\n` inside it separates its verse lines. Words are inked
// one stagger beat apart, and a verse line ends on a held breath of
// VERSE_PAUSE_BEATS extra beats. Every clock that keys off word beats (the
// live word spans, concept swells, link availability, settle timers and the
// camera's reading schedule) reads them from here, so none of them drifts.
export const VERSE_PAUSE_BEATS = 3;
// A blank line inside a stanza (`\n\n`) is a long breath, about a second at
// the 0.11 s stagger, with no extra space on the page (2026-11-12).
export const VERSE_LONG_PAUSE_BEATS = 9;

/** Split one stanza into verse lines and give every word its reveal beat.
 *  `words` is the stanza's words in reading order (newlines flattened),
 *  `lineStarts` the word index where each verse line begins, `beats` each
 *  word's beat, and `span` the beats the stanza occupies (last beat + 1). */
export function manifestoVerse(stanza) {
  const lines = [], words = [], beats = [], lineStarts = [];
  let beat = 0, long = false;
  for (const text of stanza.split('\n')) {
    const line = text.trim().split(/\s+/).filter(Boolean);
    if (!line.length) { long = lines.length > 0; continue; }
    if (lines.length) beat += long ? VERSE_LONG_PAUSE_BEATS : VERSE_PAUSE_BEATS;
    long = false;
    lines.push(line);
    lineStarts.push(words.length);
    for (const word of line) { words.push(word); beats.push(beat++); }
  }
  return { lines, words, beats, lineStarts, span: beat };
}

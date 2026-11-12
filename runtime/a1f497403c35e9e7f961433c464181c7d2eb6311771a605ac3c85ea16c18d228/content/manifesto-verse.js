// THE MANIFESTO IS VERSE (2026-11-12). Each entry of CONTENT.manifesto.lines
// is one stanza; `\n` inside it separates its verse lines. Words are inked
// one stagger beat apart, and a verse line ends on a held breath of
// VERSE_PAUSE_BEATS extra beats. Every clock that keys off word beats (the
// live word spans, concept swells, link availability, settle timers and the
// camera's reading schedule) reads them from here, so none of them drifts.
export const VERSE_PAUSE_BEATS = 3;

/** Split one stanza into verse lines and give every word its reveal beat.
 *  `words` is the stanza's words in reading order (newlines flattened),
 *  `lineStarts` the word index where each verse line begins, `beats` each
 *  word's beat, and `span` the beats the stanza occupies (last beat + 1). */
export function manifestoVerse(stanza) {
  const lines = stanza.split('\n').map(line => line.trim().split(/\s+/).filter(Boolean)).filter(line => line.length);
  const words = [], beats = [], lineStarts = [];
  let beat = 0;
  lines.forEach((line, i) => {
    if (i > 0) beat += VERSE_PAUSE_BEATS;
    lineStarts.push(words.length);
    for (const word of line) { words.push(word); beats.push(beat++); }
  });
  return { lines, words, beats, lineStarts, span: beat };
}

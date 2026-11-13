// Match authored words and phrases, not fixed word offsets, so copy edits keep their accents.
// THREE STRANDS, ONE WORD EACH (2026-11-12, the verse text). The opening
// stanza's spores, threads and food, and the story's LoRA and tool, share
// the three pastel palettes; the closing links carry the same strands
// (content/manifesto-links.js). Each word is matched in its own stanza only,
// so "the threads" in the last stanza stays plain. Every one
// takes the slow organism swell on its own reveal beat.
const STRANDS = [
  { id: 'passage', word: 'spores', stanza: 0 },
  { id: 'soil', word: 'threads', stanza: 0 },
  { id: 'sun', word: 'food', stanza: 0 },
  { id: 'passage', word: 'lora', stanza: 1 },
  { id: 'sun', word: 'tool', stanza: 1 },
];
// The kinship thread (and the imagination spectrum in branch.js) are dormant
// treatments: no phrase of the current text selects them.
// 2026-11-12: "endless content and ever smarter machines" recedes (hollow):
// it inks like body text and settles a shade dimmer and cooler.
const PHRASES = [
  { id: 'synthesis', phrase: 'thick unruly strokes' },
  { id: 'hollow', phrase: 'endless content and ever smarter machines' },
  { id: 'kinship', phrase: 'open models and open tools' },
  { id: 'vitality', phrase: 'bustles with this kind of creative life' },
];
// The authored em dash joins life—with; only 'life' carries the accent.
const normalized = word => word.split('—')[0].toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
const split = word => {
  const ink = word.match(/^[A-Za-z0-9']+/)?.[0] || word;
  return { ink, suffix: word.slice(ink.length) };
};

/** The accents of one stanza: `words` are its words in reading order,
 *  `stanza` its index in CONTENT.manifesto.lines. */
export function manifestoConcepts(words, stanza) {
  const tokens = words.map(normalized);
  const matches = new Map();
  for (const { id, word, stanza: only } of STRANDS) {
    if (only !== stanza) continue;
    const index = tokens.indexOf(word);
    if (index < 0 || matches.has(index)) continue;
    matches.set(index, { id, role: 'organism', ...split(words[index]) });
  }
  for (const { id, phrase } of PHRASES) {
    const phraseWords = phrase.toLowerCase().split(' ');
    const start = tokens.findIndex((_, i) => phraseWords.every((word, j) => tokens[i + j] === word));
    if (start < 0) continue;
    let characterOffset = 0;
    phraseWords.forEach((_, offset) => {
      const { ink, suffix } = split(words[start + offset]);
      matches.set(start + offset, {
        id, role: 'phrase', offset, ink, suffix,
        start, end: start + phraseWords.length - 1, characterOffset, characterTotal: phrase.length,
      });
      characterOffset += ink.length + 1;
    });
  }
  return matches;
}

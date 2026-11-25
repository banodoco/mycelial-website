// The closing sentence connects the manifesto to its lived chapters.
// 2026-11-12: each link also carries its strand's resting colour (`concept`,
// a palette of content/manifesto-concepts.js) and swells on its own beat:
// connecting is the rose of the threads, equipping the green of the food,
// nourishing the blue of the spores.
export const MANIFESTO_LINKS = [
  { phrase: 'connecting', chapter: 'connect', concept: 'soil', label: 'Jump to the Connect section' },
  { phrase: 'equipping', chapter: 'equip', concept: 'sun', label: 'Jump to the Equip section' },
  { phrase: 'nourishing', chapter: 'inspire', concept: 'passage', label: 'Jump to the Inspire section' },
];
export function manifestoLinks(words) {
  const tokens = words.map(word => word.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, ''));
  const matches = new Map();
  for (const destination of MANIFESTO_LINKS) {
    const phrase = destination.phrase.split(' ');
    const start = tokens.findIndex((_, i) => phrase.every((word, offset) => tokens[i + offset] === word));
    if (start >= 0) phrase.forEach((_, offset) => matches.set(start + offset, {
      ...destination, start, end: start + phrase.length - 1,
    }));
  }
  return matches;
}

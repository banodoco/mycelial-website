import assert from 'node:assert/strict';
import { CONTENT } from '../content/content.js';
import { manifestoConcepts } from '../content/manifesto-concepts.js';
import { manifestoLinks } from '../content/manifesto-links.js';
import { manifestoVerse, VERSE_PAUSE_BEATS } from '../content/manifesto-verse.js';
// 2026-11-12: three strands, one word each; the closing links carry them too.
const stanzas = CONTENT.manifesto.lines.map(stanza => manifestoVerse(stanza).words);
const matches = stanzas.map((words, i) => manifestoConcepts(words, i));
const accents = (i, id) => [...matches[i]].filter(([, match]) => match.id === id).map(([index, match]) => [stanzas[i][index], match]);
assert.equal(stanzas.length, 4, 'four stanzas');
for (const [stanza, id, words] of [[0, 'passage', ['Spores']], [0, 'sun', ['Food']], [0, 'soil', ['Threads']],
  [1, 'passage', ['LoRA']], [1, 'sun', ['tool']], [1, 'soil', []], [2, 'passage', []], [2, 'sun', []], [2, 'soil', []],
  [3, 'passage', []], [3, 'sun', []], [3, 'soil', []]]) {
  const found = accents(stanza, id);
  assert.deepEqual(found.map(([word]) => word), words, `stanza ${stanza + 1}: ${id} accents only ${words.join(', ') || 'nothing'}`);
  for (const [, match] of found) assert.equal(match.role, 'organism', 'reuse the existing slow concept pulse');
}
assert.equal(matches[3].get(stanzas[3].findIndex(word => /^threads$/i.test(word))), undefined,
  'the threads beneath it all stays plain');
for (const word of ['painter', 'engineer', 'stranger', 'people', 'models']) {
  const i = stanzas.findIndex(words => words.includes(word));
  assert.ok(i >= 0 && !matches[i].has(stanzas[i].indexOf(word)), `${word} is plain`);
}
const phrase = accents(1, 'synthesis');
assert.deepEqual(phrase.map(([, match]) => match.ink), ['thick', 'unruly', 'strokes']);
assert.deepEqual(phrase.map(([, match]) => match.suffix), [',', '', '.'], 'punctuation stays outside the gradient');
assert.equal(phrase[1][1].characterOffset, phrase[0][1].ink.length + 1, 'palette continues through the separating space');
assert.equal(phrase.at(-1)[1].characterOffset + phrase.at(-1)[1].ink.length, phrase[0][1].characterTotal,
  'palette reaches its final partner color at the last glyph');
const css = (await import('node:fs')).readFileSync(new URL('../mycelial.css', import.meta.url), 'utf8');
assert.match(css, /--synthesis-from: var\(--palette-passage\);\s*--synthesis-via: var\(--palette-soil\);\s*--synthesis-to: var\(--palette-sun\);/,
  'the strokes run blue, rose, green');
assert.deepEqual(accents(2, 'vitality').map(([, match]) => match.ink),
  ['bustles', 'with', 'this', 'kind', 'of', 'creative', 'life']);
assert.ok(!matches.some(m => [...m.values()].some(match => match.id === 'kinship' || match.id === 'imagination')),
  'the kinship thread and imagination spectrum are dormant');
const total = matches.reduce((n, m) => n + m.size, 0);
assert.equal(total, 5 + 3 + 7, 'nothing else is highlighted');
const links = manifestoLinks(stanzas[3]);
assert.deepEqual([...links.values()].map(link => [link.phrase, link.concept]),
  [['seeding', 'passage'], ['nourishing', 'sun'], ['connecting', 'soil']], 'each link carries its strand');
// The verse helper: a verse line is its own run of beats, then a held breath.
const verse = manifestoVerse('a b\nc\n\nd e');
assert.deepEqual(verse.lines, [['a', 'b'], ['c'], ['d', 'e']]);
assert.deepEqual(verse.lineStarts, [0, 2, 3]);
assert.deepEqual(verse.beats, [0, 1, 2 + VERSE_PAUSE_BEATS, 3 + 2 * VERSE_PAUSE_BEATS, 4 + 2 * VERSE_PAUSE_BEATS]);
assert.equal(verse.span, verse.beats.at(-1) + 1);
assert.equal(manifestoVerse('one two three').span, 3, 'prose keeps one beat per word');
assert.ok(!/\n/.test(CONTENT.manifesto.body) && CONTENT.manifesto.body.includes('wind. Threads'), 'body reads as prose');
console.log('PASS manifesto strands (Spores/LoRA, Food/tool, Threads), tinted links, blue-rose-green synthesis and verse beats.');

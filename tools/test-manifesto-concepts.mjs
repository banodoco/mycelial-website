import assert from 'node:assert/strict';
import { CONTENT } from '../content/content.js';
import { manifestoConcepts } from '../content/manifesto-concepts.js';
import { manifestoLinks } from '../content/manifesto-links.js';
import { manifestoVerse, VERSE_PAUSE_BEATS, VERSE_LONG_PAUSE_BEATS } from '../content/manifesto-verse.js';
// 2026-11-12: three strands, one word each; the closing links carry them too.
const stanzas = CONTENT.manifesto.lines.map(stanza => manifestoVerse(stanza).words);
const matches = stanzas.map((words, i) => manifestoConcepts(words, i));
const accents = (i, id) => [...matches[i]].filter(([, match]) => match.id === id).map(([index, match]) => [stanzas[i][index], match]);
assert.equal(stanzas.length, 8, 'eight paragraphs, including the opening verse');
const last = stanzas.length - 1;
for (const [stanza, id, words] of [[0, 'passage', ['Spores']], [0, 'sun', ['Food']], [0, 'soil', ['Threads']],
  [1, 'passage', ['LoRA']], [1, 'sun', []], [1, 'soil', []],
  [2, 'passage', []], [2, 'sun', []], [2, 'soil', ['tool']],
  [3, 'passage', []], [3, 'sun', ['sculpts']], [3, 'soil', []],
  ...[4, 5, 6, 7].flatMap(i => [[i, 'passage', []], [i, 'sun', []], [i, 'soil', []]])]) {
  const found = accents(stanza, id);
  assert.deepEqual(found.map(([word]) => word), words, `stanza ${stanza + 1}: ${id} accents only ${words.join(', ') || 'nothing'}`);
  for (const [, match] of found) assert.equal(match.role, 'organism', 'reuse the existing slow concept pulse');
}
assert.equal(matches[last].size, 0, 'the closing paragraph has only the chapter-link accents');
for (const word of ['painter', 'engineer', 'stranger', 'person’s', 'pursuit']) {
  const i = stanzas.findIndex(words => words.includes(word));
  assert.ok(i >= 0 && !matches[i].has(stanzas[i].indexOf(word)), `${word} is plain`);
}
const phrase = accents(3, 'synthesis');
assert.deepEqual(phrase.map(([, match]) => match.ink), ['thick', 'unruly', 'strokes']);
assert.deepEqual(phrase.map(([, match]) => match.suffix), [',', '', '.'], 'punctuation stays outside the gradient');
assert.equal(phrase[1][1].characterOffset, phrase[0][1].ink.length + 1, 'palette continues through the separating space');
assert.equal(phrase.at(-1)[1].characterOffset + phrase.at(-1)[1].ink.length, phrase[0][1].characterTotal,
  'palette reaches its final partner color at the last glyph');
const css = (await import('node:fs')).readFileSync(new URL('../mycelial.css', import.meta.url), 'utf8');
// Mobile: adding a paragraph must not switch on a bottom clipping mask.
const mobileReading = css.match(/\.j-manifesto\.is-scroll-reading \.j-manifesto-lines\s*\{([^}]*--reading-mask-top:[^}]+)\}/)?.[1];
assert.ok(mobileReading, 'mobile reading aperture exists');
assert.match(mobileReading, /height:\s*100%;/, 'the reading box does not grow with the text');
assert.match(mobileReading, /padding-bottom:\s*max\(24px, var\(--reading-pad-bottom, 1rem\)\);/, 'final ink rests clear of the fade');
assert.equal((mobileReading.match(/#000 calc\(100% - 20px\), transparent/g) || []).length, 2, 'fixed bottom fade in both mask implementations');
assert.doesNotMatch(css, /\.has-reading-below[^{}]*\{[^}]*\}/, 'new scrollable content cannot toggle the painted bottom edge');
const verseStyle = css.match(/\.j-manifesto-verse,\s*\.manifesto-static \.manifesto-verse\s*\{([^}]+)\}/)?.[1];
assert.ok(verseStyle, 'live and static share the verse block');
assert.match(verseStyle, /padding-left:\s*0;/, 'soft wraps share the first line\'s left edge');
assert.match(verseStyle, /text-indent:\s*0;/, 'no hanging indent');
assert.match(verseStyle, /display:\s*block;/, 'authored verse breaks remain blocks');
assert.match(css, /--synthesis-from: var\(--palette-passage\);\s*--synthesis-via: var\(--palette-soil\);\s*--synthesis-to: var\(--palette-sun\);/,
  'the strokes run blue, rose, green');
// 2026-11-12: the machines' phrase recedes (hollow), on its own stanza
assert.deepEqual(accents(4, 'hollow').map(([, match]) => match.ink), ['endless', 'content', 'and', 'ever', 'smarter', 'machines']);
assert.equal(accents(4, 'hollow').at(-1)[1].suffix, '.', 'its full stop stays plain');
assert.match(css, /\.manifesto-concept\.concept-hollow \{[^}]*opacity: \.86;/, 'the hollow phrase rests dimmer');
assert.deepEqual(accents(5, 'vitality').map(([, match]) => match.ink),
  ['bustles', 'with', 'this', 'kind', 'of', 'creative', 'life']);
assert.ok(!matches.some(m => [...m.values()].some(match => match.id === 'kinship' || match.id === 'imagination')),
  'the kinship thread and imagination spectrum are dormant');
const total = matches.reduce((n, m) => n + m.size, 0);
assert.equal(total, 6 + 3 + 6 + 7, 'nothing else is highlighted');
const strandOrder = stanza => [...matches[stanza]].sort(([a], [b]) => a - b)
  .filter(([, match]) => match.role === 'organism').map(([, match]) => match.id);
assert.deepEqual(strandOrder(0), ['passage', 'soil', 'sun']);
assert.deepEqual([1, 2, 3].flatMap(strandOrder), strandOrder(0), 'LoRA, tool, sculpts repeat the opening blue, rose, green order');
const links = manifestoLinks(stanzas[last]);
assert.deepEqual([...links.values()].map(link => [link.phrase, link.concept]),
  [['connecting', 'soil'], ['equipping', 'sun'], ['nourishing', 'passage']], 'each link carries its strand');
assert.deepEqual([...links.values()].map(link => link.chapter), ['connect', 'equip', 'inspire'], 'closing verbs navigate to their corresponding chapters');
// The verse helper: a verse line is its own run of beats, then a held breath.
const verse = manifestoVerse('a b\nc\nd e');
assert.deepEqual(verse.lines, [['a', 'b'], ['c'], ['d', 'e']]);
assert.deepEqual(verse.lineStarts, [0, 2, 3]);
assert.deepEqual(verse.beats, [0, 1, 2 + VERSE_PAUSE_BEATS, 3 + 2 * VERSE_PAUSE_BEATS, 4 + 2 * VERSE_PAUSE_BEATS]);
assert.equal(verse.span, verse.beats.at(-1) + 1);
assert.equal(manifestoVerse('one two three').span, 3, 'prose keeps one beat per word');
// A blank line keeps the stanza but makes its breath the long one.
const long = manifestoVerse('a b\n\nc\nd');
assert.deepEqual(long.lines, [['a', 'b'], ['c'], ['d']]);
assert.deepEqual(long.beats, [0, 1, 2 + VERSE_LONG_PAUSE_BEATS, 3 + VERSE_LONG_PAUSE_BEATS + VERSE_PAUSE_BEATS]);
assert.ok(Math.abs(VERSE_LONG_PAUSE_BEATS * 0.11 - 1) < .05, 'the long breath is about a second');
for (const stanza of CONTENT.manifesto.lines.slice(1)) {
  const paragraph = manifestoVerse(stanza);
  assert.equal(paragraph.lines.length, 1, 'prose paragraphs wrap naturally');
  assert.equal(paragraph.span, paragraph.words.length, 'prose reveal uses word beats');
}
assert.deepEqual(CONTENT.manifesto.lines, [
  "Spores on the wind.\nThreads through the soil.\nFood on the forest floor.",
  "A painter wants to make a short film in her own style, so she trains a LoRA on years of her work. And shares it.",
  "An engineer she’ll never meet builds a tool for sculpting in 3D. He shares that too.",
  "A year later, a stranger making a murder mystery sculpts a planet so small everyone on it is a suspect, its hills, trees and sky made of her thick, unruly strokes.",
  "Some dream of endless content and ever smarter machines.",
  "We dream of a world that bustles with this kind of creative life.",
  "Where the end of one person’s obsessive creative pursuit is the beginning of someone else’s.",
  "Mycelial is our attempt to help this world take root — connecting its makers, equipping their ambitions, and nourishing what grows between them."
], 'owner-approved copy and paragraph breaks');
const opening = manifestoVerse(CONTENT.manifesto.lines[0]);
assert.deepEqual(opening.lineStarts.slice(1).map(start => opening.beats[start] - opening.beats[start - 1] - 1),
  [VERSE_PAUSE_BEATS, VERSE_PAUSE_BEATS], 'the opening keeps its short breaths though its lines end in full stops');
assert.equal(CONTENT.manifesto.holds.length, CONTENT.manifesto.lines.length, 'one hold per stanza');
assert.ok(!/\n/.test(CONTENT.manifesto.body) && CONTENT.manifesto.body.includes('wind. Threads'), 'body reads as prose');
console.log('PASS manifesto strands (Spores/LoRA, Threads/tool, Food/sculpts), tinted links, blue-rose-green synthesis, receding machines and verse beats.');

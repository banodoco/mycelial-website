import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../mycelial.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const overview = html.match(/<button class="hero-cue hero-cue-overview"[^>]*>[\s\S]*?<\/button>/)?.[0];
assert.ok(overview, 'Overview remains a real button');
assert.match(overview, /aria-haspopup="dialog"/);
assert.match(overview, /viewBox="0 0 16 16"[^>]*><path d="M4 12 12 4M5\.5 4H12V10\.5"/, 'Overview has its own symmetric up-right arrow');
assert.match(css, /\.hero-cue-overview \.hero-cue-arrow\s*\{\s*rotate:\s*none;\s*\}/, 'the diagonal path is not rotated a second time');
// The mobile angle must outrank the runtime's inline --cue-aim on every resize.
assert.match(css, /@media \(pointer: coarse\), \(max-width: 720px\), \(max-width: 900px\) and \(orientation: portrait\)\s*\{\s*\.ui \.hero \.hero-cue-explore\s*\{\s*--cue-aim:\s*90deg\s*!important;\s*\}\s*\}/, 'Explore points vertically down on touch and narrow viewports even when JS writes its angle');
assert.match(css, /\.ui \.hero \.hero-cue-arrow\s*\{[^}]*rotate:\s*var\(--cue-aim\);/, 'the Explore arrow uses that angle');
const fineHover = /@media \(hover: hover\) and \(pointer: fine\) \{\s*(\.ui \.hero \.hero-cue:hover\s*\{[^}]+\}\s*\.ui \.hero \.hero-cue:hover \.hero-cue-arrow\s*\{[^}]+\})\s*\}/;
const hover = css.match(fineHover);
assert.ok(hover, 'hover feedback is restricted to a fine hover-capable pointer');
assert.match(hover[1], /translate:\s*calc\(cos\(var\(--cue-aim\)\)/, 'desktop retains its directional nudge');
assert.doesNotMatch(css.replace(hover[0], ''), /\.hero-cue:hover/, 'touch cannot retain any cue hover styles');
assert.match(css, /\.hero-cue:active\s*\{\s*color:\s*var\(--gold-bright\);\s*\}/, 'tap feedback changes colour without moving the icon');
console.log('PASS hero cue style: centered Overview arrow, mouse-only hover nudge, stationary touch feedback.');

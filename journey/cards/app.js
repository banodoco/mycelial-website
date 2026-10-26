// app — "a new kind of video editor" (Astrid, astrid.haus). The stage is a
// miniature of the real editor the homepage opens onto: a dark panel over a
// paper preview with a clip timeline underneath. Sources, verified against
// the live hero (astrid.haus, the editor's own screenshots):
//   panel #24211b · hairline #4a4337 · timeline well #1b1915
//   paper #f7f4ed · sphere #c9772f -> #a94714 · playhead sky #38bdf8
//   clips: three segments 8 : 12 : 8, named "First light", "Passing shapes",
//   "A quiet finish" — the same clips the hero's timeline carries.
//
// Motion is CSS only, one 9.6 s loop: the playhead sweeps the three clips,
// the clip under it lights, and the preview answers the clip it is on (the
// sphere drifts in, crosses, then settles brighter and centred). All of it
// is gated on `.ap-live`, so activate() starts it and deactivate() stops it
// by removing one class; at rest and under reduced motion the stage is a
// still frame with the playhead over "Passing shapes".

import { REDUCE } from './runtime.js';

const CLIPS = [
  { label: 'First light' },
  { label: 'Passing shapes' },
  { label: 'A quiet finish' },
];
const TICKS = ['0:00', '0:05', '0:10'];

let stageEl = null;

function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export default {
  build(stage) {
    stageEl = stage;
    stage.classList.add('ap');

    // the miniature is decoration: its meaning is the description above it
    const panel = node('div', 'ap-panel');
    panel.setAttribute('aria-hidden', 'true');

    // preview — paper, one soft orange sphere (the hero's own still)
    const preview = node('div', 'ap-preview');
    preview.append(node('span', 'ap-sphere'));

    // timeline — a ruler over one track; the playhead sweeps both
    const tl = node('div', 'ap-tl');

    const ruler = node('div', 'ap-ruler');
    const scale = node('div', 'ap-scale');
    for (const t of TICKS) scale.append(node('span', 'ap-tick', t));
    ruler.append(scale);

    const track = node('div', 'ap-track');
    track.append(node('span', 'ap-track-label', 'Light study'));
    const clips = node('div', 'ap-clips');
    CLIPS.forEach((c, i) => clips.append(node('div', `ap-clip ap-clip-${i + 1}`, c.label)));
    track.append(clips);

    const sweep = node('div', 'ap-sweep');
    sweep.append(node('span', 'ap-head'));

    tl.append(ruler, track, sweep);
    panel.append(preview, tl);
    stage.append(panel);
  },

  activate() {
    if (REDUCE.matches || !stageEl) return;   // still frame under reduced motion
    stageEl.classList.add('ap-live');
  },

  deactivate() {
    if (stageEl) stageEl.classList.remove('ap-live');
  },
};

// app — "a new kind of video editor" (Astrid, astrid.haus). The stage is a
// miniature of the real editor the homepage opens onto: a dark player well
// holding one 16:9 frame, over a clip timeline. Sources, verified against
// the live hero (astrid.haus, the editor's own screenshots) and the light
// study's own anchor frames (mycelial-website assets/astrid/*-anchor.jpg):
//   panel #24211b · hairline #4a4337 · well #1b1915 · paper #f4f1e9
//   sphere ochre #c27e3b · slate block #7b939a · playhead sky #38bdf8
//   clips: three segments 8 : 12 : 8, named "First light", "Passing shapes",
//   "A quiet finish" — the clips the hero's timeline carries. The frame shows
//   each one as the study does: the sphere alone, the slate block passing
//   it, the two at rest together.
//
// Motion is CSS only, one 9.6 s loop: the playhead sweeps the three clips,
// the clip under it lights, and the frame CUTS to that clip's shot as the
// playhead crosses each boundary, the way an editor plays a sequence; inside
// each clip the motion is slow. All of it is gated on `.ap-live`, so
// activate() starts it and deactivate() stops it by removing one class; at
// rest and under reduced motion the stage is a still frame with the playhead
// over "Passing shapes" and the frame on that shot.

import { REDUCE } from './runtime.js';

const CLIPS = [
  { label: 'First light' },
  { label: 'Passing shapes' },
  { label: 'A quiet finish' },
];
// the sequence is 8 + 12 + 8 = 28 s; ticks sit at their own second
const SEQUENCE_S = 28;
const TICKS = [[0, '0:00'], [10, '0:10'], [20, '0:20']];

let stageEl = null;

function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export default {
  build(stage, content) {
    stageEl = stage;
    stage.classList.add('ap');

    // the miniature is decoration: its meaning is the description above it
    const panel = node('div', 'ap-panel');
    panel.setAttribute('aria-hidden', 'true');

    // preview — the player: a dark well around one 16:9 frame of the study,
    // the slate block first so the sphere paints over it
    const preview = node('div', 'ap-preview');
    const paper = node('div', 'ap-paper');
    paper.append(node('span', 'ap-block'), node('span', 'ap-sphere'));
    preview.append(paper);

    // timeline — a ruler over one track; the playhead sweeps both
    const tl = node('div', 'ap-tl');

    const ruler = node('div', 'ap-ruler');
    const scale = node('div', 'ap-scale');
    for (const [sec, text] of TICKS) {
      const tick = node('span', 'ap-tick', text);
      tick.style.setProperty('--t', (sec / SEQUENCE_S).toFixed(4));
      scale.append(tick);
    }
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

    // the ending — the shared foot band, href and label from the content
    const link = content.card.link;
    const door = document.createElement('a');
    door.className = 'ap-door card-door card-cta';
    door.href = link.href;
    door.target = '_blank';
    door.rel = 'noopener noreferrer';
    door.tabIndex = -1;   // ui.js promotes controls to tabbable on pin
    door.textContent = `${link.label.toUpperCase()} →`;

    stage.append(panel, door);
  },

  activate() {
    if (REDUCE.matches || !stageEl) return;   // still frame under reduced motion
    stageEl.classList.add('ap-live');
  },

  deactivate() {
    if (stageEl) stageEl.classList.remove('ap-live');
  },
};

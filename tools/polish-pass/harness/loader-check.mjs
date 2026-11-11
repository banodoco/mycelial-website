import assert from 'node:assert/strict';
const { loadPortraitSprite } = await import('/home/user/wt/perf/journey/chapters/owned/portrait-photo-loader.js');
let image; globalThis.Image = class { constructor() { image = this; } };
const pending = loadPortraitSprite(5); await assert.rejects(pending, /timed out/); image.onload(); await assert.rejects(pending, /timed out/);
const loaded = loadPortraitSprite(50); image.onload(); assert.equal((await loaded).sheet, image);
const d = loadPortraitSprite(50); let res; image.decode = () => new Promise(r => res = r); image.onload(); res(); assert.equal((await d).sheet, image);
console.log('loader ok');

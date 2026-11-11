const m = await import('/home/user/mycelial-website/journey/manifesto/pose.js');
const { CONTENT } = await import('/home/user/mycelial-website/content/content.js');
const wc = CONTENT.manifesto.lines.map(l=>l.trim().split(/\s+/).length);
console.log('words', wc, 'starts', m.lineSecondsFor(wc), 'CAMERA_SECONDS', m.CAMERA_SECONDS);

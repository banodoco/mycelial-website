const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/VERIFY-motion/C/';
const FROM = process.argv[2], TO = process.argv[3], NF = +process.argv[4], TAG = process.argv[5];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  await p.clock.install();
  await p.goto('http://localhost:'+(process.env.PORT||8150)+'/?nointro=1', { waitUntil: 'load' });
  for (let i=0;i<400;i++) { if (await p.evaluate(()=>!!window.journey)) break; await p.waitForTimeout(300); }
  await p.clock.pauseAt(await p.evaluate(()=>Date.now()+3000));
  await p.evaluate(async (f)=>{const r=await import('/journey/route.js'); window.journey.scrollTo(r.restProgress(f));}, FROM);
  for (let i=0;i<10;i++) await p.clock.runFor(100);
  await p.evaluate(()=>{
    const J=window.journey, S=J.hero; window.__rec=[]; let n=0;
    const fin=J.chapters.final.group; const am=[]; fin.traverse(o=>{const m=o.material; for(const mm of [].concat(m||[])){const u=mm.uniforms; if(u&&u.uAmount&&!am.includes(u.uAmount)) am.push(u.uAmount);} });
    const gnd=(S.groups.ground&&S.groups.ground.children||[]).filter(o=>o.material&&o.material.uniforms&&o.material.uniforms.uOpacity);
    const motes=S.scene.children.filter(o=>o.isPoints&&o!==S.groups.spores);
    const cv=document.querySelector('canvas'); const sm=document.createElement('canvas'); sm.width=48; sm.height=30; const sc=sm.getContext('2d',{willReadFrequently:true});
    S.addAnimator('s2log',()=>{ 
      const r={n:n++, rf:S.renderer.info.render.frame, t:performance.now()|0, p:+J.p.toFixed(4), tp:+J.travelP.toFixed(4), ch:J.chapter,
        fogN:S.scene.fog.near, fogF:S.scene.fog.far, look:J.hero&&null,
        finalVis:fin.visible, am:am.map(u=>+u.value.toFixed(3)), gnd:gnd.map(o=>+o.material.uniforms.uOpacity.value.toFixed(3)), gndVis:gnd.map(o=>o.visible?1:0),
        motes:motes.map(o=>(o.visible?1:0)+':'+(o.material.uniforms&&o.material.uniforms.uOpacity?+o.material.uniforms.uOpacity.value.toFixed(3):'')),
        cam:[S.camera.position.x,S.camera.position.y,S.camera.position.z].map(v=>+v.toFixed(2)), fov:+S.camera.fov.toFixed(1)};
      const l=J.lens.look; r.gain=+l.gain.toFixed(3); r.vig=+l.vig.toFixed(3); r.lift=+l.lift.toFixed(3); r.hal=+l.hal.toFixed(3);
      const hero=document.querySelector('.ui .hero'); const sc2=document.querySelector('.scrim'); r.scrim=sc2?sc2.style.opacity:null; const co=document.querySelector('.callouts'); r.callouts=co?co.style.opacity:null; r.heroOp=hero?+getComputedStyle(hero).opacity:null;
      window.__rec.push(r); });
    window.__lum=[]; window.__th=[];
    const gl=S.renderer.getContext(); const W=gl.drawingBufferWidth, H=gl.drawingBufferHeight; const buf=new Uint8Array(W*H*4);
    const tc=document.createElement('canvas'); tc.width=W; tc.height=H; const tx=tc.getContext('2d'); const id=tx.createImageData(W,H);
    const sc3=document.createElement('canvas'); sc3.width=320; sc3.height=200; const sx=sc3.getContext('2d');
    const orig=S.composer.render.bind(S.composer); let k=0;
    S.composer.render=function(...a){ const r=orig(...a); try{ gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,buf); let y=0; for(let i=0;i<buf.length;i+=4) y+=0.2126*buf[i]+0.7152*buf[i+1]+0.0722*buf[i+2]; window.__lum.push(y/(buf.length/4)); if(k%8==0){ for(let row=0;row<H;row++){ id.data.set(buf.subarray((H-1-row)*W*4,(H-row)*W*4),row*W*4);} tx.putImageData(id,0,0); sx.drawImage(tc,0,0,320,200); window.__th.push([k,sc3.toDataURL('image/jpeg',0.8)]); } }catch(e){window.__lum.push(-1)} k++; return r; };
  });
  await p.evaluate((t)=>window.journey.flyTo(t), TO);
  for (let f=0; f<NF; f++) { await p.clock.runFor(16); if (f%20==0) console.log('f',f); }
  const rec = await p.evaluate(()=>window.__rec), lum = await p.evaluate(()=>window.__lum); const th = await p.evaluate(()=>window.__th); th.forEach(([k,u])=>fs.writeFileSync(OUT+TAG+'-t'+String(k).padStart(3,'0')+'.jpg', Buffer.from(u.split(',')[1],'base64')));
  fs.writeFileSync(OUT+TAG+'-rec.json', JSON.stringify({rec,lum}));
  await b.close(); console.log('done');
})();

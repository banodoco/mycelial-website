const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/S2-wrap-lighting/';
const FROM = process.argv[2] || 'final', TO = process.argv[3] || 'mission', EVERY = +(process.argv[4]||3), TAG = process.argv[5] || (FROM+'-'+TO+'-det');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +(process.env.W||1440), height: +(process.env.H||900) } });
  await p.clock.install();
  p.on('pageerror', e => console.log('ERR', e.message.slice(0,200)));
  await p.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load' });
  const step = async (n) => { for (let i=0;i<n;i++) await p.clock.runFor(16.667); };
  // wait for journey
  for (let i=0;i<200;i++) { await step(30); if (await p.evaluate(()=>!!window.journey)) break; await p.waitForTimeout(300); }
  await p.clock.pauseAt(await p.evaluate(()=>Date.now()+50)); console.log('paused');
  console.log('journey up', await p.evaluate(()=>window.journey.chapter));
  await p.evaluate((e)=>{window.__every=e;}, EVERY);
  await p.evaluate(async (f)=>{const r=await import('/journey/route.js'); window.journey.scrollTo(r.restProgress(f));}, FROM);
  console.log('placed'); for (let i=0;i<10;i++) await p.clock.runFor(100); console.log('settled');
  console.log('at', JSON.stringify(await p.evaluate(()=>window.journey.debugState())));
  await p.evaluate(()=>{ window.__log=[]; window.__mo = new MutationObserver(ms=>{ for(const m of ms) window.__log.push({t:performance.now()|0,tgt:(m.target.className&&m.target.className.toString?m.target.className.toString():'').slice(0,40)+'#'+(m.target.id||''),attr:m.attributeName,val:(m.target.getAttribute&&m.target.getAttribute(m.attributeName)||'').toString().slice(0,80)}); }); window.__mo.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['class','data-chapter','data-mode','style','hidden']}); });
  await p.evaluate(()=>{ const cv=document.querySelector('canvas'); const sm=document.createElement('canvas'); sm.width=64; sm.height=40; const sc=sm.getContext('2d',{willReadFrequently:true}); const th=document.createElement('canvas'); th.width=320; th.height=200; const tc=th.getContext('2d'); window.__lum=[]; window.__th=[]; let n=0; const tick=()=>{ requestAnimationFrame(tick); try{ sc.drawImage(cv,0,0,64,40); const d=sc.getImageData(0,0,64,40).data; let r=0,g=0,b=0; for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];} const k=d.length/4; window.__lum.push([n,r/k,g/k,b/k]); if(n%(window.__every||3)==0){ tc.drawImage(cv,0,0,320,200); window.__th.push([n,th.toDataURL('image/jpeg',0.8)]); } }catch(e){window.__lum.push([n,-1,String(e)])} n++; }; requestAnimationFrame(tick); });
  const frames = [];
  await p.evaluate((t)=>window.journey.flyTo(t), TO);
  for (let f=0; f<+(process.env.NF||360); f++) { if(f%20==0) console.log('f',f,Date.now()%100000);
    await p.clock.runFor(16.667);
    if (f%4!==0) continue;
    const st = await p.evaluate(()=>{ const j=window.journey; const d=j.debugState(); const cv=document.querySelector('canvas'); 
      const hero=document.querySelector('.ui .hero'); const scrim=[...document.querySelectorAll('[class*=scrim],[class*=veil],[class*=vignette]')].map(e=>e.className+':'+getComputedStyle(e).opacity);
      return {p:d.p, ch:d.chapter, fog:d.fog, lens:d.lens, pose:d.pose, fov:d.fov, heroOp: hero?getComputedStyle(hero).opacity:null, scrim, bodyCls: document.body.className, cvFilter: cv?getComputedStyle(cv).filter+'|'+getComputedStyle(cv).opacity:null, tm: j.hero.renderer? j.hero.renderer.toneMappingExposure : null};});
    st.f=f;
    frames.push(st);
    if (f>30 && f%30==0) { const tr = await p.evaluate(()=>window.journey.transitionSeconds); }
  }
  const lum = await p.evaluate(()=>window.__lum); const th = await p.evaluate(()=>window.__th); th.forEach(([n,u])=>fs.writeFileSync(OUT+TAG+'-'+String(n).padStart(3,'0')+'.jpg', Buffer.from(u.split(',')[1],'base64'))); fs.writeFileSync(OUT+TAG+'-lum.json', JSON.stringify(lum));
  const mo = await p.evaluate(()=>window.__log);
  fs.writeFileSync(OUT+TAG+'.json', JSON.stringify({frames, mo}));
  await b.close();
})();

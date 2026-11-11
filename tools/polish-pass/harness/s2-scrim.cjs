const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 320, height: 200 } });
  await p.goto('http://localhost:8137/?nointro=1', { waitUntil: 'load' });
  for (let i=0;i<400;i++) { if (await p.evaluate(()=>!!window.journey)) break; await p.waitForTimeout(300); }
  const rd=()=>p.evaluate(()=>{const g=s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);return [e.style.opacity,c.opacity,c.visibility,c.display]};return {scrim:g('.scrim'),spill:g('.spill'),callouts:g('.callouts'),vign:g('.vignette'),p:window.journey.p}});
  console.log('mission', JSON.stringify(await rd()));
  await p.evaluate(async ()=>{const r=await import('/journey/route.js'); window.journey.scrollTo(r.restProgress('final'));});
  await p.waitForTimeout(3000);
  console.log('final', JSON.stringify(await rd()));
  await p.evaluate(async ()=>{const r=await import('/journey/route.js'); window.journey.scrollTo(r.restProgress('equip'));});
  await p.waitForTimeout(3000);
  console.log('equip', JSON.stringify(await rd()));
  await b.close();
})();

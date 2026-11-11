
const { chromium } = require('playwright');
const OUT='/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/IMPL-hoverfix';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:260},deviceScaleFactor:2});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(8000);
const rd=()=>p.evaluate(()=>{const t=document.querySelector('.manifesto-phrase-thread'),s=getComputedStyle(t);return {h:s.getPropertyValue('--thread-hover'),a:(s.backgroundImage.match(/rgba?\([^)]*\)/g)||[]).map(c=>c.split(/[ ,\/]+/).pop().replace(')','')),m:t.matches(':hover'),tr:s.transition}});
const ws=await p.locator('.j-manifesto-word').all();const bx=await Promise.all(ws.map(w=>w.boundingBox()));
console.log('lines',new Set(bx.map(x=>Math.round(x.y))).size);
const clip={x:0,y:Math.min(...bx.map(x=>x.y))-20,width:420,height:200};
await p.mouse.move(2,2);console.log('rest',JSON.stringify(await rd()));await p.screenshot({path:OUT+'/standalone-rest.png',clip});
const hov=async(n,x,y,wait=500)=>{await p.mouse.move(x,y,{steps:3});await p.waitForTimeout(wait);console.log(n,JSON.stringify(await rd()))};
await hov('first',bx[0].x+bx[0].width/2,bx[0].y+bx[0].height/2);await p.screenshot({path:OUT+'/standalone-hover.png',clip});
await hov('gap',bx[1].x+bx[1].width-1,bx[1].y+bx[1].height/2);
await hov('last',bx[4].x+bx[4].width/2,bx[4].y+bx[4].height/2);
await p.mouse.move(2,2);await p.waitForTimeout(300);console.log('after300',JSON.stringify(await rd()));
await b.close();})();
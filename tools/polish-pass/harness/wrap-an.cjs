const d=require('/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/IMPL-wrap/'+process.argv[2]+'-rec.json');
const rec=d.rec,lum=d.lum; const n=rec.length;
// web = ground index with the biggest range
let best=0,bi=0; for(let i=0;i<rec[0].gnd.length;i++){const v=rec.map(r=>r.gnd[i]);const rg=Math.max(...v)-Math.min(...v);if(rg>best){best=rg;bi=i}}
const w=rec.map(r=>r.gnd[bi]); const lo=Math.min(...w),hi=Math.max(...w);
const at=q=>w.findIndex((v,i)=>i>5&&(v-lo)/(hi-lo)>=q);
const f10=at(.1),f90=at(.9);
console.log('frames',n,'web idx',bi,'range',lo,hi,'10%',f10,'90%',f90,'secs',((f90-f10)/60).toFixed(2),'start',w[0],'end',w[n-1]);
let md=0,mi=0;for(let i=1;i<lum.length;i++){const x=Math.abs(lum[i]-lum[i-1]);if(x>md){md=x;mi=i}}
console.log('lum f0',lum[0].toFixed(1),'min',Math.min(...lum).toFixed(1),'@',lum.indexOf(Math.min(...lum)),'end',lum[lum.length-1].toFixed(1),'maxdelta',md.toFixed(2),'@',mi);
let prev=null;rec.forEach((r,i)=>{const m=r.motes.join('|');if(m!==prev&&(prev===null||r.motes.some((x,k)=>x.split(':')[0]!==prev.split('|')[k].split(':')[0])))console.log('mote visible flip f',i,m);prev=m});
console.log('final vis off at',rec.findIndex(r=>!r.finalVis));
console.log('web by 20f:',w.filter((_,i)=>i%20==0).join(' '));
console.log('lum by 20f:',lum.filter((_,i)=>i%20==0).map(x=>x.toFixed(0)).join(' '));
console.log('tp end',rec[n-1].p,rec[n-1].ch);

const fs=require('fs');
const f=process.argv[2];
const lines=fs.readFileSync(f,'utf8').trim().split('\n');
const h=lines[0].split(',');
const rows=lines.slice(1).map(l=>{const c=l.split(',');const o={};h.forEach((k,i)=>o[k]=c[i]);return o;});
const mv=rows.filter(r=>r.speed_u_s!==''&&r.speed_u_s!==undefined);
const end=3248;
console.log('frames',rows.length,'with speed',mv.length);
// speed over last 600 ms before end
const tail=mv.filter(r=>+r.rel_ms>=end-600-16 && +r.rel_ms<=end+200);
console.log('rel_ms speed accel');
tail.forEach(r=>console.log(r.rel_ms.padStart(5), (+r.speed_u_s).toFixed(3).padStart(8), (+r.accel_u_s2).toFixed(2).padStart(8), r.copy_inspire_heading, r.copy_inspire_sub));
// local minima / reversals in speed over tail
let dips=[];
for(let i=1;i<tail.length-1;i++){const a=+tail[i-1].speed_u_s,b=+tail[i].speed_u_s,c=+tail[i+1].speed_u_s; if(b<a&&b<c) dips.push(tail[i].rel_ms);}
console.log('local speed minima in tail (ms):',dips.join(','));
// full-move: speed at 3248 approach
// Non-monotone decay check in tail: count increases
let inc=0;for(let i=1;i<tail.length;i++){ if(+tail[i].speed_u_s>+tail[i-1].speed_u_s+1e-6) inc++; }
console.log('increase steps in tail window:',inc);
// plateau run detail: frames with speed < 2% peak
const peak=Math.max(...mv.map(r=>+r.speed_u_s));
const low=mv.filter(r=>+r.speed_u_s<0.02*peak && +r.rel_ms>200);
console.log('peak',peak.toFixed(3),'2%=',(0.02*peak).toFixed(3),'low frames:',low.map(r=>r.rel_ms+':'+(+r.speed_u_s).toFixed(3)).join(' '));
// heading crossings absolute from rel_ms (copy opacity)
const x=(key,th)=>{for(const r of mv){ if(+r[key]>=th) return +r.rel_ms; }return null;};
console.log('heading 10/50/90 crossing ms:', ['10','50','90'].map(p=>null).length); 

const fs=require('fs');
const rows=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const endMs=+process.argv[3];
const names={};
rows.forEach(r=>(r.hot||[]).forEach(([n,o])=>{names[n]=names[n]||[];names[n].push([r.t,o]);}));
const firstRelAt=(arr,th,dir)=>{for(const [t,o] of arr){ if(dir>0? o>=th : o<=th) return t; } return null;};
const t0=rows[0].t;
for(const n of Object.keys(names)){
  const a=names[n];
  const s02=firstRelAt(a,0.02,1), s98=firstRelAt(a,0.98,1);
  console.log(JSON.stringify(n).slice(0,40).padEnd(42),'start(>=0.02)',s02===null?'-':(s02-t0).toFixed(0),'settle(>=0.98)',s98===null?'-':(s98-t0).toFixed(0),'vsEnd',s98===null?'-':((s98-t0)-endMs).toFixed(0));
}
console.log('rows',rows.length,'hot sample row0', JSON.stringify(rows[0].hot).slice(0,200));

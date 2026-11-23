/* Mycelial slide 2 — the capabilities remain; access progressively frays.
 * A deterministic Canvas2D filament scene. Works alongside the existing artwork
 * motes, and exports a snapshot with the contract expected by gap.js.
 * Visual attrition is illustrative, never an empirical conversion claim.
 */
(() => {
  'use strict';
  const root = document.querySelector('[data-scatter-field]');
  if (!root) return;
  const slide = root.closest('.slide');
  const originalCanvas = root.querySelector('.sf-dust');
  const originalSnapshot = root.snapshot?.bind(root);
  const canvas = document.createElement('canvas');
  canvas.className = 'ff-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  root.append(canvas);
  const g = canvas.getContext('2d');
  if (!g) return;
  const hits = document.createElement('div');
  hits.className = 'ff-hits';
  const note = document.createElement('div');
  note.className = 'ff-note';
  note.setAttribute('role', 'status');
  note.setAttribute('aria-live', 'polite');
  note.innerHTML = '<span class="ff-note-kind"></span><b class="ff-note-name"></b><span class="ff-note-detail"></span>';
  root.append(hits, note);

  const fallback = [
    ['model','Upscaler','Restore intricate detail in footage','Video super-resolution with open image and video upscalers.'],
    ['lora','Motion','Direct a particular camera movement','Fine-tune motion using open LoRAs and control techniques.'],
    ['workflow','Workflow','Keep a character consistent','Use references and multiple generation steps across shots.'],
    ['repo','Tool','Replace elements of a scene','Masks, conditioning and frame-aware editing tools.'],
    ['guide','Guide','Control the look of an image','Learn advanced prompting, compositing and colour methods.'],
    ['thread','Discussion','Solve difficult temporal artifacts','Community workarounds for flicker, joins and consistency.'],
  ];
  const catalogue = (Array.isArray(root.filamentItems) && root.filamentItems.length ? root.filamentItems : fallback)
    .map((r,i) => ({ id:i, type:r[0], where:r[1], name:r[2], detail:r[3] }));
  const colors = { model:'#f2c77e', lora:'#dbb2ca', repo:'#a9d7b2', workflow:'#a9c8e5', thread:'#c8bbeb', guide:'#e6c9a2' };
  const gates = [
    ['DISCOVER','Find the right model, tool or workflow across scattered repositories and discussions.'],
    ['SET UP','Resolve dependencies, hardware, model downloads and installation conflicts.'],
    ['CONFIGURE','Learn the right settings, prompting and control techniques for a useful result.'],
    ['COMBINE','Connect incompatible outputs and iterate across multiple tools in one creative process.']
  ];
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const ease=t=>t*t*(3-2*t);
  const hash=n=>{let z=(n+0x6D2B79F5)|0;z=Math.imul(z^(z>>>15),z|1);z^=z+Math.imul(z^(z>>>7),z|61);return ((z^(z>>>14))>>>0)/4294967296;};
  const hexRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const alpha=(hex,a)=>`rgba(${hexRgb(hex).join(',')},${clamp(a).toFixed(3)})`;
  const point=(a,b,t)=>a+(b-a)*t;
  const N=42;
  let w=0,h=0,dpr=1,geom=[],sources=[],raf=0,last=0,elapsed=0,clock=0,mode='inactive',start=0;
  let visit=null, hovered=-1, pinned=-1, pointerLeave=0, pulseId=0, pulses=[], launchAt=0, shadow=0;
  // Capability identity belongs to each individual dot, not to the entire field.
  const assignments=Array.from({length:N},(_,i)=>(i*13)%catalogue.length);
  const reborn=Array(N).fill(-100);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOff=()=>reduced || window.deckStill?.() || document.hidden;
  const owned=()=>slide.classList.contains('on') && !document.getElementById('overview')?.classList.contains('on');
  const now=()=>window.deckNow?.() ?? performance.now();
  const canvasArea=()=>({ left:root.getBoundingClientRect().left, top:root.getBoundingClientRect().top });
  const stopIndex=(i)=>{const x=hash(i*17+6);return x<.29?0:x<.56?1:x<.78?2:x<.93?3:4;};
  const activeItem=i=>catalogue[assignments[i]];
  const gateX=()=>[.345,.49,.635,.78].map(x=>w*x);
  const stops=()=>gateX();
  const layout=()=>{
    const box=root.getBoundingClientRect(),nw=box.width,nh=box.height;
    if(nw<1||nh<1)return;
    w=nw;h=nh;dpr=Math.min(2,devicePixelRatio||1);
    const bw=Math.max(1,Math.round(w*dpr)),bh=Math.max(1,Math.round(h*dpr));
    if(canvas.width!==bw)canvas.width=bw;if(canvas.height!==bh)canvas.height=bh;
    canvas.style.width=w+'px';canvas.style.height=h+'px';
    g.setTransform(dpr,0,0,dpr,0,0);
    const narrow=w<700,top=narrow?h*.50:h*.47,bottom=narrow?h*.835:h*.85;
    geom=Array.from({length:N},(_,i)=>{
      const u=(i+.5)/N;
      const y=top+u*(bottom-top)+(hash(i*41+9)-.5)*(narrow?8:12);
      const x0=w*(narrow?.08:.11)+(hash(i*33+2)-.5)*Math.min(w*.012,12);
      const xf=w*(narrow?.95:.925);
      const end=stopIndex(i);
      const nodes=Array.from({length:6},(_,k)=>{
        const x=k===0?x0:k===5?xf:gateX()[k-1];
        return{x,y:y+(k===0?0:(hash(i*37+k*63)-.5)*Math.min(30,h*.05))};
      });
      return {id:i,nodes,y,x0,xf,end,seed:hash(i*541+31),color:colors[activeItem(i).type]||'#d3b180'};
    });
    if(!hits.children.length){
      for(let i=0;i<N;i++){
        const b=document.createElement('button'); b.type='button';b.className='ff-hit';
        b.dataset.id=String(i);b.setAttribute('aria-label','Inspect creative capability');
        b.addEventListener('pointerenter',()=>inspect(i,false));
        b.addEventListener('focus',()=>inspect(i,false));
        b.addEventListener('pointerleave',()=>release(i));
        b.addEventListener('blur',()=>release(i));
        b.addEventListener('click',e=>{e.preventDefault();inspect(i,true);});
        hits.append(b);
      }
    }
    Array.from(hits.children).forEach((b,i)=>{
      b.style.left=geom[i].x0+'px';b.style.top=geom[i].y+'px';
      b.setAttribute('aria-label',`Inspect ${activeItem(i).name}`);
    });
    draw();
  };
  const cubic=(a,b,t)=>{
    const mid=(a.x+b.x)/2,delta=Math.abs(b.x-a.x)*.06;
    const c1={x:mid-delta,y:a.y+(b.y-a.y)*.18};
    const c2={x:mid+delta,y:b.y-(b.y-a.y)*.18};
    const q=1-t;
    return{x:q*q*q*a.x+3*q*q*t*c1.x+3*q*t*t*c2.x+t*t*t*b.x,
      y:q*q*q*a.y+3*q*q*t*c1.y+3*q*t*t*c2.y+t*t*t*b.y};
  };
  const position=(strand,t)=>{
    const k=clamp(t)*5,idx=Math.min(4,Math.floor(k));
    return cubic(strand.nodes[idx],strand.nodes[idx+1],k-idx);
  };
  function displayText(i){
    const item=activeItem(i);
    note.querySelector('.ff-note-kind').textContent=item.where;
    note.querySelector('.ff-note-name').textContent=item.name;
    note.querySelector('.ff-note-detail').textContent=item.detail;
    note.classList.add('is-on');
    hits.children[i]?.setAttribute('aria-label',`Selected: ${item.name}`);
  }
  const inspect=(i,lock)=>{
    if(!owned()||mode!=='rest')return;
    hovered=i;if(lock)pinned=i;
    displayText(i);
    pulses.push({id:i,at:clock-0.08,duration:2.9,inspection:true});
    pulses=pulses.slice(-12);
    wake();
  };
  const release=i=>{
    if(pinned===i)return;
    if(hovered===i)hovered=-1;
    if(hovered<0&&pinned<0)note.classList.remove('is-on');
  };
  // Click empty space or Escape to return to the quiet field.
  slide.addEventListener('pointerdown',e=>{
    if(!e.target.closest('.ff-hit')&&pinned>=0){pinned=-1;hovered=-1;note.classList.remove('is-on');}
  });
  slide.addEventListener('keydown',e=>{if(e.key==='Escape'){pinned=-1;hovered=-1;note.classList.remove('is-on');}});
  const frameColor=(color,a)=>{g.strokeStyle=alpha(color,a);};
  const drawLine=(strand,segment,opacity,build,thin=0)=>{
    const a=strand.nodes[segment],b=strand.nodes[segment+1];
    if(opacity<.002||build<=0)return;
    const len=18;g.beginPath();g.moveTo(a.x,a.y);
    for(let j=1;j<=len;j++){
      const p=cubic(a,b,j/len*build);g.lineTo(p.x,p.y);
    }
    frameColor(strand.color,opacity);
    g.lineWidth=thin?0.7:1.08;g.stroke();
  };
  const dot=(x,y,r,c,a,glow=true)=>{
    if(a<.004)return;
    if(glow){const rr=Math.max(8,r*4);const grad=g.createRadialGradient(x,y,0,x,y,rr);
      grad.addColorStop(0,alpha(c,a*.19));grad.addColorStop(1,alpha(c,0));g.fillStyle=grad;g.fillRect(x-rr,y-rr,rr*2,rr*2);}
    g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=alpha(c,a);g.fill();
  };
  const buildAt=(t)=>clamp(t);
  const latest=()=>Math.max(0,(now()-start)/1000);
  const draw=()=>{
    if(!w||!h)return;
    const narrow=w<700;
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    const since=latest();
    let build=1,opacity=1,dusting=0;
    if(mode==='enter-collage'){
      build=ease(clamp((since-.35)/1.55));opacity=clamp((since-.35)/.8);
      dusting=clamp((since-.72)/.75);
    }else if(mode==='enter-gap'){
      build=ease(clamp((since-.15)/1.0));opacity=clamp(since/.6);dusting=1;
    }else if(mode==='exit-gap'){
      build=1;opacity=1-ease(clamp(since/1.05));dusting=1;
    }else if(mode==='exit-collage'){
      build=1-ease(clamp(since/.85));opacity=1-ease(clamp(since/1.1));dusting=clamp(1-since/.6);
    }else if(mode==='inactive')return;
    if(mode!=='exit-collage'&&mode!=='exit-gap'&&mode!=='enter-collage')dusting=1;
    if(originalCanvas)originalCanvas.style.opacity=String(1-dusting);
    root.classList.toggle('ff-active',mode!=='inactive');

    const gatesX=stops(),yTop=narrow?h*.475:h*.46,yBottom=narrow?h*.86:h*.88;
    // A subdued, architectural frame that belongs to the same family as the deck's network artwork.
    g.save();g.lineWidth=.7;
    gatesX.forEach((x,j)=>{
      const fade=opacity*(.25+j*.03);
      const grad=g.createLinearGradient(x,yTop,x,yBottom);
      grad.addColorStop(0,alpha('#d5a368',0));grad.addColorStop(.20,alpha('#d5a368',fade));
      grad.addColorStop(.80,alpha('#d5a368',fade*.8));grad.addColorStop(1,alpha('#d5a368',0));
      g.strokeStyle=grad;g.beginPath();g.moveTo(x,yTop);g.lineTo(x,yBottom);g.stroke();
      g.fillStyle=alpha('#d6ba90',opacity*.86);
      g.font=`${narrow?10:12}px "DM Sans",Arial,sans-serif`;
      g.textAlign='center';g.letterSpacing='1.6px';
      g.fillText(gates[j][0],x,yTop-(narrow?16:20));
      if(!narrow){g.fillStyle=alpha('#9b8262',opacity*.8);g.font='11px "EB Garamond",Georgia,serif';g.letterSpacing='0px';
      g.fillText(String(j+1).padStart(2,'0'),x,yTop-40);}
    });
    g.restore();

    geom.forEach((strand,i)=>{
      const hot=i===hovered||i===pinned;
      const atten=hot?1:((hovered>=0||pinned>=0)?.24:1);
      const twinkle=1+.085*Math.sin(clock*.65+i*1.1);
      const origin=strand.nodes[0];
      if(build<.999){
        // Arrival source locations come from the original starfield snapshot.
        const src=sources[i%sources.length]||{x:w*.5,y:h*.52};
        const k=ease(clamp((since-.16)/.9));
        const x=point(src.x,origin.x,k),y=point(src.y,origin.y,k);
        dot(x,y,1.5+2*k,strand.color,opacity*(.45+.4*k),true);
      }
      for(let j=0;j<5;j++){
        const stage=clamp(build*5-j);
        let a=(j===0?.35:j===1?.26:j===2?.20:j===3?.14:.09)*opacity*atten*twinkle;
        if(j>strand.end)a*=.095;
        if(hot)a*=2.6;
        drawLine(strand,j,a,stage);
      }
      if(build>.4){
        const travelling=pulses.some(p=>!p.inspection&&p.id===i&&clock-p.at>=0&&clock-p.at<p.duration);
        const a=opacity*clamp((build-.4)/.5)*(hot?1:.76)*atten*(travelling ? 0.2 : clamp((clock-reborn[i])/.65));
        dot(origin.x,origin.y,hot?4.0:2.35,strand.color,a,true);
      }
      if(hot&&build>.9){
        for(let j=0;j<5;j++)drawLine(strand,j,(j>strand.end?.055:.8)*opacity,1);
      }
    });
    // Passing motes: the survivor is brighter; most die at a predetermined gate.
    if(mode==='rest'||mode==='exit-gap'){
      pulses=pulses.filter(p=>clock-p.at<p.duration+.2);
      for(const p of pulses){
        const thread=geom[p.id];if(!thread)continue;
        const time=clamp((clock-p.at)/p.duration);
        const travel=(thread.end===4?1:(thread.end+1)/5+.025);
        const along=travel*ease(time),pnt=position(thread,along);
        const dissipate=time>.76?1-ease((time-.76)/.24):1;
        const a=(p.inspection?.97:.82)*dissipate*opacity;
        dot(pnt.x,pnt.y,p.inspection?4.3:2.8,thread.color,a,true);
        if(time>.77&&thread.end<4){
          for(let j=0;j<4;j++){
            const dx=(hash(p.id*13+j*31)-.5)*36*(time-.74)*4;
            const dy=(hash(p.id*41+j*11)-.5)*34*(time-.74)*4;
            dot(pnt.x+dx,pnt.y+dy,1.1,thread.color,a*.31,false);
          }
        }
      }
    }
    if(mode==='rest'&&opacity>.9){
      g.fillStyle=alpha('#9d7c56',.72);
      g.font='italic 15px "Cormorant Garamond",Georgia,serif';
      g.textAlign='left';g.fillText('a world of possibilities',w*.11,narrow?h*.91:h*.89);
      g.textAlign='right';g.fillStyle=alpha('#9a8062',.52);g.fillText('only a fraction reaches the artist',w*.927,narrow?h*.91:h*.89);
    }
  };
  const update=()=>{
    raf=0;const t=now(),dt=clamp((t-(last||t))/1000,0,.06);last=t;
    if(mode==='inactive')return;
    clock+=dt;
    if(mode==='rest'&&!motionOff()&&owned()){
      if(clock>=launchAt){
        const id=Math.floor(hash(++pulseId*617+77)*N);
        pulses.push({id,at:clock,duration:2.2+hash(pulseId*77)*1.6,inspection:false});
        launchAt=clock+.37+hash(pulseId*37)*.45;

      }
      // A departing mote leaves its original socket faint. Once it fails or
      // survives its journey, one new resource grows into that same position.
      for(const p of pulses){
        if(p.inspection||p.replaced||clock-p.at<p.duration)continue;
        p.replaced=true;
        assignments[p.id]=(assignments[p.id]+17)%catalogue.length;
        reborn[p.id]=clock;
        hits.children[p.id]?.setAttribute('aria-label',`Inspect ${activeItem(p.id).name}`);
        geom[p.id].color=colors[activeItem(p.id).type]||'#d3b180';
      }
    }
    if(mode==='enter-collage'&&latest()>2.35)mode='rest';
    if(mode==='enter-gap'&&latest()>1.25)mode='rest';
    if(mode==='exit-gap'&&latest()>1.3)mode='inactive';
    if(mode==='exit-collage'&&latest()>1.35)mode='inactive';
    draw();
    if(mode!=='inactive'&&!document.hidden&&!document.getElementById('overview')?.classList.contains('on'))raf=requestAnimationFrame(update);
  };
  const wake=()=>{
    if(raf)return;
    last=now();raf=requestAnimationFrame(update);
  };
  const begin=(m,ctx)=>{
    visit=ctx;mode=motionOff()||ctx?.rest||ctx?.direct?'rest':m;
    start=now();last=start;clock=0;pulseId=0;pulses=[];launchAt=.4;
    hovered=-1;pinned=-1;note.classList.remove('is-on');
    layout();
    if(m==='enter-collage'&&originalSnapshot){
      const snap=originalSnapshot();
      sources=(snap.named||[]).concat(snap.dust||[]).map(p=>{
        const rect=canvasArea();return{x:p.x-rect.left,y:p.y-rect.top};
      });
    }else sources=[];
    if(mode==='rest'&&originalCanvas)originalCanvas.style.opacity='0';
    draw();wake();
  };
  const leave=(ctx)=>{
    if(mode==='inactive')return;
    if(raf)cancelAnimationFrame(raf);raf=0;
    mode=ctx?.to===0?'exit-collage':ctx?.to===2?'exit-gap':'inactive';
    start=now();pulses=[];hovered=pinned=-1;note.classList.remove('is-on');
    if(mode==='inactive'&&originalCanvas)originalCanvas.style.opacity='1';
    draw();wake();
  };
  const restore=ctx=>{
    if(ctx?.to===1){begin('rest',ctx);} else{
      if(raf)cancelAnimationFrame(raf);raf=0;mode='inactive';
      if(originalCanvas)originalCanvas.style.opacity='1';
      note.classList.remove('is-on');
    }
  };
  const snapshot=()=>{
    if(!w||!h)layout();
    const rect=canvasArea();
    const named=geom.map((s,i)=>{
      const k=i%3===0?.18:i%3===1?.02:.4;
      const p=position(s,k);
      return{x:p.x+rect.left,y:p.y+rect.top,p:1+hash(i*11)*2,r:i%3===1?4:2.5,color:s.color};
    });
    const dust=Array.from({length:260},(_,i)=>{
      const s=geom[i%N],t=hash(i*137+10),p=position(s,t);
      return{x:p.x+rect.left+(hash(i*47)-.5)*8,y:p.y+rect.top+(hash(i*49)-.5)*8,color:s.color};
    });
    return{named,dust};
  };
  // Preserve the original scene's material-into-chart public contract.
  root.snapshot=()=>mode==='inactive'&&originalSnapshot?originalSnapshot():snapshot();
  const observer=new ResizeObserver(()=>{layout();if(mode!=='inactive')wake();});
  observer.observe(root);
  addEventListener('deck-motion',()=>{if(owned())begin('rest',visit);});
  addEventListener('deck-overview',()=>{if(document.getElementById('overview')?.classList.contains('on')){
    if(raf)cancelAnimationFrame(raf);raf=0;
  }else if(owned()&&mode!=='inactive')wake();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else if(mode!=='inactive')wake();});
  window.FilamentField={enter:begin,exit:leave,restore,snapshot,ready:()=>mode!=='inactive'};
  layout();
})();
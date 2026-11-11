from pathlib import Path
root=Path('/tmp/flowers-candidate')
p=root/'mycelial/flowers.js';s=p.read_text()
a="  window.deckOnResize(() => { retained = false; retainedSnapshot = null; });\n  document.fonts?.addEventListener?.('loadingdone', () => { retained = false; retainedSnapshot = null; });"
b="  // A layout change invalidates the projected snapshot, not the retained\n  // scene/time. Exit cleanup must not reset that model before prepareReturn.\n  const invalidateReturnGeometry = () => { retainedSnapshot = null; };\n  window.deckOnResize(invalidateReturnGeometry);\n  document.fonts?.addEventListener?.('loadingdone', invalidateReturnGeometry);"
assert s.count(a)==1;p.write_text(s.replace(a,b))
p=root/'tests/deck-flowers-return.test.mjs';s=p.read_text()
s+="\ntest('font and viewport changes invalidate snapshot geometry, not retained scene ownership',()=>{const f=expose(section(flowers,'  const invalidateReturnGeometry =','  const restore ='),{retained:true,retainedSnapshot:{},window:{deckOnResize(){}},document:{fonts:{addEventListener(){}}}},'invalidateReturnGeometry');f.fn();assert.equal(f.c.retained,true);assert.equal(f.c.retainedSnapshot,null)});\n"
p.write_text(s)
p=root/'tools/deck/check-flowers-return.py';s=p.read_text()
a="    await p.goto(base+'?debug#'+str(n),wait_until='domcontentloaded');await p.evaluate('document.fonts.ready');await settled(p,n)"
b=a+"\n    await p.wait_for_function(\"!document.documentElement.classList.contains('dt-intro')\",timeout=30000)\n    await p.wait_for_timeout(700)"
assert s.count(a)==1;s=s.replace(a,b)
a="        assert s['poster'],s"
b="        assert s['poster'],s\n        if mobile:\n            await p.wait_for_function(\"[...document.querySelectorAll('.st-flag')].every(el=>+getComputedStyle(el).opacity>.9)\",timeout=10000)"
assert s.count(a)==1;s=s.replace(a,b)
p.write_text(s)

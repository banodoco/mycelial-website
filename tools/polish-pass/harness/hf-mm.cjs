const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.setContent('<div>x</div>');
console.log(await p.evaluate(()=>[matchMedia('(hover: hover)').matches,matchMedia('(hover: none)').matches,matchMedia('(any-hover: hover)').matches,matchMedia('(pointer: fine)').matches]));
await b.close();})();

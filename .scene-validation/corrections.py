from pathlib import Path
import sys
root = Path(sys.argv[1])
p = root / 'tools/deck/check-scene-resilience.py'
s = p.read_text()
a = "            await button.click();assert await button.get_attribute('aria-expanded')=='true'"
b = """            await button.click()
            # pinTo() publishes card/ARIA state on the scene's next animation frame.
            await page.wait_for_function("i=>document.querySelectorAll('.st-host.on .st-flag')[i]?.getAttribute('aria-expanded')==='true'",arg=i,timeout=2500)"""
assert s.count(a) == 1
s = s.replace(a,b)
a = "        for r in range(2):"
b = "        (out/(label+'-work.json')).write_text(json.dumps({'work':results['work'],'baseline':results.get('baseline_work')},indent=2))\n        for r in range(2):"
assert s.count(a) == 1
p.write_text(s.replace(a,b))

# Finding which release broke the 8 GB Mac: how to test

This is for the 8 GB Mac where the homepage sometimes fails: the mushroom does
not appear, the tab freezes ("Page Unresponsive") or crashes, or ground lines
are already on the floor when the page opens. It takes about 30 to 45 minutes.

Two things in the address make this work. Neither changes the site for
anyone else, and neither is remembered between loads.

- `rt=…` runs an older build of the homepage. A **red badge** in the
  bottom-left corner tells you which build is running. It also has
  **‹ older**, **newer ›** and **live** links, so you can step between builds
  without typing.
- `diag=1` turns on a small recorder. Its **black panel** sits in the
  bottom-right corner. It writes down what happens during loading, and it
  keeps that record even if the tab crashes or freezes.

## Before you start

1. Use Chrome, which is where the failures were seen. Open the tabs and
   apps you normally have open, then leave them alone. Write down what is
   open (for example: "Chrome, 14 tabs incl. YouTube; Slack; Figma"). Keep
   the same setup for every build, because memory pressure is part of what
   we are testing.
2. Open `chrome://gpu` in a new tab and click **Copy Report to Clipboard**
   at the top. Paste it into a text file called `gpu.txt`. You only need to
   do this once.
3. Open **Activity Monitor**, go to the **Memory** tab, and keep it where
   you can see the **Memory Pressure** graph at the bottom. Its colour
   (green, yellow or red) matters.

## The builds, oldest to newest

Open each link and reload it **10 times**. Each reload must be a hard reload:
**Cmd+Shift+R**. Let each load sit for about 20 seconds, so the mushroom has
time to grow, before you reload again.

| # | Build | Built (UTC) | What changed | Link |
|---|---|---|---|---|
| 1 | `0ff35278` | before 11 Nov | the site before this work (known good) | <https://mycelial.works/?diag=1&rt=0ff35278> |
| 2 | `c591a9ba` | 11 Nov 18:00 | round 1: warm-up queue, motion polish | <https://mycelial.works/?diag=1&rt=c591a9ba> |
| 3 | `6f163258` | 12 Nov 01:19 | round 2: rendering target, mobile, transitions | <https://mycelial.works/?diag=1&rt=6f163258> |
| 4 | `2d4fd191` | 12 Nov 03:26 | visible-viewport sizing | <https://mycelial.works/?diag=1&rt=2d4fd191> |
| 5 | `82c06e22` | 12 Nov 04:02 | scene size reconcile | <https://mycelial.works/?diag=1&rt=82c06e22> |
| 6 | `266e397a` | 12 Nov 04:21 | one-glide manifesto return (this is the live build) | <https://mycelial.works/?diag=1&rt=266e397a> |
| live | whatever is live | | the badge says "this IS the live build" when 6 is live | <https://mycelial.works/?diag=1> |

There is also `efaa28ef` (12 Nov 01:17). It was live for only two minutes
before build 3 replaced it, so test it only if build 2 is fine and build 3 is
not: <https://mycelial.works/?diag=1&rt=efaa28ef>.

**Quicker order (if you are short of time):** test **6** first, to confirm
the problem shows up, then **1**, to confirm it does not. Then test **3**. If
3 is bad, test **2**. If 3 is fine, test **4**, then **5**. The first bad
build after a good one is the culprit.

## What to tally for each build

Keep one line per build, with a count for each outcome out of the 10 loads:

```
build 6f163258: fine 7 · mushroom missing 2 · ground lines at load 0 · unresponsive 1 · crashed 0 · memory pressure: yellow
```

- **fine**: the mushroom grew and the page behaved normally.
- **mushroom missing**: the text appeared but no mushroom, even after 20 s.
- **ground lines at load**: glowing lines were already on the floor when
  the page appeared, before the mushroom grew.
- **unresponsive**: Chrome showed "Page Unresponsive", or the page froze.
- **crashed**: the "Aw, Snap!" page, or the tab died.
- Also note the **Memory Pressure colour** at the moment it went wrong.

## After a bad load, press "Copy report"

- **Mushroom missing, ground lines, stutter:** wait about 30 seconds on
  that load. Then press **Copy report** in the black panel and paste it
  into a text file, one file per bad load (for example `6f163258-missing-1.txt`).
- **Crash or "Page Unresponsive":** the recorder kept its notes. Reload
  the same link (choose **Wait** or **Exit page** in the dialog, whichever
  appears). The panel will then start with a red box saying **PREVIOUS
  SESSION DID NOT FINISH**. Press **Copy report** on that next load and save
  it the same way.
- If **Copy report** says it failed, press **Download** instead and keep
  the file it saves.

Each report also includes the previous five loads, so one report after a bad
load is enough. You do not need one for every load.

## Send back

1. The tally lines.
2. The saved reports.
3. `gpu.txt`.
4. What else was open, and the Memory Pressure colours.

## Good to know

- Only the homepage's program code changes between builds. The page layout
  and styles are always today's. If an old build looks slightly different
  (for example, spacing at the bottom), that is expected.
- The recorder adds a little work of its own: about one tiny screen read
  every 2 seconds for the first minute. If you want to rule it out, add
  `&luma=0` to the end of a link. That turns the screen read off. `diag=quiet`
  instead of `diag=1` records without showing the panel.
- If you see "rt=… is not a retained build", the link was mistyped. The
  page is then running the live build.

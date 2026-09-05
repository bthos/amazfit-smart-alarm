# amazfit-smart-alarm

A Smart Alarm mini-program for the **Amazfit Bip Max**, built on **Zepp OS**
using the officially recommended `@zeppos/zeus-cli` toolchain and the modern
`@zos/*` module API.

## What it does

- Create, edit and delete alarms with a native `TIME_PICKER`, an optional
  repeat pattern (any subset of Mon–Sun, or a one-off "once" alarm), and a
  native `SLIDE_SWITCH` on/off toggle.
- **Smart Wake**: instead of always ringing at the exact minute, an alarm can
  define a wake *window* (10 / 20 / 30 minutes) before the target time.
  During that window the watch periodically checks the wearer's heart rate
  against their resting heart rate; a noticeable rise (a light-sleep /
  waking signal) triggers the alarm early and gently. If no such signal is
  seen, the alarm falls back to ringing at the exact set time regardless.
- Ringing screen with **Snooze** (9 minutes) and **Dismiss**, using a
  repeating call-style vibration until acknowledged.
- Alarms persist across reboots (native OS timers created with
  `store: true`) and are stored on-device with `@zos/storage`.

## Project layout

```
app.json                 # Zepp OS manifest (target: bip_max, deviceSource 11206915)
app.js                   # App lifecycle - captures the @zos/alarm wake payload
page/
  index.page.js          # Alarm list + "add" entry point
  edit.page.js           # Create/edit an alarm (time picker, repeat days, smart wake)
  ring.page.js           # Full-screen ringing UI, also used for silent smart-wake checks
utils/
  constants.js           # Colors, sizes, weekday labels, smart-wake tuning
  alarm-store.js         # @zos/storage-backed CRUD for the alarm list
  alarm-scheduler.js     # Computes fire times and drives @zos/alarm set()/cancel()
assets/bip_max/           # icon.png + SLIDE_SWITCH track/knob art (placeholders - see below)
```

## Native widgets used

The UI is built entirely from `@zos/ui` widgets - no custom canvas drawing:
`TIME_PICKER` (full-screen time selection), `SLIDE_SWITCH` (alarm on/off,
Smart Wake on/off), `BUTTON` (all taps/navigation, including the weekday
multi-select row), `TEXT` and `FILL_RECT`.

## How alarms are scheduled

Everything is built on the documented `@zos/alarm` API (`set`/`cancel`,
API_LEVEL 3.0+), used as **one-shot timers that reschedule themselves**
rather than relying on the module's own repeat/week-day fields, so the
weekday bitmask, "once" alarms and the smart-wake window can all share one
simple mechanism:

1. Saving an alarm computes the next matching timestamp
   (`alarm-scheduler.js#computeNextTimestamp`) and arms a **final** timer at
   that exact time with `url: 'page/ring.page'`.
2. If Smart Wake is on, a second **check** timer is armed at
   `target - window`. Each time it fires it opens `ring.page` "invisibly"
   (see below), reads `HeartRate.getLast()` vs `HeartRate.getResting()`,
   and either starts ringing immediately or re-arms itself ~2 minutes later
   until the window runs out - at which point the final timer takes over.
3. `@zos/alarm`'s `param` string is only ever delivered to **app.js**
   `onCreate`, not to the woken page's own `onInit` - so `app.js` stashes it
   on `globalData.wakeParams` and `ring.page.js` reads it from there.
4. On dismiss, a repeating alarm is simply re-armed for its next
   occurrence; a one-time alarm is disabled. Snooze re-arms the final timer
   `SNOOZE_MINUTES` later.

This keeps the whole feature inside documented, stable APIs instead of
relying on any single "smart alarm" primitive (Zepp OS doesn't have one).

## Known limitations / follow-ups

- The alarm list renders up to 5 rows directly (no scrolling list widget
  yet) - plenty for typical use, but worth swapping for `SCROLL_LIST` if you
  need more.
- A smart-wake check very briefly wakes the screen every ~2 minutes during
  the window even when it doesn't trigger a ring, since `@zos/alarm` timers
  launch through a page. This is expected behavior, not a bug.
- `app.json`'s `appId` (`1000001`) is a local placeholder - replace it with
  the ID assigned by the Zepp developer console before publishing.
- `assets/bip_max/icon.png` and the `switch_*.png` slide-switch art are
  small generated placeholders; swap in real artwork before release.
- Targets only the Amazfit Bip Max (`deviceSource: 11206915`, API 4.0.4).
  Add more entries under `targets` in `app.json` to support other watches.

## Building and running

Install the Zepp OS CLI (see
[Zepp OS npm tooling docs](https://docs.zepp.com/docs/guides/tools/npm/officially-recommended/)):

```bash
npm install -g @zeppos/zeus-cli
zeus login
zeus doctor       # sanity-check your toolchain
```

From the project root:

```bash
zeus dev          # start the dev server
zeus preview      # QR-pair the Zepp app / simulator for live preview
zeus build        # produce a distributable .zab package
```

This has been verified end-to-end with `zeus build` (zeus-cli 1.9.3): it
rollup-bundles the 4 JS files, resizes/converts all PNGs (icon + slide-switch
art) with PNG2TGA, compiles every page to QuickJS bytecode, and packages a
`dist/*.zab` whose embedded `app.json` and `manifest.json` correctly report
`screenResolution: "432x514"` / `deviceSource: 11206915` for the `bip_max`
target - `zeus dev`/`zeus preview` were not exercised since they need a
paired watch or the (GUI, account-gated) Zepp simulator, unavailable here.

**Offline/CI note:** `zeus build` needs `~/.zepp/.zeus_devices`, a cache of
Zepp's device catalog it otherwise fetches from `upload-cdn.zepp.com`. If
that host isn't reachable, seed the cache yourself before building - see the
device object shape zeus-cli and its bundled `@zeppos/zpm` both expect in
`config/device.js` and the `Be()` parser inside `@zeppos/zpm`'s bundle; a
single entry for `deviceSource: 11206915` with `value.code`, numeric
`value.productId`/`value.productVersion`, `value.shape`, `value.chip`,
`value.screen.{size,previewSize,iconSize}`, `value.os.{version,apiLevel,
apiLevelLimitMin}` and `value.pixelDensity` satisfies both. Also note
`@zeppos/zeus-cli`'s `package.json` declares a `_moduleAliases` mapping
(via the `module-alias` package) that only resolves correctly when
`module-alias` itself lives in `zeus-cli`'s own `node_modules` - if your
package manager hoists it to the workspace root, add the same
`_moduleAliases` entry to this project's `package.json` (already done here)
so `zeppos-app-utils` still resolves.

## References

- Zepp OS API reference & guides: https://docs.zepp.com/docs/intro/version/
- Sample apps: https://github.com/zepp-health/zeppos-samples
- Amazfit Bip 6 practical notes (device family background):
  https://github.com/masimoneext-sketch/amazfit-bip6-watchface-guide

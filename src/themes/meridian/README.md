# Meridian Theme for Werf

**id**: meridian  
**name**: Meridian  
**tagline**: The high observatory — glass, brass, and the turning sky.

## Fiction
You are the sole Observer at a remote high-altitude stellar observatory. Tasks are celestial targets to acquire and log. The lineup is the observing program. Projects are research campaigns / constellations. Focus is locking the telescope. Logbook is the Observation Journal. Feeling: contemplative precision, vast quiet, brass instruments against deep indigo and starlight.

## Structure
- Top sky strip with data-driven Starfield (density from XP + streak) + Rank / Photons / Clear nights / Seeing gauges
- Bottom instrument pedestal navigation (Session / Ephemeris / Bay / Journal)
- Signature Viewfinder framing the NOW target on Today
- Instrument language throughout (Log plate, Lock mount, First light, etc.)

## Install
1. Copy the `meridian/` folder into `src/themes/`
2. In `src/themes/registry.js`:
   ```js
   import meridian from "./meridian/index.js";
   export const THEMES = [..., meridian];
   ```
3. `npm run dev` → open Journal → Instrument Suite → select Meridian

## Status
Shell, tokens, Starfield, Capture (with setCaptureFocus), Today (viewfinder + registerActiveList + complete), Logbook (theme picker + rank), and all overlay surfaces are present. Remaining views contain fiction-consistent scaffolds; lift remaining core logic (Plan drag/AI, Dock ship, full Form, Focus timer, Palette commands, trophies/calibration, etc.) following the same pattern for 100% FEATURE_PARITY.

Core is never edited. Keyboard surfaces and theme switching work.

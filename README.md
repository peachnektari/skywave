# SKYWAVE

*The last beep of the midnight time signal has fallen off the air, into the country where old broadcasts go.*

A 3D exploration platformer in three.js. You are Pip, the sixth pip of the time signal, crossing
a country made of broadcasts that bounced off the ionosphere and never came down. Everything
you see, from the geometry to the sky to the music, is generated in code. There are no asset files.

## Run it

There's no build step and no install. Serve this folder with any static server and open it:

```sh
npx serve .                # then open the printed URL
# or
python3 -m http.server     # then open http://localhost:8000
```

three.js r170 loads from jsDelivr through an importmap, so the first load needs a network
connection. Opening `index.html` straight from disk won't work, because browsers block ES
modules on `file://`. Works in current Chrome and Firefox.

## Controls

| | Keyboard / mouse | Gamepad |
|---|---|---|
| Move | WASD / arrows | left stick |
| Camera | mouse (click to capture) | right stick |
| Jump | Space (hold for height) | A |
| Echo | E / Shift / K | B / X |
| Pause | Esc / P | Start |

Abilities you find later use the same two buttons. Jumping again the instant you land
chains skips, and jumping into a wire rides it.

Progress saves automatically in `localStorage`. Broadcasts you've reached can be revisited
from the pause menu.

## The broadcasts

- **Longwave Heath** *(between stations)*: the hub, a night heath where people used to listen. A dead mast with six dark lamps stands in the middle.
- **Fair, Becoming Poor** *(198 kHz)*: the shipping forecast, settled into a sea. The tide decides what you can reach.
- **The Wireless** *(909 kHz)*: the inside of a valve radio, with you the size of a crumb. Things here move to the beat.
- **Please Hold** *(1215 kHz)*: waiting, made into a place. Nothing moves unless you stand still.
- **Which Summer** *(94.6 MHz)*: a request for Ada, from Tom. The memory only holds together around you.
- **Mean Time** *(60 kHz)*: the observatory where the hour is kept. Everything moves one notch per second.
- **Close Down** *(off air)*: what's left after the station signs off.

## Testing

```sh
npm install && npx playwright install chromium   # once
npm test
BROWSER=firefox npm test                          # after npx playwright install firefox
```

`test/smoke.mjs` serves the folder and loads the game in headless Chromium. It loads every
level through `window.__game`, then checks that frames keep advancing, the console stays
clean, the canvas resizes, audio starts on first input, and progress survives a reload.

For manual testing, `window.__game` exposes `loadLevel(id)`, `teleport(x, y, z)`,
`getState()`, `levels()` and `setInput({...})`. A hidden debug menu on the backquote key
(`` ` ``) has free camera, invincibility, level jump and teleports to every aerial and pickup.

## Decisions

Every design decision is written down in [DESIGN.md](DESIGN.md), before any code existed:
the world concepts I rejected and why, the world's logic, Pip, the movement kit, each
broadcast's subject and mechanic, the art direction and the technical choices. Feel constants
live in one `FEEL` object at the top of `src/player.js`.

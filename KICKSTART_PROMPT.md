You are going to design and build a complete, original 3D platformer in three.js, in this repository, in one continuous session. Don't ask me questions — make every decision yourself, write it down, and keep going until the game is finished and playable. A finished game with five great levels beats an unfinished one with nine.

## What I want

A brand-new game, not a tribute. When I open it I should not be able to say "this is a Mario / Sonic / Celeste / Astro Bot clone." I want the feeling of stepping into a place someone imagined, and wanting to see what's over the next ridge. Exploration is the point. Every level should be about something different — not six biomes, but six different *subjects*, each with its own rules.

## Technical constraints (hard)

- three.js, pinned to one specific recent release you know well, loaded through an importmap from a CDN (`three` and `three/addons/`). No bundler, no build step, no npm install required to play. `index.html` + ES modules under `src/`. It must run with any static server (`npx serve .` or `python3 -m http.server`); document that.
- Zero external assets. No image, model, font or audio files, and no network fetches beyond the three.js CDN. Everything is generated in code: geometry from primitives and procedural meshes, materials from vertex colors / canvas-generated textures / custom shaders, all audio synthesized with the Web Audio API.
- Target 60fps on an integrated GPU. Instancing for repeated props, merged static geometry, sane draw calls, fog for depth and culling. Post-processing only if it stays at 60.
- Keyboard first (WASD/arrows, Space, one action key), mouse for camera, gamepad if cheap. Works in current Chrome and Firefox. Handles resize. Audio context resumes on first input (autoplay policy).
- Progress saved in localStorage. A level select (unlocked as you go) and a hidden debug menu (free camera, teleport, invincibility, level jump).
- Expose `window.__game` with `loadLevel(id)`, `teleport(x,y,z)` and `getState()` for automated testing.

## Step 1 — invent the game before you write a line of code

Write `DESIGN.md` first. In it:

1. Brainstorm at least ten world concepts, one line each. Then reject any that resemble an existing game or a default platformer setting (grass/lava/ice/castle/sky/desert, "cute robot in a factory", "ghost in a haunted mansion"). Pick the one that makes you think of the most *level-specific mechanics*, not the one that sounds prettiest. Say why.
2. Define the world's logic: why platforms exist here, what they're made of, what gravity, light and time do in this place. Everything in the levels should follow from this.
3. The protagonist: who they are, why they're here, and how their personality comes through in procedural animation alone (no rigs — squash and stretch, lean, tilt, idle fidgets, spin, trail).
4. The movement kit: run, jump, and one signature ability that changes how the player reads space (something that makes a wall, a gap or a ceiling mean something different). Plus two more abilities found by exploring, each of which recontextualizes places the player has already been — including the hub.
5. A name for the game and a one-line hook. No placeholder names.

Commit to it. Don't redesign midway; refine.

## Step 2 — the levels

Build a hub plus six levels (five if you must cut, never fewer). The hub is itself a small explorable level with its own subject — not a room with six doors. Level entrances should feel found, not listed, and the hub should change as you complete things and hide at least one thing only reachable with a late ability.

Each level must have:

- **A subject**, and the subjects must differ in *kind*, not just setting. Across the set, cover at least five of these: a place; an ordinary object at the wrong scale; an abstract idea made physical; a natural process or system (tide, weather, decay, a machine, a heartbeat); a memory or a story; a level where the rules of the world itself bend. Give each level a real name.
- **A mechanic that exists only there** — or a twist on the signature ability that only makes sense there. The level should be un-makeable anywhere else.
- **Its own palette, lighting, sky, fog and musical motif** (a short synthesized theme that develops as you go deeper).
- **A landmark** visible from the entrance that you'll eventually reach, and at least one vista — a moment the camera pulls back and you see how big the place is.
- **An "oh" moment**: a reveal, a scale shift, a rule break, something turning out to be something else.
- **Non-linear layout**: loops, verticality, a critical path that's maybe 40% of the space, optional branches, shortcuts that open, at least three secrets, one of which needs an ability from another level. Never a corridor. It should be possible to get slightly lost and then find your way by landmarks.
- **Teaching without text**: introduce the mechanic safely, then combine it, then subvert it. No tutorial popups; at most a wordless prompt the first time an input is needed.
- **Checkpoints** and instant respawn. No soft-locks. Every secret is reachable.

Rewards for exploring must be *interesting*, not numeric: an ability fragment, a lore object that tells you something about the world, a view, a character, a way into a secret area. If you use a collectible, give it meaning and a visible consequence in the hub.

Difficulty is exploration-first and generous on the critical path; challenge lives in the optional branches. Critical path ~25 minutes, another hour for secrets.

Camera is a level ingredient: default is smooth third-person with lookahead, but a level may switch to a fixed diorama angle, a top-down section or a side-view stretch if it serves the subject.

## Step 3 — game feel (where most three.js platformers fail)

Nail these before building level two:

- Coyote time, jump buffering, variable jump height, landing squash, apex hang, air control, capped fall speed.
- Ground detection that works on slopes, moving platforms (the player rides them) and edges. Simple, robust collision (swept AABB or capsule vs. boxes, or a small custom system) rather than a heavyweight physics engine that fights the feel.
- Camera: damped follow, lookahead in the movement direction, never clips through walls, set-piece framing on triggers.
- Juice: dust on land, trail on the signature ability, particles on pickups, tiny screen shake on impacts, hit-stop on big moments, level transitions that belong to the world (not a black fade).
- Every feel constant in one config object at the top of the player file.

## Step 4 — presentation

Write an art direction in DESIGN.md — three sentences on what this looks like and what it never looks like — then follow it. Make it look designed, not defaulted: custom shaders for at least the sky, one fluid/glow effect, and wind or motion on props; per-level lighting; a consistent style throughout. Title screen with the name and hook, minimal diegetic HUD, pause menu, transitions, an ending.

Audio: a small procedural music system (per-level motif, layers that fade in as you progress, a hub theme) and SFX for every action. Keep the mix quiet and pleasant.

## Step 5 — build order and verification

1. `DESIGN.md`.
2. Engine core: loop, input, collision, player controller, camera, audio core, level loading from data. Levels are authored as data via a small level-building helper API, one file per level under `src/levels/`.
3. The hub and one full level. Tune feel until it's fun. Then the rest.
4. Polish pass: shaders, particles, music layers, transitions, title and ending.
5. Verification. Start a static server. If Playwright or Puppeteer is available (or can be installed), write a smoke test that loads the page, waits for the first frame, calls `__game.loadLevel()` for every level and asserts zero console errors and an advancing frame counter. If no browser automation is possible, do static checks: `node --check` on every module, verify every import path resolves, confirm every addon you import exists in the pinned version. Fix everything you find.
6. `README.md`: name, hook, how to run, controls, level list with one-line teasers (no secret spoilers), and a "decisions" section pointing at DESIGN.md.

Keep files under ~500 lines. Commit after each milestone if git is present. No TODOs in the code, no dead levels, no placeholder text anywhere.

## Things that will make me think it's a template

Levels named "Level 1"; a cube with a face unless it's a real choice; disconnected platforms floating in a void for no reason; grass/lava/ice; collecting 100 coins that do nothing; walls of instruction text; a minimap; every level being the same jump-jump-jump in a different color; a flat blue sky; a boss fight bolted on at the end. If you catch yourself doing one of these, stop and ask what *this* world would do instead.

Before you say you're done, play every level through the debug hooks and check: reachable end, every secret reachable, no fall-through, no console errors across all levels, 60fps, resize works, audio starts on first input, save/load works, the hub reflects progress. Then tell me the name of the game and which level you'd play first.

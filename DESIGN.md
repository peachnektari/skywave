# SKYWAVE — design document

> *You are the last beep of the midnight time signal. You have fallen off the air,
> into the country where old broadcasts go.*

This file was written before any code, then refined (never redesigned) while building.

---

## 1. Finding the world

Ten-plus concepts, one line each, then the cull.

1. A knight crossing a kingdom of floating castles. — **Rejected**: castle/sky default.
2. A small robot repairing a factory at night. — **Rejected**: named in the brief as a template.
3. A yarn creature unravelling through a sewing box. — **Rejected**: Unravel, Woolly World.
4. A paper figure in a pop-up book that folds its own terrain. — **Rejected**: Tearaway, Paper Mario.
5. A shadow that can only stand on shadows thrown by lamps. — **Rejected**: Contrast.
6. A theatre's scenery store, each set a different play. — **Rejected**: Puppeteer.
7. A world of frozen moments you can nudge forward a frame at a time. — **Rejected**: Braid/Superhot territory, and one-note.
8. A kiln country where wet clay hardens wherever you touch it. — One mechanic, not six. Cut.
9. A pebble sinking through the strata of a riverbank, each layer a buried year. — Lovely, but every level would be brown and downward. Cut.
10. A lighthouse keeper's logbook where each entry is an island. — Islands drift toward "biomes". Cut.
11. The inside of a sleeping dog's dream. — Generic dream world. Cut.
12. **The Skywave: a country built from radio broadcasts that bounced off the ionosphere and never came down.** — **Chosen.**

**Why the Skywave.** A broadcast schedule is already a list of *different kinds of thing*: a
weather forecast, a phone-in, a request show, a time signal, a close-down. So the levels
differ in kind for free, not just in colour. And radio physics hands out mechanics by the
fistful — echo, interference, carrier, static, tuning, skip distance, signal strength,
dead air — each of which can become a rule in one place and not another. It was the concept
that produced the most level-specific mechanics on the first pass, not the prettiest one.

## 2. World logic

- **Everything is sound that has cooled.** Every broadcast ever made is still travelling
  outward. A little of it snags on the ionosphere and settles, like silt, into a slow country
  at the edge of the night. What was being said becomes what is there: a shipping forecast
  becomes a sea, a phone-in's hold music becomes a waiting hall.
- **Why platforms exist.** Strong signal is solid; a fading one breaks into fragments that
  hang where the signal left them. Floating platforms are always *the edge of a broadcast's
  range* — the land thins into pieces the further you get from what made it. Nothing floats
  for no reason.
- **What things are made of.** Matter here is pressed in thin horizontal layers, like
  a waveform frozen into wax. Every surface carries faint strata lines. Surfaces glow at
  the edges because they're still, very slightly, ringing.
- **The void is static.** Below every broadcast is the hiss between stations. Falling into it
  doesn't kill you; you *lose signal* and re-tune at the last aerial you touched (checkpoint).
- **Light.** There is no sun. Light comes from the ionosphere overhead (an aurora that is
  every level's sky) and from transmitters, valves and lamps. The only sunlight in the
  Skywave is inside *memories* — which is how you know you're in one.
- **Gravity** points toward the ground station, like everywhere. It is honest everywhere
  except Close Down, where the station has gone off air and the rules come loose.
- **Time** is the broadcast day. It runs from sign-on to close-down. The heath's clocks all
  stopped the night the sixth pip went missing.

## 3. The protagonist — Pip

Pip is the sixth pip of the midnight time signal: the long one, the one that *means* the
hour has begun. One night it slipped off the end of the broadcast and fell. Without it,
nobody on the heath knows exactly when anything starts. Pip wants to get back on air and
be on time — it is, above all, **punctual**, slightly anxious, and delighted by everything.

Pip is a small glowing pill of warm light with two dark eyes and a curl of antenna on top.
No rig; personality is entirely procedural:

- **Metronome idle.** Standing still, Pip ticks: a tiny bounce and a ring-pulse once a
  second, exactly on the beat of the level's music. Keep waiting and it glances around,
  then checks back with the camera, then hums (little notes rise off it).
- **Stride.** Pip has no feet: it bounces as it runs, each bounce a soft *tick*.
- **Squash & stretch.** Stretches on take-off, squashes on landing, proportional to impact.
- **Lean and tilt.** Leans into acceleration, banks into turns, the antenna curl lags on a
  spring (secondary motion).
- **Spin.** A full pirouette on every skip; a quick flip on echo.
- **Trail.** At speed Pip leaves a ribbon trail shaped like a waveform.
- **Glow as HUD.** Pip is dim when its echo is spent and bright when it's ready. No bars.

## 4. Movement kit

- **Run, jump.** Coyote time, jump buffer, variable height, apex hang, air control,
  capped fall. (Every constant lives in `FEEL` at the top of `src/player.js`.)
- **Signature — Echo** (action key, from the start). Pip beeps, and the beep hardens into a
  glassy slab directly beneath it and kicks Pip upward. The echo hangs in the air for a
  few seconds and then rings away. One echo at a time; recharges when you touch the ground.
  *How it changes the way you read space:* a gap isn't "too far" any more, it's "one echo
  far". A blank wall is a ledge you haven't made yet. And the echo is a *thing*: it weighs
  down plates, conducts, floats, remembers, holds the line. Every level bends it.
- **Skip** (found in *Fair, Becoming Poor*). Skywaves travel by skipping between ground and
  sky. Jump again the instant you land and each hop gets longer and faster (up to three),
  and at speed you skip off the surface of any liquid like a stone. *Recontextualizes:*
  every sea, lake and flat you've seen becomes a road — including the heath's static lake,
  with an island in it you've been staring at since the start.
- **Line** (found in *Please Hold*). Pip can ride a signal down a wire. Jump into any wire
  and you're carried along it at speed; jump to let go. *Recontextualizes:* the telegraph
  wires along the heath road, the mast's guy-wires, the Wireless's dial cord, the
  lighthouse cable — scenery you walked under becomes routes.

## 5. Name and hook

**SKYWAVE** — *The last beep of the midnight time signal has fallen off the air, into the
country where old broadcasts go.*

---

## Art direction

The Skywave looks like sound that has cooled: soft, chamfered, matte forms in two or three
close tones, pressed in faint horizontal strata and lit from within at their edges, hanging
in deep coloured fog under a moving aurora. Every place is one mood-pair of colours (heather
and valve-amber, slate and sodium, lilac and phone-cyan) with a single warm light you can
walk toward, and walkable tops are always lighter than walls. It never looks like neon
grids, synthwave, glossy plastic, a flat blue sky, stock-texture realism, or grass.

Implementation: one shared "cooled sound" material (Lambert + vertex colour + rim glow +
height tint + procedural strata lines via `onBeforeCompile`), custom shaders for the
aurora sky, water/static liquids, echo glass and the pip; instanced wind-swayed props; CSS
vignette; blob shadow under Pip for readable landings. No post-processing passes.

---

## Structure

**Longwave Heath** (hub) + six broadcasts. Each broadcast has:

- one **Ident** at the end — the station's jingle. Taking it finishes the broadcast, lights
  one of the six lamps on the dead mast, and adds that motif to the heath's music;
- three secrets:
  - a **QSL card** — the postcard a station sends to confirm you heard it; each carries a
    line of lore and gets pinned to the board outside the Listening Hut;
  - a **Stray** — a lost sound that lives there (a foghorn calf, a crackle, a kettle…);
    it follows you home and lives on the heath, making its noise;
  - a **Harmonic** — a tuning fork; each one adds a band of colour to the heath's aurora.
  - One of the three always needs an ability from a *different* broadcast.

Order: *Fair, Becoming Poor* and *The Wireless* are open from the start. Each ident opens
more of the heath: the phone box starts ringing (1), the parked car's headlights come on
(2), the observatory dome opens (3). With five idents the mast door opens: *Close Down*.
Finishing it is the ending.

## Longwave Heath — the hub (subject: *reception*)

A night heath where people used to listen. Aerial reeds (old telescopic car aerials, tipped
with tiny lights) sway across it. At its centre a dead relay mast with six dark lamps is the
landmark from everywhere. Entrances aren't doors, they're *things receiving broadcasts* —
you hear each one's motif leaking out of it before you see it:

| Where | Thing | Broadcast |
|---|---|---|
| lake shore | a wrecked fishing boat, radio still on | Fair, Becoming Poor |
| east | a caravan with a wireless on the table | The Wireless |
| end of the telegraph road | a red phone box (rings after 1 ident) | Please Hold |
| the ridge lay-by | a parked car (headlights after 2) | Which Summer |
| the crag | an observatory dome (opens after 3) | Mean Time |
| the mast | its base door (after 5) | Close Down |

Hub secrets: a QSL card on the island in the static lake (**Skip**), the Morse stray along
the tops of the telegraph poles (an echo climb), a Harmonic on the mast's service
platform reached up a guy-wire (**Line**) — which is also the heath's vista.
The heath changes: lamps light, entrances wake, strays gather round the hut, cards appear
on the board, the aurora gains colours, the music gains voices; after the ending, dawn.

## The broadcasts

### 1 · Fair, Becoming Poor — 198 kHz LW — *a natural process: the tide*
The shipping forecast, settled into a grey-green sea of stacks, buoys and a harbour wall.
- **Mechanic:** the tide rises and falls on a steady cycle. Low tide opens the seabed —
  sandbars, pools, a sea cave. High tide floats you (Pip swims) up to ledges out of reach.
  **Echo twist:** echoes *float* and ride the tide up, so you place your own lift.
- **Teach → combine → subvert:** a ledge only reachable at high water; then a stack where
  you must float an echo up on the rising tide; then the weather turns "poor" — the swell
  grows and the waves themselves become moving floors you time jumps off.
- **Landmark:** the lighthouse on the far rock, its beam sweeping. **Vista/oh:** ringing
  the lamp-room bell calls the spring tide — the whole sea drains away and the lighthouse
  turns out to be the top of a colossal sunken transmitter mast. You climb down it to the
  seabed hall where the ident waits, and the returning tide carries you home.
- **Skip** is found on the skipping-stone beach; with it the outer wreck is reachable.
- **Secrets:** QSL in the low-tide sea cave; the Foghorn calf in the outer wreck (Skip);
  a Harmonic on the far rock at the end of the lighthouse cable (**Line**).
- **Look/sound:** slate, sea-green and sodium-lamp orange; mist; a 6/8 lilt in A minor
  whose bass swells like waves; wind noise rises with the weather.

### 2 · The Wireless — 909 kHz MW — *an ordinary object at the wrong scale*
The inside of a 1950s valve radio, Pip at the size of a crumb.
- **Mechanic:** the speaker cone pumps on the music's beat — land on it on the beat and
  it throws you high. Lit valves throw off heat: thermal updrafts you float up. The radio's
  preset buttons are giant keys; jumping on one retunes the set, swinging the tuning
  capacitor's vanes into new stairways and changing the music. **Echo twist:** echoes
  *conduct* — an echo between two terminals closes a circuit and lights a valve.
- **Landmark:** the green magic-eye tuning indicator glowing high at the front.
  **Vista/oh:** you climb out through the dial glass, walking over the painted station
  names, and the camera pulls back: the radio is on a kitchen table, the kitchen is a
  canyon, and the aurora is in the window.
- **Secrets:** QSL inside the output transformer's coil; the Crackle behind the speaker
  magnet; a Harmonic on the dial-cord pulley (**Line** along the dial cord).
- **Look/sound:** walnut, bakelite cream, valve amber, magic-eye green; warm dust haze;
  a swinging dance-band tune in F with a walking bass.

### 3 · Please Hold — 1215 kHz — *an abstract idea made physical: waiting*
A pale, patient landscape of waiting: terraces of chairs, queue barriers, ticket machines,
a "Now Serving" board towering over it all.
- **Mechanic:** **the world only moves while you stand still.** Bridges extend, lifts rise,
  turnstiles turn — the moment you move, everything freezes, and the hold music muffles.
  **Echo twist:** an echo *holds the line for you* — while it lasts the world keeps moving
  even as you run.
- **Teach → combine → subvert:** a bridge that slides out when you stop to think; lifts;
  then crossings where you must run *while* things move (echo first); then the callback
  wing, where it all reverses and the world moves only while you do.
- **Line** is found at the switchboard, and the coiled phone cords become routes at once.
- **Landmark:** the Now Serving board. **Vista/oh:** when it finally shows your number,
  the camera rises from its top and the whole level turns out to be a rotary telephone
  dial, the ten plazas its finger holes.
- **Secrets:** QSL on the "0" plaza; the Engaged Tone stray in the room you only find by
  waiting; a Harmonic across the Out-Of-Order gap (**Skip**).
- **Look/sound:** lilac, oatmeal, phone-cyan LEDs; hold music (bossa, C major 7ths),
  low-passed whenever you move.

### 4 · Which Summer — 94.6 MHz — *a memory*
*"This next one's a request — for Ada, from Tom, who says she'll know which summer."*
A lake house on a summer evening, broken into pieces.
- **Mechanic:** the memory only holds together where you're paying attention. Fragments of
  jetty, stairs, walls and furniture drift apart in a golden haze and fly into place as Pip
  comes near. **Echo twist:** echoes *remember* — pieces near an echo stay put after you
  leave, so you can build a way across before you need it.
- **Teach → combine → subvert:** a path that assembles under your feet; a bridge you have to
  anchor with an echo from the far side; then a staircase that only assembles when you back
  *away* from it.
- **Landmark:** the lit kitchen window across the lake. **Vista/oh:** at the end of the
  jetty the camera settles, and the shards scattered over the lake line up into one image:
  two people dancing in a kitchen. Then you go to that kitchen; the radio is playing.
- **Secrets:** QSL in the tree house; the Kettle in the boathouse; a Harmonic on the lake
  island (**Skip**).
- **Look/sound:** peach, lavender, lake-teal, the only low sun in the game; a waltz in G
  on music-box and felt piano.

### 5 · Mean Time — 60 kHz — *a place: the observatory where the hour is kept*
A hilltop observatory under wheeling star trails: domes, a meridian line, telescopes, and
a red time-ball on its mast.
- **Mechanic:** machinery here moves **only on the pips** — once a second, everything
  steps. Shutters, telescope arms, the great clock's hands and the time-ball carriage
  advance one notch per tick. **Echo twist:** in the stopped chronometer room there are no
  ticks at all — until you realise Pip *is* one. Each echo is a tick.
- **Landmark:** the red time-ball. **Vista:** the meridian line glowing to the horizon from
  the great telescope's platform. **Oh:** the clocks stop, and the world waits for you.
- **Secrets:** QSL in the transit room; the Cuckoo on the great clock's hour hand;
  a Harmonic at the top of the time-ball cable (**Line**).
- **Look/sound:** navy, brass, bone-white, one red ball; clear sky with rotating stars;
  60 bpm bells in E minor, ticks as percussion.

### 6 · Close Down — no frequency — *the rules of the world bend*
The station has played its anthem and gone off air. Dead air: a velvet-black world of
silence, and the transmitter's red warning light far above.
- **Mechanic:** silence is solid, and **an echo punches a hole in it**. Your signature move
  flips: no platforms, only holes — walls become doors, ceilings become shafts, and the
  floor you stand on becomes a trapdoor. Mains hum (amber) is the only ordinary matter.
- **Teach → combine → subvert:** a wall you echo through; a ceiling you jump-and-echo up
  through; a floor that drops you into the lower dark on purpose; then all three at once.
- **Landmark:** the red light on the transmitter. **Oh/ending:** at the top Pip finds the
  other five pips waiting. It takes its place, the hour sounds, the station signs on — and
  light pours back into the heath at dawn.
- **Secrets:** QSL behind a double wall; the Tuning Fork stray in the lower dark;
  a Harmonic on a hum cable across the void (**Line**).
- **Look/sound:** black velvet, violet edges, amber hum, one red light; near silence — the
  anthem returns a phrase at a time as you climb.

---

## Audio

All synthesized (Web Audio): a small look-ahead sequencer drives per-level patterns
(pad, bass, motif, counter-line, percussion). Layers fade in with depth — each checkpoint
raises the level's "depth" and a new layer arrives. The heath plays a soft drone plus the
motif of every ident you own; each unopened entrance leaks its own motif through a panner
so you can find it by ear. SFX for every action, synthesized from the level's key so
nothing clashes. The mix is quiet: master −10 dB, music under effects.

## Technical decisions

- **three.js r170** via importmap from jsDelivr; no build. Only addon used:
  `utils/BufferGeometryUtils.js` (mergeGeometries).
- **Collision:** custom. Player is an AABB; world is AABBs (static in a spatial hash,
  kinematic in a list), plus ramps and heightfields as ground providers. Axis-separated
  movement at a fixed 120 Hz with step-up, ground snap, riding of moving colliders.
  A physics engine would fight the feel; this doesn't.
- **Rendering budget:** static geometry merged per level into spatial chunks (frustum
  culled), props instanced, no shadow maps (blob shadow), fog tuned per level, adaptive
  pixel ratio to hold 60 fps.
- **Levels as data:** one file per level in `src/levels/`, built with the helper API in
  `src/builder.js`; level-specific rules live in that level's `update()`.

### Authoring metrics (from `FEEL`)
- Plain jump: ~2.6 up, ~5 across at full run. Critical-path gaps stay ≤ 3.5 across / ≤ 1.8 up.
- Jump + echo: ~4.6 up, ~8 across. Used for "think about it" beats.
- Skip chain: ~8–9 across on the third hop; liquids skippable above run speed.
- Line: 14 u/s along the wire.

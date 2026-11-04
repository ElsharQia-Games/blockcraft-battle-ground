# Adding a character

Everything lives in **`src/40-characters.js`**. A character is data (colors) plus, optionally,
six small pixel painters and a few 3D props.

There are 5 edit points:

| # | Where | What |
|---|-------|------|
| 1 | `CHARACTERS` object (top of file) | colors + `style` |
| 2 | `CHAR_KEYS` array (line ~99) | makes it selectable |
| 3 | painter functions | what the skin looks like |
| 4 | `paintTorso` / `paintArm` / `paintLeg` / `paintShoe` / `paintHand` | route your key to your painters |
| 5 | `makeHumanoid()` | optional 3D props (hat, scarf, sword, …) |

---

## The minimum: 2 edits, zero painters

This already gives you a playable character with your colors, the generic body shape and
the shared face. Good for a first pass.

**1)** Inside `const CHARACTERS = { … }`, right after the `fayoum` entry:

```js
  demo: {
    name: 'Demo',
    skin:   '#c98d5f',   // face, hands, neck
    hair:   '#20180f',   // hair, eyebrows, beard
    shirt:  '#3a4b6b',   // torso + arms cloth
    sleeve: '#3a4b6b',   // arms (used by the generic arm painter)
    pants:  '#2b3247',   // legs
    shoe:   '#1b1b20',   // shoes
    accent: '#d8b04a',   // trim / belts / patterns
    style:  'plain'
  },
```

**2)** In the keys list:

```js
const CHAR_KEYS = [
  'steve', 'cj', 'mario', 'ashen', 'undead', 'wolf', 'tarnished', 'seif',
  'meedo', 'mko', 'mj', 'hokage', 'kestrel', 'oren', 'kratos', 'leon', 'demo'
];
```

That's it. `node --check src/40-characters.js`, reload, press **C** (or
`__blockcraft.setCharacter('demo')` in the console).

---

## How the pixel art works

Each body part is a box. Every one of its 6 sides gets its own **32×32 tile**, and the six
tiles are packed into one 96×64 canvas per part. Your painter is called **once per face**
with the face name, and you draw into a 32×32 coordinate space.

```
                       py  (top of the head / shoulders)
        nx (left side) | nz (front) | px (right side)
                       ny  (bottom)
                       pz  (back)
```

* **`y = 0` is the top** of the tile, `y = 31` the bottom.
* **`x = 0` is the left** side of that face.
* The model faces **−Z**, so **`nz` is the front** — the chest, the face, the shoe laces.
* Paint the same feature on `pz` too if it should wrap around (belts, stripes, seams).

Painter signatures:

| Function | Signature | Part size |
|---|---|---|
| torso | `(g, face, c)` | 0.52 × 0.62 × 0.28 |
| arm | `(g, face, c, key, side)` — `side` is `'L'` or `'R'` | 0.18 × 0.66 × 0.2 |
| leg | `(g, face, c, key)` | 0.22 × 0.72 × 0.24 |
| shoe | `(g, face, c, key)` | 0.24 × 0.12 × 0.28 |
| hand | `(g, face, c, key, side)` | 0.17 × 0.14 × 0.19 |
| face detail | `(g, c, key)` — only the **front** of the head | 0.46 × 0.48 × 0.46 |

Height reference inside a tile, using the head:

| y | head feature |
|---|---|
| 0–11 | hair / hat |
| 12–14 | eyebrows |
| 15–17 | eyes |
| 18–21 | nose |
| 22–31 | mouth, beard, chin |

Torso: `0` shoulders (collar), `18–21` belt line, `29–31` hem.
Arm: `0` shoulder, `17` elbow, `29–31` cuff. Hand: the whole tile is the hand.
Leg: `0` waist, `11` knee, `29–31` ankle. Shoe: `0` ankle, `27–31` sole.

### Drawing helpers

Already defined in the file, just call them:

```js
rect(g, x, y, w, h, color)      // filled rectangle
dot(g, x, y, color)             // single pixel
tone(color, 1.15)               // lighten / darken (0.5 … 1.5)
blendHex(a, b, t)               // mix two colors
clothBase(g, color, face, seed) // fills the tile with fabric + woven noise
skinBase(g, c, face)            // fills with skin + pores
metalBase(g, color, face, seed) // fills with brushed metal
hairBase(g, face, c)            // the layered hair shape
eye(g, x, y)                    // a 5×3 eye at x,y
rivet(g, x, y, color)           // a 3×3 metal rivet
```

Call **one** `*Base` first — it fills the whole tile. Then draw on top.

Use `tone(color, FACE_MUL[face])` if you fill manually, so the sides read as shadowed
(`FACE_MUL` is already applied inside the `*Base` helpers).

---

## The full sample (custom torso, arms, legs, shoes, hands, face, props)

Paste the painters just below `torsoFayoum()`, then add the dispatch lines.

```js
/* ============================================================
   Demo — desert fighter. Replace the colors + details to taste.
   ============================================================ */

/* ---- torso ---- */
function torsoDemo(g, face, c) {
  clothBase(g, c.shirt, face, 101);            // base fabric
  const trim = c.accent;
  const dark = tone(c.shirt, 0.8);

  if (face === 'nz') {                          // chest
    rect(g, 12, 0, 8, 5, c.skin);               // open collar
    rect(g, 11, 0, 2, 7, dark);                 // lapels
    rect(g, 19, 0, 2, 7, dark);
    rect(g, 6, 7, 1, 11, dark);                 // seams
    rect(g, 25, 7, 1, 11, dark);
    rect(g, 0, 18, 32, 3, trim);                // belt
    rect(g, 0, 21, 32, 1, tone(trim, 0.7));
    for (let x = 3; x < 30; x += 6) dot(g, x, 19, tone(trim, 1.25));
    rect(g, 15, 8, 2, 9, tone(c.shirt, 1.12));  // button placket
  } else if (face === 'pz') {                   // back
    rect(g, 0, 0, 32, 3, dark);
    rect(g, 0, 18, 32, 3, trim);
    rect(g, 0, 21, 32, 1, tone(trim, 0.7));
  } else {                                      // sides
    rect(g, 0, 18, 32, 3, trim);
  }

  rect(g, 0, 29, 32, 3, tone(c.shirt, 0.82));   // hem
}

/* ---- arms ---- */
function armDemo(g, face, c, side) {
  clothBase(g, c.shirt, face, 102);
  if (side === 'R') rect(g, 0, 20, 32, 4, c.accent);   // armband, right arm only
  rect(g, 0, 28, 32, 4, tone(c.shirt, 0.8));           // cuff
}

/* ---- legs ---- */
function legDemo(g, face, c) {
  clothBase(g, c.pants, face, 103);
  rect(g, 0, 0, 32, 3, tone(c.pants, 0.8));     // waistband
  rect(g, 15, 6, 2, 20, tone(c.pants, 1.12));   // side seam
  rect(g, 0, 25, 32, 2, c.accent);              // knee wrap
}

/* ---- shoes ---- */
function shoeDemo(g, face, c) {
  clothBase(g, c.shoe, face, 104);
  rect(g, 0, 27, 32, 5, tone(c.shoe, 0.5));     // sole
  if (face === 'nz') {
    rect(g, 12, 6, 8, 1, tone(c.shoe, 1.45));   // laces
    rect(g, 12, 11, 8, 1, tone(c.shoe, 1.45));
    rect(g, 12, 16, 8, 1, tone(c.shoe, 1.45));
  }
}

/* ---- hands ---- */
function handDemo(g, face, c) {
  skinBase(g, c, face);
  rect(g, 0, 26, 32, 6, tone(c.skin, 0.85));    // wrist shadow
}

/* ---- head wrap prop ---- */
function paintHeadwrap(g, face, c) {
  clothBase(g, c.accent, face, 105);
  for (let y = 3; y < 30; y += 6) {
    rect(g, 0, y, 32, 2, tone(c.accent, 0.85));
    rect(g, 0, y + 2, 32, 1, tone(c.accent, 1.15));
  }
}
```

Then **route the dispatchers**:

```js
// paintTorso(), before the generic `return torsoFayoum(...)`
  if (key === 'demo') return torsoDemo(g, face, c);

// paintArm(), near the other key checks
  if (key === 'demo') { armDemo(g, face, c, side); return; }

// paintLeg()
  if (key === 'demo') { legDemo(g, face, c); return; }

// paintShoe(), before the generic cloth shoe
  if (key === 'demo') { shoeDemo(g, face, c); return; }

// paintHand(), before the generic skin hand
  if (key === 'demo') { handDemo(g, face, c); return; }
```

Then the **face**. `paintFace()` already draws the nose, eyes and eyebrows. Add one branch
to the existing `if / else if` chain (the last `else` is the generic mouth):

```js
  } else if (key === 'demo') {
    rect(g, 12, 23, 8, 1, tone(hair, 0.8));       // moustache
    rect(g, 10, 25, 12, 5, tone(hair, 0.95));     // short beard
    rect(g, 14, 26, 4, 3, tone(hair, 1.1));
    rect(g, 9, 11, 14, 1, c.accent);              // headband above the brows
  }
```

Finally **props** in `makeHumanoid()`, after the `fayoum` block and before
`root.add(legL, legR, torso, armL, armR, head)`:

```js
  if (key === 'demo') {
    // a wrapped headband, sitting on top of the head box
    paintedBox(head, 0.5, 0.14, 0.5, 'headwrap-' + key,
               (g, f) => paintHeadwrap(g, f, c), 0, 0.45, 0);

    // a sword strapped to the back. +Z is behind the character (it faces -Z).
    const sword = new THREE.Group();
    sword.position.set(0, 0.28, 0.19);
    sword.rotation.z = 0.38;
    paintedBox(sword, 0.05, 0.82, 0.04, 'demoblade', paintBlade, 0, 0.3, 0);
    paintedBox(sword, 0.22, 0.05, 0.08, 'demoguard',
               (g, f) => metalBase(g, c.accent, f, 10), 0, -0.13, 0);
    paintedBox(sword, 0.06, 0.22, 0.06, 'demogrip', paintGrip, 0, -0.28, 0);
    torso.add(sword);
  }
```

Prop helpers: `paintedBox(parent, w, h, d, id, paintFn, x, y, z)` returns a mesh you can
rotate; `addBox(parent, w, h, d, color, x, y, z)` for flat colored boxes;
`glowBox(...)` for unlit/emissive boxes (the Ashen One's eyes).

Prop anchors: `head`, `torso`, `armL`, `armR`, `legL`, `legR`. Their local origins are at
the joint, so `torso` y ≈ 0.72–1.34 world, `head` y ≈ 1.34–1.82 world, and negative `z` is
in front of the character.

---

## Gotchas

* **`style: 'knight'` is a big switch.** It replaces the head with a full metal helm, makes
  all limbs metal, and adds a cape + pauldrons. Use `'plain'` unless you want plate armour.
* **`style: 'fayoum'`** gives the villager robe and the warm name-tag color. Not for
  player characters.
* The texture cache is keyed by `'char|' + key + '|' + part`, so a **new key always gets
  fresh textures**; editing colors on an existing key needs a page reload.
* **`CHAR_KEYS` order is the button order / `C` cycle order.** Your entry also shows up
  in the intro, the stats HUD and multiplayer character sync automatically.
* Add a trailing comma on the previous `CHARACTERS` entry when you insert a new one.
* `name` is what players see; keep it short (it also goes on the intro buttons).
* **Outlines are automatic.** `makeHumanoid()` calls `addCharacterOutline(root)` after the
  rig is assembled, so a new key needs no silhouette work.
* Nothing else needs touching — no rebuild, no registration list, no asset file.

## Checklist

- [ ] `CHARACTERS.demo` added (colors + `style: 'plain'`)
- [ ] `'demo'` added to `CHAR_KEYS`
- [ ] painters added and routed in the five dispatch functions
- [ ] face branch added to `paintFace`
- [ ] props added to `makeHumanoid` (optional)
- [ ] `node --check src/40-characters.js`
- [ ] reload, press **C** to cycle to it (or `__blockcraft.setCharacter('demo')`)

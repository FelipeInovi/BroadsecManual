# Agent Information — `bridge-manual`

The Bridge360 operator manual. Read `ESTADO.md` first: it carries the decisions,
what was ruled out and why, and the checks to run before writing a section. This
file carries only what is specific to this manual's IMAGES.

What the PRODUCT ships — asset folders, icon libraries, where each join lives —
is in `sources/registry.yaml` under the `bridge` source's `assets:` key, because
that expires when the product changes rather than when this manual does. Read
both.

## Which slots turned out deliverable

Settled by survey, not by guessing. The numbers are the point:

| Convention | Slots | Can extraction answer it |
|---|---|---|
| `icon` (icon-table rows) | 33 | **Yes, and it is now exhausted** — 30 delivered, 3 genuinely cannot be |
| `figure` (figure, field-list, procedure) | 148 | **No.** Needs the app running against real data |

So every image still pending is a capture. There is nothing left in the product
repository that this manual is asking for.

Sharing collapsed the twelve force-filter rows into six slots, so the icon
convention is **33 slots, of which 30 were delivered and 3 cannot be.** The
`icon` convention is exhausted. Everything still pending is `figure`.

### What was delivered

**Seven as shipped files:**

- **The six force filters**, as ONE shared slot each (`fuerza.salud`,
  `fuerza.bomberos`, `fuerza.policia`, `fuerza.transito`,
  `fuerza.defensa-civil`, `fuerza.gaula`). They appear twice — in Llamada's
  filter table and in Fuerzas en Campo's — and both places import the same six
  binaries, so both rows carry an explicit `icon: fuerza.<x>` instead of two
  copies of one file. That is what collapsed the manifest from 187 slots to 181.
- **The street-view toggle** (`home.herramientas.control.street-view`), from its
  own id.

**Twenty-three emitted from module geometry**, not copied, because this product
draws nearly every control from a component rather than a file:

- **Eighteen from `lucide-react`**, whose `dist/esm/icons/<name>.js` holds the
  unminified `__iconNode` and the ISC licence. The component names the icon, so
  the join is the library's own identity. Each file records the library, its
  version, its licence, where the icon was seen used, and the recolouring.
- **Five from Bridge360's own inline SVG components** in `cctv-ptz-core.tsx` —
  the four PTZ chevrons and the preset-home glyph.

All twenty-three are recoloured to `#0F766E` (Bridge's `accentDark`, the same
colour the row label uses), because `stroke="currentColor"` resolves to black
inside `<img src="…svg">`. Contrast measured: 5.47:1 on white rows, 4.99:1 on the
alternating tone.

### The three that cannot be

- `bot.cctv.ptz.zoom-mas` and `zoom-menos` — the control is a fragment: the
  magnifier SVG **plus** a `<span>` holding `+` or `-` in the app's font
  (`cctv-ptz-core.tsx:244`, `:263`). The SVG alone is three quarters of what the
  operator sees, and composing the character back in is a design act.
- `bot.cctv.ptz.diagonales` — its label names four controls at once.

## Traps this manual hit, and will hit again

**The prop is `icon`, not `image`.** An `icon-table` row declares its image under
`icon` (`packages/blocks/src/catalog/icon-table.ts:58`). Writing `image:` there is
not an error: zod strips the unknown key, the build succeeds, and the delivery
lands as an ORPHAN. The manifest's `undeclared` list is what catches it — it did,
on the first attempt here. Read the block's `images.prop` before declaring.

**The street-view control is a TOGGLE, and the asset is its INACTIVE state.**
`map-tools-panel.tsx:273-281`: active renders a red lucide `X`, inactive renders
the pegman file. The manual shows the control as the operator finds it, which is
the file. If that row ever needs the active state, it is a capture, not an
extraction.

**A row whose label lists several controls cannot take one control's glyph.**
`bot.cctv.ptz.diagonales` reads "Arriba izquierda, arriba derecha, abajo
izquierda y abajo derecha". Even if those arrows were files, delivering one would
fill the slot, pass every count, and show the reader one quarter of what the
caption promises.

**Figure heights are pinned, and that is deliberate.** Bridge's stylesheet fixes
every figure's box to the placeholder's ratio and letterboxes the image inside it
(`packages/render-web/src/css-bridge.ts`). So a delivered figure cannot move the
page — which is why the seven deliveries here changed the page count by zero. Do
not "fix" an image by cropping it to fit; the box already holds.

## An asset family with no slot

`map-tools-panel.tsx:49-56` ships five map-layer images — **Tráfico, Satelital,
AVL, Mobile, Cámaras** — each in an object literal beside its own label. A perfect
join, and **nothing in this manual asks for them.**

The `home.herramientas` table has a row called "Capas de integración", but that
is the manual's name for the control that OPENS the layer menu; it is not the
layers. Delivering a layer image there would fill the slot with something the
caption does not describe.

So the gap is in the CONTENT: `01-home` has no table of map layers. Whether it
should is an authoring decision — which layers a reader sees, whether they belong
under Home at all — and it is not extraction's call. Five deliverable images are
waiting on it.

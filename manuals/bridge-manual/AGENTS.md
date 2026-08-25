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
| `figure` (figure, field-list, procedure) | 128 | **No.** Needs the app running against real data |

So every image still pending is a capture. There is nothing left in the product
repository that this manual is asking for.

Since then the capture side has run, twice over. The manual stands at **129 of
162 delivered**, and four sections ask for nothing more: **Bridge of Things**,
**Crear Incidente**, **Seatmap** (bar one figure) and the shared force filters.
See "What is still pending" below — and trust that table over this paragraph if
they ever disagree, because a count goes stale and a reason does not.

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
  Removing PMV's and PRT's operational detail at v0.6.6 took 20 more `figure`
  slots off, leaving **161**. See ESTADO's finding on reading the data path.
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

### The three EXTRACTION could not answer — all three are now filled

- `bot.cctv.ptz.zoom-mas` and `zoom-menos` — the control is a fragment: the
  magnifier SVG **plus** a `<span>` holding `+` or `-` in the app's font
  (`cctv-ptz-core.tsx:244`, `:263`). The SVG alone is three quarters of what the
  operator sees, and composing the character back in is a design act.

  **This verdict was about EXTRACTION and it still holds; both slots are now
  filled by CAPTURE.** A screenshot photographs the composed control, character
  and all, so the fragment problem never arises. Worth keeping in mind for any
  other slot ruled out on the same grounds: "no file can answer this" is not the
  same claim as "no image can".
- `bot.cctv.ptz.diagonales` — its label named four controls at once, so no file
  and no clip could answer it.

  **That slot no longer exists.** It was one row describing four controls, and
  the row was the defect: split at v0.6.7 into `arriba-izquierda`,
  `arriba-derecha`, `abajo-izquierda` and `abajo-derecha`, each of which turned
  out to have its own glyph component in `cctv-ptz-core.tsx` (:167, :182, :197,
  :212) and its own label in the control bar (:50, :70, :116, :136). All four are
  now extracted, recoloured and cited — the same treatment the four cardinal
  chevrons already had. The "cannot" was never about extraction at all.

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
`bot.cctv.ptz.diagonales` read "Arriba izquierda, arriba derecha, abajo izquierda
y abajo derecha". Even though those arrows WERE files, delivering one would have
filled the slot, passed every count, and shown the reader one quarter of what the
label promised.

The lesson survives; the example was fixed. **A row like that is not an image
problem to work around, it is a row to split** — and once split, all four
delivered from files that were sitting there the whole time. Reach for the split
before reaching for a way to photograph the group.

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


## Capturing from the running product

The recipes live in `capture-recipes.yaml` beside this file, and its header
carries the how. What belongs here is what the app turned out to be like.

### Getting in

```
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222" pnpm tauri dev
```

Git Bash, not PowerShell, and close any window already open first — WebView2
reads that variable when the process starts. A person then signs in, second
factor included, and the run joins that window. Probe scripts must run from
`packages/cli`: pnpm does not hoist `puppeteer-core` to the root.

### What the app is like to drive

- **The rail is six identical buttons.** No id, no aria-label, no text. Position
  only, against the order `navItems` declares. The tooltip does carry the label
  and is NOT usable: it stays mounted across reads and returns the previous
  button's label every other time.
- **`verify` must be chrome, not a panel.** The window is normally left on
  whatever view someone was last using, so anything view-specific fails. The
  top bar's `Agencia:` span is the one thing every view has past the login gate.
- **A rendered case is not a textContent case.** `HISTORIAL DE EVENTOS` is
  `Historial de Eventos` in the component, uppercased by CSS.
- **Seatmap renders no heading at all.** Its tell is one of its own stat card
  titles. Its regions are not `div.panel` either — the indicator column is
  `div.row-span-2` and the bottom band is `div[class*="rounded-[25px]"]`.
- **Clipping a `<Label>` gives the WORD, not the field.** `Label` renders a
  `<span>`, so a field figure needs `clipUp: div` to reach the label-and-input
  pair. `[title=…]` and `[placeholder=…]`, by contrast, match the control itself.
- **The review panel has a live timer**, so a clip there can fail on a re-render.
  Retry before blaming the selector.
- **The window drifts.** Twice, between two consecutive read-only probes with
  nothing of ours running in between, it moved on its own to the Dashboard's
  `Historial de Eventos`. This is a dispatch console; an incoming event plausibly
  steals the view. So never assume the window is where the last run left it —
  that is what `screenIs` is for, and it is why probing by hand is unreliable
  while the harness is not.

### Bridge of Things blanks on SECOND entry — a product defect

Enter the view, leave, come back, and **the whole application goes blank**: no
rail, no panel, `innerText.length === 0`. Confirmed by experiment with nothing
touched in between:

```
tras reload                 texto=1043  h3=["Revisión de llamadas","Agencias","Mi Turno"]
1ª vez en BoT               texto=641   h3=["DASHBOARD"]
home                        texto=1063  h3=["Revisión de llamadas","Agencias","Mi Turno"]
2ª vez en BoT (sin tocar)   texto=0     h3=[]
```

This also explains the earlier incident recorded below as a bad click on the PMV
card: that visit was a re-entry too. The card was never the culprit — **opening
CCTV through its card works fine**, and the panel comes up with 80 live cameras.

`page.reload()` recovers it fully, and the entry after a reload is a first entry
again. `runAttachedCaptures` now does exactly that: it detects the blank tree,
reloads, re-verifies and retries the view once, so a plan with several
`view: bridge-of-things` recipes no longer dies on the second. The workaround is
in the harness, and it names the defect — **but the defect is the product's, and
it belongs in the product's tracker, not in this manual.**

### One incident, and how to recover

Clicking `::-p-text(PMV)` on Bridge of Things' landing panel — trying to open the
PMV panel the way the manual says its cards do — left the application BLANK: no
text, no buttons, nothing. The click reached something other than the card.

`page.reload()` recovered it fully, signed in, rail intact. That is safe here and
worth knowing: the tokens live in `localStorage` and the workstation config in the
OS keyring, so a reload of the same route re-mounts the app with the session. It
is not the same thing as navigating away, which has no route to come back from.

**Do not click into an unverified target on someone's signed-in window.** Probe
what a selector matches first. The cost of getting it wrong is their second
factor.

### What is still pending, and what each needs

Thirty-three, and **not one of them is "an interaction not yet found"** any
more. That row used to hold nine slots and every one of them was a selector —
see the section after this table. What is left blocks on data or on an account.
Nothing left blocks on the harness, and nothing left blocks on the world outside
the product: the one slot that did was an authoring defect and is gone.

| Blocked on | Slots |
|---|---|
| A call in progress | the twenty-two `llamada.*` |
| **Shift data in the environment** | `fuerzas-campo.turnos.fig` AND the seven `fuerzas-campo.tarea.*` — ONE condition, eight slots |
| A second account without `canViewAllAgencies` | `seatmap.fig` |
| More than one call in the review list | `home.revision.abrir.ubicar` |
| A call that HAS an associated case | `home.revision.corregir.tipo` |

Two of those rows deserve their reason spelled out, because each looks like
something else:

- **The eight shift slots are one problem, not two.** `openTaskDraft`
  (shift-row.tsx:58-68) seeds the task form from `shift.id`, `shift.agentId`,
  `shift.startTime` and `shift.endTime` and only then activates the panel. No
  shift row, no form. Every agent tried returns "Sin turnos encontrados", which
  is the same gap that holds `turnos.fig`. "Orden de Tarea is not in the panel
  bar" was true and was never the reason.
- **`corregir.tipo` is gated, not missing.** The type field is
  `editable={isEditing && canEditType}` with `canEditType = item.matchId != null`
  (calls-review-card.tsx:98, :379). With edit mode ON and a call that has no
  case, there is no combobox and no select anywhere on screen.

**Not blocked, but not self-contained either:** the six `crear-incidente` step
slots ARE delivered. Their recipes need the general step filled first — an
incident type, a priority and a CONFIRMED address — and confirming an address
means typing, which `steps` cannot do (`click`, `drag`, `hover` only). They were
shot against a form filled by hand. A `type` step in the recipe vocabulary is the
one thing that would close this.

**Bridge of Things is COMPLETE.** Its last three blockers turned out not to be
capture problems at all — see below. PMV's and PRT's slots went away with their
content at v0.6.6, so do not go looking for a way to photograph those two.

### Three times, an unfillable slot was an AUTHORING defect

This section and the next one are the two most useful on this page, and they are
opposite halves of one habit: when a slot will not fill, the cause is almost never
a missing harness feature. Here it was the CONTENT; next door it was the SELECTOR.
Check both before writing "blocked".

Four slots sat in the blocked table above as though the harness were short a
feature. Two of them were the content being wrong, the third was the content
being lazy, and the fourth pointed at a window this product does not own:

| Was | Diagnosis | Fix |
|---|---|---|
| `bot.cctv.camaras.arrastrar` + `.soltar` | Three numbered steps for one action, the third of which was "Suéltela" — a step whose entire content is releasing the mouse. BOTH slots could only ever have photographed a gesture | Merged into one step whose image is the mosaic: the cells, filled and streaming, which is the state the step's text ends on |
| `bot.cctv.ptz.diagonales` | ONE icon row whose label named four controls at once, so no glyph and no clip could answer it | Split into four rows. Each diagonal has its own `title` in the product AND its own glyph component, so all four are now delivered and all four are cited |
| `dashboard.historial.exportar.guardar` | A third export step, "Guarde el archivo", whose subject is the OS save dialog. It is outside the webview, so CDP cannot see it and no recipe ever could — the caption asked this product for a window it does not own | Merged into the format step, which now closes on the downloaded file. Same shape as "Suéltela": the OUTCOME of an action written up as an action of its own |

**The tell was already in the file.** The `ptz.diagonales` row was the single
exception in that section's `labels` list, excluded because "no single line says
it". An uncitable label is not a citation problem — it is the row telling you it
describes more than one thing. Splitting it removed the exception instead of
documenting it.

So when a slot cannot be filled, ask what the CONTENT promised before asking what
the harness lacks. A gesture, a state that does not survive a still frame, a label
naming several controls, a window this product does not own: each is a caption no
image can ever answer, and no amount of recipe will fix it.

### Five times, an unfillable slot was the ATTRIBUTE

Read this before believing any "blocked" line on this page. Nine slots sat in the
table above under "an interaction not yet found". **All nine came free, and not
one of them needed a harness feature.** Every single case was the same shape: the
right control was on screen the whole time, addressed the wrong way.

| Control | Where its name actually lives | How it hid |
|---|---|---|
| `Asignar incidente` | `aria-label` on BOTH a `<span role="button">` (agent rows, agent-row.tsx:101) and a `<button>` (case rows, assign-incident-action.tsx:113) | the bare selector matched **forty** elements across two panels; only the TAG separates them, and the section cites the `<button>` |
| `Filtros` (Analítica) | **plain text**, no `title`, no `aria-label` (analytics-filters-panel.tsx:824) | invisible to every probe that lists controls by attribute — which is why "its filters panel does not open with the tab" stood for so long |
| `Guardar` (libro del caso) | `title`, while its two sibling TABS are text | `::-p-text(Guardar)` matched nothing |
| `Seleccionar todos` | `aria-label` | written down as `title` |
| `TextField` wrapper | a `<label>`, not a `<div>` (create-incident-fields.tsx:38) | `closest("div")` sails past it and returns the box holding BOTH fields, so `nombre` and `telefono` came back identical |

**The root cause was the tool, not the product.** The probe used for all of these
printed `title`, `placeholder` and `aria-label` into one column, so the note taken
from it could not say which one carried the name. Any probe written here must
print WHICH attribute it found, or it will manufacture this bug again.

Two more traps from the same runs, both of which produce files rather than errors:

- **A `disabled` control swallows its click in silence.** It bit three times: the
  first case row's assign button (`item.matchId == null || blockReason != null`),
  Crear Incidente's locked step headers, and `Seleccionar todos`. The run reports
  `ok` and photographs the wrong state. When a click seems to do nothing, check
  `disabled` before changing the selector.
- **An incoming call dims the WHOLE application** and the run still reports `ok`.
  Two figures came back as blurred rectangles. `verify` runs once at attach, not
  per shot, so a call arriving mid-run is never noticed — though it WOULD be
  caught if it ran per shot, because the top bar loses the `Agencia:` span the
  verify selector keys on. The tell is `::-p-text(LLAMADA ENTRANTE)`. Standing
  instruction from the owner: let the call finish, then carry on. Never reload
  while one is ringing.

### A wide figure is not an illegible figure, it is in the wrong column

`seatmap.distribucion.encabezado` was held on legibility and then delivered
without touching its recipe. The band is 1275x46 — a centred agency name over a
rule. `layout: beside` gives a figure 38% of the 628pt content column
(`.pair__figure`, css-bridge.ts:414), so `contain` scaled it to **0.19** and the
name landed near 2px. The ROW now declares `layout: below` with
`widthPercent: 100`: the full text column, scale **0.49**.

That is not a lowered bar, and the number that proves it comes from what already
ships: `crear-incidente.general.campo.tipo` renders at 0.59 over a 10px caption —
the same ~6px on the page. `widthPercent` is required, because `below` alone caps
at 70% (`figure.figure--item img`, css-bridge.ts:404) and falls back to 0.35.

**So measure the scale, not the ratio, and measure it against delivered figures
rather than against arithmetic.** And before ruling a figure unfillable on
legibility, check whether its row is asking for the wrong column.

### A live video mosaic needs the right cameras, not a longer settle

`bot.cctv.camaras.arrastrar` shows three cells streaming. Getting three clean
cells took three attempts, and the reason matters: a cell keeps a **"Cargando..."**
pill until its stream reaches `readyState 4`, and some cameras simply do not get
there. CCTV-Aeroparque sat at `readyState 1` with the pill up **70 seconds** in
while its neighbours had cleared theirs.

So that pill is not a stuck indicator and not a settle that is too short —
`settleMs` caps at 30s for good reason, and no legal value beats a slow stream.
The fix was a different camera. The recipe now names CCTV-Sena, CCTV-Astor and
CCTV-AKT, and the comment says why those three.

Two smaller things from the same run:

- **Address cells by position, not by their empty-state text.** Three drops on
  the grid's centre put the SAME camera in all three cells, which reads as a
  fault rather than a mosaic. `div.grid.h-full.w-full > div:nth-child(N)` puts one
  camera in each.
- **A cell cannot be reliably emptied.** Its remove control is a hover-revealed
  20×20 button that only exists while the cell is full, so a recipe that clears
  cells works on a populated mosaic and throws on an empty one. Any figure here
  has to be reachable by ADDING, which is why this one shows a full mosaic rather
  than the "Arrastrar cámara" prompt the step's text quotes.

### What the CCTV run learned

**One drag unlocked six slots.** The mosaic drag does not merely fill a tile — it
SELECTS the camera, and selecting one replaces "Selecciona una cámara para
controlarla" with the PTZ pad and the presets block. Six slots listed as blocked
on "a camera selected" were one `drag` step away, and `bot.cctv.fig` came back
with a live street view, the pad and the presets all in one frame.

**Drop on the GRID, never on an empty tile.** `to: ::-p-text(Arrastrar cámara)`
works exactly once. After the first run the mosaic is populated, that text is
gone from every tile, and the next three shots failed on it. `div.grid.h-full.w-full`
lands inside the large tile whether it is empty or already showing a camera, so
the recipe stops depending on how the last run left the application.

**A `screenIs` must not be panel state.** `bot.abrir.barra` failed on
`h3::-p-text(DASHBOARD)` because the previous recipe had left CCTV open. The bar
is chrome; it is gated on `img[alt="PMV"]`, an icon that exists only where the
view's manifest lists a PMV panel.

**The rendered case trap, twice more.** `CÁMARAS (80)` is `Cámaras (80)` in the
DOM and `PRESETS DE POSICIÓN` is `Presets de posición`. Both are CSS `uppercase`,
both cost a round, and both were already sitting in probe output read earlier the
same session. Read the probe, do not read the screen.

**`bot.cctv.presets.volver` was hover-gated, and `steps` now has a `hover`.**
The first clip came back showing "Preset 1" and no control at all:
`cctv-presets.tsx:109` gives the "Ir a preset" button
`opacity-0 group-hover:opacity-100`. Correct pixels, false promise — the caption
is "Vuelva a la posición cuando la necesite" and the reader would hunt for a
button not in the frame. That file was deleted rather than shipped.

`opacity`, not `display` and not `visibility`, is what made the fix clean: the
button keeps its box and its pointer events, so the hover targets the very
selector the clip is about to use instead of guessing at the row around it.

Two things to carry forward:

- **A `hover` must come AFTER any `drag` in the same sequence.** Both drive the
  same mouse, and a drag would carry the cursor off whatever the hover
  uncovered. Nothing after the steps moves it — the gates and the clip only
  query — so the control is still revealed when the shot lands.
- **The step's own text named BOTH controls**, and that is why the row-level clip
  is right rather than a tighter one on the button alone: "Use **Ir a preset** en
  la posición guardada… **Eliminar preset** la quita de la lista." The delivered
  picture shows the row with ▶ and the red ✕, which is exactly what the prose
  describes and exactly what the operator sees on hover. Read the step text
  before choosing how tight to clip; a caption that names two controls is not
  answered by a picture of one.

**`bot.cctv.presets.guardar` is 12×16 — smaller than anything else here.** It is
the right control (`title="Guardar posición actual"`, the save glyph) and it is
delivered, but the smallest previously accepted control is 32×32. Look at it on
the page before trusting it; if it reads as a smudge the answer is a higher
device scale factor at capture time, not a different clip.

**The panel bar exists, and earlier probes missed it.** `bot.abrir.barra` is the
`ToolKitPanel`: a draggable `motion.div` portalled to `document.body`, sitting at
`div[class*="bottom-24"][class*="left-5.5"]`, 42×186, four icon-only buttons —
one per panel of the view, three of them `img[alt]` from
`assets/bot_status_icons/{cctv,pmv,prt}.svg`. Probes kept missing it because
`railButtons()` bounds `y < 400` to exclude it and it carries no text of its own.

It is capturable: `clip: img[alt="CCTV"]`, `clipUp: div[class*="bottom-24"]`.

**Portrait clips are fine here, and arithmetic said otherwise.** The reasoning
went: 42×186 is portrait, the box is pinned landscape at 320/200, so `contain`
letterboxes it to a sliver. Then the delivered figures were measured, and five
are already portrait and already accepted — `home.revision.fig` at **0.41**,
`crear-incidente.general.fig` 0.50, `seatmap.indicadores.fig` 0.55,
`home.agencias.fig` and `home.turno.fig` 0.83 — with a 32×32 control among them
too. Every one of those is more extreme than the CCTV panel's 0.835.

So do not reject a clip on its ratio. **Look at the rendered page at real size**;
that is the only check that settles it, and it is the one failure a manifest
cannot catch.

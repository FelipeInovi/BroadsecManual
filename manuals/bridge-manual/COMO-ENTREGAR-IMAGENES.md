# Cómo entregar las imágenes del manual de Bridge360

Todo lo que hace falta está impreso en el **borrador**. No hay que consultar el
código ni preguntar nombres.

## 0. Empiece por la tabla de pendientes

```
manuals/bridge-manual/imagenes-pendientes-agencia-propia.md
manuals/bridge-manual/imagenes-pendientes-todas-las-agencias.md
```

**Una imagen que no figura en la tabla ya fue entregada.** Volver a capturarla es
trabajo perdido: el archivo nuevo pisa uno que ya estaba bien, y nadie se entera
porque el manual sigue construyendo igual.

Las dos tablas comparten casi todo. La de `agencia-propia` tiene una fila más,
`seatmap.fig`, porque esa pantalla solo se ve con un perfil que **no** tiene
permiso para ver todas las agencias. Si su cuenta las ve todas, esa imagen no la
puede tomar y no es un error suyo.

La tercera columna es suya: escriba en ella cómo se llega a esa pantalla y qué
tiene que estar en curso para que se vea así. Las páginas se recalculan cuando el
manual cambia, pero **lo que usted escriba se conserva** al regenerar la tabla.

## 1. Pida el borrador, no el PDF del cliente

```
node packages/cli/src/main.ts build bridge-manual --draft
```

Produce `output/manual-operador-bridge-<permiso>-v0.0.1-BORRADOR.pdf`. Es el
mismo manual, con una diferencia: **debajo de cada imagen pendiente imprime el
nombre exacto del archivo**. El PDF del cliente no lo lleva a propósito, porque
una ruta de nuestro repositorio no va en un documento que recibe un cliente.

## 2. Guarde cada captura con el nombre que dice el borrador

Debajo del recuadro gris dice, por ejemplo:

```
_common/llamada.camaras.fig.png
```

Eso significa: el archivo se llama `llamada.camaras.fig.png` y va en la carpeta
`_common`.

- **Todos los archivos en UNA sola carpeta.** No hay subcarpetas que crear.
- **El nombre importa; la extensión no.** Se aceptan `png`, `jpg`, `jpeg`,
  `svg`, `webp` y `gif`. Si su captura es `.jpg`, guárdela como
  `llamada.camaras.fig.jpg`. Lo único que no puede cambiar es lo que va antes de
  la extensión.
- **No renombre nada más.** Ni mayúsculas, ni acentos, ni espacios: el nombre se
  copia tal cual.

El epígrafe que está arriba del nombre dice qué muestra la imagen. Úselo para
saber qué capturar.

## 3. Dos reglas de encuadre que ya costaron figuras rechazadas

**Capture a 1920 de ancho, no menos.** En 1280 las tarjetas se desbordan de su
contenedor y el recorte corta justamente el distintivo que el epígrafe nombra.
La misma pantalla, en 1920, sale entera.

**Saque el puntero de encima antes de disparar.** Un control fotografiado con el
mouse encima muestra su estado de hover: una figura salió con la X en rojo y se
lee como un error del producto.

## 4. No fotografíe caras

Dos figuras —el panel de chat y el de video en vivo— se retiraron después de
tomadas porque mostraban una cara identificable. Vuelven a estar pendientes.

Al retomarlas: la cámara del llamante y cualquier imagen compartida en el chat
deben apuntar a **algo que no sea una persona**. El encuadre estaba bien; el
contenido no.

## 5. Devuelva la carpeta

`_common` con los archivos adentro. Se copia a
`manuals/bridge-manual/assets/figures/` y listo: no hay que tocar el contenido
del manual, ni los textos, ni la numeración.

## 6. Verifique

```
node packages/cli/src/main.ts images bridge-manual
```

Dos cosas tienen que pasar:

- **Los pendientes bajan exactamente en la cantidad de archivos que agregó.** Si
  bajan menos, algún archivo quedó con un nombre que nadie pidió.
- **`undeclared` queda vacío.** Si aparece un nombre ahí, ése es el archivo mal
  nombrado, y lo dice por nombre.

Ese chequeo existe porque un archivo mal nombrado **no rompe nada**: el manual
sigue mostrando el recuadro gris y el build sigue diciendo que salió bien. Sin
esta verificación, el trabajo se pierde en silencio.

## Si una pantalla se ve distinta según el permiso

El nombre plano en `_common` sirve para todos los perfiles. Si una pantalla
difiere en uno puntual, ese archivo va en una carpeta con el id del perfil
—`agencia-propia/`, `todas-las-agencias/`— con el mismo nombre. Gana sobre el de
`_common` solo para ese perfil. Es la excepción, no la regla.

## Lo que NO hay que capturar

El manual declara aparte cuatro huecos que esperan al **producto**, no a una
captura: pantallas que Bridge360 todavía no terminó. Están en
`awaiting-product.json` y no aparecen en las tablas de pendientes. Si encuentra
una pantalla a medio hacer, no es una imagen que falte — no la persiga.

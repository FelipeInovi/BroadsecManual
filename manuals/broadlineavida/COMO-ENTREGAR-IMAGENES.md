# Cómo entregar las imágenes del manual

Todo lo que hace falta está impreso en el **borrador**. No hay que consultar el
código ni preguntar nombres.

## 1. Pida el borrador, no el PDF del cliente

```
node packages/cli/src/main.ts build broadlineavida --draft
```

Produce `output/manual-operador-<despliegue>-v0.1.0-BORRADOR.pdf`. Es el mismo
manual, con una diferencia: **debajo de cada imagen pendiente imprime el nombre
exacto del archivo**. El PDF del cliente no lo lleva a propósito, porque una ruta
de nuestro repositorio no va en un documento que recibe un cliente.

## 2. Guarde cada captura con el nombre que dice el borrador

Debajo del recuadro gris dice, por ejemplo:

```
_common/funcionamiento.acceso.fig.png
```

Eso significa: el archivo se llama `funcionamiento.acceso.fig.png` y va en la
carpeta `_common`.

- **Todos los archivos en UNA sola carpeta.** No hay subcarpetas que crear.
- **El nombre importa; la extensión no.** Se aceptan `png`, `jpg`, `jpeg`,
  `svg`, `webp` y `gif`. Si su captura es `.jpg`, guárdela como
  `funcionamiento.acceso.fig.jpg`. Lo único que no puede cambiar es lo que va
  antes de la extensión.
- **No renombre nada más.** Ni mayúsculas, ni acentos, ni espacios: el nombre se
  copia tal cual.

El epígrafe que está arriba del nombre dice qué muestra la imagen. Úselo para
saber qué capturar.

## 3. Devuelva la carpeta

`_common` con los archivos adentro. Se copia a
`manuals/broadlineavida/assets/figures/` y listo: no hay que tocar el contenido
del manual, ni los textos, ni la numeración.

## 4. Verifique

```
node packages/cli/src/main.ts images broadlineavida
```

Dos cosas tienen que pasar:

- **Los pendientes bajan exactamente en la cantidad de archivos que agregó.** Si
  bajan menos, algún archivo quedó con un nombre que nadie pidió.
- **`undeclared` queda vacío.** Si aparece un nombre ahí, ése es el archivo mal
  nombrado, y lo dice por nombre.

Ese chequeo existe porque un archivo mal nombrado **no rompe nada**: el manual
sigue mostrando el recuadro gris y el build sigue diciendo que salió bien. Sin
esta verificación, el trabajo se pierde en silencio.

## Si una pantalla se ve distinta en un despliegue

El nombre plano en `_common` sirve para todos. Si una pantalla difiere en un
despliegue puntual, ese archivo va en una carpeta con el id del despliegue
—`mv/`, `med/`— con el mismo nombre. Gana sobre el de `_common` solo para ese
despliegue. Es la excepción, no la regla: la mayoría de las pantallas son iguales
en todos, y una copia por despliegue son cinco archivos más que mantener.

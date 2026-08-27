# Entregas oficiales

**Acá vive el archivo exacto que recibió un cliente. Nada de esto se borra.**

Una subcarpeta por manual, y adentro solo el PDF y el Word **finales**. No van
borradores, no van pruebas, no van versiones a medio hacer: para eso está
`manuals/<id>/output/`, que es desechable por diseño y se vacía sin pensarlo.

```
deliveries/
  bridge-manual/
    manual-operador-bridge-agencia-propia-v1.0.0.pdf
    manual-operador-bridge-agencia-propia-v1.0.0.docx
  broadlineavida/
    manual-operador-mv-v1.1.0.pdf
    manual-operador-med-v1.0.0.pdf
```

Plano dentro de cada manual, sin subcarpeta por versión — y no es pereza. Una
entrega puede llevar versiones distintas en cada target: la tabla de
broadlineavida le da a `mv` una fila 1.1.0 que `med` no recibe, así que `med` se
queda en 1.0.0. Una carpeta `v1.1.0/` sería mentira para el archivo de `med`. El
nombre del archivo ya lleva perfil y versión.

## Por qué esta carpeta está lejos de `output/`

Porque `manuals/<id>/output/` se vacía por rutina, y un archivo permanente al
lado de uno desechable termina borrado. La distancia es la protección.

## Qué está en git y qué no

Los bytes **no**. Una entrega de un manual pesa unos 77 MB, y git guarda
binarios enteros por versión: un año de entregas serían varios gigabytes que
nadie va a leer nunca con `git log`.

Lo que sí queda registrado es la **prueba**. Cada fila entregada del bloque
`change-log`, en el módulo final del manual, lleva:

- el **commit** del que se construyó, y
- el **SHA-256** de cada archivo entregado.

Son cien bytes por entrega, y con eso:

- **Se puede probar cuál es el documento.** Dentro de dos años alguien dice "el
  manual decía tal cosa": se le pide el archivo, se le saca la huella, se
  compara. O es el que se entregó o no lo es.
- **El build puede impedir que se pise.** Si va a escribir un target cuya
  versión ya figura entregada y la huella no coincide, falla — porque estaría
  generando un documento distinto con el nombre de uno que el cliente ya tiene.
- **`output/` se puede vaciar siempre.** La prueba vive en el repo, no en la
  carpeta.

## Si esta carpeta se pierde

El repo sigue sabiendo **qué** se entregó, **cuándo** y **con qué contenido
exacto** — pero no lo tiene. Reconstruir la versión a partir de su commit da un
archivo que casi con certeza tendrá otra huella, porque un PDF no es
byte-idéntico entre construcciones.

O sea: es recuperable como documento, no como evidencia. Respáldenla.

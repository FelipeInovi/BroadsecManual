# Emparejar las imágenes del Manual_Broadsec_v5 con los slots del manual

## La regla de nombres

Los puntos del slot son carpetas. El slot `funcionalidades.mapa.fig` se guarda en
`_common/funcionalidades/mapa/fig.png`, dentro de
`manuals/broadlineavida/assets/figures/`.

**La ruta importa; la extensión no.** El build acepta `png`, `jpg`, `jpeg`, `svg`,
`webp` y `gif`. Si el archivo extraído es `.jpeg`, guárdelo como `.jpeg` y
conserve la ruta tal cual. La columna *Guardar como* dice `.png` porque es el
formato más habitual, no porque sea obligatorio.

## Los tres pasos

1. Abra la imagen extraída de la carpeta `v5-extracted/` y compárela con el epígrafe.
2. Cópiela a `assets/figures/` con la ruta de la columna **Guardar como**.
3. Corra `node packages/cli/src/main.ts images broadlineavida`. El pendiente debe
   bajar en uno por cada archivo agregado, y `undeclared` debe quedar vacío. Si baja
   menos, un archivo cayó en un nombre que nadie pidió.

> Para ver los nombres dentro del propio manual, genere el borrador:
> `node packages/cli/src/main.ts build broadlineavida --draft`. Cada pendiente
> lleva su ruta impresa debajo.

## introduccion

Conteos iguales (1): el emparejamiento por orden ya se aplicó y está entregado.

## broadsec

Conteos iguales (1): el emparejamiento por orden ya se aplicó y está entregado.

## funcionamiento

**1 imágenes extraídas contra 2 slots (faltan 1).**
El PDF no tiene epígrafes, así que el orden es el único indicio y con conteos
distintos se desfasa. La columna *Candidata* es una **propuesta por orden**:
verifíquela imagen por imagen; en cuanto una no corresponda, todas las de abajo
están corridas.

| # | Candidata | Pág. | Epígrafe del slot | Guardar como |
|---|---|---|---|---|
| 1 | p05-02.png | 5 | Ícono de acceso al módulo Broadsec desde Apex. | `_common/funcionamiento/acceso/fig.png` |
| 2 | — | — | Interfaz de inicio del módulo. | `_common/funcionamiento/inicio/fig.png` |

## interfaz-general

**8 imágenes extraídas contra 6 slots (sobran 2).**
El PDF no tiene epígrafes, así que el orden es el único indicio y con conteos
distintos se desfasa. La columna *Candidata* es una **propuesta por orden**:
verifíquela imagen por imagen; en cuanto una no corresponda, todas las de abajo
están corridas.

| # | Candidata | Pág. | Epígrafe del slot | Guardar como |
|---|---|---|---|---|
| 1 | p06-01.jpeg | 6 | Componentes del Home — Mapa, Barra Superior e Incidentes. | `_common/interfaz-general/fig-home.png` |
| 2 | p07-01.jpeg | 7 | Vista general del mapa con sus controles de visualización. | `_common/mapa/fig.png` |
| 3 | p08-01.jpeg | 8 | Visualización de capas sobre el mapa. | `_common/mapa/fig-capas.png` |
| 4 | p09-01.png | 9 | Barra superior de la plataforma. | `_common/barra-superior/fig.png` |
| 5 | p09-02.png | 9 | Panel de filtros de la barra superior. | `_common/barra/filtro/fig.png` |
| 6 | p10-01.jpeg | 10 | Lista de casos, con la información de cada incidente reportado. | `_common/incidentes/fig.png` |

Sobrantes sin slot: p10-02.jpeg, p10-05.jpeg

## funcionalidades

**53 imágenes extraídas contra 63 slots (faltan 10).**
El PDF no tiene epígrafes, así que el orden es el único indicio y con conteos
distintos se desfasa. La columna *Candidata* es una **propuesta por orden**:
verifíquela imagen por imagen; en cuanto una no corresponda, todas las de abajo
están corridas.

| # | Candidata | Pág. | Epígrafe del slot | Guardar como |
|---|---|---|---|---|
| 1 | p11-01.jpeg | 11 | Selector de capas del mapa. | `_common/funcionalidades/mapa/fig.png` |
| 2 | p11-07.jpeg | 11 | Selector de capas del mapa activo. | `_common/funcionalidades/mapa/fig-activo.png` |
| 3 | p12-01.jpeg | 12 | Visualización de capas del mapa. | `_common/funcionalidades/mapa/fig-visualizacion.png` |
| 4 | p12-03.jpeg | 12 | Capa Satelital y capa de Tráfico. | `_common/funcionalidades/mapa/fig-satelital.png` |
| 5 | p12-04.jpeg | 12 | Acciones disponibles al seleccionar un incidente en el mapa. | `_common/funcionalidades/incidentes/fig.png` |
| 6 | p12-05.jpeg | 12 | Capa Mobile: ubicación de agentes móviles. | `_common/funcionalidades/capa-mobile/fig.png` |
| 7 | p13-01.jpeg | 13 | Capa AVL: ubicación de fuerzas integradas. | `_common/funcionalidades/capa-avl/fig.png` |
| 8 | p13-06.jpeg | 13 | Capa de Paneles en el mapa. | `_common/funcionalidades/capa-paneles/fig.png` |
| 9 | p13-07.jpeg | 13 | Capa de Paneles, vista complementaria. | `_common/funcionalidades/capa-paneles/fig-complementaria.png` |
| 10 | p14-01.jpeg | 14 | Panel de filtros de la lista de casos. | `_common/funcionalidades/filtros/fig.png` |
| 11 | p14-02.jpeg | 14 | Rango de tiempo | `_common/func/filtro/rango.png` |
| 12 | p15-01.png | 15 | Restaurar filtros | `_common/func/filtro/restaurar.png` |
| 13 | p15-04.png | 15 | Interruptor Solo mis casos, apagado. | `_common/funcionalidades/filtros/solo-mis-casos/fig-apagado.png` |
| 14 | p15-05.png | 15 | Interruptor Solo mis casos, encendido. | `_common/funcionalidades/filtros/solo-mis-casos/fig-encendido.png` |
| 15 | p15-06.png | 15 | Filtro por tipo de emergencia. | `_common/funcionalidades/filtros/tipo-emergencia/fig.png` |
| 16 | p16-01.png | 16 | Lista de tipos de emergencia. | `_common/funcionalidades/filtros/tipo-emergencia/fig-lista.png` |
| 17 | p16-02.png | 16 | Filtro por origen del reporte. | `_common/funcionalidades/filtros/origen/fig.png` |
| 18 | p16-03.jpeg | 16 | Filtro por estado del incidente. | `_common/funcionalidades/filtros/estado/fig.png` |
| 19 | p16-04.png | 16 | Filtro por tipo de llamada. | `_common/funcionalidades/filtros/tipo-llamada/fig.png` |
| 20 | p17-01.png | 17 | Filtro por casos asociados. | `_common/funcionalidades/filtros/asociados/fig.png` |
| 21 | p17-02.png | 17 | Filtro por datos enriquecidos. | `_common/funcionalidades/filtros/enriquecidos/fig.png` |
| 22 | p17-03.png | 17 | Filtro por ubicación. | `_common/funcionalidades/filtros/ubicacion/fig.png` |
| 23 | p17-04.png | 17 | Filtro por duración de la llamada. | `_common/funcionalidades/filtros/duracion/fig.png` |
| 24 | p18-01.jpeg | 18 | Botones Aplicar y Cancelar de los filtros. | `_common/funcionalidades/filtros/fig-aplicar.png` |
| 25 | p18-02.png | 18 | Lista de casos con etiquetas de tipo de emergencia. | `_common/funcionalidades/seccion-incidentes/fig.png` |
| 26 | p19-02.jpeg | 19 | Incidente EN VIVO: grabación y monitoreo activo. | `_common/funcionalidades/llamada-entrante/fig-vivo.png` |
| 27 | p19-05.png | 19 | Estado EN VIVO del incidente. | `_common/funcionalidades/llamada-entrante/fig-estado.png` |
| 28 | p20-01.jpeg | 20 | Incidente finalizado, listo para gestión. | `_common/funcionalidades/llamada-entrante/fig-final.png` |
| 29 | p20-02.png | 20 | Abra el formulario | `_common/func/crear/boton.png` |
| 30 | p20-03.png | 20 | Diligencie el formulario | `_common/func/crear/formulario.png` |
| 31 | p20-04.png | 20 | Formulario Crear Incidente, completado. | `_common/funcionalidades/plataforma/fig-completado.png` |
| 32 | p21-01.png | 21 | Tarjeta de incidente con label y estado de color. | `_common/funcionalidades/general/fig.png` |
| 33 | p21-02.png | 21 | Vista detallada de un incidente, con sus cuatro pestañas. | `_common/funcionalidades/componentes/fig.png` |
| 34 | p21-03.png | 21 | Duración | `_common/func/pest1/duracion.png` |
| 35 | p22-01.jpeg | 22 | Transcripción | `_common/func/pest1/transcripcion.png` |
| 36 | p22-02.jpeg | 22 | Audio | `_common/func/pest1/audio.png` |
| 37 | p23-01.jpeg | 23 | Historial de ubicaciones | `_common/func/pest1/historial.png` |
| 38 | p23-02.jpeg | 23 | Casos asociados | `_common/func/pest1/asociados.png` |
| 39 | p23-04.jpeg | 23 | Resumen de Call AI del incidente. | `_common/funcionalidades/pestana-callai/fig.png` |
| 40 | p23-05.png | 23 | Resumen de Call AI, detalle. | `_common/funcionalidades/pestana-callai/fig-detalle.png` |
| 41 | p24-02.jpeg | 24 | Panel de despacho del incidente. | `_common/funcionalidades/pestana-despacho/fig.png` |
| 42 | p24-03.jpeg | 24 | Verifique la ubicación | `_common/func/desp/ubicacion-existente.png` |
| 43 | p24-08.jpeg | 24 | Busque la ubicación | `_common/func/desp/buscar-ubicacion.png` |
| 44 | p24-15.png | 24 | Agregue la ubicación | `_common/func/desp/agregar-ubicacion.png` |
| 45 | p24-16.jpeg | 24 | Seleccione las fuerzas | `_common/func/desp/seleccionar-fuerzas.png` |
| 46 | p25-01.jpeg | 25 | Elija una unidad disponible | `_common/func/desp/unidad-disponible.png` |
| 47 | p25-03.png | 25 | Revise la información del agente | `_common/func/desp/info-agente.png` |
| 48 | p25-04.jpeg | 25 | Filtre por tipo de agente | `_common/func/desp/filtrar-tipo.png` |
| 49 | p26-01.jpeg | 26 | Indique el estado del despacho | `_common/func/desp/en-camino.png` |
| 50 | p27-01.jpeg | 27 | Despache | `_common/func/desp/despachar.png` |
| 51 | p27-02.jpeg | 27 | Converse con los agentes | `_common/func/desp/chat.png` |
| 52 | p28-01.png | 28 | Agregue notas adicionales | `_common/func/desp/notas.png` |
| 53 | p28-03.jpeg | 28 | Ponga al agente En Sitio | `_common/func/desp/en-sitio.png` |
| 54 | — | — | Prescinda de un agente | `_common/func/desp/prescindir.png` |
| 55 | — | — | Finalice el caso | `_common/func/desp/finalizar.png` |
| 56 | — | — | Formulario del reporte: Detalles en Vía. | `_common/funcionalidades/reporte-via/fig.png` |
| 57 | — | — | Formulario del reporte: Detalles de Lesionados. | `_common/funcionalidades/reporte-lesionados/fig.png` |
| 58 | — | — | Formulario del reporte: Comentarios Generales. | `_common/funcionalidades/reporte-comentarios/fig.png` |
| 59 | — | — | Luz roja titilante en el ítem de Reporte. | `_common/funcionalidades/reporte-actualizacion/fig-luz.png` |
| 60 | — | — | Despliegue el ítem de Reporte | `_common/func/act/flecha.png` |
| 61 | — | — | Despliegue la placa del agente | `_common/func/act/placa.png` |
| 62 | — | — | Entre a gestionar la actualización | `_common/func/act/gestionar.png` |
| 63 | — | — | Modal Información recibida del agente, para aceptar o rechazar cambios. | `_common/funcionalidades/reporte-actualizacion/fig-modal.png` |

## security-dashboard

**35 imágenes extraídas contra 34 slots (sobran 1).**
El PDF no tiene epígrafes, así que el orden es el único indicio y con conteos
distintos se desfasa. La columna *Candidata* es una **propuesta por orden**:
verifíquela imagen por imagen; en cuanto una no corresponda, todas las de abajo
están corridas.

| # | Candidata | Pág. | Epígrafe del slot | Guardar como |
|---|---|---|---|---|
| 1 | p30-01.png | 30 | Vista general del Security Dashboard. | `_common/dashboard/fig.png` |
| 2 | p30-02.jpeg | 30 | Filtros | `_common/dashboard/area/filtros.png` |
| 3 | p30-03.png | 30 | Ventanas de Datos | `_common/dashboard/area/ventanas.png` |
| 4 | p30-04.png | 30 | Mapa de Calor | `_common/dashboard/area/mapa.png` |
| 5 | p30-07.jpeg | 30 | Filtro de rango de tiempo del dashboard. | `_common/dashboard/filtros/rango/fig.png` |
| 6 | p31-01.png | 31 | Filtro de ubicación por Departamento y Ciudad. | `_common/dashboard/filtros/ubicacion/fig-depto.png` |
| 7 | p31-02.png | 31 | Filtro de ubicación por Zona, Comuna y Barrio. | `_common/dashboard/filtros/ubicacion/fig-zona.png` |
| 8 | p31-03.png | 31 | Filtro por tipo de emergencia. | `_common/dashboard/variables/emergencia/fig.png` |
| 9 | p31-04.png | 31 | Filtro por fuerza de respuesta. | `_common/dashboard/variables/fuerzas/fig.png` |
| 10 | p31-05.png | 31 | Filtro por tipo de finalización. | `_common/dashboard/variables/finalizacion/fig.png` |
| 11 | p31-06.png | 31 | Filtro por tipo de movilidad. | `_common/dashboard/variables/movilidad/fig.png` |
| 12 | p32-01.png | 32 | Filtro por tiempos de gestión. | `_common/dashboard/filtros/tiempos/fig.png` |
| 13 | p32-02.png | 32 | Ventanas de datos del dashboard. | `_common/dashboard/ventanas/fig.png` |
| 14 | p32-03.png | 32 | Cerrar una ventana o widget del dashboard. | `_common/dashboard/ventanas/quitar/fig.png` |
| 15 | p33-01.png | 33 | Menú de Widgets para restaurar ventanas. | `_common/dashboard/ventanas/fig-widgets.png` |
| 16 | p33-02.png | 33 | Widget restaurado en el dashboard. | `_common/dashboard/ventanas/fig-restaurado.png` |
| 17 | p34-01.png | 34 | Botón de exportación del dashboard. | `_common/dashboard/ventanas/exportar/fig.png` |
| 18 | p34-02.png | 34 | Total de Emergencias | `_common/dashboard/widget/total.png` |
| 19 | p34-03.png | 34 | Tiempo Promedio de Respuesta | `_common/dashboard/widget/promedio-respuesta.png` |
| 20 | p34-04.png | 34 | Casos sin despacho | `_common/dashboard/widget/sin-despacho.png` |
| 21 | p35-01.png | 35 | Tiempo Promedio de Llegada | `_common/dashboard/widget/promedio-llegada.png` |
| 22 | p35-02.png | 35 | Tiempo de respuesta | `_common/dashboard/widget/tiempo-respuesta.png` |
| 23 | p35-03.png | 35 | Cantidad de Emergencias | `_common/dashboard/widget/cantidad.png` |
| 24 | p35-04.png | 35 | Emergencia por categoría | `_common/dashboard/widget/categoria.png` |
| 25 | p36-01.png | 36 | Tipos de Casos Frecuentes | `_common/dashboard/widget/frecuentes.png` |
| 26 | p36-02.png | 36 | Filtro de Variables de Gestión para los tipos de casos frecuentes. | `_common/dashboard/widgets/fig-modificar.png` |
| 27 | p36-03.png | 36 | Mapa de calor de casos en el dashboard. | `_common/dashboard/mapa-calor/fig.png` |
| 28 | p37-01.png | 37 | Control de opacidad del mapa de casos. | `_common/dashboard/mapa-calor/fig-opacidad.png` |
| 29 | p37-02.png | 37 | Mapa de casos maximizado. | `_common/dashboard/mapa-calor/fig-maximizado.png` |
| 30 | p38-01.jpeg | 38 | Alternar entre Mapa de calor y Marcadores. | `_common/dashboard/mapa-calor/fig-modo.png` |
| 31 | p38-04.jpeg | 38 | Vista de casos individuales, con marcadores, en el mapa. | `_common/dashboard/mapa-calor/fig-marcadores.png` |
| 32 | p38-05.jpeg | 38 | Botón Los Casos para el modo lista. | `_common/dashboard/lista/fig-boton.png` |
| 33 | p39-01.png | 39 | Visualización de casos en modo lista. | `_common/dashboard/lista/fig-lista.png` |
| 34 | p39-02.png | 39 | Detalle de un caso seleccionado en la lista. | `_common/dashboard/lista/fig-detalle.png` |

Sobrantes sin slot: p39-03.jpeg

## fuerzas-en-campo

**31 imágenes extraídas contra 30 slots (sobran 1).**
El PDF no tiene epígrafes, así que el orden es el único indicio y con conteos
distintos se desfasa. La columna *Candidata* es una **propuesta por orden**:
verifíquela imagen por imagen; en cuanto una no corresponda, todas las de abajo
están corridas.

| # | Candidata | Pág. | Epígrafe del slot | Guardar como |
|---|---|---|---|---|
| 1 | p40-01.jpeg | 40 | Interfaz principal: zonas Mapa, Barra Superior y Agentes. | `_common/fuerzas/fig.png` |
| 2 | p40-02.jpeg | 40 | Barra superior del módulo. | `_common/fuerzas/barra/fig.png` |
| 3 | p41-01.jpeg | 41 | Módulo de Agentes. | `_common/fuerzas/agentes/fig.png` |
| 4 | p41-05.png | 41 | Filtro de estados y turno de los agentes. | `_common/fuerzas/agentes/filtro/fig.png` |
| 5 | p42-01.jpeg | 42 | Acceso al perfil desde la lista de agentes. | `_common/fuerzas/perfil/fig-acceso.png` |
| 6 | p42-02.jpeg | 42 | Tarjeta rápida del agente. | `_common/fuerzas/perfil/fig-tarjeta.png` |
| 7 | p42-04.jpeg | 42 | Perfil del agente. | `_common/fuerzas/perfil/fig-perfil.png` |
| 8 | p42-05.jpeg | 42 | Ubicación del agente en el mapa. | `_common/fuerzas/perfil/fig-ubicacion.png` |
| 9 | p43-01.jpeg | 43 | Pestaña Turnos del agente. | `_common/fuerzas/perfil/fig-turnos.png` |
| 10 | p43-02.jpeg | 43 | Pestaña Asignar del perfil del agente. | `_common/fuerzas/perfil/fig-asignar.png` |
| 11 | p43-03.png | 43 | Confirmación de despacho del caso al agente. | `_common/fuerzas/perfil/fig-confirmacion.png` |
| 12 | p43-04.jpeg | 43 | Creación de una tarea desde el perfil del agente. | `_common/fuerzas/perfil/fig-tarea.png` |
| 13 | p44-01.png | 44 | Módulo de Operaciones: historial de turnos. | `_common/fuerzas/operaciones/fig.png` |
| 14 | p44-02.png | 44 | Filtro de rango de tiempo en Operaciones. | `_common/fuerzas/operaciones/filtro/fig.png` |
| 15 | p44-03.png | 44 | Selección de rango de fechas en el filtro. | `_common/fuerzas/operaciones/filtro/fig-rango.png` |
| 16 | p44-04.jpeg | 44 | Resumen de actividad del turno seleccionado. | `_common/fuerzas/operaciones/resumen/fig.png` |
| 17 | p44-05.jpeg | 44 | Recorrido del turno en el mapa. | `_common/fuerzas/operaciones/resumen/fig-recorrido.png` |
| 18 | p45-01.jpeg | 45 | Polígono del incidente en el mapa. | `_common/fuerzas/poligono/fig-incidente.png` |
| 19 | p45-02.jpeg | 45 | Polígono de la tarea en el mapa. | `_common/fuerzas/poligono/fig-tarea.png` |
| 20 | p45-04.jpeg | 45 | Acceso a Call AI desde el historial de incidentes. | `_common/fuerzas/callai/fig-hist-incidentes.png` |
| 21 | p45-05.jpeg | 45 | Acceso a Call AI del incidente desde la ubicación en el mapa. | `_common/fuerzas/callai/fig-mapa-incidente.png` |
| 22 | p45-08.jpeg | 45 | Resumen de Call AI del incidente. | `_common/fuerzas/callai/fig-resumen-incidente.png` |
| 23 | p45-09.jpeg | 45 | Acceso a Call AI desde el historial de tareas. | `_common/fuerzas/callai/fig-hist-tareas.png` |
| 24 | p46-01.png | 46 | Acceso a Call AI de la tarea desde la ubicación en el mapa. | `_common/fuerzas/callai/fig-mapa-tarea.png` |
| 25 | p46-02.png | 46 | Resumen de Call AI de la tarea. | `_common/fuerzas/callai/fig-resumen-tarea.png` |
| 26 | p46-03.png | 46 | Opciones del módulo Añadir: Nuevo Incidente y Nueva Tarea. | `_common/fuerzas/anadir/fig.png` |
| 27 | p46-04.png | 46 | Formulario para crear un nuevo incidente. | `_common/fuerzas/anadir/incidente/fig.png` |
| 28 | p46-05.png | 46 | Confirmación de incidente creado exitosamente. | `_common/fuerzas/anadir/incidente/fig-confirmacion.png` |
| 29 | p46-06.png | 46 | Formulario para crear una nueva tarea. | `_common/fuerzas/anadir/tarea/fig.png` |
| 30 | p46-07.png | 46 | Ícono para retornar al Home de Broadsec. | `_common/fuerzas/home/fig.png` |

Sobrantes sin slot: p47-01.jpeg

## call-ai

Conteos iguales (3): el emparejamiento por orden ya se aplicó y está entregado.

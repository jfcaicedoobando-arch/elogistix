# Arreglo: no se puede guardar un embarque LCL al editarlo

## Qué está pasando

Valeria intentó guardar el embarque `ELIMP…` (id `ba95ca1f…`) y recibió
"Faltan datos de contenedores · Cada contenedor requiere número y tipo. Revisa el paso 2."

Revisé el embarque en la base: es **Marítimo LCL**, con una sola fila de contenedor
automática (`tipo_contenedor = "LCL"`, número vacío) generada al convertir la cotización.

En LCL la carga va consolidada: el agente no asigna número de contenedor. Todo el resto
del sistema ya lo trata así (el paso 2 no pide contenedores en LCL, el avance de estado
tampoco, y la lista muestra "LCL · sin contenedor asignado"). La única pieza que no
conoce esa excepción es la validación del guardado, así que pide un dato que la pantalla
nunca deja capturar: queda atrapada en un círculo, como un candado cuya llave no existe.

Nota aparte: este embarque tampoco tiene **naviera**, y el guardado sí la exige. Eso sí
es capturable en el paso 2, así que después del arreglo el usuario podrá completarla y
guardar.

## Qué se va a cambiar

1. La validación de contenedores al guardar dejará de exigir número y tipo cuando el
   servicio sea **LCL**, igual que ya hace el paso 2.
2. Se conserva sin cambios la validación del formato ISO 6346 para números que **sí**
   tengan contenido (si el agente informa el contenedor, debe ser válido).
3. FCL sigue exigiendo número y tipo en cada contenedor, sin cambios.
4. Se agregan casos de prueba enfocados para LCL (guarda) y FCL (sigue bloqueando).

## Detalle técnico

- `src/features/embarques/hooks/useEditarEmbarqueWizard.helpers.ts`:
  `validarContenedoresMaritimo(modo, contenedores)` recibe además el `tipoServicio`;
  si es `"LCL"` se omite el bloqueo por número/tipo faltante y sólo se evalúa ISO 6346
  sobre los números no vacíos.
- `src/features/embarques/hooks/useEditarEmbarqueWizard.save.ts`: pasa
  `methods.getValues('tipoServicio')` a la validación. Sin otros cambios en el flujo de
  guardado, diff de bitácora, concurrencia (`expectedUpdatedAt`) ni sincronización de
  contenedores hijos.
- Pruebas: `src/features/embarques/hooks/__tests__/` (archivo de helpers del wizard de
  edición) con casos LCL número vacío → `null`, LCL número inválido → error ISO,
  FCL número vacío → error.
- Sin migraciones de base, sin cambios de permisos, sin nuevos módulos.

## Validación

Pruebas enfocadas de los helpers del wizard de edición + typecheck focalizado.
CI completo, RLS y E2E quedan para GitHub Actions.

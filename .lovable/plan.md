## Objetivo
Agregar un buscador/filtro **dentro** de la lista de conceptos de costo pendientes en el modal "Capturar factura de proveedor", para encontrar rápido el concepto/embarque a vincular cuando el proveedor trae muchos costos precargados.

## Contexto
`VincularEmbarqueSection.tsx` muestra los `conceptos_costo` pendientes agrupados por embarque (`agruparPorEmbarque`). Hoy no hay forma de filtrar: si el proveedor tiene 30–50 conceptos hay que scrollear.

En el paso anterior (v13.307.9) agregué un buscador de **otro** embarque ad-hoc. No era lo pedido: se elimina.

## Cambio propuesto

### 1) Revertir el bloque ad-hoc agregado en v13.307.9
En `VincularEmbarqueSection.tsx`:
- Quitar el `<div className="rounded-md border border-dashed …">` con el botón "Buscar otro embarque" y su `SugerirEmbarqueBlock` embebido.
- Quitar el estado `mostrarBusqueda` y el import de `Search`.
- El componente vuelve a comportarse como antes cuando hay conceptos precargados (sólo lista), y sigue mostrando `SugerirEmbarqueBlock` cuando no hay ninguno (caso vacío).

### 2) Añadir filtro sobre la lista de conceptos pendientes
En `VincularEmbarqueSection.tsx`:
- Nuevo estado local `filtro: string`.
- Input de búsqueda arriba del contenedor `max-h-72 overflow-y-auto`, con ícono lupa y placeholder "Filtrar por concepto, expediente o monto…".
- Botón "Sólo marcados" (toggle) para reducir la lista a los conceptos ya seleccionados (útil para revisar antes de guardar).
- Lógica de filtrado (memoizada) que aplica sobre `grupos`:
  - Si `filtro` tiene texto: se conservan los `items` cuyo `concepto` o `monto` (comparado como string) o cuyo `expediente` del grupo contenga el término (case-insensitive, `trim`).
  - Si `soloMarcados` está activo: se conservan sólo los `items` con `seleccion[it.id]`.
  - Los grupos que quedan sin items se ocultan.
- Contador secundario: `"Mostrando X de Y conceptos"` debajo del input cuando hay filtro/toggle activo.
- Botón "Limpiar" que resetea `filtro` y `soloMarcados` cuando alguno esté activo.
- Estado vacío filtrado: mensaje "Ningún concepto coincide con el filtro" dentro del contenedor.

### 3) Helper puro
Extraer `filtrarGrupos(grupos, { texto, soloMarcados, seleccion })` en `vincularEmbarqueHelpers.ts` con test unitario nuevo en `__tests__/vincularEmbarqueHelpers.test.ts` (3–4 casos: sin filtro, por concepto, por expediente, sólo marcados). Mantiene la función pura y facilita cumplir Power-of-10.

## Fuera de alcance
- No se toca `SugerirEmbarqueBlock` ni el flujo ad-hoc.
- No se cambia el submit ni servicios (`useNuevaFacturaProveedorForm`, `vincularFacturaAConceptos`).
- No se agrega paginación server-side; el filtro es puramente cliente sobre lo que ya trae `useConceptosCostoAbiertos` (limit 200).

## Archivos tocados
- `src/features/cxp/components/VincularEmbarqueSection.tsx` — quitar bloque ad-hoc, agregar input + toggle + memoización.
- `src/features/cxp/components/vincularEmbarqueHelpers.ts` — nuevo `filtrarGrupos`.
- `src/features/cxp/components/__tests__/vincularEmbarqueHelpers.test.ts` — casos del nuevo helper.
- `src/constants/appVersion.ts` → `13.307.10`.
- `CHANGELOG.md` — entrada nueva.

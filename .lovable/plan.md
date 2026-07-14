# Auditoría — Detalle de embarque (Full HD, sidebar abierto)

Ruta auditada: `/embarques/8e3f6f55-…` — ELIMP00295 (Marítimo · Confirmado · FCL, 6 contenedores).
Resolución: **1920 × 1080** con sidebar expandido (área de contenido ≈ 1618 px).

## Hallazgos priorizados

### 🔴 Alta prioridad (impacto directo en uso)

1. **Datos duplicados entre header y "Datos Generales"**
   - El chip del header ya muestra `Marítimo · Confirmado · Proforma`, pero la card **Datos Generales** repite `Modo → Marítimo` con icono.
   - El campo `Contenedor` en **Ruta y Transporte** muestra sólo el primero (`WHSU8866153 (40HC)`) aunque hay 6 abajo en la tabla. Es confuso y falso.

2. **Tabla de contenedores con columnas ruidosas**
   - `BL House` = "—" en las 6 filas → columna vacía siempre para FCL Master.
   - `Peso (kg)` = 9,683 en todas las filas; `Volumen` = 68; `Piezas` ≈ 1547 → repetición visual sin señal.
   - Con 6 filas idénticas la tabla ocupa ~450 px verticales sin aportar información diferencial.

3. **ETD / ETA como "-" sin acción**
   - El embarque está `Confirmado` y el siguiente paso es `En Tránsito`, pero ETD/ETA aparecen como guion sin CTA para capturarlos. Fricción operativa.

4. **"Origen de costos" duplica la tarifa cotizada y la aplicada**
   - Cuando la decisión es `Sin cambios` y aparece la etiqueta `(misma)`, se muestran dos tarjetas idénticas. Doble lectura innecesaria.

### 🟡 Media prioridad (densidad y jerarquía)

5. **11 pestañas sin agrupación** (`Resumen, Tracking, Documentos, Costos, Demoras y Garantías, Seguros, Facturación, Conciliación, P&L, Cierre, Notas y Actividad`) — al borde del overflow y difícil de escanear. Falta agrupación mental (Operación / Financiero / Docs).

6. **Stepper de 8 pasos ocupa ~120 px verticales** con mucho aire entre nodos en 1920. Se puede compactar a ~72 px y aún leerse bien.

7. **Cards Shipper / Consignatario están sobredimensionadas** — una sola línea de contenido en un contenedor de ~130 px de alto. Se puede colapsar a un renglón compacto tipo definición.

8. **Densidad general baja** — las filas de las cards `Datos Generales` y `Ruta y Transporte` tienen ~44 px cada una, forzando scroll para 8 campos. Reducir a ~32 px cabe todo sin scroll en 1080.

9. **Botón `Eliminar` compite con el CTA principal** — mismo peso visual que `Avanzar a En Tránsito`. Debería moverse a un menú overflow `⋯` junto con `Duplicar` y `Compartir` (secundarias/destructivas).

### 🟢 Baja prioridad (consistencia)

10. **Inconsistencia tipográfica en títulos**: `Datos Generales` (Title Case) vs `Origen de costos` (Sentence case). Estandarizar a Sentence case.

11. **Placeholders mixtos**: `-` (Ruta y Transporte) vs `—` (tabla contenedores). Estandarizar a `—` con estilo `text-muted-foreground`.

12. **Campo `Creador / Responsable`**: mezcla dos conceptos en una etiqueta con slash. Separar en dos filas o renombrar a `Responsable operativo`.

13. **Sidebar**: el email del usuario en el footer se trunca (`hector@lopezbenavides.…`) — sólo cosmético.

## Plan de mejora (batches)

### Batch A — Limpieza de header y cards (alto impacto, bajo riesgo)
- `EmbarqueDetalleHeader.tsx`: mover `Duplicar`, `Compartir`, `Eliminar` a un `DropdownMenu` (`⋯`) a la derecha del CTA `Avanzar`.
- `SeccionDatosGenerales.tsx`: eliminar la fila `Modo` (ya está en el chip del header).
- `SeccionRutaTransporte.tsx`: reemplazar `Contenedor` (singular, primer registro) por un resumen tipo `6 × 40HC` cuando hay >1; ocultar el campo cuando existe la tabla de contenedores abajo.
- Estandarizar placeholders a `—` en todos los campos vacíos.

### Batch B — Tabla de contenedores más útil
- Ocultar la columna `BL House` cuando todas las filas están vacías (heurística `hasAnyBLHouse`).
- Cuando `Peso`, `Volumen` o `Piezas` son iguales en todas las filas, mostrar un chip resumen arriba (`Todos: 9,683 kg · 68 m³ · 1,547 pzs`) y contraer esas columnas.
- Densidad `sm` en `DataTable` para esta vista (row height 36 px).

### Batch C — ETD/ETA accionables
- En `SeccionRutaTransporte.tsx`, cuando `ETD` o `ETA` son `null` y el embarque está en `Confirmado` o `En Tránsito`, mostrar un botón fantasma inline `+ Capturar ETD` que abra el modal existente de edición focalizado en el campo.

### Batch D — Origen de costos condensado
- `OrigenDeCostosCard.tsx`: cuando `decision === 'sin_cambios'` y tarifa cotizada = aplicada, renderizar una sola tarjeta con badge `Sin cambios` en lugar de dos.

### Batch E — Densidad y compactación
- Reducir padding vertical de filas en `KeyValueRow` de `py-3` a `py-2` (32 px de alto).
- Compactar el `EmbarqueProgressStepper` a `h-16` con nodos de 28 px.
- Colapsar `Shipper` y `Consignatario` a formato `dt/dd` en dos columnas dentro de una sola card `Partes`.

### Batch F — Navegación de pestañas
- Explorar agrupar las 11 pestañas en 3 clusters con separador visual (Operación · Financiero · Documentación & Notas) o convertir a `SegmentedTabs` con dropdown para las menos usadas (`Seguros`, `Conciliación`, `Cierre`).
- Este batch requiere validación con el usuario antes de tocar; se puede dejar para un sprint posterior.

## Detalles técnicos

- Archivos previstos: `src/features/embarques/components/EmbarqueDetalleHeader.tsx`, `SeccionDatosGenerales.tsx`, `SeccionRutaTransporte.tsx`, `ContenedoresTable.tsx`, `OrigenDeCostosCard.tsx`, `EmbarqueProgressStepper.tsx`, y hooks `useEmbarqueResumen`.
- Todos los cambios son de presentación (frontend puro), sin migraciones ni edición de RPC.
- Añadir tests de regresión donde ya exista suite (`EmbarqueStatusChip.test.tsx` como referencia): render vacío, con >1 contenedor, con ETD null, con decisión `sin_cambios`.
- Bump `APP_VERSION` (13.300.13) y entrada en `CHANGELOG.md`.
- Cumplir Power of 10: componentes ≤200 líneas, cleanup en cualquier `useEffect`, sin `any`, sin inline styles.

## Fuera de alcance
- Rediseño de las pestañas Costos/P&L/Facturación (contenido interno).
- Cambios de esquema o RLS.
- Modo oscuro (ya se maneja vía tokens semánticos existentes).

## Recomendación
Aplicar **Batches A + B + C + D** en un solo sprint (alto ROI, bajo riesgo). Los batches **E** (densidad) y **F** (pestañas) mejor validarlos visualmente con el usuario antes de ejecutar.

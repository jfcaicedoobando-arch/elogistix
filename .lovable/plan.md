## Auditoría v8.99.20 — Fase 9 (Pulido final)

Tras la fase 8 (Portal y Admin), una nueva pasada detecta inconsistencias menores en módulos operativos: la pestaña de **Tracking**, la pestaña de **Notas**, la pestaña de **Costos** del embarque, y un par de detalles en dashboards. Son ajustes pequeños, todos enfocados a consistencia con el resto de la app ya pulida.

### Hallazgos

1. **Tracking de embarque (`TabTracking.tsx`)**
   - El campo "usuario" muestra el email crudo (ej. `juan.perez@empresa.mx`) en lugar del nombre legible.
   - No hay tooltip con la fecha absoluta ni formato relativo en eventos antiguos.

2. **Notas del embarque (`TabNotas.tsx`)**
   - Mismo problema: `nota.usuario` se muestra como email crudo en cada nota.
   - La fecha usa `toLocaleString` directo en vez del helper `formatDate` centralizado.

3. **TabCostos del embarque (`TabCostos.tsx`)**
   - Tablas sin alineación a la derecha en columnas numéricas (P. Unitario, Total, Monto).
   - Sin estado vacío cuando no hay conceptos cargados (se ve la tabla vacía sin mensaje).
   - Nombres de proveedor sin `toTitleCase`.
   - Falta `tabular-nums` en las celdas monetarias.

4. **Dashboards (menor)**
   - `EmbarquesActivosTable`: la columna "Contenedor" no tiene `whitespace-nowrap`, puede romperse en viewport pequeño.
   - El header truncado de "Embarques activos — próximo mes (Mayo)" puede desbordarse en móvil (no usa `flex-wrap`).

### Cambios propuestos

**Normalización de usuario y fechas**
- En `TabTracking.tsx` y `TabNotas.tsx`: aplicar `nombreDesdeEmail(ev.usuario)` para mostrar nombre legible, con `title={ev.usuario}` como tooltip del email completo.
- En `TabNotas.tsx`: reemplazar `new Date(...).toLocaleString(...)` por `formatDate(nota.fecha, "dd/MM/yyyy HH:mm")`.

**TabCostos**
- Agregar `className="text-right tabular-nums"` y `headerClassName="text-right"` a columnas P. Unitario, Total y Monto.
- Aplicar `toTitleCase` al `proveedor_nombre`.
- Mostrar `EmptyState` cuando `conceptosVenta.length === 0` o `conceptosCosto.length === 0` ("Sin conceptos registrados").

**Dashboard responsive**
- En `EmbarquesActivosTable.tsx`: `whitespace-nowrap` en columna Contenedor; `flex-wrap` en el `CardTitle` del header.

**Changelog**
- Agregar entrada `v8.99.20` en `src/content/changelog/v8/chunks/0.ts` documentando el pulido.

### Archivos a editar
- `src/components/embarque/TabTracking.tsx`
- `src/components/embarque/TabNotas.tsx`
- `src/components/embarque/TabCostos.tsx`
- `src/components/dashboard/EmbarquesActivosTable.tsx`
- `src/content/changelog/v8/chunks/0.ts`

### Detalles técnicos
- `nombreDesdeEmail` y `toTitleCase` ya existen en `src/lib/formatters/index.ts`.
- `EmptyState` ya está disponible en `src/components/empty/`.
- Sin cambios de DB, sin cambios de lógica de negocio — solo capa de presentación.

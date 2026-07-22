
# Mejora de estatus y badges — Tabla de facturas de proveedor

## Diagnóstico (qué está mal hoy)

En `cxpColumns.tsx` la fila muestra **dos columnas de estado** — `Estatus` y `Aprobación` — que se pisan entre sí:

| Situación real | Estatus | Aprobación | Problema |
|---|---|---|---|
| Recién capturada | "Por aprobar" | "Por aprobar" | Redundante |
| Rechazada por finanzas | "Rechazada" | "Rechazada" | Redundante |
| Aprobada, con abono, ya vencida | "Vencida" | "Aprobada" | Se **pierde** que hay pago parcial |
| Aprobada, con abono, aún vigente | "Parcial" | "Aprobada" | No se ve cuántos días faltan |
| Cancelada por SAT vs. cancelada manual | "Cancelada" | — | No distingue origen |
| NC aplicada reduce saldo | (invisible) | — | No hay señal visual |
| UUID verificado ante SAT | (invisible) | — | No hay señal visual |

Además la prioridad en `clasificar()` **enmascara** información: una factura parcial + vencida sólo dice "Vencida", perdiendo el hecho de que ya hay abono. Y los colores actuales dependen sólo del `statusRegistry` genérico, sin acento operativo (rojo para atraso, ámbar para "por vencer", verde para pagada).

## Objetivo

Un **solo pill principal** por fila (estado de vida del documento) + **chips secundarios** opcionales que sumen contexto financiero/fiscal sin ocupar otra columna. Igual densidad, más información, menos redundancia.

## Modelo de estado propuesto

**Estado principal** (uno solo, mutuamente excluyente, en orden de prioridad):

```text
Borrador → Por aprobar → Rechazada → Cancelada
                       ↘ Vigente ↔ Por vencer ↔ Vencida → Pagada
```

- `Borrador` — captura incompleta (gris)
- `Por aprobar` — esperando aprobación (ámbar, ícono reloj)
- `Rechazada` — con `motivo_rechazo` en tooltip (rojo suave, ícono X)
- `Cancelada` — con sub-tipo en tooltip: "por SAT" si `uuid_estatus_sat = 'Cancelado'`, si no "manual" (gris tachado)
- `Vigente` — aprobada, sin atraso, sin abonos (azul suave)
- `Por vencer` — aprobada, ventana ≤5 días (ámbar claro)
- `Vencida` — días vencido > 0 (rojo)
- `Pagada` — saldo ≤ 0.01 (verde)

**Chips secundarios** (0..N, sólo si aplican, tamaño `text-2xs h-4`):

- `Parcial · 45%` — cuando `pagado > 0` y `saldo > 0` (barra fina o %). Se muestra **incluso si el estado principal es "Vencida"**, resolviendo la pérdida de información actual.
- `+N d` — días de atraso cuando estado = Vencida (chip rojo compacto, reemplaza la columna "Días").
- `NC $X` — cuando hay notas de crédito aplicadas (chip azul, tooltip: "Nota de crédito aplicada").
- `SAT ✓` — cuando `uuid_verificado = true` (chip verde outline muy discreto).
- `Prog. DD/MM` — cuando `fecha_programada_pago` (reutiliza el chip actual, pero pegado al estado en vez de columna aparte).

## Impacto en columnas

Antes: `Folio · Folio prov · Proveedor · Emisión · Vencimiento · Prog. pago · Días · Mon · Total · Pagado · Saldo · Estatus · Aprobación` (13)

Después: `Folio · Folio prov · Proveedor · Emisión · Vencimiento · Mon · Total · Pagado · Saldo · Estado` (10)

- Se **elimina** la columna `Aprobación` (Por aprobar/Rechazada quedan absorbidas en el estado principal).
- Se **elimina** la columna `Días` (chip `+N d` dentro del estado).
- Se **elimina** la columna `Prog. pago` (chip dentro del estado).
- La columna `Estado` se ensancha a `w-[180px]` para hospedar pill + chips en dos líneas apiladas.

En pantallas <xl la fila queda visiblemente más limpia; en xl+ hay más aire para el Saldo.

## Ajustes en la lógica

- `clasificar()` en `proveedorFacturas.helpers.ts`: mantener el mismo estado primario, pero **no** dejar que "Vencida" o "Por vencer" absorba "Parcial" — el `Parcial` se devuelve aparte como *flag*, no como estado primario.
- Extender `FacturaCxP` con un `flags: { parcial, ncAplicada, satVerificada, diasVencido, programado, canceladaPor: 'sat'|'manual'|null }` calculado en `mapJoinedRow`.
- `statusRegistry.factura_cxp`: mapear cada estado a variante semántica explícita (success/warning/destructive/info/muted) en lugar de heredar la variante por defecto — asegura consistencia con el resto de la app (facturas de venta, embarques).

## Componentes nuevos / tocados

- **Nuevo** `src/features/cxp/components/EstadoFacturaCxPCell.tsx` — pill principal + fila de chips, con tooltip único que consolida: motivo de rechazo, sub-tipo de cancelación, saldo, días vencido, NC.
- **Editado** `cxpColumns.tsx` — quita 3 columnas, monta el nuevo cell.
- **Editado** `proveedorFacturas.helpers.ts` — devuelve `flags`.
- **Editado** `statusRegistry.ts` — variantes semánticas por estado de `factura_cxp`.
- **Editado** filtros existentes en `CxpFiltros.tsx` — el filtro por "Aprobación" desaparece del combobox (ya vive en Estatus).

## Notas técnicas

- No cambia el esquema SQL — todo se deriva client-side desde datos ya cargados.
- Preservar los `data-testid` actuales de los tests de columnas; agregar `data-testid="cxp-estado-cell"` en el nuevo componente.
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md` (regla del proyecto).
- Tests: agregar `EstadoFacturaCxPCell.test.tsx` cubriendo las 6 combinaciones críticas (Vencida+Parcial, Cancelada SAT vs manual, Rechazada con motivo, Pagada con NC, Por vencer con Prog., Borrador puro).

## Fuera de alcance

- KPIs superiores (`CxpKpiCards`) — mantener como están.
- Vista Aging — usa columnas propias.
- Cambios de flujo/permisos de aprobación.

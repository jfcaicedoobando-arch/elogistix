## Objetivo

El header de `/embarques/:id` muestra hoy hasta 6 badges (`Estado`, `Modo`, `Proforma`, `Admin`, `Cobro cliente`, `Generado desde COT-…`) que compiten con el título y con el nombre del cliente. Vamos a consolidarlos en **un solo chip de estado unificado** y convertir la referencia a cotización en un link discreto de texto.

## Estado final propuesto

```text
ELIMP00287  [ En Tránsito · Marítimo · Proforma · Por cobrar ]
Indimex Trading · Cotización origen: COT-2026-0087
```

- **Un solo chip compuesto** al lado del expediente, con separadores `·`.
- **Modo** (Marítimo/Aéreo/Terrestre) sigue con su icono al inicio del chip.
- **Estado operativo** (`En Tránsito`) mantiene el color semántico actual como fondo del chip (via `getEstadoColor`).
- **Sub-estado financiero** en el chip: se resuelve al más avanzado entre proforma y cobro:
  - `Sin proforma` (warning) si `tiene_proforma=false`
  - `Proforma` (neutral) si hay proforma pero cobro es `pendiente` o `null`
  - `Cobro parcial` si `cobro_cliente_status="parcial"`
  - `Cobrado` (success) si `cobro_cliente_status="pagado"`
- **Badge admin** (`EmbarqueBadgeAdmin`) queda fuera del chip pero visible al lado, sólo para admins (sin cambio de lógica).
- **Cotización origen** deja de ser badge: pasa a texto pequeño gris junto al nombre del cliente, como `<Link>` subrayado al pasar el mouse. Cubre los 3 casos existentes (link a COT-…, no disponible, sin cotización).

## Cambios

### `src/features/embarques/components/EmbarqueStatusChip.tsx` (nuevo)
- Componente puro que recibe `estado`, `modo`, `tieneProforma`, `cobroStatus`.
- Renderiza un solo `Badge` con `getEstadoColor(estado)` de fondo, `ModoIcon` al inicio, y las secciones separadas por `·`.
- Helper interno `resolveFinancieroLabel()` para elegir el sub-estado más avanzado.

### `src/features/embarques/components/EmbarqueDetalleHeader.tsx`
- Sustituye las 3 líneas de badges (`Estado`, `Modo`, `Proforma`, `Cobro`) por `<EmbarqueStatusChip …>`.
- Mueve `EmbarqueBadgeAdmin` para que quede al lado del chip (sólo se muestra si aplica).
- Elimina el bloque `<div className="mt-1.5">…</div>` con el badge de cotización.
- Nombre del cliente + link discreto quedan en la misma línea:
  `Indimex Trading · Cotización origen: <Link>COT-2026-0087</Link>`.
- Los 3 estados del link:
  - Con folio → `Link` a `/cotizaciones/:id` con `hover:underline`.
  - Sin folio (cotización borrada) → texto `Cotización origen no disponible` en muted.
  - Sin `cotizacion_id` → texto `Sin cotización vinculada` en warning muted (no badge).

### `src/features/embarques/components/__tests__/EmbarqueStatusChip.test.tsx` (nuevo)
- Cubre las 4 combinaciones del sub-estado financiero + render de icono según modo.

### `CHANGELOG.md` + `src/constants/appVersion.ts`
- Nueva entrada `## [13.300.12] - 2026-07-14` describiendo la consolidación.
- Bump `APP_VERSION` a `13.300.12`.

## Fuera de alcance

- Lógica de `tiene_proforma`, `cobro_cliente_status`, `getEstadoColor`, permisos y acciones del header no cambian.
- No se toca `EmbarqueBadgeAdmin`, `ProformaBadge` ni `CobroClienteBadge` (quedan como componentes reutilizables por si otro lugar los usa; sólo dejan de renderizarse en el header).

## Detalles técnicos

- `Badge` de shadcn acepta children; el chip compuesto se implementa con `<Badge>` + `<span>` internos separados por un `<span aria-hidden>·</span>` con `opacity-60`.
- El color de fondo del chip viene de `getEstadoColor(estado)` (ya usa tokens semánticos, no colores hardcodeados).
- El sub-estado financiero se pinta con un texto discreto dentro del mismo chip; si es `Cobrado` se añade un `CheckCircle2` de 12px para reforzar.
- El link de cotización usa `text-xs text-muted-foreground hover:text-foreground hover:underline`.

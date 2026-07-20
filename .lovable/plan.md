# Plan · Arreglar captura de fechas

## Analogía
Hoy la app tiene **dos "pluma" distintas** para escribir fechas: una bonita (`DatePickerMx`, DD/MM/AAAA) y una nativa del navegador (que se ve distinta según el sistema del usuario). Además, la pluma bonita se traba cuando escribes `2/3/2026` en vez de `02/03/2026`, no tiene botón rápido para saltar de año, y el reloj interno usa hora de Londres en vez de hora de México — así que después de las 6 pm "hoy" ya es mañana para la app. Esto arma bugs sutiles todo el día.

## Qué se arregla (orden de impacto)

### 1. Bug de zona horaria "hoy = mañana después de las 6 pm" (ALTO)
En ~30 lugares usamos `new Date().toISOString().slice(0,10)` como si fuera "hoy". Ese patrón devuelve el día en **UTC**, no en hora de México (UTC−6). Entre las 18:00 y 23:59 hora local, ya devuelve el día siguiente → vencimientos, defaults y filtros salen corridos un día durante 6 h diarias.

- Crear helper `todayLocalISO()` en `src/lib/date/today.ts` que use fecha local (via `date-fns` `format(new Date(), 'yyyy-MM-dd')`).
- Reemplazar el patrón en los sitios de negocio (no en tests):
  - `MarcarLlegadaForm.tsx`, `VenceBadge.tsx`, `useSnoozeHallazgo.ts`, `useHallazgosTablaState.ts`, `ejecutivoAgregados.ts`, `costeo/services/rutas.ts`, `useCosteoTarifasPageState.ts`, `useNuevaFacturaProveedorForm.helpers.ts`, `useTcDofPorFecha.ts`, `crm/services/dashboard.ts`, `navieraCondicion.ts` y los que aparezcan al buscar el patrón exacto.
- Regla ESLint suave o test guardrail para prohibir el patrón nuevo en `src/**` (excepto tests y `src/lib/date/**`).

### 2. Datos con hora ensucian el picker (ALTO)
`isoToDisplay` (`date-picker-mx-helpers.ts:12`) parte por `-`; si le llega un timestamp `2026-07-20T00:00:00+00:00`, muestra basura tipo `20T00:00:00+00:00/07/2026`.

- Hacer `isoToDisplay` defensivo: si el valor no matchea `^\d{4}-\d{2}-\d{2}$`, tomar los primeros 10 caracteres y validar; si no es fecha real, devolver `""`.
- En `TrackingNuevoEventoForm.tsx:158`, dejar de convertir `YYYY-MM-DD` → `Date local` → `toISOString()`. Guardar el string ISO puro tal cual (la columna `fecha_llegada_real` es `date`, no `timestamptz`). Idem para el `fecha` del evento asociado (que sí puede ser `now()` completo).

### 3. Props que faltan en `DatePickerMx` (ALTO)
Consumidores necesitan bloquear/limitar el picker y no pueden.

- Agregar props `disabled?: boolean`, `min?: string` (ISO), `max?: string` (ISO), `readOnly?: boolean`.
- Propagar `disabled` al `<input>` y al botón X, y `disabled` al `PopoverTrigger`.
- Propagar `min/max` al `Calendar` de shadcn (usando la prop `disabled` de DayPicker con `{ before, after }`).
- Cablear `isPending` → `disabled` en `ActualizarEtaForm`, `MarcarLlegadaForm`, `DialogRegistrarPagoLiquidacion` y demás formularios que ya lo tienen en scope.
- Cablear `max={todayLocalISO()}` en fechas que no deben ser futuras (llegada real, pago, CFDI) y `min={todayLocalISO()}` para ETA nueva.

### 4. Typing `2/3/2026` no comitea (MEDIO)
Hoy `parseDisplay` solo acepta `DD/MM/YYYY` estricto; solo el paste usa `parseFlexible`. Al perder foco, el input revierte silenciosamente.

- En `handleBlur`, intentar primero `parseFlexible(text)` antes de revertir. Si logra parsear, aceptar y commitear.
- Cuando quede inválido tras blur, **mantener el texto y mostrar mensaje visible** debajo del input (`text-xs text-destructive`) en vez de borrar sin explicación. Reservar `sr-only` sólo para accesibilidad extra.

### 5. Calendario sin salto de año (MEDIO)
`Calendar` sólo tiene flechas mes a mes. Para facturas viejas / seguros multianuales es tedioso.

- Configurar `captionLayout="dropdown"` (o `dropdown-buttons`) en `src/components/ui/calendar.tsx` con `fromYear={1900}` `toYear={2100}` para que aparezca el selector rápido de año/mes.

### 6. Unificar los 7 `<input type="date">` restantes (MEDIO)
Formato del SO ≠ formato de la app.

- Migrar a `DatePickerMx` en: `Cartera.tsx`, `CxpPorPagar.tsx`, `ComprasNotasCredito.tsx`, `ComprasPagos.tsx`, `ComprasReportes.tsx`, `FacturapiCredencialesForm.tsx`, `ProgramacionPagoRow.tsx`.

## Detalles técnicos

**Contrato nuevo de `DatePickerMx`**
```ts
interface DatePickerMxProps {
  value: string;                 // ISO YYYY-MM-DD | ""
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  disabled?: boolean;            // NUEVO
  readOnly?: boolean;            // NUEVO
  min?: string;                  // ISO YYYY-MM-DD, NUEVO
  max?: string;                  // ISO YYYY-MM-DD, NUEVO
  errorText?: string | null;     // NUEVO: mensaje visible bajo el input
}
```

**`isoToDisplay` defensivo**
```ts
export function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const head = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return "";
  const [y, m, d] = head.split("-");
  return `${d}/${m}/${y}`;
}
```

**`todayLocalISO`**
```ts
// src/lib/date/today.ts
import { format } from "date-fns";
export const todayLocalISO = (): string => format(new Date(), "yyyy-MM-dd");
```

## Fuera de alcance
- Migrar tests que usan `toISOString().slice(0,10)` (no afecta al usuario).
- Rediseño visual del calendario (colores, densidad).
- Selector de rango de fechas (otro componente distinto).
- Validaciones de negocio nuevas más allá de min/max obvias.

## Verificación
- `bun run test src/components/ui/__tests__/datePickerMxHelpers.test.ts` con casos nuevos: value con `T` y zona, `min/max`, `parseFlexible` en blur.
- Playwright headless: abrir `/embarques/:id` → tab Tracking → "Actualizar ETA": escribir `2/3/2026`, blur → debe quedar `02/03/2026`; abrir picker, saltar 5 años con selector; con `isPending=true` el input queda gris.
- Grep guardrail: `rg 'toISOString\\(\\)\\.slice\\(0,\\s*10\\)' src/ --glob '!**/*.test.*' --glob '!src/lib/date/**'` debe volver 0 resultados tras la migración.

## Riesgos
- Cambiar `isoToDisplay` puede ocultar datos malos existentes (mostraría vacío en vez de basura). Aceptable — dejamos warning en consola dev.
- `todayLocalISO` cambia el "hoy" de auditoría/CRM: valores que hoy salen adelantados se ajustan → puede mover algunos KPIs históricos por ±1 día. Documentar en CHANGELOG.
- Migrar los 7 `<input type="date">` puede pedir ajustes de layout puntual donde el ancho del `DatePickerMx` (h-10) no calce igual.

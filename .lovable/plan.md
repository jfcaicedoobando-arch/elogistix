

## Auditoría Arquitectónica v8.5.0 — Reporte Final

El codebase está en excelente estado tras las limpiezas v8.2.0–v8.5.0. Los hallazgos restantes son **exclusivamente cosméticos o de consistencia menor**. No hay problemas de tipo ALTO.

---

### Hallazgos ordenados por criticidad

#### 1. MEDIO — `ICONO_EVENTO` duplicado en 3 archivos

El mapa idéntico `ICONO_EVENTO: Record<string, string>` está definido en:
- `TabTracking.tsx`
- `PortalEmbarqueTimeline.tsx`
- `TrackingPublico.tsx`

**Solución**: Extraer a `src/data/embarqueConstants.ts` (o `uiMappings.ts`) e importar desde los 3 archivos.

---

#### 2. MEDIO — `format(new Date(...))` inline en 2 archivos

`AdminOrgDetalle.tsx` y `TrackingPublico.tsx` importan `format` de `date-fns` y formatean fechas inline en vez de usar `formatDate`:
- `AdminOrgDetalle.tsx`: `format(new Date(org.created_at), "dd MMM yyyy", { locale: es })`
- `TrackingPublico.tsx`: `format(new Date(ev.fecha), "dd MMM yyyy, HH:mm", { locale: es })`

`Reportes.tsx` y `SeccionRutaCotizacion.tsx` también importan `format`, pero su uso es legítimo (formatean objetos `Date` de calendarios, no strings ISO).

**Solución**: Migrar las 2 llamadas a `formatDate`. Dejar `Reportes.tsx` y `SeccionRutaCotizacion.tsx` como están (operan sobre `Date` nativas, no strings).

---

#### 3. BAJO — `parseISO` importado pero solo usado para `differenceInDays`

`PortalEmbarqueDetalle.tsx` y `PortalDashboard.tsx` importan `parseISO` de `date-fns` solo para cálculos de diferencia de días (`differenceInDays`), no para formateo. Esto es legítimo pero podría encapsularse si se repite más.

**No requiere acción** — uso correcto de la librería para cálculos.

---

#### 4. BAJO — `data as UserOption[]` en `AgregarMiembroOrgDialog.tsx`

Línea 37 tiene un cast `as UserOption[]` sobre el resultado de `list-users`. Es un cast de borde aceptable dado que la edge function no tiene tipo de retorno en el cliente.

**No requiere acción** — es el patrón estándar para edge functions.

---

### Plan de acción recomendado

| Paso | Descripción | Archivos | Esfuerzo |
|------|------------|----------|----------|
| 1 | Extraer `ICONO_EVENTO` a constante compartida | `embarqueConstants.ts` + 3 consumidores | Bajo |
| 2 | Migrar `format(new Date(...))` a `formatDate` en `AdminOrgDetalle` y `TrackingPublico` | 2 archivos | Bajo |

### Resumen

La arquitectura está **prácticamente limpia**. Solo quedan 2 hallazgos accionables: una constante de UI duplicada en 3 archivos y 2 llamadas de formateo que no siguen la convención centralizada. No hay `as any` en código de producción, no hay queries sin centralizar, y la separación de responsabilidades es consistente. Estos 2 pasos son opcionales y cierran definitivamente el ciclo de limpieza.


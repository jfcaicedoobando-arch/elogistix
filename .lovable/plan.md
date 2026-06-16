# Plan — Pack A: UX pulido cotizaciones (bajo riesgo)

Atacamos los 4 puntos visuales/UX que sobraban del plan, sin tocar schema ni el wizard de embarques.

---

## A1 — Check verde por sección en Paso 1 (validación inline)

Cada bloque del Paso 1 muestra un check verde cuando sus campos requeridos están completos. Sirve de progreso visual sin agregar nuevos validadores.

**Reglas de "completo" por sección:**
| Sección       | Requeridos para check verde                                              |
| ------------- | ------------------------------------------------------------------------ |
| Cliente       | `clienteId` (o prospecto con empresa) + contacto                         |
| Operación     | `modo`, `tipo`, `incoterm`                                               |
| Ruta          | `origen`, `destino`                                                      |
| Mercancía     | `descripcionMercancia` + (peso o piezas) según modo                      |
| Tarifa        | sólo aplica si `modo = Marítimo`; verde si `tarifaId` existe (opcional)  |
| Cierre        | `numContenedores >= 1` (notas opcional)                                  |

**Implementación:**
- Nuevo `src/features/cotizacion/hooks/usePaso1SectionStatus.ts` que devuelve `{ cliente, operacion, ruta, mercancia, tarifa, cierre }` con boolean cada uno. Hook puro basado en `form.watch`.
- `WizardSection` (ya existe en `components/shared/`) recibe prop opcional `complete?: boolean` y muestra un `Check` verde a la derecha del título.
- `PasoDatosGenerales.tsx` consume el hook y pasa el flag a cada sección. Acordeón de cierre también muestra el check.

---

## A2 — `HeredadoBadge` en campos auto-completados por tarifa

El componente ya existe (v13.28.0) pero no está montado. Lo agregamos donde la tarifa marítima pisa valores manuales.

**Campos a marcar (sólo si `tarifaId` está set):**
- Tiempo de tránsito → `SeccionRutaCotizacion/seccionRuta/TarifaFields`
- Días libres destino → mismo bloque
- Carta garantía → ya muestra `CartaGarantiaBadge`; agregamos `HeredadoBadge` al lado cuando proviene de tarifa
- Tipo de contenedor (cuando se eligió desde el modal de tarifa)

**Implementación:**
- En cada uno de esos labels, renderizar `<HeredadoBadge tipoOrigen="tarifa" origen={tarifa.nombre || tarifa.codigo} />` cuando `tarifaOverride[campo] !== true` (es decir, el usuario aún no editó manualmente).
- Si el usuario edita y `tarifaOverride[campo] = true`, se oculta el badge (el valor ya no es heredado).

---

## A3 — Filtro rápido "Sin costos" en toolbar del listado

Añadimos un toggle/checkbox en `CotizacionesFilterSelects` que filtra cotizaciones donde `sin_desglose_costos = true` **Y** no tienen filas en `cotizacion_costos`.

**Implementación:**
- Toolbar: agregar un toggle "Sólo sin costos" (icono `AlertTriangle` amarillo) junto a los demás filtros.
- Query: enriquecer `useCotizaciones` para aceptar `filtroSinCostos: boolean`. Cuando true, agregar al select un `cotizacion_costos!left(id)` con `head: true` y filtrar en cliente por `cotizacion_costos.length === 0`.
  - Alternativa simple y suficiente para MVP: filtrar sólo por `sin_desglose_costos = true` en server y dejar que el badge del listado (A4) refleje el estado real.
- Persistir el toggle en URL search params (mantener convenio del listado).

---

## A4 — Badge "Sin costos" en la columna de estado del listado

Cuando una cotización tiene `sin_desglose_costos = true` y `cotizacion_costos.length === 0`, mostrar un badge amarillo "Sin costos" junto al badge de estado actual (aceptada/enviada/etc.).

**Implementación:**
- Extender el select de `useCotizaciones` para traer `cotizacion_costos(count)` agregado (o `cotizacion_costos!left(id).count`).
- En la columna "Estado" del listado (`src/pages/cotizaciones/Cotizaciones.tsx` o sus `columnsParts`), si `(cot.sin_desglose_costos && (cot.cotizacion_costos_count ?? 0) === 0)`, renderizar `<Badge variant="warning" className="ml-2">Sin costos</Badge>`.
- El badge desaparece automáticamente si el vendedor carga costos después (la regla canónica es el conteo real, no el flag).

---

## Entregables

- Bump `APP_VERSION` a `13.29.0` y entrada en `CHANGELOG.md`.
- Sin migraciones.
- Tests:
  - `usePaso1SectionStatus.test.ts` (3-4 casos: vacío, parcial, completo).
  - Smoke en listado para asegurar que el badge se renderiza cuando corresponde.

**Fuera de alcance:** sidebar sticky (Pack D), Sugerir Tarifa Top 3 (Pack C), precarga ampliada al embarque (Pack B), role gate (Pack D).

---

## Pregunta única

Para el filtro "Sin costos" (A3), ¿prefieres que filtre por el **flag** `sin_desglose_costos` (rápido, server-side, captura intención) o por el **estado real** "no tiene filas en `cotizacion_costos`" (más estricto, requiere conteo, captura riesgo real)? Mi recomendación: **estado real**, alineado con la regla canónica del candado.

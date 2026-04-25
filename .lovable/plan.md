# Auditoría de arquitectura — Libre Carga

Análisis de adherencia al contrato definido en `ARCHITECTURE.md` (Pages → Hooks → Services → Lib). En general la base es **sólida**: hay barrels claros, separación de mappers/parsers, y la mayoría de pages no tocan Supabase. Sin embargo, **el módulo de Pre-Facturación / Proformas concentra casi toda la deuda técnica** acumulada en las últimas 5–6 iteraciones.

---

## Hallazgos principales

### 1. Violaciones de la regla "Pages/Components NO tocan Supabase"
La regla #1 de `ARCHITECTURE.md` se rompe en 5 archivos:

| Archivo | Qué hace | Por qué es problema |
|---|---|---|
| `src/components/embarque/TabFacturacion.tsx` (450 L) | `Promise.all` con 3 queries Supabase para armar el PDF (líneas 90–98) | Lógica de carga de datos en componente UI; imposible reutilizar para descarga desde otra vista. |
| `src/components/facturacion/TabProformas.tsx` (315 L) | Mismo patrón: 4 queries Supabase para descargar PDF (líneas 61–78) | **Duplicado** del bloque anterior — dos componentes mantienen la misma lógica de hidratación. |
| `src/components/embarque/DialogGenerarProforma.tsx` (420 L) | `supabase.from('clientes').select('dias_credito')` (líneas 55–60) | Lectura puntual que debería ser un hook (`useClienteDiasCredito`). |
| `src/pages/NuevoEmbarque.tsx` | `supabase.from('cotizacion_costos').select(...)` (líneas 88–91) | Carga de costos de cotización embebida en la página. |
| `src/pages/Login.tsx` | `supabase.auth.signInWithPassword(...)` | Aceptable (auth simple), pero idealmente vive en `AuthContext` o un hook `useLogin`. |

### 2. `useProformas.ts` es demasiado grande (570 líneas, 6 hooks mezclados)
Concentra: queries (`useProformasEmbarque`, `useProformas`, `useProformasPendientes`), mutations CRUD (`useCrearProforma`, `useEliminarProforma`), mutations de flujo (`useMarcarProformaFacturada`, `useAprobarProformas`, `useConsolidarProformas`).

Problemas concretos:
- Mutaciones con **lógica de negocio densa** (cálculos, snapshots, rollbacks manuales) viviendo dentro del hook → debería estar en `services/proformaServices.ts` y/o `lib/domain/proforma.ts`.
- **Tasa IVA hard-codeada** `const TASA = 0.16;` (línea 517) cuando ya existe `useTasaIVA()` y `lib/financialUtils.calcularIVA`. Riesgo: si la contadora cambia el IVA, los snapshots consolidados quedan desfasados.
- **Casts `as any`** repetidos (líneas 473, 510, 519, 524) por una query con join — falta tipo dedicado.
- **Rollbacks manuales** ante fallos de inserción: deberían ser una función RPC transaccional en Supabase para garantizar atomicidad real (hoy un fallo de red entre pasos deja datos inconsistentes).

### 3. Falta una capa `services/proformaServices.ts`
Siguiendo la convención de `embarqueServices.ts` y `cotizacionServices.ts`, las mutaciones complejas de proformas deberían descomponerse en:
- `services/proformaServices.ts` → acceso puro: `crearProformaConRollback`, `consolidarProformas`, `marcarFacturada`, `subirArchivosFactura`.
- `lib/domain/proforma.ts` → cálculos puros: agrupación por contenedor, suma de totales, snapshots de conceptos.
- `hooks/embarque/useProformas.ts` → solo orquestación React Query (cache + toasts).

### 4. Duplicación del flujo "descargar PDF de proforma"
El mismo bloque (cargar embarque + conceptos + cliente + consolidados → invocar `generarPdfProforma`) está copiado en `TabFacturacion.tsx` y `TabProformas.tsx`. Cualquier cambio (ej. hoy ya pasó con "Servicios de Logística") obliga a tocar dos lugares.

**Solución**: crear `hooks/embarque/useDescargarProformaPdf.ts` que devuelve `(proforma) => Promise<void>`.

### 5. Componentes UI con responsabilidades mezcladas
- `TabFacturacion.tsx` (450 L) hace: render de tabla + cálculo de totales + descarga PDF + diálogo eliminar + carga datos. Debería partirse en `<TablaConceptosVenta />`, `<TablaProformas />`, `<TablaFacturas />`.
- `DialogGenerarProforma.tsx` (420 L) mezcla wizard (paso selección/confirmación), cálculo de IVA, side effect de cargar `dias_credito`, y submit. La lógica de cálculo debería bajar a `lib/domain/proforma.ts`.

### 6. Inconsistencia en la capa `services/`
- `cotizacionServices.ts` (135 L) y `embarqueServices.ts` (54 L) → bien.
- Pero `useProformas.ts`, `useEmbarqueMutations.ts` (252 L), `useEmbarqueQueries.ts` (287 L) hacen acceso directo a Supabase **dentro del hook**, sin pasar por un service. Esto es un patrón aceptado para acceso trivial (Regla "cuándo NO crear un service"), pero las mutaciones con multiples pasos transaccionales sí ameritan un service.

### 7. Manejo de tipos: casts `as any` y `as unknown as`
- `useProformas.ts` línea 22: `data as unknown as Array<...>` — el tipo del join puede declararse como tipo nominal exportado.
- ~18 ocurrencias de `as any` / `: any` en el codebase, concentradas en hooks de proformas.

### 8. Invalidación de cache demasiado amplia
Varias mutaciones invalidan `['proformas']`, `['embarque']`, `['embarques']`, `['conceptos_venta']` sin filtros — refetch innecesario en listas grandes. Considerar `queryKeys.ts` centralizado (ya existe `lib/queryKeys.ts`) y usarlo consistentemente.

### 9. Constraint de IVA en CHECK constraint vs. trigger
La regla del proyecto menciona usar triggers para validaciones temporales, pero el snapshot de proformas consolidadas guarda `iva` calculado con tasa hard-codeada. Si la tasa cambia, no hay re-cálculo. Considerar guardar `tasa_iva_aplicada` en cada fila para auditoría histórica.

### 10. `src/data/changelog/legacy.ts` (1523 L)
Archivo histórico muy grande pero aceptable (es un dataset estático). No es crítico, pero impacta el tiempo de cold-start del bundle si se importa en otra ruta. Verificar que solo `Changelog.tsx` lo importe (lazy-loaded).

---

## Plan de acción priorizado

### CRÍTICO (deuda activa, riesgo de bug)

1. **Refactor de `useProformas.ts` (570 L → ~150 L)**
   - Crear `src/services/proformaServices.ts` con: `crearProforma`, `marcarFacturada`, `consolidarProformas`, `eliminarProforma`, `aprobarProformas`.
   - Crear `src/lib/domain/proforma.ts` con: `agruparConceptosPorContenedor`, `sumarTotalesProformas`, `construirSnapshotConsolidado(conceptos, embarques, tasaIva)`.
   - Hook queda solo con `useQuery`/`useMutation` + invalidaciones + toasts.

2. **Eliminar tasa IVA hard-codeada (`const TASA = 0.16`)** en consolidación. Pasar `tasaIva` desde el componente que dispara la mutación, igual que ya se hace en `TabFacturacion`.

3. **Mover transacciones críticas a funciones RPC en Supabase**
   - `crear_proforma_con_conceptos(...)` — atómica.
   - `consolidar_proformas(...)` — atómica con snapshot.
   - `marcar_proforma_facturada(...)` — atómica con creación de facturas.
   Elimina los rollbacks manuales y previene estados inconsistentes ante fallos de red.

### ALTO (duplicación y mantenibilidad)

4. **Crear `useDescargarProformaPdf` hook compartido** y reemplazar las dos copias en `TabFacturacion.tsx` y `TabProformas.tsx`.

5. **Partir `TabFacturacion.tsx`** en sub-componentes:
   - `ConceptosVentaSeccion.tsx`
   - `ProformasSeccion.tsx`
   - `FacturasSeccion.tsx`
   - Su archivo padre orquesta props y data.

6. **Partir `DialogGenerarProforma.tsx`** en:
   - `PasoSeleccionConceptos.tsx`
   - `PasoConfirmacionProforma.tsx`
   - Lógica de cálculo en `lib/domain/proforma.ts`.

7. **Sacar `supabase.from('clientes')` de `DialogGenerarProforma`** → crear `useClienteResumen(clienteId)` reutilizable (lo necesitará también el PDF).

### MEDIO (limpieza y consistencia)

8. **Definir tipos nominales para joins de Supabase** (eliminar `as unknown as` y `as any`):
   ```ts
   export type ProformaConFactura = ProformaRow & { facturas: { ... } | null };
   ```
   Aplicarlo en `useProformas.ts` y queries similares.

9. **Centralizar query keys** en `lib/queryKeys.ts` para todas las invalidaciones de proformas/facturas/embarques. Usar funciones tipadas.

10. **Mover `signInWithPassword` de `Login.tsx`** a `AuthContext` o `useLogin` hook (consistencia con regla #1).

11. **Sacar `supabase.from('cotizacion_costos')` de `NuevoEmbarque.tsx`** → mover a `services/cotizacionServices.ts` y exponer como hook `useCotizacionCostosLite(cotId)`.

### OPCIONAL (mejoras menores)

12. **Auditar `useEmbarqueQueries.ts` (287 L)** y considerar partir queries muy grandes (joins) en hooks especializados.

13. **Guardar `tasa_iva_aplicada` en `proformas` y `proforma_conceptos_consolidados`** para trazabilidad histórica si la tasa cambia.

14. **Verificar que `data/changelog/legacy.ts` solo se importe en lazy chunk** de `Changelog.tsx` (no en el bundle principal).

15. **Documentar en `ARCHITECTURE.md`** el patrón "transacciones complejas → RPC en Supabase" como recomendación oficial.

16. **Tests unitarios para `lib/domain/proforma.ts`** una vez extraído (cálculos puros, fáciles de testear).

---

## Resumen

- ✅ La arquitectura base está bien definida y la mayor parte del código la respeta.
- ⚠️ El módulo de proformas (introducido en v8.45–v8.49) acumuló deuda: hooks de 570 L, lógica duplicada en componentes, IVA hard-codeado, rollbacks manuales no atómicos.
- 🎯 Atacando los puntos 1–4 se elimina ~80% del riesgo y se reducen ~400 líneas de código duplicado.

¿Procedo con el plan en este orden cuando aprobemos?

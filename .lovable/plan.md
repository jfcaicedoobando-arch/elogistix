# Auditoría de arquitectura — Libre Carga

Revisé estructura general, pesos por archivo, separación de capas (pages → hooks → services → lib), uso de Supabase, duplicaciones y consistencia entre dominios. **No se modificó código.**

## Resumen ejecutivo

La base está **mucho mejor que el promedio**: capas claras (`pages` / `hooks` / `services` / `lib/domain` / `lib/mappers` / `lib/parsers`), barrels por dominio, dominio puro testeado, formatters centralizados, **0 `any`, 0 `console.log`, 0 `TODO`**, y casi todo el acceso a Supabase pasa por `services/`. Lo que queda son **inconsistencias de convención entre dominios** y unos pocos puntos calientes a refactorizar. No hay deuda crítica.

---

## Hallazgos (por severidad)

### Críticos (bloquean consistencia / mantenibilidad)

1. **`useToast` duplicado en dos rutas**
   - `src/hooks/use-toast.ts` y `src/hooks/shared/use-toast.ts` coexisten.
   - Mezcla en imports: `TabTracking.tsx` usa `@/hooks/use-toast`, otros usan `@/hooks/shared/...`.
   - Riesgo: dos instancias del store de toasts → toasts perdidos.

2. **Acceso directo a Supabase fuera de `services/` y `hooks/`**
   - `src/components/embarque/DialogBolContainers.tsx` (248 líneas) importa `@/integrations/supabase/client` y usa `useQuery` directamente.
   - Único componente del proyecto que rompe la regla "componentes no hablan con Supabase".

3. **Convención inconsistente de `services/<dominio>/mutations`**
   - `services/embarque/`: `mutations.ts` (archivo plano) + `queries.ts` (355 líneas, el más grande de servicios).
   - `services/cotizacion/`: `crud.ts` + `costos.ts` + `wizard.ts` + carpeta `conversiones/` (sin `queries.ts`/`mutations.ts`).
   - `services/cliente/`: split por subdominio (`crud`, `contactos`, `relacionados`, `financials`).
   - `services/proveedor/`: solo `index.ts`.
   - Mismo problema en `hooks/`: `hooks/embarque/mutations/` (carpeta) vs `hooks/cotizacion/mutations/` (carpeta pero con `useCotizacionMutations.ts` agrupando todo).

### Altos (puntos calientes / acoplamiento)

4. **`services/embarque/queries.ts` (355 líneas)** concentra demasiada responsabilidad: lista paginada + detalle + conceptos venta + conceptos costo + documentos + notas + facturas + expedientes + proveedores. Conviene partirlo igual que `services/cliente/`.

5. **`components/ui/sidebar.tsx` (637 líneas)** es shadcn vendored — útil para no actualizar, pero conviene marcarlo como "no editar / archivo vendor" con comentario y/o mover a `components/ui/vendor/`.

6. **`TrackingLiveCard.tsx` (373 líneas)** mezcla fetch JSONCargo, estado local, y render. Ya existen hooks (`useJsonCargoTracking`, `useJsonCargoBolLookup`); revisar si la lógica restante puede bajarse a un hook controlador (`useTrackingLiveCard`).

7. **`MarcarRevisadoDialog.tsx` (409) y `AsignarResponsableDialog.tsx` (242)** — dialogs con lógica de negocio embebida; el resto del proyecto usa el patrón `useXxxController` (p. ej. `useNuevoProveedorController`). Auditoría no lo sigue.

8. **`hooks/auditoria/useAuditoriaEjecutivo.ts` (245) y `useAuditoriaRevisiones.ts` (242)** son grandes; revisar si combinan queries + reglas de dominio que deberían vivir en `lib/domain/auditoria.ts` (que aún no existe — auditoría carece de capa de dominio puro como sí tienen embarque/cotización/proforma).

### Medios (limpieza)

9. **`src/hooks/use-mobile.tsx`** vive en la raíz de hooks (convención shadcn). Coherente moverlo a `hooks/shared/` para alinear con el resto.

10. **`TabTracking.tsx` (217 líneas)** declara estado del formulario inline (`tipo`, `descripcion`, `ubicacion`, `fecha`) — siguiendo la convención del proyecto debería usar `useEmbarqueForm`-style con react-hook-form, o un mini-hook `useNuevoEventoForm`.

11. **`pages/dashboard/Changelog.tsx` (260)** — render puro pero largo; `src/content/changelog/v8/chunks/0.ts` (1062 líneas) acumula cambios; ya se usa el patrón de chunks pero el chunk 0 está obeso → falta rotar a `chunks/6.ts`.

12. **`hooks/embarque/useEmbarques.ts`** re-exporta tipos `EmbarqueRow`/`ConceptoVentaRow`/etc. desde un hook. Esos tipos pertenecen a `types/` (tienen `types/concepto.ts`, `types/db.ts`).

### Bajos (opcionales)

13. `services/proveedor/index.ts` único archivo: no necesita carpeta, podría ser `services/proveedor.ts` o adoptar el split estándar si crece.

14. `pages/auth/TrackingPublico.tsx` usa `useQuery` directo — aceptable porque es página standalone sin dominio, pero podría mover el query a `services/portal/` o nuevo `services/tracking/`.

15. No existe `docs/architecture.md` formal con las convenciones (nombres de carpetas, regla "componentes no tocan Supabase", patrón `useXxxController`). El `ARCHITECTURE.md` existe pero conviene auditar que cubra estas reglas para futuros colaboradores y para que la IA respete la convención.

---

## Plan ordenado (de más crítico a opcional)

```text
[1] Unificar useToast               → eliminar duplicado, un solo path
[2] Sacar Supabase de DialogBolContainers → hook + service
[3] Estandarizar layout de services/  → estructura única por dominio
[4] Partir services/embarque/queries.ts → submódulos por subdominio
[5] Auditoría: extraer dominio puro + controllers en dialogs grandes
[6] Refactor TrackingLiveCard       → hook controlador
[7] Refactor TabTracking            → form con RHF / mini-hook
[8] Mover tipos re-exportados a types/
[9] Mover use-mobile a hooks/shared/
[10] Rotar chunk del changelog v8/0 → v8/6
[11] Documentar convenciones en ARCHITECTURE.md
[12] (opcional) Aplanar services/proveedor / mover query de TrackingPublico
```

### Detalle por paso

1. **Unificar `useToast`**: elegir `@/hooks/use-toast` (path shadcn estándar) **o** `@/hooks/shared/use-toast` y borrar el otro. Reemplazar todos los imports con búsqueda global. Registrar la regla en memoria del proyecto.

2. **`DialogBolContainers`**: crear `services/embarque/bol.ts` con la query, exponerla vía `useBolContainers(embarqueId)` en `hooks/embarque/`, y reducir el componente a render + props.

3. **Convención `services/<dominio>/`** propuesta:
   ```
   services/<dominio>/
     index.ts        (barrel)
     queries.ts      (lecturas) — o carpeta queries/ si crece
     mutations.ts    (escrituras) — o carpeta mutations/
     <subdominio>.ts (costos, documentos, conversiones, …)
   ```
   Migrar `embarque` y `cotizacion` a esta forma. Mantener barrels para no romper imports.

4. **Partir `services/embarque/queries.ts`** en: `queries/embarques.ts`, `queries/conceptos.ts`, `queries/documentos.ts`, `queries/notas.ts`, `queries/facturas.ts`, `queries/expedientes.ts`, `queries/proveedores.ts` + `queries/index.ts` barrel. Idéntico tratamiento opcional para `hooks/embarque/useEmbarqueQueries.ts`.

5. **Auditoría**: crear `lib/domain/auditoria.ts` (reglas de revisión, asignación, formatos) con tests, y reducir `MarcarRevisadoDialog` / `AsignarResponsableDialog` a UI + controller (`useMarcarRevisadoController`, etc.), siguiendo el patrón de `useNuevoProveedorController`.

6. **`TrackingLiveCard`**: extraer todo el estado y handlers a `hooks/embarque/useTrackingLiveCard.ts`; el componente queda < 150 líneas, solo render.

7. **`TabTracking`**: reemplazar `useState` ad-hoc por RHF + `zodResolver` (esquema en `lib/domain/embarqueWizardSchemas` o nuevo `lib/domain/eventoEmbarque.ts`).

8. **Mover `EmbarqueRow`, `ConceptoVentaRow`, `ConceptoCostoRow`, `DocumentoEmbarqueRow`, `NotaEmbarqueRow`** desde `hooks/embarque/useEmbarques.ts` a `types/db.ts` o `types/embarque.ts`. Actualizar imports.

9. **`use-mobile`**: mover a `hooks/shared/use-mobile.tsx` y actualizar imports.

10. **Changelog**: cerrar `v8/chunks/0.ts` (1062 líneas) y empezar `v8/chunks/6.ts`. Validar que `changelogData.ts` agregue los 7 chunks.

11. **`ARCHITECTURE.md`**: añadir/confirmar reglas — capas, "components no tocan Supabase ni react-query", patrón `useXxxController`, layout estándar de `services/`, ubicación de tipos, dónde vive lógica pura (`lib/domain`).

12. **Opcionales**: aplanar `services/proveedor` o aplicar el split estándar; mover query de `TrackingPublico` a `services/`.

---

## Lo que **no** está roto y conviene preservar

- Capa `lib/domain/*` con tests unitarios (cotización, embarque, proforma, fases, proyección facturación, bitácora, wizard schemas).
- Mappers `from/to DB` ya separados.
- Barrels por dominio (`services/<x>/index.ts`, `hooks/<x>/index.ts`).
- Hooks `useXxxController` y `useXxxPageController` para páginas (cliente, proveedor, facturación, operaciones, reportes, embarques).
- Sin `any`, sin `console.*`, sin TODOs.
- Pages delgadas (la mayoría < 220 líneas; las grandes son justificables).

---

## Métricas

- 47.5K LOC (excluyendo `supabase/types.ts` y changelog).
- 158 componentes en `src/components/`.
- 1 componente con acceso directo a Supabase (debería ser 0).
- 1 página con `useQuery` directo (TrackingPublico, aceptable).
- 0 `any`, 0 `console.*`, 0 `TODO/FIXME`.
- Archivo más grande no-vendor: 637 líneas (sidebar shadcn, vendor).

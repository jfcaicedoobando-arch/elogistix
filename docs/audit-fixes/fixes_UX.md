# Fix pack UI/UX estática — Elogistix (listo para Lovable)

**Fuente:** `output/audit_reports/04_uiux_estatica.md` (hallazgos UX-01 a UX-14, auditoría estática sobre main @ 1ef05ce9, v13.523.1).
**Repo verificado:** `/mnt/agents/repo`, frontend en `src/`. Todos los fragmentos de los diffs fueron leídos de los archivos reales citados.
**Reglas del pack:** feature freeze → cambios locales, sin dependencias nuevas, sin refactors de arquitectura. Reutilizar siempre componentes/tokens ya existentes (`DeleteConfirmDialog`, `AsyncBoundary`, `DataTable`/`DetailTable`, `getErrorMessage`, `Button loading`, `text-kpi`, `FormDialogSection`).

**Leyenda:** los diffs son unificados reales (contexto del repo). Cuando un hallazgo es de clase, se da el fix del patrón central + 1-2 diffs de ejemplo + la lista de archivos donde replicarlo.

---

### [UX-01] Deletes sin confirmación en catálogos de Configuración
- **Severidad:** P1 · **Verificación:** estático
- **Archivos:**
  - `src/features/configuracion/components/TabNavieras.tsx` (línea 55)
  - `src/features/configuracion/components/TabPuertos.tsx` (línea 50)
  - `src/features/configuracion/components/TabTiposContenedor.tsx` (línea 48)
  - `src/features/configuracion/components/CatalogoClavesSATCard.tsx` (línea 108)
- **Problema:** un clic en el botón de basurero ejecuta `eliminarX.mutate(id)` directo, sin confirmación, sobre navieras/puertos/tipos de contenedor/claves SAT que son datos referenciales de cotizaciones, embarques y facturación. Contradice design-system.md §7 ("Eliminaciones destructivas: doble confirmación con la palabra `ELIMINAR`") y el patrón de módulos vecinos (costeo usa `ConfirmDeleteAlert`, que es wrapper de `ConfirmActionDialog`).
- **Fix (instrucción para Lovable):** en los 4 archivos, usar el componente compartido `DeleteConfirmDialog` (re-export tipado de `DoubleConfirmDeleteDialog`, doble paso con texto `ELIMINAR`, ya usado en proformas/tesorería/embarques). Patrón: (1) importar `DeleteConfirmDialog` desde `@/components/shared/dialogs/DeleteConfirmDialog`; (2) agregar estado `const [xAEliminar, setXAEliminar] = useState<Tipo | null>(null)`; (3) el `onClick` del botón destructivo cambia de `mutate(...)` a `setXAEliminar(row.original)` (en `CatalogoClavesSATCard` a `setAEliminar(r)`); (4) renderizar el diálogo junto al cierre del `Card`, con `entityName` que incluya el nombre del registro y `isPending` de la mutación; en `onConfirm` llamar al `mutate` y el diálogo se cierra solo al confirmar.
- **Diff / código:** ejemplo real en `TabNavieras.tsx` (replicar idéntico patrón en los otros 3; en `CatalogoClavesSATCard.tsx` el registro es `Row` y el nombre visible es `r.patron`):

```diff
 import { NavieraFormDialog } from "@/components/shared/NavieraFormDialog";
+import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
 import type { Naviera } from "@/features/catalogos/services";
@@
   const [navieraEnEdicion, setNavieraEnEdicion] = useState<Naviera | null>(null);
+  const [navieraAEliminar, setNavieraAEliminar] = useState<Naviera | null>(null);
@@
-          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarNaviera.mutate(row.original.id)} aria-label={`Eliminar naviera ${row.original.name}`}>
+          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setNavieraAEliminar(row.original)} aria-label={`Eliminar naviera ${row.original.name}`}>
             <Trash2 className="h-4 w-4" />
           </Button>
@@
       <NavieraFormDialog
         open={!!navieraEnEdicion}
         onOpenChange={(open) => { if (!open) setNavieraEnEdicion(null); }}
         naviera={navieraEnEdicion}
       />
+      <DeleteConfirmDialog
+        open={!!navieraAEliminar}
+        onOpenChange={(open) => { if (!open) setNavieraAEliminar(null); }}
+        entityName={navieraAEliminar ? `la naviera "${navieraAEliminar.name}"` : "esta naviera"}
+        description="La naviera se eliminará del catálogo. Las cotizaciones y embarques existentes no se modifican."
+        isPending={eliminarNaviera.isPending}
+        onConfirm={() => {
+          if (navieraAEliminar) eliminarNaviera.mutate(navieraAEliminar.id);
+        }}
+      />
     </Card>
```

Variantes por archivo (mismas líneas de diálogo, cambian nombres):
- `TabPuertos.tsx`: `puertoAEliminar: Puerto | null`, `entityName={`el puerto "${puertoAEliminar.name}"`}`, `onConfirm` → `eliminarPuerto.mutate(puertoAEliminar.id)` (línea 50).
- `TabTiposContenedor.tsx`: `tipoAEliminar: TipoContenedor | null`, `entityName={`el tipo de contenedor "${tipoAEliminar.name}"`}`, `onConfirm` → `eliminarTipo.mutate(tipoAEliminar.id)` (línea 48).
- `CatalogoClavesSATCard.tsx`: `const [rowAEliminar, setRowAEliminar] = useState<Row | null>(null)`; botón línea 108 `onClick={() => setRowAEliminar(r)}`; `entityName={`el producto "${rowAEliminar.patron}"`}`; `isPending={deleteMut.isPending}`; `onConfirm` → `deleteMut.mutate(rowAEliminar.id)`. Importar `Row` desde `./CatalogoClavesSATCard.constants` (ya se importa `type Row` ahí).

- **Tras aplicar, verificar:** en Configuración → cada catálogo, clic en el basurero abre el diálogo de 2 pasos que exige escribir `ELIMINAR`; el botón "Eliminar definitivamente" sólo se habilita con el texto exacto; al confirmar, la fila desaparece y el toast de éxito se muestra; Cancelar no borra nada. Intentar borrar una naviera/puerto en uso por un embarque: el error de FK (23503) aparece como mensaje amigable (ver UX-02) y no rompe la pantalla.

---

### [UX-02] `error.message` técnico crudo en títulos de toast de error
- **Severidad:** P1 · **Verificación:** estático
- **Archivos (45 archivos, ~78 call sites; los de módulos core primero):**
  - `src/features/admin/hooks/usuario/useUsuarios.ts` (líneas 60, 74, 108 y 4 más), `src/features/admin/hooks/usuario/usePortalUsuarios.ts`, `src/features/admin/hooks/useAdminData.ts`
  - `src/features/comisiones/hooks/useVendedoras.ts` (50, 65, 81), `useLiquidaciones.ts`
  - `src/features/cotizacion/hooks/useRevalidacionTarifa.ts` (33, 64, 94), `useCotizacionConversions.ts`, `useCotizacionCostos.ts`, `useCotizacionInformativa.ts`, `useVersionadoCotizacion.ts`
  - `src/features/crm/hooks/useActividades.ts` (77, 92, 108), `useOportunidades.ts`, `useEtapasPipeline.ts`, `usePlantillasMensaje.ts`, `useComentariosOportunidad.ts`, `useAutomatizacionesEtapa.ts`, `useCrearCotizacionDesdeOportunidad.ts`, `hooks/leads/{bulk,convertir,mutations}.ts`, `useActualizarActividadNotas.ts`
  - `src/features/cxp/hooks/useFacturaProveedorMutations.ts`, `useAdjuntoFacturaProveedor.ts`, `components/HistorialFacturaSection.tsx`, `services/facturasEntrantes{Conceptos,Upload}.ts`
  - `src/features/embarques/hooks/mutations/{useCreateEmbarque,useNotaEmbarque,useUpdateEmbarque}.ts`, `useEventosEmbarque.ts`, `useProformas.ts`, `useTrackingLinks.ts`
  - `src/features/facturacion/hooks/useFacturas.ts`, `usePagosFactura.ts`, `components/TabProyeccion.tsx`
  - `src/features/presupuesto/hooks/usePresupuesto{Categorias,Mensual}.ts`, `src/features/proveedor/hooks/useProveedores.ts`, `src/features/tesoreria/hooks/{useTesoreriaCuentas,useTraspasos}.ts`, `src/features/cliente/hooks/useClientUsersMutations.ts`, `src/features/portal/hooks/usePortalPerfil.ts`, `src/features/proformas/services/facturar.ts`, `src/features/admin/services/exportOrg.ts`, `src/features/admin/routes/Diagnostico.tsx`
- **Problema:** el patrón `` notifyError(undefined, { title: `Error al X: ${error.message}` }) `` interpela el mensaje crudo de PostgREST/Auth en el título del toast. `sanitizeToastText` quita HTML y nombres de constraints, pero el inglés técnico sigue visible: "duplicate key value violates unique constraint", "JWT expired", "new row violates row-level security policy".
- **Fix (instrucción para Lovable):** el helper central **ya existe**: `getErrorMessage(err)` en `src/lib/errors/index.ts`, que traduce códigos Postgres (SQLSTATE 23503 FK, 23505 único, 23514 check, 42501 permisos), violaciones de RLS, errores de Edge Functions y catálogo `LC_*` a mensajes de negocio en es-MX (vía `translatePostgresError` en `src/lib/errors/pgErrorCodes.ts`). En cada call site: (1) título fijo en español, en forma negativa de la acción ("No se pudo cambiar el rol"); (2) `description: getErrorMessage(error)` para el detalle amigable; (3) conservar `error` y `method` en opts (el detalle técnico sigue disponible en "Ver detalles" → `ErrorDetailsDialog` y en Sentry). Import: `import { getErrorMessage } from "@/lib/errors";`. Hacerlo módulo por módulo empezando por admin, comisiones, cotización, crm, cxp, embarques, facturación (módulos core); **no tocar `appFeedback.ts`**.
- **Diff / código:** ejemplos reales:

`src/features/admin/hooks/usuario/useUsuarios.ts`:
```diff
+import { getErrorMessage } from "@/lib/errors";
@@
     onError: (error: Error) => {
-      notifyError(undefined, { title: `Error al cambiar rol: ${error.message}`, error, method: "UPDATE_USER_ROLE" });
+      notifyError(undefined, { title: "No se pudo cambiar el rol", description: getErrorMessage(error), error, method: "UPDATE_USER_ROLE" });
     },
@@
     onError: (error: Error) => {
-      notifyError(undefined, { title: `Error al eliminar usuario: ${error.message}`, error, method: "DELETE_USER" });
+      notifyError(undefined, { title: "No se pudo eliminar el usuario", description: getErrorMessage(error), error, method: "DELETE_USER" });
     },
```

`src/features/comisiones/hooks/useVendedoras.ts` (línea 50; replicar en 65 y 81):
```diff
     onError: (error: Error) => {
-      notifyError(undefined, { title: `Error al guardar configuración: ${error.message}`, error, method: "UPSERT_VENDEDORA_CONFIG" });
+      notifyError(undefined, { title: "No se pudo guardar la configuración", description: getErrorMessage(error), error, method: "UPSERT_VENDEDORA_CONFIG" });
     },
```

`src/features/cotizacion/hooks/useRevalidacionTarifa.ts` (línea 33; replicar en 64 y 94):
```diff
       notifyError(undefined, {
-        title: `No se pudo solicitar re-aprobación: ${error.message}`,
+        title: "No se pudo solicitar la re-aprobación",
+        description: getErrorMessage(error),
         error,
         method: "REVALIDACION_SOLICITAR_REAPROBACION",
       });
```

- **Tras aplicar, verificar:** provocar errores reales (p. ej. duplicar el RFC de un cliente, borrar una naviera en uso, desconectar la red): el título del toast es una frase fija en español y la descripción dice "Ya existe un registro con esos mismos datos…" / "No se puede completar la operación porque este registro está relacionado con otros datos…", nunca el SQL en inglés. "Ver detalles" sigue mostrando el payload técnico. `grep -rn 'error.message}` src --include=*.ts` en hooks debe quedar en 0.

---

### [UX-03] 36+ tablas `<table>` crudas fuera de `DataTable`/`DetailTable`
- **Severidad:** P2 · **Verificación:** estático
- **Archivos:** 39 archivos con JSX `<table` crudo (grep verificado). Los citados por la auditoría: `src/features/crm/routes/Analitica.tsx`, `CrmDashboard.tsx`, `src/features/crm/components/Cliente360Panel.tsx`, `OportunidadCotizacionesList.tsx`, `ImportarLeadsCsvPreview.tsx`, `src/features/presupuesto/components/TabVsReal.tsx`, `TabCategorias.tsx`, `TabCaptura.tsx`, `src/features/tesoreria/components/TablaFlujoSemanal.tsx`, `src/features/profit/components/EstadoResultadosTable.tsx`, `src/features/facturacion/components/detalle/FacturaPagosTabla.tsx`, `src/features/facturacion/components/NotasCreditoRecientes.tsx`. Infraestructura exenta: `src/components/ui/table.tsx`, `src/components/shared/DataTable.tsx`, `src/pdf/components/DataTable.tsx`.
- **Problema:** el guardrail `src/__tests__/architecture/no-raw-table.test.ts` sólo vigila *imports* de `@/components/ui/table`; el JSX `<table>` crudo lo esquiva. Estas tablas no usan `text-table-head` en encabezados, ni `ROW_HOVER`, ni densidad `TABLE_DENSITY`, ni estados vacíos integrados → inconsistencia visual transversal.
- **Fix (instrucción para Lovable):** dos pasos, en este orden (bajo riesgo para el release):
  1. **Congelar la deuda:** extender el test de arquitectura con una segunda regla que detecte JSX `<table` crudo y una allowlist con los archivos actuales (así la deuda no crece sin migrar nada todavía).
  2. **Migrar incrementalmente** (post-release o por módulo): cada tabla cruda simple → `DataTable` + `defineColumns` (patrón de `TabNavieras.tsx`); cada tabla de detalle estática → `DetailTable` (`DetailTableHead`/`DetailTableRow`/`DetailTableEmptyRow`, patrón de `CatalogoClavesSATCard.tsx`). Tablas con filas expandibles (p. ej. `TablaFlujoSemanal.tsx`) → migrar a `DetailTable` conservando el fragmento expandido, no a `DataTable`.
- **Diff / código:**

Paso 1 — extender `src/__tests__/architecture/no-raw-table.test.ts` (agregar después del primer `it`):

```diff
 const RAW_TABLE_IMPORT = /from\s+["']@\/components\/ui\/table["']/;
+
+/** JSX de tabla cruda: `<table ...>` fuera de DataTable/DetailTable/pdf. */
+const RAW_TABLE_JSX = /<\s*table[\s>]/;
+
+/**
+ * Deuda congelada (UX-03): archivos que hoy renderizan `<table>` crudo.
+ * NO agregar entradas nuevas; quitar al migrar a DataTable/DetailTable.
+ */
+const RAW_TABLE_JSX_DEBT: readonly string[] = [
+  // Infraestructura (implementaciones, no consumidores).
+  "src/components/ui/table.tsx",
+  "src/components/shared/DataTable.tsx",
+  "src/pdf/components/DataTable.tsx",
+  // Deuda existente a migrar (ver fixes_UX.md UX-03).
+  "src/features/crm/routes/Analitica.tsx",
+  "src/features/crm/routes/CrmDashboard.tsx",
+  "src/features/crm/components/Cliente360Panel.tsx",
+  "src/features/crm/components/OportunidadCotizacionesList.tsx",
+  "src/features/crm/components/ImportarLeadsCsvPreview.tsx",
+  "src/features/presupuesto/components/TabVsReal.tsx",
+  "src/features/presupuesto/components/TabCategorias.tsx",
+  "src/features/presupuesto/components/TabCaptura.tsx",
+  "src/features/tesoreria/components/TablaFlujoSemanal.tsx",
+  "src/features/profit/components/EstadoResultadosTable.tsx",
+  "src/features/facturacion/components/detalle/FacturaPagosTabla.tsx",
+  "src/features/facturacion/components/NotasCreditoRecientes.tsx",
+  // … completar con el resto de los 39 archivos listados por
+  // `grep -rln "<table" src --include=*.tsx`
+];
+
+  it("no hay JSX <table> crudo fuera de la deuda congelada", () => {
+    const violations: string[] = [];
+    for (const f of walk(join(ROOT, "src"), {
+      excludeDirs: ["__tests__", "node_modules"],
+      excludeFileRe: /\.(test|spec)\.tsx?$/,
+    })) {
+      const src = readFileSync(f, "utf8");
+      if (!RAW_TABLE_JSX.test(src)) continue;
+      const rel = relPath(ROOT, f);
+      if (!RAW_TABLE_JSX_DEBT.includes(rel)) violations.push(rel);
+    }
+    expect(
+      violations,
+      `Nuevas tablas crudas detectadas. Usa <DataTable /> o <DetailTable />.\n\n` +
+        violations.join("\n"),
+    ).toEqual([]);
+  });
```

Paso 2 — ejemplo de migración real, `src/features/facturacion/components/NotasCreditoRecientes.tsx` (ANTES, líneas 102-113):

ANTES:
```tsx
<div className="overflow-x-auto">
  <table className="w-full text-sm">
    <thead className="text-xs text-muted-foreground border-y bg-muted/20">
      <tr>
        <th className="text-left py-2 px-3">Folio</th>
        <th className="text-left py-2 px-3">Factura</th>
        <th className="text-left py-2 px-3">Cliente</th>
        <th className="text-left py-2 px-3">Fecha</th>
        <th className="text-left py-2 px-3">Motivo</th>
        <th className="text-left py-2 px-3">Estado</th>
        <th className="text-right py-2 px-3">Monto</th>
      </tr>
    </thead>
```

DESPUÉS (con `DataTable`, que ya soporta `onRowClick`, `getRowAriaLabel`, `emptyMessage` y skeletons):
```tsx
const columns = defineColumns<NotaCreditoRow>([
  { id: "folio", header: "Folio", cell: ({ row }) => row.original.numero },
  { id: "factura", header: "Factura", cell: ({ row }) => row.original.factura_numero },
  { id: "cliente", header: "Cliente", cell: ({ row }) => row.original.cliente_nombre },
  { id: "fecha", header: "Fecha", cell: ({ row }) => formatDate(row.original.fecha) },
  { id: "motivo", header: "Motivo", cell: ({ row }) => row.original.motivo },
  { id: "estado", header: "Estado", cell: ({ row }) => <EstadoNotaBadge estado={row.original.estado} /> },
  { id: "monto", header: "Monto", meta: { className: "text-right", headerClassName: "text-right" },
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.monto, row.original.moneda)}</span> },
]);

<DataTable
  columns={columns}
  data={filtradas}
  isLoading={isLoading}
  emptyMessage="No hay notas de crédito que coincidan."
  rowKey={(n) => n.id}
  onRowClick={(n) => navigate(`/facturacion/${n.factura_id}`)}
  getRowAriaLabel={(n) => `Ver factura ${n.factura_numero}`}
  density={TABLE_DENSITY.embebida}
/>
```
(Ajustar nombres de campos a los reales del tipo del archivo; el `<table>` y su `tbody` desaparecen.)

- **Tras aplicar, verificar:** `bun run test src/__tests__/architecture/no-raw-table.test.ts` pasa y falla si se agrega un `<table>` nuevo fuera de la lista. En las pantallas migradas: encabezados en mayúsculas 11px (`text-table-head`), hover uniforme, estado vacío consistente, clic de fila sigue navegando y el lector de pantalla anuncia el `aria-label` de la fila.

---

### [UX-04] Labels sin asociación programática con su input
- **Severidad:** P2 · **Verificación:** estático
- **Archivos:** patrón central `src/components/shared/FormField.tsx` (líneas 42-60, usado por los wizards). Diálogos puntuales: `src/features/cliente/components/DialogContacto.tsx` (9 campos), `src/features/proveedor/components/EditarProveedorBancariosFields.tsx` (10), `NuevoProveedorStep2.tsx` (10), `src/features/crm/components/nuevoLead/NuevoLeadForm.tsx` (7), `src/features/embarques/components/DialogSeguroForm.tsx` (9). ~193 pares Label→Input sin `htmlFor`/`id` en total.
- **Problema:** `FormField` renderiza `<Label>` sin `htmlFor` y no inyecta `id` al hijo; el error tampoco se vincula con `aria-describedby`. Los lectores de pantalla no anuncian la etiqueta al enfocar el campo y el clic en el label no enfoca el input (WCAG 1.3.1 / 3.3.2).
- **Fix (instrucción para Lovable):** dos pasos.
  1. **Fix central (un archivo, efecto multiplicador):** reescribir `FormField` con `useId()`; si el hijo es un único elemento válido sin `id` propio, clonarlo inyectando `id`, `aria-invalid` y `aria-describedby` (apunta al `<p>` del error). Así todos los wizards quedan asociados sin tocar consumidores. Nota: para `<Select>` de shadcn el `id` debe llegar al `SelectTrigger`; en los consumidores donde el hijo sea `<Select>`, el clon va al root de Radix y no asocia — esos casos se cubren en el paso 2 poniendo el `id` manual en el `SelectTrigger`.
  2. **Diálogos puntuales:** en los 5 archivos listados, agregar `htmlFor`/`id` explícitos por campo (id estable por nombre de campo, p. ej. `id="contacto-nombre"`).
- **Diff / código:**

Paso 1 — `src/components/shared/FormField.tsx`:

```diff
-import { ReactNode } from "react";
+import { Children, ReactNode, cloneElement, isValidElement, useId } from "react";
 import { Label } from "@/components/ui/label";
 import { cn } from "@/lib/utils";
@@
 }: FormFieldProps) {
+  const id = useId();
+  const errorId = `${id}-error`;
   const spanClass =
     span === 2 ? "md:col-span-2"
     : span === "full" ? "col-span-full"
     : "";
+
+  // Inyecta id/aria al control hijo cuando es un único elemento sin id propio
+  // (Input, Textarea…). Para <Select> el consumidor debe poner el id en
+  // <SelectTrigger> y pasarlo vía props (Radix no lo reenvía desde el root).
+  const control =
+    Children.count(children) === 1 &&
+    isValidElement(children) &&
+    !(children.props as { id?: string }).id
+      ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
+          id,
+          "aria-invalid": error ? true : undefined,
+          "aria-describedby": error ? errorId : undefined,
+        })
+      : children;
 
   return (
     <div className={cn("space-y-2", spanClass, className)}>
       {label && (
-        <Label className="text-sm font-medium">
+        <Label htmlFor={id} className="text-sm font-medium">
           {label}
           {required && <span className="text-destructive ml-0.5">*</span>}
           {hint && (
             <span className="text-xs text-muted-foreground font-normal ml-2">
               {hint}
             </span>
           )}
         </Label>
       )}
-      {children}
+      {control}
       {error && (
-        <p className="text-xs text-destructive" role="alert">
+        <p id={errorId} className="text-xs text-destructive" role="alert">
           {error}
         </p>
       )}
     </div>
   );
 }
```

Paso 2 — ejemplo real en `src/features/cliente/components/DialogContacto.tsx`:

```diff
-        <div><Label className="text-xs">Tax ID</Label><Input value={form.rfc} onChange={e => handleChange('rfc', e.target.value)} className="mt-1" /></div>
-        <div><Label className="text-xs">País</Label><Input value={form.pais} onChange={e => handleChange('pais', e.target.value)} className="mt-1" /></div>
-        <div><Label className="text-xs">Ciudad</Label><Input value={form.ciudad} onChange={e => handleChange('ciudad', e.target.value)} className="mt-1" /></div>
+        <div><Label htmlFor="contacto-rfc" className="text-xs">Tax ID</Label><Input id="contacto-rfc" value={form.rfc} onChange={e => handleChange('rfc', e.target.value)} className="mt-1" /></div>
+        <div><Label htmlFor="contacto-pais" className="text-xs">País</Label><Input id="contacto-pais" value={form.pais} onChange={e => handleChange('pais', e.target.value)} className="mt-1" /></div>
+        <div><Label htmlFor="contacto-ciudad" className="text-xs">Ciudad</Label><Input id="contacto-ciudad" value={form.ciudad} onChange={e => handleChange('ciudad', e.target.value)} className="mt-1" /></div>
```
(Replicar en los 9 campos de ese diálogo: `contacto-nombre`, `contacto-tipo` en el `SelectTrigger`, `contacto-direccion`, `contacto-contacto`, `contacto-email`, `contacto-telefono`.)

- **Tras aplicar, verificar:** en cualquier wizard que use `FormField` (p. ej. alta de embarque), clic en el label enfoca el input; con lector de pantalla (o DevTools → Accessibility) el campo anuncia su etiqueta y, cuando hay error, lo lee vía `aria-describedby`. En `DialogContacto`, los 9 campos quedan asociados. Los tests existentes de FormField (si los hay) siguen pasando.

---

### [UX-05] Portal cliente: spinner genérico y error sin retry en "Mi Perfil"
- **Severidad:** P2 · **Verificación:** estático
- **Archivos:** `src/features/portal/routes/PortalPerfil.tsx` (líneas 28-42).
- **Problema:** `isLoading` → `<Loader2>` full-page (no skeleton, salto de layout al cargar); `isError` → texto plano "No se pudo cargar tu perfil." sin botón de reintento ni `refetch`. En la superficie cara al cliente, un fallo de red es un callejón sin salida (equivale a UIB-05).
- **Fix (instrucción para Lovable):** reemplazar ambos bloques por el patrón canónico `AsyncBoundary` (ya usado en `TesoreriaCuentas.tsx:57`) con `PageSkeleton` y `onRetry={refetch}`. `usePortalPerfil` es un `useQuery` estándar, así que `refetch` ya está disponible — sólo hay que desestructurarlo.
- **Diff / código:** `src/features/portal/routes/PortalPerfil.tsx`:

```diff
 import { useState } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
-import { Loader2, Pencil, KeyRound, User as UserIcon, Building2 } from "lucide-react";
+import { Pencil, KeyRound, User as UserIcon, Building2 } from "lucide-react";
 import { usePortalPerfil } from "@/features/portal/hooks";
 import { EditarContactoDialog } from "@/features/portal/components/perfil/EditarContactoDialog";
 import { CambiarPasswordDialog } from "@/features/portal/components/perfil/CambiarPasswordDialog";
 import { PageHeader } from "@/components/shared/PageHeader";
+import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";
+import { PageSkeleton } from "@/components/shared/skeletons";
 import { useDocumentTitle } from "@/hooks/shared";
@@
   useDocumentTitle('Mi perfil');
-  const { data, isLoading, isError } = usePortalPerfil();
+  const { data, isLoading, isError, refetch } = usePortalPerfil();
   const [editContacto, setEditContacto] = useState(false);
   const [cambiarPass, setCambiarPass] = useState(false);
 
-  if (isLoading) {
-    return (
-      <div className="flex items-center justify-center py-20">
-        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
-      </div>
-    );
-  }
-
-  if (isError || !data) {
+  if (isLoading || isError || !data) {
     return (
-      <div className="py-20 text-center text-sm text-muted-foreground">
-        No se pudo cargar tu perfil.
-      </div>
+      <AsyncBoundary
+        isLoading={isLoading}
+        isError={isError || !data}
+        onRetry={() => refetch()}
+        skeleton={<PageSkeleton />}
+        errorTitle="No se pudo cargar tu perfil"
+        errorDescription="Revisa tu conexión e inténtalo de nuevo."
+      >
+        {null}
+      </AsyncBoundary>
     );
   }
```

- **Tras aplicar, verificar:** entrar a `/portal/perfil`: durante la carga se ve el skeleton (header + bloque, sin salto); con red bloqueada (DevTools → offline) aparece el `ErrorState` "No se pudo cargar tu perfil" con botón **Reintentar** que dispara `refetch` y recupera la vista al volver la red. Además, `AsyncBoundary` cubre el caso de carga colgada (>20 s) con mensaje "Está tardando más de lo normal".

---

### [UX-06] Botones solo-icono sin nombre accesible
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/configuracion/components/CatalogoClavesSATCard.tsx` (107, 108) y `CatalogoClavesSATCard.parts.tsx` (52, 53); `src/features/embarques/components/facturacion/HistorialProformas.tsx` (123); `src/features/facturacion/components/detalle/FacturaTimbradoCard.tsx` (82, copiar UUID); `src/features/portal-agente/routes/_sections/agenteTarifasColumns.tsx` (137); `src/features/crm/components/PlantillasMensajeEditor.tsx` (130). Plus i18n: `src/components/ui/sidebar.tsx` (231 `sr-only` "Toggle Sidebar"; también `SidebarRail` con `aria-label="Toggle Sidebar"`).
- **Problema:** 8 botones que sólo contienen un ícono y no tienen `aria-label` — el lector de pantalla los anuncia como "botón" sin propósito. Además el nombre accesible del sidebar está en inglés en una app es-MX.
- **Fix (instrucción para Lovable):** agregar `aria-label` descriptivo (una línea por botón, con el nombre del registro cuando aplique) y traducir los dos textos del sidebar.
- **Diff / código:** diffs reales:

`src/features/configuracion/components/CatalogoClavesSATCard.tsx`:
```diff
-                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)} disabled={busy}><Pencil className="h-4 w-4" /></Button>
-                    <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(r.id)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
+                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)} disabled={busy} aria-label={`Editar producto ${r.patron}`}><Pencil className="h-4 w-4" /></Button>
+                    <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(r.id)} disabled={busy} aria-label={`Eliminar producto ${r.patron}`}><Trash2 className="h-4 w-4" /></Button>
```
(Nota: el `onClick` del delete cambia al confirmador de UX-01; el `aria-label` se conserva.)

`src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx`:
```diff
-        <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy}><X className="h-4 w-4" /></Button>
-        <Button size="icon" onClick={onSave} disabled={busy || !valid}><Check className="h-4 w-4" /></Button>
+        <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy} aria-label="Cancelar edición"><X className="h-4 w-4" /></Button>
+        <Button size="icon" onClick={onSave} disabled={busy || !valid} aria-label="Guardar producto"><Check className="h-4 w-4" /></Button>
```

`src/features/embarques/components/facturacion/HistorialProformas.tsx`:
```diff
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-8 w-8"
                 onClick={(e) => e.stopPropagation()}
+                aria-label={`Acciones de la proforma ${p.numero}`}
               >
                 <MoreHorizontal className="h-4 w-4" />
               </Button>
```

`src/features/facturacion/components/detalle/FacturaTimbradoCard.tsx`:
```diff
-              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copiarUuid}>
+              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copiarUuid} aria-label="Copiar folio fiscal (UUID)">
                 <Copy className="h-3 w-3" />
               </Button>
```

`src/features/portal-agente/routes/_sections/agenteTarifasColumns.tsx`:
```diff
-                <Button variant="ghost" size="icon">
+                <Button variant="ghost" size="icon" aria-label={`Acciones de la tarifa ${t.ruta ?? t.id}`}>
                   <MoreHorizontal className="h-4 w-4" />
                 </Button>
```
(usar el campo de nombre/ruta real del tipo; si no existe, `aria-label="Acciones de la tarifa"`).

`src/features/crm/components/PlantillasMensajeEditor.tsx`:
```diff
                     <Button
                       size="icon"
                       variant="ghost"
                       className="h-8 w-8 text-destructive"
                       onClick={() => setAEliminar({ id: p.id, nombre: p.nombre })}
+                      aria-label={`Eliminar plantilla ${p.nombre}`}
                     >
                       <Trash2 className="h-3.5 w-3.5" />
```

`src/components/ui/sidebar.tsx` (traducción es-MX):
```diff
-        <span className="sr-only">Toggle Sidebar</span>
+        <span className="sr-only">Mostrar u ocultar la barra lateral</span>
@@
-        aria-label="Toggle Sidebar"
+        aria-label="Mostrar u ocultar la barra lateral"
```

- **Tras aplicar, verificar:** con DevTools → Accessibility tree (o NVDA/VoiceOver), los 8 botones anuncian su propósito con el nombre del registro; el botón del sidebar se anuncia en español. `grep -rn "Toggle Sidebar" src` debe quedar en 0.

---

### [UX-07] Switches de tablas/ajustes sin `aria-label`
- **Severidad:** P3 · **Verificación:** estático
- **Archivos (15 casos):** `src/features/configuracion/components/TabNavieras.tsx` (45), `TabPuertos.tsx` (44), `TabTiposContenedor.tsx` (42), `src/features/admin/components/TabPlanes.tsx` (129), `src/features/comisiones/components/TabVendedorasConfig.tsx` (117), `src/features/crm/components/EtapasPipelineEditor.tsx` (124 y 128), `MotivosPerdidaEditor.tsx` (52). Además `CatalogoClavesSATCard.parts.tsx` (50, switch "Activo" del draft).
- **Problema:** el switch "Activo" de cada fila se anuncia como "interruptor" sin contexto — en una tabla de 20 filas son 20 "interruptor" indistinguibles.
- **Fix (instrucción para Lovable):** agregar `aria-label` con la acción + nombre del registro (una línea por switch). Patrón: `aria-label={\`Activar ${entidad} ${row.original.nombre}\`}` (o `Desactivar…` según `checked`; opcional pero mejor: `aria-label={checked ? \`Desactivar X\` : \`Activar X\`}`).
- **Diff / código:** diffs reales:

`src/features/configuracion/components/TabNavieras.tsx` (idéntico patrón en `TabPuertos.tsx:44` con `puerto`/`name`, y `TabTiposContenedor.tsx:42` con `tipo de contenedor`/`name`):
```diff
-      cell: ({ row }) => <Switch checked={row.original.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: row.original.id, activo: checked })} />,
+      cell: ({ row }) => <Switch checked={row.original.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: row.original.id, activo: checked })} aria-label={row.original.activo ? `Desactivar naviera ${row.original.name}` : `Activar naviera ${row.original.name}`} />,
```

`src/features/admin/components/TabPlanes.tsx`:
```diff
         <Switch
           checked={row.original.activo}
           onCheckedChange={(checked) => updatePlan.mutate({ id: row.original.id, activo: checked })}
+          aria-label={row.original.activo ? `Desactivar plan ${row.original.nombre}` : `Activar plan ${row.original.nombre}`}
         />
```

`src/features/comisiones/components/TabVendedorasConfig.tsx`:
```diff
-                    <Switch checked={c.activa} onCheckedChange={(v) => toggleActiva(c.id, v)} />
+                    <Switch checked={c.activa} onCheckedChange={(v) => toggleActiva(c.id, v)} aria-label={c.activa ? `Desactivar comisión de ${c.nombre}` : `Activar comisión de ${c.nombre}`} />
```

`src/features/crm/components/EtapasPipelineEditor.tsx` (dos switches):
```diff
-                  <Switch checked={d.activa} onCheckedChange={(v) => set(e.id, { activa: v })} />
+                  <Switch checked={d.activa} onCheckedChange={(v) => set(e.id, { activa: v })} aria-label={`Etapa ${e.nombre} activa`} />
@@
-                  <Switch checked={d.crea_tarea_seguimiento} onCheckedChange={(v) => set(e.id, { crea_tarea_seguimiento: v })} />
+                  <Switch checked={d.crea_tarea_seguimiento} onCheckedChange={(v) => set(e.id, { crea_tarea_seguimiento: v })} aria-label={`Crear tarea de seguimiento al entrar a ${e.nombre}`} />
```

`src/features/crm/components/MotivosPerdidaEditor.tsx`:
```diff
-              <Switch checked={m.activa} onCheckedChange={(v) => toggle(m.id, v)} />
+              <Switch checked={m.activa} onCheckedChange={(v) => toggle(m.id, v)} aria-label={m.activa ? `Desactivar motivo ${m.nombre}` : `Activar motivo ${m.nombre}`} />
```

`src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx`:
```diff
-      <TableCell><Switch checked={draft.activo} onCheckedChange={(v) => p({ activo: v })} /></TableCell>
+      <TableCell><Switch checked={draft.activo} onCheckedChange={(v) => p({ activo: v })} aria-label="Producto activo" /></TableCell>
```

- **Tras aplicar, verificar:** recorrer las tablas de Configuración/Admin/CRM con Tab + lector de pantalla: cada switch anuncia "Activar naviera Maersk Line", "Etapa Negociación activa", etc. Los toggles siguen funcionando igual (sólo se agregó un atributo).

---

### [UX-08] `<Label>` con clases extra (`text-xs`) contra la regla del DS
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** 140 hits en 54 archivos. Peores: `src/features/cliente/components/DialogContacto.tsx` (9), `src/features/cotizacion/components/conceptos/ConceptoRowMXN.tsx` (8) y `ConceptoRowUSD.tsx` (7), `src/features/embarques/components/contenedores/FilaContenedor.tsx` (6), `src/features/compras/routes/ComprasPagos.tsx` (5).
- **Problema:** design-system.md §6 prohíbe `className` en `Label` ("Etiquetas: componente `<Label>` sin clases extra"). Los overrides `text-xs` generan tamaños de etiqueta inconsistentes entre formularios. Caso legítimo detectado: "micro-label" en filas de tablas editables (ConceptoRow*, FilaContenedor).
- **Fix (instrucción para Lovable):** dos pasos.
  1. Declarar la variante en el primitivo: `src/components/ui/label.tsx` ya usa `cva` — agregar variante `size: { default, xs }` donde `xs` aplica `text-xs` (para micro-labels de filas editables).
  2. Migrar los 140 usos: los labels de formulario normal → `<Label>` sin clases (borrar `className="text-xs"`); los micro-labels de filas editables → `<Label size="xs">`. Empezar por los 5 archivos peores listados.
- **Diff / código:**

`src/components/ui/label.tsx`:
```diff
-const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");
+const labelVariants = cva("font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", {
+  variants: {
+    size: {
+      default: "text-sm",
+      /** Micro-label para filas de tablas editables (ConceptoRow*, FilaContenedor). */
+      xs: "text-xs",
+    },
+  },
+  defaultVariants: { size: "default" },
+});
 
-const Label = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants> & { ref?: React.Ref<React.ElementRef<typeof LabelPrimitive.Root>> }) => (
-  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
+const Label = ({ ref, className, size, ...props }: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants> & { ref?: React.Ref<React.ElementRef<typeof LabelPrimitive.Root>> }) => (
+  <LabelPrimitive.Root ref={ref} className={cn(labelVariants({ size }), className)} {...props} />
 );
```

Migración — ejemplo real en `src/features/cliente/components/DialogContacto.tsx` (labels de formulario: quitar la clase):
```diff
-          <Label className="text-xs">Nombre<span className="text-destructive ml-0.5">*</span></Label>
+          <Label>Nombre<span className="text-destructive ml-0.5">*</span></Label>
```
y en filas editables (`ConceptoRowMXN.tsx`, `ConceptoRowUSD.tsx`, `FilaContenedor.tsx`):
```diff
-        <Label className="text-xs">…</Label>
+        <Label size="xs">…</Label>
```

- **Tras aplicar, verificar:** `grep -rn '<Label className="text-xs"' src` tiende a 0; los formularios muestran etiquetas uniformes a `text-sm`; las filas de conceptos/contenedores conservan el micro-label vía variante. No debe haber cambio visual fuera de las etiquetas que se normalizan a 14px.

---

### [UX-09] Cifras KPI sin el token `text-kpi`
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/bandejas/routes/_sections/CarteraKpis.tsx` (44, 49, 56 — `text-2xl`), `src/features/dashboard/direccion/components/HeroCards.tsx` (33, 42, 50 — `text-3xl`), `src/features/operaciones/routes/Operaciones.tsx` (109-117 — `text-xl`), `src/features/embarques/components/TabPnl.tsx` (127, 135 — `text-xl`).
- **Problema:** el DS define el token `text-kpi` (clamp 18→24px, peso 600, verificado en `tailwind.config.ts:49`) exactamente para cifras de KPI; estos archivos usan tamaños fijos ad-hoc (`text-xl/2xl/3xl`) → KPIs de distinto tamaño entre pantallas y sin ajuste responsivo.
- **Fix (instrucción para Lovable):** reemplazo mecánico en los 4 archivos: la clase de tamaño (`text-xl`/`text-2xl`/`text-3xl`) → `text-kpi` en los contenedores de la cifra, conservando `font-semibold`/`font-bold` y el resto de clases (`tabular-nums`, tonos). `text-kpi` ya incluye peso 600, así que `font-semibold` puede omitirse donde esté; conservarlo es inocuo.
- **Diff / código:** diffs reales:

`src/features/bandejas/routes/_sections/CarteraKpis.tsx`:
```diff
-        <CardContent className="text-2xl font-semibold">{p.totalFacturas}</CardContent>
+        <CardContent className="text-kpi">{p.totalFacturas}</CardContent>
@@
-          <div className="text-2xl font-semibold tabular-nums">{formatNativos(p.saldosNativos)}</div>
+          <div className="text-kpi tabular-nums">{formatNativos(p.saldosNativos)}</div>
@@
-          <div className="text-2xl font-semibold text-destructive tabular-nums">
+          <div className="text-kpi text-destructive tabular-nums">
```

`src/features/dashboard/direccion/components/HeroCards.tsx`:
```diff
-        <p className="mt-2 text-3xl font-semibold tabular-nums">{fmt(hero.utilidad_mxn)}</p>
+        <p className="mt-2 text-kpi tabular-nums">{fmt(hero.utilidad_mxn)}</p>
@@
-        <p className="mt-2 text-3xl font-semibold tabular-nums text-destructive">{fmt(hero.cartera_vencida_mxn)}</p>
+        <p className="mt-2 text-kpi tabular-nums text-destructive">{fmt(hero.cartera_vencida_mxn)}</p>
@@
-        <p className="mt-2 text-3xl font-semibold tabular-nums">{fmt(hero.facturado_mes_mxn)}</p>
+        <p className="mt-2 text-kpi tabular-nums">{fmt(hero.facturado_mes_mxn)}</p>
```

`src/features/operaciones/routes/Operaciones.tsx`:
```diff
-              <p className="text-xl font-bold text-kpi-info">{creadasEsteMes}</p>
+              <p className="text-kpi text-kpi-info">{creadasEsteMes}</p>
@@
-              <p className="text-xl font-bold text-kpi-success">{llegadasEsteMes}</p>
+              <p className="text-kpi text-kpi-success">{llegadasEsteMes}</p>
@@
-              <p className="text-xl font-bold text-primary-foreground">{global.activasHoy}</p>
+              <p className="text-kpi text-primary-foreground">{global.activasHoy}</p>
```

`src/features/embarques/components/TabPnl.tsx`:
```diff
-            <div className="text-xl font-semibold">{fmtPnl(data.venta.pdte_cobro_mxn)}</div>
+            <div className="text-kpi">{fmtPnl(data.venta.pdte_cobro_mxn)}</div>
@@
-            <div className="text-xl font-semibold">{fmtPnl(data.costo.pdte_pago_mxn)}</div>
+            <div className="text-kpi">{fmtPnl(data.costo.pdte_pago_mxn)}</div>
```

- **Tras aplicar, verificar:** comparar Dashboard Dirección, Cartera, Operaciones y P&L de embarque: las cifras KPI usan la misma escala (18px en móvil → 24px en escritorio). No hay otro cambio visual.

---

### [UX-10] Montos con `.toFixed()` sin separador de miles en mensajes visibles
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/cxp/services/pagoProveedorValidaciones.ts` (182, 190), `src/features/cxp/hooks/useNuevaFacturaProveedorForm.guard.ts` (40), `src/features/dashboardEjecutivo/services/alertas.ts` (33, 48, 63), `src/features/cxp/components/ConciliacionPagoCell.tsx` (50 — fecha `dd/MM/yy`).
- **Problema:** mensajes visibles al usuario muestran montos crudos tipo "difere del total en 12345.6 MXN" sin separador de miles, y una fecha con año de 2 dígitos (el resto de la app usa `dd/MM/yyyy`, DS §3).
- **Fix (instrucción para Lovable):** usar `formatCurrency` / `formatNumber` de `@/lib/formatters` (importables en services y hooks; son funciones puras). Regla: montos → `formatCurrency(valor, moneda)` (devuelve "MXN 12,345.60"); números con decimales sin moneda → `formatNumber(v, { decimals: 2 })`; porcentajes de tasas → conservar `toFixed(2)` (no es monto). Fecha → `dd/MM/yyyy`.
- **Diff / código:** diffs reales:

`src/features/cxp/services/pagoProveedorValidaciones.ts`:
```diff
+import { formatCurrency } from "@/lib/formatters";
@@
   if (descuadre !== 0) {
     avisos.push(
-      `Los totales de la factura no cuadran: subtotal + IVA + IEPS − retenciones difiere del total en ${descuadre.toFixed(2)} ${f.moneda}. Revisa la captura antes de pagar.`,
+      `Los totales de la factura no cuadran: subtotal + IVA + IEPS − retenciones difiere del total en ${formatCurrency(descuadre, f.moneda)}. Revisa la captura antes de pagar.`,
     );
   }
```
(La línea 190, `tasa.toFixed(2)}%`, es un porcentaje: **conservarla como está**.)

`src/features/cxp/hooks/useNuevaFacturaProveedorForm.guard.ts`:
```diff
+import { formatCurrency } from "@/lib/formatters";
@@
-      description: `Suma de conceptos ${cuadreManual.suma.toFixed(2)} vs subtotal ${subtotal.toFixed(2)}. Ajusta la diferencia (tolerancia 0.01).`,
+      description: `Suma de conceptos ${formatCurrency(cuadreManual.suma, moneda)} vs subtotal ${formatCurrency(subtotal, moneda)}. Ajusta la diferencia (tolerancia 0.01).`,
```
(`moneda` ya existe en el contexto del form; si el guard no la recibe, usar `"MXN"` como default igual que el resto del flujo.)

`src/features/dashboardEjecutivo/services/alertas.ts`:
```diff
+import { formatCurrency } from "@/lib/formatters";
@@
-      descripcion: `Semana ${primera.semana_iso}: saldo estimado ${primera.saldo_proyectado_mxn.toFixed(0)} MXN`,
+      descripcion: `Semana ${primera.semana_iso}: saldo estimado ${formatCurrency(primera.saldo_proyectado_mxn, "MXN")}`,
@@
-        ? `Top: ${top.nombre} (${top.saldo.toFixed(0)} ${top.moneda})`
+        ? `Top: ${top.nombre} (${formatCurrency(top.saldo, top.moneda)})`
@@
-        ? `Top: ${top.nombre} (${top.saldo.toFixed(0)} ${top.moneda})`
+        ? `Top: ${top.nombre} (${formatCurrency(top.saldo, top.moneda)})`
```
(Nota: `formatCurrency` redondea a 2 decimales por defecto; si se prefiere 0 decimales en estas alertas, usar `formatNumber(top.saldo, { decimals: 0, suffix: top.moneda })` — mismo archivo de formatters. Elegir uno y aplicarlo parejo.)

`src/features/cxp/components/ConciliacionPagoCell.tsx`:
```diff
-          <span className="tabular-nums">{format(new Date(movimiento.fecha + "T00:00:00"), "dd/MM/yy")} · {formatCurrency(Number(movimiento.cargo), "MXN")}</span>
+          <span className="tabular-nums">{format(new Date(movimiento.fecha + "T00:00:00"), "dd/MM/yyyy")} · {formatCurrency(Number(movimiento.cargo), "MXN")}</span>
```

- **Tras aplicar, verificar:** capturar una factura de proveedor con descuadre de 12,345.60: el aviso dice "…en MXN 12,345.60". En el dashboard ejecutivo con saldo negativo proyectado, la alerta muestra separador de miles. En conciliación de pagos la fecha del movimiento muestra año completo (p. ej. 04/03/2025). Los tests de `pagoProveedorValidaciones` y `alertas` (existen en `__tests__`) deben actualizarse si asertan el texto exacto.

---

### [UX-11] Spinners de botón reimplementados vs prop `loading`
- **Severidad:** P3 · **Verificación:** estático
- **Archivos (20):** `src/features/cliente/components/DialogContacto.tsx` (63-64), `DialogEditarCliente.tsx`, `src/features/auth/components/LoginForm.tsx` (109), `SignupForm.tsx`, `src/features/crm/components/ImportarLeadsCsvDialog.tsx`, `src/features/cxp/components/CargaCfdiSection.tsx`, `src/components/shared/dialogs/CambiarPasswordDialog.tsx`, y el resto del conjunto (buscar con `grep -rln 'isPending && <Loader2\|isSaving && <Loader2\|loading && <Loader2\|isSubmitting && <Loader2' src`).
- **Problema:** DS §7 prohíbe reimplementar el Loader2 en botones. `ui/button.tsx` ya expone la prop `loading` (spinner + `disabled` + `aria-busy` automáticos, verificado en líneas 57-88) y ya se usa en ~40 sitios — adopción parcial.
- **Fix (instrucción para Lovable):** migración mecánica por archivo: reemplazar `{isX && <Loader2 className="h-4 w-4 animate-spin …" />}` dentro de un `<Button>` por la prop `loading={isX}` en ese `Button`, y quitar el `disabled={isX}` redundante (Button deshabilita solo cuando `loading`); conservar `disabled` si combina otras condiciones (`disabled={!form.nombre.trim()}`). Eliminar el import de `Loader2` si queda sin uso.
- **Diff / código:** diffs reales:

`src/features/cliente/components/DialogContacto.tsx`:
```diff
-          <Button onClick={handleSubmit} disabled={!form.nombre.trim() || isSaving}>
-            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
-            {contacto ? 'Guardar Cambios' : 'Agregar'}
-          </Button>
+          <Button onClick={handleSubmit} loading={isSaving} disabled={!form.nombre.trim()}>
+            {contacto ? 'Guardar Cambios' : 'Agregar'}
+          </Button>
```
(y quitar `Loader2` del import de `lucide-react` en la línea 2).

`src/features/auth/components/LoginForm.tsx` (línea 109):
```diff
-        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
```
→ mover `loading={loading}` al `<Button type="submit">` correspondiente y borrar la línea del Loader2 (y el import si queda huérfano).

- **Tras aplicar, verificar:** en login, alta de contacto y los demás formularios migrados: al enviar, el botón muestra spinner, queda deshabilitado y expone `aria-busy="true"`; no hay doble spinner ni layout shift. `grep -rn 'Loader2' <archivos migrados>` no muestra usos dentro de `<Button>`.

---

### [UX-12] Componentes duplicados entre CxP y Facturación
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/cxp/components/DialogPagoLoteRenglones.tsx` vs `src/features/facturacion/components/DialogCobroLoteRenglones.tsx` (87% idénticos, diff verificado). Badges `text-[10px]`: líneas 63/66 (CxP), 60/63 (Facturación) y `src/features/embarques/components/entrantes/ConceptosSugeridosEntrante.tsx` (57).
- **Problema:** dos tablas de reparto en lote casi idénticas que ya empezaron a divergir (una usa `folio_proveedor` + `toTitleCase`, la otra `numero`); ambas con encabezados `text-xs` y badges con tamaño arbitrario `text-[10px]` (el token `text-2xs` existe en `tailwind.config.ts:52`).
- **Fix (instrucción para Lovable):**
  1. **Quick win (release, obligatorio):** `text-[10px]` → `text-2xs` en los 5 badges (3 archivos).
  2. **Extracción (mismo PR o inmediato después):** crear `src/components/shared/LoteRenglonesTable.tsx` parametrizado por `facturas`, `renglones`, `moneda`, `onMontoChange` y un accesor de folio (`getFolio: (f) => string`, así CxP pasa `f.folio_proveedor` y Facturación `f.numero`) — el cuerpo de la tabla (thead/tbody/zebra/badges/input de importe) vive una sola vez. Los dos diálogos pasan a ser wrappers delgados tipados con sus tipos propios (`FacturaLoteCandidata`/`RenglonLote` vs `FacturaCobroCandidata`/`RenglonCobro`), como ya hace `ConfirmDeleteAlert` sobre `ConfirmActionDialog`. Encabezados con `text-table-head` vía `DetailTableHead` o el token equivalente.
- **Diff / código:**

Quick win — `src/features/cxp/components/DialogPagoLoteRenglones.tsx` (idéntico en `DialogCobroLoteRenglones.tsx:60,63`):
```diff
-                      <Badge variant="outline" className="text-[10px]">Liquidada</Badge>
+                      <Badge variant="outline" className="text-2xs">Liquidada</Badge>
@@
-                      <Badge variant="secondary" className="text-[10px]">Parcial</Badge>
+                      <Badge variant="secondary" className="text-2xs">Parcial</Badge>
```

`src/features/embarques/components/entrantes/ConceptosSugeridosEntrante.tsx`:
```diff
-            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">ya facturado</Badge>
+            <Badge variant="secondary" className="h-4 px-1.5 text-2xs">ya facturado</Badge>
```

Extracción — esqueleto del componente compartido (nuevo archivo `src/components/shared/LoteRenglonesTable.tsx`), derivado del diff real de ambos (las únicas diferencias son el accesor de folio y los tipos):
```tsx
interface LoteRenglonesTableProps<F, R> {
  facturas: F[];
  renglones: R[];
  moneda: string;
  getFolio: (f: F) => string;
  getFacturaId: (r: R) => string;
  getMonto: (r: R) => number;
  onMontoChange: (facturaId: string, monto: number) => void;
}

export function LoteRenglonesTable<F, R>({ getFolio, ... }: LoteRenglonesTableProps<F, R>) {
  // Cuerpo único: <thead> con encabezados, zebra, badges "Liquidada"/"Parcial"
  // (text-2xs), <Input> de importe alineado a la derecha con
  // aria-label={`Importe aplicado a la factura ${getFolio(f)}`}.
}
```
y los wrappers:
```tsx
// DialogPagoLoteRenglones.tsx
<LoteRenglonesTable facturas={facturas} renglones={renglones} moneda={moneda}
  getFolio={(f) => toTitleCase(f.folio_proveedor ?? "") || "—"} … />
// DialogCobroLoteRenglones.tsx
<LoteRenglonesTable facturas={facturas} renglones={renglones} moneda={moneda}
  getFolio={(f) => f.numero ?? "—"} … />
```

- **Tras aplicar, verificar:** abrir "Pago en lote" (CxP) y "Cobro en lote" (Facturación): ambas tablas se ven idénticas (zebra, badges 10px vía token, encabezados con tipografía del DS), el reparto de importes sigue funcionando en ambos flujos y los tests de los servicios `pagoProveedorLote`/`pagoClienteLote` no se tocan (la extracción es sólo de vista).

---

### [UX-13] Grids fijos de 2+ columnas sin breakpoint en formularios
- **Severidad:** P3 · **Verificación:** estático
- **Archivos (62 clases en ~40 archivos; formularios primero):** `src/features/cliente/components/DialogContacto.tsx` (69), `src/features/crm/components/NuevaActividadDialog.tsx`, `src/features/proveedor/components/DireccionFiscalFields.tsx`, `src/features/costeo/components/TarifaFormFields.tsx`, `NuevaTarifaDemoraDialog.tsx`, `NavieraCondicionForm.tsx`, `CosteoAgenteFormDialog.tsx`, `BuscarTarifaDialog.tsx`, etc. (lista completa: `grep -rln 'grid grid-cols-2' src/features`).
- **Problema:** `grid grid-cols-2` (sin `sm:`/`md:`) en diálogos de formulario deja los campos a mitad de ancho en móvil — en `DialogContacto` son 9 campos ilegibles en pantalla angosta. El componente `FormDialogSection` ya resuelve 1col móvil / 2col desktop (`grid-cols-1 md:grid-cols-2`, verificado) y estos formularios lo esquivan.
- **Fix (instrucción para Lovable):** en diálogos de formulario, migrar el contenedor a `<FormDialogSection>` cuando haya título de sección, o como mínimo cambiar la clase a `grid grid-cols-1 sm:grid-cols-2` (y los `col-span-2` internos a `sm:col-span-2`). No tocar grids de dashboards/KPIs que no son formularios (p. ej. `TarifasKpis.tsx`, `ClienteSummaryCards.tsx`) salvo que se vean rotos en móvil.
- **Diff / código:** ejemplo real en `src/features/cliente/components/DialogContacto.tsx`:

```diff
-      <div className="grid grid-cols-2 gap-4">
-        <div className="col-span-2">
+      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
+        <div className="sm:col-span-2">
           <Label className="text-xs">Nombre<span className="text-destructive ml-0.5">*</span></Label>
           <Input value={form.nombre} onChange={e => handleChange('nombre', e.target.value)} className="mt-1" />
         </div>
@@
-        <div className="col-span-2"><Label className="text-xs">Dirección</Label><Input value={form.direccion} onChange={e => handleChange('direccion', e.target.value)} className="mt-1" /></div>
+        <div className="sm:col-span-2"><Label className="text-xs">Dirección</Label><Input value={form.direccion} onChange={e => handleChange('direccion', e.target.value)} className="mt-1" /></div>
```
(Aplicar el mismo cambio en `NuevaActividadDialog.tsx`, `DireccionFiscalFields.tsx`, `TarifaFormFields.tsx` y el resto de diálogos de formulario. Donde el grid tenga encabezado de sección, preferir `<FormDialogSection title="…">` que ya trae el grid responsivo.)

- **Tras aplicar, verificar:** abrir los diálogos migrados con viewport de 375px: los campos ocupan una columna a ancho completo; a ≥640px vuelven a 2 columnas. No hay overflow horizontal ni campos a medio ancho.

---

### [UX-14] Ruta pública `/logo-preview` con hex hardcodeados
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/routes/publicRoutes.tsx` (línea 35), `src/features/marketing/routes/LogoPreview.tsx` (9 hex + 3 `text-white`, verificado — único archivo servido que viola la regla #1 del DS).
- **Problema:** herramienta interna de QA de logo expuesta sin autenticación (indexable/visible públicamente) y con colores hex hardcodeados (`#0B1B3A`, `#2563EB`, `bg-white`, `text-white`) en vez de tokens.
- **Fix (instrucción para Lovable):** opción A (recomendada, mínimo dif): servir la ruta sólo en desarrollo — envolver la entrada de ruta con `import.meta.env.DEV`. Opción B: mover la ruta detrás del bloque autenticado de admin. Los hex del archivo pueden quedar mientras la ruta no se sirva en producción (son fondos de prueba deliberados); si se prefiere limpieza total, mapear los fondos a tokens (`bg-background`, `bg-muted`, `bg-primary`, `text-primary-foreground`) en el mismo archivo.
- **Diff / código:** `src/routes/publicRoutes.tsx`:

```diff
-    <Route path="/logo-preview" element={<LogoPreview />} />
+    {/* QA interno del logo (UX-14): sólo en desarrollo, nunca en build público. */}
+    {import.meta.env.DEV && <Route path="/logo-preview" element={<LogoPreview />} />}
```
(El `import` de `LogoPreview` puede conservarse — ya está code-spliteado por lazy si aplica; si el import es estático, envolverlo con `React.lazy` no es necesario porque la rama no se registra en producción. Verificar que `LogoPreview` siga importado sólo desde aquí.)

Opción B (si se quiere conservar en producción para el equipo): mover la línea al grupo de rutas protegidas de admin en el archivo de rutas correspondiente y borrarla de `publicRoutes.tsx`.

- **Tras aplicar, verificar:** en build de producción (`bun run build` + preview), `/logo-preview` cae en el catch-all 404 (`publicRoutes.tsx:44`); en `bun run dev` la ruta sigue funcionando. Confirmar además que el archivo no es alcanzable desde el sitemap/robots.

---

## Extra verificado durante la elaboración del pack (fuera de la lista UX-01..14)

### [UX-EXT] DemoModeBanner dice "modo demo como administrador" a cualquier rol
- **Severidad:** P3 · **Verificación:** estático (detectado al verificar patrones del pack; no está en el reporte 04).
- **Archivos:** `src/features/marketing/components/DemoModeBanner.tsx` (línea 19), `src/features/marketing/hooks/useIsDemoUser.ts`, `src/lib/contexts/AuthContext.tsx` (expone `role: AppRole | null`, línea 19).
- **Problema:** el banner global de la org demo afirma "Estás en **modo demo** como administrador" aunque el usuario demo tenga rol `viewer`, `operador`, `contador`, etc. — texto incorrecto para cualquier rol no admin.
- **Fix (instrucción para Lovable):** hacer el sufijo condicional al rol real. `AppRole` (enum verificado en `src/integrations/supabase/types.ts:9933`) incluye `admin`, `admin_org` y `super_admin` como roles administrativos.
- **Diff / código:** `src/features/marketing/components/DemoModeBanner.tsx`:
```diff
 import { Sparkles } from "lucide-react";
 import { useIsDemoUser } from "@/features/marketing/hooks/useIsDemoUser";
+import { useAuth } from "@/lib/contexts/AuthContext";
 
 export function DemoModeBanner() {
   const isDemo = useIsDemoUser();
+  const { role } = useAuth();
+  const esAdmin = role === "admin" || role === "admin_org" || role === "super_admin";
   if (!isDemo) return null;
@@
       <span>
-        Estás en <strong>modo demo</strong> como administrador · datos de ejemplo, se reinician en cada acceso.
+        Estás en <strong>modo demo</strong>{esAdmin ? " como administrador" : ""} · datos de ejemplo, se reinician en cada acceso.
       </span>
```
- **Tras aplicar, verificar:** entrar a la org demo con un usuario admin (banner dice "como administrador") y con un usuario viewer/operador (banner sin el sufijo). Usuarios fuera de la org demo no ven el banner.

---

## Checklist global de validación del pack

1. **14/14 hallazgos cubiertos:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12, UX-13, UX-14 (+1 extra verificado).
2. Compilar: `bun run build` (o `tsc --noEmit`) sin errores tras cada lote.
3. Tests de arquitectura: `bun run test src/__tests__/architecture/` (incluye el guardrail extendido de UX-03).
4. Tests de formatters/validaciones afectados por UX-10: actualizar aserciones de texto exacto si fallan.
5. Lint: `bun run lint` sin nuevas violaciones (en particular las reglas `no-raw-table` y las de design tokens).
6. Recorrido manual mínimo: Configuración (deletes con doble confirmación), Portal cliente perfil (retry), login (spinner en botón), dashboard dirección (KPIs), un formulario de wizard (labels asociados).

## Divergencias y notas respecto al reporte original

- **UX-02:** el reporte sugiere "título fijo + error en opts". El pack lo refina: el helper central ya existe (`getErrorMessage` + `translatePostgresError` con mapeo 23503/23505/23514/42501/RLS en `src/lib/errors/`), así que el fix es título fijo + `description: getErrorMessage(error)` — sin crear ningún `friendlyDbError()` nuevo.
- **UX-03:** el conteo real de archivos con JSX `<table>` es 39 (incluye infraestructura y pdf); el reporte dice 36. La allowlist del guardrail extendido debe generarse con `grep -rln "<table" src --include=*.tsx`.
- **UX-06/UX-01 solapamiento:** en `CatalogoClavesSATCard.tsx:108` el botón de borrar recibe tanto `aria-label` (UX-06) como el confirmador (UX-01); aplicar ambos diffs de forma acumulativa.
- **UX-10:** la línea 190 de `pagoProveedorValidaciones.ts` (`tasa.toFixed(2)}%`) es un porcentaje, no un monto — se conserva.
- **UX-12:** la extracción a `LoteRenglonesTable` es la recomendación del reporte; el quick win `text-[10px]` → `text-2xs` es independiente y puede aplicarse primero.
- **UX-14:** el comentario del propio archivo dice "no indexable", pero la ruta es pública y servida; el pack opta por `import.meta.env.DEV` (opción menos invasiva que moverla al bloque auth).
- **Extra:** se agregó UX-EXT (DemoModeBanner) por verificación directa del patrón indicado; no aparece en el reporte 04.

# Auditoría del módulo Papelera

## Resumen ejecutivo

La página `/papelera` existe y **funciona correctamente para las 14 tablas del allowlist** (RPCs `list_trash`, `restore_record`, `purge_record` con `SECURITY DEFINER` y checks de rol/org). Pero al cruzar el UI con los flujos reales de eliminación de la app, encontré **tres clases de bugs graves**:

### 🔴 Bug 1 — Eliminar embarque NO llega a la papelera
El RPC `eliminar_embarque_completo` hace **hard DELETE** de `embarques` + hijos (`conceptos_venta/costo`, `documentos_embarque`, `notas_embarque`, `facturas`). Por eso hay **0 embarques** en papelera aunque la UI los ofrece como opción. Los usuarios creen que pueden restaurarlos y no pueden.

Efecto colateral: los 4 `documentos_embarque`, 7 `conceptos_costo` y 6 `conceptos_venta` que sí están en papelera fueron marcados en otro flujo (edición manual). Si intentan restaurarse cuando el embarque padre ya fue hard-deleted, se generan huérfanos.

### 🟠 Bug 2 — Tablas con soft-delete que NO tienen ventana de papelera
Estos servicios escriben `deleted_at` pero el registro queda **invisible para siempre** (ni la lista lo muestra ni el usuario puede restaurar/purgar):

| Tabla | Servicio |
|---|---|
| `pagos_factura` | `facturacion/services/pagos/index.ts` |
| `seguros_embarque` | `embarques/services/seguros.ts` |
| `embarque_contenedores` | `embarques/services/contenedores/crud.ts` |
| `proveedor_facturas` | `cxp/services/proveedorFacturas.crud.ts` |
| `pagos_proveedor` | `cxp/services/pagosProveedor.ts` |
| `cuentas_bancarias` | `tesoreria/services/cuentas.ts` |
| `crm_leads`, `crm_oportunidades`, `crm_plantillas_mensaje` | `crm/services/*` |

### 🟡 Bug 3 — Hard-deletes en flujos que deberían ser reversibles
`proveedores`, `presupuesto_categorias`, `auditoria_revisiones`, `catalogo_claves_sat`, `conceptos_factura`, `proformas` (`crud.ts:85`), `navieras`, `puertos`, `tipos_contenedor`, `organization_members`. Un click accidental borra sin retorno.

### 🟡 Bug 4 — UX de la propia página
- Selector con 14 opciones sin badge de "cuántos registros hay por tabla" → el admin tiene que abrir tabla por tabla para saber si hay algo.
- No hay filtro por fecha ni "vaciar papelera > 90 días".
- El "Registro" muestra sólo un campo (`nombre`/`folio`/`expediente`) — en tablas con hijos huérfanos (p. ej. `conceptos_costo` sin embarque) no se ve el contexto padre.

---

## Plan de remediación (por fases)

### Fase 1 — Corregir "Eliminar embarque" (crítico, 1 migración)
Reemplazar `eliminar_embarque_completo` por soft-delete transaccional:
- `UPDATE ... SET deleted_at = now(), deleted_by = auth.uid()` en `embarques` + sus 5 hijos.
- `restore_record` para `embarques` debe restaurar en cascada los hijos que compartan `deleted_at ≈ now()` (ventana de 5s) para no revivir eliminaciones anteriores del usuario.
- Purga definitiva: nuevo RPC `purge_embarque_cascade(id)` que hace el DELETE físico actual, sólo disponible desde la papelera.

### Fase 2 — Cerrar el gap de tablas con soft-delete sin UI (1 migración + código)
Agregar al allowlist `is_soft_delete_table` las 9 tablas del Bug 2, con su `_label_col` correspondiente en `list_trash` (folio_interno, referencia_pago, marca_seguro, etc.). Actualizar `TABLAS` en `Papelera.tsx` y el tipo `SoftTable` en `services/papelera.ts`.

### Fase 3 — Convertir hard-deletes reversibles a soft-delete (código)
Migrar los 10 servicios del Bug 3 al patrón `.update({ deleted_at, deleted_by })` y agregarlos al allowlist. Excepción: `organization_members` y `catalogo_claves_sat` se quedan como hard-delete (son catálogos administrativos, no datos operativos).

### Fase 4 — Mejoras UX de la Papelera
- Mostrar badge con conteo por tabla en el `Select` (query paralela `count(*)` por cada tabla del allowlist, cacheado 60s).
- Añadir botón "Vaciar registros > 90 días" (nuevo RPC `purge_older_than`, sólo super_admin).
- Columna secundaria "Contexto" para hijos huérfanos (embarque_id / factura_id) usando lookup lateral en `list_trash`.
- Filtro por fecha de eliminación y por usuario que eliminó.

### Fase 5 — Guardrails
- Test de arquitectura que falle si un archivo en `src/features/**/services/**` hace `.update({ deleted_at`... sobre una tabla que NO esté en el allowlist de `is_soft_delete_table`.
- Test smoke que abra `/papelera`, cambie a cada una de las 14+ tablas y verifique que la RPC responde sin error.

---

## Detalles técnicos

**Archivos que cambian por fase:**

- **Fase 1:** nueva migración con `eliminar_embarque_completo` (v2) + `purge_embarque_cascade`; `src/features/embarques/services/mutations.ts` (mismo call, RPC devuelve nuevo shape).
- **Fase 2:** migración que expande `is_soft_delete_table` + branches en `list_trash._label_col`; `src/features/admin/services/papelera.ts` (tipo `SoftTable`) y `src/features/admin/routes/Papelera.tsx` (array `TABLAS`).
- **Fase 3:** los 10 services listados + tests unitarios que ya existen.
- **Fase 4:** nuevo hook `usePapeleraCounts`, RPC `count_trash_by_table`, ajustes en `Papelera.tsx`.
- **Fase 5:** nuevo archivo `src/__tests__/architecture/soft-delete-allowlist.test.ts`; e2e opcional.

**Bump de versión:** cada fase con su propio patch bump y entrada en `CHANGELOG.md`. Fase 1 es breaking en el flujo de eliminación, pero transparente para la UI.

**Prioridad recomendada:** Fase 1 esta semana (bug de datos), Fase 2 la siguiente, Fase 3-4 en el sprint siguiente, Fase 5 al cierre.

---

## Recomendación

Empezar por la **Fase 1** — es el bug más visible (los usuarios ya no pueden restaurar embarques eliminados) y el que puede causar pérdida de datos irreversible. ¿Arrancamos con esa fase o prefieres que ataque también la Fase 2 en el mismo turno?

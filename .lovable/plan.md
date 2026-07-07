
## Diagnóstico

Confirmado, no es que las 23 sean "reales": son **legacy data**. Los dos módulos usan definiciones distintas de "lista para facturar":

| Módulo | Filtro actual | Resultado |
|---|---|---|
| `/proformas` (badge Aceptada) | `estado_proforma <> 'facturada'` **AND** `estado_cliente = 'aceptada'` | **9** ✅ |
| `/facturacion` bandeja "Proformas listas" | `estado_revision = 'aprobada'` **AND** `factura_id IS NULL` | **23** ❌ |

Query a la DB (`proformas` sin `deleted_at`):
- 23 filas cumplen el filtro de Facturación.
- De esas, **22 tienen `estado_proforma = 'facturada'`** (ya conceptualmente cerradas en flujo legacy, pero nunca se les asignó `factura_id` porque el CFDI se emitió fuera del sistema o antes de que existiera el link). Sólo 3 tienen totales normales; el resto son basura histórica.
- Las 9 "reales" tienen `estado_proforma='pendiente'` + `estado_cliente='aceptada'` + `factura_id IS NULL`.

Analogía: es como si en /proformas cuentas "notas firmadas por el cliente que aún no tienen factura oficial", y en /facturación cuentas "notas visadas por el gerente" — pero en la data vieja hay 22 notas que el gerente visó, se archivaron como "facturadas" a mano, y nunca se ligaron a un CFDI. Esas ya no deberían aparecer como pendientes.

## Cambios

### 1. `src/features/facturacion/services/proformasListas.ts`
Reemplazar el filtro en `fetchProformasListas` y `fetchProformasListasCount` para que coincida con `getEstadoUnificado === 'aceptada'`:

```ts
.eq("estado_cliente", "aceptada")
.neq("estado_proforma", "facturada")
.is("factura_id", null)
.is("deleted_at", null)
```

Retirar `.eq("estado_revision", "aprobada")` — ese campo es de revisión interna previa, no del ciclo cliente→factura, y es lo que estaba dejando pasar las 22 legacy.

Actualizar el bloque JSDoc del archivo para reflejar la nueva definición y citar `getEstadoUnificado` como fuente de verdad.

### 2. `src/features/facturacion/components/bandejas/BandejaProformasListas.tsx`
Cambiar el tooltip / `emptyMessage` para leer "aceptadas por el cliente y sin factura" en lugar de "aprobadas". Sin cambios de lógica.

### 3. `src/features/facturacion/components/DashboardEjecutivoFacturacion.tsx`
El KPI "Listas para facturar" usa el mismo hook, así que se corrige solo. Actualizar el tooltip: "Proformas aceptadas por el cliente, sin factura emitida — listo para timbrar."

### 4. `docs/flujo-facturacion.md`
Añadir nota: `estado_revision` (aprobación interna) **no** se usa para decidir facturación; el gate es `estado_cliente='aceptada'`. Documentar que las 22 filas legacy con `estado_proforma='facturada' AND factura_id IS NULL` son data histórica intencional (no se auto-limpian).

### 5. Versionado
Bump `APP_VERSION` a `13.213.1` y entrada en `CHANGELOG.md`:
> Fix: bandeja "Proformas listas" y KPI del dashboard ahora usan el mismo criterio que `/proformas` (`estado_cliente='aceptada'` + no facturada), eliminando 22 falsos positivos de data legacy.

## Fuera de alcance

- **No** tocar ni migrar las 22 filas legacy. Si más adelante quieres una limpieza masiva, se puede hacer en otro turno con un script que las mueva a `deleted_at` o les asigne `factura_id` de un CFDI externo — decisión tuya.
- **No** cambiar el flujo aprobación interna → aceptación cliente. Sigue igual.

## Verificación

Después del cambio, ambos números deben ser **9** en el navegador (bandeja + KPI), y el count query en DB devolver 9.

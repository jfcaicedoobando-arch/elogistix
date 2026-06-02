## Problema

En `/facturacion → Proformas pendientes`, al seleccionar proformas y presionar **"Consolidar y aprobar"** no pasa nada. El log del navegador muestra:

```
[consolidar] selección con embarques/clientes mixtos, abortando
```

### Causa raíz (verificada en BD)

`agruparProformasPendientes` agrupa por **`expediente`**, pero en los datos reales un mismo expediente (p. ej. `ELIMP00007`) tiene **varias proformas con `embarque_id` distintos** (cada contenedor/instancia genera su propio embarque). El guard en `useTabProformasPendientesController.handleConsolidar` exige `embarque_id` único y aborta **silenciosamente** con `console.warn` cuando esa condición se rompe — para el usuario "no pasa nada".

Verificación BD (extracto, expediente `ELIMP00007`, 6 proformas con 6 `embarque_id` diferentes):

```
PRO-2026-0082  embarque_id 06425649…
PRO-2026-0084  embarque_id 33b14b26…
PRO-2026-0080  embarque_id afddd80d…
PRO-2026-0083  embarque_id b55ca3a2…
PRO-2026-0081  embarque_id d60bebde…
PRO-2026-0079  embarque_id d60bebde…
```

## Solución

Agrupar la lista de pendientes por **`embarque_id`** (no por `expediente`), mantener el expediente como etiqueta visible, y reemplazar el `console.warn` silencioso por un toast de error explícito como red de seguridad.

### Cambios

1. **`src/lib/domain/proformaAgrupacion.ts`**
   - `agruparProformasPendientes`: cambiar la clave de agrupación de `p.expediente` a `p.embarque_id` (fallback al expediente si por algún motivo viniera null, que hoy nunca pasa con `deleted_at IS NULL`).
   - `GrupoExpediente` mantiene los mismos campos; sólo cambia cómo se construye la clave. Renombrarlo internamente a `GrupoEmbarque` queda fuera de alcance para minimizar diff.
   - Añadir 2 tests en `__tests__/proformaAgrupacion.test.ts`: (a) mismas claves de expediente con embarque distinto → 2 grupos; (b) mismas claves de expediente y mismo embarque → 1 grupo.

2. **`src/hooks/facturacion/useTabProformasPendientesController.ts`**
   - `seleccionPorExpediente`: cambiar la `Map` a llave por `embarqueId` (renombrar variable a `seleccionPorEmbarque` y `expedientesEnSeleccion` → `embarquesEnSeleccion`).
   - `handleConsolidar`: en lugar de `console.warn` + return, mostrar un `toast.error("No se pueden consolidar proformas de embarques o clientes distintos.")` (importando `sonner`). El guard sigue ahí como defensa, pero ahora visible.
   - Exponer la variable renombrada al componente (`embarquesEnSeleccion`).

3. **`src/components/facturacion/TabProformasPendientes.tsx`**
   - Reemplazar `expedientesEnSeleccion` por `embarquesEnSeleccion` en el `title` del botón ("Solo puedes consolidar proformas del mismo embarque").
   - El render del grupo sigue mostrando `EXPEDIENTE {grupo.expediente}` + `BL`; cuando un expediente se repite en varios embarques se verán como tarjetas separadas con distinto BL/Cliente, lo cual es el comportamiento correcto.

4. **Tests existentes**
   - Ajustar `src/lib/domain/__tests__/proforma.test.ts` y `proformaAgrupacion.test.ts` si alguna assertion espera agrupación por expediente puro.

### Fuera de alcance

- No se toca el RPC `consolidar_proformas` (la lógica server-side ya es correcta).
- No se cambia el tab de proformas aprobadas ni `TabFacturacion` del detalle de embarque.
- No se renombra el tipo público `GrupoExpediente` (sólo cambia su semántica interna).

### Verificación

- `vitest run src/lib/domain/__tests__/proformaAgrupacion.test.ts src/hooks/facturacion`.
- Prueba manual en `/facturacion`: seleccionar 2 proformas del mismo embarque → botón habilitado y consolida; seleccionar 2 de embarques distintos → botón deshabilitado (no aparecen en mismo grupo) o, si por algún edge case llegan, toast claro.
- Actualizar `CHANGELOG.md` + bump de `APP_VERSION` (patch: `12.49.1`).

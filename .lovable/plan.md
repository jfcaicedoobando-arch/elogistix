## Investigar y arreglar filtro Todas/Pendientes/Facturadas en tab "Proformas"

### Síntoma
En `/facturacion` → tab "2. Proformas", al alternar entre los botones Todas (111), Pendientes (5) y Facturadas (106), los botones sí cambian de estado visual (data-state on/off confirmado en session replay) pero la lista de la tabla no cambia.

### Hipótesis
La lógica de `useTabProformasState` (filtra por `estado_proforma`, resetea `page` a 0 y devuelve `paginated`) y la del `<ToggleGroup>` lucen correctas en estático, y los conteos coinciden con BD. Posibles causas reales a verificar en runtime:
1. **El `key` de las filas del DataTable colisiona** y React reutiliza filas antiguas sin actualizar el contenido. `rowKey={(p) => p.id}` debería estar bien, pero conviene confirmar.
2. **TanStack table no re-construye el row model** porque la identidad de `data` se considera estable por algún motivo (improbable, pero verificable).
3. **Re-render bloqueado** por una memo en algún wrapper que no incluya `filtroEstado` como dependencia.

### Pasos
1. Cambiar a build mode y abrir el preview con el browser tool en `/facturacion` → tab Proformas.
2. Hacer click en "Pendientes" e inspeccionar:
   - Número de filas renderizadas (`tbody tr`).
   - Console: agregar un `console.log` temporal en `useTabProformasState` mostrando `filtroEstado`, `filtered.length`, `paginated.length`.
3. Según hallazgo:
   - Si `filtered.length` cambia pero `paginated` no se refleja: forzar remount del `<DataTable>` con `key={filtroEstado}` o auditar memo del padre.
   - Si `filtered.length` no cambia: revisar por qué el `setFiltroEstado` no propaga (improbable, ya que el replay muestra el cambio de data-state).
4. Quitar logs, aplicar fix mínimo.

### Versionado
- Bump `APP_VERSION` a **12.49.6**.
- Entrada en `CHANGELOG.md` describiendo el fix.
## Drilldown en tabla de facturación

**Analogía**: hoy hay que apuntar al número azul de factura para entrar; queremos que toda la fila sea "clickeable" — como un cajón de archivero donde jalar cualquier parte del cajón lo abre.

### Cambios

1. `src/features/facturacion/components/TabFacturasEmitidas.tsx`
   - Importar `useNavigate` de `react-router-dom`.
   - Pasar `onRowClick={(f) => navigate(`/facturacion/${f.id}`)}` al `<DataTable>`.
   - `DataTable` ya soporta `onRowClick` y añade `cursor-pointer` en el `<tr>` (verificado).

2. Botones de acción existentes (`Registrar pago`, `Ver pagos`, `Timbrar`, `Cancelar`, `Descargar`, link `# Factura`) — según la memoria "Event Propagation Standards" ya usan `e.stopPropagation()` en sus handlers. Se verifica y, si algún botón no lo tiene, se agrega para no dispararse el drilldown al hacer click en ellos.

3. Bump `APP_VERSION` → `13.159.3` y entrada breve en `CHANGELOG.md`.

### Fuera de alcance

- Tab "Notas de crédito" no se toca (ya tiene su propio flujo). Se puede añadir en un siguiente paso si lo pides.
- No se toca DataTable ni FacturaDetalle.

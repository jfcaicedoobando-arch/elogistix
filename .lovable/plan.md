## Problema

CI (job `audits`) falla: `FacturaDetalleView.tsx` tiene 209 líneas, superando el límite Power-of-10 de 200 (por 9 líneas). Es sólo composición JSX — no hay lógica que refactorizar.

## Solución

Extraer un subcomponente presentacional que agrupe los bloques ya independientes del cuerpo, dejando la vista raíz por debajo de 200 líneas sin tocar props ni comportamiento.

### Cambios

1. **Crear `FacturaDetalleBody.tsx`** (~120 líneas) con las secciones intermedias que hoy viven inline en `FacturaDetalleView`:
   - Grid Emisor/Receptor
   - `FacturaResumenCard`
   - `FacturaTimbradoCard`
   - `FacturaDetalleEditableSections`
   - `FacturaConceptosTable`
   - `FacturaTotalesCard`
   - `FacturaPagosSection`
   - `FacturaNotasCreditoSeccion`
   - `FacturaBitacoraCard`

   Recibe `factura`, `canEdit`, `conceptosVivos`, `puedeEditarBorrador`, `onRegistrarPago` como props.

2. **Adelgazar `FacturaDetalleView.tsx`** a ~90 líneas, quedándose con: header, banners, `ActionsBar`, `<FacturaDetalleBody />`, y los dos bloques de modales al final.

3. **Bump `APP_VERSION`** a `13.303.6` + entrada breve en `CHANGELOG.md`.

No se cambia lógica, tipos públicos ni tests. Sólo split cosmético para cumplir el baseline.

## Verificación

Correr `bun run audit:arch` local: `oversized` debe quedar en 0.

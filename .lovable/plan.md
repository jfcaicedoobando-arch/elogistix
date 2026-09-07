# El subtotal no se actualiza al editar los conceptos de una factura de proveedor

## Qué está pasando

Al corregir los renglones de una factura capturada a mano, la ventana compara siempre contra el subtotal viejo que se capturó en la cabecera. Ese número nunca cambia, así que el semáforo de cuadre marca diferencia aunque los renglones ya estén bien.

Además, al guardar hay una segunda falla confirmada: el cálculo del servidor suma sólo el importe de cada renglón e ignora la cantidad, mientras que toda la app (semáforo, tabla y validación al aprobar) usa importe × cantidad. Con cantidades mayores a 1 la cabecera queda en un número que no cuadra con sus propios renglones. Se verificó en facturas reales de la base, por ejemplo FP-000224 y FP-000223, donde la suma de renglones y el subtotal guardado difieren.

## Qué se va a corregir (decisión ya tomada: manda la suma de los renglones)

1. En la ventana "Editar conceptos": el subtotal que se muestra y con el que se compara pasa a ser el que suman los renglones (importe × cantidad). Deja de mostrarse diferencia artificial; el semáforo queda en verde cuando los renglones son consistentes y sólo advierte si algún renglón queda vacío o en cero.
2. Al guardar: el servidor recalcula el subtotal como la suma de importe × cantidad de cada renglón, igual que el resto del sistema. El IVA y el IEPS se siguen sumando tal cual, y el total sigue calculándose con la misma regla de siempre.
3. Se muestra en la ventana, antes de guardar, el subtotal nuevo que quedará en la factura, para que no haya sorpresa al cerrar.

No se toca: facturas con XML del SAT (siguen sólo lectura), facturas canceladas o con pagos, permisos, la bitácora, ni los importes históricos de facturas que nadie vuelva a editar.

## Detalles técnicos

- `DialogEditarConceptosFactura.tsx`: el `subtotal` de referencia para `calcularCuadreConceptos` y para `CuadreConceptosChip` se deriva de `sumarConceptos(lineas)` en vez del prop. Se retira el bloque "Ajustar última línea"/aviso de descuadre porque ya no aplica; el prop `subtotal` se conserva sólo para mostrar el valor anterior vs. el nuevo. `keyRenglonSospechoso` deja de usarse aquí.
- `EditarConceptosButton.tsx` / `ConceptosFacturaSection.tsx`: sin cambios de lógica; sólo se ajusta lo necesario si el prop deja de requerirse.
- Migración de `public.reemplazar_conceptos_factura_proveedor`: cambiar
  `SUM(monto)` por `SUM(monto * COALESCE(NULLIF(cantidad,0),1))` para `v_subtotal`, redondeado a 2. Sin cambios de firma, `SECURITY DEFINER`, `search_path`, REVOKE/GRANT, candados (XML/UUID, cancelada, pagos, organización) ni re-aprobación. Se actualiza el espejo `supabase/schema/cxp/reemplazar_conceptos_factura_proveedor.sql` en el mismo cambio y se cierra con `bun run db:postcheck` + baseline regenerada.
- Regresiones focalizadas preparadas: el cuadre derivado en el diálogo (cantidades 1 y >1) y una prueba del payload de `reemplazarConceptosFactura`. Suites completas, RLS y CI quedan para GitHub Actions.
- Bump de patch en `APP_VERSION` + entrada en `CHANGELOG.md`.

## Fuera de alcance

Sin backfill de facturas ya guardadas, sin aprobar ni modificar FP-000221/FP-000224, sin publicar.

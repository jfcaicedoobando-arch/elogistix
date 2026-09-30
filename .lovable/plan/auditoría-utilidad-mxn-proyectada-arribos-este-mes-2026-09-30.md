# Auditoría: "Utilidad MXN proyectada" (Arribos este mes)

## Resultado de la auditoría (Elogistix, septiembre 2026)

La tarjeta muestra **$384.2K**. Reproduje la cifra exacta desde la base: sale de 23 embarques. Pero en septiembre arriban **32** embarques de Elogistix (sin contar borrados).

| Grupo con arribo (ETA) en sep | Embarques | Utilidad MXN | ¿Se suma hoy? |
|---|---|---|---|
| Activos (Confirmado, En Tránsito, Arribo, En Aduana, Entregado) | 23 | 384,233 | Sí |
| EIR / Por liquidar | 8 | 159,761 | **No** |
| Cancelado (ELIMP00390) | 1 | 12,254 | No (correcto) |

**Hallazgos**

1. **(P1) Faltan los embarques más avanzados.** El cálculo usa solo embarques "activos". Así deja fuera EIR, Por liquidar y Cerrado, que ya llegaron este mes y tienen la utilidad más segura. Faltan unos $159.8K. Con ellos la cifra real sería unos **$544K**. El contador "Total" también dice 23 y no 31. El filtro "Ya llegaron" menciona EIR, Por liquidar y Cerrado, pero esos estados nunca le llegan. Es como un inventario que cuenta lo que va en el camión pero no lo que ya se entregó.
2. **(P1) Vista "Míos" con dinero de toda la empresa.** Si un operador o vendedor elige "Míos", los contadores se filtran a sus embarques. La utilidad, la venta, el costo y los gastos siguen siendo los de toda la organización.
3. **(P2) Se comparan gastos con IVA contra utilidad sin IVA.** La barra "Gastos fijos cubiertos" suma los gastos administrativos del mes con IVA ($449K), cuando su base es $388K. La utilidad de los embarques se calcula sin IVA, así que el porcentaje cubierto sale más bajo de lo real.
4. **(Verificado correcto)**
   - La venta no incluye IVA: el total coincide con cantidad × precio en todas las filas.
   - Todos los embarques del mes tienen tipo de cambio USD.
   - La fecha usa la hora de CDMX.
   - Los cancelados y borradores quedan fuera.
   - Las liquidaciones de comisión del periodo están en 0.
5. **(Solo informativo)** "Proyectada" usa los costos presupuestados del embarque, no las facturas reales de proveedor. Por ejemplo, ELIMP00355 presupuesta USD 10,505 de costo, pero sus facturas de proveedor suman 11,048 (subtotal). Esto es esperado para una proyección. No lo cambio, solo lo explico en el texto de ayuda.
6. **(Limpieza, sin cambiar lógica)** En la base sigue existiendo una versión vieja del cálculo (`_dashboard_summary_calc`). Esa versión usa la hora UTC e incluye cancelados. Primero voy a confirmar que nadie la usa. Solo si es así, propongo quitarla en otra ronda.

## Cambios propuestos (mínimos)

1. **Arribos del mes incluyen EIR, Por liquidar y Cerrado.** Siguen excluidos Borrador y Cancelado. Aplica al total, a "Ya llegaron", a la venta, al costo y a la utilidad. El mes siguiente no cambia, porque ahí sí aplica "activos".
2. **Gastos operativos sin IVA.** Se suma el subtotal en lugar del total, con la misma conversión de tipo de cambio que hoy.
3. **Vista "Míos".** Venta, costo y utilidad se recalculan con los embarques propios que ya trae la lista del mes. En esa vista la barra de gastos fijos se oculta, o muestra "—", porque los gastos son de toda la empresa.
4. **Texto de ayuda de la tarjeta.** Aclara que la cifra usa costos presupuestados y el tipo de cambio de cada embarque.

## Detalles técnicos

- **Migración nueva:** `CREATE OR REPLACE public.dashboard_summary_datos()`.
  - En `arribos_mes`, cambiar `FROM activos eb` por `FROM embarques_base eb WHERE estado_real NOT IN ('Borrador','Cancelado')`.
  - En `gastos_op_facturas`, usar `pf.subtotal` en lugar de `pf.total`.
  - Actualizar el espejo `supabase/schema/dashboards/dashboard_summary.sql`.
  - Cerrar con `db:postcheck` y regenerar el baseline.
- **Revisar `dashboard_details`:** confirmar que la lista `profitArribosEsteMes` cubre los mismos estados que el nuevo total. Si no, ajustarla en la misma migración para que la tabla y la tarjeta cuadren.
- **`useDashboardController.ts`:** en la vista "mios", recalcular `ventaMXN`, `costoMXN` y `profitMXN` sumando la lista `pf` ya filtrada. Poner `gastosOperativosMXN` en 0 para mostrar "—".
- **Pruebas focalizadas:** del controlador (scope "mios") y de los parsers del dashboard. Al final verificar con SQL que Elogistix da unos $544K y 31 arribos.
- **Pendiente para GitHub Actions:** CI y RLS completos. No publico ni cambio versión ni CHANGELOG.

# Auditoría del embarque 250 (ELEXP00250)

## Qué encontré

Los dos números no se contradicen entre sí: uno está mal calculado y el otro está bien.

**1. El 22.2 % del tab Costos es falso: incluye conceptos de venta que están en la papelera.**

Conceptos vivos del embarque:

```text
VENTA (vivos)    Demoras 3,680 USD + Otro 4,005 USD + Demoras 1,120 USD = 8,805 USD
VENTA (borrados) Producto Generico 4,005 USD + Demoras 1,120 USD        = 5,125 USD
COSTO (vivos)    Otro 4,005 USD + Demoras 6,840 USD                     = 10,845 USD
```

La pantalla muestra Venta MXN 243,960.27, que equivale a 13,930 USD, es decir 8,805 + 5,125: está sumando los dos renglones borrados el 30/07/2026. El costo sí sale correcto (10,845 USD = MXN 189,931.74).

Con los renglones vivos el resultado real es **pérdida de 2,040 USD (aprox. −23 % de margen)**, no una utilidad de 22.2 %.

La causa está en la consulta única que alimenta la pantalla de detalle (`get_embarque_full`): trae conceptos de venta, conceptos de costo, documentos, notas y facturas **sin excluir los registros enviados a la papelera**. Analogía: es como sumar la caja del día contando también los tickets que ya se cancelaron y se tiraron al bote.

**2. El tab Cierre dice la verdad, sólo que con un texto poco claro.**

El cierre no usa el presupuesto (conceptos), usa la realidad facturada. Este embarque **no tiene ninguna factura de venta emitida** (0 facturas vivas), así que la venta real es 0 y el margen no se puede calcular. Además queda 1 factura de proveedor por pagar por 4,645.80 USD. Por eso el punto "Margen mínimo alcanzado" aparece pendiente.

## Qué voy a corregir (alcance mínimo)

1. **Excluir la papelera en la consulta del detalle de embarque.** Recrear `get_embarque_full` filtrando `deleted_at IS NULL` en conceptos de venta, conceptos de costo, documentos, notas y facturas. Esto corrige de golpe el margen del tab Costos, la lista de conceptos, el buzón de documentos y las facturas mostradas en el detalle de todos los embarques, no sólo el 250.
2. **Mensaje claro en el checklist de cierre** para el punto de margen: cuando no hay facturación de venta registrada, decir "Aún no hay facturas de venta emitidas: la utilidad real no se puede calcular todavía" en lugar de dejar solamente "Margen actual —". Sin cambiar la regla ni permitir el cierre.

No cambio reglas de negocio, ni tocar los datos históricos del embarque, ni agrego funciones nuevas.

## Detalles técnicos

- Nueva migración `supabase/migrations/2026091100050_get_embarque_full_excluye_papelera.sql` con `CREATE OR REPLACE FUNCTION public.get_embarque_full(uuid)` idéntica a la actual más los cuatro filtros `deleted_at IS NULL` (cinco colecciones), manteniendo `LANGUAGE sql STABLE`, `SET search_path TO 'public'` y sin `SECURITY DEFINER` (la RLS del caller sigue aplicando). Se añade `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated, service_role` para conservar los permisos actuales.
- Espejo canónico nuevo en `supabase/schema/embarques/get_embarque_full.sql` con el mismo cuerpo.
- Regenerar `supabase/schema/baseline.sql` y el manifest de migraciones; correr `bun run db:postcheck`.
- Prueba enfocada nueva sobre `computeEmbarqueKpis`/servicio de detalle que verifique que un concepto con `deleted_at` no entra en los totales (fixture con las cifras reales del 250: 8,805 vs 10,845 → margen negativo).
- `cierreCheckFormatters.fmtMargenMinimoPct`: cuando `utilidad_mxn` es nulo o la venta real es 0, devolver el texto explicativo; prueba unitaria para ese caso y para el caso con margen numérico.
- Validaciones: pruebas enfocadas, ESLint focalizado, typecheck y build. CI/RLS completos quedan para GitHub Actions.

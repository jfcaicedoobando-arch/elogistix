# Embarque ELIMP00007 aparece en "Embarques sin factura"

## Qué encontré (verificado en la base)

El embarque `ELIMP00007` (ETA 01/04/2026) **sí está facturado**, pero tiene datos legacy duplicados:

- 10 conceptos de venta vivos = **5 copias del mismo par** (Flete Marítimo 1,055 USD + Cargos en Destino 125 USD), creados el 05/05/2026 en 5 intentos seguidos.
- 3 pares quedaron como `facturado` (con proforma `facturada`).
- **2 pares quedaron como `pendiente`, sin proforma** → son copias huérfanas.
- 4 facturas ligadas al embarque, una real (`726`, 1,200 USD) y 3 duplicadas (`726-DUP-...`), todas marcadas Pagada.

La bandeja tiene una regla: "si el embarque tiene aunque sea un concepto de venta `pendiente`, reaparece siempre en el hueco, incluso si ya tiene CFDI". Esos 4 conceptos pendientes huérfanos disparan esa regla. No es un bug de la vista: es basura de datos del back-fill legacy.

Analogía: el expediente ya está cobrado y sellado, pero quedaron 4 hojas fotocopiadas sueltas en la bandeja de "por cobrar"; el sistema ve las hojas sueltas y vuelve a levantar la mano.

## Qué propongo hacer

1. **Detectar el alcance primero**: consulta que liste todos los embarques con conceptos de venta duplicados (mismo embarque + descripción + monto + moneda) donde la copia `pendiente` convive con una copia ya `facturado`. Reporto cuántos son antes de tocar nada.
2. **Limpieza de datos (reversible)**: marcar como borrados (`deleted_at`) únicamente los conceptos `pendiente` que sean copia exacta de un concepto ya `facturado` del mismo embarque. No se toca ningún concepto que no tenga gemelo facturado, ni conceptos facturados, ni facturas.
3. **Facturas duplicadas `726-DUP-*`**: las reviso y reporto; propongo dejarlas fuera de este cambio (afectan cartera/reportes) y tratarlas en un paso aparte con tu confirmación, ya que están en estado Pagada.
4. **Verificación**: volver a consultar la bandeja para confirmar que `ELIMP00007` desaparece y que ningún embarque legítimamente pendiente se perdió.
5. **Changelog**: entrada en `CHANGELOG.md` + bump de `APP_VERSION`.

## Detalle técnico

- Regla afectada: `calcularEmbarquesConPendiente` en `src/features/facturacion/services/huecoFacturacion/index.ts` (override de re-aparición). **No se modifica** — el override es correcto para el caso real "se agregaron conceptos después de facturar"; el problema son los duplicados.
- Limpieza vía operación de datos (`UPDATE conceptos_venta SET deleted_at = now()`), acotada por `embarque_id` + coincidencia exacta de `descripcion`, `total`, `moneda` con un hermano `estado_facturacion = 'facturado'`.
- Sin cambios de esquema ni de RLS.

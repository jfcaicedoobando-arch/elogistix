# Verificación de la auditoría v1 — estado real de P0 y P1

Revisé cada hallazgo contra el código y la base de datos actuales (v13.646.0). Este documento reporta qué ya quedó cerrado y propone el cierre de lo que falta.

## Ya implementado y verificado

| # | Hallazgo | Evidencia de que ya está |
|---|---|---|
| BUG-01 (P0) | Timbrado con conceptos borrados | `facturapi-emitir/emitir.ts` filtra `deleted_at IS NULL`, rechaza facturas sin conceptos vigentes y valida el cuadre contra el subtotal de la cabecera (±$1). Función desplegada. |
| BUG-02 | Edición de conceptos CxP no recalculaba cabecera | `reemplazar_conceptos_factura_proveedor` recalcula subtotal/IVA/retenciones/total. |
| BUG-04 | Notas de crédito sin convertir moneda | `saldo_factura` convierte con la cascada CFDI > DOF > TC del embarque, más el guard `trg_nc_cliente_moneda_convertible`. |
| BUG-06 | Cancelar CxP sólo exigía ser miembro de la org | Trigger `trg_cxp_cancelacion_rol_financiero` sobre `proveedor_facturas`: sólo admin, admin_org, contador, auxiliar contable, tesorero o super admin. |
| BUG-07 | Eliminar pago no revertía el anticipo | `eliminar_pago_proveedor` revierte `anticipos_aplicaciones` en la misma transacción. |
| BUG-08 | Refacturación heredaba TC viejo | `duplicar_factura_para_refacturacion` usa el TC DOF vigente a la fecha de emisión. |
| BUG-09 | Embarque Cerrado se podía cancelar directo | `transicion_embarque_valida` excluye `Cerrado` de la cancelación. |
| EC-01 | Filtro de periodo después del límite de 500 | El rango del mes (zona CDMX) se aplica en la consulta antes del límite. |

## Falta implementar (P1 abiertos)

### Lógica de negocio y dinero
1. **BUG-03 · `crear_proforma_atomica`.** El índice único `proformas(organization_id, numero)` ya existe, pero el folio sigue calculándose con `MAX+1` sin candado (dos usuarios simultáneos = error de folio duplicado), el `UPDATE` de conceptos no filtra por estado (una segunda llamada puede "robar" conceptos ya asignados a otra proforma) y no hay llave de idempotencia.
2. **BUG-05 · Notas de crédito de cliente.** La máquina de estados vive sólo en el front: un update directo puede dejar una NC en `Aplicada` sin `uuid_fiscal`, reduciendo el saldo sin CFDI de egreso. Falta trigger de transiciones válidas + exigir `uuid_fiscal`.
3. **EC-02 · Errores de base ignorados en rutas de dinero.** En `cobroFacturaMovimiento.ts` y `pagoProveedorMovimiento.ts`, si la consulta falla, `yaExiste` devuelve `false` (movimiento bancario duplicado) y la moneda de la cuenta queda `null` (un cobro en USD se abona como MXN). Debe fallar en cerrado y propagar el error.
4. **EC-04 · Conciliación bancaria.** `monedaDeCuenta` de `sugerirCandidatos.ts` regresa `"MXN"` por default cuando el lookup falla, lo que permite auto-conciliar un movimiento USD contra un pago MXN. Debe abortar la sugerencia.
5. **EC-03 · `.ilike()` usado como igualdad exacta.** El guion bajo de un correo es comodín, así que la detección de duplicados puede ligar la cotización al lead equivocado (también en RFC y UUID fiscal de facturas de proveedor). Cambiar a comparación exacta / `escapeIlike()`.

### UX y coherencia visual
6. **UX-01** · El item "Principal" del menú apunta a `/` pero la ruta real es `/inicio`, así que en la pantalla más usada no se marca nada como activo.
7. **UX-02 / UX-03** · Glosario cruzado Cobranza/Cartera/CxC (redirect `/cartera` → `/cobranza`) y migas de pan crudas en Compras ("Por-capturar", "Notas-credito", "Aging").
8. **UX-06 / UX-07** · Cancelar una nota de crédito de proveedor y quitar la API key de Facturapi se hacen con un clic, sin confirmación, aunque los diálogos de confirmación ya existen en el proyecto.
9. **UX-04** · Las pestañas de Cliente, Auditoría y Buzón se pierden al recargar (Embarques ya sincroniza la URL).
10. **UX-08 / UX-09** · Accesibilidad: 57 botones de sólo icono sin etiqueta y ~223 campos sin `id` ligado a su etiqueta.
11. **UI-01 a UI-04** · Adopción del sistema de diseño: ~20 mapas de color de estado paralelos a `StatusBadge`, 70 "no hay datos" en línea sin `EmptyState`, tres azules "primarios" distintos (app / PDF / marketing) y 9 funciones de formato de fecha duplicadas.
12. **UX-05** · Tres patrones de validación de formularios conviviendo (zod+RHF vs RHF sin resolver vs `useState`).

## Orden propuesto

- **Ola A — dinero y datos (bloqueante):** BUG-03, BUG-05, EC-02, EC-03, EC-04. Migraciones + endurecimiento de servicios, con pruebas.
- **Ola B — navegación y confirmaciones (rápida, muy visible):** UX-01, UX-02, UX-03, UX-06, UX-07, UX-04.
- **Ola C — coherencia visual y accesibilidad (barrido amplio):** UI-01 a UI-04, UX-08, UX-09, UX-05. Es la ola más grande y toca decenas de archivos; conviene hacerla por módulos con tests de arquitectura que impidan regresiones.

## Detalles técnicos

- Ola A incluye: función de folio de proforma con `pg_advisory_xact_lock` por organización y reintento; filtro `estado_facturacion = 'pendiente' AND proforma_id IS NULL` en el `UPDATE` de `conceptos_venta`; trigger de transiciones en `factura_notas_credito` que exige `uuid_fiscal` para `Aplicada`; revisión de `error` en los cinco puntos de servicios de tesorería/facturación; uso de `escapeIlike()` o `eq` sobre valores normalizados.
- UI-03 requiere una decisión de negocio: qué azul es el corporativo definitivo y si el nombre visible es "Libre Carga" o "Elogistix". Los tokens de PDF se derivarían del CSS una vez confirmado.
- Cada ola cierra con `APP_VERSION` + entrada en `CHANGELOG.md` y espejos en `supabase/schema/`.

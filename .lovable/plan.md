# Auditoría del parche `fixes_r2_01_database-2.diff`

Revisé cada hallazgo contra la base real. Varios ya quedaron corregidos en la entrega anterior (v13.753.0) y otros parten de una premisa que hoy no existe. Esto es lo que vale la pena aplicar.

## Ya corregido (no se vuelve a aplicar)

- **D-02 / R-02** — candado de cancelación con facturas vivas + liberación de cotizaciones al cancelar: ya está en la base.
- **D-03** — baja de clientes ignora embarques Cancelados y cotizaciones en Borrador: ya está.
- **D-04** — folio único de facturas de proveedor normalizado (mayúsculas/espacios) con advisory lock: ya está.
- **N-03** — el portal del cliente ya no lee embarques ni cotizaciones en papelera: ya está.
- **W-09** — la lectura de archivos de documentos ya exige que el documento y el embarque no estén en papelera: ya está.

## Descartado (la premisa no aplica)

- **R-01** — el parche corrige un trigger `conceptos_factura_assert_borrador`; ese trigger y esa función no existen en la base, así que no hay cascada rota que arreglar. Aplicarlo crearía un candado nuevo, no un fix.
- **R-04** — asume un guard `cotizaciones_guard_en_operacion` que tampoco existe. Hoy el recálculo de subtotal sólo toca `subtotal` y ningún guard vigente lo bloquea. Sin bug, no se toca (y evitamos abrir un bypass por GUC innecesario).

## Confirmado y pendiente (a implementar)

1. **D-05 (media-alta) — Factura sin conceptos.** Verificado en la base: cuando una factura queda con cero renglones vivos, `recalc_factura_totales` conserva el subtotal e IVA capturados y deja un total inflado; y nada impide emitir una factura vacía. Analogía: es como firmar un recibo por $10,000 cuya lista de conceptos está en blanco.
   - Totales en cero cuando no hay conceptos vivos.
   - Bloquear el paso a "Emitida" sin conceptos con `LC_FACTURA_SIN_CONCEPTOS`.

2. **W-08 (medio) — Buckets sin límite.** Verificado: los 7 buckets del proyecto no tienen límite de tamaño ni tipos permitidos, así que cualquier archivo (de cualquier peso o formato) entra. Se fija tope de 25 MB y tipos PDF / PNG / JPG / XML, sin cambiar el carácter privado de los buckets.

3. **N-07 (medio) — Comisiones sin respaldo.** Verificado: el estado `Por recuperar` no existe en el catálogo de comisiones, por lo que al borrar un pago o cancelar/sustituir la factura, una comisión ya liquidada se queda "muda" y nadie la ajusta. Se agrega el estado y se marca la comisión al perder su respaldo, además de acotar el monto a un mínimo de cero.

4. **D-01 (crítico, por etapas) — `deleted_at` escribible directo.** Las políticas de actualización permiten mandar `deleted_at` por API sin pasar por `soft_delete_record`, saltándose el bloqueo por dependencias y el ámbito de organización. El parche lo resuelve con un trigger global más una GUC de transacción en cada RPC autorizada; es el cambio de mayor superficie (más de 1,000 líneas) y un olvido rompe cualquier baja o restauración.
   - Antes de activarlo: inventariar en la base **todas** las rutinas y flujos que escriben `deleted_at` (bajas funcionales, restauración, papelera, purga, procesos de embarques/facturas) para que ninguna quede fuera.
   - Se aplica sólo cuando el inventario esté cubierto, en su propia migración y con pruebas RLS de baja/restauración por tabla.

## Detalles técnicos

- Migraciones nuevas (una por hallazgo), sin combinar: D-05, W-08, N-07 en la primera etapa; D-01 en una segunda etapa una vez inventariados los escritores de `deleted_at`.
- W-08 se aplica con la herramienta de actualización de buckets (no por SQL sobre `storage.buckets`).
- N-07 requiere `ALTER TYPE ... ADD VALUE` para `estado_comision` en su propia migración, y revisar la UI/badges que listan estados de comisión para que muestren "Por recuperar".
- Sincronizar espejos canónicos en `supabase/schema/**`, `baseline.sql` y el manifiesto de migraciones; correr `audit:migrations`, `audit:replay-mirror`, `audit:manifest` y la suite RLS.
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

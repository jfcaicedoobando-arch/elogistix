## Objetivo

Que cualquier proforma con `estado_cliente = 'aceptada'` (sin importar si fue vía portal público o aceptación manual por un usuario del sistema) muestre directamente el botón **"Convertir a factura"** en la vista de detalle, sin pasar por el paso intermedio de "Aprobar revisión".

**Analogía:** hoy el sistema pide dos firmas — la del cliente y una firma interna de "revisado" — antes de facturar. El cliente ya lo dijo: quiere una sola firma (la aceptación) y de ahí saltar a borrador de factura.

## Estado actual (por qué no aparece el botón hoy)

`AccionesProforma.tsx → computarFlags`:

```ts
puedeConvertir = aprobada && clienteAcepto && !facturada && !factura_id && canEmitirFactura
//               ^^^^^^^^ ← este gate es el que sobra
```

La proforma **PRO-2026-0949** cumple `clienteAcepto = true` pero `aprobada = false`, así que el botón queda oculto.

## Cambios (todo frontend/presentación)

### 1. `src/features/proformas/components/AccionesProforma.tsx`

- Quitar `aprobada` del cálculo de `puedeConvertir` y de `mostrarHint`.
- Nueva regla:
  ```ts
  puedeConvertir = clienteAcepto && !facturada && !factura_id && canEmitirFactura
  mostrarHint = !clienteAcepto && !facturada   // "Falta que el cliente acepte"
  ```
- Se conservan intactos: gate por rol (`canEmitirFactura`), botones de aceptar/rechazar manual, envío al cliente, descarga PDF.

### 2. `src/features/facturacion/components/TabProformas.tsx` (acción masiva "Fusionar en factura")

- Reemplazar el criterio `isConvertible` para que exija sólo `estado_cliente = 'aceptada'` (y no facturada), en lugar de mirar `estado_revision`.
- El botón masivo sigue gated por `canEmitirFactura` (ya se hizo en 13.145.6).

### 3. `src/features/facturacion/components/TabFacturacion.tsx` — aviso informativo

- El `AvisoProformasRechazadas` sigue igual.
- Opcional: si existía algún card/aviso que decía "N proformas pendientes de revisión interna", quitarlo para no confundir. (Confirmar en implementación; si no existe, sin acción.)

### 4. Limpieza del pestaña "Proformas Pendientes"

- El tab actual filtra por `estado_revision = 'pendiente'`. Al quitar el gate, este tab pierde propósito.
- **Decisión propuesta:** conservar el tab como filtro de "en espera del cliente" (proformas donde `estado_cliente = 'pendiente'`), y renombrarlo a **"Esperando cliente"**. Los botones de "Aprobar seleccionadas" / "Consolidar y aprobar" se ocultan porque ya no aplican; la única acción masiva útil aquí es "Reenviar al cliente" (fuera de alcance de este cambio: sólo ocultar los botones obsoletos).
- Si prefieres eliminar el tab por completo, dímelo y lo quito en lugar de reciclarlo.

### 5. Versionado

- Bump a `13.145.7`.
- `CHANGELOG.md`: "Proforma aceptada por cliente pasa directo a Convertir a factura (elimina paso de aprobación interna)."

## Qué NO se toca

- **RPC `convertir_proformas_a_factura`**: sigue validando rol en servidor (defensa en profundidad). El único gate en UI se resume ahora a "aceptación del cliente + permiso para emitir factura".
- **Datos históricos**: las 319 proformas migradas de Elogistix ya tienen `estado_cliente='aceptada'`, así que quedan listas para facturar sin cambios en base de datos.
- **RLS y políticas**: sin cambios.

## Preguntas antes de implementar

1. **Pestaña "Proformas Pendientes"**: ¿la reciclamos como "Esperando cliente" o la eliminamos?
2. **Aceptación manual**: hoy cualquier usuario con acceso a la proforma puede pulsar "Aceptar (manual)". ¿Quieres que ese botón también se limite a ciertos roles (p. ej. contador/admin/gerente comercial), o dejarlo abierto como está?

## Verificación

- Login como Isela (contador) → `/proformas/58062557-...` → aparece **"Convertir a factura"** de inmediato.
- Login como `coordinador_logistico` → **NO** aparece el botón (gate `canEmitirFactura` sigue vivo).
- Proforma con cliente `pendiente` → sigue mostrando el hint "Para facturar, el cliente debe aceptar la proforma".
- Tests: ajustar `AccionesProforma` (si tiene) y `facturacion-fusion.test.ts` para el nuevo criterio.

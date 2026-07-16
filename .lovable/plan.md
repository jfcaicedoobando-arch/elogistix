## Diagnóstico

El usuario timbró la sustituta (987), regresó al detalle de la 974, abrió **"Cancelar CFDI"** (no el wizard de sustitución) y pegó manualmente el UUID de la propia 974. FacturAPI respondió correctamente con *"Substitution invoice is required when cancellation motive is 01"*.

Hay **dos bugs** encadenados:

1. **El campo "UUID que sustituye" del `DialogCancelarFactura` no sirve.** El backend arma el payload a FacturAPI usando el `facturapi_id` (ObjectId) de la sustituta, que sólo se resuelve cuando el cliente envía `sustituidaPorFacturaId` (id interno). Si el usuario pega el UUID SAT en el input, ese valor viaja como `sustituye_uuid` (sólo se guarda en bitácora) pero **NUNCA** se agrega `substitution` al payload de FacturAPI → error garantizado, incluso si el UUID fuera el correcto.
2. **No hay validación de que el UUID pegado sea distinto al de la propia factura**, así que el usuario acabó pidiendo "sustituir 974 por 974".

Analogía: es como si el cajero del banco te pidiera el número de la cuenta destino, pero internamente sólo transfiere si le das además el folio interno de esa cuenta — que el usuario no tiene forma de conocer. El campo de UUID a mano estaba condenado a fallar.

## Solución

Rediseñar el bloque de motivo 01 en `DialogCancelarFactura` para que trabaje sobre las sustitutas reales que ya existen en la BD (`facturas.sustituye_a = facturaId`), no sobre un UUID pegado.

### Cambios de código

**`src/features/facturacion/components/DialogCancelarFactura.tsx`**
- Al elegir motivo 01, consultar `facturas` filtrando `sustituye_a = facturaId` (organización actual) para listar las candidatas con su estado (`Borrador`, `Emitida`, `Cancelada`).
- Reemplazar el `Input` libre por un `Select` (o lista) con las sustitutas emitidas.
- Si no hay ninguna timbrada: mostrar `Alert` con CTA "Abrir asistente de sustitución" que dispare el `DialogSustituirFactura` existente y cierre este modal.
- Al confirmar, mandar `sustituidaPorFacturaId` (id interno) al hook, **no** un UUID crudo. Eliminar el campo `sustituyeUuid` de esta ruta.
- Bloquear el botón "Confirmar" hasta que haya sustituta timbrada seleccionada.

**`src/features/facturacion/services/detail.ts` (o helper nuevo `sustitutasDeFactura.ts` si detail.ts sube de 200 líneas)**
- Nueva función `listarSustitutas(facturaId)` que devuelva `{ id, uuid_fiscal, estado, folio, serie }[]`.

**Tests**
- `DialogCancelarFactura.test.tsx`: cubrir (a) sin sustitutas → CTA visible, botón deshabilitado; (b) con sustituta timbrada → botón habilitado, `mutate` recibe `sustituidaPorFacturaId`.
- Ajustar `useTimbrarFactura.test.tsx` si toca — el path `sustituyeUuid` deja de invocarse desde este dialog pero el hook lo sigue soportando por compatibilidad.

**Documentación**
- `CHANGELOG.md`: entrada bajo nueva versión.
- Bump `APP_VERSION` a **13.301.16**.

### Detalles técnicos

- El wizard `DialogSustituirFactura` ya envía `sustituidaPorFacturaId` correctamente — no se toca.
- La edge `facturapi-cancelar` ya sabe resolver `facturapi_id` desde `sustituida_por_factura_id` (líneas 71-84 de `index.ts`) — no se toca.
- Se conserva el enum `sustituyeUuid` en el hook para no romper otros consumidores; sólo la UI del dialog cambia.
- Query key nueva: `facturacionKeys.sustitutasDe(facturaId)` para invalidación cuando se timbra una sustituta.

### Diagrama del flujo corregido

```text
Detalle F974 ─┬─► "Sustituir CFDI" ─► wizard crea+timbra F987 (sustituye_a=974)
              │
              └─► "Cancelar CFDI"
                     ├─ motivo 02/03/04 → cancela directo
                     └─ motivo 01
                          ├─ hay F987 timbrada → select → envía sustituidaPorFacturaId=987
                          └─ no hay ninguna → CTA "abrir asistente de sustitución"
```

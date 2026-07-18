## Revisión Fase D (v13.301.73) — verde

- Migración aplicada limpia: `saldo_factura(uuid)` + `validar_cierre_embarque` + `recalcular_cobro_embarques` + `recalcular_estado_factura` con trigger sobre `factura_notas_credito`.
- Backfill idempotente ejecutado (0 filas modificadas: no hay NCs vivas hoy, defensa a futuro).
- Guardrail `saldo-factura-fase-d.test.ts`: **8/8 tests en verde**, blinda las 8 condiciones críticas (grant público, filtro `Cancelada|Sustituida|Borrador`, NCs `Aplicada` no borradas, uso en cierre, exclusión en cobro, uso en trigger, trigger sobre NCs, filtro backfill).
- `bun run lint --max-warnings 0` en verde tras extraer `HorizontalScrollFades`.
- Sin nuevos warnings del linter de seguridad (los 265 eran pre-existentes).

**Bugs pendientes de Fase D**: ninguno. **Tests faltantes**: guardrail cubre el contrato SQL; no añado test funcional con NCs porque hoy no hay NCs en producción, y el pipeline `pagos_factura → recalcular_estado_factura` ya está cubierto por los tests de pagos existentes.

Todo verde → continuar a **Fase E**.

---

## Fase E — Endurecer eliminación de embarques (Bug 7)

### El problema

`eliminar_embarque_completo(uuid)` hoy hace cascade-soft-delete "obediente" sin verificar dependencias fiscales:

```text
UPDATE facturas SET deleted_at = now() WHERE embarque_id = ...
```

Consecuencias:

1. **CFDIs vivos se sepultan** — una factura `Emitida`/`Pagada`/`Vencida` puede quedar `deleted_at IS NOT NULL` sin haber sido cancelada ante SAT. Riesgo fiscal directo.
2. **CxP queda huérfana** — `proveedor_facturas`, `pagos_proveedor`, `proveedor_facturas_conceptos` referencian un `embarque_id` que ya no aparece en listados.
3. **Pagos y NCs quedan huérfanos** — `pagos_factura` y `factura_notas_credito` no se tocan y apuntan a facturas soft-deleted.
4. **Embarques cerrados se pueden borrar** — no valida `cerrado_at`; un cierre auditado desaparece con un clic.
5. **Comisiones definitivas** quedan colgando (`comisiones_devengadas.definitiva = true`).
6. **Guard mal escrito** — `IF v_cotizacion_id IS NULL AND NOT EXISTS ...` — un embarque sin cotización pasa el guard aunque no exista.
7. **Sin bitácora** — no queda registro en `bitacora_actividad`.

La UI (`DialogEliminarEmbarque` + `fetchEmbarqueDependenciasFinancieras`) sí verifica dependencias, pero **el chequeo vive en cliente**. Un llamador directo al RPC (edge function, script, futura API) se lo salta.

### Alcance

Aplicar server-side el mismo contrato de bloqueo que ya usa la UI, más los casos que la UI no cubre, y dejar el RPC autoprotegido.

### Fase única — `v13.301.74`

**1. Reescribir `eliminar_embarque_completo`** en una migración que:

- Corrige el guard de existencia: `SELECT ... INTO STRICT` o `NOT FOUND` con mensaje explícito.
- **Bloquea la eliminación** (con `RAISE EXCEPTION` de código estable `LC_EMBARQUE_BLOQUEADO` y mensaje humano) cuando el embarque tenga:
  - `facturas` vivas (`deleted_at IS NULL AND estado NOT IN ('Cancelada','Sustituida')`) — incluye `Borrador` porque puede haber sido timbrada en paralelo.
  - `proveedor_facturas` vivas (`estado <> 'Cancelada'`).
  - `pagos_factura` o `pagos_proveedor` vivos ligados a esas facturas.
  - `factura_notas_credito` o `proveedor_notas_credito` vivas.
  - `comisiones_devengadas` con `definitiva = true`.
  - `estado_embarque = 'Cerrado'` o `cerrado_at IS NOT NULL` — pide reabrir primero.
- Devuelve en el `MESSAGE` una lista JSON compacta de motivos (`{"facturas":2,"cxp":1,"cerrado":false,...}`) para que el cliente muestre el mismo bloqueado dialog sin necesidad de segunda vuelta a la BD.
- **No** borra `facturas` ni `proveedor_facturas`: si pasa el guard, es porque no quedan vivas. Se soft-deletean sólo los hijos operativos (`conceptos_venta/costo`, `documentos_embarque`, `notas_embarque`, `eventos_embarque`, `embarque_contenedores`, `seguros_embarque`) y el embarque.
- Registra el borrado en `bitacora_actividad` con `accion='eliminar_embarque'`, `modulo='embarques'`, `entidad_id=<uuid>`, `entidad_nombre=<expediente>` y `detalles` con `{ cotizacion_revertida, hijos_soft_deleted }`.
- Mantiene la reversión de `cotizaciones.estado='Aceptada'` cuando no quedan embarques vivos.

**2. Adaptar el cliente**:

- `services/mutations.ts` (`deleteEmbarqueService`) captura el error del RPC, extrae el JSON de motivos y lo re-lanza como `EmbarqueBloqueadoError` con `motivos` tipados.
- `DialogEliminarEmbarque.tsx`: la ruta de éxito no cambia. Si viene `EmbarqueBloqueadoError`, se abre `DialogEliminarEmbarqueBloqueado` con los motivos server-side (contrato: los mismos que ya muestra hoy desde el service cliente).
- El hook `useEmbarqueDependenciasFinancieras` se mantiene como fuente de UX (deshabilitar el botón antes de intentar), pero deja de ser la única línea de defensa.

**3. Guardrails**:

- `src/lib/__tests__/eliminar-embarque-bloqueado-fiscal.test.ts`: lee la migración y verifica que el SQL contiene los 6 filtros duros (facturas vivas, cxp vivas, pagos, NCs, comisiones definitivas, embarque cerrado), levanta con `RAISE EXCEPTION`, escribe bitácora, y **no** contiene `UPDATE public.facturas SET deleted_at` ni `UPDATE public.proveedor_facturas SET deleted_at`.
- `src/features/embarques/services/__tests__/mutations.test.ts`: caso nuevo que mockea el error del RPC con payload JSON y verifica que se propaga como `EmbarqueBloqueadoError` con motivos.

**4. Cierre**:

- `CHANGELOG.md`: `## [13.301.74] - 2026-07-18` describiendo el fix Bug 7.
- `APP_VERSION → 13.301.74`.
- `bun run ci:fast` (guardrail nuevo + suite estable).

### Riesgos y mitigaciones

- **Riesgo**: un flujo legítimo actualmente borra embarques con facturas Borrador para "descartar". **Mitigación**: la UI ya bloquea por dependencias financieras (`tieneDependencias` incluye CxC count>0), así que el flujo actual también rompe hoy — no hay regresión. Si el usuario reporta un caso concreto, podemos afinar para excluir `Borrador` en el guard sin sacrificar CFDIs vivos.
- **Riesgo**: embarques `Cerrado` con cero dependencias que hoy sí se borran quedan bloqueados. **Mitigación**: mensaje humano explica que hay que reabrir primero — coherente con el resto del flujo de auditoría (comisiones, cierre).
- **Riesgo**: llamadas legacy al RPC sin manejar el nuevo error. **Mitigación**: sólo hay dos call sites (`services/mutations.ts` y el hook de tests); ambos se adaptan en la misma versión.


# Auditoría de correcciones `correcciones-elogistix-lovable-2.md`

## Estado observado (por CHANGELOG)

Sólo el **Sprint 0** se atacó en `v13.303.0` + parches inmediatos:

| FIX | Estado | Evidencia |
|---|---|---|
| FIX-01 Credenciales | ✅ Hecho (`v13.303.0`) | `debug-login*.cjs`/`audit-tmp.cjs` eliminados |
| FIX-02 `validar_cierre_embarque` col `factura_id` | ✅ Hecho (`v13.302.12`) | JOIN corregido a `proveedor_factura_id` |
| FIX-03 Proforma `facturada` + índice único | ✅ Hecho (`v13.303.0`) | `uq_proformas_facturada_unica` |
| FIX-04 Claim atómico CFDI | ✅ + FIX-04.1 recovery (`v13.303.0`/`v13.303.1`) | `uq_facturas_facturapi_id` + `facturapi-recuperar-claim` |
| FIX-05 Folio cotización atómico | ✅ Hecho (`v13.303.0`) | RPC `siguiente_folio_cotizacion` |
| FIX-06 `.env`/gitleaks | ⚠️ Parcial | `.env.example` añadido; falta `git rm --cached .env`, workflow secrets, gitleaks |
| FIX-07/21 Conversión cotización→embarque | ⚠️ Parcial | Sólo índice único; **NO** se migró a RPC transaccional (el path multi-await del cliente sigue vivo) |
| FIX-16 Cierre CxP moneda/soft-delete | ✅ Hecho (`v13.303.0`) | Junto con FIX-02 |

**Todos los FIX-08 a FIX-48 (Sprints 1–3) están pendientes.**

## Verificación que voy a ejecutar (audit-only, sin cambios)

### Bloque A — Confirmar Sprint 0 no tiene regresiones
1. **FIX-02/16** `validar_cierre_embarque`: leer la última migración vigente, confirmar que usa `pp.proveedor_factura_id`, `pp.monto_en_moneda_factura`, filtra `pp.deleted_at IS NULL` y excluye `pf.estado='Cancelada'`. Grep de residuos `pp\.factura_id` en migraciones activas.
2. **FIX-03** `convertir_proformas_a_factura`: leer RPC vigente y verificar el `UPDATE proformas SET estado='facturada'` dentro de la misma transacción y que `queries.ts` filtra `.neq("estado_proforma","facturada")` (evitar reentrada).
3. **FIX-04** `facturapi-emitir`: leer `emitir.ts`/handler, confirmar el `UPDATE ... SET facturapi_id='PENDING:<uuid>' WHERE facturapi_id IS NULL` antes del SDK, liberación en error y `UPDATE` final condicionado al `claimTag`. Confirmar timeout 30 s en `_shared/facturapiClient.ts` (el doc lo pedía junto con FIX-04).
4. **FIX-05** folio: confirmar `crearCotizacion` usa `rpc('siguiente_folio_cotizacion')` y no queda ruta legacy con `MAX(folio)`.
5. **FIX-07/21** conversión: buscar si `embarques.ts:92-152` sigue haciendo 6 awaits desde el cliente; si sí, marcar como bug residual (el índice único no cubre la mitad de la corrida que deja huérfanos).
6. **FIX-06** repo: `git ls-files | grep -x .env`, revisar `.github/workflows/post-deploy-smoke.yml` y `smoke_test.ts` por literales, revisar `.gitleaks.toml` por allowlist de la anon key.

### Bloque B — Inventariar pendientes con evidencia puntual (una lectura por FIX)
Para cada FIX-08 a FIX-48, un solo `rg`/lectura del archivo/línea citados en el doc para confirmar que sigue como el auditor lo describe (no que estamos re-auditando desde cero). Salida: tabla con `FIX | pendiente/parcial/hecho | evidencia (archivo:línea) | severidad`.

Agrupado por dominio para paralelizar con subagentes:
- **Fiscal/facturación** (FIX-08, 09, 10, 11, 13, 17, 19, 22, 23, 26)
- **Embarques/cotización** (FIX-15, 18, 20, 25, 30, 31)
- **Tesorería/CxP/CxC** (FIX-14, 24, 27, 28, 29)
- **UX sistémico** (FIX-33 a FIX-39)
- **Seguridad/gobierno** (FIX-40 a FIX-48)

### Bloque C — Entregable
Un solo mensaje al usuario con:
1. Tabla ejecutiva por sprint (✅ hecho / ⚠️ parcial / ❌ pendiente / 🐛 bug residual).
2. Bugs detectados en lo ya implementado (con `archivo:línea`).
3. Recomendación de siguientes 3–5 FIXes a atacar (priorizados por impacto fiscal/dinero).

**Sin cambios de código.** Al terminar la auditoría el usuario decide qué FIX implementar y en ese momento cambio a build mode.

## Preguntas antes de arrancar

Ninguna — el alcance es sólo verificación read-only del documento contra el repo actual.

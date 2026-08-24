# Auditoría del parche `fix3-frontend-pulido.diff`

Revisé cada hallazgo contra el código real. Resultado: **todos los bugs de fondo son reales** (6 con impacto funcional), el resto es pulido cosmético legítimo. Hay 2 detalles que conviene ajustar antes de aplicar.

## Bugs reales confirmados

1. **Dos parsers de dinero que dan resultados 1000× distintos (el más importante).**
   `MoneyInput` (`sanitizeMoneyText`) ya interpreta `"50.000"` como 50,000 (heurística EC-06 en el código actual), pero `parseMonto` devuelve **50**. El mismo texto pegado desde Excel vale distinto según el campo (captura CxP, aplicación de anticipos). Analogía: dos cajeros leyendo el mismo cheque, uno ve cincuenta pesos y el otro cincuenta mil.

2. **La bitácora "Avanzó estado de embarque" se escribe aunque la transición no ocurra.**
   Verifiqué `idempotency_claim`: cuando la llave se repite devuelve la respuesta **cacheada** (o el marcador `__idempotency_pending`) sin ejecutar nada, y `avanzar_estado_embarque` la retorna tal cual. El cliente (`embarqueEstadoRpc.ts`) llama a `registrarBitacoraEmbarque` **siempre**. Cada re-disparo del auto-sync agrega una fila falsa.

3. **`requestId` eterno del auto-sync (M-3).** El `Map` en `useEstadoEmbarque.ts` no expira: tras reabrir un embarque, la misma transición reusa la llave vieja → la RPC responde cacheado y el avance **no se ejecuta** (UI y BD desincronizadas). El flag `replay` + TTL + reintento con llave fresca es la solución correcta.

4. **Todos los toasts de error comparten un mismo id.** `useMutationWithFeedback` manda siempre `errorCode: VALIDATION_FAILED`, y `appFeedback` arma el id como `err-<errorCode>`: dos errores distintos (aun de pantallas distintas) se reemplazan entre sí, y el reporte copiable queda etiquetado con un código falso.

5. **Doble toast al rechazar un documento.** Confirmado: `useRechazarDocumentoEmbarque` emite éxito/error y `handleRechazarDoc` emite otro con más contexto. `silent: true` es lo correcto.

6. **Borradores del wizard sobreviven al logout.** `clearDraft` sólo borra la clave del usuario actual; el draft (con precios, costos y márgenes del tenant) queda 24 h en localStorage de un equipo compartido. `getStorageRef` y `clearPersistedQueryCache` sí existen en `src/lib/browserStorage/index.ts`, así que el fix encaja.

7. **Fecha corrida un día en el resumen de captura CxP.** `formatFechaSegura(new Date("2026-08-17"))` cae en el día anterior en `America/Mexico_City`; `formatFechaDia` (que sí existe y ancla a mediodía UTC) lo arregla.

8. **Ratchets con baseline mentiroso.** Conté con el mismo regex y los mismos filtros del test: **907** `h-4 w-4` (baseline 900) y **147** callouts artesanales (baseline 145). El chequeo unilateral no detectaba el desfase; `Math.abs` sí. Los números del parche son exactos.

9. **`docs/design-system.md` tiene dos secciones "## 9"** y `text-overline` **sí** está declarada en `src/index.css` (línea 286) y se usa en ~15 componentes: la doc actual, que dice que no existe, está mal. La corrección documental es válida.

## Pulido cosmético (correcto, sin riesgo)

Login contextual por audiencia en los guards de portal/agente, fallback `"este usuario"` en el diálogo de borrado del portal, anchos `*Auto` en `filterWidths`, deduplicación del mensaje de oportunidad inexistente, y el renombre "Profit" → "Utilidad".

## Dos ajustes antes de aplicar

- **`Profit` a medias:** el parche renombra 4 lugares, pero quedan `Breadcrumbs.tsx`, `proyeccionColumns.tsx`, `ClienteSummaryCards.tsx` y el PDF de rentabilidad con "Profit". Hay que completar el renombre en la misma ola o la app queda bilingüe.
- **`puntoDeMiles: false` falta en cantidades:** el parche lo aplica al tipo de cambio (bien), pero `ConceptoLineaRow` usa `parseMonto` para **cantidad**; con la nueva heurística `"1.500"` pasaría de 1.5 a 1500. Hay que pasar el opt-out ahí también.

## Qué implementaría (si apruebas)

1. Migración `avanzar_estado_embarque` con flag `replay` en la respuesta cacheada (dejando `__idempotency_pending` sin marcar) + espejo en `supabase/schema/embarques/`, con timestamp libre de colisiones.
2. Frontend: `parseMonto` con heurística EC-06 y opt-out (aplicado en TC **y** en cantidades de CxP); `embarqueEstadoRpc` devolviendo `{replay, pendiente}` y omitiendo bitácora en replay; TTL + reintento en `useEstadoEmbarque`; `silent: true` en rechazo de documento; id de toast derivado de `method`; `clearAllDrafts` + purga del query cache en el logout; `formatFechaDia` en el resumen CxP.
3. Pulido: guards con `?audiencia=`, fallbacks del diálogo, `FILTRO_ANCHO.*Auto`, renombre completo de "Profit" → "Utilidad", doc del design system renumerada.
4. Ratchets a 907/147 con chequeo bidireccional, tests nuevos del parche, `CHANGELOG.md` + `APP_VERSION`, y sincronización del manifiesto de migraciones.

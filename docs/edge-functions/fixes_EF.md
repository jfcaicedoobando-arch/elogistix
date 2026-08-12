# Fix Pack — Edge Functions (hallazgos EF-01 a EF-13)

- **Repo:** `/mnt/agents/repo` (Elogistix, main @ 1ef05ce9, v13.523.1)
- **Fuente:** `/mnt/agents/output/audit_reports/02_edge_functions.md`
- **Verificación general:** estático (stack local sin edge runtime). Todas las líneas citadas fueron verificadas contra el código real del repo.
- **Criterio:** bajo riesgo, retrocompatible (feature freeze). Los diffs usan contexto copiado del repo; los fragmentos grandes van como ANTES/DESPUÉS.
- **Migraciones nuevas incluidas:** `20260813120100_fix_ef01_rep_claim_idempotente.sql`, `20260813120300_fix_ef03_nc_acuse_cancelacion.sql`, `20260813120900_fix_ef09_demo_seed_state.sql` (bloques completos listos para `supabase/migrations/`).

---

### [EF-01] facturapi-emitir-rep: sin idempotencia — doble click timbra dos REPs ante el SAT
- **Severidad:** P0 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:**
  - `supabase/functions/facturapi-emitir-rep/index.ts`
  - `supabase/functions/facturapi-emitir-rep/helpers.ts`
  - `supabase/functions/facturapi-recuperar-claim/recuperar.ts`
  - `supabase/functions/facturapi-recuperar-claim/index.ts`
  - `supabase/migrations/20260813120100_fix_ef01_rep_claim_idempotente.sql` (NUEVA)
- **Problema:** El guard `if (pago.facturapi_rep_id) return ... 409` (`index.ts:59`) es check-then-act no atómico: dos invocaciones concurrentes pasan el SELECT y ambas ejecutan `facturapi.invoices.create(payload)` (`index.ts:163`) sin `external_id` ni `withFacturapiTimeout` → dos complementos de pago timbrados ante el SAT, irrecuperables (recuperar-claim sólo soporta `factura_id`/`nota_credito_id`, `facturapi-recuperar-claim/index.ts:114-116`). Es la única familia de timbrado sin el patrón `PENDING:<uuid>` (verificado: emitir lo tiene en `emitir.ts:65-79`, NC en `data.ts:155-177`).
- **Fix (instrucción para Lovable):**
  1. Aplica la migración nueva (columna `facturapi_rep_claim_at` + RPC `liberar_claim_rep_huerfano`).
  2. En `facturapi-emitir-rep/index.ts`: toma un claim atómico `PENDING:<uuid>` sobre `pagos_factura.facturapi_rep_id` DESPUÉS de validar y ANTES de timbrar; envía el tag como `external_id`; envuelve `invoices.create` con `withFacturapiTimeout`; en timeout NO liberes el claim (504 + mensaje de recuperación); en error definitivo sí libéralo; persiste condicionado al claim.
  3. En `helpers.ts`: agrega `external_id` al tipo del payload.
  4. Extiende `facturapi-recuperar-claim` con la rama `pago_id` (promover o liberar vía la RPC nueva).

**Diff / código:**

Migración NUEVA `supabase/migrations/20260813120100_fix_ef01_rep_claim_idempotente.sql` (completa; espejo de `20260720202252_...sql` para facturas):

```sql
-- EF-01 (auditoría edge functions): idempotencia del timbrado de REP.
-- claim PENDING:<uuid> atómico sobre pagos_factura.facturapi_rep_id + timestamp
-- + RPC para liberar claims huérfanos pasado un umbral (patrón facturas/NC).

ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS facturapi_rep_claim_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pagos_factura_rep_pending
  ON public.pagos_factura (organization_id, facturapi_rep_claim_at)
  WHERE facturapi_rep_id LIKE 'PENDING:%';

COMMENT ON COLUMN public.pagos_factura.facturapi_rep_claim_at IS
  'Momento en que facturapi-emitir-rep reclamó la fila con PENDING:<uuid>. NULL cuando ya no hay claim activo.';

-- Libera un claim PENDING huérfano de REP cuando ya pasó el umbral de gracia.
-- Devuelve TRUE si liberó, FALSE si no aplicaba. No verifica FacturAPI: el
-- llamador (edge facturapi-recuperar-claim) debe promover primero si el REP sí
-- se timbró aunque se perdió la respuesta.
CREATE OR REPLACE FUNCTION public.liberar_claim_rep_huerfano(
  p_pago_id uuid,
  p_min_edad_minutos int DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_liberado boolean := false;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.pagos_factura
  WHERE id = p_pago_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'pago no encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Autorización: sólo miembros de la organización pueden liberar claims.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.pagos_factura
  SET facturapi_rep_id = NULL,
      facturapi_rep_claim_at = NULL
  WHERE id = p_pago_id
    AND facturapi_rep_id LIKE 'PENDING:%'
    AND facturapi_rep_claim_at IS NOT NULL
    AND facturapi_rep_claim_at < now() - make_interval(mins => GREATEST(p_min_edad_minutos, 1));

  GET DIAGNOSTICS v_liberado = ROW_COUNT;
  RETURN v_liberado;
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_claim_rep_huerfano(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liberar_claim_rep_huerfano(uuid, int) TO authenticated;
```

`supabase/functions/facturapi-emitir-rep/index.ts` — imports:

```diff
-import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";
+import { getFacturapiClient, describeFacturapiError, withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
```

`index.ts` — guard 409 consciente del claim (línea 59):

```diff
-  if (pago.facturapi_rep_id) return jsonResponse({ error: "ya_timbrado_rep", message: "Este pago ya tiene REP timbrado." }, 409);
+  if (pago.facturapi_rep_id) {
+    const esClaim = String(pago.facturapi_rep_id).startsWith("PENDING:");
+    return jsonResponse({
+      error: "ya_timbrado_rep",
+      message: esClaim
+        ? "Hay un timbrado de REP en curso o interrumpido. Espera ~3 min y usa 'Recuperar timbrado'."
+        : "Este pago ya tiene REP timbrado.",
+      claim_pendiente: esClaim,
+    }, 409);
+  }
```

`index.ts` — claim atómico tras validar, antes de timbrar (contexto real líneas 150-160):

```diff
   const issues = validateRepContext(ctx);
   if (issues.length > 0) {
     await supabase.from("pagos_factura")
       .update({ estado_rep: "Error", rep_error: issues.map((i) => i.message).join("; ") })
       .eq("id", pago.id);
     return jsonResponse({ error: "validation_failed", issues }, 422);
   }
 
+  // EF-01 (auditoría): claim atómico ANTES de timbrar — mismo patrón que
+  // claimFactura (facturapi-emitir) y claimNotaCredito. Se toma DESPUÉS de
+  // validar para no liberarlo en el 422. El tag viaja como external_id a
+  // Facturapi para recuperar el REP si la edge muere entre timbrar y persistir.
+  const claimTag = `PENDING:${crypto.randomUUID()}`;
+  const claimAt = new Date().toISOString();
+  const { data: claimed, error: claimErr } = await supabase
+    .from("pagos_factura")
+    .update({ facturapi_rep_id: claimTag, facturapi_rep_claim_at: claimAt, rep_error: null })
+    .eq("id", pago.id)
+    .is("facturapi_rep_id", null)
+    .select("id")
+    .maybeSingle();
+  if (claimErr) return jsonResponse({ error: "claim_failed", detail: claimErr.message }, 500);
+  if (!claimed) return jsonResponse({ error: "ya_timbrado_rep", message: "Otro proceso ya está timbrando este REP." }, 409);
+  const releaseClaim = async () => {
+    await supabase.from("pagos_factura")
+      .update({ facturapi_rep_id: null, facturapi_rep_claim_at: null })
+      .eq("id", pago.id)
+      .eq("facturapi_rep_id", claimTag);
+  };
+
   const payload = buildRepPayload(ctx);
+  // EF-01: correlación del claim para facturapi-recuperar-claim (Facturapi NO
+  // deduplica por external_id; es sólo un campo de búsqueda).
+  payload.external_id = claimTag;
```

`index.ts` — timeout + manejo de errores (contexto real líneas 160-164):

```diff
   interface FapiInvoice { id: string; uuid: string; folio_number?: number; folio?: number; series?: string }
   let invoice: FapiInvoice;
   try {
-    invoice = await facturapi.invoices.create(payload) as FapiInvoice;
+    // EF-01/EF-02: timeout defensivo. En timeout NO se libera el claim: si
+    // Facturapi sí timbró, el tag es la única correlación para recuperarlo.
+    invoice = await withFacturapiTimeout("invoices.create", facturapi.invoices.create(payload)) as FapiInvoice;
   } catch (err) {
+    if (err instanceof FacturapiTimeoutError) {
+      await registrarBitacoraEdge(supabase, {
+        organizationId: pago.organization_id,
+        usuarioId: userData.user.id,
+        usuarioEmail: userData.user.email,
+        modulo: "facturacion",
+        accion: "facturapi_rep_emitir_timeout",
+        entidadId: pago.id,
+        detalles: { op: err.op, timeout_ms: err.timeoutMs, external_id: claimTag },
+      });
+      return jsonResponse({
+        error: "facturapi_timeout",
+        message: `${err.message}. Espera ~3 min y usa 'Recuperar timbrado' — el REP pudo haberse timbrado; no reintentes directamente.`,
+        timeout_ms: err.timeoutMs,
+        external_id: claimTag,
+      }, 504);
+    }
+    // Error definitivo de Facturapi (no timbró): liberar el claim para reintentar.
+    await releaseClaim();
     const { status, detail } = describeFacturapiError(err);
```

`index.ts` — persistencia condicionada al claim (contexto real líneas 203-220):

```diff
-  const { error: updErr } = await supabase
+  const { error: updErr, data: updRow } = await supabase
     .from("pagos_factura")
     .update({
       facturapi_rep_id: facturapiId,
+      facturapi_rep_claim_at: null,
       uuid_rep: uuid,
       folio_rep: folio,
       serie_rep: serieTimbrada,
       rep_pdf_url: pdfUrl,
       rep_xml_url: xmlUrl,
       rep_xml_backup_path: respaldo.path,
       estado_rep: "Timbrado",
       ambiente: resolved.data.ambiente,
       timbrado_rep_en: new Date().toISOString(),
       timbrado_rep_por: userData.user.id,
       rep_error: null,
     })
-    .eq("id", pago.id);
+    .eq("id", pago.id)
+    // EF-01: persistir sólo si seguimos poseyendo el claim (patrón emitir/NC).
+    .eq("facturapi_rep_id", claimTag)
+    .select("id")
+    .maybeSingle();
   if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
+  if (!updRow) return jsonResponse({ error: "claim_perdido", message: "El claim de timbrado se perdió; usa 'Recuperar timbrado' con este pago.", facturapi_id: facturapiId, uuid }, 409);
```

`supabase/functions/facturapi-emitir-rep/helpers.ts` — tipo del payload (contexto real líneas 51-55):

```diff
 export interface FacturapiRepPayload {
   type: "P";
   serie?: string;
+  /** EF-01: external_id = claimTag PENDING:<uuid> para recuperación de huérfanos. */
+  external_id?: string;
   /** v13.208.0 — Bloque HTML libre que FacturAPI imprime al pie del PDF. */
   pdf_custom_section?: string;
```

`supabase/functions/facturapi-recuperar-claim/recuperar.ts` — extensión a REP (agregar al final del archivo; reutiliza `validarClaim`, `buscarCfdiPorExternalId`, `MIN_EDAD_MINUTOS` ya existentes):

```ts
/* ── EF-01 — recuperación de claims en REP (pagos_factura) ─────────────── */

export interface ReqBodyRep { pago_id?: string }

export interface PagoRepRow {
  id: string;
  organization_id: string;
  facturapi_rep_id: string | null;
  facturapi_rep_claim_at: string | null;
}

export async function loadPagoRep(supabase: SupabaseClient, pagoId: string): Promise<PagoRepRow | Response> {
  const { data: pago, error: pErr } = await supabase
    .from("pagos_factura")
    .select("id, organization_id, facturapi_rep_id, facturapi_rep_claim_at")
    .eq("id", pagoId)
    .maybeSingle<PagoRepRow>();
  if (pErr || !pago) return jsonResponse({ error: "pago_not_found", detail: pErr?.message }, 404);
  return pago;
}

/** Adopta el REP (CFDI tipo P) que FacturAPI sí timbró con el external_id del claim. */
export async function promoverRep(input: {
  supabase: SupabaseClient; pago: PagoRepRow; match: FapiInvoice; claimTag: string;
  user: UserIdentity; apiKey: string; ambiente: string;
}): Promise<Response> {
  const { supabase, pago, match, claimTag, user, apiKey, ambiente } = input;
  const facturapiId = match.id!;
  const uuid = match.uuid!;
  const folio = match.folio_number ?? 0;
  const serieTimbrada = match.series ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  const respaldo: RespaldoResult = apiKey
    ? await respaldarXmlTimbrado({ supabase, apiKey, facturapiId, organizationId: pago.organization_id, uuid, folder: "rep" })
    : { path: null, status: "skipped" };

  const { error: updErr, data: updRow } = await supabase
    .from("pagos_factura")
    .update({
      facturapi_rep_id: facturapiId, facturapi_rep_claim_at: null,
      uuid_rep: uuid, folio_rep: folio, serie_rep: serieTimbrada,
      rep_pdf_url: pdfUrl, rep_xml_url: xmlUrl, rep_xml_backup_path: respaldo.path,
      estado_rep: "Timbrado", ambiente, rep_error: null,
      timbrado_rep_en: match.date ?? new Date().toISOString(), timbrado_rep_por: user.id,
    })
    .eq("id", pago.id)
    .eq("facturapi_rep_id", claimTag)
    .select("id")
    .maybeSingle();
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
  if (!updRow) return jsonResponse({ outcome: "claim_perdido", message: "El claim cambió mientras se recuperaba; revisa el estado actual." }, 409);

  await registrarBitacoraEdge(supabase, {
    organizationId: pago.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_rep_claim_recuperado_promovido", entidadId: pago.id,
    detalles: {
      facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada, external_id: claimTag,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });
  return jsonResponse({ outcome: "promovido", message: "Se recuperó el REP que ya estaba timbrado en FacturAPI.", facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada });
}

/** Libera el claim del REP cuando FacturAPI NO tiene el CFDI (RPC con umbral y membresía). */
export async function liberarClaimRep(
  supabase: SupabaseClient, pago: PagoRepRow, claimTag: string, edadMin: number, user: UserIdentity,
): Promise<Response> {
  const { data: liberado, error: rpcErr } = await supabase.rpc(
    "liberar_claim_rep_huerfano",
    { p_pago_id: pago.id, p_min_edad_minutos: MIN_EDAD_MINUTOS },
  );
  if (rpcErr) return jsonResponse({ error: "release_failed", detail: rpcErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: pago.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_rep_claim_recuperado_liberado", entidadId: pago.id,
    detalles: { liberado: !!liberado, external_id: claimTag, edad_minutos: Math.round(edadMin * 10) / 10 },
  });

  return jsonResponse({
    outcome: liberado ? "liberado" : "sin_cambios",
    message: liberado
      ? "No hay REP timbrado en FacturAPI; se liberó el claim para reintentar."
      : "No hay REP en FacturAPI, pero el claim ya no cumplía condiciones para liberarse.",
    edad_minutos: Math.round(edadMin * 10) / 10,
  });
}
```

`supabase/functions/facturapi-recuperar-claim/index.ts` — dispatcher (contexto real líneas 14-18 y 112-117):

```diff
 import {
   loadFactura, loadNotaCredito, validarClaim, buscarCfdiPorExternalId,
   promoverFactura, promoverNc, liberarClaim, liberarClaimNc,
+  loadPagoRep, promoverRep, liberarClaimRep,
   type ReqBody, type FapiClient,
 } from "./recuperar.ts";
```

```diff
   const body = (await req.json().catch(() => ({}))) as ReqBody;
 
+  if (body.pago_id) return recuperarRep(supabase, user, body.pago_id);
   if (body.nota_credito_id) return recuperarNotaCredito(supabase, user, body.nota_credito_id);
   if (body.factura_id) return recuperarFactura(supabase, user, body.factura_id);
-  return jsonResponse({ error: "factura_id_o_nota_credito_id_required" }, 400);
+  return jsonResponse({ error: "factura_id_nota_credito_id_o_pago_id_required" }, 400);
```

Más la función nueva en `index.ts` (espejo de `recuperarNotaCredito`, líneas 33-63):

```ts
/**
 * EF-01: la emisión de REP ahora reclama la fila con PENDING:<uuid> + external_id;
 * esta rama reconcilia contra FacturAPI igual que facturas y NCs.
 */
async function recuperarRep(supabase: SB, user: Usuario, pagoId: string): Promise<Response> {
  const pago = await loadPagoRep(supabase, pagoId);
  if (pago instanceof Response) return pago;

  if (!(await authorizeOrgRole(supabase, user.id, pago.organization_id, ROLES_EMISOR_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const { claimTag, edadMin, response: repValidation } = validarClaim(
    { facturapi_id: pago.facturapi_rep_id, facturapi_claim_at: pago.facturapi_rep_claim_at },
    "pago (REP)",
  );
  if (repValidation) return repValidation;

  const resolved = await getFacturapiClient(supabase, pago.organization_id);
  if (!resolved.ok) {
    return jsonResponse(
      { error: resolved.data.error, message: resolved.data.message },
      resolved.data.status,
    );
  }

  const match = await buscarCfdiPorExternalId(
    resolved.data.client as FapiClient, claimTag, pago.facturapi_rep_claim_at,
  );
  if (match instanceof Response) return match;
  if (match?.id && match.uuid) {
    return promoverRep({
      supabase, pago, match, claimTag, user,
      apiKey: resolved.data.apiKey, ambiente: resolved.data.ambiente,
    });
  }
  return liberarClaimRep(supabase, pago, claimTag, edadMin, user);
}
```

También ampliar `ReqBody` en `recuperar.ts` (contexto real línea 16):

```diff
-export interface ReqBody { factura_id?: string; nota_credito_id?: string }
+export interface ReqBody { factura_id?: string; nota_credito_id?: string; pago_id?: string }
```

- **Tras aplicar, verificar:**
  1. `supabase db push` aplica la migración; `SELECT liberar_claim_rep_huerfano('<uuid>', 1)` devuelve false sin claim.
  2. Doble click / dos invocaciones concurrentes de `facturapi-emitir-rep` con el mismo `pago_id`: una timbra, la otra recibe 409 `ya_timbrado_rep` — un solo REP en Facturapi.
  3. Forzar timeout (mock de Facturapi lento >30 s): respuesta 504 con `external_id`; la fila conserva `facturapi_rep_id=PENDING:<uuid>`.
  4. Invocar `facturapi-recuperar-claim` con `{ pago_id }`: si el REP existe en Facturapi → `outcome: "promovido"` y la fila queda Timbrado; si no existe y pasaron ≥3 min → `liberado` y se puede reintentar.

---

### [EF-02] Timeout de timbrado libera el claim y borra el tag de correlación → el reintento duplica el CFDI
- **Severidad:** P1 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:**
  - `supabase/functions/facturapi-emitir/emitir.ts`
  - `supabase/functions/facturapi-emitir-nota-credito/index.ts`
- **Problema:** En el `catch` de `invoices.create`, ambas funciones ejecutan `claim.release()` / `releaseClaim()` ANTES de distinguir timeout (`emitir.ts:184-192`; NC `index.ts:44-57`). Si Facturapi sí timbró pero tardó >30 s (`FACTURAPI_SDK_TIMEOUT_MS`, `_shared/facturapiClient.ts:164`), la respuesta se pierde, el claim se borra y `facturapi-recuperar-claim` ya no puede localizar el CFDI por `external_id` (`recuperar.ts:52-58` exige el tag en BD). El usuario reintenta → nuevo tag → segundo timbrado → factura/NC duplicada.
- **Fix (instrucción para Lovable):** en timeout NO liberar el claim; responder 504 indicando esperar ~3 min y usar "Recuperar timbrado". Sólo liberar en errores definitivos de Facturapi. Cambio de ~4 líneas por función; la infraestructura de recuperación ya existe (`MIN_EDAD_MINUTOS=3`).

**Diff / código:**

`supabase/functions/facturapi-emitir/emitir.ts` (contexto real líneas 180-194):

```diff
   try {
-    // FIX-04/32 — timeout defensivo: si FacturApi cuelga, liberamos el claim
-    // y devolvemos 504 en vez de dejar la Edge Function ocupada 150 s.
+    // FIX-04/32 — timeout defensivo: si FacturApi cuelga devolvemos 504 en vez
+    // de dejar la Edge Function ocupada 150 s.
     return await withFacturapiTimeout("invoices.create", facturapi.invoices.create(payload)) as FapiInvoice;
   } catch (err) {
-    await claim.release();
     if (err instanceof FacturapiTimeoutError) {
+      // EF-02 (auditoría): en timeout NO liberamos el claim. Si FacturApi sí
+      // timbró, el tag PENDING:<uuid> (external_id) es la única correlación que
+      // permite a facturapi-recuperar-claim adoptar el CFDI; liberarlo aquí
+      // convertía un timeout benigno en un CFDI duplicado al reintentar.
       await registrarBitacoraEdge(supabase, {
         organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
         accion: "facturapi_emitir_timeout", entidadId: facturaId, entidadNombre: factura.numero ?? "",
         detalles: { op: err.op, timeout_ms: err.timeoutMs },
       });
-      return jsonResponse({ error: "facturapi_timeout", message: err.message, timeout_ms: err.timeoutMs }, 504);
+      return jsonResponse({ error: "facturapi_timeout", message: `${err.message}. Espera ~3 min y usa 'Recuperar timbrado' — no reintentes el timbrado directamente.`, timeout_ms: err.timeoutMs }, 504);
     }
+    // Error definitivo de FacturApi (no timbró): sí liberamos para reintentar.
+    await claim.release();
     const { status, detail } = describeFacturapiError(err);
```

`supabase/functions/facturapi-emitir-nota-credito/index.ts` (contexto real líneas 39-58):

```diff
   try {
     // Ola 4 · N1: timeout defensivo (patrón FIX-04/32 de facturapi-emitir):
-    // si FacturAPI cuelga, liberamos el claim y devolvemos 504.
+    // si FacturAPI cuelga, devolvemos 504.
     const invoice = await withFacturapiTimeout("invoices.create", facturapi.invoices.create(payload)) as FapiInvoice;
     return { ok: true, invoice };
   } catch (err) {
-    // Ola 4 · N1: liberar el claim para que el usuario pueda reintentar.
-    await releaseClaim();
     if (err instanceof FacturapiTimeoutError) {
+      // EF-02 (auditoría): en timeout NO liberamos el claim — si FacturAPI sí
+      // timbró, recuperar-claim lo promueve por external_id; si no timbró, lo
+      // libera pasado el umbral (MIN_EDAD_MINUTOS). Liberarlo aquí perdía la
+      // correlación y el reintento duplicaba la NC.
       await registrarBitacoraEdge(supabase, {
         organizationId: meta.organizationId,
         usuarioId: meta.userId,
         usuarioEmail: meta.userEmail,
         modulo: "facturacion",
         accion: "facturapi_nc_emitir_timeout",
         entidadId: meta.notaCreditoId,
         detalles: { op: err.op, timeout_ms: err.timeoutMs },
       });
-      return { ok: false, body: { error: "facturapi_timeout", message: err.message, timeout_ms: err.timeoutMs }, status: 504 };
+      return { ok: false, body: { error: "facturapi_timeout", message: `${err.message}. Espera ~3 min y usa 'Recuperar timbrado' — no reintentes el timbrado directamente.`, timeout_ms: err.timeoutMs }, status: 504 };
     }
+    // Error definitivo de FacturAPI (no timbró): liberar el claim para reintentar.
+    await releaseClaim();
     const { status, detail } = describeFacturapiError(err);
```

Ajuste doc (opcional pero recomendado) en `_shared/facturapiClient.ts:159-162`: cambiar "el caller sigue siendo responsable de liberar cualquier claim" por "el caller NO debe liberar el claim en timeout (EF-02): lo resuelve facturapi-recuperar-claim; sólo libéralo en errores definitivos".

- **Tras aplicar, verificar:**
  1. Mock de `invoices.create` que resuelve en Facturapi pero tarda >30 s: la edge responde 504, la fila conserva `facturapi_id=PENDING:<uuid>` y `facturapi_claim_at`.
  2. Tras el 504, invocar `facturapi-recuperar-claim`: promueve el CFDI si existe (estado Emitida/Timbrada, claim limpio) o libera el claim si no existe.
  3. Error 4xx real de Facturapi (p. ej. payload inválido post-validación): el claim SÍ se libera y el reintento inmediato funciona.

---

### [EF-03] Cancelaciones asíncronas de Nota de Crédito quedan 'pending' para siempre (ni webhook ni cron las reconcilian)
- **Severidad:** P1 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:**
  - `supabase/functions/facturapi-reconciliar-cancelaciones/index.ts`
  - `supabase/functions/facturapi-reconciliar-cancelaciones/reconcile.ts`
  - `supabase/migrations/20260813120300_fix_ef03_nc_acuse_cancelacion.sql` (NUEVA)
- **Problema:** `facturapi-cancelar-nota-credito/terminales.ts` (fn `pendiente`, líneas 56-85) escribe `cancellation_status='pending'` + `cancelacion_vence_en` en `factura_notas_credito`, pero el cron `facturapi-reconciliar-cancelaciones/index.ts:150-155` sólo barre `facturas` y el webhook resuelve por `facturapi_id` sólo contra `facturas`/`pagos_factura` (`facturapi-webhook/index.ts:64-70`). Cuando el receptor acepta en su Buzón Tributario o corre silencio positivo a las 72 h, ninguna ruta cierra la NC: queda eternamente "cancelación pendiente" y no se descarga el acuse SAT. Verificado con grep: ninguna otra ruta toca `factura_notas_credito.cancellation_status`.
- **Fix (instrucción para Lovable):**
  1. Aplica la migración nueva (columnas de acuse en `factura_notas_credito`, espejo de las de `facturas`).
  2. En `reconcile.ts` agrega `NotaCreditoPendiente` + `resolveNextActionNc` (misma lógica que `resolveNextAction`, pero el estado terminal es `Cancelada` — las NC no tienen sustitución).
  3. En `index.ts` agrega un segundo barrido sobre `factura_notas_credito` con `applyAcceptedNc` (acuse + patch + bitácora) reutilizando el loop por org ya existente.

**Diff / código:**

Migración NUEVA `supabase/migrations/20260813120300_fix_ef03_nc_acuse_cancelacion.sql` (completa; espejo de `20260706034043_...sql` para facturas):

```sql
-- EF-03 (auditoría edge functions): la reconciliación de cancelaciones de NC
-- necesita persistir el acuse SAT igual que las facturas (conservación 5 años).

ALTER TABLE public.factura_notas_credito
  ADD COLUMN IF NOT EXISTS acuse_cancelacion_xml TEXT,
  ADD COLUMN IF NOT EXISTS acuse_cancelacion_fecha TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acuse_cancelacion_status TEXT;

COMMENT ON COLUMN public.factura_notas_credito.acuse_cancelacion_xml IS 'XML de acuse de cancelación SAT de la NC (recibido vía FacturApi). Obligatorio conservar por 5 años (SAT 2022+).';
COMMENT ON COLUMN public.factura_notas_credito.acuse_cancelacion_fecha IS 'Timestamp en que se descargó y guardó el acuse SAT de la NC.';
COMMENT ON COLUMN public.factura_notas_credito.acuse_cancelacion_status IS 'Estado de la descarga del acuse (accepted/pending/error_*).';
```

`reconcile.ts` — agregar (los imports y tipos existentes no cambian):

```ts
/** EF-03: fila de NC con cancelación asíncrona pendiente. */
export interface NotaCreditoPendiente {
  id: string;
  organization_id: string;
  facturapi_id: string;
  cancellation_status: string;
}

/**
 * EF-03: espejo de resolveNextAction para notas de crédito. Las NC no tienen
 * flujo de sustitución, así que el estado terminal siempre es 'Cancelada'.
 */
export function resolveNextActionNc(
  remote: FapiInvoiceStatus,
  local: NotaCreditoPendiente,
  nowIso: string,
): ResolvedPatch {
  const cs = (remote.cancellation_status ?? "").toLowerCase();

  if (cs === "accepted" || remote.status === "canceled") {
    return {
      outcome: "accepted",
      patch: {
        estado: "Cancelada",
        cancellation_status: "accepted",
        cancelado_en: nowIso,
      },
    };
  }

  if (cs === local.cancellation_status) {
    return { outcome: "no_change", patch: {} };
  }

  if (cs === "rejected" || cs === "expired") {
    return {
      outcome: cs,
      patch: {
        cancellation_status: cs,
        cancelacion_solicitada_en: null,
        cancelacion_vence_en: null,
      },
    };
  }

  if (cs && cs !== local.cancellation_status) {
    return { outcome: "transition", patch: { cancellation_status: cs } };
  }

  return { outcome: "no_change", patch: {} };
}
```

`index.ts` — imports (contexto real líneas 13-22):

```diff
 import {
   descargarAcuse,
   resolveNextAction,
+  resolveNextActionNc,
   agruparPorOrg,
   nuevoResumen,
   acumularOutcome,
   type FacturaPendiente,
+  type NotaCreditoPendiente,
   type FapiInvoiceStatus,
   type Resumen,
 } from "./reconcile.ts";
```

`index.ts` — funciones nuevas (agregar tras `reconcileOne`, línea 133):

```ts
/** EF-03: cierra una NC cuya cancelación el SAT aceptó asíncronamente (acuse + bitácora). */
async function applyAcceptedNc(
  supabase: SupabaseClient,
  nc: NotaCreditoPendiente,
  patchBase: Record<string, unknown>,
  apiKey: string,
  orgId: string,
): Promise<boolean> {
  const acuse = await descargarAcuse(nc.facturapi_id, apiKey);
  const patch = {
    ...patchBase,
    acuse_cancelacion_xml: acuse.xml,
    acuse_cancelacion_fecha: acuse.xml ? new Date().toISOString() : null,
    acuse_cancelacion_status: acuse.status,
  };
  const { error: upErr } = await supabase.from("factura_notas_credito").update(patch).eq("id", nc.id);
  if (upErr) return false;

  await registrarBitacoraEdge(supabase, {
    organizationId: orgId,
    usuarioId: null,
    modulo: "facturacion",
    accion: "facturapi_nc_cancelada_async",
    entidadId: nc.id,
    detalles: { via: "cron_reconciliacion", cancellation_status: "accepted" },
  });
  return true;
}

/** EF-03: espejo de reconcileOne para factura_notas_credito. */
async function reconcileOneNc(ctx: ReconcileCtx, nc: NotaCreditoPendiente): Promise<void> {
  const { supabase, facturapi, apiKey, orgId, resumen } = ctx;
  resumen.revisadas++;
  try {
    const remote = await facturapi.invoices.retrieve(nc.facturapi_id) as FapiInvoiceStatus;
    const decision = resolveNextActionNc(remote, nc, new Date().toISOString());

    if (decision.outcome === "no_change") {
      resumen.sin_cambio++;
      return;
    }

    if (decision.outcome === "accepted") {
      const ok = await applyAcceptedNc(supabase, nc, decision.patch, apiKey, orgId);
      if (!ok) { resumen.errores++; return; }
      resumen.aceptadas++;
      return;
    }

    // rejected / expired / transition
    await supabase.from("factura_notas_credito").update(decision.patch).eq("id", nc.id);
    if (decision.outcome === "rejected" || decision.outcome === "expired") {
      await registrarBitacoraEdge(supabase, {
        organizationId: orgId,
        usuarioId: null,
        modulo: "facturacion",
        accion: "facturapi_nc_cancelacion_no_aceptada",
        entidadId: nc.id,
        detalles: { via: "cron_reconciliacion", cancellation_status: decision.outcome },
      });
    }
    acumularOutcome(resumen, decision.outcome);
  } catch (_err) {
    resumen.errores++;
  }
}
```

`index.ts` — barrido de NCs dentro del handler (contexto real líneas 150-175):

```diff
   const { data: pendientes, error: fetchErr } = await supabase
     .from("facturas")
     .select("id, organization_id, facturapi_id, cancellation_status, sustituida_por")
     .in("cancellation_status", ["pending", "verifying"])
     .not("facturapi_id", "is", null)
     .limit(200);
 
   if (fetchErr) return jsonResponse({ error: "db_fetch_failed", detail: fetchErr.message }, 500);
 
+  // EF-03: las cancelaciones asíncronas de NC también se reconcilian aquí —
+  // el webhook no las resuelve (factura_not_found → ignored) y sin este
+  // barrido quedaban 'pending' para siempre tras el silencio positivo de 72 h.
+  const { data: ncPendientes, error: ncFetchErr } = await supabase
+    .from("factura_notas_credito")
+    .select("id, organization_id, facturapi_id, cancellation_status")
+    .in("cancellation_status", ["pending", "verifying"])
+    .not("facturapi_id", "is", null)
+    .limit(200);
+
+  if (ncFetchErr) return jsonResponse({ error: "db_fetch_failed", detail: ncFetchErr.message }, 500);
+
   const facturas = (pendientes ?? []) as FacturaPendiente[];
+  const notasCredito = (ncPendientes ?? []) as NotaCreditoPendiente[];
   const resumen = nuevoResumen();
   const porOrg = agruparPorOrg(facturas);
+  const ncPorOrg = agruparPorOrg(notasCredito as unknown as FacturaPendiente[]);
+  // Unir las llaves de ambos mapas para resolver el cliente una sola vez por org.
+  const orgIds = new Set<string>([...porOrg.keys(), ...ncPorOrg.keys()]);
 
-  for (const [orgId, lote] of porOrg) {
+  for (const orgId of orgIds) {
+    const lote = porOrg.get(orgId) ?? [];
+    const loteNc = (ncPorOrg.get(orgId) ?? []) as unknown as NotaCreditoPendiente[];
     const resolved = await getFacturapiClient(supabase, orgId);
     if (!resolved.ok) {
-      resumen.errores += lote.length;
+      resumen.errores += lote.length + loteNc.length;
       continue;
     }
     const ctx: ReconcileCtx = {
       supabase, facturapi: resolved.data.client, apiKey: resolved.data.apiKey, orgId, resumen,
     };
     for (const factura of lote) {
       await reconcileOne(ctx, factura);
     }
+    for (const nc of loteNc) {
+      await reconcileOneNc(ctx, nc);
+    }
   }
```

Nota: el `resumen` ahora mezcla facturas y NCs; si se quiere separar, duplicar `nuevoResumen()` como `resumenNc` y devolver ambos en el JSON (retrocompatible: agregar una llave nueva al body).

- **Tras aplicar, verificar:**
  1. `supabase db push`: las 3 columnas de acuse existen en `factura_notas_credito`.
  2. Sembrar una NC con `cancellation_status='pending'` y mock de `invoices.retrieve` devolviendo `cancellation_status:'accepted'`: tras correr el cron, la NC queda `estado='Cancelada'`, con acuse descargado y bitácora `facturapi_nc_cancelada_async`.
  3. Mock `rejected`: la NC vuelve a operable (`cancellation_status='rejected'`, fechas limpias) — mismo comportamiento que `terminales.ts/rechazada`.
  4. Confirmar que el restablecimiento de saldo/CxC de la factura original queda igual que en la ruta síncrona (`terminales.ts/aceptada` no ejecuta hooks adicionales; si existe trigger en BD para `estado→Cancelada`, debe dispararse igual vía UPDATE).

---

### [EF-04] exchange-rates enmascara el EUR fallback (18.5 hardcoded) como tipo de cambio real
- **Severidad:** P1 (fiscal) · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:**
  - `supabase/functions/exchange-rates/index.ts`
  - `src/features/catalogos/services/index.ts` (consumidor frontend)
  - `src/features/anticipos-proveedor/components/RegistrarAnticipoDialog.tsx` (consumidor de TC en EUR)
- **Problema:** En `leerTcDeTabla` (`exchange-rates/index.ts:132-135`) y en la rama Banxico (`index.ts:205-211`), cuando el EUR no viene de la fuente se devuelve `eurMxn: FALLBACK.eurMxn` (18.5 hardcoded) con `es_fallback: false, origen: "tabla"/"banxico"` — el flag miente. El propio contrato FIX-10 (líneas 31-36) exige que los consumidores fiscales rechacen `es_fallback: true`, pero aquí una factura/anticipo en EUR se opera con un TC estimado presentado como dato DOF.
- **Fix (instrucción para Lovable):** cuando el EUR no venga de Banxico/tabla, devolver `eurMxn: null` + flag parcial `eur_es_fallback: true` (mantener `es_fallback: false`: el USD sí es real). Propagar el flag al consumidor frontend (`eurEsFallback`) y que los flujos con moneda EUR rechacen/marquen el TC estimado en vez de pre-cargarlo como válido.

**Diff / código:**

`supabase/functions/exchange-rates/index.ts` — tipo (contexto real líneas 54-60):

```diff
 interface Rates {
   usdMxn: number;
-  eurMxn: number;
+  // EF-04: null cuando la fuente no trae EUR — nunca el fallback 18.5
+  // disfrazado de TC real (contrato FIX-10).
+  eurMxn: number | null;
   fechaAplicada?: string;
   es_fallback?: false;
+  /** EF-04: true cuando el EUR no vino de Banxico/tabla (fallback parcial). */
+  eur_es_fallback?: boolean;
   origen?: "tabla" | "banxico";
 }
```

`exchange-rates/index.ts` — ruta tabla (contexto real líneas 127-136):

```diff
     const usdMxn = Number(data.usd_mxn);
     if (!Number.isFinite(usdMxn) || usdMxn <= 0) return null;
     const eur = Number(data.eur_mxn);
+    const eurValido = Number.isFinite(eur) && eur > 0;
     return {
       usdMxn,
-      eurMxn: Number.isFinite(eur) && eur > 0 ? eur : FALLBACK.eurMxn,
+      // EF-04: EUR ausente ⇒ null + flag; jamás FALLBACK.eurMxn con es_fallback:false.
+      eurMxn: eurValido ? eur : null,
       fechaAplicada: data.fecha_publicacion_usd ?? undefined,
       es_fallback: false,
+      eur_es_fallback: !eurValido,
       origen: "tabla",
     };
```

`exchange-rates/index.ts` — ruta Banxico (contexto real líneas 205-211):

```diff
     const rates: Rates = {
       usdMxn: usd.tc,
-      eurMxn: eurMxn ?? FALLBACK.eurMxn,
+      // EF-04: EUR ausente ⇒ null + flag; jamás FALLBACK.eurMxn con es_fallback:false.
+      eurMxn: eurMxn ?? null,
       fechaAplicada: usd.fechaAplicada,
       es_fallback: false,
+      eur_es_fallback: eurMxn == null,
       origen: "banxico",
     };
```

Actualizar también el comentario de contrato (línea 13): `Contrato de respuesta invariante: { usdMxn, eurMxn }` → `{ usdMxn, eurMxn|null, eur_es_fallback? }`.

`src/features/catalogos/services/index.ts` — interfaz y mapeo (contexto real líneas 39-49 y 169-176):

```diff
 export interface ExchangeRates {
   usdMxn: number;
   eurMxn: number;
   /** Fecha (ISO YYYY-MM-DD) del FIX efectivamente aplicado por Banxico. Sólo
    *  la edge la devuelve; puede quedar undefined si viene del fallback. */
   fechaAplicada?: string;
   /** FIX-10: `true` si los valores vienen del fallback (Banxico caído, sin token,
    *  error de red). Los flujos fiscales DEBEN rechazar rates con este flag. */
   esFallback?: boolean;
+  /** EF-04: `true` si el EUR es estimado (18.5) aunque el USD sea real. Los
+   *  flujos en moneda EUR DEBEN rechazar/marcar el TC cuando este flag está. */
+  eurEsFallback?: boolean;
 }
```

```diff
   return {
     usdMxn: data?.usdMxn ?? EXCHANGE_RATES_FALLBACK.usdMxn,
     eurMxn: data?.eurMxn ?? EXCHANGE_RATES_FALLBACK.eurMxn,
     fechaAplicada: data?.fechaAplicada,
     // FIX-10: la edge usa snake_case (`es_fallback`), el cliente camelCase.
     // RG18 (Ola 3): si el cuerpo 200 viene sin `usdMxn`, estamos mostrando el
     // fallback aunque la edge no lo haya marcado; hay que declararlo.
     esFallback: data?.es_fallback === true || data?.usdMxn == null,
+    // EF-04: igual para el EUR — la edge lo declara con `eur_es_fallback` o
+    // con `eurMxn: null`; en ambos casos el valor mostrado (18.5) es estimado.
+    eurEsFallback: data?.eur_es_fallback === true || data?.eurMxn == null,
   };
```

`src/features/anticipos-proveedor/components/RegistrarAnticipoDialog.tsx` — no pre-cargar el TC EUR estimado como si fuera DOF (contexto real líneas 76-83):

```diff
   // Precarga el TC del DOF cuando la moneda deja de ser MXN.
   useEffect(() => {
     if (!open || moneda === "MXN" || !tc) return;
+    // EF-04: si el TC de la moneda es fallback estimado, NO sugerirlo — el
+    // usuario debe capturar el TC real (DOF/Banxico) manualmente.
+    if (moneda === "EUR" && tc.eurEsFallback) return;
+    if (moneda !== "EUR" && tc.esFallback) return;
     const sugerido = moneda === "EUR" ? tc.eurMxn : tc.usdMxn;
     if (sugerido && !(Number(tipoCambioUsd) > 0)) {
       setValue("tipoCambioUsd", sugerido, { shouldValidate: true, shouldDirty: true });
     }
   }, [open, moneda, tc, tipoCambioUsd, setValue]);
```

(Recomendado: mostrar además un aviso "TC EUR no disponible en DOF/Banxico — captura el tipo de cambio manualmente" cuando se salta la sugerencia.)

- **Tras aplicar, verificar:**
  1. Con `tipos_cambio_dof.eur_mxn` NULL para hoy: la edge responde `eurMxn: null, eur_es_fallback: true, es_fallback: false`.
  2. Con EUR presente en tabla/Banxico: `eurMxn` numérico y `eur_es_fallback: false`.
  3. Sin `BANXICO_SIE_TOKEN` o con USD faltante: sigue respondiendo el FALLBACK completo con `es_fallback: true` (rutas líneas 187-191 y 201-203 — sin cambio).
  4. Frontend: anticipo en EUR con EUR faltante → no se pre-carga 18.5; el campo queda vacío para captura manual.

---

### [EF-05] verificar-sat-lote no cabe en el wall-clock de la Edge Function (y fetch SAT sin timeout)
- **Severidad:** P2 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:**
  - `supabase/functions/_shared/satConsulta.ts`
  - `supabase/functions/verificar-sat-lote/index.ts`
  - `supabase/functions/facturapi-cancelar/index.ts`
  - `supabase/functions/facturapi-cancelar-rep/index.ts`
  - `supabase/functions/facturapi-cancelar-nota-credito/index.ts`
- **Problema:** `PAUSA_MS = 350` (línea 32) × `LIMITE_MAX = 500` (línea 34) = 175 s sólo de pausas — más que los ~150 s que Deno da a la edge (documentado en `_shared/facturapiClient.ts:154`); con el default 200 el lote típico tarda ~8 min. Además `_shared/satConsulta.ts:72` hace `fetch` al SAT sin `AbortSignal`: un fetch colgado bloquea todo el lote. Divergencia relacionada: `facturapi-cancelar/index.ts:142`, `facturapi-cancelar-rep/index.ts:94` y `facturapi-cancelar-nota-credito/index.ts:54` llaman `invoices.cancel` sin `withFacturapiTimeout`, contra la guía "Envuelve TODA llamada al SDK" (`facturapiClient.ts:159`).
- **Fix (instrucción para Lovable):** (1) `AbortController` de 12 s en el fetch SAT; (2) tope efectivo de 50 por corrida (el trabajo parcial ya persiste por fila y el frontend puede reinvocar con `solo_sin_verificar`); (3) envolver los tres `invoices.cancel` con `withFacturapiTimeout` y rama 504 explícita.

**Diff / código:**

`supabase/functions/_shared/satConsulta.ts` (contexto real líneas 67-84):

```diff
+/** EF-05: timeout defensivo — un fetch SAT colgado bloqueaba todo el lote de
+ * verificar-sat-lote hasta que Deno mataba la edge (~150 s). */
+const SAT_FETCH_TIMEOUT_MS = 12_000;
+
 async function consultarSatVariante(
   datos: DatosConsultaSat,
   variant: AmpersandVariant,
 ): Promise<ResultadoSat> {
   const envelope = buildSoapEnvelope(datos, variant);
-  const res = await fetch(SAT_ENDPOINT, {
-    method: "POST",
-    headers: {
-      "Content-Type": "text/xml; charset=utf-8",
-      "SOAPAction": "http://tempuri.org/IConsultaCFDIService/Consulta",
-    },
-    body: envelope,
-  });
-  const xml = await res.text();
-  if (!res.ok) return { estatus: "Error", raw: xml.slice(0, 500) };
-  const { estado, codigo } = parseSatResponse(xml);
-  return { estatus: mapEstatus(estado, codigo), raw: `${codigo} | ${estado}` };
+  const ctrl = new AbortController();
+  const timer = setTimeout(() => ctrl.abort(), SAT_FETCH_TIMEOUT_MS);
+  try {
+    const res = await fetch(SAT_ENDPOINT, {
+      method: "POST",
+      headers: {
+        "Content-Type": "text/xml; charset=utf-8",
+        "SOAPAction": "http://tempuri.org/IConsultaCFDIService/Consulta",
+      },
+      body: envelope,
+      signal: ctrl.signal,
+    });
+    const xml = await res.text();
+    if (!res.ok) return { estatus: "Error", raw: xml.slice(0, 500) };
+    const { estado, codigo } = parseSatResponse(xml);
+    return { estatus: mapEstatus(estado, codigo), raw: `${codigo} | ${estado}` };
+  } catch (e) {
+    // EF-05: timeout/abort ⇒ la fila queda como Error y el lote continúa.
+    if ((e as Error).name === "AbortError") {
+      return { estatus: "Error", raw: `sat_timeout_${SAT_FETCH_TIMEOUT_MS}ms` };
+    }
+    throw e;
+  } finally {
+    clearTimeout(timer);
+  }
 }
```

`supabase/functions/verificar-sat-lote/index.ts` (contexto real líneas 32-34 y comentario línea 7):

```diff
- *     limite?: number,               // default 200, máx 500
+ *     limite?: number,               // default 50, máx 50 (EF-05: wall-clock)
```

```diff
 const PAUSA_MS = 350;
-const LIMITE_DEFAULT = 200;
-const LIMITE_MAX = 500;
+// EF-05: con 200/500 el lote no cabe en el wall-clock de la edge (~150 s):
+// 500 pausas solas = 175 s; 200 × ~2.4 s ≈ 8 min. Tope efectivo 50 por
+// corrida; el cliente puede auto-reinvocar con solo_sin_verificar=true para
+// drenar el backlog (el progreso parcial ya persiste por fila).
+const LIMITE_DEFAULT = 50;
+const LIMITE_MAX = 50;
```

`supabase/functions/facturapi-cancelar/index.ts` (contexto real líneas 17 y 139-145):

```diff
-import { getFacturapiClient } from "../_shared/facturapiClient.ts";
+import { getFacturapiClient, withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
+import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
```

```diff
   try {
     const cancelPayload: { motive: string; substitution?: string } = { motive: motivo };
     if (sustituyeFacturapiId) cancelPayload.substitution = sustituyeFacturapiId;
-    cancelResp = await facturapi.invoices.cancel(
-      factura.facturapi_id,
-      cancelPayload,
-    ) as FapiCancelResponse;
+    // EF-05: timeout defensivo (guía facturapiClient.ts "Envuelve TODA llamada
+    // al SDK"). En timeout el cron reconciliar-cancelaciones sincroniza el estado real.
+    cancelResp = await withFacturapiTimeout(
+      "invoices.cancel",
+      facturapi.invoices.cancel(factura.facturapi_id, cancelPayload),
+    ) as FapiCancelResponse;
   } catch (err) {
+    if (err instanceof FacturapiTimeoutError) {
+      await registrarBitacoraEdge(supabase, {
+        organizationId: factura.organization_id,
+        usuarioId: userData.user.id,
+        usuarioEmail: userData.user.email,
+        modulo: "facturacion",
+        accion: "facturapi_cancelar_timeout",
+        entidadId: factura_id,
+        detalles: { op: err.op, timeout_ms: err.timeoutMs },
+      });
+      return jsonResponse({ error: "facturapi_timeout", message: `${err.message}. Verifica el estado de la cancelación en unos minutos (el cron de reconciliación la sincroniza).`, timeout_ms: err.timeoutMs }, 504);
+    }
     return await handleCancelFailure({
```

`supabase/functions/facturapi-cancelar-rep/index.ts` (contexto real líneas 12 y 90-95):

```diff
-import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";
+import { getFacturapiClient, describeFacturapiError, withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
```

```diff
   try {
     // Ola 4 · N5: `substitution` lleva el ObjectId del sustituto, no el UUID.
     const cancelPayload: { motive: string; substitution?: string } = { motive: body.motivo };
     if (sustituyeFacturapiId) cancelPayload.substitution = sustituyeFacturapiId;
-    cancelResp = await facturapi.invoices.cancel(pago.facturapi_rep_id, cancelPayload) as FapiCancelResponse;
+    // EF-05: timeout defensivo — el webhook/cron reconcilian el estado real.
+    cancelResp = await withFacturapiTimeout("invoices.cancel", facturapi.invoices.cancel(pago.facturapi_rep_id, cancelPayload)) as FapiCancelResponse;
   } catch (err) {
+    if (err instanceof FacturapiTimeoutError) {
+      await registrarBitacoraEdge(supabase, {
+        organizationId: pago.organization_id,
+        usuarioId: userData.user.id,
+        usuarioEmail: userData.user.email,
+        modulo: "facturacion",
+        accion: "facturapi_rep_cancelar_timeout",
+        entidadId: pago.id,
+        detalles: { op: err.op, timeout_ms: err.timeoutMs },
+      });
+      return jsonResponse({ error: "facturapi_timeout", message: `${err.message}. Verifica el estado de la cancelación en unos minutos.`, timeout_ms: err.timeoutMs }, 504);
+    }
     const { status, detail } = describeFacturapiError(err);
```

`supabase/functions/facturapi-cancelar-nota-credito/index.ts` (contexto real líneas 11 y 49-55):

```diff
-import { getFacturapiClient, describeFacturapiError, extractFacturapiMessage } from "../_shared/facturapiClient.ts";
+import { getFacturapiClient, describeFacturapiError, extractFacturapiMessage, withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
```

```diff
   let cancelResp: FapiCancelResponse;
   try {
     // Ola 4 · N4: `substitution` lleva el ObjectId de la sustituta, no el UUID.
     const cancelPayload: { motive: string; substitution?: string } = { motive: body.motivo! };
     if (sustituyeFacturapiId) cancelPayload.substitution = sustituyeFacturapiId;
-    cancelResp = await facturapi.invoices.cancel(nc.facturapi_id, cancelPayload) as FapiCancelResponse;
+    // EF-05: timeout defensivo — el cron reconciliar-cancelaciones (EF-03)
+    // sincroniza el estado real de la NC.
+    cancelResp = await withFacturapiTimeout("invoices.cancel", facturapi.invoices.cancel(nc.facturapi_id, cancelPayload)) as FapiCancelResponse;
   } catch (err) {
+    if (err instanceof FacturapiTimeoutError) {
+      await registrarBitacoraEdge(supabase, {
+        organizationId: nc.organization_id,
+        usuarioId: userData.user.id,
+        usuarioEmail: userData.user.email,
+        modulo: "facturacion",
+        accion: "facturapi_nc_cancelar_timeout",
+        entidadId: body.nota_credito_id,
+        detalles: { op: err.op, timeout_ms: err.timeoutMs },
+      });
+      return jsonResponse({ error: "facturapi_timeout", message: `${err.message}. Verifica el estado de la cancelación en unos minutos.`, timeout_ms: err.timeoutMs }, 504);
+    }
     const { status, detail } = describeFacturapiError(err);
```

- **Tras aplicar, verificar:**
  1. Lote de 50 con SAT lento: cada consulta se corta a los 12 s y queda `uuid_estatus_sat='Error'`; la respuesta 200 llega con el resumen (ya no `Edge Function returned a non-2xx`).
  2. `limite=500` en el body ahora se capea a 50 (revisar `parseLimite`).
  3. Mock de `invoices.cancel` colgado en las 3 funciones de cancelación: 504 a los 30 s + bitácora `*_cancelar_timeout`; la factura/NC/REP no queda en estado inconsistente (la reconciliación posterior cierra).
  4. Riesgo residual conocido: 50 filas × timeout SAT de 12 s en el peor caso (~10 min) aún excede el wall-clock, pero requiere que TODAS las consultas cuelguen; el progreso parcial persiste por fila.

---

### [EF-06] Webhook: eventos fuera de orden regresan estados (guard N3 solo existe para facturas, no para REP ni para cancellation_status)
- **Severidad:** P2 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:** `supabase/functions/facturapi-webhook/index.ts`
- **Problema:** (a) `mapCancellationStatusUpdated` (`helpers.ts:56-77`) parchea `cancellation_status='pending'/'verifying'` a ciegas: un evento retrasado tras el `accepted` reescribe el estado terminal y el cron la vuelve a barrer. (b) `handleReceiptEvent` (`index.ts:41-44`) aplica `estado_rep='Timbrado'` a ciegas cuando llega `receipt.status_updated(valid)`: un evento tardío tras `receipt.canceled` **resucita** un REP cancelado. La rama de facturas sí tiene el guard N3 (`index.ts:83-86` ESTADOS_HASTA_EMISION) — divergencia.
- **Fix (instrucción para Lovable):** reutilizar el patrón N3: no sobrescribir `cancellation_status` si el valor local es `accepted`, y no regresar `estado_rep` a `Timbrado` ni `rep_cancellation_status` si el REP local ya está `Cancelado`/aceptado. Los guards van en `index.ts` (donde se conoce el estado local), no en los mappers puros.

**Diff / código:**

`index.ts` — guard para REP en `handleReceiptEvent` (contexto real líneas 33-45):

```diff
   const { data: pago } = await supabase
     .from("pagos_factura")
-    .select("id, organization_id")
+    .select("id, organization_id, estado_rep, rep_cancellation_status")
     .eq("facturapi_rep_id", receipt.facturapi_rep_id)
     .eq("organization_id", orgId)
     .maybeSingle();
   if (!pago) return jsonResponse({ ok: true, ignored: "pago_not_found" });
 
+  // EF-06 (guard N3 para REP): eventos fuera de orden no deben resucitar un
+  // REP cancelado (receipt.status_updated(valid) tardío tras receipt.canceled)
+  // ni regresar rep_cancellation_status accepted → pending/verifying.
+  const patch = { ...receipt.patch };
+  if (pago.estado_rep === "Cancelado" && patch.estado_rep === "Timbrado") {
+    delete patch.estado_rep;
+    delete patch.timbrado_rep_en;
+  }
+  if (
+    pago.rep_cancellation_status === "accepted" &&
+    typeof patch.rep_cancellation_status === "string" &&
+    patch.rep_cancellation_status !== "accepted"
+  ) {
+    delete patch.rep_cancellation_status;
+  }
+  if (Object.keys(patch).length === 0) return jsonResponse({ ok: true, ignored: "estado_ya_avanzado" });
+
   const { error: updErr } = await supabase
     .from("pagos_factura")
-    .update(receipt.patch)
+    .update(patch)
     .eq("id", pago.id);
```

`index.ts` — guard para `cancellation_status` en `handleFacturaEvent` (contexto real líneas 64-87):

```diff
   const { data: factura } = await supabase
     .from("facturas")
-    .select("id, organization_id, estado, sustituida_por")
+    .select("id, organization_id, estado, sustituida_por, cancellation_status")
     .eq("facturapi_id", mapped.facturapi_id)
     .eq("organization_id", orgId)
     .maybeSingle();
```

```diff
   const ESTADOS_HASTA_EMISION = new Set(["Borrador", "Por timbrar", "Emitida"]);
   if (patch.estado === "Emitida" && (!factura.estado || !ESTADOS_HASTA_EMISION.has(factura.estado))) {
     delete patch.estado;
   }
+
+  // EF-06: un cancellation_status_updated(pending/verifying) retrasado no debe
+  // regresar una cancelación ya aceptada (retries/reordenamiento de Facturapi).
+  if (
+    factura.cancellation_status === "accepted" &&
+    typeof patch.cancellation_status === "string" &&
+    patch.cancellation_status !== "accepted"
+  ) {
+    delete patch.cancellation_status;
+    delete patch.cancelacion_solicitada_en;
+    delete patch.cancelacion_vence_en;
+  }
   if (Object.keys(patch).length === 0) return jsonResponse({ ok: true, ignored: "estado_ya_avanzado" });
```

- **Tras aplicar, verificar:**
  1. Entregar `invoice.cancellation_status_updated(accepted)` y luego `...(pending)` con la misma factura: la segunda entrega responde `ignored: "estado_ya_avanzado"` y la fila conserva `accepted`.
  2. Entregar `receipt.canceled` y luego `receipt.status_updated(status=valid)`: el REP conserva `estado_rep='Cancelado'`.
  3. Flujo normal (pending → verifying → accepted en orden) sigue aplicándose sin cambios.

---

### [EF-07] Dedupe del webhook es check-then-insert (no atómico) y posterior al procesamiento
- **Severidad:** P3 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:** `supabase/functions/facturapi-webhook/index.ts`
- **Problema:** `index.ts:194-214`: SELECT de `eventoPrevio`, procesar, INSERT dedupe. Dos entregas concurrentes del mismo `event_id` pasan ambas el SELECT y procesan en doble (mitigado porque los patches son absolutos/idempotentes). Si `registrarDedupe` falla con error distinto de 23505, el retry reprocesa.
- **Fix (instrucción para Lovable):** INSERT-first apoyado en el constraint `UNIQUE (organization_id, event_id)` existente (migración `20260721154203`): 23505 = "ya procesado/en progreso"; si el procesamiento falla (no-2xx), borrar la fila para que el retry de FacturAPI reprocese. Eliminar la función `registrarDedupe` (queda sin uso).

**Diff / código:**

`index.ts` — eliminar `registrarDedupe` (contexto real líneas 128-150):

```diff
-/** Registra el evento para dedupe; nunca falla el request por esto. */
-async function registrarDedupe(
-  supabase: SB, orgId: string, eventKey: string, event: FacturapiWebhookEvent,
-): Promise<void> {
-  const { error: dupErr } = await supabase
-    .from("facturapi_webhook_eventos")
-    .insert({
-      organization_id: orgId,
-      event_id: eventKey,
-      event_type: event.type,
-      payload: event as unknown as Record<string, unknown>,
-    });
-  // 23505 = carrera con una entrega concurrente del mismo evento (patches
-  // idempotentes). Otros errores sólo se alertan: devolver 5xx provocaría un
-  // reintento y reproceso innecesario de un evento YA procesado.
-  if (dupErr && (dupErr as { code?: string }).code !== "23505") {
-    await captureEdgeMessage("facturapi_webhook_dedupe_insert_failed", "warning", {
-      fn: "facturapi-webhook",
-      organization_id: orgId,
-      extra: { event_id: eventKey, event_type: event.type, detail: dupErr.message },
-    });
-  }
-}
-
 /** Verifica firma y parsea el evento. Devuelve Response en caso de rechazo. */
```

`index.ts` — INSERT-first atómico (contexto real líneas 190-215):

```diff
-  // FIX-22 + Ola 4 · N2 · Dedupe: (1) chequeo de dedupe, (2) procesar,
-  // (3) registrar dedupe SÓLO si el procesamiento fue 2xx (así los reintentos
-  // de FacturAPI tras un 500 no se pierden por choque de unique).
+  // EF-07 + FIX-22 + Ola 4 · N2 · Dedupe ATÓMICO (INSERT-first): el constraint
+  // UNIQUE (organization_id, event_id) convierte el 23505 en "ya procesado/en
+  // progreso" — dos entregas concurrentes ya no pasan ambas el SELECT. Si el
+  // procesamiento falla (no-2xx) se borra la fila para que el retry reprocese.
   const eventKey = await computeEventKey(rawBody, event);
-  const { data: eventoPrevio } = await supabase
-    .from("facturapi_webhook_eventos")
-    .select("id")
-    .eq("organization_id", orgId)
-    .eq("event_id", eventKey)
-    .maybeSingle();
-  if (eventoPrevio) {
+  const { error: dedupeErr } = await supabase
+    .from("facturapi_webhook_eventos")
+    .insert({
+      organization_id: orgId,
+      event_id: eventKey,
+      event_type: event.type,
+      payload: event as unknown as Record<string, unknown>,
+    });
+  if ((dedupeErr as { code?: string } | null)?.code === "23505") {
     // Fase 7 · Alerta suave: FacturAPI reintenta ante 5xx, así que algunos
     // duplicados son esperados; se envían como `info` para dashboard.
     await captureEdgeMessage("facturapi_webhook_duplicate", "info", {
       fn: "facturapi-webhook",
       organization_id: orgId,
       extra: { event_id: eventKey, event_type: event.type },
     });
     return jsonResponse({ ok: true, ignored: "duplicate_event", event_id: eventKey });
   }
+  if (dedupeErr) {
+    // Sin la tabla de dedupe no podemos garantizar at-most-once: mejor 503
+    // (FacturAPI reintentará) que procesar sin protección.
+    await captureEdgeMessage("facturapi_webhook_dedupe_insert_failed", "warning", {
+      fn: "facturapi-webhook",
+      organization_id: orgId,
+      extra: { event_id: eventKey, event_type: event.type, detail: dedupeErr.message },
+    });
+    return jsonResponse({ error: "dedupe_unavailable" }, 503);
+  }
 
   const result = await despacharEvento(supabase, orgId, event);
-  if (!result.ok) return result;
-
-  await registrarDedupe(supabase, orgId, eventKey, event);
+  if (!result.ok) {
+    // Liberar la reserva: el retry de FacturAPI debe poder reprocesar el evento.
+    await supabase
+      .from("facturapi_webhook_eventos")
+      .delete()
+      .eq("organization_id", orgId)
+      .eq("event_id", eventKey);
+    return result;
+  }
   return result;
 }));
```

- **Tras aplicar, verificar:**
  1. Dos entregas concurrentes del mismo evento (mismo `event.id`): una procesa, la otra recibe `ignored: "duplicate_event"` — un solo patch aplicado/bitácora.
  2. Forzar fallo de procesamiento (p. ej. 500 de BD): la entrega devuelve 5xx y la fila dedupe se borra; el retry posterior procesa correctamente.
  3. Entrega duplicada posterior (retry de FacturAPI tras éxito): `duplicate_event`, sin reprocesar.
  4. Riesgo residual: si la entrega A procesa-falla-borra mientras la B (duplicada) ya respondió 2xx por 23505, el evento depende del retry de A; FacturAPI reintenta entregas fallidas, así que se recupera.

---

### [EF-08] respaldarXmlTimbrado (best-effort) bloquea el camino crítico timbrado→persistencia, sin timeout
- **Severidad:** P2 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:** `supabase/functions/_shared/respaldarXmlTimbrado.ts`
- **Problema:** `_shared/respaldarXmlTimbrado.ts:43` — `fetch(.../xml)` sin `AbortSignal`, awaited entre el timbrado y el UPDATE de BD en `facturapi-emitir/emitir.ts:279-284`, NC `index.ts:160-167` y REP `index.ts:194-201`. Si ese fetch cuelga, Deno mata la edge (~150 s) DESPUÉS de timbrar y ANTES de persistir → CFDI huérfano. El helper es best-effort por diseño ("si falla... NO interrumpe el timbrado", línea 3), así que un cuelgue es exactamente lo que no debería bloquear.
- **Fix (instrucción para Lovable):** `AbortController` de 12 s en el fetch; el `catch` existente ya convierte el abort en `{ status: "error" }` sin interrumpir el flujo.

**Diff / código:**

`supabase/functions/_shared/respaldarXmlTimbrado.ts` (contexto real líneas 34-48):

```diff
+/** EF-08: timeout defensivo — este fetch va ENTRE el timbrado y el persist.
+ *  Si cuelga, Deno mata la edge (~150 s) y el CFDI queda huérfano. Best-effort
+ *  por diseño: preferimos status "error" a bloquear el camino crítico. */
+const XML_FETCH_TIMEOUT_MS = 12_000;
+
 export async function respaldarXmlTimbrado(params: {
   supabase: StorageClient;
   apiKey: string;
   facturapiId: string;
   organizationId: string;
   uuid: string;
   folder: XmlBackupFolder;
 }): Promise<RespaldoResult> {
   try {
-    const res = await fetch(`${FACTURAPI_BASE}/invoices/${params.facturapiId}/xml`, {
-      headers: { Authorization: basicAuthHeader(params.apiKey) },
-    });
+    const ctrl = new AbortController();
+    const timer = setTimeout(() => ctrl.abort(), XML_FETCH_TIMEOUT_MS);
+    let res: Response;
+    try {
+      res = await fetch(`${FACTURAPI_BASE}/invoices/${params.facturapiId}/xml`, {
+        headers: { Authorization: basicAuthHeader(params.apiKey) },
+        signal: ctrl.signal,
+      });
+    } finally {
+      clearTimeout(timer);
+    }
     if (!res.ok) {
       return { path: null, status: "error", error: `facturapi_${res.status}` };
     }
```

(El `catch (e)` de la línea 60-62 ya captura el `AbortError` y devuelve `{ path: null, status: "error", error: e.message }` — no requiere cambio.)

- **Tras aplicar, verificar:**
  1. Mock del endpoint `/xml` colgado: el respaldo se corta a los 12 s y el timbrado completa con `xml_backup.status="error"` (la factura/NC/REP sí persiste).
  2. Flujo normal: `xml_backup.status="ok"` y el archivo en el bucket `facturas`.
  3. Las 3 rutas (emitir, NC, REP) comparten el helper — una sola verificación por ruta basta.

---

### [EF-09] demo-access: endpoint público sin rate limit que re-siembra (destructivo) en cada llamada
- **Severidad:** P2 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:**
  - `supabase/functions/demo-access/index.ts`
  - `supabase/migrations/20260813120900_fix_ef09_demo_seed_state.sql` (NUEVA)
- **Problema:** `demo-access/index.ts:35-68`: sin auth ni throttle; cada request ejecuta `listUsers`, `updateUserById`/`createUser` y la RPC `seed_demo_organization` (re-siembra destructiva). Con la anon key (pública en el frontend) cualquiera puede invocarlo en bucle → costo/DoS y carreras de seed.
- **Fix (instrucción para Lovable):** (1) rate limit persistente fail-closed con la RPC `check_ratelimit` ya existente (patrón probado en `client-error-log`, líneas 93-116); (2) no re-sembrar si ya se sembró hace <10 min — marcador en tabla nueva `demo_seed_state` (migración incluida).

**Diff / código:**

Migración NUEVA `supabase/migrations/20260813120900_fix_ef09_demo_seed_state.sql` (completa):

```sql
-- EF-09 (auditoría edge functions): marcador de última re-siembra demo.
-- demo-access (service_role) la lee/escribe para no re-ejecutar la RPC
-- destructiva seed_demo_organization en cada llamada.

CREATE TABLE IF NOT EXISTS public.demo_seed_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_seeded_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.demo_seed_state (id, last_seeded_at)
VALUES (true, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.demo_seed_state ENABLE ROW LEVEL SECURITY;
-- Sin policies: sólo service_role (la edge demo-access) accede; RLS bloquea
-- a anon/authenticated por defecto.
REVOKE ALL ON public.demo_seed_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.demo_seed_state TO service_role;

COMMENT ON TABLE public.demo_seed_state IS
  'Un renglón: cuándo se re-sembró la org demo por última vez (EF-09).';
```

`demo-access/index.ts` — rate limit + skip de re-seed (contexto real líneas 26-31 y 62-68):

ANTES (inicio del try):
```ts
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
```

DESPUÉS:
```ts
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // EF-09: rate limit persistente fail-CLOSED (patrón client-error-log N51).
    // El endpoint es público por diseño; sin esto cada request re-sembraba
    // destructivamente la org demo (costo/DoS y carreras de seed).
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
    const { data: rl, error: rlErr } = await admin.rpc("check_ratelimit", {
      p_key: `demo-access:${ip}`,
      p_window_seconds: 60,
      p_max: 5,
    });
    if (rlErr) {
      console.error("demo-access ratelimit rpc failed:", rlErr.message);
      await captureEdgeException(new Error(`check_ratelimit failed: ${rlErr.message}`), {
        fn: "demo-access",
        status_code: 503,
      });
      return new Response(JSON.stringify({ error: "rate_limit_unavailable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "30" },
        status: 503,
      });
    }
    const rlResult = rl as { ok?: boolean; retry_after?: number } | null;
    if (rlResult && rlResult.ok === false) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rlResult.retry_after ?? 60) },
        status: 429,
      });
    }
```

ANTES (paso 3):
```ts
    // 3) Re-sembrar datos de ejemplo.
    const { error: seedErr } = await admin.rpc("seed_demo_organization");
    if (seedErr) throw seedErr;
```

DESPUÉS:
```ts
    // 3) Re-sembrar datos de ejemplo — EF-09: omitir si se sembró hace
    // <10 min (cada llamada re-sembraba destructivamente).
    const SEED_SKIP_MS = 10 * 60_000;
    const { data: seedState } = await admin
      .from("demo_seed_state")
      .select("last_seeded_at")
      .eq("id", true)
      .maybeSingle();
    const seededRecientemente = seedState?.last_seeded_at
      && (Date.now() - new Date(seedState.last_seeded_at as string).getTime()) < SEED_SKIP_MS;
    if (!seededRecientemente) {
      const { error: seedErr } = await admin.rpc("seed_demo_organization");
      if (seedErr) throw seedErr;
      await admin
        .from("demo_seed_state")
        .upsert({ id: true, last_seeded_at: new Date().toISOString() });
    }
```

- **Tras aplicar, verificar:**
  1. `supabase db push`: existe `demo_seed_state` con un renglón; `SELECT` con anon key es rechazado por RLS.
  2. 6 invocaciones seguidas desde la misma IP: la 6ª devuelve 429 con `Retry-After`.
  3. Dos invocaciones separadas por <10 min: la segunda NO ejecuta `seed_demo_organization` (verificar en logs/pg_stat) pero devuelve credenciales igual.
  4. El botón "Ver demo" del login sigue funcionando (happy path intacto).

---

### [EF-10] CORS wildcard `*` en endpoints autenticados con JWT (divergencia con la guía de `_shared/cors.ts`)
- **Severidad:** P3 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:**
  - `supabase/functions/facturapi-emitir/index.ts` (ejemplo completo abajo)
  - Mismo patrón en: `facturapi-cancelar/index.ts`, `facturapi-cancelar-rep/index.ts`, `facturapi-cancelar-nota-credito/index.ts`, `facturapi-recuperar-claim/index.ts`, `facturapi-test-conexion/index.ts`, `facturapi-consultar/index.ts`, `facturapi-descargar/index.ts`, `facturapi-enviar-email/index.ts`, `facturapi-emitir-nota-credito/index.ts`, `facturapi-emitir-rep/index.ts`
  - (Referencia de la guía: `supabase/functions/_shared/cors.ts:4-8` y `_shared/response.ts:10`)
- **Problema:** `_shared/cors.ts` define `buildCors(req)` (whitelist) para "TODA edge function que requiera JWT" y `corsHeaders` (`*`) "sólo endpoints públicos" — pero las funciones fiscales autenticadas responden con wildcard (además `jsonResponse` defaultea a wildcard, `response.ts:10`). Explotabilidad baja (auth Bearer, sin cookies), pero es exactamente la inconsistencia que la guía buscaba evitar.
- **Fix (instrucción para Lovable):** en cada función autenticada de la lista: (1) importar `buildCors, handlePreflightStrict` en vez de `corsHeaders`; (2) responder el OPTIONS con `handlePreflightStrict(req)`; (3) calcular `const cors = buildCors(req)` al inicio del handler y pasarlo como 3er argumento a TODOS los `jsonResponse(...)` del archivo. NO tocar los endpoints públicos (`exchange-rates`, `tracking-public`, `client-error-log`, `facturapi-webhook`, crons sin CORS de navegador). Cambio mecánico por archivo; ejemplo real completo para `facturapi-emitir`:

**Diff / código (representativo — `facturapi-emitir/index.ts`, contexto real líneas 11-12 y 32-35):**

```diff
-import { corsHeaders } from "../_shared/cors.ts";
+import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
```

```diff
 Deno.serve(wrapEdgeHandler("facturapi-emitir", async (req) => {
-  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
-  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
+  // EF-10: endpoints con JWT usan whitelist CORS (guía _shared/cors.ts), no wildcard.
+  const preflight = handlePreflightStrict(req);
+  if (preflight) return preflight;
+  const cors = buildCors(req);
+  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, cors);
 
   const authHeader = req.headers.get("Authorization");
-  if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);
+  if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401, cors);
```

…y así con cada `jsonResponse(...)` del handler: agregar `, cors` como último argumento. Nota: en funciones que delegan respuestas a helpers compartidos (`emitir.ts`, `recuperar.ts`), el helper puede seguir devolviendo wildcard mientras se migra — el riesgo residual es idéntico al actual; priorizar los `index.ts` y propagar `cors` a helpers en una segunda pasada si el tiempo lo permite.

- **Tras aplicar, verificar:**
  1. Preflight `OPTIONS` con `Origin: https://librecarga.com` → `Access-Control-Allow-Origin: https://librecarga.com`; con `Origin: https://evil.example` → `Access-Control-Allow-Origin: null`.
  2. POST autenticado desde el frontend (preview Lovable y dominio custom) sigue funcionando — la whitelist ya incluye `*.lovable.app`, `*.lovableproject.com` y librecarga.com.
  3. Llamadas server-to-server (sin Origin) no se ven afectadas.

---

### [EF-11] Respuestas 200 con error en body
- **Severidad:** P3 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:** `supabase/functions/facturapi-test-conexion/index.ts`
- **Problema:** `facturapi-test-conexion/index.ts:163-168`: errores de Facturapi (401/403/504) se devuelven como HTTP 200 `{ ok:false, status, detail }` — clientes que sólo evalúan `response.ok` los tragan como éxito. (`exchange-rates` también responde siempre 200, pero está mitigado por `es_fallback`/`eur_es_fallback` tras EF-04: sin cambio de código ahí, documentar el contrato en el cliente.)
- **Fix (instrucción para Lovable):** propagar el status HTTP real en `errorResponse`. Precaución: el cliente que invoca esta función debe leer el detalle del error desde el contexto de `FunctionsHttpError` (supabase-js v2 lo expone en `error.context`), ya no de un body 200 — ajustar el consumidor si hoy asume 200.

**Diff / código (contexto real líneas 156-168):**

```diff
 function errorResponse(err: unknown) {
   const e = (err ?? {}) as FacturapiHttpError;
   const status = e.status ?? 502;
   const detail = e.detail ?? { message: e.message ?? String(err) };
   const isTimeout = (err as Error)?.message === "facturapi_timeout";
   console.error("[facturapi-test-conexion] facturapi-call-error", { status, isTimeout });
   const isAuthError = status === 401 || status === 403;
+  // EF-11: propagar el status HTTP real — con 200 los clientes que sólo
+  // evalúan response.ok trataban los errores de FacturApi como éxito.
+  const httpStatus = isTimeout ? 504 : (Number.isInteger(status) && status >= 400 && status < 600 ? status : 502);
   return jsonResponse({
     ok: false,
-    status: isTimeout ? 504 : status,
+    status: httpStatus,
     detail: isTimeout ? { message: "Tiempo de espera agotado al contactar FacturApi (15s)." } : detail,
     message: isAuthError ? "La API key de FacturApi no es válida para este ambiente." : undefined,
-  }, 200);
+  }, httpStatus);
 }
```

- **Tras aplicar, verificar:**
  1. API key inválida (401/403 de Facturapi): la edge responde HTTP 401/403 con el mismo body `{ ok:false, ... }`; el frontend muestra "La API key de FacturApi no es válida para este ambiente." leyendo `error.context`.
  2. Timeout: HTTP 504.
  3. Happy path: HTTP 200 `{ ok:true, ... }` sin cambios.
  4. Revisar el consumidor frontend de `facturapi-test-conexion` para que no dependa de `response.ok === true` con `ok:false` en body.

---

### [EF-12] reconciliar-cancelaciones: errores tragados sin contexto y drenaje lento
- **Severidad:** P3 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:** `supabase/functions/facturapi-reconciliar-cancelaciones/index.ts`
- **Problema:** `index.ts:130-132`: `catch (_err) { resumen.errores++ }` — sin log, sin Sentry, sin `factura_id`; un fallo sistemático (p. ej. API key rotada de una org) sólo incrementa un contador. Además `.limit(200)` por corrida (cada 30 min): un backlog >200 tarda horas en drenar sin señal.
- **Fix (instrucción para Lovable):** capturar la excepción con `captureEdgeException` incluyendo `factura.id`/`facturapi_id`, y emitir una señal (`captureEdgeMessage` warning) cuando el lote llega al límite de 200 (posible backlog).

**Diff / código:**

`index.ts` — import (contexto real línea 9):

```diff
-import { wrapEdgeHandler } from "../_shared/sentry.ts";
+import { wrapEdgeHandler, captureEdgeException, captureEdgeMessage } from "../_shared/sentry.ts";
```

`index.ts` — catch con contexto (contexto real líneas 130-132):

```diff
   } catch (_err) {
-    resumen.errores++;
+    resumen.errores++;
+    // EF-12: no tragar el error — sin factura_id un fallo sistemático (API key
+    // rotada, red) sólo movía un contador invisible.
+    console.error("[reconciliar-cancelaciones] error", {
+      factura_id: factura.id,
+      error: _err instanceof Error ? _err.message : String(_err),
+    });
+    await captureEdgeException(_err, {
+      fn: "facturapi-reconciliar-cancelaciones",
+      organization_id: orgId,
+      extra: { factura_id: factura.id, facturapi_id: factura.facturapi_id },
+    });
   }
 }
```

(Aplicar el mismo patrón en el `catch` de `reconcileOneNc` agregado en EF-03, con `nc.id`.)

`index.ts` — señal de backlog (contexto real líneas 157-161):

```diff
   if (fetchErr) return jsonResponse({ error: "db_fetch_failed", detail: fetchErr.message }, 500);
 
+  // EF-12: si el lote llega al tope de 200 probablemente hay backlog que tarda
+  // horas en drenar a 200/30 min — dejar señal en Sentry para operación.
+  if ((pendientes ?? []).length === 200) {
+    await captureEdgeMessage("facturapi_reconciliar_backlog", "warning", {
+      fn: "facturapi-reconciliar-cancelaciones",
+      extra: { pendientes: 200 },
+    });
+  }
+
   const facturas = (pendientes ?? []) as FacturaPendiente[];
```

- **Tras aplicar, verificar:**
  1. Forzar error en `invoices.retrieve` (mock que lanza): la corrida responde 200 con `resumen.errores>0` Y aparece el evento en Sentry con `factura_id` + log en consola.
  2. Sembrar ≥200 filas pending: aparece el mensaje `facturapi_reconciliar_backlog` en Sentry.
  3. Corrida sin pendientes: sin ruido nuevo (cero eventos).

---

### [EF-13] Logging de token completo / prefijos de claves
- **Severidad:** P3 · **Verificación:** estático (stack local sin edge runtime)
- **Archivos:**
  - `supabase/functions/handle-email-unsubscribe/index.ts`
  - `supabase/functions/process-email-queue/queueAuth.ts`
  - `supabase/functions/_shared/sentry.ts`
- **Problema:** (a) `handle-email-unsubscribe/index.ts:50` loguea el token de unsubscribe completo (reutilizable hasta marcarse usado). (b) `queueAuth.ts:36-41` loguea `tokenPrefix`/`keyPrefix` (12 chars; hoy benigno porque es el header JWT, mala práctica si la key fuera opaca). (c) `scrubExtraDeep` (`_shared/sentry.ts:107-115`) cubre `ctx.extra`, pero el MENSAJE de la excepción no se redacta: errores de red que interpolen URLs con query params sensibles (`?token=`, `?api_key=`) llegarían crudos a Sentry.
- **Fix (instrucción para Lovable):** (a) loguear sólo un prefijo corto no reutilizable; (b) quitar los prefijos del log; (c) agregar redacción del mensaje de excepción en `captureEdgeException` con patrones de query params y Bearer.

**Diff / código:**

`handle-email-unsubscribe/index.ts` (contexto real línea 50):

```diff
   if (updateError) {
-    console.error('Failed to mark token as used', { error: updateError, token })
+    // EF-13: nunca loguear el token completo — es reutilizable hasta que se marca usado.
+    console.error('Failed to mark token as used', { error: updateError, token_prefix: token.slice(0, 8) })
     return jsonResponse({ error: 'Failed to process unsubscribe' }, 500)
   }
```

`process-email-queue/queueAuth.ts` (contexto real líneas 36-41):

```diff
   console.error('verifyServiceRoleToken: token != SUPABASE_SERVICE_ROLE_KEY', {
     tokenLen: token.length,
     keyLen: serviceRoleKey?.length ?? 0,
-    tokenPrefix: token.slice(0, 12),
-    keyPrefix: serviceRoleKey?.slice(0, 12) ?? '',
   })
```

`_shared/sentry.ts` — redacción del mensaje de excepción (contexto real líneas 107-115 y 140-150):

```diff
 function scrubExtraDeep(value: unknown, depth = 0): unknown {
   if (depth > 6 || value === null || typeof value !== "object") return value;
   if (Array.isArray(value)) return value.map((v) => scrubExtraDeep(v, depth + 1));
   const out: Record<string, unknown> = {};
   for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
     out[k] = isSensitiveKey(k) ? "[Filtered]" : scrubExtraDeep(v, depth + 1);
   }
   return out;
 }
+
+/**
+ * EF-13: scrubExtraDeep cubre ctx.extra, pero el MENSAJE de la excepción no se
+ * redactaba — errores de red que interpolan URLs con query params sensibles
+ * (`?token=`, `?api_key=`, `Bearer …`) llegaban crudos a Sentry.
+ */
+const SENSITIVE_VALUE_PATTERNS = [
+  /([?&](?:token|api[_-]?key|key|secret|password|signature)=)[^&\s]+/gi,
+  /(bearer\s+)[a-z0-9._~+/=-]+/gi,
+];
+
+export function scrubExceptionMessage(msg: string): string {
+  let out = msg;
+  for (const re of SENSITIVE_VALUE_PATTERNS) out = out.replace(re, "$1[Filtered]");
+  return out;
+}
```

```diff
   try {
     Sentry.withScope((scope: { setTag: (k: string, v: string) => void; setUser: (u: { id: string }) => void; setExtra: (k: string, v: unknown) => void; setContext: (k: string, v: Record<string, unknown>) => void }) => {
       scope.setTag("fn", ctx.fn);
       if (ctx.request_id) scope.setTag("request_id", ctx.request_id);
       if (ctx.user_id) scope.setUser({ id: ctx.user_id });
       if (ctx.organization_id) scope.setTag("organization_id", ctx.organization_id);
       if (ctx.status_code != null) scope.setTag("status_code", String(ctx.status_code));
       if (ctx.latency_ms != null) scope.setExtra("latency_ms", ctx.latency_ms);
       if (ctx.extra) scope.setContext("edge", truncatedExtra(ctx.extra));
-      Sentry.captureException(err);
+      // EF-13: redactar el mensaje antes de enviarlo (conserva name/stack).
+      if (err instanceof Error) {
+        const scrubbed = new Error(scrubExceptionMessage(err.message));
+        scrubbed.name = err.name;
+        scrubbed.stack = err.stack;
+        Sentry.captureException(scrubbed);
+      } else {
+        Sentry.captureException(err);
+      }
     });
```

- **Tras aplicar, verificar:**
  1. Forzar el fallo de UPDATE en unsubscribe: el log muestra `token_prefix` (8 chars) y nunca el token completo.
  2. Forzar `verifyServiceRoleToken` con token incorrecto: el log ya no incluye `tokenPrefix`/`keyPrefix`.
  3. Capturar `new Error("GET https://api.ejemplo.com/x?token=SECRET123 falló")` vía `captureEdgeException`: en Sentry llega `?token=[Filtered]`.
  4. `scrubExceptionMessage` es puro: agregar caso de test unitario rápido si existe suite para `_shared/sentry.ts`.

---

## Validación global tras aplicar el pack

1. **IDs cubiertos:** EF-01, EF-02, EF-03, EF-04, EF-05, EF-06, EF-07, EF-08, EF-09, EF-10, EF-11, EF-12, EF-13 (13/13).
2. **Migraciones nuevas (aplicar en orden):**
   - `supabase/migrations/20260813120100_fix_ef01_rep_claim_idempotente.sql` (EF-01)
   - `supabase/migrations/20260813120300_fix_ef03_nc_acuse_cancelacion.sql` (EF-03)
   - `supabase/migrations/20260813120900_fix_ef09_demo_seed_state.sql` (EF-09)
3. **Type check:** correr el check de Deno/tsc del repo sobre `supabase/functions/**` (los diffs introducen `payload.external_id`, `eurMxn: number | null` y campos nuevos en interfaces — verificar que no haya tests de contrato que asuman `eurMxn` siempre numérico).
4. **Tests existentes a re-correr:** guardrail `facturapi-multi-tenant.test.ts` (los imports nuevos en funciones facturapi deben seguir pasando), tests de `exchange-rates` (el contrato `eurMxn` cambia a nullable), tests de `facturapi-webhook/helpers.ts` (sin cambio en mappers puros — deben seguir verdes) y tests de `reconcile.ts` (agregar casos para `resolveNextActionNc`).
5. **Smoke fiscal (sandbox):** timbrar factura, NC y REP; doble click en REP; cancelar factura y NC con mock de `pending` y dejar que el cron cierre ambas; recuperar claim en las tres familias.
6. **Riesgos residuales declarados:** EF-05 (peor caso 50×12 s de timeouts SAT excede wall-clock, mitigado por persistencia por fila), EF-07 (ventana entre respuesta 2xx del duplicado y fallo del procesador, mitigada por retry de FacturAPI), EF-10 (helpers compartidos pueden quedar una iteración con wildcard mientras se propaga `cors`).

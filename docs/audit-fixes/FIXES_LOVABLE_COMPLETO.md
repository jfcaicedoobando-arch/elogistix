# Fix pack completo Elogistix v13.523.1 — 88 hallazgos, listo para Lovable

**Generado:** 2026-08-13 · **Base:** repo main @ 1ef05ce9 · **Fuente:** auditoría integral (ver `auditoria_elogistix_v13.523.1.docx`)

## Cómo usar este documento con Lovable

1. **Aplica en orden de Wave** (ver índice abajo). Wave 0 son los bloqueantes del release; cada entrada es independiente y de bajo riesgo (pensada para feature freeze).
2. Para cada hallazgo, copia a Lovable el bloque completo `### [ID] ...` (problema + instrucción + diff). Los diffs son unificados reales con contexto del repo; las migraciones SQL son archivos NUEVOS (nunca editar migraciones existentes).
3. Las entradas con "fix compartido / referencia cruzada" se resuelven aplicando primero la entrada referenciada (p.ej. UIA-01 → FE-01).
4. Tras cada fix, ejecuta la verificación indicada en "Tras aplicar, verificar".
5. Los hallazgos marcados **"verificar en staging"** no eran ejercitables en el stack local (edge runtime 501 / storage stub / RPC desplegada pre-migración): el fix es el probable, validar antes de merge.
6. **UIB-08** requiere texto legal aprobado (insumo humano): el código queda listo tras el flag, el contenido NO.
7. **FE-10** requiere decisión de producto (Opción A/B) antes de aplicar.

## Índice por Wave de aplicación

### Wave 0 — Bloqueantes del release (~8-10 días-persona)
| Orden | ID | Pack | Fix en síntesis |
|---|---|---|---|
| 1 | EF-01 (P0) | EF | REP con claim atómico + external_id + recuperación |
| 2 | EF-02 | EF | Timeout no libera claim (emitir + NC) |
| 3 | EF-04 | EF | EUR fallback marcado es_fallback + guard frontend |
| 4 | BL-02 | BL | Guard de org + auth.uid() en registrar_bitacora |
| 5 | N1 | TC_N | DROP sobrecarga text de log_client_error_v1 |
| 6 | BL-04 | BL | Traspasos: TC explícito obligatorio cross-moneda |
| 7 | UIA-02 | UIA | UI traspasos sin TC=1 default (con BL-04) |
| 8 | FE-01 | FE | Diálogo pago: bloquear TC=0 + guard en handler |
| 9 | UIA-01 | UIA | Delta UI del diálogo de pago (con FE-01) |
| 10 | UIA-03 | UIA | KPIs Tesorería/Facturación por moneda real |
| 11 | BL-01 | BL | Filtro deleted_at en pipeline/forecast CRM |
| 12 | EF-03 | EF | Cron reconcilia NC pending (acuse) |
| 13 | UX-01 | UX | Confirmación destructiva en catálogos |
| 14 | UIA-05 | UIA | Delta confirmación TabPuertos (con UX-01) |
| 15 | UX-02 | UX | Mensajes de error es-MX (getErrorMessage) |
| 16 | UIA-04 | UIA | /sin-acceso con rol real + state motivo |
| 17 | UIB-04 | UIB | DemoModeBanner sin "como administrador" |

### Wave 1 — P2 (siguiente sprint)
BL-03, BL-05, BL-06, EF-05, EF-06, EF-08, EF-09, FE-02, FE-03, FE-04, FE-05, FE-06, FE-07, FE-10 (decisión), FE-11, UX-03, UX-04, UX-05, UIA-06, UIA-07, UIA-08, UIA-09, UIA-11, UIB-01, UIB-02, UIB-03, UIB-06, UIB-07, UIB-08 (legal), UIB-09, UIB-11, UIB-15

### Wave 2 — P3 / quick wins (backlog priorizado)
BL-07..BL-11, EF-07, EF-10..EF-13, FE-08, FE-09, FE-12, TC-01..TC-04, UX-06..UX-14, UIA-10, UIA-12..UIA-17, UIB-10, UIB-12..UIB-14, N2 (informativo)

---



# Línea BL — Business logic / base de datos

# Fix Pack — Auditoría Business Logic / BD (BL-01 a BL-11) — Elogistix

- **Repo:** `/mnt/agents/repo` · rama `main` @ `1ef05ce9`
- **Fuente:** `/mnt/agents/output/audit_reports/01_business_logic_bd.md`
- **Destino de migraciones:** `supabase/migrations/` (Supabase ya desplegado)
- **Contexto:** feature freeze — todos los fixes son aditivos / retrocompatibles; **ninguna migración existente se edita**.

## Instrucciones generales para Lovable

1. Las migraciones nuevas se crean como archivos NUEVOS en `supabase/migrations/` con los nombres exactos indicados en cada entrada. No modificar migraciones anteriores.
2. **Orden de aplicación:** respetar los timestamps (todos son posteriores a la última migración del repo, `20260819120100`). En particular, `fix_bl04` debe aplicarse ANTES que `fix_bl09` (ambas re-crean `registrar_traspaso_bancario`; la de BL-09 ya incluye el fix de BL-04).
3. **Nota sobre timestamps (divergencia deliberada):** se usan `2026082012xxxx` en lugar de `20260813120000` porque el repo ya contiene migraciones hasta `20260819120100` y `dashboard_summary` se re-crea en `20260818120000_ola6_rg52_...sql`; un fix con timestamp anterior se perdería al hacer `supabase db reset` (replay en orden cronológico).
4. Los diffs TS son unificados reales (`--- a/` / `+++ b/`) con contexto copiado del repo en `main @ 1ef05ce9`.
5. Tras aplicar migraciones: `supabase db push` (o dejar que el pipeline de migraciones las aplique) y ejecutar las verificaciones de cada entrada.

---

### [BL-01] Soft-delete de CRM no filtrado en lecturas
- **Severidad:** P1 · **Verificación:** estático (patrón confirmado en 11 archivos; escrituras sí ponen `deleted_at`)
- **Archivos (todos bajo `src/features/crm/services/`):**
  - `oportunidades.ts` (`listOportunidades`)
  - `leads/queries.ts` (`listLeads`)
  - `plantillas.ts` (`fetchPlantillasMensaje`)
  - `dashboard.ts` (`fetchCrmDashboard`: 6 queries)
  - `forecast.ts` (`fetchForecast`, `fetchReportesCRM`)
  - `leaderboard.ts` (`fetchLeaderboardRaw`)
  - `search.ts` (`searchCrm`: 3 queries)
  - `nbaSignals.ts` (`fetchNbaSignals`)
  - `cliente360.ts` (`fetchCliente360`)
  - `comentarios.ts` (`fetchComentariosOportunidad`)
  - `actividades.ts` (`listActividades`)
  - Guardrail: `src/__tests__/architecture/facturas-soft-delete-reads.test.ts` (extender a tablas CRM)
- **Problema:** el borrado lógico existe en escritura (`eliminarOportunidad` en `oportunidades.ts:109-115`, `softDeleteLead` en `leads/mutations.ts:~34`, `eliminarPlantilla` en `plantillas.ts:72-78`, y la papelera admin en `src/features/admin/services/papelera.ts:29-35`), pero las lecturas principales no hacen `.is("deleted_at", null)`, así que leads/oportunidades/actividades "eliminados" reaparecen en pipeline, KPIs, forecast, leaderboard y búsqueda global. El patrón correcto ya existe en el mismo feature (`lineage.ts:56,71`, `proximasActividades.ts:31`). Es la misma clase de bug que el de `fetchCobranza` corregido en v13.520.0.
- **Fix (instrucción para Lovable):**
  1. Añadir `.is("deleted_at", null)` en cada lectura listada (diffs abajo). El filtro puede ir en cualquier punto de la cadena del query builder antes del `await`.
  2. **No** filtrar los catálogos de etapas (`crm_etapas_pipeline` en `dashboard.ts:92`, `forecast.ts:20-26`, `cliente360.ts:51`, `leaderboard.ts:41`): se usan como catálogo histórico para clasificar oportunidades viejas cuya etapa pudo borrarse; quitarlas reclasificaría históricos. Decisión consciente de bajo riesgo.
  3. Extender el guardrail de arquitectura (punto 4 abajo).
  4. Crear `src/__tests__/architecture/crm-soft-delete-reads.test.ts` clonando el patrón de `facturas-soft-delete-reads.test.ts` (mismo `bloquesDeLectura`) pero con regex sobre `.from("crm_oportunidades")`, `.from("crm_leads")`, `.from("crm_actividades")`, `.from("crm_comentarios_oportunidad")` y `.from("crm_plantillas_mensaje")`, exigiendo `.is("deleted_at", null)` en cada bloque, con set `EXENTOS` vacío inicialmente.
- **Diff / código:**

```diff
--- a/src/features/crm/services/oportunidades.ts
+++ b/src/features/crm/services/oportunidades.ts
@@
   let q = supabase
     .from("crm_oportunidades")
     .select(COLS, { count: "exact" })
+    .is("deleted_at", null)
     .order("created_at", { ascending: false });
```

```diff
--- a/src/features/crm/services/leads/queries.ts
+++ b/src/features/crm/services/leads/queries.ts
@@
   let q = supabase
     .from("crm_leads")
     .select(LEAD_COLUMNS, { count: "exact" })
+    .is("deleted_at", null)
     .order(sortKey, { ascending: sortDir === "asc" });
```

```diff
--- a/src/features/crm/services/plantillas.ts
+++ b/src/features/crm/services/plantillas.ts
@@
-  let q = supabase.from("crm_plantillas_mensaje").select(COLS).order("nombre");
+  let q = supabase.from("crm_plantillas_mensaje").select(COLS).is("deleted_at", null).order("nombre");
```

```diff
--- a/src/features/crm/services/dashboard.ts
+++ b/src/features/crm/services/dashboard.ts
@@
   const [leadsCountQ, opsAbiertasQ, actsPendQ, misActsQ, cerrandoQ, leadsViejosQ, etapasQ] = await Promise.all([
-    supabase.from("crm_leads").select("id", { count: "exact", head: true }),
+    supabase.from("crm_leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
     supabase
       .from("crm_oportunidades")
       .select("id, nombre, cliente_nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre, etapa_id, crm_etapas_pipeline!inner(id, nombre, color, tipo)")
+      .is("deleted_at", null)
       .eq("crm_etapas_pipeline.tipo", "abierta"),
     supabase
       .from("crm_actividades")
       .select("id", { count: "exact", head: true })
-      .is("fecha_completada", null),
+      .is("fecha_completada", null)
+      .is("deleted_at", null),
     supabase
       .from("crm_actividades")
       .select(CRM_ACTIVIDADES_COLUMNS_MIN)
       .is("fecha_completada", null)
+      .is("deleted_at", null)
       .eq("responsable_id", userId ?? "")
       .gte("fecha_programada", hoyInicio.toISOString())
       .lte("fecha_programada", hoyFin.toISOString())
@@
     supabase
       .from("crm_oportunidades")
       .select("id, nombre, cliente_nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre, crm_etapas_pipeline!inner(tipo)")
       .eq("crm_etapas_pipeline.tipo", "abierta")
+      .is("deleted_at", null)
       .gte("fecha_estimada_cierre", todayLocalISO())
       .lte("fecha_estimada_cierre", isoDaysFromNow(7))
       .order("fecha_estimada_cierre", { ascending: true })
@@
     supabase
       .from("crm_leads")
       .select("id, empresa, contacto, fuente, created_at")
       .eq("estado", "Nuevo")
+      .is("deleted_at", null)
       .lte("created_at", hace7.toISOString())
       .order("created_at", { ascending: true })
       .limit(10),
```

```diff
--- a/src/features/crm/services/forecast.ts
+++ b/src/features/crm/services/forecast.ts
@@
   let q = supabase
     .from("crm_oportunidades")
-    .select("id, monto_estimado, probabilidad, fecha_estimada_cierre, vendedor_email, etapa_id");
+    .select("id, monto_estimado, probabilidad, fecha_estimada_cierre, vendedor_email, etapa_id")
+    .is("deleted_at", null);
@@
-    supabase.from("crm_leads").select("estado, fuente").limit(LIMITE_CRM),
-    supabase.from("crm_oportunidades").select("motivo_perdida_id, etapa_id").limit(LIMITE_CRM),
+    supabase.from("crm_leads").select("estado, fuente").is("deleted_at", null).limit(LIMITE_CRM),
+    supabase.from("crm_oportunidades").select("motivo_perdida_id, etapa_id").is("deleted_at", null).limit(LIMITE_CRM),
```

```diff
--- a/src/features/crm/services/leaderboard.ts
+++ b/src/features/crm/services/leaderboard.ts
@@
     supabase
       .from("crm_oportunidades")
       .select("vendedor_email, valor_real, monto_estimado, etapa_id, fecha_cierre_real")
+      .is("deleted_at", null)
       .gte("fecha_cierre_real", inicioMesISO)
       .limit(LIMITE_OPS_MES), // defensivo: oportunidades cerradas del mes por org
```

```diff
--- a/src/features/crm/services/search.ts
+++ b/src/features/crm/services/search.ts
@@
-    supabase.from("crm_leads").select("id, empresa, contacto, email").ilike("empresa", like).limit(6),
+    supabase.from("crm_leads").select("id, empresa, contacto, email").ilike("empresa", like).is("deleted_at", null).limit(6),
     supabase
       .from("crm_oportunidades")
       .select("id, nombre, cliente_nombre")
       .or(orIlike(["nombre", "cliente_nombre"], term))
+      .is("deleted_at", null)
       .limit(6),
     supabase
       .from("crm_actividades")
       .select(CRM_ACTIVIDADES_COLUMNS_SEARCH)
       .ilike("asunto", like)
       .is("fecha_completada", null)
+      .is("deleted_at", null)
       .limit(6),
```

```diff
--- a/src/features/crm/services/nbaSignals.ts
+++ b/src/features/crm/services/nbaSignals.ts
@@
     supabase
       .from("crm_leads")
       .select("id, empresa, created_at")
       .eq("estado", "Nuevo")
+      .is("deleted_at", null)
       .lte("created_at", hace24h.toISOString())
       .order("created_at", { ascending: true })
       .limit(20),
     supabase
       .from("crm_oportunidades")
       .select("id, nombre, fecha_estimada_cierre, updated_at, crm_etapas_pipeline!inner(tipo)")
       .eq("crm_etapas_pipeline.tipo", "abierta")
+      .is("deleted_at", null)
       .order("updated_at", { ascending: true })
       .limit(50),
```

```diff
--- a/src/features/crm/services/cliente360.ts
+++ b/src/features/crm/services/cliente360.ts
@@
       .select(
         "id, nombre, etapa_id, monto_estimado, valor_real, moneda, probabilidad, fecha_estimada_cierre, created_at, vendedor_email",
       )
       .eq("cliente_id", clienteId)
+      .is("deleted_at", null)
       .order("created_at", { ascending: false })
       .limit(50),
```

```diff
--- a/src/features/crm/services/comentarios.ts
+++ b/src/features/crm/services/comentarios.ts
@@
   const { data, error } = await supabase
     .from("crm_comentarios_oportunidad")
     .select(COLS)
     .eq("oportunidad_id", oportunidadId)
+    .is("deleted_at", null)
     .order("created_at", { ascending: false })
     .limit(limit);
```

```diff
--- a/src/features/crm/services/actividades.ts
+++ b/src/features/crm/services/actividades.ts
@@
   let q = supabase
     .from("crm_actividades")
     .select(COLS, { count: "exact" })
+    .is("deleted_at", null)
     .order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
```

- **Tras aplicar, verificar:**
  1. Crear un lead y una oportunidad de prueba, eliminarlos (van a papelera) y confirmar que desaparecen de: Pipeline CRM, Dashboard (KPIs y embudo), Forecast/Reportes, Leaderboard, búsqueda global (Ctrl+K) y Cliente 360.
  2. Restaurar desde la papelera admin y confirmar que reaparecen.
  3. `bun run test` (o `vitest run src/__tests__/architecture/`) — el nuevo guardrail `crm-soft-delete-reads.test.ts` pasa y no rompe `facturas-soft-delete-reads.test.ts`.
  4. Las plantillas eliminadas ya no aparecen en el selector de plantillas de mensajes.

---

### [BL-02] RPC `registrar_bitacora` permite inyectar entradas en bitácora de otra organización y suplantar usuarios
- **Severidad:** P1 · **Verificación:** estático (definición vigente leída en repo) + dinámico sugerido
- **Archivos:**
  - Definición vigente: `supabase/migrations/20260807211258_f1f5d7b2-98bb-4a11-a888-ba0848a00c6c.sql:2-42` (única definición; no hay redefiniciones posteriores)
  - Nueva migración a crear: `supabase/migrations/20260820120000_fix_bl02_registrar_bitacora_guard_org.sql`
- **Problema:** `registrar_bitacora` es `SECURITY DEFINER` con `GRANT EXECUTE ... TO authenticated` y acepta `p_organization_id` y `p_usuario_id` sin validar membresía ni identidad (`v_uid := COALESCE(p_usuario_id, auth.uid())`). Cualquier usuario autenticado vía PostgREST inserta entradas falsas en la bitácora de otra org, atribuidas a cualquier usuario. Además, su `EXCEPTION WHEN OTHERS` traga errores (los degrada a WARNING), así que un guard ingenuo sería silenciado: hay que re-lanzar la excepción de privilegio.
- **Fix (instrucción para Lovable):**
  1. Crear la migración de abajo: re-crea la función con (a) guard de organización e identidad para llamadas directas con JWT de usuario (`auth.role() = 'authenticated'`): fuerza `v_uid := auth.uid()` y rechaza org ajena con `RAISE EXCEPTION ... ERRCODE='42501'`; (b) `WHEN insufficient_privilege THEN RAISE;` antes del `WHEN OTHERS` para que el rechazo no se convierta en WARNING.
  2. No tocar grants (se re-aplican idénticos en la misma migración).
  3. **Compatibilidad verificada en repo:** las llamadas internas desde funciones `SECURITY DEFINER` (`cerrar_embarque`, `reabrir_embarque`, etc.) y triggers pasan `auth.role()` distinto de `'authenticated'` cuando corren como owner... las llamadas internas desde la app web sí llevan JWT del usuario, pero siempre pasan la org del usuario autenticado (p. ej. `cerrar_embarque` pasa `v_emb.organization_id` del embarque que el usuario está operando bajo RLS), por lo que el guard no las rompe. `service_role` (edge functions/cron) queda fuera del guard.
  4. El frontend NO usa esta RPC directamente (verificado: `src/services/bitacora/registrar.ts:65` inserta directo en `bitacora_actividad` vía RLS), así que no hay cambio TS.
- **Diff / código:** contenido COMPLETO de `supabase/migrations/20260820120000_fix_bl02_registrar_bitacora_guard_org.sql`:

```sql
-- FIX BL-02 (auditoría BL/BD): registrar_bitacora aceptaba p_organization_id y
-- p_usuario_id arbitrarios desde cualquier usuario autenticado (SECURITY DEFINER
-- con GRANT a authenticated), permitiendo inyectar entradas en la bitácora de
-- otra organización y suplantar usuarios. Se añade guard de org/identidad para
-- llamadas directas con JWT de usuario y se re-lanza el 42501 (el WHEN OTHERS
-- original lo degradaba a WARNING).
CREATE OR REPLACE FUNCTION public.registrar_bitacora(
  p_modulo text,
  p_accion text,
  p_entidad_id uuid DEFAULT NULL,
  p_entidad_nombre text DEFAULT '',
  p_detalles jsonb DEFAULT '{}'::jsonb,
  p_organization_id uuid DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := COALESCE(p_usuario_id, auth.uid());
  v_org uuid := p_organization_id;
  v_email text;
BEGIN
  -- FIX BL-02: llamadas directas desde PostgREST con JWT de usuario solo pueden
  -- escribir en su propia organización y bajo su propia identidad. Quedan fuera
  -- del guard: service_role y las llamadas internas desde funciones SECURITY
  -- DEFINER / triggers (auth.role() <> 'authenticated').
  IF auth.role() = 'authenticated' THEN
    v_uid := auth.uid();  -- nunca confiar en p_usuario_id
    IF v_org IS NOT NULL
       AND v_org IS DISTINCT FROM public.current_user_org_id()
       AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'LC_ORG_AJENA: no puedes registrar bitácora de otra organización'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_org IS NULL AND v_uid IS NOT NULL THEN
    SELECT organization_id INTO v_org
      FROM public.organization_members WHERE user_id = v_uid LIMIT 1;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.bitacora_actividad(
    organization_id, usuario_id, usuario_email, accion, modulo,
    entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_org, v_uid, COALESCE(v_email, ''), p_accion, p_modulo,
    p_entidad_id, COALESCE(p_entidad_nombre, ''), COALESCE(p_detalles, '{}'::jsonb)
  );
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;  -- FIX BL-02: el guard no se degrada a warning
  WHEN OTHERS THEN
    RAISE WARNING 'registrar_bitacora falló (%): %', p_accion, SQLERRM;
END;
$fn$;

REVOKE ALL ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) TO authenticated, service_role;
```

- **Tras aplicar, verificar:**
  1. Con el JWT de un usuario normal, llamar vía PostgREST: `POST /rpc/registrar_bitacora` con `p_organization_id` de OTRA org → debe responder 403/`42501` con `LC_ORG_AJENA` (y NO quedar registro en `bitacora_actividad`).
  2. Misma llamada con `p_usuario_id` de otro usuario pero org propia → la entrada resultante debe tener `usuario_id = auth.uid()` (el parámetro se ignora).
  3. Flujo funcional: cerrar un embarque (usa `cerrar_embarque` → llama internamente a `registrar_bitacora`) y confirmar que la entrada de bitácora se genera.
  4. Registrar cualquier acción desde la UI (crear lead, etc.) y verificar que la bitácora sigue escribiendo (camino RLS directo, no afectado).

---

### [BL-03] `siguiente_folio_proveedor(p_org_id)` ejecutable por cualquier autenticado sobre cualquier org
- **Severidad:** P2 · **Verificación:** estático (definición vigente leída en repo)
- **Archivos:**
  - Definición vigente: `supabase/migrations/20260622194026_a056e7b7-a434-48d3-9b2a-b9b1cbe60840.sql:55-75` (única definición)
  - Nueva migración a crear: `supabase/migrations/20260820120100_fix_bl03_siguiente_folio_proveedor_guard_org.sql`
- **Problema:** función `SECURITY DEFINER` que incrementa `folio_secuencias` del `p_org_id` recibido, con `GRANT EXECUTE ... TO authenticated` y sin verificación de membresía. Cualquier autenticado puede quemar la secuencia FP- de otra organización (huecos en numeración CxP). Es llamada internamente por el trigger `trg_set_folio_interno_proveedor_factura` (`:78-96`) y por la RPC de garantías (`20260719044443_...sql:87`), ambas en contexto definer de una operación ya autorizada.
- **Fix (instrucción para Lovable):**
  1. Crear la migración de abajo: añade el guard de membresía siguiendo el patrón ya probado del repo (`reactivar_cotizacion_rpc`, `20260810061406_...sql:129-131`): `IF auth.uid() IS NOT NULL AND NOT public.is_org_member(p_org_id) THEN RAISE EXCEPTION 'LC_ORG_AJENA'`. `is_org_member` (`20260722064417_...sql:633-641`) ya incluye bypass de `super_admin`.
  2. Se conserva el `GRANT EXECUTE TO authenticated` (retrocompatible): los caminos legítimos (trigger al insertar `proveedor_facturas`, garantías) corren con el `auth.uid()` de un miembro de la org, que pasa el guard.
  3. No hay cambio TS (nadie en `src/` llama esta RPC directamente; solo aparece en `types.ts` generado y en un test de SQL).
- **Diff / código:** contenido COMPLETO de `supabase/migrations/20260820120100_fix_bl03_siguiente_folio_proveedor_guard_org.sql`:

```sql
-- FIX BL-03 (auditoría BL/BD): siguiente_folio_proveedor(p_org_id) era ejecutable
-- por cualquier usuario autenticado sobre cualquier organization_id (SECURITY
-- DEFINER + GRANT a authenticated sin verificación de membresía), permitiendo
-- quemar la secuencia FP- de otra organización. Se añade guard de membresía con
-- el patrón del repo (reactivar_cotizacion_rpc): auth.uid() NULL (service_role /
-- llamadas internas definer) queda fuera del guard.
CREATE OR REPLACE FUNCTION public.siguiente_folio_proveedor(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num bigint;
BEGIN
  -- FIX BL-03: solo miembros de la organización (o super_admin, incluido en
  -- is_org_member) pueden consumir la secuencia de folios FP-.
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
  VALUES (p_org_id, 'factura_proveedor', 1)
  ON CONFLICT (organization_id, tipo)
  DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_num;

  RETURN 'FP-' || lpad(v_num::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.siguiente_folio_proveedor(uuid) TO authenticated, service_role;
```

- **Tras aplicar, verificar:**
  1. Con JWT de usuario de la org A, llamar `POST /rpc/siguiente_folio_proveedor` con `p_org_id` de la org B → 403/`42501` `LC_ORG_AJENA` y `folio_secuencias` de B sin cambios.
  2. Registrar una factura de proveedor nueva desde la UI (org propia) → se asigna `folio_interno` FP- correlativo vía trigger.
  3. Flujo de garantías (si aplica) sigue generando folio.

---

### [BL-04] Traspasos entre monedas distintas: conversión 1:1 silenciosa
- **Severidad:** P2 · **Verificación:** estático (código muerto comprobado: `v_tc` nunca es ≤ 0 en la rama cross-moneda) + dinámico sugerido
- **Archivos:**
  - Definición vigente: `supabase/migrations/20260811191511_c07e2673-add9-4bf3-971a-e94b1be00965.sql:100-211`
  - Nueva migración a crear: `supabase/migrations/20260820120200_fix_bl04_traspaso_tc_explicito.sql`
  - TS: `src/features/tesoreria/hooks/useTraspasoForm.ts`, `src/features/tesoreria/services/traspasos.ts`, `src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx`
- **Problema:** la RPC hace `v_tc numeric := COALESCE(NULLIF(p_tipo_cambio, 0), 1)` — si el TC llega NULL/0 se asume **1:1 sin avisar** y el `IF v_tc <= 0 THEN RAISE 'LC_TRASPASO_TC_REQUERIDO'` posterior es código muerto. En la UI, `useTraspasoForm.ts:30` inicializa `tipoCambio: 1` (pasa la validación `:69-71` que solo exige `> 0`) y el servicio envía `input.tipoCambio ?? 1` (`traspasos.ts:33`). Un traspaso USD→MXN sin TC postea 1:1 en ambas cuentas y deja las piernas **Conciliadas** al instante (con 100k USD ≈ 1.7M MXN de error silencioso), contradiciendo el canon del ERP (`src/lib/financial/convertir.ts:8-11`: *"Sin TC confiable NO se suma… Nunca se simula 1:1"*).
- **Fix (instrucción para Lovable):**
  1. Crear la migración de abajo: (a) el default del parámetro cambia de `1` a `NULL` (`p_tipo_cambio numeric DEFAULT NULL`); (b) en la rama cross-moneda se valida el **parámetro crudo**: `IF p_tipo_cambio IS NULL OR p_tipo_cambio <= 0 THEN RAISE EXCEPTION 'LC_TRASPASO_TC_REQUERIDO' ...`; (c) la rama misma moneda sigue forzando `v_tc := 1`, por lo que los traspasos MXN→MXN no se afectan aunque no se mande TC.
  2. Aplicar los diffs TS: inicializar `tipoCambio: 0` (vacío), preview sin `|| 1`, y el servicio omite `p_tipo_cambio` cuando no hay valor válido (la RPC aplica su `DEFAULT NULL` y exige captura si las monedas difieren). La validación del form (`tipoCambio <= 0` → error) ya existe y bloquea el submit.
  3. **Compatibilidad:** solo se vuelve error un caso que hoy postea datos incorrectos (cross-moneda sin TC). Es el comportamiento deseado. No requiere backfill (los traspasos históricos 1:1 erróneos, si existen, se corrigen cancelando y re-registrando; detección: `SELECT * FROM traspasos_bancarios WHERE moneda_origen <> moneda_destino AND tipo_cambio = 1 AND deleted_at IS NULL`).
  4. (Opcional, pendiente fuera del freeze) precargar el TC DOF del día en el form como hace el diálogo de anticipos — NO incluido en este fix para mantenerlo mínimo.
- **Diff / código (migración):** contenido COMPLETO de `supabase/migrations/20260820120200_fix_bl04_traspaso_tc_explicito.sql`:

```sql
-- FIX BL-04 (auditoría BL/BD): registrar_traspaso_bancario asumía tipo de cambio
-- 1:1 silencioso cuando p_tipo_cambio llegaba NULL/0 en traspasos entre monedas
-- distintas (COALESCE(NULLIF(p_tipo_cambio,0),1); el RAISE 'LC_TRASPASO_TC_REQUERIDO'
-- posterior era código muerto). Ahora la rama cross-moneda valida el parámetro
-- crudo y RECHAZA la operación sin TC explícito, alineado con el canon FX del ERP
-- (src/lib/financial/convertir.ts: "Nunca se simula 1:1"). La rama misma moneda
-- sigue forzando v_tc := 1, por lo que los traspasos MXN→MXN no cambian.
CREATE OR REPLACE FUNCTION public.registrar_traspaso_bancario(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_fecha date,
  p_monto_origen numeric,
  p_tipo_cambio numeric DEFAULT NULL,   -- FIX BL-04: sin default 1 silencioso
  p_comision numeric DEFAULT 0,
  p_concepto text DEFAULT '',
  p_referencia text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org uuid := current_user_org_id();
  v_uid uuid := auth.uid();
  v_origen public.cuentas_bancarias%ROWTYPE;
  v_destino public.cuentas_bancarias%ROWTYPE;
  v_tc numeric;                          -- FIX BL-04: se asigna solo por rama
  v_comision numeric := COALESCE(p_comision, 0);
  v_monto_destino numeric;
  v_folio text;
  v_id uuid;
  v_concepto text := COALESCE(NULLIF(TRIM(p_concepto), ''), 'Traspaso entre cuentas propias');
BEGIN
  IF p_cuenta_origen_id = p_cuenta_destino_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_MISMA_CUENTA: la cuenta origen y destino deben ser distintas';
  END IF;
  IF COALESCE(p_monto_origen, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_MONTO_INVALIDO: el monto debe ser mayor a cero';
  END IF;
  IF v_comision < 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_COMISION_INVALIDA: la comisión no puede ser negativa';
  END IF;

  SELECT * INTO v_origen FROM public.cuentas_bancarias WHERE id = p_cuenta_origen_id;
  SELECT * INTO v_destino FROM public.cuentas_bancarias WHERE id = p_cuenta_destino_id;
  IF v_origen.id IS NULL OR v_destino.id IS NULL THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INEXISTENTE: no se encontró alguna de las cuentas';
  END IF;
  IF v_origen.organization_id <> v_destino.organization_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_ORG_DISTINTA: las cuentas pertenecen a organizaciones diferentes';
  END IF;
  IF NOT v_origen.activa OR NOT v_destino.activa THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INACTIVA: ambas cuentas deben estar activas';
  END IF;

  IF v_origen.moneda = v_destino.moneda THEN
    v_tc := 1;
    v_monto_destino := ROUND(p_monto_origen, 2);
  ELSE
    -- FIX BL-04: exigir TC explícito; nunca asumir 1:1 entre monedas distintas.
    IF p_tipo_cambio IS NULL OR p_tipo_cambio <= 0 THEN
      RAISE EXCEPTION 'LC_TRASPASO_TC_REQUERIDO: captura el tipo de cambio para un traspaso entre monedas distintas';
    END IF;
    v_tc := p_tipo_cambio;
    v_monto_destino := ROUND(p_monto_origen * v_tc, 2);
  END IF;

  SELECT 'TR-' || LPAD((COALESCE(MAX(NULLIF(regexp_replace(folio, '\D', '', 'g'), ''))::bigint, 0) + 1)::text, 6, '0')
    INTO v_folio
    FROM public.traspasos_bancarios
   WHERE organization_id = COALESCE(v_org, v_origen.organization_id);

  INSERT INTO public.traspasos_bancarios(
    organization_id, folio, cuenta_origen_id, cuenta_destino_id, fecha,
    monto_origen, moneda_origen, monto_destino, moneda_destino,
    tipo_cambio, comision, concepto, referencia, created_by
  ) VALUES (
    COALESCE(v_org, v_origen.organization_id), v_folio, p_cuenta_origen_id, p_cuenta_destino_id, p_fecha,
    ROUND(p_monto_origen, 2), v_origen.moneda, v_monto_destino, v_destino.moneda,
    v_tc, ROUND(v_comision, 2), v_concepto, COALESCE(p_referencia, ''), v_uid
  ) RETURNING id INTO v_id;

  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
    v_concepto || ' → ' || v_destino.banco || ' ' || v_destino.alias, COALESCE(p_referencia, ''),
    ROUND(p_monto_origen, 2), 0, 'traspaso-' || v_id::text || '-origen',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );

  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_destino.organization_id), p_cuenta_destino_id, p_fecha,
    v_concepto || ' ← ' || v_origen.banco || ' ' || v_origen.alias, COALESCE(p_referencia, ''),
    0, v_monto_destino, 'traspaso-' || v_id::text || '-destino',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );

  IF ROUND(v_comision, 2) > 0 THEN
    INSERT INTO public.bbva_movimientos(
      organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
      cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
      importado_por, traspaso_id
    ) VALUES (
      COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
      'Comisión bancaria por traspaso ' || v_folio, COALESCE(p_referencia, ''),
      ROUND(v_comision, 2), 0, 'traspaso-' || v_id::text || '-comision',
      'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
    );
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text) TO authenticated, service_role;
```

> **Nota:** el `SELECT 'TR-' || LPAD(... MAX(...) ...)` de arriba se reemplaza por secuencia atómica en la migración de **BL-09** (aplicar después de esta; la versión de BL-09 ya incluye este fix de TC).

- **Diff / código (TS):**

```diff
--- a/src/features/tesoreria/hooks/useTraspasoForm.ts
+++ b/src/features/tesoreria/hooks/useTraspasoForm.ts
@@
   const [state, setState] = useState<TraspasoFormState>({
     origenId: "",
     destinoId: "",
     fecha: hoyIso(),
     montoOrigen: 0,
-    tipoCambio: 1,
+    tipoCambio: 0, // FIX BL-04: vacío — nunca prellenar 1 en cross-moneda
     comision: 0,
     concepto: "",
     referencia: "",
   });
@@
     setState({
       origenId: "",
       destinoId: "",
       fecha: hoyIso(),
       montoOrigen: 0,
-      tipoCambio: 1,
+      tipoCambio: 0, // FIX BL-04
       comision: 0,
       concepto: "",
       referencia: "",
     });
@@
   const montoDestino = useMemo(() => {
     if (!state.montoOrigen || state.montoOrigen <= 0) return 0;
     if (mismoMoneda) return state.montoOrigen;
-    return state.montoOrigen * (state.tipoCambio || 1);
+    // FIX BL-04: sin fallback a 1 — si no hay TC capturado el preview es 0
+    // y la validación de abajo bloquea el submit.
+    return state.montoOrigen * state.tipoCambio;
   }, [state.montoOrigen, mismoMoneda, state.tipoCambio]);
```

```diff
--- a/src/features/tesoreria/services/traspasos.ts
+++ b/src/features/tesoreria/services/traspasos.ts
@@
   const { data, error } = await supabase.rpc("registrar_traspaso_bancario", {
     p_cuenta_origen_id: input.cuentaOrigenId,
     p_cuenta_destino_id: input.cuentaDestinoId,
     p_fecha: input.fecha,
     p_monto_origen: input.montoOrigen,
-    p_tipo_cambio: input.tipoCambio ?? 1,
+    // FIX BL-04: omitir el parámetro si no hay TC válido (la RPC usa su
+    // DEFAULT NULL y rechaza cross-moneda sin TC con LC_TRASPASO_TC_REQUERIDO).
+    ...(input.tipoCambio && input.tipoCambio > 0 ? { p_tipo_cambio: input.tipoCambio } : {}),
     p_comision: input.comision ?? 0,
     p_concepto: input.concepto ?? "",
     p_referencia: input.referencia ?? "",
   });
```

```diff
--- a/src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx
+++ b/src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx
@@
-        tipoCambio: mismoMoneda ? 1 : state.tipoCambio,
+        // FIX BL-04: misma moneda no envía TC (la RPC fuerza 1); cross-moneda
+        // envía el capturado (la validación del form ya exigió > 0).
+        tipoCambio: mismoMoneda ? undefined : state.tipoCambio,
```

> Detalle UX (opcional pero recomendado): con `tipoCambio: 0` el `MoneyInput` del diálogo puede mostrar `0`; si se ve feo, cambiar el `value` del campo a `state.tipoCambio || ""`... solo si `MoneyInput` admite vacío. No es funcional: la validación ya bloquea el submit.

- **Tras aplicar, verificar:**
  1. Abrir el diálogo de traspaso con una cuenta MXN y una USD: el campo TC aparece vacío/0, el preview de destino es $0.00 y el botón queda bloqueado con "Captura el tipo de cambio para cuentas de distinta moneda.".
  2. Intentar el RPC directo sin TC: `POST /rpc/registrar_traspaso_bancario` con cuentas de monedas distintas y sin `p_tipo_cambio` → error `LC_TRASPASO_TC_REQUERIDO`.
  3. Traspaso MXN→MXN sin capturar TC → se registra con `tipo_cambio = 1` (sin cambios funcionales).
  4. Traspaso USD→MXN con TC capturado (p. ej. 18.50) → pierna destino = monto × 18.50 y ambas piernas Conciliadas.
  5. `bun run test` — sin regresiones en tests de tesorería.

---

### [BL-05] El trigger de comisiones puede bloquear el registro de pagos de clientes
- **Severidad:** P2 · **Verificación:** estático (cadena de excepción trazada en repo) + dinámico sugerido
- **Archivos:**
  - Definición vigente de `calcular_comision_pago`: `supabase/migrations/20260801005827_a7c4df89-174b-4f0e-945c-99e909c18963.sql:23-140` (la migración posterior `20260801011206` solo re-aplica REVOKE/GRANT, no redefine el cuerpo)
  - Trigger: `trg_pago_factura_comision_ins` AFTER INSERT OR UPDATE ON `pagos_factura` (`20260602193937_...sql:215-226`)
  - Origen del raise: `convertir_a_mxn` (`20260722132715_...sql:248+`) lanza `LC_TC_REQUERIDO` si el TC es NULL/0
  - Nueva migración a crear: `supabase/migrations/20260820120400_fix_bl05_comision_no_bloquea_pago.sql`
- **Problema:** al insertar/actualizar un pago, el trigger llama a `calcular_comision_pago`, que convierte conceptos USD/EUR del embarque con `convertir_a_mxn`. Si el embarque tiene `tipo_cambio_usd/eur` NULL (posible desde FIX-BL-11 de `20260722001929`, que quitó los defaults 17.5/19.0; `embarqueToDb.ts:114` manda `tcOrNull`), la excepción aborta el trigger y hace **rollback del INSERT del pago**: la cobranza queda bloqueada por un cálculo auxiliar de comisión. Además la nota `'Tipos de cambio del embarque incompletos'` (línea 119) es inalcanzable en ese escenario porque la excepción vuela antes de asignarla.
- **Fix (instrucción para Lovable):**
  1. Crear la migración de abajo: re-crea `calcular_comision_pago` envolviendo (a) el cálculo de `v_cobrado_mxn` y (b) el bloque de ingresos/costos/comisión en `BEGIN ... EXCEPTION WHEN OTHERS THEN`. Ante cualquier error de conversión, la comisión se registra con `comision_mxn = 0` y nota explicativa; **el pago nunca se bloquea**. La nota `'Tipos de cambio del embarque incompletos...'` pasa a ser alcanzable.
  2. No se toca el trigger ni `convertir_a_mxn` (su comportamiento estricto es el canon para proformas/totales y debe conservarse).
  3. (Recomendado, fuera del freeze) añadir test SQL en `supabase/tests/` cubriendo: pago sobre embarque con vendedora y conceptos USD sin `tipo_cambio_usd` → el INSERT del pago tiene éxito y `comisiones_devengadas.comision_mxn = 0` con la nota.
- **Diff / código:** contenido COMPLETO de `supabase/migrations/20260820120400_fix_bl05_comision_no_bloquea_pago.sql`:

```sql
-- FIX BL-05 (auditoría BL/BD): calcular_comision_pago corría dentro del trigger
-- trg_pago_factura_comision_ins (AFTER INSERT OR UPDATE ON pagos_factura) y
-- podía lanzar LC_TC_REQUERIDO vía convertir_a_mxn cuando el embarque no tenía
-- tipo_cambio_usd/eur, haciendo ROLLBACK del registro del pago. Un cálculo
-- auxiliar de comisión NUNCA debe impedir un cobro: se envuelven las
-- conversiones en EXCEPTION WHEN OTHERS y, ante error, la comisión queda en 0
-- con nota explicativa para recalcularla después (la nota 'Tipos de cambio del
-- embarque incompletos' antes era inalcanzable).
CREATE OR REPLACE FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD; v_factura RECORD;
  v_embarque_id uuid; v_vendedora_id uuid;
  v_tc_usd numeric; v_tc_eur numeric;
  v_pct numeric(5,2); v_ingresos_mxn numeric(14,2); v_costos_mxn numeric(14,2);
  v_utilidad numeric(14,2); v_cobrado_mxn numeric(14,2);
  v_proporcion numeric(14,8); v_comision_mxn numeric(14,2); v_nota text;
  v_tc_pago numeric;
BEGIN
  SELECT * INTO v_pago FROM pagos_factura WHERE id = p_pago_factura_id;
  IF NOT FOUND OR v_pago.deleted_at IS NOT NULL THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT * INTO v_factura FROM facturas WHERE id = v_pago.factura_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_embarque_id := v_factura.embarque_id;

  -- Exclusión explícita de comisión (cliente cuenta directa u override del embarque).
  IF v_embarque_id IS NOT NULL AND public.resolver_sin_comision(v_embarque_id) THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0,
           nota = 'Embarque excluido de comisión', updated_at = now()
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT vendedora_id, COALESCE(tipo_cambio_usd, 0), COALESCE(tipo_cambio_eur, 0)
    INTO v_vendedora_id, v_tc_usd, v_tc_eur
    FROM embarques WHERE id = v_embarque_id;

  -- FIX BL-05: esta conversión puede lanzar LC_TC_REQUERIDO si el embarque no
  -- tiene TC; se degrada a 0 en vez de abortar el pago.
  BEGIN
    v_tc_pago := COALESCE(NULLIF(v_pago.tipo_cambio, 0), NULL);
    IF v_pago.moneda::text = 'MXN' THEN
      v_cobrado_mxn := COALESCE(v_pago.monto_aplicado_factura, v_pago.monto);
    ELSIF v_tc_pago IS NOT NULL AND v_tc_pago > 0 THEN
      v_cobrado_mxn := COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) * v_tc_pago;
    ELSE
      v_cobrado_mxn := public.convertir_a_mxn(
        COALESCE(v_pago.monto_aplicado_factura, v_pago.monto),
        v_pago.moneda::text, NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_cobrado_mxn := 0;
  END;

  IF v_vendedora_id IS NULL THEN
    INSERT INTO comisiones_devengadas (
      organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, nota)
    VALUES (
      v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, NULL,
      v_cobrado_mxn, 0, 0, 0, 'Devengada', 'Sin vendedora asignada al embarque')
    ON CONFLICT (pago_factura_id) DO UPDATE
      SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
          utilidad_prorrateada_mxn = 0, porcentaje_aplicado = 0,
          comision_mxn = 0, nota = EXCLUDED.nota, updated_at = now()
      WHERE comisiones_devengadas.estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT COALESCE(porcentaje_default, 0) INTO v_pct
    FROM vendedora_config
   WHERE organization_id = v_pago.organization_id
     AND user_id = v_vendedora_id AND activa = true;
  v_pct := COALESCE(v_pct, 0);

  -- FIX BL-05: las conversiones de conceptos pueden lanzar LC_TC_REQUERIDO;
  -- ante cualquier error la comisión queda en 0 con nota (nunca se aborta el pago).
  BEGIN
    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cv.total, cv.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_ingresos_mxn
      FROM conceptos_venta cv
     WHERE cv.embarque_id = v_embarque_id AND cv.deleted_at IS NULL;

    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cc.monto, cc.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_costos_mxn
      FROM conceptos_costo cc
     WHERE cc.embarque_id = v_embarque_id AND cc.deleted_at IS NULL;

    v_utilidad := v_ingresos_mxn - v_costos_mxn;
    v_proporcion := CASE WHEN COALESCE(v_factura.total,0) > 0
                         THEN COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) / v_factura.total
                         ELSE 0 END;
    v_comision_mxn := ROUND(v_utilidad * v_proporcion * (v_pct / 100.0), 2);
    v_nota := CASE
      WHEN v_costos_mxn = 0 THEN 'Costos del embarque pendientes'
      WHEN v_tc_usd = 0 OR v_tc_eur = 0 THEN 'Tipos de cambio del embarque incompletos'
      ELSE NULL
    END;
  EXCEPTION WHEN OTHERS THEN
    v_ingresos_mxn := 0;
    v_costos_mxn := 0;
    v_utilidad := 0;
    v_proporcion := CASE WHEN COALESCE(v_factura.total,0) > 0
                         THEN COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) / v_factura.total
                         ELSE 0 END;
    v_comision_mxn := 0;
    v_nota := 'Tipos de cambio del embarque incompletos: comisión en 0, pendiente de recalcular';
  END;

  INSERT INTO comisiones_devengadas (
    organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
    monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
    comision_mxn, estado, nota)
  VALUES (
    v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, v_vendedora_id,
    v_cobrado_mxn, ROUND(v_utilidad * v_proporcion, 2), v_pct, v_comision_mxn,
    'Devengada', v_nota)
  ON CONFLICT (pago_factura_id) DO UPDATE
    SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
        utilidad_prorrateada_mxn = EXCLUDED.utilidad_prorrateada_mxn,
        porcentaje_aplicado = EXCLUDED.porcentaje_aplicado,
        comision_mxn = EXCLUDED.comision_mxn,
        nota = EXCLUDED.nota,
        vendedora_id = EXCLUDED.vendedora_id,
        updated_at = now()
    WHERE comisiones_devengadas.estado <> 'Liquidada';
END;
$function$;

REVOKE ALL ON FUNCTION public.calcular_comision_pago(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO service_role;
```

- **Tras aplicar, verificar:**
  1. Repro del bug: embarque con vendedora asignada, conceptos de venta en USD y `tipo_cambio_usd = NULL`; registrar un pago de la factura ligada → **el pago se registra** (antes hacía rollback) y `comisiones_devengadas` queda con `comision_mxn = 0` y la nota de TC incompletos.
  2. Capturar el TC en el embarque (`actualizarTipoCambioUsdEmbarque`) y registrar otro pago → la comisión se calcula normal.
  3. Pago sobre embarque con TC completos → comportamiento idéntico al actual (comisión calculada).
  4. Cancelar/eliminar el pago (soft-delete) → la comisión pasa a `Cancelada` como antes.

---

### [BL-06] Notas de crédito soft-borradas reaparecen en detalle de factura (CxC y CxP)
- **Severidad:** P2 · **Verificación:** estático
- **Archivos:**
  - `src/features/facturacion/services/notasCredito.ts` (`listarNotasCreditoPorFactura`, `listarNotasCreditoRecientes`)
  - `src/features/cxp/services/proveedorNotasCredito.ts` (`fetchNotasCreditoFactura`)
- **Problema:** la papelera soft-borra NCs (`papelera.ts:40-41`: `proveedor_notas_credito`, `factura_notas_credito`) y la BD las excluye de saldos (`saldo_factura.sql:36-38`, `guard_pago_proveedor.sql:55-60`), pero las tres lecturas de UI no filtran `deleted_at`: la NC enviada a la papelera sigue visible en el detalle de la factura y en la vista consolidada de NCs de Cobranza aunque ya no descuenta saldo → divergencia UI/BD.
- **Fix (instrucción para Lovable):** añadir `.is("deleted_at", null)` en los tres reads (diffs abajo). Sin cambio de BD.
- **Diff / código:**

```diff
--- a/src/features/facturacion/services/notasCredito.ts
+++ b/src/features/facturacion/services/notasCredito.ts
@@
     supabase
       .from("factura_notas_credito")
       .select("*")
       .eq("factura_id", facturaId)
+      .is("deleted_at", null)
       .order("created_at", { ascending: false })
       .limit(200),
@@
   let query = supabase
     .from("factura_notas_credito")
     .select(`
       *,
       facturas!inner(numero, cliente_id, cliente_nombre)
     `)
+    .is("deleted_at", null)
     .order("created_at", { ascending: false })
     .limit(limit);
```

```diff
--- a/src/features/cxp/services/proveedorNotasCredito.ts
+++ b/src/features/cxp/services/proveedorNotasCredito.ts
@@
     supabase
       .from("proveedor_notas_credito")
       .select("*")
       .eq("proveedor_factura_id", facturaId)
+      .is("deleted_at", null)
       .order("fecha", { ascending: false }),
```

- **Tras aplicar, verificar:**
  1. Factura CxC con NC aplicada: enviar la NC a la papelera → desaparece del detalle de la factura y de la vista consolidada de NCs; el saldo ya no la descuenta (consistente UI/BD).
  2. Restaurarla → reaparece y vuelve a descontar saldo.
  3. Ídem para una NC de proveedor (CxP) en el detalle de la factura de proveedor.

---

### [BL-07] `dependenciasFinancieras` cuenta facturas/pagos/NCs borrados lógicamente al evaluar eliminación de embarque
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/embarques/services/dependenciasFinancieras.ts` (`fetchFacturasLigadas` :33-58, `fetchNotasYPagos` :60-86; usado por `DialogEliminarEmbarque.tsx`)
- **Problema:** las 6 consultas de dependencias financieras (facturas CxC/CxP, NCs CxC/CxP, pagos CxC/CxP) no filtran `deleted_at`; curiosamente proformas sí (`:97-103`). Un embarque cuyas facturas ya fueron borradas lógicamente sigue marcado como "con dependencias financieras" y el diálogo bloquea/advierte la eliminación (falso positivo). Nota de líneas: la fuente citaba `:34-43` y `:61-72`; en el repo los rangos exactos son `:34-44` y `:64-74`.
- **Fix (instrucción para Lovable):** añadir `.is('deleted_at', null)` a las 6 consultas (diff abajo). Sin cambio de BD. Verificación adicional implícita: las tablas `pagos_factura` y `pagos_proveedor` tienen `deleted_at` (soft-delete existente en el repo; el guard de saldos ya los filtra).
- **Diff / código:**

```diff
--- a/src/features/embarques/services/dependenciasFinancieras.ts
+++ b/src/features/embarques/services/dependenciasFinancieras.ts
@@
     supabase
       .from('facturas')
       .select('id, numero, estado', { count: 'exact' })
       .eq('embarque_id', embarqueId)
+      .is('deleted_at', null)
       .limit(MAX_FOLIOS),
     supabase
       .from('proveedor_facturas')
       .select('id, folio_proveedor, estado', { count: 'exact' })
       .eq('embarque_id', embarqueId)
+      .is('deleted_at', null)
       .limit(MAX_FOLIOS),
@@
     cxcIds.length
-      ? supabase.from('factura_notas_credito').select('id', { count: 'exact', head: true }).in('factura_id', cxcIds)
+      ? supabase.from('factura_notas_credito').select('id', { count: 'exact', head: true }).in('factura_id', cxcIds).is('deleted_at', null)
       : Promise.resolve(empty),
     cxpIds.length
-      ? supabase.from('proveedor_notas_credito').select('id', { count: 'exact', head: true }).in('factura_id', cxpIds)
+      ? supabase.from('proveedor_notas_credito').select('id', { count: 'exact', head: true }).in('factura_id', cxpIds).is('deleted_at', null)
       : Promise.resolve(empty),
     cxcIds.length
-      ? supabase.from('pagos_factura').select('id', { count: 'exact', head: true }).in('factura_id', cxcIds)
+      ? supabase.from('pagos_factura').select('id', { count: 'exact', head: true }).in('factura_id', cxcIds).is('deleted_at', null)
       : Promise.resolve(empty),
     cxpIds.length
-      ? supabase.from('pagos_proveedor').select('id', { count: 'exact', head: true }).in('factura_id', cxpIds)
+      ? supabase.from('pagos_proveedor').select('id', { count: 'exact', head: true }).in('factura_id', cxpIds).is('deleted_at', null)
       : Promise.resolve(empty),
```

- **Tras aplicar, verificar:**
  1. Embarque con factura CxC: soft-borrar la factura (papelera) → `DialogEliminarEmbarque` ya NO la reporta como dependencia.
  2. Embarque con factura activa → sigue bloqueando/advirtiendo correctamente.
  3. Pago soft-borrado deja de contar; pago activo sigue contando.

---

### [BL-08] 4 funciones SECURITY DEFINER sin `SET search_path` — YA CORREGIDO en el repo (divergencia fuente↔repo)
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:**
  - Definición original citada por la fuente: `supabase/migrations/20260604052500_email_infra.sql:137-176` (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`)
  - **Correcciones YA existentes (no citadas por la fuente):** `supabase/migrations/20260618205406_0b68fcda-....sql:171-175` y `supabase/migrations/20260710021502_d7c7e466-....sql:31-34` — ambas hacen `ALTER FUNCTION ... SET search_path = public, pgmq;` sobre las 4 funciones. Están en `supabase/releases/migration-manifest.json` (aplicadas).
- **Problema (estado real):** la fuente solo revisó la migración de creación y no detectó los `ALTER FUNCTION` posteriores. En la BD actual las 4 funciones YA tienen `search_path` fijo → el hallazgo está **resuelto en el repo**. Persisten como mitigantes el `REVOKE ... FROM PUBLIC/anon/authenticated` + grant solo a `service_role` (`20260811211147_...sql:10-17`).
- **Fix (instrucción para Lovable):** **sin cambio de código estrictamente necesario.** Acción recomendada (opcional, defensa en profundidad contra drift en ambientes donde alguna migración se hubiera omitido): crear la migración idempotente de abajo que re-asevera el `search_path` y los grants. Coste cero y segura de re-aplicar.
- **Diff / código (opcional):** contenido COMPLETO de `supabase/migrations/20260820120600_fix_bl08_email_infra_search_path_reassert.sql`:

```sql
-- FIX BL-08 (auditoría BL/BD) — OPCIONAL / defensa en profundidad.
-- El hallazgo original (funciones de email_infra SECURITY DEFINER sin
-- search_path) YA fue corregido por 20260618205406 y 20260710021502
-- (ALTER FUNCTION ... SET search_path = public, pgmq). Esta migración solo
-- re-asevera el estado de forma idempotente contra drift entre ambientes.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
```

- **Tras aplicar, verificar:**
  1. `SELECT proname, proconfig FROM pg_proc WHERE proname IN ('enqueue_email','read_email_batch','delete_email','move_to_dlq');` → `proconfig` incluye `search_path=public, pgmq` en las 4.
  2. Flujo de emails transaccionales (edge function con `service_role`) sigue encolando/leyendo/borrando.
  3. El lint `function_search_path_mutable` de Supabase no reporta estas 4 funciones.

---

### [BL-09] Folio de traspasos por `MAX()+1` (carrera con backstop de UNIQUE)
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:**
  - Definición vigente: `supabase/migrations/20260811191511_c07e2673-...sql:157-160` (folio) y `:29` (`uq_traspasos_folio_org`)
  - Nueva migración a crear: `supabase/migrations/20260820120300_fix_bl09_traspaso_folio_secuencias.sql`
- **Problema:** `registrar_traspaso_bancario` calcula el folio con `SELECT 'TR-'||LPAD((COALESCE(MAX(...)::bigint,0)+1)...)` sin lock ni secuencia. Dos traspasos concurrentes calculan el mismo folio; salva el UNIQUE `uq_traspasos_folio_org` pero con un error 23505 visible al usuario en vez de folio duplicado.
- **Fix (instrucción para Lovable):**
  1. **Aplicar DESPUÉS de la migración de BL-04** (ambas re-crean la función; esta versión ya incluye el fix de TC de BL-04).
  2. La migración: (a) siembra `folio_secuencias` con el máximo folio TR- existente por org (anti-colisión con históricos); (b) re-crea la función reemplazando el `MAX()+1` por upsert `ON CONFLICT` sobre `folio_secuencias` (patrón ya probado en `generar_expediente`, `20260723202950_...sql:29-37`), con reintento defensivo por si un folio histórico no numérico colisionara.
  3. Sin cambio TS (la firma de la RPC no cambia).
- **Diff / código:** contenido COMPLETO de `supabase/migrations/20260820120300_fix_bl09_traspaso_folio_secuencias.sql`:

```sql
-- FIX BL-09 (auditoría BL/BD): el folio TR- de traspasos_bancarios se calculaba
-- con MAX()+1 sin lock (carrera entre traspasos concurrentes; el UNIQUE
-- uq_traspasos_folio_org evitaba el duplicado pero con 23505 visible al usuario).
-- Se migra a folio_secuencias con upsert ON CONFLICT (patrón probado en
-- generar_expediente, 20260723202950). Incluye el fix BL-04 (TC explícito en
-- cross-moneda) porque re-crea la misma función: APLICAR DESPUÉS de
-- 20260820120200_fix_bl04_traspaso_tc_explicito.sql.

-- 1) Semilla anti-colisión: sincroniza el contador con el máximo TR- existente.
INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
SELECT organization_id, 'traspaso_bancario',
       COALESCE(MAX(NULLIF(regexp_replace(folio, '\D', '', 'g'), ''))::bigint, 0)
  FROM public.traspasos_bancarios
 GROUP BY organization_id
ON CONFLICT (organization_id, tipo)
DO UPDATE SET ultimo_numero = GREATEST(public.folio_secuencias.ultimo_numero, EXCLUDED.ultimo_numero),
              updated_at = now();

-- 2) RPC con folio atómico por secuencia (+ fix BL-04 de TC explícito).
CREATE OR REPLACE FUNCTION public.registrar_traspaso_bancario(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_fecha date,
  p_monto_origen numeric,
  p_tipo_cambio numeric DEFAULT NULL,   -- FIX BL-04: sin default 1 silencioso
  p_comision numeric DEFAULT 0,
  p_concepto text DEFAULT '',
  p_referencia text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org uuid := current_user_org_id();
  v_uid uuid := auth.uid();
  v_origen public.cuentas_bancarias%ROWTYPE;
  v_destino public.cuentas_bancarias%ROWTYPE;
  v_tc numeric;                          -- FIX BL-04: se asigna solo por rama
  v_comision numeric := COALESCE(p_comision, 0);
  v_monto_destino numeric;
  v_folio text;
  v_folio_num bigint;
  v_org_eff uuid;
  v_id uuid;
  v_concepto text := COALESCE(NULLIF(TRIM(p_concepto), ''), 'Traspaso entre cuentas propias');
BEGIN
  IF p_cuenta_origen_id = p_cuenta_destino_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_MISMA_CUENTA: la cuenta origen y destino deben ser distintas';
  END IF;
  IF COALESCE(p_monto_origen, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_MONTO_INVALIDO: el monto debe ser mayor a cero';
  END IF;
  IF v_comision < 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_COMISION_INVALIDA: la comisión no puede ser negativa';
  END IF;

  SELECT * INTO v_origen FROM public.cuentas_bancarias WHERE id = p_cuenta_origen_id;
  SELECT * INTO v_destino FROM public.cuentas_bancarias WHERE id = p_cuenta_destino_id;
  IF v_origen.id IS NULL OR v_destino.id IS NULL THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INEXISTENTE: no se encontró alguna de las cuentas';
  END IF;
  IF v_origen.organization_id <> v_destino.organization_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_ORG_DISTINTA: las cuentas pertenecen a organizaciones diferentes';
  END IF;
  IF NOT v_origen.activa OR NOT v_destino.activa THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INACTIVA: ambas cuentas deben estar activas';
  END IF;

  IF v_origen.moneda = v_destino.moneda THEN
    v_tc := 1;
    v_monto_destino := ROUND(p_monto_origen, 2);
  ELSE
    -- FIX BL-04: exigir TC explícito; nunca asumir 1:1 entre monedas distintas.
    IF p_tipo_cambio IS NULL OR p_tipo_cambio <= 0 THEN
      RAISE EXCEPTION 'LC_TRASPASO_TC_REQUERIDO: captura el tipo de cambio para un traspaso entre monedas distintas';
    END IF;
    v_tc := p_tipo_cambio;
    v_monto_destino := ROUND(p_monto_origen * v_tc, 2);
  END IF;

  -- FIX BL-09: folio atómico vía folio_secuencias (upsert con row lock implícito),
  -- sin carrera de MAX()+1.
  v_org_eff := COALESCE(v_org, v_origen.organization_id);

  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
  VALUES (v_org_eff, 'traspaso_bancario', 1)
  ON CONFLICT (organization_id, tipo)
  DO UPDATE SET ultimo_numero = public.folio_secuencias.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_folio_num;

  v_folio := 'TR-' || LPAD(v_folio_num::text, 6, '0');

  INSERT INTO public.traspasos_bancarios(
    organization_id, folio, cuenta_origen_id, cuenta_destino_id, fecha,
    monto_origen, moneda_origen, monto_destino, moneda_destino,
    tipo_cambio, comision, concepto, referencia, created_by
  ) VALUES (
    v_org_eff, v_folio, p_cuenta_origen_id, p_cuenta_destino_id, p_fecha,
    ROUND(p_monto_origen, 2), v_origen.moneda, v_monto_destino, v_destino.moneda,
    v_tc, ROUND(v_comision, 2), v_concepto, COALESCE(p_referencia, ''), v_uid
  ) RETURNING id INTO v_id;

  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
    v_concepto || ' → ' || v_destino.banco || ' ' || v_destino.alias, COALESCE(p_referencia, ''),
    ROUND(p_monto_origen, 2), 0, 'traspaso-' || v_id::text || '-origen',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );

  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_destino.organization_id), p_cuenta_destino_id, p_fecha,
    v_concepto || ' ← ' || v_origen.banco || ' ' || v_origen.alias, COALESCE(p_referencia, ''),
    0, v_monto_destino, 'traspaso-' || v_id::text || '-destino',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );

  IF ROUND(v_comision, 2) > 0 THEN
    INSERT INTO public.bbva_movimientos(
      organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
      cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
      importado_por, traspaso_id
    ) VALUES (
      COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
      'Comisión bancaria por traspaso ' || v_folio, COALESCE(p_referencia, ''),
      ROUND(v_comision, 2), 0, 'traspaso-' || v_id::text || '-comision',
      'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
    );
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text) TO authenticated, service_role;
```

- **Tras aplicar, verificar:**
  1. Registrar dos traspasos seguidos → folios TR- correlativos sin huecos ni errores.
  2. Concurrencia: dos registros simultáneos (p. ej. dos pestañas) → ambos tienen éxito con folios distintos (antes uno podía fallar con 23505).
  3. `SELECT * FROM folio_secuencias WHERE tipo = 'traspaso_bancario';` → contador por org igual al último folio usado.
  4. Si la org ya tenía traspasos históricos: el primer folio nuevo continúa desde el máximo existente (sin colisión con `uq_traspasos_folio_org`).

---

### [BL-10] `listarCuentas(false)` incluye cuentas eliminadas; invariante `activa=false` implícito
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/tesoreria/services/cuentas.ts:21-25` (`listarCuentas`); caller afectado: `src/features/cxp/components/BitacoraTesoreriaSection.tsx:46` (`useCuentasBancarias(false)`)
- **Problema:** `listarCuentas` filtra `activa` solo si se pide y **nunca** filtra `deleted_at`. El soft-delete (`cuentas.ts:62-65`) fija `activa:false` a la vez, así que el camino común se salva por invariante implícito, pero los callers con `activas=false` (`BitacoraTesoreriaSection.tsx:46`, `useTesoreriaCuentasController.ts:27`) ven reaparecer cuentas eliminadas.
- **Fix (instrucción para Lovable):** filtrar `.is("deleted_at", null)` SIEMPRE en `listarCuentas`; el parámetro `activas` queda como filtro adicional. Sin cambio de BD. (El listado admin/papelera de cuentas, si existiera, no pasa por esta función.)
- **Diff / código:**

```diff
--- a/src/features/tesoreria/services/cuentas.ts
+++ b/src/features/tesoreria/services/cuentas.ts
@@
 export async function listarCuentas(activas = true): Promise<CuentaBancaria[]> {
-  let q = supabase.from("cuentas_bancarias").select(CUENTA_BANCARIA_COLUMNS).order("alias", { ascending: true });
+  // FIX BL-10: las cuentas eliminadas nunca se listan aquí; `activas` es filtro adicional.
+  let q = supabase.from("cuentas_bancarias").select(CUENTA_BANCARIA_COLUMNS).is("deleted_at", null).order("alias", { ascending: true });
   if (activas) q = q.eq("activa", true);
   return unwrapOr(q, [] as CuentaBancaria[]) as Promise<CuentaBancaria[]>;
 }
```

- **Tras aplicar, verificar:**
  1. Eliminar una cuenta bancaria → no aparece en el filtro de cuentas de `BitacoraTesoreriaSection` (antes reaparecía) ni en el controller de tesorería.
  2. Las cuentas inactivas (no eliminadas) SÍ siguen apareciendo con `useCuentasBancarias(false)`.

---

### [BL-11] Asimetría USD/EUR en `gastos_op_facturas` del dashboard ejecutivo
- **Severidad:** P3 (informativo) · **Verificación:** estático
- **Archivos:**
  - Fuente canónica: `supabase/schema/dashboards/dashboard_summary.sql:53-83` (1:1 con la migración vigente `20260818120000_ola6_rg52_dashboard_summary_eur_coalesce.sql`)
  - Nueva migración a crear: `supabase/migrations/20260820120500_fix_bl11_dashboard_summary_eur_dof.sql`
  - Tabla de fallback: `public.tipos_cambio_dof` (`20260729192139_...sql`: `fecha PK`, `eur_mxn`)
- **Problema:** en `dashboard_summary()`, las facturas de gasto en USD se convierten con el TC de la propia factura (`pf.tipo_cambio_usd`), pero las de EUR con el TC del **embarque ligado** (`eb.tipo_cambio_eur` vía LEFT JOIN). Los gastos EUR sin embarque (lo normal en Venta/Administración) caen fuera del KPI `gastosOperativosMXN` y solo se contabilizan en `gastosOperativosSinTC` → KPI ejecutivo subestimado.
- **Fix (instrucción para Lovable):**
  1. Crear la migración de abajo: re-crea `dashboard_summary()` con fallback para EUR sin TC de embarque al TC DOF vigente a `pf.fecha_emision` (`tipos_cambio_dof`, último registro con `fecha <= fecha_emision`), vía `LEFT JOIN LATERAL`. El CTE `gastos_op_sin_tc` se actualiza con el mismo criterio para no seguir contando como "sin TC" las facturas EUR que ya tienen fallback DOF.
  2. **Actualizar también la fuente canónica** `supabase/schema/dashboards/dashboard_summary.sql` con el mismo cuerpo (regla del encabezado del archivo: "Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo") y su comentario de cabecera (referencia a la nueva migración).
  3. Retrocompatible: el KPI solo cambia para facturas EUR sin embarque que hoy se omiten (pasa a incluirlas con TC DOF); USD y EUR con embarque quedan idénticos.
- **Diff / código:** contenido COMPLETO de `supabase/migrations/20260820120500_fix_bl11_dashboard_summary_eur_dof.sql`:

```sql
-- FIX BL-11 (auditoría BL/BD): en dashboard_summary() los gastos operativos en
-- EUR se convertían SOLO con el TC del embarque ligado (eb.tipo_cambio_eur);
-- los gastos EUR sin embarque (lo normal en Venta/Administración) caían fuera
-- del KPI gastosOperativosMXN. Se añade fallback al TC DOF vigente a la fecha
-- de emisión (tipos_cambio_dof), alineando el tratamiento EUR con el de USD.
CREATE OR REPLACE FUNCTION public.dashboard_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoy date := current_date;
  v_inicio_mes date := date_trunc('month', v_hoy)::date;
  v_fin_mes date := (date_trunc('month', v_hoy) + interval '1 month' - interval '1 day')::date;
  v_inicio_sig date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_fin_sig date := (date_trunc('month', v_hoy) + interval '2 months' - interval '1 day')::date;
BEGIN
  RETURN (
    WITH embarques_base AS (
      SELECT e.id, e.estado::text, e.modo, e.tipo, e.etd, e.eta,
        e.tipo_cambio_eur,
        CASE
          WHEN e.estado = 'Borrador' THEN 'Borrador'
          WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado') THEN e.estado::text
          WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación' AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
            CASE
              WHEN v_hoy < e.etd THEN 'Confirmado'
              WHEN v_hoy >= e.etd AND v_hoy < e.eta THEN 'En Tránsito'
              WHEN v_hoy >= e.eta THEN 'Arribo'
              ELSE e.estado::text
            END
          ELSE e.estado::text
        END AS estado_real
      FROM embarques e
      WHERE e.deleted_at IS NULL
        AND (e.organization_id = public.org_scope())
    ),
    profit AS (SELECT * FROM profit_por_embarque()),
    activos AS (SELECT * FROM embarques_base WHERE estado_real NOT IN ('Borrador','EIR','Por liquidar','Cerrado','Cancelado')),
    conteo AS (
      SELECT jsonb_build_object(
        'Confirmado', count(*) FILTER (WHERE estado_real = 'Confirmado'),
        'En Tránsito', count(*) FILTER (WHERE estado_real = 'En Tránsito'),
        'Arribo', count(*) FILTER (WHERE estado_real = 'Arribo'),
        'En Aduana', count(*) FILTER (WHERE estado_real = 'En Aduana'),
        'Entregado', count(*) FILTER (WHERE estado_real = 'Entregado'),
        'EIR', count(*) FILTER (WHERE estado_real = 'EIR'),
        'Por liquidar', count(*) FILTER (WHERE estado_real = 'Por liquidar')
      ) AS val
      FROM embarques_base
    ),
    gastos_op_facturas AS (
      -- FIX BL-11: EUR usa el TC del embarque ligado y, si no hay, el TC DOF
      -- vigente a fecha_emision (LEFT JOIN LATERAL sobre tipos_cambio_dof).
      SELECT COALESCE(SUM(
        CASE
          WHEN pf.moneda = 'MXN' THEN pf.total
          WHEN pf.moneda = 'USD' AND pf.tipo_cambio_usd > 1 THEN pf.total * pf.tipo_cambio_usd
          WHEN pf.moneda = 'EUR' AND COALESCE(eb.tipo_cambio_eur, dof.eur_mxn) > 1
               THEN pf.total * COALESCE(eb.tipo_cambio_eur, dof.eur_mxn)
          ELSE NULL
        END
      ), 0) AS val
      FROM proveedor_facturas pf
      JOIN presupuesto_categorias pc ON pc.id = pf.categoria_presupuesto_id
      LEFT JOIN embarques_base eb ON eb.id = pf.embarque_id
      LEFT JOIN LATERAL (
        SELECT d.eur_mxn
          FROM public.tipos_cambio_dof d
         WHERE d.fecha <= pf.fecha_emision
         ORDER BY d.fecha DESC
         LIMIT 1
      ) dof ON pf.moneda = 'EUR' AND eb.tipo_cambio_eur IS NULL
      WHERE pc.tipo_contable IN ('Venta','Administracion')
        AND pf.deleted_at IS NULL
        AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
        AND (pf.organization_id = public.org_scope())
    ),
    gastos_op_sin_tc AS (
      -- FIX BL-11: mismo fallback DOF — una factura EUR con TC DOF disponible ya
      -- no cuenta como "sin TC".
      SELECT COUNT(*) AS val
      FROM proveedor_facturas pf
      JOIN presupuesto_categorias pc ON pc.id = pf.categoria_presupuesto_id
      LEFT JOIN embarques_base eb ON eb.id = pf.embarque_id
      LEFT JOIN LATERAL (
        SELECT d.eur_mxn
          FROM public.tipos_cambio_dof d
         WHERE d.fecha <= pf.fecha_emision
         ORDER BY d.fecha DESC
         LIMIT 1
      ) dof ON pf.moneda = 'EUR' AND eb.tipo_cambio_eur IS NULL
      WHERE pc.tipo_contable IN ('Venta','Administracion')
        AND pf.deleted_at IS NULL
        AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
        AND (pf.organization_id = public.org_scope())
        AND pf.moneda <> 'MXN'
        AND NOT (pf.moneda = 'USD' AND pf.tipo_cambio_usd > 1)
        AND NOT (pf.moneda = 'EUR' AND COALESCE(eb.tipo_cambio_eur, dof.eur_mxn, 0) > 1)
    ),
    gastos_op_comisiones AS (
      SELECT COALESCE(SUM(total_mxn), 0) AS val
      FROM liquidaciones_comision
      WHERE periodo = to_char(v_inicio_mes, 'YYYY-MM')
        AND (organization_id = public.org_scope())
    ),
    arribos_mes AS (
      SELECT jsonb_build_object(
        'total', count(*),
        'yaLlegaron', count(*) FILTER (WHERE eb.estado_real IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado')),
        'enCamino', count(*) FILTER (WHERE eb.estado_real IN ('Confirmado','En Tránsito')),
        'ventaMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0)), 0),
        'costoMXN', COALESCE(sum(COALESCE(p.costo_mxn, 0)), 0),
        'profitMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0) - COALESCE(p.costo_mxn, 0)), 0),
        'ventaMxnFromUsd', COALESCE(sum(COALESCE(p.venta_mxn_from_usd, 0)), 0),
        'costoMxnFromUsd', COALESCE(sum(COALESCE(p.costo_mxn_from_usd, 0)), 0),
        'ventaMxnFromEur', COALESCE(sum(COALESCE(p.venta_mxn_from_eur, 0)), 0),
        'costoMxnFromEur', COALESCE(sum(COALESCE(p.costo_mxn_from_eur, 0)), 0),
        'ventaMxnNative', COALESCE(sum(COALESCE(p.venta_mxn_native, 0)), 0),
        'costoMxnNative', COALESCE(sum(COALESCE(p.costo_mxn_native, 0)), 0),
        'profitUSD', COALESCE(sum(COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)), 0),
        'gastosOperativosMXN',
          COALESCE((SELECT val FROM gastos_op_facturas), 0)
          + COALESCE((SELECT val FROM gastos_op_comisiones), 0),
        'gastosOperativosSinTC', COALESCE((SELECT val FROM gastos_op_sin_tc), 0)
      ) AS val
      FROM embarques_base eb
      LEFT JOIN profit p ON p.embarque_id = eb.id
      WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
    ),
    resumen_sig AS (
      SELECT jsonb_build_object(
        'total', count(*),
        'ventaUSD', COALESCE(sum(COALESCE(p.venta_usd, 0)), 0),
        'costoUSD', COALESCE(sum(COALESCE(p.costo_usd, 0)), 0),
        'ventaMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0)), 0),
        'costoMXN', COALESCE(sum(COALESCE(p.costo_mxn, 0)), 0),
        'profitMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0) - COALESCE(p.costo_mxn, 0)), 0)
      ) AS val
      FROM activos eb
      LEFT JOIN profit p ON p.embarque_id = eb.id
      WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_sig AND eb.eta <= v_fin_sig
    )
    SELECT jsonb_build_object(
      'totalActivos', (SELECT count(*) FROM activos),
      'conteoPorEstado', COALESCE((SELECT val FROM conteo), '{}'::jsonb),
      'arribosEsteMes', COALESCE((SELECT val FROM arribos_mes), '{}'::jsonb),
      'resumenMesSiguiente', COALESCE((SELECT val FROM resumen_sig), '{}'::jsonb)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO authenticated, service_role;
```

Y actualizar el encabezado + CTEs equivalentes en la fuente canónica:

```diff
--- a/supabase/schema/dashboards/dashboard_summary.sql
+++ b/supabase/schema/dashboards/dashboard_summary.sql
@@
 -- Fuente canónica de public.dashboard_summary() (Ola 6 · O6-SCHEMA).
---1:1 con supabase/migrations/20260818120000_ola6_rg52_dashboard_summary_eur_coalesce.sql.
---Ola 6 · RG5-2: COALESCE(tipo_cambio_eur,0) en gastos_op_sin_tc.
+-- 1:1 con supabase/migrations/20260820120500_fix_bl11_dashboard_summary_eur_dof.sql.
+-- FIX BL-11: fallback EUR → tipos_cambio_dof cuando no hay TC de embarque.
 -- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.
```

(además de copiar los dos CTEs `gastos_op_facturas` / `gastos_op_sin_tc` del bloque SQL de arriba)

- **Tras aplicar, verificar:**
  1. Factura de gasto EUR sin embarque (categoría Venta/Administración) con `tipos_cambio_dof` cargado para su fecha → ahora se suma a `gastosOperativosMXN` con el TC DOF y ya no incrementa `gastosOperativosSinTC`.
  2. Factura EUR ligada a embarque con `tipo_cambio_eur` → sigue usando el TC del embarque (sin cambio).
  3. Factura EUR sin embarque y sin TC DOF disponible → sigue contando en `gastosOperativosSinTC` (comportamiento correcto del canon: sin TC confiable no se suma).
  4. USD: comportamiento idéntico al actual.
  5. `supabase db reset` local (o staging) confirma que la migración aplica limpia después de `20260819120100`.

---

## Validación del fix pack

IDs presentes (11/11): BL-01 ✅ · BL-02 ✅ · BL-03 ✅ · BL-04 ✅ · BL-05 ✅ · BL-06 ✅ · BL-07 ✅ · BL-08 ✅ (ya corregido en repo — fix opcional) · BL-09 ✅ · BL-10 ✅ · BL-11 ✅

### Resumen de artefactos

| Hallazgo | Tipo de fix | Artefactos |
|---|---|---|
| BL-01 | TS | 11 archivos en `src/features/crm/services/` + nuevo guardrail de arquitectura |
| BL-02 | BD | `20260820120000_fix_bl02_registrar_bitacora_guard_org.sql` |
| BL-03 | BD | `20260820120100_fix_bl03_siguiente_folio_proveedor_guard_org.sql` |
| BL-04 | BD + TS | `20260820120200_fix_bl04_traspaso_tc_explicito.sql` + 3 archivos TS de tesorería |
| BL-05 | BD | `20260820120400_fix_bl05_comision_no_bloquea_pago.sql` |
| BL-06 | TS | `notasCredito.ts` (2 reads) + `proveedorNotasCredito.ts` (1 read) |
| BL-07 | TS | `dependenciasFinancieras.ts` (6 queries) |
| BL-08 | **sin cambio necesario** (opcional BD) | `20260820120600_fix_bl08_email_infra_search_path_reassert.sql` (idempotente) |
| BL-09 | BD | `20260820120300_fix_bl09_traspaso_folio_secuencias.sql` (aplicar tras BL-04) |
| BL-10 | TS | `cuentas.ts` (`listarCuentas`) |
| BL-11 | BD | `20260820120500_fix_bl11_dashboard_summary_eur_dof.sql` + sync de `supabase/schema/dashboards/dashboard_summary.sql` |

### Divergencias fuente ↔ repo (anotadas)

1. **BL-08 — ya corregido:** la fuente no detectó que `20260618205406` (:171-175) y `20260710021502` (:31-34) ya fijan `search_path = public, pgmq` vía `ALTER FUNCTION` sobre las 4 funciones (presentes en `migration-manifest.json`). Se marca como resuelto con migración opcional idempotente.
2. **Timestamps:** se usan `2026082012xxxx` (posteriores a la última migración del repo, `20260819120100`) en lugar del `20260813120000` sugerido; un timestamp anterior quedaría antes de `20260818120000_ola6_rg52_dashboard_summary_eur_coalesce.sql` y el fix de BL-11 se perdería en `supabase db reset`.
3. **BL-07 — líneas:** la fuente citaba `:34-43` y `:61-72`; los rangos reales en repo son `:34-44` (facturas) y `:64-74` (NCs/pagos).
4. **BL-01 — líneas menores:** `softDeleteLead` está en `leads/mutations.ts:~34` (fuente: `:39`); el query de leaderboard está en `:36-40` (fuente: `:37-41`). Contenido idéntico al descrito.
5. **BL-02 — matiz añadido:** el `EXCEPTION WHEN OTHERS` de `registrar_bitacora` degradaría el guard a WARNING; el fix añade `WHEN insufficient_privilege THEN RAISE;`. Verificado además que el frontend NO usa la RPC (inserta vía RLS en `src/services/bitacora/registrar.ts:65`), por lo que el guard no requiere cambio TS.
6. **BL-04 — matiz:** la RPC es `SECURITY INVOKER` (la RLS de ambas tablas aplica; la fuente no lo mencionaba, no cambia el fix). El default del parámetro cambia `1 → NULL`: rompe solo el caso cross-moneda sin TC, que es exactamente lo que se quiere rechazar.
7. **BL-05 — vigente:** la definición viva de `calcular_comision_pago` es la de `20260801005827` (la posterior `20260801011206` solo re-aplica REVOKE/GRANT).


# Línea EF — Edge functions (timbrado, FX, webhooks)

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


# Línea FE — Lógica de frontend

# Fix Pack — Auditoría Frontend Elogistix (Lógica de negocio y edge cases)

**Fuente:** `audit_reports/03_frontend_logica.md` (hallazgos FE-01 a FE-12).
**Repo:** main @ 1ef05ce9. Todos los fragmentos de código fueron copiados del repo real y verificados línea por línea.
**Reglas globales:** bajo riesgo, retrocompatible (feature freeze), sin cambios de contratos ni RPCs. Los helpers citados (`roundMoney`, `subtotalLinea`, `sumarSubtotales`, `todayLocalISO`, `todayLocalISOPlus`, `factorEntreMonedas`) ya existen en el repo. Mensajes de usuario en español (es-MX).

---

### [FE-01] Cobro cruzado de moneda sin tipo de cambio → error 23514 crudo (P1)

- **Severidad:** P1 · **Verificación:** dinámico (repro: factura USD → Registrar pago → moneda MXN con `exchange-rates` sin resolver/caída)
- **Archivos:**
  - `src/features/facturacion/components/DialogRegistrarPago.tsx` (líneas 41-51, 86-90, 102-115)
  - `src/features/facturacion/components/DialogRegistrarPagoParts.tsx` (líneas 60-64)
  - `src/features/facturacion/hooks/useRegistrarPagoSubmit.ts` (líneas 58-71)
- **Problema:** `convertirAMonedaFactura` devuelve `0` cuando `factorEntreMonedas` es `null` (rates no cargados o edge `exchange-rates` caída; el hook tiene `retry: 1`). Con `montoAplicado = 0`, `excede = false` y `invalido = montoNum <= 0 || excede` queda **false**: el botón sigue habilitado con `tipoCambio = 0`. El insert choca con `CHECK (tipo_cambio > 0)` / `CHECK (monto_aplicado_factura > 0)` y el usuario ve "new row for relation violates check constraint". No hay captura manual de TC (a diferencia de CxP).
- **Fix (instrucción para Lovable):**
  1. En `DialogRegistrarPago.tsx`, detectar el caso cross-moneda sin TC usando `factorEntreMonedas` directamente (devuelve `null` cuando falta TC confiable; devuelve `1` cuando las monedas son iguales, así que el mismo cálculo cubre ambos casos).
  2. Incluir `tcBloqueado` en `invalido` (deshabilita el botón) **y** validar de nuevo en el handler (`useRegistrarPagoSubmit.submit`), no solo en UI.
  3. Mostrar un `Alert` inline en español mientras dure el bloqueo: "Esperando tipo de cambio…".
  4. Pasar la prop `tcBloqueado` a `NotasPago` en `DialogRegistrarPagoParts.tsx`.
- **Diff / código:**

`src/features/facturacion/components/DialogRegistrarPago.tsx`:

```diff
   const montoNum = Number(values.monto) || 0;
   const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
   const excede = montoAplicado > saldo + 0.01;
-  const invalido = montoNum <= 0 || excede;
+  // FE-01: cross-moneda sin TC confiable → factorEntreMonedas devuelve null.
+  // Bloqueamos el submit (botón + handler) en vez de dejar que el insert
+  // reviente contra CHECK (tipo_cambio > 0) con un 23514 crudo.
+  const tcBloqueado = factorEntreMonedas(values.moneda, factura.moneda, {
+    usd: rates?.usdMxn, eur: rates?.eurMxn,
+  }) === null;
+  const invalido = montoNum <= 0 || excede || tcBloqueado;
   const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;
```

y en el JSX del mismo archivo:

```diff
       <NotasPago
         esPpdTimbrada={esPpdTimbrada}
         monedaPago={values.moneda}
         monedaFactura={factura.moneda}
         montoNum={montoNum}
         montoAplicado={montoAplicado}
         tipoCambio={tipoCambio}
         excede={excede}
         saldo={saldo}
+        tcBloqueado={tcBloqueado}
       />
```

`src/features/facturacion/components/DialogRegistrarPagoParts.tsx`:

```diff
 export function NotasPago({
-  esPpdTimbrada, monedaPago, monedaFactura, montoNum, montoAplicado, tipoCambio, excede, saldo,
+  esPpdTimbrada, monedaPago, monedaFactura, montoNum, montoAplicado, tipoCambio, excede, saldo, tcBloqueado,
 }: {
   esPpdTimbrada: boolean;
   monedaPago: string;
   monedaFactura: string;
   montoNum: number;
   montoAplicado: number;
   tipoCambio: number;
   excede: boolean;
   saldo: number;
+  tcBloqueado?: boolean;
 }) {
   const mostrarConversion = monedaPago !== monedaFactura && montoNum > 0;
   return (
     <>
+      {tcBloqueado && monedaPago !== monedaFactura && (
+        <Alert variant="destructive">
+          <AlertDescription className="text-xs">
+            Esperando tipo de cambio… No se puede registrar un cobro en {monedaPago} para una
+            factura en {monedaFactura} sin un tipo de cambio disponible. Intenta de nuevo en unos
+            segundos; si el problema persiste, contacta a soporte.
+          </AlertDescription>
+        </Alert>
+      )}
       {esPpdTimbrada && (
```

`src/features/facturacion/hooks/useRegistrarPagoSubmit.ts` (validación en handler, defensa en profundidad):

```diff
   const submit = async (args: SubmitArgs) => {
+    // FE-01: guard de dominio (no sólo UI). El CHECK de BD exige tipo_cambio > 0
+    // y monto_aplicado_factura > 0; aquí el mensaje es claro y en español.
+    if (!(args.tipoCambio > 0) || !(args.montoAplicado > 0)) {
+      notifyError(undefined, {
+        title: "No hay tipo de cambio disponible",
+        description:
+          "No se pudo obtener el tipo de cambio para convertir el pago a la moneda de la factura. Espera unos segundos y vuelve a intentar.",
+        method: "ON_ERROR",
+        errorCode: ERROR_CODES.VALIDATION_FAILED,
+      });
+      return;
+    }
     try {
```

Nota: con misma moneda, `tipoCambio = 1` y `montoAplicado = monto > 0`, así que el guard no afecta el flujo normal. La captura manual de TC (como `tcNum`/`bloqueadoPorTc` de CxP) queda como mejora opcional posterior; este fix ya elimina el error crudo y el flujo bloqueado sin explicación.
- **Tras aplicar, verificar:**
  1. Simular `useExchangeRates` sin resolver (throttle de red o edge caída): factura USD → pago en MXN → el botón "Registrar pago" queda deshabilitado y aparece el aviso "Esperando tipo de cambio…".
  2. Forzar el submit programáticamente (o con rates que expiran entre captura y guardado): debe aparecer el toast "No hay tipo de cambio disponible", nunca un 23514 crudo.
  3. Regresión: pago en la misma moneda de la factura y pago cross-moneda con rates cargados siguen funcionando y timbrando REP en PPD.

---

### [FE-02] El diálogo de pago CxC resetea la captura ante cualquier refetch (P2)

- **Severidad:** P2 · **Verificación:** estático (deps del `useEffect`) + dinámico (abrir diálogo, teclear monto, provocar invalidación de `queryKeys.facturas.all`)
- **Archivos:** `src/features/facturacion/components/DialogRegistrarPago.tsx` (líneas 10, 73-82)
- **Problema:** `useEffect(() => { setValues({...}) }, [open, factura, saldo])`. `factura` es un objeto nuevo en cada refetch del query de detalle y `saldo` deriva de `usePagosFactura`/`useNotasCreditoAplicadas`. Cualquier invalidación mientras el diálogo está abierto re-ejecuta el efecto y borra monto/fecha/referencia ya tecleados, reponiendo el monto al saldo total.
- **Fix (instrucción para Lovable):** inicializar el formulario una sola vez por apertura/factura con un `useRef` de guardia (patrón `initializedRef`), conservando `saldo` en las deps para que el monto inicial use el saldo ya cargado pero sin resetear después.
- **Diff / código:**

```diff
-import { useEffect, useMemo, useState } from "react";
+import { useEffect, useMemo, useRef, useState } from "react";
```

```diff
-  useEffect(() => {
-    if (open && factura) {
-      setValues({
-        fecha: today(),
-        monto: saldo > 0 ? saldo.toFixed(2) : "",
-        moneda: factura.moneda,
-        formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
-      });
-    }
-  }, [open, factura, saldo]);
+  // FE-02: inicializar una sola vez por apertura (open + factura.id). Antes las
+  // deps vivas (objeto factura nuevo en cada refetch, saldo derivado de queries)
+  // re-ejecutaban el efecto y borraban lo que el usuario ya había capturado.
+  const initializedForRef = useRef<string | null>(null);
+  useEffect(() => {
+    if (!open || !factura) {
+      initializedForRef.current = null;
+      return;
+    }
+    if (initializedForRef.current === factura.id) return;
+    initializedForRef.current = factura.id;
+    setValues({
+      fecha: today(),
+      monto: saldo > 0 ? saldo.toFixed(2) : "",
+      moneda: factura.moneda,
+      formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
+    });
+  }, [open, factura, saldo]);
```

- **Tras aplicar, verificar:**
  1. Abrir "Registrar pago", editar monto/fecha/referencia; provocar un refetch (p. ej. registrar otra mutación o invalidar `queryKeys.facturas.all` desde DevTools): lo capturado NO se borra.
  2. Cerrar y reabrir el diálogo (o cambiar de factura): el formulario se reinicia con el saldo vigente.
  3. Regresión: el monto inicial por defecto sigue siendo el saldo pendiente al abrir.

---

### [FE-03] Pago CxC sin validación de fecha (futura o anterior a emisión) (P2)

- **Severidad:** P2 · **Verificación:** dinámico (capturar fecha futura en "Registrar pago" → se acepta)
- **Archivos:**
  - `src/features/facturacion/components/DialogRegistrarPago.tsx` (líneas 24-33, 86-90, 102-115)
  - `src/features/facturacion/components/detalle/FacturaDetalleModales.tsx` (líneas 34-45)
  - Patrón a portar: `src/features/cxp/services/pagoProveedorValidaciones.ts:97-104` (`validarFechas`)
- **Problema:** la única validación del diálogo CxC es monto/saldo (`invalido = montoNum <= 0 || excede`). En CxP sí existe `validarFechas` ("La fecha del pago no puede ser futura" / "no puede ser anterior a la fecha de emisión"). La tabla `pagos_factura` no tiene CHECK de fecha, así que la distorsión de aging CxC persiste en BD.
- **Fix (instrucción para Lovable):**
  1. Agregar `fechaEmision` al interface `Factura` del diálogo y pasarlo desde `FacturaDetalleModales` (el padre ya tiene `fecha_emision` en su `Pick`, línea 15).
  2. Añadir una función pura `validarFechaPago(fecha, hoy, fechaEmision)` con los mismos mensajes es-MX de CxP, en el propio archivo del diálogo (módulo chico; no hace falta importar el de CxP, que está acoplado a `ValidarPagoInput`).
  3. Incluir el error en `invalido`, mostrarlo inline y revalidar en `handleGuardar`.
- **Diff / código:**

`src/features/facturacion/components/DialogRegistrarPago.tsx`:

```diff
 interface Factura {
   id: string;
   numero: string;
   total: number;
   moneda: string;
   /** `PPD` requiere REP automático tras cada abono; `PUE` no. */
   metodoPago?: string | null;
   /** UUID fiscal del CFDI emitido. Sin él no se puede timbrar REP. */
   uuidFiscal?: string | null;
+  /** Fecha de emisión (ISO corto). FE-03: cota inferior para la fecha del pago. */
+  fechaEmision?: string | null;
 }
```

```diff
 const today = () => todayLocalISO();
+
+/** FE-03: misma regla y mensajes que `validarFechas` de CxP (pagoProveedorValidaciones). */
+function validarFechaPago(fecha: string, hoy: string, fechaEmision?: string | null): string | null {
+  if (!fecha) return "Captura la fecha del pago";
+  if (fecha > hoy) return "La fecha del pago no puede ser futura";
+  if (fechaEmision && fecha < fechaEmision) {
+    return "La fecha del pago no puede ser anterior a la fecha de emisión de la factura";
+  }
+  return null;
+}
```

```diff
   const montoNum = Number(values.monto) || 0;
   const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
   const excede = montoAplicado > saldo + 0.01;
-  const invalido = montoNum <= 0 || excede;
+  const errorFecha = validarFechaPago(values.fecha, today(), factura.fechaEmision);
+  const invalido = montoNum <= 0 || excede || errorFecha !== null;
```

```diff
-  const handleGuardar = () => submit({
+  const handleGuardar = () => {
+    if (invalido) return; // FE-03: defensa en handler, no sólo botón deshabilitado
+    submit({
       facturaId: factura.id,
       facturaNumero: factura.numero,
       fecha: values.fecha,
       monto: montoNum,
       moneda: values.moneda as "MXN" | "USD" | "EUR",
       tipoCambio,
       montoAplicado,
       formaPago: values.formaPago,
       referencia: values.referencia,
       notas: values.notas,
       cuentaBancariaId: values.cuentaBancariaId || null,
       esPpdTimbrada,
-  });
+    });
+  };
```

y mostrar el mensaje inline junto a `NotasPago` (en el JSX del return, dentro de `FormDialogShell`):

```diff
       <PagoFormFields values={values} onChange={handleChange} cuentas={cuentas} />
+      {errorFecha && (
+        <p className="text-xs text-destructive" role="alert">{errorFecha}</p>
+      )}
       <NotasPago
```

`src/features/facturacion/components/detalle/FacturaDetalleModales.tsx`:

```diff
         factura={{
           id: factura.id,
           numero: factura.numero,
           total: Number(factura.total),
           moneda: factura.moneda,
           metodoPago: factura.metodo_pago ?? null,
           uuidFiscal: factura.uuid_fiscal ?? null,
+          fechaEmision: factura.fecha_emision ?? null,
         }}
```

Nota de interacción con FE-01: si se aplican ambos, `invalido` queda `montoNum <= 0 || excede || tcBloqueado || errorFecha !== null`.
- **Tras aplicar, verificar:**
  1. Capturar fecha de mañana → botón deshabilitado y mensaje "La fecha del pago no puede ser futura".
  2. Capturar fecha anterior a `fecha_emision` de la factura → mensaje "…anterior a la fecha de emisión de la factura".
  3. Pago con fecha de hoy y fecha = emisión → se registra normal.
  4. Facturas legacy con `fecha_emision` nula → sólo aplica la regla de fecha futura (sin falsos bloqueos).

---

### [FE-04] Off-by-one UTC en fechas-calendario (vigencia de cotización, celda "Vence", KPIs) (P2)

- **Severidad:** P2 · **Verificación:** estático (patrón `toISOString().split("T")[0]` / `new Date(dateOnly)` documentado como bug en `src/lib/date/today.ts:5-8`) + dinámico (crear cotización entre 18:00 y 23:59 hora MX)
- **Archivos (4 ubicaciones):**
  1. `src/features/cotizacion/domain/cotizacion.conversion.ts:63-71` (`calcularFechaVigencia`)
  2. `src/features/cotizacion/domain/mappers/cotizacion.ts:14-19` (`toIsoDateString`)
  3. `src/features/cotizacion/components/columnsParts/estadoVigenciaCell.tsx:15-16` (`buildVigenciaNode`)
  4. `src/features/dashboard/direccion/services/calculosCartera.ts:86-87` (`calcularPulso`)
- **Problema:** `fecha.toISOString().split("T")[0]` devuelve el día en UTC: entre 18:00 y 23:59 (UTC−6) la vigencia sale un día adelantada (documento que va al cliente). En la celda, `new Date("2026-08-01")` es medianoche UTC (= 18:00 del día anterior en MX), así que "Vence mañana" se muestra como "Vence hoy"/"Vencida" medio día al día. En el dashboard, los KPIs "arribos 7d"/"demoras" cambian de día a las 18:00.
- **Fix (instrucción para Lovable):** reemplazar el patrón UTC por `format(d, "yyyy-MM-dd")` de `date-fns` (hora local, mismo helper que usa `todayLocalISO`) en las ubicaciones 1, 2 y 4; en la 3, parsear el date-only como medianoche **local** con `+"T00:00:00"`. Los helpers ya existen (`src/lib/date/today.ts`).
- **Diff / código:**

1) `src/features/cotizacion/domain/cotizacion.conversion.ts`:

```diff
+import { format } from "date-fns";
+
 /**
  * Calcula la fecha de vigencia (`fecha_vigencia`) sumando `vigenciaDias` a la fecha base.
  * Devuelve string ISO `YYYY-MM-DD` (formato esperado por la columna `date` de Postgres).
  * Si `vigenciaDias` es null/undefined se usa el default de 15 días.
  */
 export function calcularFechaVigencia(
   desde: Date = new Date(),
   vigenciaDias: number | null | undefined = 15,
 ): string {
   const dias = vigenciaDias ?? 15;
   const fecha = new Date(desde);
   fecha.setDate(fecha.getDate() + dias);
-  return fecha.toISOString().split("T")[0];
+  // FE-04: día en hora LOCAL (canon `todayLocalISO`); toISOString() devuelve el
+  // día UTC y entre 18:00-23:59 (UTC−6) adelantaba la vigencia un día.
+  return format(fecha, "yyyy-MM-dd");
 }
```

2) `src/features/cotizacion/domain/mappers/cotizacion.ts`:

```diff
+import { format } from "date-fns";
 import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from '@/features/cotizacion/types';
 import type { CotizacionFormValues } from '@/features/cotizacion/types';
```

```diff
 function toIsoDateString(v: unknown): string | null {
   if (!v) return null;
   const d = v instanceof Date ? v : new Date(v as string);
   if (Number.isNaN(d.getTime())) return null;
-  return d.toISOString().split("T")[0];
+  return format(d, "yyyy-MM-dd"); // FE-04: día local, no UTC
 }
```

3) `src/features/cotizacion/components/columnsParts/estadoVigenciaCell.tsx`:

```diff
 function buildVigenciaNode(fechaVigencia: string, estado: string): ReactNode {
   const fechaStr = formatDate(fechaVigencia);
   const esEnviada = estado.toLowerCase() === "enviada";
-  const fecha = new Date(fechaVigencia);
+  // FE-04: date-only ("YYYY-MM-DD") se parsea como medianoche UTC; con
+  // "T00:00:00" es medianoche LOCAL y el badge deja de adelantarse medio día.
+  const fecha = new Date(`${fechaVigencia}T00:00:00`);
   const diffDias = Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
```

4) `src/features/dashboard/direccion/services/calculosCartera.ts`:

```diff
+import { format } from "date-fns";
```

```diff
       const etaDia = r.eta.slice(0, 10);
-      const hoyDia = hoy.toISOString().slice(0, 10);
-      const en7dDia = en7d.toISOString().slice(0, 10);
+      // FE-04: día local MX; toISOString() cambiaba los KPIs de día a las 18:00.
+      const hoyDia = format(hoy, "yyyy-MM-dd");
+      const en7dDia = format(en7d, "yyyy-MM-dd");
```

(`r.eta.slice(0, 10)` se conserva: es un string de BD ya en fecha-calendario, no un instante.)
- **Tras aplicar, verificar:**
  1. Con el reloj del sistema entre 18:00 y 23:59 (o mockeando `new Date()` a esa franja): crear cotización → `fecha_vigencia` = hoy local + 15 días (no +16 ni un día adelantado).
  2. Actualizar/crear tests en `src/features/cotizacion/domain/__tests__/cotizacion.test.ts` y `cotizacion.extra.test.ts`: hoy usan fechas `...T00:00:00Z`; añadir un caso con `new Date(2026, 7, 10, 23, 30)` (hora local) que verifique el día local.
  3. Tabla de cotizaciones a las 19:00 con una cotización que vence mañana → badge "Vence en 1d", no "Vence hoy".
  4. Dashboard de Dirección: KPI "arribos 7d" idéntico antes y después de las 18:00 (mismo día local).

---

### [FE-05] Listado de cotizaciones sin paginación ni `limit` (cap silencioso de 1000) (P2)

- **Severidad:** P2 · **Verificación:** estático (query sin `.limit`/`.range`; el propio repo reconoce el patrón en `embarques/services/queries/proveedores.ts:9`)
- **Archivos:** `src/features/cotizacion/services/queries.ts:42-48` (`fetchCotizaciones`); relacionada: `fetchCotizacionesAceptadas` (líneas 73-82)
- **Problema:** `fetchCotizaciones` ordena pero no limita ni pagina. PostgREST capa en ~1000 filas sin aviso: al superar ese volumen por org, las cotizaciones más antiguas desaparecen del listado (búsquedas, duplicados, conversiones a embarque afectadas). Embarques y Facturación sí pagan server-side.
- **Fix (instrucción para Lovable):** corto plazo (este fix): `.limit(1000)` explícito y documentado, igual que el "`.limit(500)` defensivo" ya existente en proveedores. Aplicar lo mismo a `fetchCotizacionesAceptadas` (mismo riesgo). La paginación server-side con RPC `p_offset/p_limit` (patrón `embarques/services/paginados.ts`) queda como trabajo a mediano plazo fuera del freeze.
- **Diff / código:**

```diff
 export async function fetchCotizaciones(organizationId: string | null) {
   let query = supabase
     .from("cotizaciones")
     .select(COTIZACION_LIST_COLUMNS)
-    .order("created_at", { ascending: false });
+    .order("created_at", { ascending: false })
+    // FE-05: límite explícito defensivo (evita el cap silencioso de 1000 de
+    // PostgREST pasando desapercibido). TODO post-freeze: paginación
+    // server-side como `embarques/services/paginados.ts`.
+    .limit(1000);
   if (organizationId) query = query.eq("organization_id", organizationId);
```

```diff
 export async function fetchCotizacionesAceptadas(organizationId: string | null) {
   let query = supabase
     .from("cotizaciones")
     .select(COTIZACION_ACEPTADA_COLUMNS)
     .in("estado", ["Aceptada", "En operación"])
-    .order("created_at", { ascending: false });
+    .order("created_at", { ascending: false })
+    .limit(1000); // FE-05: mismo cap defensivo que fetchCotizaciones
   if (organizationId) query = query.eq("organization_id", organizationId);
```

- **Tras aplicar, verificar:**
  1. Listado de cotizaciones carga sin cambios visibles con < 1000 filas (retrocompatible).
  2. Revisar la query en la pestaña Network: incluye `limit=1000`.
  3. Abrir ticket de deuda técnica para paginación server-side (fuera de alcance de este fix).

---

### [FE-06] Captura CxP admite componentes negativos, vencimiento < emisión y TC sin tope (P2)

- **Severidad:** P2 · **Verificación:** dinámico (captura manual: `subtotal = -100`, `iva = 200` → total = 100 → el formulario pasa)
- **Archivos:** `src/features/cxp/hooks/useNuevaFacturaProveedorForm.schema.ts:43-68` (`superRefine`); cálculo en `src/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers.ts:64-70`
- **Problema:** el `superRefine` solo exige `total > 0`. `calcularTotal` suma valores crudos (`s + i + e - r`), así que componentes negativos pueden quedar enmascarados por otros positivos. No hay chequeo `vencimiento >= emision`, ni tope de TC (el módulo de *pagos* CxP sí tiene `TC_MAX = 1000`).
- **Fix (instrucción para Lovable):** agregar 3 `addIssue` al `superRefine` existente (sin tocar el hook ni la UI: los errores fluyen por `facturaFormErrorsFromZod` al shape actual): (a) componentes no negativos, (b) `vencimiento >= emision`, (c) `tc ≤ 1000` cuando hay TC. Opcionalmente también rechazar emisión futura.
- **Diff / código:**

`src/features/cxp/hooks/useNuevaFacturaProveedorForm.schema.ts`:

```diff
     .superRefine((values, refCtx) => {
       if (!values.provId) {
         refCtx.addIssue({ code: "custom", path: ["provId"], message: "Selecciona un proveedor" });
       }
       if (!values.folio.trim()) {
         refCtx.addIssue({ code: "custom", path: ["folio"], message: "Captura el folio del proveedor" });
       }
       // P1-2: sin fecha de emisión el índice único de la BD (proveedor + folio
       // + fecha) no puede evaluarse y el 23505 llega crudo al toast.
       if (!values.emision.trim()) {
         refCtx.addIssue({
           code: "custom",
           path: ["emision"],
           message: "La fecha de emisión es obligatoria",
         });
       }
       if (!values.categoriaId) {
         refCtx.addIssue({ code: "custom", path: ["categoriaId"], message: "Selecciona una categoría contable" });
       }
+      // FE-06a: componentes no negativos. Sin esto, subtotal = -100 e iva = 200
+      // dan total = 100 y pasaban la única validación existente (total > 0).
+      const componentes: Array<[keyof typeof values, string, string]> = [
+        ["subtotal", values.subtotal, "El subtotal no puede ser negativo"],
+        ["iva", values.iva, "El IVA no puede ser negativo"],
+        ["ieps", values.ieps, "El IEPS no puede ser negativo"],
+        ["retenciones", values.retenciones, "Las retenciones no pueden ser negativas"],
+      ];
+      for (const [campo, texto, mensaje] of componentes) {
+        if (texto.trim() !== "" && Number(texto) < 0) {
+          refCtx.addIssue({ code: "custom", path: [campo], message: mensaje });
+        }
+      }
+      // FE-06b: aging coherente — el vencimiento no puede ser anterior a la emisión.
+      if (
+        values.emision.trim() && values.vencimiento.trim() &&
+        values.vencimiento < values.emision
+      ) {
+        refCtx.addIssue({
+          code: "custom",
+          path: ["vencimiento"],
+          message: "La fecha de vencimiento no puede ser anterior a la fecha de emisión",
+        });
+      }
       if (ctx.total <= 0) {
         refCtx.addIssue({ code: "custom", path: ["subtotal"], message: "El total debe ser mayor a 0" });
       }
       if (values.moneda !== "MXN" && !(Number(values.tc) > 0)) {
         refCtx.addIssue({ code: "custom", path: ["tc"], message: "Captura el tipo de cambio" });
       }
+      // FE-06c: mismo tope que el módulo de pagos CxP (TC_MAX = 1000,
+      // pagoProveedorValidaciones.ts:70,110).
+      if (Number(values.tc) > 1000) {
+        refCtx.addIssue({
+          code: "custom",
+          path: ["tc"],
+          message: "El tipo de cambio no puede ser mayor a 1000",
+        });
+      }
     });
```

- **Tras aplicar, verificar:**
  1. `subtotal = -100, iva = 200` → error "El subtotal no puede ser negativo" y submit bloqueado.
  2. `vencimiento` anterior a `emision` → error en el campo vencimiento.
  3. Moneda USD con `tc = 1500` → "El tipo de cambio no puede ser mayor a 1000".
  4. Regresión: correr los tests existentes `useNuevaFacturaProveedorForm.emision.test.ts` y `useNuevaFacturaProveedorForm.dup.test.ts` (usan `tc: "1"`, `subtotal: "1000"` — deben seguir en verde); alta normal de factura con CFDI y captura manual sin cambios.

---

### [FE-07] Traspaso entre cuentas: sin validación de fecha futura y preview sin redondeo (P3)

- **Severidad:** P3 · **Verificación:** dinámico (DatePickerMx acepta cualquier fecha; preview con TC de 4+ decimales difiere un centavo del abono real)
- **Archivos:** `src/features/tesoreria/hooks/useTraspasoForm.ts:58-73`; UI en `src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx:93` (ojo: el archivo vive en `routes/_sections/`, no en `components/` — divergencia menor de la fuente)
- **Problema:** el `error` valida cuentas/monto/TC pero no la fecha. `montoDestino = montoOrigen * tipoCambio` sin `roundMoney`, mientras la RPC redondea (`ROUND(p_monto_origen*v_tc, 2)`): el preview puede diferir un centavo del abono real. Además la dirección del TC (siempre multiplica) es ambigua para el usuario.
- **Fix (instrucción para Lovable):** en `useTraspasoForm`: (a) redondear el preview con `roundMoney` (ya existe en `@/lib/financial/financialUtils`), (b) añadir validación `fecha <= hoy` con mensaje es-MX. El hint de dirección del TC se resuelve en el diálogo con una línea de texto aclaratoria.
- **Diff / código:**

`src/features/tesoreria/hooks/useTraspasoForm.ts`:

```diff
 import { useEffect, useMemo, useState } from "react";
 import { format } from "date-fns";
 import type { Tables } from "@/integrations/supabase/types";
+import { roundMoney } from "@/lib/financial/financialUtils";
```

```diff
   const montoDestino = useMemo(() => {
     if (!state.montoOrigen || state.montoOrigen <= 0) return 0;
     if (mismoMoneda) return state.montoOrigen;
-    return state.montoOrigen * (state.tipoCambio || 1);
+    // FE-07: la RPC redondea con ROUND(monto*tc, 2); el preview debe coincidir
+    // centavo a centavo con el abono real (canon `roundMoney` = half away from zero).
+    return roundMoney(state.montoOrigen * (state.tipoCambio || 1));
   }, [state.montoOrigen, mismoMoneda, state.tipoCambio]);
```

```diff
   const error = useMemo(() => {
     if (!state.origenId || !state.destinoId) return "Selecciona ambas cuentas.";
     if (state.origenId === state.destinoId) return "La cuenta origen y destino deben ser distintas.";
     if (!state.montoOrigen || state.montoOrigen <= 0) return "El monto debe ser mayor a cero.";
     if (!origen?.activa || !destino?.activa) return "Ambas cuentas deben estar activas.";
+    if (!state.fecha) return "Captura la fecha del traspaso.";
+    if (state.fecha > hoyIso()) return "La fecha del traspaso no puede ser futura.";
     if (!mismoMoneda && (!state.tipoCambio || state.tipoCambio <= 0)) {
       return "Captura el tipo de cambio para cuentas de distinta moneda.";
     }
     return null;
   }, [state, origen, destino, mismoMoneda]);
```

`src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx` (hint de dirección del TC):

```diff
             <p className="text-xs text-muted-foreground">
               {origen.moneda} → {destino.moneda}: {formatCurrency(montoDestino, destino.moneda)}
             </p>
+            <p className="text-xs text-muted-foreground">
+              El tipo de cambio multiplica: 1 {origen.moneda} = {state.tipoCambio} {destino.moneda}.
+              Si tu referencia viene expresada al revés, divídela antes de capturarla.
+            </p>
```

- **Tras aplicar, verificar:**
  1. Seleccionar fecha futura en el DatePicker → botón deshabilitado con "La fecha del traspaso no puede ser futura.".
  2. Traspaso USD→MXN con TC de 4 decimales: el preview coincide exactamente con el abono registrado por la RPC (comparar en el listado de movimientos).
  3. Regresión: traspaso entre cuentas de la misma moneda sigue sin pedir TC y con monto espejo.

---

### [FE-08] Alta de vendedora con % de comisión fuera de rango (P3)

- **Severidad:** P3 · **Verificación:** dinámico (agregar vendedora con 150% o −5% → se guarda)
- **Archivos:** `src/features/comisiones/components/TabVendedorasConfig.tsx:42-54` (`agregar`), línea 85 (input sin min/max); la edición sí valida en línea 58
- **Problema:** `agregar` guarda `Number(nuevoPct) || 0` sin chequeo de rango y el input de alta no tiene `min`/`max`. La edición (`guardarPct`) sí valida 0-100. Se puede crear configuración con 150% o −5%.
- **Fix (instrucción para Lovable):** reutilizar el mismo chequeo de rango de `guardarPct` en `agregar` (con el mismo `notifyError`) y añadir `min="0" max="100"` al input de alta.
- **Diff / código:**

```diff
   const agregar = () => {
     if (!nuevaVendedora || !organizationId) return;
+    // FE-08: mismo rango que la edición (guardarPct). Antes se podía dar de
+    // alta una vendedora con 150% o -5% (la edición sí lo validaba).
+    const pct = Number(nuevoPct);
+    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
+      return notifyError(undefined, { title: "% inválido", method: "FEATURES_COMISIONES_COMPONENTS_TABVENDEDORASCONFIG_1" });
+    }
     upsert.mutate({
       organization_id: organizationId,
       user_id: nuevaVendedora,
-      porcentaje_default: Number(nuevoPct) || 0,
+      porcentaje_default: pct,
       activa: true,
     }, {
```

```diff
-            <Input type="number" step="0.1" value={nuevoPct} onChange={(e) => setNuevoPct(e.target.value)} />
+            <Input type="number" step="0.1" min="0" max="100" value={nuevoPct} onChange={(e) => setNuevoPct(e.target.value)} />
```

- **Tras aplicar, verificar:**
  1. Alta con 150 o −5 → toast "% inválido", no se guarda.
  2. Alta con 0, 5 y 100 → se guarda correctamente.
  3. Regresión: edición de porcentaje y toggle "Activa" sin cambios.

---

### [FE-09] Borrado de catálogos con un solo click, sin confirmación ni `disabled` (P3)

- **Severidad:** P3 · **Verificación:** dinámico (un misclick borra; doble click dispara dos deletes y el segundo falla con toast feo)
- **Archivos:**
  - `src/features/configuracion/components/TabNavieras.tsx:55`
  - `src/features/configuracion/components/TabPuertos.tsx:50`
  - `src/features/configuracion/components/TabTiposContenedor.tsx:48`
  - Componente compartido a reutilizar: `src/components/shared/dialogs/DeleteConfirmDialog.tsx` (re-export de `DoubleConfirmDeleteDialog`, typable "ELIMINAR"); patrón de `disabled` de referencia: `CatalogoClavesSATCard.tsx:108`
- **Problema:** `onClick={() => eliminarNaviera.mutate(row.original.id)}` directo, sin diálogo de confirmación ni `disabled={...isPending}` — patrón distinto al resto del repo. Los tres tabs tienen el mismo defecto.
- **Fix (instrucción para Lovable):** en cada tab: (1) agregar estado `porEliminar` con la fila seleccionada, (2) el botón de basura solo abre el diálogo y queda `disabled={eliminar.isPending}`, (3) renderizar `<DeleteConfirmDialog>` que ejecuta el mutate en `onConfirm`. Ejemplo con `TabNavieras` (replicar idéntico en `TabPuertos` con `eliminarPuerto`/`Puerto` y en `TabTiposContenedor` con `eliminarTipo`/tipo de contenedor).
- **Diff / código:**

`src/features/configuracion/components/TabNavieras.tsx`:

```diff
 import { useAllNavieras, useAdminNavieras } from "@/features/catalogos/hooks";
 import SearchInput from "@/components/shared/SearchInput";
+import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
```

```diff
   const [navieraEnEdicion, setNavieraEnEdicion] = useState<Naviera | null>(null);
+  const [navieraAEliminar, setNavieraAEliminar] = useState<Naviera | null>(null);
```

```diff
-          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarNaviera.mutate(row.original.id)} aria-label={`Eliminar naviera ${row.original.name}`}>
+          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={eliminarNaviera.isPending} onClick={() => setNavieraAEliminar(row.original)} aria-label={`Eliminar naviera ${row.original.name}`}>
             <Trash2 className="h-4 w-4" />
           </Button>
```

```diff
       <NavieraFormDialog
         open={!!navieraEnEdicion}
         onOpenChange={(open) => { if (!open) setNavieraEnEdicion(null); }}
         naviera={navieraEnEdicion}
       />
+      <DeleteConfirmDialog
+        open={!!navieraAEliminar}
+        onOpenChange={(open) => { if (!open) setNavieraAEliminar(null); }}
+        entityName={`la naviera ${navieraAEliminar?.name ?? ""}`}
+        isPending={eliminarNaviera.isPending}
+        onConfirm={() => {
+          if (!navieraAEliminar) return;
+          eliminarNaviera.mutate(navieraAEliminar.id, {
+            onSuccess: () => setNavieraAEliminar(null),
+          });
+        }}
+      />
     </Card>
```

Equivalente en `TabPuertos.tsx`:

```diff
-        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarPuerto.mutate(row.original.id)} aria-label={`Eliminar puerto ${row.original.name}`}>
+        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={eliminarPuerto.isPending} onClick={() => setPuertoAEliminar(row.original)} aria-label={`Eliminar puerto ${row.original.name}`}>
```

y en `TabTiposContenedor.tsx`:

```diff
-        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarTipo.mutate(row.original.id)} aria-label={`Eliminar tipo ${row.original.name}`}>
+        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={eliminarTipo.isPending} onClick={() => setTipoAEliminar(row.original)} aria-label={`Eliminar tipo ${row.original.name}`}>
```

(con sus respectivos estados `puertoAEliminar` / `tipoAEliminar` y `<DeleteConfirmDialog>` al final del `Card`, siguiendo el patrón completo de TabNavieras).
- **Tras aplicar, verificar:**
  1. Click en la basura de una naviera/puerto/tipo → aparece el diálogo de confirmación de dos pasos (escribir "ELIMINAR"); nada se borra con un solo click.
  2. Durante el delete, el botón queda deshabilitado: doble click no genera segundo mutate ni toast de error.
  3. Regresión: alta, edición y toggle activo de los tres catálogos sin cambios; `CatalogoClavesSATCard` (que ya deshabilita) intacto.

---

### [FE-10] Divergencia UI vs RLS en "Registrar pago": rol `tesorero` (P3)

- **Severidad:** P3 · **Verificación:** estático (contraste matriz UI vs función RLS)
- **Archivos:** `src/lib/access/permissionMatrix.finanzas.ts:44-50`; contraste SQL: `supabase/migrations/20260722001738_dfc9effb-9345-47e2-9809-473dc2970c23.sql:7-16` (`es_escritor_financiero`) y policies de `pagos_factura` (líneas 278-300)
- **Problema:** UI `REGISTRAR_COBRO` = super_admin, admin_org, admin, contador, ejecutivo_cobranza. La RLS (`es_escritor_financiero`) incluye además `tesorero`: `role IN ('super_admin','admin','admin_org','contador','tesorero','ejecutivo_cobranza')`. Es restrictivo a favor de la UI (nadie ve una acción que la BD rechaza), pero si fue omisión, tesorería no puede registrar cobros aunque la BD se lo permite.
- **Fix (instrucción para Lovable):** **requiere decisión de producto** — alinear una de las dos fuentes:
  - **Opción A (recomendada, alinear UI a la RLS):** agregar `"tesorero"` a `REGISTRAR_COBRO`. Es coherente con `PAGAR_PROVEEDOR` (que ya incluye tesorero, líneas 24-29) y con la BD.
  - **Opción B (mantener UI restrictiva):** sin cambio de código; documentar la decisión como deliberada en el comentario del bloque.
- **Diff / código (Opción A):**

```diff
 // v13.213.40 — auxiliar_contable NO registra cobros (separación de responsabilidades):
 // sólo captura facturas de proveedor. Cobros los registran contador + ejecutivo_cobranza.
+// FE-10: tesorero alineado con la RLS `es_escritor_financiero` (migración
+// 20260722001738), que ya le permite escribir en `pagos_factura`.
 export const REGISTRAR_COBRO: readonly AppRole[] = [
   "super_admin",
   "admin_org",
   "admin",
   "contador",
   "ejecutivo_cobranza",
+  "tesorero",
 ];
```

Si se elige la Opción B: **sin cambio de código** — acción: agregar al comentario `// FE-10: tesorero excluido deliberadamente pese a que la RLS es_escritor_financiero lo permite (decisión de producto, fecha).`
- **Tras aplicar, verificar:**
  1. (Opción A) Login como tesorero → aparece el botón "Registrar pago" en el detalle de factura y el insert pasa la RLS sin 42501.
  2. Correr los tests de la matriz de permisos si existen (`grep` por `REGISTRAR_COBRO` en `src/**/__tests__`) y actualizar expectativas.
  3. Confirmar con dirección/contabilidad que la segregación de funciones (v13.310.0) no se ve afectada: tesorero sigue sin aprobar facturas de proveedor.

---

### [FE-11] Sin protección global de navegación con formulario sucio (P3)

- **Severidad:** P3 · **Verificación:** estático (grep verificado: no existe `useBlocker`/`beforeunload`/`Prompt` en todo `src/`; router es `react-router-dom@^6.30.4`, que sí soporta `useBlocker`)
- **Archivos:** sin archivo existente que modificar — **archivo nuevo**: `src/hooks/shared/useDirtyGuard.ts` (o la ubicación de hooks compartidos que prefiera Lovable); aplicación en `DialogNuevaFacturaProveedor` (CxP, 11 `useState`), editor de conceptos de cotización y wizard de embarque. El wizard de cotización ya mitiga con autosave a localStorage (`useCotizacionDraftAutosave`).
- **Problema:** los formularios largos pierden toda la captura al cerrar el diálogo o navegar, sin aviso. Es la contraparte de FE-02 (que pierde la captura *dentro* del diálogo por refetch).
- **Fix (instrucción para Lovable):** crear un hook genérico `useDirtyGuard(isDirty)` que (a) avise al cerrar/recargar la pestaña vía `beforeunload` y (b) bloquee la navegación interna con `useBlocker` de react-router-dom v6, mostrando un `ConfirmActionDialog` (ya existe en `src/components/shared/dialogs/ConfirmActionDialog.tsx`). Aplicarlo solo en los 3-4 formularios más largos, derivando `isDirty` de los valores actuales vs. iniciales. No requiere refactor de los formularios.
- **Diff / código (archivo nuevo):**

`src/hooks/shared/useDirtyGuard.ts`:

```ts
/**
 * FE-11 — Protección de navegación con formulario sucio.
 * Aplica a los formularios largos (captura CxP, editor de conceptos, wizard de
 * embarque): avisa antes de perder la captura al cerrar la pestaña o navegar.
 */
import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

export function useDirtyGuard(isDirty: boolean) {
  // 1) Cierre/recarga de pestaña (diálogo nativo del navegador).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // 2) Navegación interna (react-router-dom v6.30).
  const blocker = useBlocker(isDirty);

  const guardDialog = (
    <ConfirmActionDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
      title="¿Salir sin guardar?"
      description="Tienes cambios sin guardar en este formulario. Si sales ahora, se perderá lo capturado."
      confirmLabel="Salir sin guardar"
      cancelLabel="Seguir capturando"
      variant="destructive"
      onConfirm={() => blocker.proceed?.()}
    />
  );

  return { guardDialog };
}
```

Uso (ejemplo en el diálogo de captura CxP):

```tsx
const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues());
const { guardDialog } = useDirtyGuard(open && isDirty);
// …dentro del JSX, junto al FormDialogShell:
{guardDialog}
```

- **Tras aplicar, verificar:**
  1. Capturar CxP con datos, intentar navegar a otra ruta → diálogo "¿Salir sin guardar?"; "Seguir capturando" conserva todo.
  2. Recargar la pestaña con el formulario sucio → aviso nativo del navegador.
  3. Guardado exitoso → `isDirty` vuelve a false y no hay falsos positivos al navegar.
  4. Regresión: wizard de cotización (autosave) no debe quedar doblemente protegido ni romper la restauración del borrador.

---

### [FE-12] Validación de límite de crédito con flotantes crudos (P3)

- **Severidad:** P3 · **Verificación:** estático (comparación directa con el canon `financialUtils.ts:41-44`: "Usar SIEMPRE…")
- **Archivos:** `src/features/facturacion/utils/calcularTotalMxn.ts:22-34`; consumidor: `src/features/facturacion/hooks/useFacturaManualForm.ts:136-151`
- **Problema:** `calcularTotalMxn` acumula `acc + cant * precio` y `base * tasaIva` con flotantes crudos, pese al comentario del canon ("Usar SIEMPRE `subtotalLinea`… antes de acumular a un total padre, para evitar drift de punto flotante"). El resultado alimenta la validación de límite de crédito antes de timbrar (`validarLimite`), así que puede divergir centavos del total que realmente se persiste/timbra.
- **Fix (instrucción para Lovable):** reescribir las dos reducciones con `sumarSubtotales` y `calcularIVA`/`roundMoney` (helpers ya existentes en `@/lib/financial/financialUtils`), preservando la firma pública `TotalFacturaMxn` y la lógica `conIva || subtotal`.
- **Diff / código:**

```diff
 import { aMxn } from "@/lib/financial/convertir";
+import { sumarSubtotales, subtotalLinea, calcularIVA, roundMoney } from "@/lib/financial/financialUtils";
 import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
```

```diff
-  const subtotal = conceptos.reduce((acc, c) => {
-    const cant = Number(c.cantidad) || 0;
-    const precio = Number(c.precio_unitario) || 0;
-    return acc + cant * precio;
-  }, 0);
-  const conIva = conceptos.reduce((acc, c) => {
-    const cant = Number(c.cantidad) || 0;
-    const precio = Number(c.precio_unitario) || 0;
-    const base = cant * precio;
-    const iva = c.tipo_iva === "gravado_16" ? base * tasaIva : 0;
-    return acc + base + iva;
-  }, 0);
+  // FE-12: canon currency.js — subtotal por línea redondeado antes de acumular
+  // e IVA por línea con el mismo redondeo, para que la validación de crédito
+  // coincida centavo a centavo con el total que se persiste/timbra.
+  const subtotal = sumarSubtotales(conceptos, (c) => ({
+    cantidad: Number(c.cantidad) || 0,
+    precioUnitario: Number(c.precio_unitario) || 0,
+  }));
+  const conIva = roundMoney(
+    conceptos.reduce((acc, c) => {
+      const base = subtotalLinea(Number(c.cantidad) || 0, Number(c.precio_unitario) || 0);
+      const iva = c.tipo_iva === "gravado_16" ? calcularIVA(base, tasaIva) : 0;
+      return acc + base + iva;
+    }, 0),
+  );
   const total = conIva || subtotal;
   const conv = aMxn(total, moneda, tipoCambio);
   return { mxn: conv.monto, tcFaltante: !conv.completo };
```

- **Tras aplicar, verificar:**
  1. Factura manual con conceptos de precios con 3-4 decimales (p. ej. 3 × 19.995 gravado_16): el monto enviado a `validarLimite` coincide con el total mostrado/persistido al centavo.
  2. Concepto exento/tasa 0 mezclado con gravado_16: el IVA solo se calcula sobre los gravados.
  3. Regresión: `tcFaltante` sigue bloqueando el timbrado sin TC confiable; el flujo de límite de crédito (`rebasa` → alerta) intacto. Agregar/actualizar test unitario de `calcularTotalMxn` (existe suite en `src/features/facturacion/utils/__tests__/`).

---

## Resumen de validación

| ID | Archivo(s) principal(es) | Tipo de cambio |
|----|--------------------------|----------------|
| FE-01 | `DialogRegistrarPago.tsx`, `DialogRegistrarPagoParts.tsx`, `useRegistrarPagoSubmit.ts` | Bloqueo TC=0 (UI + handler) |
| FE-02 | `DialogRegistrarPago.tsx` | Guard de inicialización única |
| FE-03 | `DialogRegistrarPago.tsx`, `FacturaDetalleModales.tsx` | Validación de fechas (patrón CxP) |
| FE-04 | 4 archivos (conversion, mappers, estadoVigenciaCell, calculosCartera) | Fecha local en vez de UTC |
| FE-05 | `cotizacion/services/queries.ts` | `.limit(1000)` defensivo |
| FE-06 | `useNuevaFacturaProveedorForm.schema.ts` | 3 `addIssue` en `superRefine` |
| FE-07 | `useTraspasoForm.ts`, `DialogTraspasoCuentas.tsx` | Fecha ≤ hoy + `roundMoney` + hint TC |
| FE-08 | `TabVendedorasConfig.tsx` | Rango 0-100 en alta |
| FE-09 | `TabNavieras.tsx`, `TabPuertos.tsx`, `TabTiposContenedor.tsx` | `DeleteConfirmDialog` + `disabled` |
| FE-10 | `permissionMatrix.finanzas.ts` | Alinear UI↔RLS (decisión) |
| FE-11 | `src/hooks/shared/useDirtyGuard.ts` (nuevo) | Guard de formulario sucio |
| FE-12 | `calcularTotalMxn.ts` | Canon `currency.js` |


# Línea UX — UI/UX estática

# Fix pack UI/UX estática — Elogistix (listo para Lovable)

**Fuente:** `output/audit_reports/04_uiux_estatica.md` (hallazgos UX-01 a UX-14, auditoría estática sobre main @ 1ef05ce9, v13.523.1).
**Repo verificado:** `/mnt/agents/repo`, frontend en `src/`. Todos los fragmentos de los diffs fueron leídos de los archivos reales citados.
**Reglas del pack:** feature freeze → cambios locales, sin dependencias nuevas, sin refactors de arquitectura. Reutilizar siempre componentes/tokens ya existentes (`DeleteConfirmDialog`, `AsyncBoundary`, `DataTable`/`DetailTable`, `getErrorMessage`, `Button loading`, `text-kpi`, `FormDialogSection`).

**Leyenda:** los diffs son unificados reales (contexto del repo). Cuando un hallazgo es de clase, se da el fix del patrón central + 1-2 diffs de ejemplo + la lista de archivos donde replicarlo.

---

### [UX-01] Deletes sin confirmación en catálogos de Configuración
- **Severidad:** P1 · **Verificación:** estático
- **Archivos:**
  - `src/features/configuracion/components/TabNavieras.tsx` (línea 55)
  - `src/features/configuracion/components/TabPuertos.tsx` (línea 50)
  - `src/features/configuracion/components/TabTiposContenedor.tsx` (línea 48)
  - `src/features/configuracion/components/CatalogoClavesSATCard.tsx` (línea 108)
- **Problema:** un clic en el botón de basurero ejecuta `eliminarX.mutate(id)` directo, sin confirmación, sobre navieras/puertos/tipos de contenedor/claves SAT que son datos referenciales de cotizaciones, embarques y facturación. Contradice design-system.md §7 ("Eliminaciones destructivas: doble confirmación con la palabra `ELIMINAR`") y el patrón de módulos vecinos (costeo usa `ConfirmDeleteAlert`, que es wrapper de `ConfirmActionDialog`).
- **Fix (instrucción para Lovable):** en los 4 archivos, usar el componente compartido `DeleteConfirmDialog` (re-export tipado de `DoubleConfirmDeleteDialog`, doble paso con texto `ELIMINAR`, ya usado en proformas/tesorería/embarques). Patrón: (1) importar `DeleteConfirmDialog` desde `@/components/shared/dialogs/DeleteConfirmDialog`; (2) agregar estado `const [xAEliminar, setXAEliminar] = useState<Tipo | null>(null)`; (3) el `onClick` del botón destructivo cambia de `mutate(...)` a `setXAEliminar(row.original)` (en `CatalogoClavesSATCard` a `setAEliminar(r)`); (4) renderizar el diálogo junto al cierre del `Card`, con `entityName` que incluya el nombre del registro y `isPending` de la mutación; en `onConfirm` llamar al `mutate` y el diálogo se cierra solo al confirmar.
- **Diff / código:** ejemplo real en `TabNavieras.tsx` (replicar idéntico patrón en los otros 3; en `CatalogoClavesSATCard.tsx` el registro es `Row` y el nombre visible es `r.patron`):

```diff
 import { NavieraFormDialog } from "@/components/shared/NavieraFormDialog";
+import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
 import type { Naviera } from "@/features/catalogos/services";
@@
   const [navieraEnEdicion, setNavieraEnEdicion] = useState<Naviera | null>(null);
+  const [navieraAEliminar, setNavieraAEliminar] = useState<Naviera | null>(null);
@@
-          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarNaviera.mutate(row.original.id)} aria-label={`Eliminar naviera ${row.original.name}`}>
+          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setNavieraAEliminar(row.original)} aria-label={`Eliminar naviera ${row.original.name}`}>
             <Trash2 className="h-4 w-4" />
           </Button>
@@
       <NavieraFormDialog
         open={!!navieraEnEdicion}
         onOpenChange={(open) => { if (!open) setNavieraEnEdicion(null); }}
         naviera={navieraEnEdicion}
       />
+      <DeleteConfirmDialog
+        open={!!navieraAEliminar}
+        onOpenChange={(open) => { if (!open) setNavieraAEliminar(null); }}
+        entityName={navieraAEliminar ? `la naviera "${navieraAEliminar.name}"` : "esta naviera"}
+        description="La naviera se eliminará del catálogo. Las cotizaciones y embarques existentes no se modifican."
+        isPending={eliminarNaviera.isPending}
+        onConfirm={() => {
+          if (navieraAEliminar) eliminarNaviera.mutate(navieraAEliminar.id);
+        }}
+      />
     </Card>
```

Variantes por archivo (mismas líneas de diálogo, cambian nombres):
- `TabPuertos.tsx`: `puertoAEliminar: Puerto | null`, `entityName={`el puerto "${puertoAEliminar.name}"`}`, `onConfirm` → `eliminarPuerto.mutate(puertoAEliminar.id)` (línea 50).
- `TabTiposContenedor.tsx`: `tipoAEliminar: TipoContenedor | null`, `entityName={`el tipo de contenedor "${tipoAEliminar.name}"`}`, `onConfirm` → `eliminarTipo.mutate(tipoAEliminar.id)` (línea 48).
- `CatalogoClavesSATCard.tsx`: `const [rowAEliminar, setRowAEliminar] = useState<Row | null>(null)`; botón línea 108 `onClick={() => setRowAEliminar(r)}`; `entityName={`el producto "${rowAEliminar.patron}"`}`; `isPending={deleteMut.isPending}`; `onConfirm` → `deleteMut.mutate(rowAEliminar.id)`. Importar `Row` desde `./CatalogoClavesSATCard.constants` (ya se importa `type Row` ahí).

- **Tras aplicar, verificar:** en Configuración → cada catálogo, clic en el basurero abre el diálogo de 2 pasos que exige escribir `ELIMINAR`; el botón "Eliminar definitivamente" sólo se habilita con el texto exacto; al confirmar, la fila desaparece y el toast de éxito se muestra; Cancelar no borra nada. Intentar borrar una naviera/puerto en uso por un embarque: el error de FK (23503) aparece como mensaje amigable (ver UX-02) y no rompe la pantalla.

---

### [UX-02] `error.message` técnico crudo en títulos de toast de error
- **Severidad:** P1 · **Verificación:** estático
- **Archivos (45 archivos, ~78 call sites; los de módulos core primero):**
  - `src/features/admin/hooks/usuario/useUsuarios.ts` (líneas 60, 74, 108 y 4 más), `src/features/admin/hooks/usuario/usePortalUsuarios.ts`, `src/features/admin/hooks/useAdminData.ts`
  - `src/features/comisiones/hooks/useVendedoras.ts` (50, 65, 81), `useLiquidaciones.ts`
  - `src/features/cotizacion/hooks/useRevalidacionTarifa.ts` (33, 64, 94), `useCotizacionConversions.ts`, `useCotizacionCostos.ts`, `useCotizacionInformativa.ts`, `useVersionadoCotizacion.ts`
  - `src/features/crm/hooks/useActividades.ts` (77, 92, 108), `useOportunidades.ts`, `useEtapasPipeline.ts`, `usePlantillasMensaje.ts`, `useComentariosOportunidad.ts`, `useAutomatizacionesEtapa.ts`, `useCrearCotizacionDesdeOportunidad.ts`, `hooks/leads/{bulk,convertir,mutations}.ts`, `useActualizarActividadNotas.ts`
  - `src/features/cxp/hooks/useFacturaProveedorMutations.ts`, `useAdjuntoFacturaProveedor.ts`, `components/HistorialFacturaSection.tsx`, `services/facturasEntrantes{Conceptos,Upload}.ts`
  - `src/features/embarques/hooks/mutations/{useCreateEmbarque,useNotaEmbarque,useUpdateEmbarque}.ts`, `useEventosEmbarque.ts`, `useProformas.ts`, `useTrackingLinks.ts`
  - `src/features/facturacion/hooks/useFacturas.ts`, `usePagosFactura.ts`, `components/TabProyeccion.tsx`
  - `src/features/presupuesto/hooks/usePresupuesto{Categorias,Mensual}.ts`, `src/features/proveedor/hooks/useProveedores.ts`, `src/features/tesoreria/hooks/{useTesoreriaCuentas,useTraspasos}.ts`, `src/features/cliente/hooks/useClientUsersMutations.ts`, `src/features/portal/hooks/usePortalPerfil.ts`, `src/features/proformas/services/facturar.ts`, `src/features/admin/services/exportOrg.ts`, `src/features/admin/routes/Diagnostico.tsx`
- **Problema:** el patrón `` notifyError(undefined, { title: `Error al X: ${error.message}` }) `` interpela el mensaje crudo de PostgREST/Auth en el título del toast. `sanitizeToastText` quita HTML y nombres de constraints, pero el inglés técnico sigue visible: "duplicate key value violates unique constraint", "JWT expired", "new row violates row-level security policy".
- **Fix (instrucción para Lovable):** el helper central **ya existe**: `getErrorMessage(err)` en `src/lib/errors/index.ts`, que traduce códigos Postgres (SQLSTATE 23503 FK, 23505 único, 23514 check, 42501 permisos), violaciones de RLS, errores de Edge Functions y catálogo `LC_*` a mensajes de negocio en es-MX (vía `translatePostgresError` en `src/lib/errors/pgErrorCodes.ts`). En cada call site: (1) título fijo en español, en forma negativa de la acción ("No se pudo cambiar el rol"); (2) `description: getErrorMessage(error)` para el detalle amigable; (3) conservar `error` y `method` en opts (el detalle técnico sigue disponible en "Ver detalles" → `ErrorDetailsDialog` y en Sentry). Import: `import { getErrorMessage } from "@/lib/errors";`. Hacerlo módulo por módulo empezando por admin, comisiones, cotización, crm, cxp, embarques, facturación (módulos core); **no tocar `appFeedback.ts`**.
- **Diff / código:** ejemplos reales:

`src/features/admin/hooks/usuario/useUsuarios.ts`:
```diff
+import { getErrorMessage } from "@/lib/errors";
@@
     onError: (error: Error) => {
-      notifyError(undefined, { title: `Error al cambiar rol: ${error.message}`, error, method: "UPDATE_USER_ROLE" });
+      notifyError(undefined, { title: "No se pudo cambiar el rol", description: getErrorMessage(error), error, method: "UPDATE_USER_ROLE" });
     },
@@
     onError: (error: Error) => {
-      notifyError(undefined, { title: `Error al eliminar usuario: ${error.message}`, error, method: "DELETE_USER" });
+      notifyError(undefined, { title: "No se pudo eliminar el usuario", description: getErrorMessage(error), error, method: "DELETE_USER" });
     },
```

`src/features/comisiones/hooks/useVendedoras.ts` (línea 50; replicar en 65 y 81):
```diff
     onError: (error: Error) => {
-      notifyError(undefined, { title: `Error al guardar configuración: ${error.message}`, error, method: "UPSERT_VENDEDORA_CONFIG" });
+      notifyError(undefined, { title: "No se pudo guardar la configuración", description: getErrorMessage(error), error, method: "UPSERT_VENDEDORA_CONFIG" });
     },
```

`src/features/cotizacion/hooks/useRevalidacionTarifa.ts` (línea 33; replicar en 64 y 94):
```diff
       notifyError(undefined, {
-        title: `No se pudo solicitar re-aprobación: ${error.message}`,
+        title: "No se pudo solicitar la re-aprobación",
+        description: getErrorMessage(error),
         error,
         method: "REVALIDACION_SOLICITAR_REAPROBACION",
       });
```

- **Tras aplicar, verificar:** provocar errores reales (p. ej. duplicar el RFC de un cliente, borrar una naviera en uso, desconectar la red): el título del toast es una frase fija en español y la descripción dice "Ya existe un registro con esos mismos datos…" / "No se puede completar la operación porque este registro está relacionado con otros datos…", nunca el SQL en inglés. "Ver detalles" sigue mostrando el payload técnico. `grep -rn 'error.message}` src --include=*.ts` en hooks debe quedar en 0.

---

### [UX-03] 36+ tablas `<table>` crudas fuera de `DataTable`/`DetailTable`
- **Severidad:** P2 · **Verificación:** estático
- **Archivos:** 39 archivos con JSX `<table` crudo (grep verificado). Los citados por la auditoría: `src/features/crm/routes/Analitica.tsx`, `CrmDashboard.tsx`, `src/features/crm/components/Cliente360Panel.tsx`, `OportunidadCotizacionesList.tsx`, `ImportarLeadsCsvPreview.tsx`, `src/features/presupuesto/components/TabVsReal.tsx`, `TabCategorias.tsx`, `TabCaptura.tsx`, `src/features/tesoreria/components/TablaFlujoSemanal.tsx`, `src/features/profit/components/EstadoResultadosTable.tsx`, `src/features/facturacion/components/detalle/FacturaPagosTabla.tsx`, `src/features/facturacion/components/NotasCreditoRecientes.tsx`. Infraestructura exenta: `src/components/ui/table.tsx`, `src/components/shared/DataTable.tsx`, `src/pdf/components/DataTable.tsx`.
- **Problema:** el guardrail `src/__tests__/architecture/no-raw-table.test.ts` sólo vigila *imports* de `@/components/ui/table`; el JSX `<table>` crudo lo esquiva. Estas tablas no usan `text-table-head` en encabezados, ni `ROW_HOVER`, ni densidad `TABLE_DENSITY`, ni estados vacíos integrados → inconsistencia visual transversal.
- **Fix (instrucción para Lovable):** dos pasos, en este orden (bajo riesgo para el release):
  1. **Congelar la deuda:** extender el test de arquitectura con una segunda regla que detecte JSX `<table` crudo y una allowlist con los archivos actuales (así la deuda no crece sin migrar nada todavía).
  2. **Migrar incrementalmente** (post-release o por módulo): cada tabla cruda simple → `DataTable` + `defineColumns` (patrón de `TabNavieras.tsx`); cada tabla de detalle estática → `DetailTable` (`DetailTableHead`/`DetailTableRow`/`DetailTableEmptyRow`, patrón de `CatalogoClavesSATCard.tsx`). Tablas con filas expandibles (p. ej. `TablaFlujoSemanal.tsx`) → migrar a `DetailTable` conservando el fragmento expandido, no a `DataTable`.
- **Diff / código:**

Paso 1 — extender `src/__tests__/architecture/no-raw-table.test.ts` (agregar después del primer `it`):

```diff
 const RAW_TABLE_IMPORT = /from\s+["']@\/components\/ui\/table["']/;
+
+/** JSX de tabla cruda: `<table ...>` fuera de DataTable/DetailTable/pdf. */
+const RAW_TABLE_JSX = /<\s*table[\s>]/;
+
+/**
+ * Deuda congelada (UX-03): archivos que hoy renderizan `<table>` crudo.
+ * NO agregar entradas nuevas; quitar al migrar a DataTable/DetailTable.
+ */
+const RAW_TABLE_JSX_DEBT: readonly string[] = [
+  // Infraestructura (implementaciones, no consumidores).
+  "src/components/ui/table.tsx",
+  "src/components/shared/DataTable.tsx",
+  "src/pdf/components/DataTable.tsx",
+  // Deuda existente a migrar (ver fixes_UX.md UX-03).
+  "src/features/crm/routes/Analitica.tsx",
+  "src/features/crm/routes/CrmDashboard.tsx",
+  "src/features/crm/components/Cliente360Panel.tsx",
+  "src/features/crm/components/OportunidadCotizacionesList.tsx",
+  "src/features/crm/components/ImportarLeadsCsvPreview.tsx",
+  "src/features/presupuesto/components/TabVsReal.tsx",
+  "src/features/presupuesto/components/TabCategorias.tsx",
+  "src/features/presupuesto/components/TabCaptura.tsx",
+  "src/features/tesoreria/components/TablaFlujoSemanal.tsx",
+  "src/features/profit/components/EstadoResultadosTable.tsx",
+  "src/features/facturacion/components/detalle/FacturaPagosTabla.tsx",
+  "src/features/facturacion/components/NotasCreditoRecientes.tsx",
+  // … completar con el resto de los 39 archivos listados por
+  // `grep -rln "<table" src --include=*.tsx`
+];
+
+  it("no hay JSX <table> crudo fuera de la deuda congelada", () => {
+    const violations: string[] = [];
+    for (const f of walk(join(ROOT, "src"), {
+      excludeDirs: ["__tests__", "node_modules"],
+      excludeFileRe: /\.(test|spec)\.tsx?$/,
+    })) {
+      const src = readFileSync(f, "utf8");
+      if (!RAW_TABLE_JSX.test(src)) continue;
+      const rel = relPath(ROOT, f);
+      if (!RAW_TABLE_JSX_DEBT.includes(rel)) violations.push(rel);
+    }
+    expect(
+      violations,
+      `Nuevas tablas crudas detectadas. Usa <DataTable /> o <DetailTable />.\n\n` +
+        violations.join("\n"),
+    ).toEqual([]);
+  });
```

Paso 2 — ejemplo de migración real, `src/features/facturacion/components/NotasCreditoRecientes.tsx` (ANTES, líneas 102-113):

ANTES:
```tsx
<div className="overflow-x-auto">
  <table className="w-full text-sm">
    <thead className="text-xs text-muted-foreground border-y bg-muted/20">
      <tr>
        <th className="text-left py-2 px-3">Folio</th>
        <th className="text-left py-2 px-3">Factura</th>
        <th className="text-left py-2 px-3">Cliente</th>
        <th className="text-left py-2 px-3">Fecha</th>
        <th className="text-left py-2 px-3">Motivo</th>
        <th className="text-left py-2 px-3">Estado</th>
        <th className="text-right py-2 px-3">Monto</th>
      </tr>
    </thead>
```

DESPUÉS (con `DataTable`, que ya soporta `onRowClick`, `getRowAriaLabel`, `emptyMessage` y skeletons):
```tsx
const columns = defineColumns<NotaCreditoRow>([
  { id: "folio", header: "Folio", cell: ({ row }) => row.original.numero },
  { id: "factura", header: "Factura", cell: ({ row }) => row.original.factura_numero },
  { id: "cliente", header: "Cliente", cell: ({ row }) => row.original.cliente_nombre },
  { id: "fecha", header: "Fecha", cell: ({ row }) => formatDate(row.original.fecha) },
  { id: "motivo", header: "Motivo", cell: ({ row }) => row.original.motivo },
  { id: "estado", header: "Estado", cell: ({ row }) => <EstadoNotaBadge estado={row.original.estado} /> },
  { id: "monto", header: "Monto", meta: { className: "text-right", headerClassName: "text-right" },
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.monto, row.original.moneda)}</span> },
]);

<DataTable
  columns={columns}
  data={filtradas}
  isLoading={isLoading}
  emptyMessage="No hay notas de crédito que coincidan."
  rowKey={(n) => n.id}
  onRowClick={(n) => navigate(`/facturacion/${n.factura_id}`)}
  getRowAriaLabel={(n) => `Ver factura ${n.factura_numero}`}
  density={TABLE_DENSITY.embebida}
/>
```
(Ajustar nombres de campos a los reales del tipo del archivo; el `<table>` y su `tbody` desaparecen.)

- **Tras aplicar, verificar:** `bun run test src/__tests__/architecture/no-raw-table.test.ts` pasa y falla si se agrega un `<table>` nuevo fuera de la lista. En las pantallas migradas: encabezados en mayúsculas 11px (`text-table-head`), hover uniforme, estado vacío consistente, clic de fila sigue navegando y el lector de pantalla anuncia el `aria-label` de la fila.

---

### [UX-04] Labels sin asociación programática con su input
- **Severidad:** P2 · **Verificación:** estático
- **Archivos:** patrón central `src/components/shared/FormField.tsx` (líneas 42-60, usado por los wizards). Diálogos puntuales: `src/features/cliente/components/DialogContacto.tsx` (9 campos), `src/features/proveedor/components/EditarProveedorBancariosFields.tsx` (10), `NuevoProveedorStep2.tsx` (10), `src/features/crm/components/nuevoLead/NuevoLeadForm.tsx` (7), `src/features/embarques/components/DialogSeguroForm.tsx` (9). ~193 pares Label→Input sin `htmlFor`/`id` en total.
- **Problema:** `FormField` renderiza `<Label>` sin `htmlFor` y no inyecta `id` al hijo; el error tampoco se vincula con `aria-describedby`. Los lectores de pantalla no anuncian la etiqueta al enfocar el campo y el clic en el label no enfoca el input (WCAG 1.3.1 / 3.3.2).
- **Fix (instrucción para Lovable):** dos pasos.
  1. **Fix central (un archivo, efecto multiplicador):** reescribir `FormField` con `useId()`; si el hijo es un único elemento válido sin `id` propio, clonarlo inyectando `id`, `aria-invalid` y `aria-describedby` (apunta al `<p>` del error). Así todos los wizards quedan asociados sin tocar consumidores. Nota: para `<Select>` de shadcn el `id` debe llegar al `SelectTrigger`; en los consumidores donde el hijo sea `<Select>`, el clon va al root de Radix y no asocia — esos casos se cubren en el paso 2 poniendo el `id` manual en el `SelectTrigger`.
  2. **Diálogos puntuales:** en los 5 archivos listados, agregar `htmlFor`/`id` explícitos por campo (id estable por nombre de campo, p. ej. `id="contacto-nombre"`).
- **Diff / código:**

Paso 1 — `src/components/shared/FormField.tsx`:

```diff
-import { ReactNode } from "react";
+import { Children, ReactNode, cloneElement, isValidElement, useId } from "react";
 import { Label } from "@/components/ui/label";
 import { cn } from "@/lib/utils";
@@
 }: FormFieldProps) {
+  const id = useId();
+  const errorId = `${id}-error`;
   const spanClass =
     span === 2 ? "md:col-span-2"
     : span === "full" ? "col-span-full"
     : "";
+
+  // Inyecta id/aria al control hijo cuando es un único elemento sin id propio
+  // (Input, Textarea…). Para <Select> el consumidor debe poner el id en
+  // <SelectTrigger> y pasarlo vía props (Radix no lo reenvía desde el root).
+  const control =
+    Children.count(children) === 1 &&
+    isValidElement(children) &&
+    !(children.props as { id?: string }).id
+      ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
+          id,
+          "aria-invalid": error ? true : undefined,
+          "aria-describedby": error ? errorId : undefined,
+        })
+      : children;
 
   return (
     <div className={cn("space-y-2", spanClass, className)}>
       {label && (
-        <Label className="text-sm font-medium">
+        <Label htmlFor={id} className="text-sm font-medium">
           {label}
           {required && <span className="text-destructive ml-0.5">*</span>}
           {hint && (
             <span className="text-xs text-muted-foreground font-normal ml-2">
               {hint}
             </span>
           )}
         </Label>
       )}
-      {children}
+      {control}
       {error && (
-        <p className="text-xs text-destructive" role="alert">
+        <p id={errorId} className="text-xs text-destructive" role="alert">
           {error}
         </p>
       )}
     </div>
   );
 }
```

Paso 2 — ejemplo real en `src/features/cliente/components/DialogContacto.tsx`:

```diff
-        <div><Label className="text-xs">Tax ID</Label><Input value={form.rfc} onChange={e => handleChange('rfc', e.target.value)} className="mt-1" /></div>
-        <div><Label className="text-xs">País</Label><Input value={form.pais} onChange={e => handleChange('pais', e.target.value)} className="mt-1" /></div>
-        <div><Label className="text-xs">Ciudad</Label><Input value={form.ciudad} onChange={e => handleChange('ciudad', e.target.value)} className="mt-1" /></div>
+        <div><Label htmlFor="contacto-rfc" className="text-xs">Tax ID</Label><Input id="contacto-rfc" value={form.rfc} onChange={e => handleChange('rfc', e.target.value)} className="mt-1" /></div>
+        <div><Label htmlFor="contacto-pais" className="text-xs">País</Label><Input id="contacto-pais" value={form.pais} onChange={e => handleChange('pais', e.target.value)} className="mt-1" /></div>
+        <div><Label htmlFor="contacto-ciudad" className="text-xs">Ciudad</Label><Input id="contacto-ciudad" value={form.ciudad} onChange={e => handleChange('ciudad', e.target.value)} className="mt-1" /></div>
```
(Replicar en los 9 campos de ese diálogo: `contacto-nombre`, `contacto-tipo` en el `SelectTrigger`, `contacto-direccion`, `contacto-contacto`, `contacto-email`, `contacto-telefono`.)

- **Tras aplicar, verificar:** en cualquier wizard que use `FormField` (p. ej. alta de embarque), clic en el label enfoca el input; con lector de pantalla (o DevTools → Accessibility) el campo anuncia su etiqueta y, cuando hay error, lo lee vía `aria-describedby`. En `DialogContacto`, los 9 campos quedan asociados. Los tests existentes de FormField (si los hay) siguen pasando.

---

### [UX-05] Portal cliente: spinner genérico y error sin retry en "Mi Perfil"
- **Severidad:** P2 · **Verificación:** estático
- **Archivos:** `src/features/portal/routes/PortalPerfil.tsx` (líneas 28-42).
- **Problema:** `isLoading` → `<Loader2>` full-page (no skeleton, salto de layout al cargar); `isError` → texto plano "No se pudo cargar tu perfil." sin botón de reintento ni `refetch`. En la superficie cara al cliente, un fallo de red es un callejón sin salida (equivale a UIB-05).
- **Fix (instrucción para Lovable):** reemplazar ambos bloques por el patrón canónico `AsyncBoundary` (ya usado en `TesoreriaCuentas.tsx:57`) con `PageSkeleton` y `onRetry={refetch}`. `usePortalPerfil` es un `useQuery` estándar, así que `refetch` ya está disponible — sólo hay que desestructurarlo.
- **Diff / código:** `src/features/portal/routes/PortalPerfil.tsx`:

```diff
 import { useState } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
-import { Loader2, Pencil, KeyRound, User as UserIcon, Building2 } from "lucide-react";
+import { Pencil, KeyRound, User as UserIcon, Building2 } from "lucide-react";
 import { usePortalPerfil } from "@/features/portal/hooks";
 import { EditarContactoDialog } from "@/features/portal/components/perfil/EditarContactoDialog";
 import { CambiarPasswordDialog } from "@/features/portal/components/perfil/CambiarPasswordDialog";
 import { PageHeader } from "@/components/shared/PageHeader";
+import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";
+import { PageSkeleton } from "@/components/shared/skeletons";
 import { useDocumentTitle } from "@/hooks/shared";
@@
   useDocumentTitle('Mi perfil');
-  const { data, isLoading, isError } = usePortalPerfil();
+  const { data, isLoading, isError, refetch } = usePortalPerfil();
   const [editContacto, setEditContacto] = useState(false);
   const [cambiarPass, setCambiarPass] = useState(false);
 
-  if (isLoading) {
-    return (
-      <div className="flex items-center justify-center py-20">
-        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
-      </div>
-    );
-  }
-
-  if (isError || !data) {
+  if (isLoading || isError || !data) {
     return (
-      <div className="py-20 text-center text-sm text-muted-foreground">
-        No se pudo cargar tu perfil.
-      </div>
+      <AsyncBoundary
+        isLoading={isLoading}
+        isError={isError || !data}
+        onRetry={() => refetch()}
+        skeleton={<PageSkeleton />}
+        errorTitle="No se pudo cargar tu perfil"
+        errorDescription="Revisa tu conexión e inténtalo de nuevo."
+      >
+        {null}
+      </AsyncBoundary>
     );
   }
```

- **Tras aplicar, verificar:** entrar a `/portal/perfil`: durante la carga se ve el skeleton (header + bloque, sin salto); con red bloqueada (DevTools → offline) aparece el `ErrorState` "No se pudo cargar tu perfil" con botón **Reintentar** que dispara `refetch` y recupera la vista al volver la red. Además, `AsyncBoundary` cubre el caso de carga colgada (>20 s) con mensaje "Está tardando más de lo normal".

---

### [UX-06] Botones solo-icono sin nombre accesible
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/configuracion/components/CatalogoClavesSATCard.tsx` (107, 108) y `CatalogoClavesSATCard.parts.tsx` (52, 53); `src/features/embarques/components/facturacion/HistorialProformas.tsx` (123); `src/features/facturacion/components/detalle/FacturaTimbradoCard.tsx` (82, copiar UUID); `src/features/portal-agente/routes/_sections/agenteTarifasColumns.tsx` (137); `src/features/crm/components/PlantillasMensajeEditor.tsx` (130). Plus i18n: `src/components/ui/sidebar.tsx` (231 `sr-only` "Toggle Sidebar"; también `SidebarRail` con `aria-label="Toggle Sidebar"`).
- **Problema:** 8 botones que sólo contienen un ícono y no tienen `aria-label` — el lector de pantalla los anuncia como "botón" sin propósito. Además el nombre accesible del sidebar está en inglés en una app es-MX.
- **Fix (instrucción para Lovable):** agregar `aria-label` descriptivo (una línea por botón, con el nombre del registro cuando aplique) y traducir los dos textos del sidebar.
- **Diff / código:** diffs reales:

`src/features/configuracion/components/CatalogoClavesSATCard.tsx`:
```diff
-                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)} disabled={busy}><Pencil className="h-4 w-4" /></Button>
-                    <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(r.id)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
+                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)} disabled={busy} aria-label={`Editar producto ${r.patron}`}><Pencil className="h-4 w-4" /></Button>
+                    <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(r.id)} disabled={busy} aria-label={`Eliminar producto ${r.patron}`}><Trash2 className="h-4 w-4" /></Button>
```
(Nota: el `onClick` del delete cambia al confirmador de UX-01; el `aria-label` se conserva.)

`src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx`:
```diff
-        <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy}><X className="h-4 w-4" /></Button>
-        <Button size="icon" onClick={onSave} disabled={busy || !valid}><Check className="h-4 w-4" /></Button>
+        <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy} aria-label="Cancelar edición"><X className="h-4 w-4" /></Button>
+        <Button size="icon" onClick={onSave} disabled={busy || !valid} aria-label="Guardar producto"><Check className="h-4 w-4" /></Button>
```

`src/features/embarques/components/facturacion/HistorialProformas.tsx`:
```diff
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-8 w-8"
                 onClick={(e) => e.stopPropagation()}
+                aria-label={`Acciones de la proforma ${p.numero}`}
               >
                 <MoreHorizontal className="h-4 w-4" />
               </Button>
```

`src/features/facturacion/components/detalle/FacturaTimbradoCard.tsx`:
```diff
-              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copiarUuid}>
+              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copiarUuid} aria-label="Copiar folio fiscal (UUID)">
                 <Copy className="h-3 w-3" />
               </Button>
```

`src/features/portal-agente/routes/_sections/agenteTarifasColumns.tsx`:
```diff
-                <Button variant="ghost" size="icon">
+                <Button variant="ghost" size="icon" aria-label={`Acciones de la tarifa ${t.ruta ?? t.id}`}>
                   <MoreHorizontal className="h-4 w-4" />
                 </Button>
```
(usar el campo de nombre/ruta real del tipo; si no existe, `aria-label="Acciones de la tarifa"`).

`src/features/crm/components/PlantillasMensajeEditor.tsx`:
```diff
                     <Button
                       size="icon"
                       variant="ghost"
                       className="h-8 w-8 text-destructive"
                       onClick={() => setAEliminar({ id: p.id, nombre: p.nombre })}
+                      aria-label={`Eliminar plantilla ${p.nombre}`}
                     >
                       <Trash2 className="h-3.5 w-3.5" />
```

`src/components/ui/sidebar.tsx` (traducción es-MX):
```diff
-        <span className="sr-only">Toggle Sidebar</span>
+        <span className="sr-only">Mostrar u ocultar la barra lateral</span>
@@
-        aria-label="Toggle Sidebar"
+        aria-label="Mostrar u ocultar la barra lateral"
```

- **Tras aplicar, verificar:** con DevTools → Accessibility tree (o NVDA/VoiceOver), los 8 botones anuncian su propósito con el nombre del registro; el botón del sidebar se anuncia en español. `grep -rn "Toggle Sidebar" src` debe quedar en 0.

---

### [UX-07] Switches de tablas/ajustes sin `aria-label`
- **Severidad:** P3 · **Verificación:** estático
- **Archivos (15 casos):** `src/features/configuracion/components/TabNavieras.tsx` (45), `TabPuertos.tsx` (44), `TabTiposContenedor.tsx` (42), `src/features/admin/components/TabPlanes.tsx` (129), `src/features/comisiones/components/TabVendedorasConfig.tsx` (117), `src/features/crm/components/EtapasPipelineEditor.tsx` (124 y 128), `MotivosPerdidaEditor.tsx` (52). Además `CatalogoClavesSATCard.parts.tsx` (50, switch "Activo" del draft).
- **Problema:** el switch "Activo" de cada fila se anuncia como "interruptor" sin contexto — en una tabla de 20 filas son 20 "interruptor" indistinguibles.
- **Fix (instrucción para Lovable):** agregar `aria-label` con la acción + nombre del registro (una línea por switch). Patrón: `aria-label={\`Activar ${entidad} ${row.original.nombre}\`}` (o `Desactivar…` según `checked`; opcional pero mejor: `aria-label={checked ? \`Desactivar X\` : \`Activar X\`}`).
- **Diff / código:** diffs reales:

`src/features/configuracion/components/TabNavieras.tsx` (idéntico patrón en `TabPuertos.tsx:44` con `puerto`/`name`, y `TabTiposContenedor.tsx:42` con `tipo de contenedor`/`name`):
```diff
-      cell: ({ row }) => <Switch checked={row.original.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: row.original.id, activo: checked })} />,
+      cell: ({ row }) => <Switch checked={row.original.activo} onCheckedChange={(checked) => toggleActivo.mutate({ id: row.original.id, activo: checked })} aria-label={row.original.activo ? `Desactivar naviera ${row.original.name}` : `Activar naviera ${row.original.name}`} />,
```

`src/features/admin/components/TabPlanes.tsx`:
```diff
         <Switch
           checked={row.original.activo}
           onCheckedChange={(checked) => updatePlan.mutate({ id: row.original.id, activo: checked })}
+          aria-label={row.original.activo ? `Desactivar plan ${row.original.nombre}` : `Activar plan ${row.original.nombre}`}
         />
```

`src/features/comisiones/components/TabVendedorasConfig.tsx`:
```diff
-                    <Switch checked={c.activa} onCheckedChange={(v) => toggleActiva(c.id, v)} />
+                    <Switch checked={c.activa} onCheckedChange={(v) => toggleActiva(c.id, v)} aria-label={c.activa ? `Desactivar comisión de ${c.nombre}` : `Activar comisión de ${c.nombre}`} />
```

`src/features/crm/components/EtapasPipelineEditor.tsx` (dos switches):
```diff
-                  <Switch checked={d.activa} onCheckedChange={(v) => set(e.id, { activa: v })} />
+                  <Switch checked={d.activa} onCheckedChange={(v) => set(e.id, { activa: v })} aria-label={`Etapa ${e.nombre} activa`} />
@@
-                  <Switch checked={d.crea_tarea_seguimiento} onCheckedChange={(v) => set(e.id, { crea_tarea_seguimiento: v })} />
+                  <Switch checked={d.crea_tarea_seguimiento} onCheckedChange={(v) => set(e.id, { crea_tarea_seguimiento: v })} aria-label={`Crear tarea de seguimiento al entrar a ${e.nombre}`} />
```

`src/features/crm/components/MotivosPerdidaEditor.tsx`:
```diff
-              <Switch checked={m.activa} onCheckedChange={(v) => toggle(m.id, v)} />
+              <Switch checked={m.activa} onCheckedChange={(v) => toggle(m.id, v)} aria-label={m.activa ? `Desactivar motivo ${m.nombre}` : `Activar motivo ${m.nombre}`} />
```

`src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx`:
```diff
-      <TableCell><Switch checked={draft.activo} onCheckedChange={(v) => p({ activo: v })} /></TableCell>
+      <TableCell><Switch checked={draft.activo} onCheckedChange={(v) => p({ activo: v })} aria-label="Producto activo" /></TableCell>
```

- **Tras aplicar, verificar:** recorrer las tablas de Configuración/Admin/CRM con Tab + lector de pantalla: cada switch anuncia "Activar naviera Maersk Line", "Etapa Negociación activa", etc. Los toggles siguen funcionando igual (sólo se agregó un atributo).

---

### [UX-08] `<Label>` con clases extra (`text-xs`) contra la regla del DS
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** 140 hits en 54 archivos. Peores: `src/features/cliente/components/DialogContacto.tsx` (9), `src/features/cotizacion/components/conceptos/ConceptoRowMXN.tsx` (8) y `ConceptoRowUSD.tsx` (7), `src/features/embarques/components/contenedores/FilaContenedor.tsx` (6), `src/features/compras/routes/ComprasPagos.tsx` (5).
- **Problema:** design-system.md §6 prohíbe `className` en `Label` ("Etiquetas: componente `<Label>` sin clases extra"). Los overrides `text-xs` generan tamaños de etiqueta inconsistentes entre formularios. Caso legítimo detectado: "micro-label" en filas de tablas editables (ConceptoRow*, FilaContenedor).
- **Fix (instrucción para Lovable):** dos pasos.
  1. Declarar la variante en el primitivo: `src/components/ui/label.tsx` ya usa `cva` — agregar variante `size: { default, xs }` donde `xs` aplica `text-xs` (para micro-labels de filas editables).
  2. Migrar los 140 usos: los labels de formulario normal → `<Label>` sin clases (borrar `className="text-xs"`); los micro-labels de filas editables → `<Label size="xs">`. Empezar por los 5 archivos peores listados.
- **Diff / código:**

`src/components/ui/label.tsx`:
```diff
-const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");
+const labelVariants = cva("font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", {
+  variants: {
+    size: {
+      default: "text-sm",
+      /** Micro-label para filas de tablas editables (ConceptoRow*, FilaContenedor). */
+      xs: "text-xs",
+    },
+  },
+  defaultVariants: { size: "default" },
+});
 
-const Label = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants> & { ref?: React.Ref<React.ElementRef<typeof LabelPrimitive.Root>> }) => (
-  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
+const Label = ({ ref, className, size, ...props }: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants> & { ref?: React.Ref<React.ElementRef<typeof LabelPrimitive.Root>> }) => (
+  <LabelPrimitive.Root ref={ref} className={cn(labelVariants({ size }), className)} {...props} />
 );
```

Migración — ejemplo real en `src/features/cliente/components/DialogContacto.tsx` (labels de formulario: quitar la clase):
```diff
-          <Label className="text-xs">Nombre<span className="text-destructive ml-0.5">*</span></Label>
+          <Label>Nombre<span className="text-destructive ml-0.5">*</span></Label>
```
y en filas editables (`ConceptoRowMXN.tsx`, `ConceptoRowUSD.tsx`, `FilaContenedor.tsx`):
```diff
-        <Label className="text-xs">…</Label>
+        <Label size="xs">…</Label>
```

- **Tras aplicar, verificar:** `grep -rn '<Label className="text-xs"' src` tiende a 0; los formularios muestran etiquetas uniformes a `text-sm`; las filas de conceptos/contenedores conservan el micro-label vía variante. No debe haber cambio visual fuera de las etiquetas que se normalizan a 14px.

---

### [UX-09] Cifras KPI sin el token `text-kpi`
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/bandejas/routes/_sections/CarteraKpis.tsx` (44, 49, 56 — `text-2xl`), `src/features/dashboard/direccion/components/HeroCards.tsx` (33, 42, 50 — `text-3xl`), `src/features/operaciones/routes/Operaciones.tsx` (109-117 — `text-xl`), `src/features/embarques/components/TabPnl.tsx` (127, 135 — `text-xl`).
- **Problema:** el DS define el token `text-kpi` (clamp 18→24px, peso 600, verificado en `tailwind.config.ts:49`) exactamente para cifras de KPI; estos archivos usan tamaños fijos ad-hoc (`text-xl/2xl/3xl`) → KPIs de distinto tamaño entre pantallas y sin ajuste responsivo.
- **Fix (instrucción para Lovable):** reemplazo mecánico en los 4 archivos: la clase de tamaño (`text-xl`/`text-2xl`/`text-3xl`) → `text-kpi` en los contenedores de la cifra, conservando `font-semibold`/`font-bold` y el resto de clases (`tabular-nums`, tonos). `text-kpi` ya incluye peso 600, así que `font-semibold` puede omitirse donde esté; conservarlo es inocuo.
- **Diff / código:** diffs reales:

`src/features/bandejas/routes/_sections/CarteraKpis.tsx`:
```diff
-        <CardContent className="text-2xl font-semibold">{p.totalFacturas}</CardContent>
+        <CardContent className="text-kpi">{p.totalFacturas}</CardContent>
@@
-          <div className="text-2xl font-semibold tabular-nums">{formatNativos(p.saldosNativos)}</div>
+          <div className="text-kpi tabular-nums">{formatNativos(p.saldosNativos)}</div>
@@
-          <div className="text-2xl font-semibold text-destructive tabular-nums">
+          <div className="text-kpi text-destructive tabular-nums">
```

`src/features/dashboard/direccion/components/HeroCards.tsx`:
```diff
-        <p className="mt-2 text-3xl font-semibold tabular-nums">{fmt(hero.utilidad_mxn)}</p>
+        <p className="mt-2 text-kpi tabular-nums">{fmt(hero.utilidad_mxn)}</p>
@@
-        <p className="mt-2 text-3xl font-semibold tabular-nums text-destructive">{fmt(hero.cartera_vencida_mxn)}</p>
+        <p className="mt-2 text-kpi tabular-nums text-destructive">{fmt(hero.cartera_vencida_mxn)}</p>
@@
-        <p className="mt-2 text-3xl font-semibold tabular-nums">{fmt(hero.facturado_mes_mxn)}</p>
+        <p className="mt-2 text-kpi tabular-nums">{fmt(hero.facturado_mes_mxn)}</p>
```

`src/features/operaciones/routes/Operaciones.tsx`:
```diff
-              <p className="text-xl font-bold text-kpi-info">{creadasEsteMes}</p>
+              <p className="text-kpi text-kpi-info">{creadasEsteMes}</p>
@@
-              <p className="text-xl font-bold text-kpi-success">{llegadasEsteMes}</p>
+              <p className="text-kpi text-kpi-success">{llegadasEsteMes}</p>
@@
-              <p className="text-xl font-bold text-primary-foreground">{global.activasHoy}</p>
+              <p className="text-kpi text-primary-foreground">{global.activasHoy}</p>
```

`src/features/embarques/components/TabPnl.tsx`:
```diff
-            <div className="text-xl font-semibold">{fmtPnl(data.venta.pdte_cobro_mxn)}</div>
+            <div className="text-kpi">{fmtPnl(data.venta.pdte_cobro_mxn)}</div>
@@
-            <div className="text-xl font-semibold">{fmtPnl(data.costo.pdte_pago_mxn)}</div>
+            <div className="text-kpi">{fmtPnl(data.costo.pdte_pago_mxn)}</div>
```

- **Tras aplicar, verificar:** comparar Dashboard Dirección, Cartera, Operaciones y P&L de embarque: las cifras KPI usan la misma escala (18px en móvil → 24px en escritorio). No hay otro cambio visual.

---

### [UX-10] Montos con `.toFixed()` sin separador de miles en mensajes visibles
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/cxp/services/pagoProveedorValidaciones.ts` (182, 190), `src/features/cxp/hooks/useNuevaFacturaProveedorForm.guard.ts` (40), `src/features/dashboardEjecutivo/services/alertas.ts` (33, 48, 63), `src/features/cxp/components/ConciliacionPagoCell.tsx` (50 — fecha `dd/MM/yy`).
- **Problema:** mensajes visibles al usuario muestran montos crudos tipo "difere del total en 12345.6 MXN" sin separador de miles, y una fecha con año de 2 dígitos (el resto de la app usa `dd/MM/yyyy`, DS §3).
- **Fix (instrucción para Lovable):** usar `formatCurrency` / `formatNumber` de `@/lib/formatters` (importables en services y hooks; son funciones puras). Regla: montos → `formatCurrency(valor, moneda)` (devuelve "MXN 12,345.60"); números con decimales sin moneda → `formatNumber(v, { decimals: 2 })`; porcentajes de tasas → conservar `toFixed(2)` (no es monto). Fecha → `dd/MM/yyyy`.
- **Diff / código:** diffs reales:

`src/features/cxp/services/pagoProveedorValidaciones.ts`:
```diff
+import { formatCurrency } from "@/lib/formatters";
@@
   if (descuadre !== 0) {
     avisos.push(
-      `Los totales de la factura no cuadran: subtotal + IVA + IEPS − retenciones difiere del total en ${descuadre.toFixed(2)} ${f.moneda}. Revisa la captura antes de pagar.`,
+      `Los totales de la factura no cuadran: subtotal + IVA + IEPS − retenciones difiere del total en ${formatCurrency(descuadre, f.moneda)}. Revisa la captura antes de pagar.`,
     );
   }
```
(La línea 190, `tasa.toFixed(2)}%`, es un porcentaje: **conservarla como está**.)

`src/features/cxp/hooks/useNuevaFacturaProveedorForm.guard.ts`:
```diff
+import { formatCurrency } from "@/lib/formatters";
@@
-      description: `Suma de conceptos ${cuadreManual.suma.toFixed(2)} vs subtotal ${subtotal.toFixed(2)}. Ajusta la diferencia (tolerancia 0.01).`,
+      description: `Suma de conceptos ${formatCurrency(cuadreManual.suma, moneda)} vs subtotal ${formatCurrency(subtotal, moneda)}. Ajusta la diferencia (tolerancia 0.01).`,
```
(`moneda` ya existe en el contexto del form; si el guard no la recibe, usar `"MXN"` como default igual que el resto del flujo.)

`src/features/dashboardEjecutivo/services/alertas.ts`:
```diff
+import { formatCurrency } from "@/lib/formatters";
@@
-      descripcion: `Semana ${primera.semana_iso}: saldo estimado ${primera.saldo_proyectado_mxn.toFixed(0)} MXN`,
+      descripcion: `Semana ${primera.semana_iso}: saldo estimado ${formatCurrency(primera.saldo_proyectado_mxn, "MXN")}`,
@@
-        ? `Top: ${top.nombre} (${top.saldo.toFixed(0)} ${top.moneda})`
+        ? `Top: ${top.nombre} (${formatCurrency(top.saldo, top.moneda)})`
@@
-        ? `Top: ${top.nombre} (${top.saldo.toFixed(0)} ${top.moneda})`
+        ? `Top: ${top.nombre} (${formatCurrency(top.saldo, top.moneda)})`
```
(Nota: `formatCurrency` redondea a 2 decimales por defecto; si se prefiere 0 decimales en estas alertas, usar `formatNumber(top.saldo, { decimals: 0, suffix: top.moneda })` — mismo archivo de formatters. Elegir uno y aplicarlo parejo.)

`src/features/cxp/components/ConciliacionPagoCell.tsx`:
```diff
-          <span className="tabular-nums">{format(new Date(movimiento.fecha + "T00:00:00"), "dd/MM/yy")} · {formatCurrency(Number(movimiento.cargo), "MXN")}</span>
+          <span className="tabular-nums">{format(new Date(movimiento.fecha + "T00:00:00"), "dd/MM/yyyy")} · {formatCurrency(Number(movimiento.cargo), "MXN")}</span>
```

- **Tras aplicar, verificar:** capturar una factura de proveedor con descuadre de 12,345.60: el aviso dice "…en MXN 12,345.60". En el dashboard ejecutivo con saldo negativo proyectado, la alerta muestra separador de miles. En conciliación de pagos la fecha del movimiento muestra año completo (p. ej. 04/03/2025). Los tests de `pagoProveedorValidaciones` y `alertas` (existen en `__tests__`) deben actualizarse si asertan el texto exacto.

---

### [UX-11] Spinners de botón reimplementados vs prop `loading`
- **Severidad:** P3 · **Verificación:** estático
- **Archivos (20):** `src/features/cliente/components/DialogContacto.tsx` (63-64), `DialogEditarCliente.tsx`, `src/features/auth/components/LoginForm.tsx` (109), `SignupForm.tsx`, `src/features/crm/components/ImportarLeadsCsvDialog.tsx`, `src/features/cxp/components/CargaCfdiSection.tsx`, `src/components/shared/dialogs/CambiarPasswordDialog.tsx`, y el resto del conjunto (buscar con `grep -rln 'isPending && <Loader2\|isSaving && <Loader2\|loading && <Loader2\|isSubmitting && <Loader2' src`).
- **Problema:** DS §7 prohíbe reimplementar el Loader2 en botones. `ui/button.tsx` ya expone la prop `loading` (spinner + `disabled` + `aria-busy` automáticos, verificado en líneas 57-88) y ya se usa en ~40 sitios — adopción parcial.
- **Fix (instrucción para Lovable):** migración mecánica por archivo: reemplazar `{isX && <Loader2 className="h-4 w-4 animate-spin …" />}` dentro de un `<Button>` por la prop `loading={isX}` en ese `Button`, y quitar el `disabled={isX}` redundante (Button deshabilita solo cuando `loading`); conservar `disabled` si combina otras condiciones (`disabled={!form.nombre.trim()}`). Eliminar el import de `Loader2` si queda sin uso.
- **Diff / código:** diffs reales:

`src/features/cliente/components/DialogContacto.tsx`:
```diff
-          <Button onClick={handleSubmit} disabled={!form.nombre.trim() || isSaving}>
-            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
-            {contacto ? 'Guardar Cambios' : 'Agregar'}
-          </Button>
+          <Button onClick={handleSubmit} loading={isSaving} disabled={!form.nombre.trim()}>
+            {contacto ? 'Guardar Cambios' : 'Agregar'}
+          </Button>
```
(y quitar `Loader2` del import de `lucide-react` en la línea 2).

`src/features/auth/components/LoginForm.tsx` (línea 109):
```diff
-        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
```
→ mover `loading={loading}` al `<Button type="submit">` correspondiente y borrar la línea del Loader2 (y el import si queda huérfano).

- **Tras aplicar, verificar:** en login, alta de contacto y los demás formularios migrados: al enviar, el botón muestra spinner, queda deshabilitado y expone `aria-busy="true"`; no hay doble spinner ni layout shift. `grep -rn 'Loader2' <archivos migrados>` no muestra usos dentro de `<Button>`.

---

### [UX-12] Componentes duplicados entre CxP y Facturación
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/features/cxp/components/DialogPagoLoteRenglones.tsx` vs `src/features/facturacion/components/DialogCobroLoteRenglones.tsx` (87% idénticos, diff verificado). Badges `text-[10px]`: líneas 63/66 (CxP), 60/63 (Facturación) y `src/features/embarques/components/entrantes/ConceptosSugeridosEntrante.tsx` (57).
- **Problema:** dos tablas de reparto en lote casi idénticas que ya empezaron a divergir (una usa `folio_proveedor` + `toTitleCase`, la otra `numero`); ambas con encabezados `text-xs` y badges con tamaño arbitrario `text-[10px]` (el token `text-2xs` existe en `tailwind.config.ts:52`).
- **Fix (instrucción para Lovable):**
  1. **Quick win (release, obligatorio):** `text-[10px]` → `text-2xs` en los 5 badges (3 archivos).
  2. **Extracción (mismo PR o inmediato después):** crear `src/components/shared/LoteRenglonesTable.tsx` parametrizado por `facturas`, `renglones`, `moneda`, `onMontoChange` y un accesor de folio (`getFolio: (f) => string`, así CxP pasa `f.folio_proveedor` y Facturación `f.numero`) — el cuerpo de la tabla (thead/tbody/zebra/badges/input de importe) vive una sola vez. Los dos diálogos pasan a ser wrappers delgados tipados con sus tipos propios (`FacturaLoteCandidata`/`RenglonLote` vs `FacturaCobroCandidata`/`RenglonCobro`), como ya hace `ConfirmDeleteAlert` sobre `ConfirmActionDialog`. Encabezados con `text-table-head` vía `DetailTableHead` o el token equivalente.
- **Diff / código:**

Quick win — `src/features/cxp/components/DialogPagoLoteRenglones.tsx` (idéntico en `DialogCobroLoteRenglones.tsx:60,63`):
```diff
-                      <Badge variant="outline" className="text-[10px]">Liquidada</Badge>
+                      <Badge variant="outline" className="text-2xs">Liquidada</Badge>
@@
-                      <Badge variant="secondary" className="text-[10px]">Parcial</Badge>
+                      <Badge variant="secondary" className="text-2xs">Parcial</Badge>
```

`src/features/embarques/components/entrantes/ConceptosSugeridosEntrante.tsx`:
```diff
-            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">ya facturado</Badge>
+            <Badge variant="secondary" className="h-4 px-1.5 text-2xs">ya facturado</Badge>
```

Extracción — esqueleto del componente compartido (nuevo archivo `src/components/shared/LoteRenglonesTable.tsx`), derivado del diff real de ambos (las únicas diferencias son el accesor de folio y los tipos):
```tsx
interface LoteRenglonesTableProps<F, R> {
  facturas: F[];
  renglones: R[];
  moneda: string;
  getFolio: (f: F) => string;
  getFacturaId: (r: R) => string;
  getMonto: (r: R) => number;
  onMontoChange: (facturaId: string, monto: number) => void;
}

export function LoteRenglonesTable<F, R>({ getFolio, ... }: LoteRenglonesTableProps<F, R>) {
  // Cuerpo único: <thead> con encabezados, zebra, badges "Liquidada"/"Parcial"
  // (text-2xs), <Input> de importe alineado a la derecha con
  // aria-label={`Importe aplicado a la factura ${getFolio(f)}`}.
}
```
y los wrappers:
```tsx
// DialogPagoLoteRenglones.tsx
<LoteRenglonesTable facturas={facturas} renglones={renglones} moneda={moneda}
  getFolio={(f) => toTitleCase(f.folio_proveedor ?? "") || "—"} … />
// DialogCobroLoteRenglones.tsx
<LoteRenglonesTable facturas={facturas} renglones={renglones} moneda={moneda}
  getFolio={(f) => f.numero ?? "—"} … />
```

- **Tras aplicar, verificar:** abrir "Pago en lote" (CxP) y "Cobro en lote" (Facturación): ambas tablas se ven idénticas (zebra, badges 10px vía token, encabezados con tipografía del DS), el reparto de importes sigue funcionando en ambos flujos y los tests de los servicios `pagoProveedorLote`/`pagoClienteLote` no se tocan (la extracción es sólo de vista).

---

### [UX-13] Grids fijos de 2+ columnas sin breakpoint en formularios
- **Severidad:** P3 · **Verificación:** estático
- **Archivos (62 clases en ~40 archivos; formularios primero):** `src/features/cliente/components/DialogContacto.tsx` (69), `src/features/crm/components/NuevaActividadDialog.tsx`, `src/features/proveedor/components/DireccionFiscalFields.tsx`, `src/features/costeo/components/TarifaFormFields.tsx`, `NuevaTarifaDemoraDialog.tsx`, `NavieraCondicionForm.tsx`, `CosteoAgenteFormDialog.tsx`, `BuscarTarifaDialog.tsx`, etc. (lista completa: `grep -rln 'grid grid-cols-2' src/features`).
- **Problema:** `grid grid-cols-2` (sin `sm:`/`md:`) en diálogos de formulario deja los campos a mitad de ancho en móvil — en `DialogContacto` son 9 campos ilegibles en pantalla angosta. El componente `FormDialogSection` ya resuelve 1col móvil / 2col desktop (`grid-cols-1 md:grid-cols-2`, verificado) y estos formularios lo esquivan.
- **Fix (instrucción para Lovable):** en diálogos de formulario, migrar el contenedor a `<FormDialogSection>` cuando haya título de sección, o como mínimo cambiar la clase a `grid grid-cols-1 sm:grid-cols-2` (y los `col-span-2` internos a `sm:col-span-2`). No tocar grids de dashboards/KPIs que no son formularios (p. ej. `TarifasKpis.tsx`, `ClienteSummaryCards.tsx`) salvo que se vean rotos en móvil.
- **Diff / código:** ejemplo real en `src/features/cliente/components/DialogContacto.tsx`:

```diff
-      <div className="grid grid-cols-2 gap-4">
-        <div className="col-span-2">
+      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
+        <div className="sm:col-span-2">
           <Label className="text-xs">Nombre<span className="text-destructive ml-0.5">*</span></Label>
           <Input value={form.nombre} onChange={e => handleChange('nombre', e.target.value)} className="mt-1" />
         </div>
@@
-        <div className="col-span-2"><Label className="text-xs">Dirección</Label><Input value={form.direccion} onChange={e => handleChange('direccion', e.target.value)} className="mt-1" /></div>
+        <div className="sm:col-span-2"><Label className="text-xs">Dirección</Label><Input value={form.direccion} onChange={e => handleChange('direccion', e.target.value)} className="mt-1" /></div>
```
(Aplicar el mismo cambio en `NuevaActividadDialog.tsx`, `DireccionFiscalFields.tsx`, `TarifaFormFields.tsx` y el resto de diálogos de formulario. Donde el grid tenga encabezado de sección, preferir `<FormDialogSection title="…">` que ya trae el grid responsivo.)

- **Tras aplicar, verificar:** abrir los diálogos migrados con viewport de 375px: los campos ocupan una columna a ancho completo; a ≥640px vuelven a 2 columnas. No hay overflow horizontal ni campos a medio ancho.

---

### [UX-14] Ruta pública `/logo-preview` con hex hardcodeados
- **Severidad:** P3 · **Verificación:** estático
- **Archivos:** `src/routes/publicRoutes.tsx` (línea 35), `src/features/marketing/routes/LogoPreview.tsx` (9 hex + 3 `text-white`, verificado — único archivo servido que viola la regla #1 del DS).
- **Problema:** herramienta interna de QA de logo expuesta sin autenticación (indexable/visible públicamente) y con colores hex hardcodeados (`#0B1B3A`, `#2563EB`, `bg-white`, `text-white`) en vez de tokens.
- **Fix (instrucción para Lovable):** opción A (recomendada, mínimo dif): servir la ruta sólo en desarrollo — envolver la entrada de ruta con `import.meta.env.DEV`. Opción B: mover la ruta detrás del bloque autenticado de admin. Los hex del archivo pueden quedar mientras la ruta no se sirva en producción (son fondos de prueba deliberados); si se prefiere limpieza total, mapear los fondos a tokens (`bg-background`, `bg-muted`, `bg-primary`, `text-primary-foreground`) en el mismo archivo.
- **Diff / código:** `src/routes/publicRoutes.tsx`:

```diff
-    <Route path="/logo-preview" element={<LogoPreview />} />
+    {/* QA interno del logo (UX-14): sólo en desarrollo, nunca en build público. */}
+    {import.meta.env.DEV && <Route path="/logo-preview" element={<LogoPreview />} />}
```
(El `import` de `LogoPreview` puede conservarse — ya está code-spliteado por lazy si aplica; si el import es estático, envolverlo con `React.lazy` no es necesario porque la rama no se registra en producción. Verificar que `LogoPreview` siga importado sólo desde aquí.)

Opción B (si se quiere conservar en producción para el equipo): mover la línea al grupo de rutas protegidas de admin en el archivo de rutas correspondiente y borrarla de `publicRoutes.tsx`.

- **Tras aplicar, verificar:** en build de producción (`bun run build` + preview), `/logo-preview` cae en el catch-all 404 (`publicRoutes.tsx:44`); en `bun run dev` la ruta sigue funcionando. Confirmar además que el archivo no es alcanzable desde el sitemap/robots.

---

## Extra verificado durante la elaboración del pack (fuera de la lista UX-01..14)

### [UX-EXT] DemoModeBanner dice "modo demo como administrador" a cualquier rol
- **Severidad:** P3 · **Verificación:** estático (detectado al verificar patrones del pack; no está en el reporte 04).
- **Archivos:** `src/features/marketing/components/DemoModeBanner.tsx` (línea 19), `src/features/marketing/hooks/useIsDemoUser.ts`, `src/lib/contexts/AuthContext.tsx` (expone `role: AppRole | null`, línea 19).
- **Problema:** el banner global de la org demo afirma "Estás en **modo demo** como administrador" aunque el usuario demo tenga rol `viewer`, `operador`, `contador`, etc. — texto incorrecto para cualquier rol no admin.
- **Fix (instrucción para Lovable):** hacer el sufijo condicional al rol real. `AppRole` (enum verificado en `src/integrations/supabase/types.ts:9933`) incluye `admin`, `admin_org` y `super_admin` como roles administrativos.
- **Diff / código:** `src/features/marketing/components/DemoModeBanner.tsx`:
```diff
 import { Sparkles } from "lucide-react";
 import { useIsDemoUser } from "@/features/marketing/hooks/useIsDemoUser";
+import { useAuth } from "@/lib/contexts/AuthContext";
 
 export function DemoModeBanner() {
   const isDemo = useIsDemoUser();
+  const { role } = useAuth();
+  const esAdmin = role === "admin" || role === "admin_org" || role === "super_admin";
   if (!isDemo) return null;
@@
       <span>
-        Estás en <strong>modo demo</strong> como administrador · datos de ejemplo, se reinician en cada acceso.
+        Estás en <strong>modo demo</strong>{esAdmin ? " como administrador" : ""} · datos de ejemplo, se reinician en cada acceso.
       </span>
```
- **Tras aplicar, verificar:** entrar a la org demo con un usuario admin (banner dice "como administrador") y con un usuario viewer/operador (banner sin el sufijo). Usuarios fuera de la org demo no ven el banner.

---

## Checklist global de validación del pack

1. **14/14 hallazgos cubiertos:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12, UX-13, UX-14 (+1 extra verificado).
2. Compilar: `bun run build` (o `tsc --noEmit`) sin errores tras cada lote.
3. Tests de arquitectura: `bun run test src/__tests__/architecture/` (incluye el guardrail extendido de UX-03).
4. Tests de formatters/validaciones afectados por UX-10: actualizar aserciones de texto exacto si fallan.
5. Lint: `bun run lint` sin nuevas violaciones (en particular las reglas `no-raw-table` y las de design tokens).
6. Recorrido manual mínimo: Configuración (deletes con doble confirmación), Portal cliente perfil (retry), login (spinner en botón), dashboard dirección (KPIs), un formulario de wizard (labels asociados).

## Divergencias y notas respecto al reporte original

- **UX-02:** el reporte sugiere "título fijo + error en opts". El pack lo refina: el helper central ya existe (`getErrorMessage` + `translatePostgresError` con mapeo 23503/23505/23514/42501/RLS en `src/lib/errors/`), así que el fix es título fijo + `description: getErrorMessage(error)` — sin crear ningún `friendlyDbError()` nuevo.
- **UX-03:** el conteo real de archivos con JSX `<table>` es 39 (incluye infraestructura y pdf); el reporte dice 36. La allowlist del guardrail extendido debe generarse con `grep -rln "<table" src --include=*.tsx`.
- **UX-06/UX-01 solapamiento:** en `CatalogoClavesSATCard.tsx:108` el botón de borrar recibe tanto `aria-label` (UX-06) como el confirmador (UX-01); aplicar ambos diffs de forma acumulativa.
- **UX-10:** la línea 190 de `pagoProveedorValidaciones.ts` (`tasa.toFixed(2)}%`) es un porcentaje, no un monto — se conserva.
- **UX-12:** la extracción a `LoteRenglonesTable` es la recomendación del reporte; el quick win `text-[10px]` → `text-2xs` es independiente y puede aplicarse primero.
- **UX-14:** el comentario del propio archivo dice "no indexable", pero la ruta es pública y servida; el pack opta por `import.meta.env.DEV` (opción menos invasiva que moverla al bloque auth).
- **Extra:** se agregó UX-EXT (DemoModeBanner) por verificación directa del patrón indicado; no aparece en el reporte 04.


# Línea UIA — UI interna (dinámica)

# Fix pack — UI dinámica interna (UIA-01 … UIA-17) — Elogistix v13.523.1

Fuente: `audit_reports/07_ui_dinamica_interna.md`. Repo: `main @ 1ef05ce9` (frontend `src/`).
Todas las rutas citadas fueron leídas y verificadas contra el repo real. Diffs con contexto real; donde el fix es compartido con otro pack se indica la referencia cruzada y sólo se desarrolla el delta propio. Contexto de bajo riesgo (feature freeze): cambios acotados a UI/validación, sin tocar contratos de BD salvo verificación de despliegue (UIA-07).

---

### [UIA-01] "Registrar pago" cross-moneda permite enviar con TC 0
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (factura MXN → pago USD → "Equivalente: MXN 0.00 (TC: 0.0000)", botón habilitado)
- **Archivos:** `src/features/facturacion/components/DialogRegistrarPago.tsx`, `src/features/facturacion/components/DialogRegistrarPagoParts.tsx`
- **Problema:** Con `exchange-rates` caído (501), `convertirAMonedaFactura` devuelve 0 (FIX C6 deliberado), pero `invalido = montoNum <= 0 || excede` no contempla el caso → el submit queda habilitado con `tipoCambio = 0` y el equivalente en gris tenue. El error llegaría crudo del servidor (23514) tras disparar timbrado REP.
- **Fix (instrucción para Lovable):** Fix principal compartido con FE-01, ver `fixes_FE.md` (bloqueo de submit sin TC + captura manual de TC como CxP). Delta propio de este pack: (1) añadir la guarda `crossSinTc` a `invalido`; (2) elevar el aviso de "Equivalente… TC 0.0000" de texto gris a alerta ámbar explícita.
- **Diff / código:**

`DialogRegistrarPago.tsx` — ANTES:
```ts
const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
const excede = montoAplicado > saldo + 0.01;
const invalido = montoNum <= 0 || excede;
const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;
```
DESPUÉS:
```ts
const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
const excede = montoAplicado > saldo + 0.01;
const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;
// UIA-01: cross-moneda SIN TC confiable (rates caídos) → bloquear el submit
// hasta que FE-01 habilite la captura manual del TC.
const crossSinTc = values.moneda !== factura.moneda && montoNum > 0 && tipoCambio <= 0;
const invalido = montoNum <= 0 || excede || crossSinTc;
```
`DialogRegistrarPagoParts.tsx` (`NotasPago`) — ANTES:
```tsx
{mostrarConversion && (
  <p className="text-xs text-muted-foreground">
    Equivalente: {formatCurrency(montoAplicado, monedaFactura)} (TC: {tipoCambio.toFixed(4)})
  </p>
)}
```
DESPUÉS:
```tsx
{mostrarConversion && tipoCambio > 0 && (
  <p className="text-xs text-muted-foreground">
    Equivalente: {formatCurrency(montoAplicado, monedaFactura)} (TC: {tipoCambio.toFixed(4)})
  </p>
)}
{mostrarConversion && tipoCambio <= 0 && (
  <Alert className="border-warning/40 bg-warning/5">
    <AlertDescription className="text-xs">
      No hay tipo de cambio {monedaPago}→{monedaFactura} disponible. No se puede
      registrar el cobro hasta capturar un TC válido (o reintentar cuando vuelva el servicio).
    </AlertDescription>
  </Alert>
)}
```
- **Tras aplicar, verificar:** con `exchange-rates` apagado, abrir factura MXN → Registrar pago → Moneda=USD: botón deshabilitado y alerta ámbar visible. Con TC disponible, el equivalente y el submit funcionan igual que antes. Factura PPD timbrada sigue disparando REP sólo tras guardar.

---

### [UIA-02] Traspaso cross-moneda con TC default 1 y preview 1:1 silencioso
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (MXN→USD, campo TC precargado con 1, preview "USD 1,000.00", postea como "Conciliada")
- **Archivos:** `src/features/tesoreria/hooks/useTraspasoForm.ts`, `src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx`
- **Problema:** `tipoCambio: 1` hardcodeado en el estado inicial y en el reset (`useTraspasoForm.ts` líneas 30 y 43); el preview usa `state.tipoCambio || 1` (línea 61), así que aunque el usuario borre el campo el equivalente se calcula 1:1. La validación `tipoCambio <= 0` ya existe pero nunca se dispara porque el default es 1. Coordinar con BL-04 (guarda server-side: rechazar traspasos cross-moneda sin TC explícito).
- **Fix (instrucción para Lovable):** TC vacío (0) por defecto en cross-moneda → la validación existente bloquea el submit hasta captura explícita. Preview sólo cuando hay TC capturado y marcado como "estimado". Opcional: prefijar como sugerencia el último TC DOF (`useExchangeRates`) sin habilitar el submit por sí solo.
- **Diff / código:**

`useTraspasoForm.ts` — ANTES (estado inicial y reset del `useEffect`):
```ts
    montoOrigen: 0,
    tipoCambio: 1,
    comision: 0,
```
DESPUÉS (ambos bloques):
```ts
    montoOrigen: 0,
    // UIA-02: 0 = "sin capturar". Antes el default 1 posteaba conversiones 1:1
    // silenciosas entre monedas distintas.
    tipoCambio: 0,
    comision: 0,
```
ANTES (`montoDestino`):
```ts
    if (mismoMoneda) return state.montoOrigen;
    return state.montoOrigen * (state.tipoCambio || 1);
```
DESPUÉS:
```ts
    if (mismoMoneda) return state.montoOrigen;
    if (!state.tipoCambio || state.tipoCambio <= 0) return 0;
    return state.montoOrigen * state.tipoCambio;
```
`DialogTraspasoCuentas.tsx` — ANTES (preview):
```tsx
            <p className="text-xs text-muted-foreground">
              {origen.moneda} → {destino.moneda}: {formatCurrency(montoDestino, destino.moneda)}
            </p>
```
DESPUÉS:
```tsx
            <p className="text-xs text-muted-foreground">
              {state.tipoCambio > 0
                ? `Estimado con el TC capturado: ${origen.moneda} → ${destino.moneda}: ${formatCurrency(montoDestino, destino.moneda)}`
                : `Captura el tipo de cambio para ver el equivalente en ${destino.moneda}.`}
            </p>
```
- **Tras aplicar, verificar:** abrir Traspaso con cuentas MXN/USD → campo TC vacío, botón "Registrar traspaso" deshabilitado con el mensaje "Captura el tipo de cambio para cuentas de distinta moneda."; capturar TC → preview marcado "Estimado…"; traspaso misma moneda no pide TC. Verificar además el convenio de dirección del TC (multiplica vs. divide) con un monto conocido, y que BL-04 rechaza el POST sin TC aunque se fuerce la UI.

---

### [UIA-03] KPIs suman USD como MXN (1:1) sin TC
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO ("Por cobrar 30 días MXN 17,400.00" = 11,600+5,800 a 1:1; Facturación "Saldo por cobrar MXN 11.6K" omite la USD)
- **Archivos:** `src/features/tesoreria/domain/resumen.ts`, `src/features/tesoreria/domain/resumen.types.ts`, `src/features/tesoreria/routes/_sections/TesoreriaKpis.tsx`, `src/features/facturacion/components/DashboardEjecutivoFacturacion.tsx`
- **Problema:** En `resumen.ts` línea 51: `const tc = … ? args.tipoCambioUsd : 1;` — cuando `useExchangeRates` no trae TC (501), el fallback es **1** y `por_cobrar_total_mxn = mxn + usd*1`. Además `sumarVencidas` suma USD×1. En Facturación, `cobranzaAggregates.calcularKPIs` ya separa `total_mxn`/`total_usd`, pero el dashboard sólo muestra `_mxn` y la porción USD desaparece sin aviso. La misma pantalla de Tesorería sí excluye USD del saldo bancario con aviso (Q-06): criterio inconsistente.
- **Fix (instrucción para Lovable):** Regla única "sin TC confiable → excluir y avisar" (patrón Q-06 de `sumarSaldosCuentas`): (1) en `resumen.ts` el fallback pasa de 1 a 0 + flag `flujo_incompleto`; (2) `TesoreriaKpis` muestra hint cuando el flag está activo; (3) el dashboard de Facturación muestra la porción USD como sublabel en vez de omitirla.
- **Diff / código:**

`resumen.ts` — ANTES:
```ts
  const tc = args.tipoCambioUsd && args.tipoCambioUsd > 0 ? args.tipoCambioUsd : 1;

  const flujo = calcularFlujo(args.cobranza, args.cxp, enVentana, tc);
```
DESPUÉS:
```ts
  // UIA-03: sin TC confiable NO se asume 1:1 — la porción en USD queda excluida
  // de los totales MXN y se reporta vía `flujo_incompleto` (patrón Q-06).
  const tcConfiable = typeof args.tipoCambioUsd === "number" && args.tipoCambioUsd > 1;
  const tc = tcConfiable ? args.tipoCambioUsd : 0;

  const flujo = calcularFlujo(args.cobranza, args.cxp, enVentana, tc);
  flujo.flujo_incompleto =
    !tcConfiable && (flujo.por_cobrar_usd > 0 || flujo.por_pagar_usd > 0);
```
`resumen.types.ts` (`FlujoMes`) — ANTES:
```ts
  por_cobrar_total_mxn: number;
  por_pagar_total_mxn: number;
}
```
DESPUÉS:
```ts
  por_cobrar_total_mxn: number;
  por_pagar_total_mxn: number;
  /** UIA-03: `true` cuando hay saldos USD excluidos del total por falta de TC. */
  flujo_incompleto: boolean;
}
```
(inicializar `flujo_incompleto: false` en el objeto literal de `calcularFlujo`, junto a `por_cobrar_total_mxn: 0`).
`TesoreriaKpis.tsx` — ANTES:
```tsx
      <KpiCard
        label="Por cobrar 30 días"
        value={formatCurrency(data.flujo.por_cobrar_total_mxn, "MXN")}
```
DESPUÉS:
```tsx
      <KpiCard
        label="Por cobrar 30 días"
        value={formatCurrency(data.flujo.por_cobrar_total_mxn, "MXN")}
        hint={
          data.flujo.flujo_incompleto
            ? "Excluye saldos en USD sin tipo de cambio confiable."
            : undefined
        }
```
(mismo `hint` en "Por pagar 30 días"). `DashboardEjecutivoFacturacion.tsx` — ANTES:
```tsx
        <KpiCard
          label="Saldo por cobrar"
          value={formatCurrencyCompact(porCobrar, "MXN")}
          valueTooltip="Saldo total pendiente de cobro de todas las facturas vivas (no sólo del mes en curso). Es el mismo universo de la pestaña 'Por cobrar'."
        />
```
DESPUÉS:
```tsx
        <KpiCard
          label="Saldo por cobrar"
          value={formatCurrencyCompact(porCobrar, "MXN")}
          sublabel={cob.total_usd > 0 ? `+ ${formatCurrencyCompact(cob.total_usd, "USD")} en USD` : undefined}
          valueTooltip="Saldo total pendiente de cobro de todas las facturas vivas (no sólo del mes en curso). Las facturas en USD se muestran aparte para no mezclar monedas sin tipo de cambio."
        />
```
(análogo en "Vencido" con `cob.vencido_usd`).
- **Tras aplicar, verificar:** con exchange-rates caído y facturas MXN 11,600 + USD 5,800: Tesorería muestra "Por cobrar 30 días MXN 11,600.00" con hint de exclusión (no 17,400); "Total vencido" deja de mezclar; Facturación muestra "MXN 11.6K" + sublabel "+ USD 5.8K en USD". Con TC disponible todo vuelve a convertirse y sumarse como antes.

---

### [UIA-04] /sin-acceso: mensaje engañoso y callejón sin salida
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (ventas@ con rol y org → URL directa /tesoreria → "no tiene un rol ni una organización asignada", falso; sólo "Ver ayuda"/"Cerrar sesión")
- **Archivos:** `src/features/auth/components/ProtectedRoute.tsx`, `src/features/auth/routes/SinAcceso.tsx`
- **Problema:** `SinAcceso.tsx` tiene un único mensaje hardcodeado para el caso "cuenta sin rol ni organización" (el motivo RG1 original), pero `ProtectedRoute` también aterriza ahí a usuarios con rol válido que intentan un módulo fuera de su permiso (línea 74: `<Navigate to="/sin-acceso" replace />` sin state). El usuario cree que su cuenta está rota y no tiene salida más que cerrar sesión.
- **Fix (instrucción para Lovable):** Pasar el motivo en `location.state` desde `ProtectedRoute` y renderizar en `SinAcceso` mensaje + CTA por causa: "permiso-modulo" → mensaje de permiso con rol actual y botón "Volver al inicio"; "sin-rol-org" → mensaje actual (cuenta pendiente de alta).
- **Diff / código:**

`ProtectedRoute.tsx` — ANTES:
```tsx
  if (sinAcceso) {
    // RG1: antes íbamos a "/" y HomeRoute rebotaba a "/inicio" → bucle infinito.
    return <Navigate to="/sin-acceso" replace />;
  }
```
DESPUÉS:
```tsx
  if (sinAcceso) {
    // RG1: antes íbamos a "/" y HomeRoute rebotaba a "/inicio" → bucle infinito.
    // UIA-04: distinguimos "sin rol/org" de "rol sin permiso para este módulo".
    return (
      <Navigate
        to="/sin-acceso"
        replace
        state={{
          motivo: effectiveRole ? "permiso-modulo" : "sin-rol-org",
          from: location.pathname,
        }}
      />
    );
  }
```
`SinAcceso.tsx` — DESPUÉS (componente completo, reemplaza el cuerpo actual):
```tsx
import { Link, useLocation } from "react-router-dom";
import { ShieldAlert, LogOut, LifeBuoy, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/shared/Seo";
import { signOutCurrentSession } from "@/lib/auth/signOut";
import { useAuth } from "@/lib/contexts/AuthContext";
import { obtenerEtiquetaRol } from "@/features/admin/domain/roles/roleCatalog";

export default function SinAcceso() {
  const { state } = useLocation();
  const { effectiveRole } = useAuth();
  const motivo = (state as { motivo?: string; from?: string } | null)?.motivo ?? "sin-rol-org";
  const from = (state as { from?: string } | null)?.from;
  const esPermisoModulo = motivo === "permiso-modulo" && Boolean(effectiveRole);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Seo
        title="Sin acceso · Libre Carga"
        description="Tu cuenta aún no tiene permisos asignados en Libre Carga."
        ogTitle="Sin acceso · Libre Carga"
        ogDescription="Tu cuenta aún no tiene permisos asignados en Libre Carga."
      />
      <div className="max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sin acceso</h1>
        {esPermisoModulo ? (
          <p className="text-sm text-muted-foreground">
            Tu cuenta está activa con el rol <strong>{obtenerEtiquetaRol(effectiveRole)}</strong>,
            pero ese rol no tiene permiso para entrar a este módulo
            {from ? <> (<code>{from}</code>)</> : null}. Si crees que es un error, pide a un
            administrador que ajuste tus permisos.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tu cuenta está activa, pero todavía no tiene un rol ni una organización
            asignada. Pide a un administrador de tu empresa que te dé de alta para
            poder entrar.
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {esPermisoModulo && (
            <Button asChild>
              <Link to="/inicio">
                <Home className="mr-2 h-4 w-4" aria-hidden /> Volver al inicio
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/ayuda">
              <LifeBuoy className="mr-2 h-4 w-4" aria-hidden /> Ver ayuda
            </Link>
          </Button>
          <Button variant={esPermisoModulo ? "outline" : "default"} onClick={() => void signOutCurrentSession()}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden /> Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
```
- **Tras aplicar, verificar:** login ventas@ → URL directa /tesoreria → mensaje "…rol Vendedor… no tiene permiso para este módulo" con botón "Volver al inicio" que navega a /inicio. Cuenta sin rol/org sigue viendo el mensaje original. La pantalla nunca rebota en bucle.

---

### [UIA-05] Delete de catálogo a un clic y botón ofrecido sin permiso
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (clic en ícono eliminar → DELETE inmediato sin diálogo → toast "No tienes permisos para eliminar puertos.")
- **Archivos:** `src/features/configuracion/components/TabPuertos.tsx` (mismo patrón en los demás tabs de Catálogos — ver UX-01)
- **Problema:** El botón de eliminar llama `eliminarPuerto.mutate(row.original.id)` directo en el `onClick` (sin confirmación), y se renderiza para cualquier usuario con acceso a la pestaña aunque su rol no tenga permiso de borrado: puede crear pero no borrar, y descubre la restricción con un toast de error tras intentarlo.
- **Fix (instrucción para Lovable):** Confirmación compartida con UX-01, ver `fixes_UX.md` (mismo diálogo de confirmación de borrado para todos los catálogos; el repo ya tiene `DeleteConfirmDialog`/`DoubleConfirmDeleteDialog` en `src/components/shared/dialogs/DeleteConfirmDialog.tsx`). Delta propio de este pack: ocultar el botón de eliminar cuando el rol no puede administrar el tenant (`usePermissions().canAdminTenant`), de modo que UI y permisos no diverjan.
- **Diff / código (delta sobre TabPuertos.tsx):**

ANTES (columna eliminar, líneas ~48-54):
```tsx
    {
      id: "eliminar", header: "",
      meta: { headerClassName: "w-12" },
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarPuerto.mutate(row.original.id)} aria-label={`Eliminar puerto ${row.original.name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
```
DESPUÉS:
```tsx
    {
      id: "eliminar", header: "",
      meta: { headerClassName: "w-12" },
      // UIA-05: el botón sólo se ofrece a quien sí tiene permiso de borrado
      // (antes el usuario lo descubría con un toast de error tras el clic).
      cell: ({ row }) =>
        canAdminTenant ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setPendienteEliminar(row.original)} aria-label={`Eliminar puerto ${row.original.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null,
    },
```
y dentro del componente:
```tsx
  const { canAdminTenant } = usePermissions();
  const [pendienteEliminar, setPendienteEliminar] = useState<Puerto | null>(null);
  // …al final del Card:
  <DoubleConfirmDeleteDialog
    open={pendienteEliminar !== null}
    onOpenChange={(o) => { if (!o) setPendienteEliminar(null); }}
    entityName={pendienteEliminar ? `${pendienteEliminar.name} (${pendienteEliminar.code})` : ""}
    description="El puerto dejará de estar disponible en cotizaciones y embarques nuevos."
    onConfirm={() => {
      if (pendienteEliminar) eliminarPuerto.mutate(pendienteEliminar.id);
      setPendienteEliminar(null);
    }}
    isPending={eliminarPuerto.isPending}
  />
```
(imports: `usePermissions` desde `@/hooks/shared`, `DoubleConfirmDeleteDialog` desde `@/components/shared/DoubleConfirmDeleteDialog`. Si UX-01 decide un confirmador de un solo paso, usar el componente acordado ahí — el gate por permiso es independiente.)
- **Tras aplicar, verificar:** usuario con permiso de creación pero no de borrado ya no ve el ícono eliminar; admin sí lo ve y el borrado exige confirmación explícita antes del DELETE; el toast de error por permisos deja de aparecer.

---

### [UIA-06] "Registrar pago" sin validación de fecha
- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (fecha de pago 01/05/2030 aceptada sin aviso ni bloqueo; CxP sí valida)
- **Archivos:** `src/features/facturacion/components/DialogRegistrarPago.tsx`, `src/features/facturacion/components/PagoFormFields.tsx`
- **Problema:** El diálogo de cobro inicializa `fecha: today()` pero no valida el valor editado: se aceptan fechas futuras (y anteriores a la emisión de la factura), distorsionando el REP y el aging. El campo `DatePickerMx` (`PagoFormFields.tsx` línea 50) no recibe ningún límite.
- **Fix (instrucción para Lovable):** Bloquear submit con fecha futura (guarda en el diálogo + aviso inline). Para "no anterior a emisión" se requiere exponer `fecha_emision` en la prop `factura` — hacerlo como aviso no bloqueante (hay cobros registrados a destiempo legítimos).
- **Diff / código:**

`DialogRegistrarPago.tsx` — ANTES:
```ts
  const montoNum = Number(values.monto) || 0;
  const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
```
DESPUÉS:
```ts
  const montoNum = Number(values.monto) || 0;
  // UIA-06: la fecha de pago no puede ser futura (REP y aging quedarían distorsionados).
  const fechaFutura = values.fecha > today();
  const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
```
y en el cálculo de `invalido` (ya combinado con la guarda de UIA-01):
```ts
  const invalido = montoNum <= 0 || excede || crossSinTc || fechaFutura;
```
`DialogRegistrarPagoParts.tsx` (`NotasPago`) — agregar prop `fechaFutura: boolean` y renderizar junto a los avisos existentes:
```tsx
      {fechaFutura && (
        <p className="text-xs text-destructive">
          La fecha de pago no puede ser futura.
        </p>
      )}
```
(Opcional, si se agrega `fecha_emision` a la interfaz `Factura`: aviso ámbar no bloqueante "La fecha de pago es anterior a la emisión de la factura".)
- **Tras aplicar, verificar:** fecha 01/05/2030 → botón deshabilitado + mensaje; fecha de hoy o pasada → flujo normal. El aviso previo a corte (`AvisoFechaPreviaCorte`) sigue funcionando.

---

### [UIA-07] Cartera marca "Vence hoy" una factura que vence en 10 días
- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (vencimiento 22/08/2026, hoy 12/08 → badge "Vence hoy"; Facturación mostraba bien "Vence en 10 d")
- **Archivos:** `src/features/bandejas/routes/_sections/carteraColumns.tsx`, `src/features/bandejas/routes/_sections/CarteraMobileList.tsx`, BD: RPC `public.cartera_pendiente()` (canon `supabase/schema/facturacion/cartera_pendiente.sql`)
- **Problema:** La columna "DÍAS VENCIDO" usa `dias_vencido` tal cual viene de la RPC. El código vigente de la RPC ya es correcto (`(CURRENT_DATE - b.fecha_vencimiento)::int`, migración N9 `20260810121500_ola4_n9_cartera_pendiente_dias_vencido.sql`), pero la versión anterior truncaba con `GREATEST(0, …)` — con ese clamp una factura que vence en 10 días devuelve exactamente `0`, y el cell renderer muestra `d === 0 → "Vence hoy"`. Es el síntoma observado: la función desplegada en el entorno auditado es pre-N9. Hay además riesgo de divergencia de timezone entre `CURRENT_DATE` (UTC del servidor) y la fecha local del usuario.
- **Fix (instrucción para Lovable):** Doble capa: (1) BD — verificar en staging/prod que `cartera_pendiente()` desplegada coincide con el canon N9 (sin `GREATEST(0,…)` en la columna de salida; el clamp sólo ordena). Si no, re-aplicar la migración `20260810121500` / el archivo canon. (2) UI defensiva — recalcular los días en cliente desde `fecha_vencimiento` con el canon de fechas locales (`calcularDiasVencidoFactura`, misma convención de signo), en vez de confiar ciegamente en la RPC.
- **Diff / código:**

`carteraColumns.tsx` — ANTES:
```tsx
      cell: ({ row }) => {
        const d = row.original.dias_vencido;
        if (d > 0) return <Badge variant="destructive">Vencida {d}d</Badge>;
        // B-019 (v13.320.42): antes decíamos "Por vencer 0d" cuando vence hoy —
        // era ambiguo (¿ya venció? ¿faltan 0 días?). Ahora "Vence hoy" es literal.
        if (d === 0) return <Badge variant="secondary">Vence hoy</Badge>;
        if (d >= -7) return <Badge variant="secondary">Vence en {Math.abs(d)}d</Badge>;
        return <Badge variant="outline">Vence en {Math.abs(d)}d</Badge>;
      },
```
DESPUÉS:
```tsx
      cell: ({ row }) => {
        // UIA-07: recalcular desde fecha_vencimiento con el canon local
        // (`calcularDiasVencidoFactura`, misma convención de signo que la RPC).
        // La RPC desplegada puede ser pre-N9 (clamp GREATEST(0,…)) y devolver 0
        // → "Vence hoy" falso. Fallback a dias_vencido sólo si no hay fecha.
        const d = row.original.fecha_vencimiento
          ? (calcularDiasVencidoFactura(row.original.fecha_vencimiento) ?? row.original.dias_vencido)
          : row.original.dias_vencido;
        if (d > 0) return <Badge variant="destructive">Vencida {d}d</Badge>;
        if (d === 0) return <Badge variant="secondary">Vence hoy</Badge>;
        if (d >= -7) return <Badge variant="secondary">Vence en {Math.abs(d)}d</Badge>;
        return <Badge variant="outline">Vence en {Math.abs(d)}d</Badge>;
      },
```
(import: `import { calcularDiasVencidoFactura } from "@/features/facturacion/domain/facturaAging";`). Aplicar el mismo recálculo al badge de `CarteraMobileList.tsx` (líneas 48-49, `{row.dias_vencido}d`).
- **Tras aplicar, verificar:** factura con vencimiento a 10 días → Cartera muestra "Vence en 10d" igual que Facturación. En SQL: `SELECT prosrc FROM pg_proc WHERE proname='cartera_pendiente'` no debe contener `GREATEST(0, (CURRENT_DATE` en la columna de salida. Sin fecha de vencimiento no hay regresión ("Vence: —").

---

### [UIA-08] Toast global "No pudimos cargar la información" en páginas sanas
- **Severidad:** P2 · **Verificación:** PENDIENTE staging (en el stack local el toast aparece en casi todas las páginas; en consola sólo falla el WebSocket de realtime — limitación del stack — y, en páginas con FX, `501 /functions/v1/exchange-rates`. Probablemente no reproducible en prod, pero revela que un fallo de canal en background dispara error global)
- **Archivos:** `src/lib/query/queryErrorReporting.ts` (`notifyQueryFailure`), `src/features/catalogos/hooks/useExchangeRates.ts`, suscripciones realtime (`src/features/cxp/services/facturasEntrantesRealtime.ts`, `src/features/notificaciones/services/index.ts`)
- **Problema:** Cualquier query que falla sin `meta.silentError` dispara el toast global con "Ver detalles/Reintentar" (`queryErrorReporting.ts` líneas 141-153), aunque la página degrade con gracia. En el stack auditado la causa probable es la query de `exchange-rates` (501), presente en /inicio, /tesoreria, /facturacion… — no el WebSocket (éste no pasa por React Query). Resultado: alarma falsa permanente que mata la credibilidad de los errores reales.
- **Fix (instrucción para Lovable):** (1) Marcar `useExchangeRates` como `silentError` — su degradación ya es visible en UI ("TC no disponible", hints de exclusión) y no amerita toast de datos. (2) Verificación en staging (obligatoria antes de cerrar): si el toast persiste con realtime sano, identificar la queryKey exacta en "Ver detalles" del toast (el payload la incluye) y aplicar el mismo criterio: los canales de background (realtime, FX, notificaciones) nunca elevan a toast de error de datos; como mucho, badge discreto "tiempo real desconectado".
- **Diff / código:**

`useExchangeRates.ts` — ANTES:
```ts
export function useExchangeRates() {
  return useQuery({
    queryKey: queryKeys.exchangeRates.all,
    queryFn: () => fetchExchangeRates(),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}
```
DESPUÉS:
```ts
export function useExchangeRates() {
  return useQuery({
    queryKey: queryKeys.exchangeRates.all,
    queryFn: () => fetchExchangeRates(),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
    // UIA-08: degradación silenciosa. Sin TC la UI ya muestra "no disponible"
    // (hints de exclusión en Tesorería/Facturación); un fallo de este servicio
    // no es un fallo de carga de la página y no debe disparar el toast global.
    meta: { silentError: true },
  });
}
```
- **Tras aplicar, verificar (staging, no stack local):** recorrer /inicio, /facturacion, /cartera, /tesoreria con red sana → ningún toast "No pudimos cargar la información". Simular 501 en exchange-rates → sin toast; los hints de "TC no disponible" aparecen en su lugar. Cortar el WebSocket de realtime → sin toast de datos (a lo sumo el badge si se implementa). Errores reales de datos (ej. 500 en cobranza) siguen tostando con "Reintentar".

---

### [UIA-09] Descuadre de "contenedores" entre lista y detalle
- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (lista: "Embarques / 4 contenedores" con 4 embarques y 3 contenedores reales; detalle DEMO-001: "Contenedores (0)")
- **Archivos:** `src/features/embarques/routes/Embarques.tsx`, `src/features/embarques/domain/embarquesPageHelpers.ts` (`computeCounts`)
- **Problema:** En la vista por defecto (sin filtro de estado), `computeCounts` devuelve `contenedoresCount: totalCountServer` — el total de **embarques** del servidor — y `buildDescription` lo etiqueta como "contenedores" (`Embarques.tsx` línea 25). La columna además muestra un contenedor para un embarque cuyo detalle dice "(0)": dos vistas del mismo objeto se contradicen.
- **Fix (instrucción para Lovable):** Cuando el contador proviene del total server-side (sin filtro de estado), etiquetarlo como "embarques"; la forma "N contenedores en M expedientes" sólo cuando el conteo es real de contenedores (filtro de estado activo, set completo en cliente).
- **Diff / código:**

`Embarques.tsx` — ANTES:
```ts
function buildDescription(contenedoresCount: number, expedientesCount: number, estadoActivo: boolean): string {
  const cont = `${contenedoresCount} ${contenedoresCount === 1 ? "contenedor" : "contenedores"}`;
  if (!estadoActivo) return cont;
  const exp = `${expedientesCount} ${expedientesCount === 1 ? "expediente" : "expedientes"}`;
  return `${cont} en ${exp}`;
}
```
DESPUÉS:
```ts
function buildDescription(contenedoresCount: number, expedientesCount: number, estadoActivo: boolean): string {
  if (!estadoActivo) {
    // UIA-09: sin filtro de estado, `contenedoresCount` es el total SERVER-SIDE
    // de embarques (computeCounts → totalCountServer), no de contenedores.
    return `${contenedoresCount} ${contenedoresCount === 1 ? "embarque" : "embarques"}`;
  }
  const cont = `${contenedoresCount} ${contenedoresCount === 1 ? "contenedor" : "contenedores"}`;
  const exp = `${expedientesCount} ${expedientesCount === 1 ? "expediente" : "expedientes"}`;
  return `${cont} en ${exp}`;
}
```
- **Tras aplicar, verificar:** /embarques sin filtros → encabezado "4 embarques"; con filtro de estado activo → "N contenedores en M expedientes" y cuadra con el detalle del embarque. El descuadre columna-lista vs detalle (MSCU7788990 vs "Contenedores (0)") queda acotado a la fuente de contenedores por fila — verificar que la columna y el detalle lean la misma tabla (`embarque_contenedores`); si persiste, abrir como hallazgo de datos aparte.

---

### [UIA-10] P&L con TC "0.0000" y cifras descuadradas
- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (DEMO-2026-001: "USD 0.0000 · EUR 0.0000"; "Costo real MXN 14,500" vs tabla por concepto "Total MXN 12,500"; "Margen real 0.0%" con utilidad −14,500)
- **Archivos:** `src/features/embarques/components/TabPnl.tsx`, `src/features/embarques/services/pnlFinanciero.ts`, `src/features/embarques/domain/pnlAlertas.ts`
- **Problema:** Tres síntomas: (1) `pnlFinanciero.ts` línea 77 normaliza `tipo_cambio_usd: raw.tipo_cambio_usd ?? 0` y `TabPnl.tsx` línea 156 imprime `0?.toFixed(4)` → "0.0000" en vez de "no disponible". (2) Con venta real 0, `calcularAlertasPnl` devuelve `margenReal = 0` y el KPI muestra "0.0%" junto a una utilidad negativa. (3) El descuadre Costo real (14,500) vs total por concepto (12,500) sugiere conceptos fuera de la tabla (comisiones/impuestos) o filtro distinto entre agregados — requiere revisión de datos, no cosmética.
- **Fix (instrucción para Lovable):** (1) y (2) en UI: placeholder "—" cuando el TC es 0/nulo; margen "n/a" cuando la venta real es 0. (3) Queda como verificación: reconciliar `data.costo.real_mxn` con la suma de `data.por_concepto_costo` en `pnlFinanciero` (misma fuente o nota explicativa del faltante).
- **Diff / código:**

`TabPnl.tsx` — ANTES (línea 156):
```tsx
      <p className="text-xs text-muted-foreground">
        Tipos de cambio del embarque: USD {data.tipo_cambio_usd?.toFixed(4) ?? "—"} · EUR {data.tipo_cambio_eur?.toFixed(4) ?? "—"}
      </p>
```
DESPUÉS:
```tsx
      <p className="text-xs text-muted-foreground">
        {/* UIA-10: TC 0 = no disponible (el servicio cae a ?? 0 en pnlFinanciero) */}
        Tipos de cambio del embarque: USD {data.tipo_cambio_usd && data.tipo_cambio_usd > 0 ? data.tipo_cambio_usd.toFixed(4) : "—"} · EUR {data.tipo_cambio_eur && data.tipo_cambio_eur > 0 ? data.tipo_cambio_eur.toFixed(4) : "—"}
      </p>
```
ANTES (KPI Margen real, línea 86-88):
```tsx
        <KpiCard
          label="Margen real"
          value={pctPnl(margenReal)}
```
DESPUÉS:
```tsx
        <KpiCard
          label="Margen real"
          value={ventaReal > 0 ? pctPnl(margenReal) : "n/a"}
```
- **Tras aplicar, verificar:** embarque sin TC (exchange-rates caído) → "USD — · EUR —"; embarque sin venta real → Margen real "n/a" (sin badge de alerta de margen, que ya está condicionada a `ventaReal > 0` en `pnlAlertas`). Conciliar a mano un embarque: `costo.real_mxn` debe igualar la suma de la tabla por concepto o explicar el faltante.

---

### [UIA-11] Banner demo dice "modo demo como administrador" con cualquier rol
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (login ventas@ → banner "Estás en modo demo como administrador")
- **Archivos:** `src/features/marketing/components/DemoModeBanner.tsx`
- **Problema:** El texto del banner está hardcodeado (línea 19) e ignora el rol efectivo de la sesión; confunde la verificación de permisos por rol y la percepción de identidad.
- **Fix (instrucción para Lovable):** Usar `useAuth().effectiveRole` y la etiqueta canónica `obtenerEtiquetaRol` (ya existe en `roleCatalog.ts`).
- **Diff / código:**

ANTES:
```tsx
import { Sparkles } from "lucide-react";
import { useIsDemoUser } from "@/features/marketing/hooks/useIsDemoUser";

export function DemoModeBanner() {
  const isDemo = useIsDemoUser();
  if (!isDemo) return null;
…
        Estás en <strong>modo demo</strong> como administrador · datos de ejemplo, se reinician en cada acceso.
```
DESPUÉS:
```tsx
import { Sparkles } from "lucide-react";
import { useIsDemoUser } from "@/features/marketing/hooks/useIsDemoUser";
import { useAuth } from "@/lib/contexts/AuthContext";
import { obtenerEtiquetaRol } from "@/features/admin/domain/roles/roleCatalog";

export function DemoModeBanner() {
  const isDemo = useIsDemoUser();
  const { effectiveRole } = useAuth();
  if (!isDemo) return null;
…
        Estás en <strong>modo demo</strong> como {obtenerEtiquetaRol(effectiveRole).toLowerCase()} · datos de ejemplo, se reinician en cada acceso.
```
- **Tras aplicar, verificar:** login como ventas@ → "…como vendedor"; admin@ → "…como administración" (o la etiqueta del catálogo); cuenta sin rol → "—" (revisar que la etiqueta fallback no rompa la frase; en ese caso usar "usuario sin rol").

---

### [UIA-12] `<title>` del documento no se actualiza en rutas de detalle
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (pestaña dice "Libre Carga — Software de carga gratuito en México" en /embarques/:id y /facturacion/:id; las listas sí actualizan)
- **Archivos:** `src/features/embarques/routes/EmbarqueDetalle.tsx`, `src/features/facturacion/routes/FacturaDetalle.tsx`
- **Problema:** Las rutas de detalle no llaman `useDocumentTitle` (sí lo hacen las listas: `Embarques.tsx` línea 30, `Facturacion.tsx` línea 52), así que la pestaña conserva el título del landing de `index.html`. Ambas ya resuelven el folio para el breadcrumb (`useRegisterBreadcrumbLabel`), ideal como título.
- **Fix (instrucción para Lovable):** Llamar `useDocumentTitle` con el folio/ número en cada detalle.
- **Diff / código:**

`EmbarqueDetalle.tsx` — junto a la línea 52 existente:
```ts
  useRegisterBreadcrumbLabel(id, embarque?.expediente);
```
agregar:
```ts
  // UIA-12: la pestaña se distingue por folio (antes quedaba el título del landing).
  useDocumentTitle(embarque?.expediente ? `Embarque ${embarque.expediente}` : "Embarque");
```
`FacturaDetalle.tsx` — junto a la línea 42 existente:
```ts
  useRegisterBreadcrumbLabel(id, factura?.numero);
```
agregar:
```ts
  useDocumentTitle(factura?.numero ? `Factura ${factura.numero}` : "Factura");
```
(import `useDocumentTitle` desde `@/hooks/shared` en ambos).
- **Tras aplicar, verificar:** abrir dos detalles distintos en dos pestañas → títulos "Embarque DEMO-2026-001 · Libre Carga" y "Factura A-TEST-001 · Libre Carga"; al volver a la lista el título se restaura (el hook ya revierte al desmontar).

---

### [UIA-13] Toasts con texto técnico en inglés ("Failed to fetch")
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (Descargar PDF/XML con storage stub → toast "No se pudo abrir el PDF — Failed to fetch")
- **Archivos:** `src/features/facturacion/components/FacturaDownloadButton.tsx` (patrón general UX-02, ver `fixes_UX.md`)
- **Problema:** El `catch` pasa `(err as Error).message` como `description` del toast (líneas 37-40), exponiendo mensajes crudos de red en inglés al usuario final. El detalle técnico ya viaja en `error: err` y es visible en el ErrorDetailsDialog ("Ver detalles"), por lo que no se pierde diagnóstico.
- **Fix (instrucción para Lovable):** Descripción fija en español orientada a acción; el detalle técnico queda sólo en el payload del diálogo de detalles. Aplicar el patrón UX-02 al resto de toasts que interpolen `err.message`.
- **Diff / código:**

ANTES:
```ts
    } catch (err) {
      notifyError(undefined, { title: "No se pudo abrir el archivo",
        description: (err as Error).message, error: err, method: "FEATURES_FACTURACION_COMPONENTS_FACTURADOWNLOADBUTTON_1" });
    }
```
DESPUÉS:
```ts
    } catch (err) {
      // UIA-13: descripción fija en español; el mensaje crudo ("Failed to fetch")
      // queda sólo en el payload de "Ver detalles" (ErrorDetailsDialog).
      notifyError(undefined, { title: "No se pudo abrir el archivo",
        description: "El documento no está disponible en este momento. Intenta de nuevo; si el problema persiste, contacta a soporte.",
        error: err, method: "FEATURES_FACTURACION_COMPONENTS_FACTURADOWNLOADBUTTON_1" });
    }
```
- **Tras aplicar, verificar:** provocar fallo de descarga (storage caído) → toast en español sin texto técnico; "Ver detalles" sigue mostrando el mensaje original copiable.

---

### [UIA-14] Cotizaciones sin vigencia en lista; detalle "Vigencia 7 días (-)"
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (lista sin columna "Vence…" para COT-DEMO-002; detalle "Vigencia: 7 días (-)")
- **Archivos:** `src/features/cotizacion/components/columnsParts/estadoVigenciaCell.tsx`, `src/features/cotizacion/components/detalle/CotizacionDatosGeneralesCard.tsx`
- **Problema:** Dos frentes. (1) `buildVigenciaNode` oculta la vigencia cuando la cotización no está "enviada" y vence a más de 7 días (v13.223.0, densidad visual) — con el efecto de que no se puede priorizar por vencimiento en la lista. (2) El detalle interpola siempre el paréntesis: `` `${c.vigencia_dias} días (${c.fecha_vigencia ? formatDate(c.fecha_vigencia) : "-"})` `` → "7 días (-)" luce roto.
- **Fix (instrucción para Lovable):** (1) Mostrar también la vigencia de cotizaciones "aceptada" (alimenta la revalidación de tarifa); mantener oculta sólo en estados terminales/borrador con vencimiento lejano. (2) Omitir el paréntesis cuando no hay fecha.
- **Diff / código:**

`estadoVigenciaCell.tsx` — ANTES (línea 21):
```ts
  if (!esEnviada && diffDias > 7) return null;
```
DESPUÉS:
```ts
  // UIA-14: la vigencia también importa en "aceptada" (revalidación de tarifa);
  // sólo se oculta fuera de enviada/aceptada y con vencimiento lejano.
  const esAceptada = estado.toLowerCase() === "aceptada";
  if (!esEnviada && !esAceptada && diffDias > 7) return null;
```
`CotizacionDatosGeneralesCard.tsx` — ANTES (línea 40):
```tsx
    { label: "Vigencia", value: `${c.vigencia_dias} días (${c.fecha_vigencia ? formatDate(c.fecha_vigencia) : "-"})` },
```
DESPUÉS:
```tsx
    // UIA-14: sin fecha no se imprime el paréntesis vacío ("7 días (-)" lucía roto).
    { label: "Vigencia", value: c.fecha_vigencia ? `${c.vigencia_dias} días (hasta ${formatDate(c.fecha_vigencia)})` : `${c.vigencia_dias} días` },
```
- **Tras aplicar, verificar:** lista muestra "Vence en Xd · fecha" para cotizaciones enviadas y aceptadas próximas; detalle sin fecha de vigencia muestra "Vigencia: 7 días" a secas; con fecha, "7 días (hasta 22/08/2026)".

---

### [UIA-15] Empty state de búsqueda sin acción
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (buscar "zzzz-no-existe" → "No se encontraron embarques" a secas)
- **Archivos:** `src/features/embarques/routes/Embarques.tsx`
- **Problema:** `ResponsiveDataTable` recibe sólo `emptyMessage="No se encontraron embarques"` (línea 134) y el usuario debe borrar a mano la búsqueda/filtros. La tabla ya soporta `emptyState?: ReactNode` (prop documentada: "Nodo custom para el empty state (CTA accionable)").
- **Fix (instrucción para Lovable):** Reemplazar `emptyMessage` por un `emptyState` con CTA "Limpiar filtros" que restaure búsqueda y filtros a sus defaults del controller.
- **Diff / código:**

ANTES:
```tsx
              <ResponsiveDataTable
                columns={columns}
                data={deferredFiltered}
                isLoading={isLoading}
                emptyMessage="No se encontraron embarques"
```
DESPUÉS:
```tsx
              <ResponsiveDataTable
                columns={columns}
                data={deferredFiltered}
                isLoading={isLoading}
                emptyState={
                  <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                    <span>No se encontraron embarques con la búsqueda o los filtros actuales.</span>
                    <Button variant="outline" size="sm" onClick={limpiarFiltros}>
                      Limpiar filtros
                    </Button>
                  </div>
                }
```
y el handler dentro del componente (defaults según `useEmbarquesPageState`):
```ts
  // UIA-15: salida de un clic del empty state de búsqueda.
  const limpiarFiltros = () => {
    setSearch("");
    setFilterModo("todos");
    setFilterEstado("todos");
    setFilterCliente("todos");
    setFilterOperador("todos");
    setFilterAlerta("todos");
    setFechaDesde("");
    setFechaHasta("");
    setPage(0);
  };
```
(import `Button` de `@/components/ui/button` si no está).
- **Tras aplicar, verificar:** buscar "zzzz-no-existe" → empty state con botón; clic en "Limpiar filtros" → reaparecen los 4 embarques y los chips de filtro se resetean. El empty state de lista vacía real (`EmbarquesEmptyState`, "Aún no tienes embarques") no cambia.

---

### [UIA-16] Convertir cotización → embarque sin CTA descubrible ni expediente
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO ("Crear embarque" crea el Borrador de inmediato con expediente vacío; /embarques/nuevo standalone redirige a /cotizaciones con toast de error; la lista no muestra botón "Nuevo")
- **Archivos:** `src/features/embarques/routes/Embarques.tsx`, `src/features/embarques/routes/NuevoEmbarque.tsx`, `src/features/cotizacion/services/conversiones/embarques.ts` (sólo referencia)
- **Problema:** La política tarifa-first (v13.303.26) eliminó el CTA "Nuevo embarque" hardcodeando `const canCrear = false;` (línea 40), así que el flujo correcto (desde una cotización Aceptada) no es descubrible: quien busca crear un embarque en /embarques no encuentra puerta de entrada. Además la RPC `crear_embarque_borrador_desde_cotizacion` crea el Borrador sin asignar expediente (queda vacío hasta captura posterior).
- **Fix (instrucción para Lovable):** (1) Restaurar un CTA visible "Nuevo embarque" que, en vez de navegar a la ruta bloqueada, explique el prerrequisito y lleve a /cotizaciones (navegación proactiva, no toast de error tras el hecho). (2) El cambio de `goNuevo` mantiene el guard de ruta intacto como defensa. (3) Expediente al crear: es cambio server-side en la RPC — coordinar con el equipo BL; fuera del alcance del freeze de UI (registrar como pendiente).
- **Diff / código:**

`Embarques.tsx` — ANTES (líneas 38-41 y 54):
```ts
  // v13.303.26 — el CTA "Nuevo embarque" desaparece: los embarques sólo se crean
  // desde una cotización Aceptada (política tarifa-first, sin excepciones).
  const canCrear = false;
…
  const goNuevo = () => navigate("/embarques/nuevo");
```
DESPUÉS:
```ts
  // UIA-16: el CTA vuelve a ser visible pero guía al prerrequisito (cotización
  // Aceptada) en lugar de mandar a la ruta bloqueada. La política tarifa-first
  // (v13.303.26) se mantiene: el guard de /embarques/nuevo sigue activo.
  const canCrear = true;
…
  const goNuevo = () => {
    notifyInfo(undefined, {
      title: "Los embarques nacen de una cotización Aceptada",
      description: "Abre la cotización aceptada y usa el botón \"Crear embarque\" de su detalle.",
    });
    navigate("/cotizaciones");
  };
```
(import `notifyInfo` desde `@/lib/ui/appFeedback`). `EmbarquesHeaderActions` y `FloatingActionButton` ya consumen `canEdit={canCrear}`/`onNuevo={goNuevo}` — no requieren cambios. En `EmbarquesEmptyState` el CTA "Crear mi primer embarque" pasa por el mismo `goNuevo` y ahora guía en vez de rebotar.
- **Tras aplicar, verificar:** /embarques muestra "Nuevo Embarque" (desktop) y FAB (móvil); clic → toast informativo + navegación a /cotizaciones. La ruta /embarques/nuevo directa sigue redirigiendo con el aviso existente (defensa). Convertir desde una cotización Aceptada sigue creando el Borrador vía RPC idempotente. Pendiente BL: asignar expediente en `crear_embarque_borrador_desde_cotizacion` al crear.

---

### [UIA-17] Stepper de etapas duplicado en el árbol de accesibilidad (Tracking)
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (el stepper Propuesta→Cerrado aparece 2 veces en el árbol de accesibilidad: variantes desktop y móvil renderizadas a la vez)
- **Archivos:** `src/features/embarques/components/tracking/FasesEmbarqueStepper.tsx`
- **Problema:** `StepperCompleto` renderiza la variante escritorio (`hidden md:block`, línea 120) y la móvil (`md:hidden`, línea 150) simultáneamente; el ocultamiento es sólo visual (CSS) y ambas permanecen en el árbol de accesibilidad → lectores de pantalla anuncian el stepper dos veces. Ya existe un `progressbar` sr-only (líneas 103-111) que expone el estado accesible.
- **Fix (instrucción para Lovable):** Marcar ambas variantes visuales como `aria-hidden="true"`: el canal accesible canónico pasa a ser el `progressbar` sr-only existente. Así no depende del viewport y elimina la duplicación en cualquier dispositivo.
- **Diff / código:**

ANTES (líneas 120 y 150):
```tsx
      {/* Escritorio: horizontal, con scroll contenido si el ancho aprieta */}
      <div className="hidden md:block overflow-x-auto">
…
      {/* Móvil: vertical */}
      <div className="md:hidden relative">
```
DESPUÉS:
```tsx
      {/* Escritorio: horizontal, con scroll contenido si el ancho aprieta.
          UIA-17: ambas variantes visuales son aria-hidden — el canal accesible
          canónico es el role="progressbar" sr-only de arriba (antes el stepper
          se anunciaba dos veces: desktop + móvil). */}
      <div className="hidden md:block overflow-x-auto" aria-hidden="true">
…
      {/* Móvil: vertical */}
      <div className="md:hidden relative" aria-hidden="true">
```
- **Tras aplicar, verificar:** árbol de accesibilidad del detalle → Tracking muestra el stepper una sola vez (el progressbar sr-only con "— %"); visualmente no cambia nada en desktop ni móvil. El stepper de la tarjeta de Resumen (`EstadoProgresoCard`) comparte el mismo componente y queda cubierto.

---

## Resumen de validación

| ID | Estado | Notas |
|---|---|---|
| UIA-01 | ✔ | Cross-ref FE-01 + delta (guarda submit + alerta ámbar) verificado en `DialogRegistrarPago.tsx`/`…Parts.tsx` |
| UIA-02 | ✔ | Fix en `useTraspasoForm.ts` (default 1→0) + preview condicionado; coordinar guarda server BL-04 |
| UIA-03 | ✔ | Fallback `tc=1` localizado en `resumen.ts:51`; fix excluir+avisar en dominio, KPIs Tesorería y dashboard Facturación |
| UIA-04 | ✔ | `ProtectedRoute` pasa motivo en state; `SinAcceso` renderiza por causa + CTA "Volver al inicio" |
| UIA-05 | ✔ | Cross-ref UX-01 + delta: gate `canAdminTenant` en `TabPuertos.tsx` |
| UIA-06 | ✔ | Guarda fecha futura en diálogo de cobro + aviso inline |
| UIA-07 | ✔ | Recálculo cliente con canon `calcularDiasVencidoFactura` + verificación de RPC desplegada (clamp pre-N9) |
| UIA-08 | ✔ | PENDIENTE staging: fix probable (`silentError` en `useExchangeRates`) + verificación requerida documentada |
| UIA-09 | ✔ | Etiqueta "embarques" cuando el contador es server-side (`computeCounts`) |
| UIA-10 | ✔ | Placeholders "—"/"n/a" en `TabPnl.tsx`; descuadre de agregados queda como verificación de datos |
| UIA-11 | ✔ | Banner usa `effectiveRole` + `obtenerEtiquetaRol` |
| UIA-12 | ✔ | `useDocumentTitle` con folio en ambos detalles |
| UIA-13 | ✔ | Descripción fija en español; detalle técnico sólo en ErrorDetailsDialog |
| UIA-14 | ✔ | Vigencia visible en "aceptada" + paréntesis condicional en detalle |
| UIA-15 | ✔ | `emptyState` con CTA "Limpiar filtros" |
| UIA-16 | ✔ | CTA "Nuevo embarque" restaurado con guía al prerrequisito; expediente al crear = pendiente BL |
| UIA-17 | ✔ | `aria-hidden` en ambas variantes visuales; canal accesible = progressbar sr-only existente |

**Divergencias / notas:**
- **UIA-07:** el código fuente del repo (migración N9 + canon) ya es correcto; el bug dinámico apunta a función desplegada pre-N9 en el entorno auditado. El fix UI defensivo se entrega igualmente; la verificación SQL en staging/prod es obligatoria.
- **UIA-08:** la causa raíz exacta del toast en el stack local no se pudo aislar a un solo origen (FX 501 vs. canal realtime); el fix entregado cubre la vía React Query (donde vive el toast) y se documenta la verificación en staging para el caso realtime.
- **UIA-09:** queda un posible descuadre de datos (columna lista vs detalle de contenedores) que puede ser de fuente de datos, no de etiqueta — se marca para verificación post-fix.
- **UIA-16:** la asignación de expediente al crear el borrador es server-side (RPC) y queda explícitamente fuera del fix de UI (feature freeze) — coordinar con BL.
- Ningún diff fue inventado: todos parten de fragmentos reales leídos del repo en `main @ 1ef05ce9`.


# Línea UIB — Portales y sitio público (dinámica)

# Fix Pack — Auditoría UI Dinámica Portales Públicos / Landing (UIB-01 a UIB-15)

**Fuente:** `audit_reports/08_ui_dinamica_portales.md` (hallazgos UIB-01 a UIB-15).
**Repo:** main @ 1ef05ce9. Todos los fragmentos fueron copiados del repo real y verificados línea por línea (rutas, líneas y contexto citados abajo).
**Reglas globales:** bajo riesgo, retrocompatible (feature freeze), sin cambios de contratos ni RPCs. Copys de usuario en español (es-MX). Componentes compartidos citados (`LoadingState`, `ErrorState`, `formatDate`, `filtrarEventosVisiblesCliente`) ya existen en el repo.
**Nota de stack:** la auditoría dinámica corrió sobre el stack local (`:9000`) con edge functions stubbeadas (501). Donde el hallazgo depende del stack se marca **verificar en staging**.

---

### [UIB-01] Error crudo en inglés en el modal "Probar demo"

- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (modal demo en `/`; en local el edge `demo-access` responde 501 → "Edge Function returned a non-2xx status code" en el `Alert` y el toast)
- **Archivos:**
  - `src/features/marketing/components/DemoAccessDialog.tsx` (líneas 80-90, bloque `catch`)
  - `src/features/marketing/services/demoAccess.ts` (líneas 28-48, `ejecutarDemoAccess`)
- **Problema:** el `catch` del diálogo muestra `err.message` crudo al usuario (`setError(msg)` y `description: msg`). `functions.invoke` lanza `FunctionsHttpError` cuyo `message` es la cadena genérica en inglés "Edge Function returned a non-2xx status code" (el body real queda en `error.context`). El mismo patrón del repo ya documentado en `facturapiError.ts:47-51` lo confirma. En landing pública es el primer contacto del prospecto con la marca.
- **Fix (instrucción para Lovable):**
  1. En `DemoAccessDialog.tsx` agregar un helper local `mensajeAmigableDemo(err)` que mapee los fallos conocidos a copy propio es-MX (nunca mostrar `err.message` crudo).
  2. En el `catch`, usar el helper para `setError` y para el `description` del toast; el mensaje crudo se conserva en `error: err` (va al diálogo "Ver detalles" y a Sentry, no a la vista).
  3. El texto amable debe cubrir: edge no-2xx/red (reintentar), `permission denied` (registro del lead), y fallback genérico.
- **Diff / código:**

`src/features/marketing/components/DemoAccessDialog.tsx`:

```diff
 export function DemoAccessDialog({ open, onOpenChange }: Props) {
   const navigate = useNavigate();
   const { toast } = useToast();
```

```diff
+/**
+ * UIB-01: nunca mostrar `err.message` crudo en la landing pública — los errores
+ * de `functions.invoke` llegan en inglés ("Edge Function returned a non-2xx
+ * status code"). El mensaje técnico sigue yendo a "Ver detalles"/Sentry vía
+ * `error: err`.
+ */
+function mensajeAmigableDemo(err: unknown): string {
+  const m = (err instanceof Error ? err.message : "").toLowerCase();
+  if (m.includes("non-2xx") || m.includes("failed to fetch") || m.includes("network")) {
+    return "No pudimos abrir la demo en este momento. Intenta de nuevo en unos minutos.";
+  }
+  if (m.includes("permission denied") || m.includes("row-level security")) {
+    return "No pudimos registrar tus datos. Intenta de nuevo o escríbenos a contacto@librecarga.com.";
+  }
+  return "No pudimos abrir la demo. Intenta de nuevo en un momento.";
+}
+
   const handleSubmit = async (e: React.FormEvent) => {
```

```diff
     } catch (err) {
-      const msg = err instanceof Error ? err.message : "Intenta de nuevo en un momento.";
+      const msg = mensajeAmigableDemo(err);
       setError(msg);
       notifyError(undefined, {
         title: "No pudimos abrir la demo",
         description: msg,
         error: err,
         method: "DEMO_ACCESS_DIALOG",
       });
       setLoading(false);
     }
```

- **Tras aplicar, verificar:**
  1. En `/`, abrir "Probar demo", llenar el formulario y enviar con el edge `demo-access` caído (o bloqueado en DevTools → Network) → el `Alert` y el toast muestran el copy es-MX, nunca la cadena en inglés.
  2. Toast "Ver detalles" sigue mostrando el mensaje técnico original (trazabilidad).
  3. En staging (edge real): provocar un fallo 500 de `demo-access` y repetir — **verificar en staging** el body real que llega en `error.context` para afinar el mapeo.

---

### [UIB-02] Login vacío → error crudo en inglés, sin validación de cliente

- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (fuente: "PARCIALMENTE REFUTADAS" sólo para errores de servidor ya traducidos; campos vacíos → inglés crudo ❌). Estático: `LoginForm.tsx:49` usa `noValidate` y `handleLogin` (27-46) llama `signInWithEmail` sin validar; `translateAuthError` (lib/auth/translateAuthError.ts) no tiene caso para credenciales faltantes y cae al `return message` crudo (línea 36)
- **Archivos:**
  - `src/features/auth/components/LoginForm.tsx` (líneas 27-46, 49)
  - `src/lib/auth/translateAuthError.ts` (líneas 5-37)
- **Problema:** con email/contraseña vacíos el form hace submit igual (atributos `required` anulados por `noValidate`), Supabase responde "email and password required" (o similar, en inglés) y se muestra tal cual porque el traductor no lo reconoce.
- **Fix (instrucción para Lovable):**
  1. Validación de cliente ANTES de llamar al servicio: campos vacíos → mensaje es-MX propio, sin ida al servidor.
  2. Defensa en profundidad: agregar el caso al traductor por si otro flujo dispara el mismo error.
- **Diff / código:**

`src/features/auth/components/LoginForm.tsx`:

```diff
   const handleLogin = async (e: React.FormEvent) => {
     e.preventDefault();
+    // UIB-02/UIB-03: validación de cliente — el <form> usa noValidate, así que
+    // los `required` de los inputs no frenan el submit.
+    if (!email.trim() || !password) {
+      setLoginError("Ingresa tu email y tu contraseña.");
+      return;
+    }
     setLoading(true);
     setLoginError(null);
```

`src/lib/auth/translateAuthError.ts`:

```diff
   const m = message.toLowerCase();
 
+  if (m.includes("email and password required") || m.includes("missing email or phone")) {
+    return "Ingresa tu email y tu contraseña.";
+  }
   if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
     return "Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.";
   }
```

- **Tras aplicar, verificar:**
  1. `/login` → clic en "Iniciar sesión" con ambos campos vacíos → "Ingresa tu email y tu contraseña.", sin request de red a `/auth/v1/token` (DevTools).
  2. Sólo email lleno (sin contraseña) → mismo mensaje, sin request.
  3. Credenciales incorrectas reales → sigue saliendo "Email o contraseña incorrectos…" (traducción existente no se rompe).

---

### [UIB-03] Login no valida formato de email; servidor responde genérico engañoso

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (sin validación de formato en cliente). Estático: `LoginForm.tsx:27-46` no valida formato; el input es `type="email"` pero el form lleva `noValidate` (línea 49), así que el browser tampoco valida
- **Archivos:**
  - `src/features/auth/components/LoginForm.tsx` (líneas 27-46, 49, 58-66)
- **Problema:** un email con formato inválido ("juan@", "correo") llega al servidor y la respuesta genérica ("Email o contraseña incorrectos…") induce a pensar que la contraseña está mal, cuando el problema es el email. Feedback engañoso en superficie pública.
- **Fix (instrucción para Lovable):**
  1. En el mismo bloque de validación de UIB-02, validar formato con regex simple (sin dependencias nuevas) y mensaje específico que oriente a corregir el email.
- **Diff / código:**

`src/features/auth/components/LoginForm.tsx`:

```diff
 import { translateAuthError } from "@/lib/auth/translateAuthError";
 import { resolveDeepLinkDestino } from "@/features/auth/utils/deepLink";
 
+// UIB-03: formato mínimo de email (no RFC completo — sólo evitar mandar basura
+// al servidor y recibir el genérico "credenciales incorrectas").
+const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
+
```

```diff
     if (!email.trim() || !password) {
       setLoginError("Ingresa tu email y tu contraseña.");
       return;
     }
+    if (!EMAIL_RE.test(email.trim())) {
+      setLoginError("Escribe un email válido (ej. usuario@empresa.com).");
+      return;
+    }
     setLoading(true);
```

- **Tras aplicar, verificar:**
  1. `/login` con email "juan@" y contraseña cualquiera → "Escribe un email válido…", sin request de red.
  2. Email bien formado con contraseña incorrecta → sigue el flujo normal al servidor.

---

### [UIB-04] Banner "modo demo como administrador" en portales cliente/agente

- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (banner visible en `/portal*`, `/agente*`, `/tracking/*`). Estático: `DemoModeBanner.tsx:19` hardcodea "como administrador" y "se reinician en cada acceso"; se monta global en `App.tsx:48` para cualquier ruta cuando `useIsDemoUser()` es true
- **Archivos:**
  - `src/features/marketing/components/DemoModeBanner.tsx` (línea 19)
  - `src/App.tsx` (línea 48, montaje global — no se toca)
- **Problema:** el copy afirma un rol ("administrador") que no corresponde a la pantalla que el usuario está viendo (portal cliente / agente / tracking público) — es confuso y mina la confianza. Además promete "se reinician en cada acceso": el docstring de `demoAccess.ts` dice que la edge `demo-access` "reinicia datos", pero en el stack local no se pudo verificar (501) y la auditoría lo marcó como promesa no comprobada — **verificar en staging** si el re-sembrado realmente ocurre.
- **Fix (instrucción para Lovable):**
  1. Quitar la afirmación de rol del copy: el banner es global y no conoce la superficie; un copy neutro es correcto en todas.
  2. Suavizar la promesa de reinicio a un hecho verificable ("datos de ejemplo") mientras se confirma en staging que `demo-access` re-siembra en cada acceso.
- **Diff / código:**

`src/features/marketing/components/DemoModeBanner.tsx`:

```diff
       <Sparkles className="h-4 w-4" aria-hidden="true" />
       <span>
-        Estás en <strong>modo demo</strong> como administrador · datos de ejemplo, se reinician en cada acceso.
+        Estás explorando la <strong>demo</strong> de Libre Carga · todos los datos son de ejemplo.
       </span>
```

- **Tras aplicar, verificar:**
  1. Entrar a la demo desde `/` y navegar `/inicio`, `/portal`, `/agente`, `/tracking/<token>` → el banner muestra el copy neutro en todas.
  2. Usuario no demo → el banner no aparece (comportamiento existente, `useIsDemoUser`).
  3. **Verificar en staging:** entrar dos veces a la demo y confirmar si los cambios hechos en la primera sesión persisten o se reinician; si NO se reinician, el copy ya no promete nada falso (queda cubierto), pero abrir ticket aparte contra la edge `demo-access`.

---

### [UIB-05] PortalPerfil: spinner genérico y error sin retry

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO y estático — `PortalPerfil.tsx:28-41`: `Loader2` centrado sin timeout y en error sólo texto plano "No se pudo cargar tu perfil.", sin botón Reintentar
- **Archivos:**
  - `src/features/portal/routes/PortalPerfil.tsx` (líneas 1-4, 24, 28-42)
- **Problema:** si `usePortalPerfil` falla (red/RLS), el usuario queda en un callejón sin salida: ni skeleton con timeout ni acción de recuperación, aunque el repo ya tiene el patrón estándar `LoadingState` con `onRetry` (usado en `PortalCotizaciones.tsx:54-64` tras R-05) y `ErrorState`. **Referencia cruzada:** es el mismo hallazgo que **UX-05** (ver `fixes_UX.md`); el fix es idéntico, se documenta aquí porque la superficie es el portal cliente.
- **Fix (instrucción para Lovable):**
  1. Reusar `LoadingState` con `error`/`onRetry`/`errorLabel` exactamente como `PortalCotizaciones`.
  2. Tomar `refetch` del hook; eliminar el `Loader2` ya innecesario del import.
- **Diff / código:**

`src/features/portal/routes/PortalPerfil.tsx`:

```diff
 import { useState } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
-import { Loader2, Pencil, KeyRound, User as UserIcon, Building2 } from "lucide-react";
+import { Pencil, KeyRound, User as UserIcon, Building2 } from "lucide-react";
 import { usePortalPerfil } from "@/features/portal/hooks";
+import { LoadingState } from "@/components/shared/states/LoadingState";
```

```diff
-  const { data, isLoading, isError } = usePortalPerfil();
+  const { data, isLoading, isError, refetch } = usePortalPerfil();
   const [editContacto, setEditContacto] = useState(false);
   const [cambiarPass, setCambiarPass] = useState(false);
 
-  if (isLoading) {
-    return (
-      <div className="flex items-center justify-center py-20">
-        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
-      </div>
-    );
-  }
-
-  if (isError || !data) {
+  // UIB-05 / UX-05: mismo patrón R-05 de PortalCotizaciones — spinner con
+  // timeout (15s) y, ante error, estado accionable con "Reintentar".
+  if (isLoading || isError) {
     return (
-      <div className="py-20 text-center text-sm text-muted-foreground">
-        No se pudo cargar tu perfil.
-      </div>
+      <LoadingState
+        error={isError}
+        onRetry={() => void refetch()}
+        errorLabel="No pudimos cargar tu perfil. Revisa tu conexión e intenta de nuevo."
+      />
     );
   }
 
+  if (!data) return null;
+
   const { email, cliente } = data;
```

- **Tras aplicar, verificar:**
  1. `/portal/perfil` con la query forzada a fallar (DevTools offline o bloquear `rest/v1/client_users`) → aparece el estado de error con botón "Reintentar"; al re-conectar y reintentar, carga el perfil.
  2. Carga normal sin cambios (skeleton/spinner con timeout, no spinner perpetuo).
  3. `tsc`/lint del archivo sin símbolos huérfanos (`Loader2`).

---

### [UIB-06] Tracking público muestra código crudo y no tiene navegación de regreso

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (en local la consola muestra +1 error de recurso 501 y la tarjeta muestra `edge_functions_unavailable`; la 501 es **limitación del stack local** → verificar en staging). Estático: `TrackingPublico.tsx:27` pasa `error.message` crudo a la tarjeta; `TrackingPublicoErrorCard.tsx` lo imprime tal cual y no ofrece salida
- **Archivos:**
  - `src/features/auth/routes/TrackingPublico.tsx` (línea 27)
  - `src/features/embarques/components/tracking/TrackingPublicoErrorCard.tsx` (archivo completo, 16 líneas)
  - `src/features/embarques/services/tracking/index.ts` (líneas 45-52, origen del mensaje: `throw new Error(body.error || "Error al cargar tracking")`)
- **Problema:** la edge `tracking-public` devuelve `body.error` con códigos técnicos (`edge_functions_unavailable`, `token_invalid`, etc.) que el servicio lanza como `Error.message` y la tarjeta renderiza literal. Además la pantalla de error no tiene ningún enlace/botón de regreso: el destinatario del tracking (cliente final, externo) queda atrapado.
- **Fix (instrucción para Lovable):**
  1. En `TrackingPublicoErrorCard.tsx` mapear códigos conocidos a copy es-MX (el componente es puro presentacional, el cambio es local y de bajo riesgo).
  2. Agregar un enlace "Volver al inicio" (`react-router-dom` ya está en el árbol de rutas públicas).
  3. No tocar el servicio ni la edge (contrato intacto); el mapeo vive en la capa de presentación.
- **Diff / código:**

`src/features/embarques/components/tracking/TrackingPublicoErrorCard.tsx`:

```diff
 import { Card, CardContent } from "@/components/ui/card";
 import { AlertTriangle } from "lucide-react";
 import { SectionHeading } from "@/components/shared/SectionHeading";
+import { Link } from "react-router-dom";
+
+/**
+ * UIB-06: la edge `tracking-public` devuelve códigos técnicos en `body.error`
+ * (p.ej. `edge_functions_unavailable`). Nunca mostrarlos crudos al destinatario
+ * externo del tracking.
+ */
+function mensajeTrackingAmigable(raw?: string): string {
+  const m = (raw ?? "").toLowerCase();
+  if (!m || m.includes("invalid") || m.includes("expired") || m.includes("not found")) {
+    return "Este enlace de tracking no existe o ha expirado.";
+  }
+  return "El servicio de seguimiento no está disponible en este momento. Intenta de nuevo en unos minutos.";
+}
 
 export function TrackingPublicoErrorCard({ message }: { message?: string }) {
   return (
     <div className="min-h-screen bg-background flex items-center justify-center">
       <Card className="max-w-md w-full mx-4">
         <CardContent className="flex flex-col items-center py-12">
           <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
           <SectionHeading as="h2" className="mb-2">Enlace no disponible</SectionHeading>
           <p className="text-sm text-muted-foreground text-center">
-            {message || "Este enlace de tracking no existe o ha expirado."}
+            {mensajeTrackingAmigable(message)}
           </p>
+          <Link to="/" className="mt-4 text-sm font-medium text-accent hover:underline">
+            Volver al inicio
+          </Link>
         </CardContent>
       </Card>
     </div>
   );
 }
```

- **Tras aplicar, verificar:**
  1. `/tracking/token-inventado` → copy amable + enlace "Volver al inicio" funcional (navega a `/`).
  2. Token válido real → la página de tracking sigue igual (no se tocó el camino feliz).
  3. **Verificar en staging:** con la edge real, provocar token inválido/expirado y caída de la función; confirmar que los `body.error` reales caen en los dos copys del mapeo (ajustar la lista de códigos si la edge usa otros literales — revisar `supabase/functions/tracking-public`).

---

### [UIB-07] `/logo-preview` (QA interno) accesible públicamente sin login

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO ("accesible sin sesión, muestra matriz QA del logo"). Estático: ruta pública en `routes/publicRoutes.tsx:33`; el propio encabezado de `LogoPreview.tsx:6` lo declara "Ruta: /logo-preview (pública, no indexable)"
- **Archivos:**
  - `src/routes/publicRoutes.tsx` (líneas 15, 33)
- **Problema:** una herramienta de QA interna está expuesta en el bundle y dominio públicos. No hay fuga de datos, pero daña la percepción de pulido y amplía la superficie pública. El smoke test de rutas (`routes/__tests__/routes.smoke.test.tsx`) NO exige `/logo-preview`, así que se puede condicionar sin romper tests.
- **Fix (instrucción para Lovable):**
  1. Montar la ruta sólo en builds de desarrollo (`import.meta.env.DEV`). En producción cae al `*` → `NotFound` (la 404 amigable existente).
  2. Mantener el archivo `LogoPreview.tsx` (sigue siendo útil en dev; los tests de arquitectura lo tienen en allowlist de colores).
- **Diff / código:**

`src/routes/publicRoutes.tsx`:

```diff
-    <Route path="/logo-preview" element={<LogoPreview />} />
+    {/* UIB-07: vista QA del logo — sólo en dev; en producción cae al 404. */}
+    {import.meta.env.DEV && <Route path="/logo-preview" element={<LogoPreview />} />}
```

- **Tras aplicar, verificar:**
  1. `bun dev` (o `npm run dev`) → `/logo-preview` sigue funcionando.
  2. `bun run build && bun run preview` → `/logo-preview` muestra la 404 amigable.
  3. `routes.smoke.test.tsx` sigue en verde (no se tocaron las rutas asertadas).

---

### [UIB-08] Legales públicos marcados "Borrador — pendiente de revisión legal"

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO y estático — `Privacidad.tsx` y `Terminos.tsx` renderizan el banner "Borrador — pendiente de revisión legal. Sustituir antes de producción." (ambos, ~línea 28) y el aviso de privacidad carece del domicilio del responsable (obligatorio LFPDPPP art. 16)
- **Archivos:**
  - `src/features/legal/routes/Privacidad.tsx` (banner ~línea 28; sección "1. Responsable" sin domicilio)
  - `src/features/legal/routes/Terminos.tsx` (banner ~línea 28)
  - `src/routes/publicRoutes.tsx` (líneas 34-36 — NO quitar las rutas: `routes.smoke.test.tsx:58-59` las exige y el footer del landing las enlaza)
- **Problema:** los documentos legales publicados se auto-declaran borrador. El aviso de privacidad sin domicilio del responsable es incumplimiento LFPDPPP. **El TEXTO legal definitivo requiere insumo humano (asesoría legal): NO redactar ni "completar" los documentos con texto inventado.** El fix de código es únicamente el mecanismo de gateo.
- **Fix (instrucción para Lovable):**
  1. Crear `src/features/legal/config.ts` con un flag único `LEGAL_CONTENT_APPROVED = false` (un solo lugar para voltear cuando legal entregue los textos finales).
  2. Mientras el flag sea `false`, las páginas `/legal/privacidad` y `/legal/terminos` NO muestran el cuerpo borrador: muestran un aviso neutro "Documento en revisión legal" + contacto. Las rutas permanecen montadas (no romper smoke test ni enlaces del footer).
  3. Mantener el banner de borrador ligado al MISMO flag (desaparece automáticamente al aprobar), no borrarlo a mano.
  4. Cuando legal entregue los textos: sustituir el cuerpo (incluyendo domicilio del responsable en "1. Responsable" — insumo humano) y voltear el flag a `true`.
- **Diff / código:**

Archivo nuevo `src/features/legal/config.ts`:

```ts
/**
 * UIB-08: el contenido legal (aviso de privacidad, términos) es BORRADOR y
 * requiere revisión/aprobación de asesoría legal (insumo humano — el código
 * no lo sustituye). Mientras este flag sea `false`, las páginas /legal/*
 * muestran un aviso "en revisión" SIN el texto borrador. Al recibir los
 * textos aprobados: pegarlos en Privacidad.tsx / Terminos.tsx (incluyendo el
 * domicilio del responsable, obligatorio LFPDPPP) y voltear a `true`.
 */
export const LEGAL_CONTENT_APPROVED = false;
```

`src/features/legal/routes/Privacidad.tsx` (mismo patrón en `Terminos.tsx`):

```diff
 import { Seo } from "@/components/shared/Seo";
 import { Link } from "react-router-dom";
 import { ArrowLeft } from "lucide-react";
 import { BrandLockup } from "@/components/layout/BrandLockup";
+import { LEGAL_CONTENT_APPROVED } from "@/features/legal/config";
```

```diff
         <p className="mt-2 text-sm text-muted-foreground">Última actualización: 4 de junio de 2026</p>
-        <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
-          Borrador — pendiente de revisión legal. Sustituir antes de producción.
-        </p>
 
-        <div className="prose prose-sm mt-8 max-w-none space-y-4 text-foreground/85">
+        {LEGAL_CONTENT_APPROVED ? (
+        <div className="prose prose-sm mt-8 max-w-none space-y-4 text-foreground/85">
           <h2 className="text-xl font-semibold">1. Responsable</h2>
           … (cuerpo existente, sin cambios — será sustituido por el texto
           aprobado por asesoría legal, incluyendo el domicilio del responsable) …
-        </div>
+        </div>
+        ) : (
+        <div className="mt-8 rounded-lg border border-border bg-muted/40 px-5 py-8 text-center">
+          <p className="text-sm text-foreground">
+            Este documento está en revisión legal y se publicará próximamente.
+          </p>
+          <p className="mt-2 text-xs text-muted-foreground">
+            Para cualquier duda sobre el tratamiento de tus datos, escríbenos a{" "}
+            <a className="text-accent hover:underline" href="mailto:contacto@librecarga.com">
+              contacto@librecarga.com
+            </a>.
+          </p>
+        </div>
+        )}
```

(El diff es esquemático por legibilidad — el cuerpo borrador actual se conserva intacto dentro de la rama `true` para no perder el trabajo previo; Lovable debe envolverlo, no reescribirlo. El banner amarillo de borrador se elimina porque queda sustituido por este gate.)

- **Tras aplicar, verificar:**
  1. `/legal/privacidad` y `/legal/terminos` ya NO muestran "Borrador" ni el texto preliminar; muestran el aviso "en revisión" con mailto funcional.
  2. Los enlaces del footer del landing y del checkbox del `DemoAccessDialog` (`/legal/privacidad`) siguen resolviendo (rutas intactas).
  3. `routes.smoke.test.tsx` en verde.
  4. **Pendiente humano (bloqueante para producción):** texto final aprobado por asesoría legal + domicilio del responsable → voltear `LEGAL_CONTENT_APPROVED = true`.

---

### [UIB-09] Error de carga del portal disfrazado de "cuenta no vinculada"

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (falso positivo). Estático: `PortalLayout.tsx:22-23` — `sinClienteVinculado = !cargandoVinculo && (clientUsers?.length ?? 0) === 0`: cuando la query **falla**, `clientUsers` es `undefined` → se interpreta como "0 empresas" y se muestra `PortalSinCliente` aunque la cuenta sí esté vinculada
- **Archivos:**
  - `src/features/portal/components/PortalLayout.tsx` (líneas 22-23, 55-61)
  - `src/components/shared/states/ErrorState.tsx` (componente estándar ya existente, con "Reintentar")
- **Problema:** un fallo transitorio de red/RLS en `usePortalClientUsers` presenta al cliente la pantalla "Tu cuenta aún no está vinculada a una empresa" — información falsa que le dice que su ejecutivo no lo ha activado. La página no distingue "consulta OK con 0 filas" de "consulta falló".
- **Fix (instrucción para Lovable):**
  1. Excluir el caso error del cálculo de `sinClienteVinculado` (sólo 0 filas **confirmado** cuenta como sin vínculo).
  2. Añadir una rama `errorVinculo` con `ErrorState` + `refetch` antes de la rama `sinClienteVinculado`.
- **Diff / código:**

`src/features/portal/components/PortalLayout.tsx`:

```diff
 import { usePortalClienteName, usePortalOrgName, usePortalClientUsers } from "@/features/portal/hooks";
 import { PortalSinCliente } from "./PortalSinCliente";
+import { ErrorState } from "@/components/shared/states/ErrorState";
```

```diff
-  const { data: clientUsers, isLoading: cargandoVinculo } = usePortalClientUsers();
-  const sinClienteVinculado = !cargandoVinculo && (clientUsers?.length ?? 0) === 0;
+  const {
+    data: clientUsers,
+    isLoading: cargandoVinculo,
+    isError: errorVinculo,
+    refetch: reintentarVinculo,
+  } = usePortalClientUsers();
+  // UIB-09: "sin empresa" sólo cuando la consulta SÍ respondió con 0 filas;
+  // un error de red no puede disfrazarse de cuenta no vinculada.
+  const sinClienteVinculado =
+    !cargandoVinculo && !errorVinculo && (clientUsers?.length ?? 0) === 0;
```

```diff
           {cargandoVinculo ? (
             <ListSkeleton rows={6} />
+          ) : errorVinculo ? (
+            <ErrorState
+              title="No pudimos cargar tu cuenta"
+              description="Revisa tu conexión e intenta de nuevo. Si el problema persiste, contacta a tu ejecutivo."
+              onRetry={() => void reintentarVinculo()}
+              className="my-10"
+            />
           ) : sinClienteVinculado ? (
             <PortalSinCliente email={user?.email} onSignOut={handleSignOut} />
           ) : (
             <Outlet />
           )}
```

- **Tras aplicar, verificar:**
  1. Forzar fallo de `client_users` (DevTools offline o bloqueo de request) y abrir `/portal` → aparece "No pudimos cargar tu cuenta" con Reintentar, NUNCA la pantalla de "no vinculada".
  2. Cuenta realmente sin vínculo (query OK, 0 filas) → sigue apareciendo `PortalSinCliente` (tests `PortalLayout.sinCliente.test.tsx` deben seguir en verde; si el mock no define `isError`, su default `false` mantiene el comportamiento).
  3. Reintentar tras recuperar red → entra al `<Outlet />`.

---

### [UIB-10] Saludo con razón social en MAYÚSCULAS en vez del contacto

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO. Estático: `PortalWelcomeCard.tsx` saluda con `clienteName`, que es `clientes.nombre` (razón social, frecuentemente capturada en mayúsculas: `identity.ts:21` sólo selecciona `clientes(nombre)`); el nombre de la persona existe en `clientes.contacto` (ya seleccionado en `perfil.ts:29`)
- **Archivos:**
  - `src/features/portal/services/identity.ts` (líneas 15-29, `fetchPortalClienteName`)
  - `src/features/portal/hooks/usePortalData.ts` (líneas 99-104, `usePortalClienteName`)
  - `src/features/portal/components/dashboard/PortalWelcomeCard.tsx` (saludo)
  - `src/features/portal/routes/PortalDashboard.tsx` (líneas 29, 56, consumidor)
- **Problema:** el dashboard del portal saluda "¡Hola, EMPRESA EJEMPLO SA DE CV!" — la razón social fiscal en vez de la persona que usa la plataforma; en mayúsculas se percibe como registro contable, no como saludo.
- **Fix (instrucción para Lovable):**
  1. En `identity.ts` agregar `fetchPortalContactoNombre()` (misma consulta, seleccionando `clientes(nombre, contacto)` y devolviendo `contacto`). No tocar `fetchPortalClienteName` (lo usan header/breadcrumbs).
  2. En `usePortalData.ts` agregar `usePortalContactoNombre()` con `queryKeys.portal` — registrar la clave nueva siguiendo el patrón existente (o reusar una clave compuesta existente si el equipo prefiere no tocar `lib/query`).
  3. En `PortalWelcomeCard`: saludar con el primer nombre del contacto cuando exista (`contacto.split(" ")[0]`, Title Case); si no, mantener el comportamiento actual (razón social / "Bienvenido").
- **Diff / código:**

`src/features/portal/services/identity.ts` — DESPUÉS (función nueva, junto a `fetchPortalClienteName`):

```ts
/** UIB-10: nombre de la persona de contacto para el saludo del dashboard. */
export async function fetchPortalContactoNombre(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const data = await unwrap(
    supabase
      .from("client_users")
      .select("cliente_id, clientes(contacto)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  );
  const clientes = fromDb<{ contacto: string | null } | null>(data?.clientes);
  return clientes?.contacto ?? null;
}
```

`src/features/portal/components/dashboard/PortalWelcomeCard.tsx`:

```diff
 interface Props {
   clienteName?: string | null;
+  contactoName?: string | null;
   orgName?: string | null;
 }
 
-export function PortalWelcomeCard({ clienteName, orgName }: Props) {
+export function PortalWelcomeCard({ clienteName, contactoName, orgName }: Props) {
+  // UIB-10: saludar a la persona, no a la razón social fiscal.
+  const primerNombre = contactoName?.trim().split(/\s+/)[0];
+  const saludo = primerNombre
+    ? `¡Hola, ${primerNombre.charAt(0).toUpperCase()}${primerNombre.slice(1).toLowerCase()}!`
+    : clienteName ? `¡Hola, ${clienteName}!` : "Bienvenido";
   return (
     <div className="bg-gradient-to-r from-accent/5 via-accent/3 to-transparent rounded-xl px-5 py-4 border">
       <h1 className="text-xl font-bold tracking-tight">
-        {clienteName ? `¡Hola, ${clienteName}!` : "Bienvenido"}
+        {saludo}
       </h1>
```

`src/features/portal/routes/PortalDashboard.tsx`:

```diff
-  const { data: clienteName } = usePortalClienteName();
+  const { data: clienteName } = usePortalClienteName();
+  const { data: contactoName } = usePortalContactoNombre();
```

```diff
-          <PortalWelcomeCard clienteName={clienteName} orgName={orgName} />
+          <PortalWelcomeCard clienteName={clienteName} contactoName={contactoName} orgName={orgName} />
```

- **Tras aplicar, verificar:**
  1. `/portal` con cliente que tiene `contacto = "Juan Pérez"` → "¡Hola, Juan!" (no la razón social).
  2. Cliente sin `contacto` → fallback al comportamiento anterior (razón social / "Bienvenido").
  3. El header y breadcrumbs del portal siguen mostrando la razón social (correcto ahí).

---

### [UIB-11] Códigos técnicos sin nombre: naviera "MAEU", rutas "CNSHA→MXZLO"

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (portal embarques). Estático: `EmbarqueCard.tsx:54` renderiza `e.naviera` crudo (SCAC); `getOrigen/getDestino` (`lib/formatters/places.ts:4-9`) devuelven el valor de `puerto_origen/destino` tal cual (UN/LOCODE cuando se capturó con `PortSelect`); `PortalEmbarqueResumenTab.tsx:73` y `transporteLabel` en `TrackingPublico.tsx:17-19` repiten el patrón
- **Archivos:**
  - `src/features/portal/components/EmbarqueCard.tsx` (líneas 54, ~93-102: render de carrier y ruta)
  - `src/features/portal/components/embarqueDetalle/PortalEmbarqueResumenTab.tsx` (líneas 71-73)
  - `src/features/auth/routes/TrackingPublico.tsx` (líneas 17-19, 57, 66-67)
  - `src/lib/formatters/places.ts` (líneas 4-9)
  - Catálogos existentes a reusar: `features/catalogos/services/index.ts` (`fetchNavieras` code+name, `fetchPuertos` code+name+country)
- **Problema:** el cliente ve identificadores de industria (SCAC de naviera, UN/LOCODE de puerto) en lugar de nombres legibles. En la DB ya existen catálogos globales `navieras` (code, name) y `puertos` (code, name, country) — el portal no los consulta al renderizar.
- **Fix (instrucción para Lovable):**
  1. Crear `src/lib/formatters/carrierLabels.ts` con un mapa estático de SCAC frecuentes → nombre comercial (MAEU→Maersk, MSCU→MSC, COSU→COSCO Shipping, HLCU→Hapag-Lloyd, EGLV→Evergreen, CMDU→CMA CGM, ONEY→ONE, ZIMU→ZIM) y `labelNaviera(code)` que devuelva `"Nombre (CODE)"` cuando hay mapeo y el código tal cual cuando no. Mapa estático = cero riesgo de RLS y funciona también en la superficie pública de tracking.
  2. Usarlo en `EmbarqueCard` (carrier), `PortalEmbarqueResumenTab` (dd naviera) y `transporteLabel` de `TrackingPublico`.
  3. Para puertos: en el portal autenticado, resolver el LOCODE contra el catálogo `puertos` vía un hook ligero (`usePuertos` ya existe en `features/catalogos/hooks`); fallback: código + `title` con el valor. **Verificar en staging** que el rol `cliente` del portal tiene SELECT por RLS sobre `puertos`; si no lo tiene, dejar como mejora de backend (que las vistas/edge del portal ya devuelvan el nombre) y aplicar en esta ola sólo el paso 1-2.
- **Diff / código:**

Archivo nuevo `src/lib/formatters/carrierLabels.ts`:

```ts
/**
 * UIB-11: etiquetas legibles para códigos de naviera (SCAC) en superficies
 * de cliente. Mapa estático deliberado: sin dependencia de RLS/catálogo y
 * disponible también para el tracking público. Si el código no está mapeado
 * se muestra tal cual (mejor código conocido que silencio).
 */
const SCAC_NAVIERAS: Record<string, string> = {
  MAEU: "Maersk",
  MSCU: "MSC",
  COSU: "COSCO Shipping",
  HLCU: "Hapag-Lloyd",
  EGLV: "Evergreen",
  CMDU: "CMA CGM",
  ONEY: "ONE",
  ZIMU: "ZIM",
};

export function labelNaviera(code: string | null | undefined): string {
  if (!code) return "—";
  const nombre = SCAC_NAVIERAS[code.trim().toUpperCase()];
  return nombre ? `${nombre} (${code.trim().toUpperCase()})` : code;
}
```

`src/features/auth/routes/TrackingPublico.tsx`:

```diff
-import { getOrigen, getDestino } from "@/lib/formatters";
+import { getOrigen, getDestino } from "@/lib/formatters";
+import { labelNaviera } from "@/lib/formatters/carrierLabels";
 
 function transporteLabel(e: TrackingPublicoData["embarque"]): string {
-  return e.naviera || e.aerolinea || e.transportista || "—";
+  // UIB-11: SCAC crudo ("MAEU") → "Maersk (MAEU)"; aéreo/terrestre ya son texto libre.
+  if (e.naviera) return labelNaviera(e.naviera);
+  return e.aerolinea || e.transportista || "—";
 }
```

`src/features/portal/components/EmbarqueCard.tsx`:

```diff
-  const carrier = e.naviera || e.aerolinea || e.transportista;
+  const carrier = e.naviera ? labelNaviera(e.naviera) : (e.aerolinea || e.transportista);
```

(`PortalEmbarqueResumenTab.tsx:73`: mismo reemplazo en el `<dd>` de naviera.)

- **Tras aplicar, verificar:**
  1. Portal → Embarques: tarjeta con naviera MAEU muestra "Maersk (MAEU)"; naviera no mapeada muestra el código (fallback, sin regresión).
  2. `/tracking/<token>` muestra el nombre en "Transporte".
  3. **Verificar en staging:** SELECT de `puertos`/`navieras` con sesión de cliente de portal (RLS) para decidir si el mapeo de puertos LOCODE→nombre se hace en frontend esta ola o queda como ticket de backend.

---

### [UIB-12] Badge "Tracking N" no coincide con los eventos visibles de la línea de tiempo

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (badge "3", línea de tiempo con 1 evento). Estático: `PortalEmbarqueDetalle.tsx:118-120` cuenta `eventos.length` crudo, pero `PortalEmbarqueTimeline.tsx:32-33` renderiza `filtrarEventosVisiblesCliente(eventos)` (sólo hitos de negocio, sin internos — P2-6.4)
- **Archivos:**
  - `src/features/portal/routes/PortalEmbarqueDetalle.tsx` (líneas 13, 116-121, 134-136)
  - `src/features/portal/components/PortalEmbarqueTimeline.tsx` (líneas 31-33, el filtro correcto)
  - `src/features/portal/domain/eventosVisiblesCliente.ts` (filtro puro existente, a importar)
- **Problema:** el contador del tab promete N eventos y la lista muestra menos (los internos/filtrados). Inconsistencia visible que el cliente interpreta como datos perdidos o bug.
- **Fix (instrucción para Lovable):**
  1. Calcular el badge con el MISMO filtro que el timeline (`filtrarEventosVisiblesCliente`), una sola vez antes del `return`, y usarlo en el badge.
- **Diff / código:**

`src/features/portal/routes/PortalEmbarqueDetalle.tsx`:

```diff
 import { PortalEmbarqueStepper } from "@/features/portal/components/embarqueDetalle/PortalEmbarqueStepper";
+import { filtrarEventosVisiblesCliente } from "@/features/portal/domain/eventosVisiblesCliente";
```

```diff
   if (!embarque) {
     return (
       <EmptyState
         icon={Ship}
         title="Embarque no encontrado"
         primaryAction={{ label: "Volver", onClick: volver, variant: "outline" }}
       />
     );
   }
 
+  // UIB-12: el badge del tab debe contar lo mismo que la línea de tiempo
+  // muestra (hitos visibles para el cliente), no los eventos crudos.
+  const eventosVisiblesCount = filtrarEventosVisiblesCliente(eventos).length;
+
```

```diff
           <TabsTrigger value="tracking" className="relative">
             Tracking
-            {eventos.length > 0 && (
-              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-2xs px-1.5 font-bold">{eventos.length}</span>
+            {eventosVisiblesCount > 0 && (
+              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-2xs px-1.5 font-bold">{eventosVisiblesCount}</span>
             )}
           </TabsTrigger>
```

- **Tras aplicar, verificar:**
  1. Detalle de embarque con eventos mixtos (hitos + internos/seed) → el número del badge coincide exactamente con las filas de la línea de tiempo.
  2. Embarque con sólo eventos internos → el badge desaparece y el tab muestra el empty state "No hay eventos registrados aún." (ya existente).

---

### [UIB-13] Cotización "Solicitada" muestra "MXN 0.00" prominente

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (`/portal/cotizaciones`). Estático: `PortalCotizacionCard.tsx:45-48` — sin conceptos parseables, `totalLista = Number(c.subtotal ?? 0)`; una solicitud recién creada no tiene conceptos ni subtotal → `formatCurrency(0, "MXN")` en negrita (líneas 126-128)
- **Archivos:**
  - `src/features/portal/components/PortalCotizacionCard.tsx` (líneas 45-48, 126-128)
- **Problema:** una cotización en estado "Solicitada" aún no tiene precio, pero la tarjeta destaca "MXN 0.00" — el cliente puede leerlo como "gratis" o como error de cálculo.
- **Fix (instrucción para Lovable):**
  1. Cuando el total derivado sea 0 (sin conceptos y sin subtotal), mostrar la etiqueta neutral "Por cotizar" en vez del monto. El cambio es presentacional y cubre cualquier estado sin importe aún (no hay que acoplarlo al literal del estado).
- **Diff / código:**

`src/features/portal/components/PortalCotizacionCard.tsx`:

```diff
           <p className="text-sm font-bold tabular-nums shrink-0 text-right min-w-[110px]">
-            {formatCurrency(totalLista, c.moneda)}
+            {/* UIB-13: una solicitud sin conceptos no vale "MXN 0.00" — está por cotizar. */}
+            {totalLista > 0 ? (
+              formatCurrency(totalLista, c.moneda)
+            ) : (
+              <span className="text-xs font-medium text-muted-foreground">Por cotizar</span>
+            )}
           </p>
```

- **Tras aplicar, verificar:**
  1. Solicitar una cotización nueva desde el portal → la tarjeta muestra "Por cotizar" en lugar de "MXN 0.00".
  2. Cotización con conceptos (Enviada/Aceptada) → sigue mostrando el total con moneda (B-099 intacto).
  3. Detalle de la cotización (`/portal/cotizaciones/:id`) sin cambios.

---

### [UIB-14] Vigencias de tarifas en formato ISO en `/agente/tarifas`

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO. Estático: `agenteTarifasColumns.tsx:117` interpola `vigente_desde`/`vigente_hasta` crudos ("2026-06-01 → 2026-09-01") mientras el resto de la app usa `formatDate` dd/MM/yy (p.ej. `EmbarqueCard.tsx` con `"dd/MM/yy"`)
- **Archivos:**
  - `src/features/portal-agente/routes/_sections/agenteTarifasColumns.tsx` (líneas 14, 111-118)
- **Problema:** inconsistencia de formato de fecha en superficie de agente: ISO crudo vs. el formato corto local usado en todo el producto. Ruido visual y menor legibilidad (ISO confunde día/mes a usuarios es-MX).
- **Fix (instrucción para Lovable):**
  1. Formatear la celda con `formatDate` (ya exportado desde `@/lib/formatters`; maneja vacío → "-" y parseo seguro).
- **Diff / código:**

`src/features/portal-agente/routes/_sections/agenteTarifasColumns.tsx`:

```diff
 import { formatNumber } from "@/lib/formatters/numbers";
+import { formatDate } from "@/lib/formatters";
```

```diff
       meta: { className: "text-xs text-muted-foreground" },
-      cell: ({ row }) => `${row.original.vigente_desde} → ${row.original.vigente_hasta}`,
+      // UIB-14: mismo formato corto que el resto de la app (dd/MM/yy), no ISO crudo.
+      cell: ({ row }) =>
+        `${formatDate(row.original.vigente_desde, "dd/MM/yy")} → ${formatDate(row.original.vigente_hasta, "dd/MM/yy")}`,
     },
```

- **Tras aplicar, verificar:**
  1. `/agente/tarifas` → la columna Vigencia muestra p.ej. "01/06/26 → 01/09/26".
  2. El ordenamiento de la columna sigue funcionando (usa `accessorFn`/`sortByDate` sobre el valor crudo — no se toca).
  3. El form de duplicar/editar recibe los valores ISO originales vía `toInitial` (no se toca).

---

### [UIB-15] Patrón transversal: `error.message` crudo del backend en formularios públicos

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (p.ej. "permission denied for table demo_leads" visible). **Referencia cruzada:** es la clase pública del patrón **UX-02** (`error.message` crudo) — el fix estructural y el inventario completo de call sites internos vive en `fixes_UX.md` [UX-02]; aquí se cubren únicamente los archivos de superficie PÚBLICA
- **Archivos:** (superficie pública)
  - `src/features/marketing/components/DemoAccessDialog.tsx` (línea 81 — **cubierto por UIB-01**, mismo diff)
  - `src/features/marketing/services/demoLeads.ts` (línea 34 — `throw new Error(error.message)` propaga el crudo de PostgREST)
  - `src/features/auth/routes/TrackingPublico.tsx` (línea 27 — **cubierto por UIB-06**, el mapeo vive en `TrackingPublicoErrorCard`)
  - `src/features/auth/routes/Unsubscribe.tsx` (línea 54 — `setErrorMsg((e as Error).message)`)
  - `src/lib/auth/translateAuthError.ts` (línea 36 — `return message` como fallback crudo; parcialmente cubierto por UIB-02/03)
- **Problema:** en superficies sin sesión, el mensaje de error del backend (PostgREST/edge/Auth) llega crudo al usuario final: jerga en inglés, nombres de tablas y códigos internos. Es el hallazgo transversal detrás de UIB-01/02/06 y aplica también a `Unsubscribe`.
- **Fix (instrucción para Lovable):**
  1. **UIB-01 (DemoAccessDialog) y UIB-06 (TrackingPublico) ya resuelven sus call sites** — no duplicar trabajo; este hallazgo sólo agrega los puntos restantes.
  2. `Unsubscribe.tsx`: sustituir el mensaje crudo por copy fijo es-MX en el estado `error` (el detalle técnico no aporta nada al destinatario de un correo de baja).
  3. `translateAuthError.ts`: el fallback final NO debe devolver el mensaje crudo; devolver un genérico es-MX (el crudo sigue disponible en consola/Sentry por los call sites que pasan `error`). Ojo: hay tests que pueden asertar el passthrough — revisar `lib/auth/__tests__` y ajustar expectativas.
  4. `demoLeads.ts`: lanzar el error con un mensaje propio y adjuntar el crudo como `cause` para diagnóstico.
- **Diff / código:**

`src/features/auth/routes/Unsubscribe.tsx`:

```diff
     } catch (e) {
-      setErrorMsg((e as Error).message);
+      // UIB-15 (UX-02): superficie pública — nunca error.message crudo.
+      console.error("[unsubscribe]", e);
+      setErrorMsg("No pudimos procesar la baja. Intenta de nuevo en unos minutos.");
       setStatus("error");
     }
```

`src/lib/auth/translateAuthError.ts`:

```diff
   if (m.includes("token has expired") || m.includes("invalid token")) {
     return "El enlace expiró o no es válido. Solicita uno nuevo.";
   }
-  return message;
+  // UIB-15 (UX-02): nunca devolver el mensaje crudo del backend a la vista.
+  return "Ocurrió un error inesperado. Intenta de nuevo.";
 }
```

`src/features/marketing/services/demoLeads.ts`:

```diff
-  if (error) throw new Error(error.message);
+  // UIB-15: el crudo de PostgREST (p.ej. "permission denied for table
+  // demo_leads") va como `cause` para diagnóstico, no al usuario.
+  if (error) {
+    throw new Error("No pudimos registrar tus datos de contacto.", { cause: error });
+  }
```

- **Tras aplicar, verificar:**
  1. `/unsubscribe?token=…` con la edge fallando → copy es-MX, sin `error.message` en pantalla.
  2. Forzar `permission denied` en `demo_leads` (o bloquear la request) → el modal demo muestra el copy de UIB-01; `error.cause` conserva el detalle (visible en "Ver detalles"/Sentry, no en la vista).
  3. Correr los tests de `translateAuthError` y ajustar el caso de fallback si asertaba passthrough.
  4. **Verificar en staging** (stack local con edges 501): repetir los flujos contra las funciones reales y confirmar que ningún `body.error` nuevo se cuela crudo; si aparecen literales nuevos, extender los mapeos de UIB-01/UIB-06.

---

## Resumen de validación

| ID | Verificado en repo (archivos clave leídos) | Tipo de fix |
|---|---|---|
| UIB-01 | `DemoAccessDialog.tsx:80-90`, `demoAccess.ts`, patrón `facturapiError.ts` | Diff unificado |
| UIB-02 | `LoginForm.tsx:27-49`, `translateAuthError.ts:5-37` | Diff unificado |
| UIB-03 | `LoginForm.tsx:27-66` (`noValidate` confirma falta de validación) | Diff unificado |
| UIB-04 | `DemoModeBanner.tsx:19`, `App.tsx:48`, `demoAccess.ts` (docstring reinicio) | Diff unificado + verificar en staging |
| UIB-05 | `PortalPerfil.tsx:24-42`, patrón `LoadingState` de `PortalCotizaciones.tsx:54-64` | Diff unificado (x-ref UX-05) |
| UIB-06 | `TrackingPublico.tsx:27`, `TrackingPublicoErrorCard.tsx`, `tracking/index.ts:45-52` | Diff unificado + verificar en staging (501 local) |
| UIB-07 | `publicRoutes.tsx:33`, `LogoPreview.tsx:6`, smoke test no lo exige | Diff unificado |
| UIB-08 | `Privacidad.tsx`, `Terminos.tsx` (banner borrador), smoke test exige rutas | Flag de config + gate de contenido; texto legal = insumo humano |
| UIB-09 | `PortalLayout.tsx:22-23, 55-61`, `ErrorState.tsx` existente | Diff unificado |
| UIB-10 | `PortalWelcomeCard.tsx`, `identity.ts:15-29`, `perfil.ts:29` (campo `contacto` existe) | Diffs + función nueva |
| UIB-11 | `EmbarqueCard.tsx:54`, `places.ts:4-9`, catálogos `navieras`/`puertos` existentes | Helper nuevo estático + verificar RLS en staging |
| UIB-12 | `PortalEmbarqueDetalle.tsx:116-121`, `PortalEmbarqueTimeline.tsx:32-33`, `eventosVisiblesCliente.ts` | Diff unificado |
| UIB-13 | `PortalCotizacionCard.tsx:45-48, 126-128` | Diff unificado |
| UIB-14 | `agenteTarifasColumns.tsx:14, 111-118`, `formatDate` en `lib/formatters/dates.ts` | Diff unificado |
| UIB-15 | `DemoAccessDialog.tsx:81`, `demoLeads.ts:34`, `TrackingPublico.tsx:27`, `Unsubscribe.tsx:54`, `translateAuthError.ts:36` | X-ref UX-02 + diffs en archivos públicos |

**Total: 15/15 IDs cubiertos.** Sin divergencias respecto a la fuente. Dependencias del stack local (edge 501 en `demo-access` y `tracking-public`; RLS de catálogos para el rol cliente; re-sembrado real de la demo) quedan marcadas explícitamente como **verificar en staging** dentro de cada hallazgo.


# Línea TC + N — Toolchain y verificación API

# Fix Pack — Toolchain/Tests (TC-01..TC-04) + Verificación API (N1, N2)

**Repo:** `/mnt/agents/repo` (main @ 1ef05ce9) · **Fuentes:** `audit_reports/05_toolchain_tests.md`, `audit_reports/06_verificacion_api_rls.md`
**Instrucciones dirigidas a Lovable.** Cada entrada fue verificada contra el repo real.

---

### [TC-01] Tests requieren Node ≥22 (WebSocket nativo) — documentación desactualizada
- **Severidad:** P3 · **Verificación:** confirmado en fuente (H1): 33 suites fallan en collect bajo Node 20; re-run con polyfill WebSocket → 254/254 verdes. No es bug del código.
- **Archivos:** `README.md` (línea 44), `package.json` (raíz), opcional `src/test/setup.node.ts`
- **Problema:** `README.md` dice "Requisitos: Node.js 20+", pero `@supabase/realtime-js` (inicializado a nivel de módulo en `src/integrations/supabase/client.ts:11`) exige `WebSocket` nativo global, estable solo desde Node 22. La propia dependencia lo declara (`EBADENGINE @supabase/storage-js required: node >=22`). Bajo Node 20, 33 archivos de tests del proyecto `node` de Vitest mueren en collect con `Node.js detected but native WebSocket not found`.
- **Fix (instrucción para Lovable):**
  1. Corregir el requisito documentado en `README.md` (diff abajo): Node.js **22+** o Bun.
  2. Añadir campo `engines` en `package.json` para que npm/bun avisen al instalar con un runtime incompatible.
  3. (Opcional, robustez) Polyfill de `WebSocket` solo para el proyecto `node` de Vitest en `src/test/setup.node.ts`, para contribuidores atrapados en Node 20. **No** tocar `src/integrations/supabase/client.ts` (cambiar el `createClient` de nivel módulo es riesgo innecesario; CI ya corre con Bun/Node 22).
- **Diff / código:**

`README.md`:
```diff
-Requisitos: Node.js 20+ y `npm` o `bun`.
+Requisitos: Node.js 22+ y `npm` o `bun`.
+> Node 20 NO es compatible: `@supabase/realtime-js` requiere `WebSocket`
+> nativo global (estable desde Node 22). Bajo Node 20, 33 suites de tests
+> del proyecto `node` de Vitest fallan en collect. CI corre con Bun.
```

`package.json` (tras `"type": "module",`):
```diff
   "type": "module",
+  "engines": {
+    "node": ">=22"
+  },
   "sideEffects": [
```

Opcional — `src/test/setup.node.ts` (al final del archivo, junto al shim de storage):
```diff
 const g = globalThis as unknown as Record<string, unknown>;
 if (typeof g.localStorage === "undefined") g.localStorage = createMemoryStorage();
 if (typeof g.sessionStorage === "undefined") g.sessionStorage = createMemoryStorage();
+
+// Polyfill WebSocket para Node 20 (ver README: se requiere Node 22+).
+// Solo aplica a tests; en Node 22+/Bun `WebSocket` ya existe y esto es no-op.
+// Requiere `undici` resolvable (ya viene transitiva vía supabase-js; si no,
+// `npm i -D undici`).
+if (typeof g.WebSocket === "undefined") {
+  try {
+    // eslint-disable-next-line @typescript-eslint/no-require-imports
+    const { WebSocket } = require("undici") as typeof import("undici");
+    g.WebSocket = WebSocket;
+  } catch { /* Node 22+/Bun o undici ausente: nada que hacer */ }
+}
```
- **Tras aplicar, verificar:** `npm install` emite warning de engine bajo Node 20 y es silencioso en Node 22+/Bun. Con polyfill: `NODE_OPTIONS="--max-old-space-size=8192" npx vitest run --project node` en Node 20 → 0 fallos de collect por WebSocket. En Node 22/Bun la suite completa sigue 1016/1016 archivos verdes.

---

### [TC-02] Build de producción requiere >4 GB RAM — sourcemaps no desactivables
- **Severidad:** P2 · **Verificación:** confirmado en fuente (H2): `vite build` tal cual muere con OOM (exit 137) en 4 GB; **sin** sourcemaps pasa en 1m42s, `verify-html-bundle OK`. El grafo compila íntegro: no hay blocker en el código.
- **Archivos:** `vite.config.ts` (línea 97), `package.json` (scripts), `README.md` (sección Desarrollo local)
- **Problema:** `build.sourcemap` está hardcodeado a `'hidden'` en producción y `minify: 'terser'`; 291 chunks con sourcemaps ocultos + worker de terser exceden 4 GB. No hay vía oficial de construir en entornos con poca RAM ni requisito documentado.
- **Fix (instrucción para Lovable):**
  1. Hacer el sourcemap de producción controlable por env `BUILD_SOURCEMAPS` (default: comportamiento actual, CI/Sentry intactos).
  2. Añadir script `build:low-mem` que lo desactive.
  3. Documentar el requisito de RAM (~8 GB con sourcemaps) en `README.md`.
- **Diff / código:**

`vite.config.ts` (línea 97):
```diff
-    sourcemap: mode === "production" ? "hidden" : true,
+    // TC-02: 'hidden' + terser en ~291 chunks requiere >4 GB de RAM. En
+    // entornos con poca memoria usar `BUILD_SOURCEMAPS=false` (script
+    // `build:low-mem`): el bundle queda idéntico pero sin .map ni upload a
+    // Sentry. Default sin cambios para CI/producción.
+    sourcemap:
+      mode === "production"
+        ? process.env.BUILD_SOURCEMAPS === "false"
+          ? false
+          : "hidden"
+        : true,
```

`package.json` (junto a `"build"`):
```diff
     "build": "vite build",
+    "build:low-mem": "BUILD_SOURCEMAPS=false vite build",
```

`README.md` (bajo la línea de Requisitos corregida en TC-01):
```diff
+Build de producción: `npm run build` con sourcemaps requiere ~8 GB de RAM
+(runners de CI: 16 GB). En entornos con ≤4 GB usar `npm run build:low-mem`
+(sin sourcemaps; el bundle es funcionalmente idéntico).
```
- **Tras aplicar, verificar:** `npm run build` (con 8+ GB) sigue generando `.map` ocultos y el upload de Sentry funciona. `npm run build:low-mem` en entorno de 4 GB termina con exit 0 y el log muestra `verify-html-bundle OK`; `dist/assets` no contiene `.map`. `bash scripts/check-bundle-size.sh` pasa en ambos casos.

---

### [TC-03] Directivas `"use memo"` ignoradas por el bundler en 6 rutas
- **Severidad:** P3 · **Verificación:** confirmado en fuente (H3): warnings `Module level directives cause errors when bundled, "use memo" ... was ignored` en build. Verificado en repo: las 6 directivas existen y `vite.config.ts` **no** cablea `babel-plugin-react-compiler` (solo está como devDependency), así que la directiva está muerta de todos modos.
- **Archivos:** `src/features/dashboard/routes/Dashboard.tsx:1`, `src/features/embarques/routes/EmbarqueDetalle.tsx:1`, `src/features/cotizacion/routes/CotizacionPlantillas.tsx:5`, `src/features/cliente/routes/ClienteDetalle.tsx:1`, `src/features/crm/routes/Oportunidades.tsx:1`, `src/features/crm/routes/CrmDashboard.tsx:1`
- **Problema:** La directiva `"use memo"` (React Compiler) a nivel de módulo es ignorada por el bundler: genera ruido en el log de build y falsa expectativa de memoización. Como el plugin Babel del compiler no está configurado en Vite, la directiva no tiene efecto ni siquiera en dev.
- **Fix (instrucción para Lovable):** eliminar la línea `"use memo";` de los 6 archivos (conservando los comentarios de cabecera). No reubicarla: sin el plugin del compiler no hay destino válido, y activar el compiler es un proyecto aparte fuera de alcance.
- **Diff / código:**
```diff
# src/features/dashboard/routes/Dashboard.tsx
-"use memo";
 import { Link } from "react-router-dom";

# src/features/embarques/routes/EmbarqueDetalle.tsx
-"use memo";
 import { useParams } from "react-router-dom";

# src/features/cotizacion/routes/CotizacionPlantillas.tsx
 /**
  * CotizacionPlantillas — Gestión de plantillas de cotización (P2 cierre v13.296.0).
  * Refactor v13.297.4: tabla y dialog extraídos a `components/plantillas/*`.
  */
-"use memo";
 import { useMemo, useState } from "react";

# src/features/cliente/routes/ClienteDetalle.tsx
-"use memo";
 import { useParams } from "react-router-dom";

# src/features/crm/routes/Oportunidades.tsx
-"use memo";
 /**
  * /crm/oportunidades — Pipeline con vista Kanban (DnD) y tabla.

# src/features/crm/routes/CrmDashboard.tsx
-"use memo";
 /**
  * /crm — Resumen ejecutivo del CRM.
```
- **Tras aplicar, verificar:** `grep -rn '"use memo"' src/` no devuelve resultados; `npm run build` ya no emite warnings `Module level directives... "use memo"`; `npm run lint`, `npm run typecheck` y `npm run test` siguen en verde (la directiva no tenía efecto funcional).

---

### [TC-04] Warning de chunk `react-pdf.browser` (1.3 MB) — falso positivo conocido
- **Severidad:** P3 · **Verificación:** confirmado en fuente (H4): chunk `dist/assets/react-pdf.browser-*.js` = 1,327 kB > `chunkSizeWarningLimit: 350`. Verificado en repo: `@react-pdf/renderer` solo se alcanza vía dynamic imports (`PdfPreview`, `descargarPdf`, `ProfitDashboardEjecutivo`, etc.); los imports estáticos en `src/pdf/**` y `src/generators/*Pdf*` cuelgan de esos entry points lazy (p. ej. `estadoCuentaPdf.ts` usa print-to-PDF, sin `@react-pdf`). El gate de CI `scripts/check-bundle-size.sh` ya tiene excepción gzip de 500 KB para `react-pdf*`.
- **Archivos:** `vite.config.ts` (líneas 105–108)
- **Problema:** `build.chunkSizeWarningLimit` es global (350 kB, sin compresión) y Vite no soporta excepciones por chunk, así que el warning de `react-pdf.browser` (1.3 MB sin comprimir, ~465 KB gz) aparecerá siempre aunque el chunk es lazy y está dentro de budget gzip. Riesgo: fatiga de warnings que esconda regresiones reales, o que alguien "lo arregle" reintroduciendo `manualChunks` (el comentario en `vite.config.ts` documenta que eso rompe producción con `Cannot access 'n' before initialization`).
- **Fix (instrucción para Lovable):** no tocar el límite (subirlo escondería regresiones en otros chunks) ni reintroducir `manualChunks`. Documentar la excepción junto al límite, apuntando al gate de CI que sí es por-chunk y en gzip.
- **Diff / código:**

`vite.config.ts`:
```diff
     // Bajar de 500 → 350 kB fuerza disciplina de split. Si un chunk supera
     // este umbral, Vite emite warning en build (no rompe el CI, pero queda
     // visible en logs y en el bundle-size gate del workflow).
+    // TC-04 · Excepción conocida: `react-pdf.browser-*.js` (~1.3 MB sin
+    // comprimir) SIEMPRE supera este umbral. Es esperado: @react-pdf/renderer
+    // es intrínsecamente grande, solo se carga lazy (dynamic imports) y el
+    // gate real por chunk es scripts/check-bundle-size.sh en CI (budget gzip
+    // 500 KB para react-pdf*). NO "arreglar" subiendo este límite ni
+    // reintroduciendo manualChunks (ver NOTA abajo: rompe producción).
     chunkSizeWarningLimit: 350,
```
- **Tras aplicar, verificar:** `npm run build` sigue emitiendo el warning de `react-pdf.browser` (esperado y ahora documentado) y ningún otro warning de chunk nuevo. `bash scripts/check-bundle-size.sh` pasa (entry ≤350 KB gz, react-pdf ≤500 KB gz). Verificar que ninguna ruta importa estáticamente `@react-pdf/renderer`: `grep -rn 'from "@react-pdf/renderer"' src/features --include="*.tsx" | grep -v "import(" | grep -v __tests__` no debe devolver rutas/providers.

---

### [N1] `log_client_error_v1` inllamable vía PostgREST por overload ambiguo (PGRST203)
- **Severidad:** P1 (bloqueante) · **Verificación:** confirmado dinámicamente en fuente (test F/N1): toda llamada `POST /rest/v1/rpc/log_client_error_v1` devuelve `PGRST203 Could not choose the best candidate function between ...p_request_id => text / => uuid`. La edge function `client-error-log` (`supabase/functions/client-error-log/index.ts:131`) llama el RPC con `requestId: string` → **también rota en producción**: logging de errores de cliente caído end-to-end y rate limit de 20/min inalcanzable vía API.
- **Archivos:** NUEVA migración `supabase/migrations/20260813130000_fix_n1_log_client_error.sql` (ver nota de orden abajo). Esquema canónico vigente: `supabase/migrations/20260811231247_1fcb26c9-3053-442c-83af-87b39a381519.sql` (versión `uuid` con rate limit). Afectado en runtime: `supabase/functions/client-error-log/index.ts` (sin cambio de código necesario).
- **Problema:** La BD desplegada tiene DOS sobrecargas: `log_client_error_v1(text,text,text,text,text,text,text)` (legacy, **sin rate limit**) y `...(text,text,text,text,text,text,uuid)` (con rate limit). PostgREST no puede desambiguar → PGRST203 en el 100% de las llamadas. **Deriva migraciones↔esquema real (parte del hallazgo):** en el repo, la sobrecarga `text` se crea en `20260601174336` y `20260615222120` y se elimina en `20260615225019` (`DROP FUNCTION IF EXISTS public.log_client_error_v1(text, text, text, text, text, text, text)`); desde entonces solo la firma `uuid` existe en migraciones. Que la sobrecarga `text` siga viva en la BD desplegada implica recreación manual fuera de migraciones o una migración no aplicada.
- **Fix (instrucción para Lovable):**
  1. **Antes de escribir nada, verificar en producción** qué sobrecargas existen realmente:
     ```sql
     -- psql: \df+ public.log_client_error_v1
     -- o vía SQL:
     SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args,
            p.prosecdef, l.lanname
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     JOIN pg_language l ON l.oid = p.prolang
     WHERE n.nspname = 'public' AND p.proname = 'log_client_error_v1';
     ```
     Si solo aparece la firma `…, uuid`, la deriva ya se resolvió por otra vía: aplicar igualmente la migración (es idempotente) y cerrar el hallazgo.
  2. Crear la migración con `DROP … IF EXISTS` de la sobrecarga `text` (idempotente) y re-anclar grants de la firma canónica `uuid`.
  3. **Nota de orden:** el nombre pedido `20260813130000_…` queda ANTES de las últimas migraciones del repo (`20260819120100_…`). Ninguna migración posterior toca esta función, así que el replay completo es seguro; si Lovable/Supabase CLI exige timestamps posteriores al último, renombrar a `20260820120000_fix_n1_log_client_error.sql` con el mismo contenido.
  4. No tocar `client-error-log/index.ts`: con una sola firma, el RPC con `p_request_id: string` se resuelve y castea a `uuid` (el requestId lo genera la propia edge function como UUID).
- **Diff / código:** nuevo archivo `supabase/migrations/20260813130000_fix_n1_log_client_error.sql`:
```sql
-- fix_n1_log_client_error
-- N1 (P1): la BD desplegada conserva la sobrecarga legacy
-- public.log_client_error_v1(text,text,text,text,text,text,TEXT) además de
-- la canónica (…,uuid) con rate limit de 20260811231247. PostgREST devuelve
-- PGRST203 (overload ambiguo) en el 100% de las llamadas y la edge function
-- client-error-log también falla: logging de errores de cliente roto E2E.
--
-- La migración 20260615225019 ya hizo este DROP, por lo que su presencia en
-- la BD real evidencia deriva esquema↔migraciones (recreación manual fuera de
-- migraciones). Este DROP es IF EXISTS: idempotente y seguro de re-aplicar.

DROP FUNCTION IF EXISTS public.log_client_error_v1(text, text, text, text, text, text, text);

-- Re-anclar permisos de la firma canónica (idempotente; no recrea la función).
REVOKE ALL ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, uuid) TO anon, authenticated, service_role;
```
- **Tras aplicar, verificar:**
  1. SQL: la query a `pg_proc` de arriba devuelve **una sola fila**, con `args = text, text, text, text, text, text, uuid`.
  2. Llamada REST de prueba (debe dejar de devolver PGRST203):
     ```sh
     curl -i -X POST "$SUPABASE_URL/rest/v1/rpc/log_client_error_v1" \
       -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
       -d '{"p_message":"verificacion N1 post-fix","p_route":"/healthcheck"}'
     # Esperado: HTTP 200 con un UUID en el cuerpo, p. ej. "3f8b…"
     # (antes: HTTP 300 Multiple Choices / PGRST203)
     ```
  3. Rate limit íntegro: 25 llamadas seguidas como anon → las primeras 20 pasan, desde la 21ª `P0001 Demasiadas solicitudes…`.
  4. Provocar un error en la app cliente y confirmar fila en `app_logs` con `fn='client'` (vía de la edge function `client-error-log`).

---

### [N2] Pérdida de GRANTs en el stack local de auditoría — artefacto, no bug de producto
- **Severidad:** Informativo (sin impacto en producción) · **Verificación:** confirmado en fuente (N2): `rebuild_from_dump.sh` usa `pg_restore --no-privileges` → la BD local quedó con 0 GRANTs para `authenticated`/`anon`/`service_role`; todo SELECT vía API devolvía `42501 permission denied` antes de cualquier RLS (falsos positivos de "seguro").
- **Archivos:** ninguno del producto. (Script del stack local de auditoría, fuera del repo desplegable; ya corregido en el propio stack según la fuente.)
- **Problema:** Artefacto del tooling de auditoría local: al reconstruir la BD desde dump sin privilegios, los grants baseline tipo Supabase desaparecen y cualquier verificación de RLS/API contra ese stack mide "permiso denegado" en vez de la política real. En producción (Supabase gestionado) los grants los aplica la plataforma; no hay deriva.
- **Fix (instrucción para Lovable):** **sin cambio de código.** Acción para producción: ninguna. Nota informativa para quien repita la auditoría: tras un `pg_restore --no-privileges`, re-aplicar los grants baseline antes de sacar conclusiones de RLS, p. ej.:
  ```sql
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon; -- ajustar al whitelist real
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
  ```
  (El stack local ya aplica estos grants; queda como referencia.)
- **Tras aplicar, verificar:** n/a en producto. En un stack local reconstruido: `SELECT has_table_privilege('authenticated', 'public.embarques', 'SELECT')` → `t`, y un `GET /rest/v1/embarques` con JWT de miembro devuelve datos filtrados por RLS (no `42501`).

---

## Resumen
| ID | Tipo | Cambio |
|---|---|---|
| TC-01 | Documentación + engines (+ polyfill opcional de tests) | `README.md`, `package.json`, opcional `src/test/setup.node.ts` |
| TC-02 | Config de build | `vite.config.ts`, `package.json`, `README.md` |
| TC-03 | Limpieza de directivas muertas | 6 archivos de rutas |
| TC-04 | Documentación en config (excepción conocida) | `vite.config.ts` (comentario) |
| N1 | **P1 bloqueante** — migración SQL nueva | `supabase/migrations/20260813130000_fix_n1_log_client_error.sql` |
| N2 | Sin cambio de código (artefacto local) | — |

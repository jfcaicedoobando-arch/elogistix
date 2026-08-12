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

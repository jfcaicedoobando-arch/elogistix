/**
 * v13.823.359 (Addendum P1): regresión estática de `aceptar_cotizacion_version`.
 * Conserva el candado general de cliente y acota la excepción de prospecto CRM
 * enviado. Primera aceptación y reintento tienen precondiciones separadas.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/schema/cotizaciones/aceptar_cotizacion_version.sql"),
  "utf8",
);
const cuerpo = sql.slice(sql.indexOf("AS $$"));

describe("aceptar_cotizacion_version (SQL canónico)", () => {
  it("exige cliente y, en prospectos, oportunidad ligada", () => {
    expect(cuerpo).toContain("LC_COT_SIN_CLIENTE");
    expect(cuerpo).toContain("LC_COT_SIN_OPORTUNIDAD");
    expect(cuerpo).toContain("IF v_cliente_id IS NULL AND NOT v_prospecto_sin_cliente THEN");
    expect(cuerpo).toContain("COALESCE(v_es_prospecto, false) AND v_oportunidad_id IS NULL");
  });

  it("evalúa los candados antes del camino idempotente y del sello", () => {
    const cliente = cuerpo.indexOf("LC_COT_SIN_CLIENTE");
    const oportunidad = cuerpo.indexOf("LC_COT_SIN_OPORTUNIDAD");
    const idempotente = cuerpo.indexOf("IF v_estado_actual IN ('Aceptada','En operación') THEN");
    const sello = cuerpo.indexOf("UPDATE cotizaciones");
    const autoridad = cuerpo.indexOf("LC_NO_AUTORIZADO");
    for (const posicion of [cliente, oportunidad, idempotente, sello, autoridad]) {
      expect(posicion, "el marcador debe existir antes de comparar posiciones").toBeGreaterThanOrEqual(0);
    }
    expect(idempotente).toBeGreaterThan(0);
    expect(cliente).toBeLessThan(idempotente);
    expect(oportunidad).toBeLessThan(idempotente);
    expect(cliente).toBeLessThan(sello);
    expect(autoridad).toBeLessThan(cliente);
  });

  it("mantiene exentas las informativas y el resto del contrato", () => {
    expect(cuerpo).toContain("COALESCE(v_tipo_documento, 'transaccional') <> 'informativa'");
    expect(cuerpo).toContain("LC_SOD_VIOLATION");
    expect(cuerpo).toContain("LC_COT_IMPORTE_REQUERIDO");
    expect(sql).toContain("FROM PUBLIC;");
    expect(sql).toContain("TO authenticated, service_role;");
  });

  it("sólo exceptúa un prospecto transaccional sin cliente y primera aceptación Enviada", () => {
    expect(cuerpo).toContain("v_prospecto_sin_cliente := v_cliente_id IS NULL");
    expect(cuerpo).toContain("AND COALESCE(v_es_prospecto, false)");
    expect(cuerpo).toContain("AND COALESCE(v_tipo_documento, 'transaccional') = 'transaccional'");
    expect(cuerpo).toContain("IF NOT v_reintento_prospecto AND v_estado_actual IS DISTINCT FROM 'Enviada' THEN");
    expect(cuerpo).toContain("v_origen := 'aceptacion_prospecto_crm'");
  });

  it("valida IDs vivos del tenant y vínculos empresariales existentes sin crear ninguno", () => {
    expect(cuerpo).toContain("v_org IS DISTINCT FROM public.org_scope()");
    for (const tabla of ["crm_oportunidades", "crm_etapas_pipeline", "crm_leads", "crm_empresas"]) {
      expect(cuerpo).toContain(`FROM public.${tabla}`);
    }
    expect(cuerpo).toContain("FROM public.crm_oportunidad_empresa");
    expect(cuerpo).toContain("WHERE lead_origen_id = v_lead.id FOR SHARE");
    expect(cuerpo).toContain("v_op.moneda IS DISTINCT FROM v_moneda");
    expect(cuerpo).toContain("FOR UPDATE NOWAIT");
    expect(cuerpo).toContain("LC_COTIZACION_EN_PROCESO");
    expect(cuerpo).not.toMatch(/INSERT INTO public\.(clientes|crm_)/);
    expect(cuerpo).not.toMatch(/UPDATE public\.(crm_leads|crm_empresas)/);
  });

  it("permite empresa cliente accesoria M:N, pero preserva tenant, borrado y linaje principal", () => {
    const inicio = cuerpo.indexOf("FOR v_vinculo IN SELECT * FROM public.crm_oportunidad_empresa");
    const fin = cuerpo.indexOf("END LOOP;", inicio);
    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(fin).toBeGreaterThan(inicio);
    const accesorio = cuerpo.slice(inicio, fin);
    expect(accesorio).toContain("WHERE oportunidad_id = v_op.id FOR SHARE");
    expect(accesorio).toContain("WHERE id = v_vinculo.empresa_id AND organization_id = v_org AND deleted_at IS NULL");
    expect(accesorio).toContain("IF NOT FOUND OR v_vinculo.organization_id IS DISTINCT FROM v_org THEN");
    expect(accesorio).not.toContain("v_empresa.cliente_id");
    const principalInicio = cuerpo.indexOf("FOR v_empresa IN SELECT * FROM public.crm_empresas", fin);
    const principalFin = cuerpo.indexOf("END LOOP;", principalInicio);
    expect(principalInicio).toBeGreaterThan(fin);
    expect(principalFin).toBeGreaterThan(principalInicio);
    const principal = cuerpo.slice(principalInicio, principalFin);
    expect(principal).toContain("WHERE lead_origen_id = v_lead.id FOR SHARE");
    expect(principal).toContain("v_empresa.organization_id IS DISTINCT FROM v_org OR v_empresa.deleted_at IS NOT NULL");
    expect(principal).toContain("OR v_empresa.cliente_id IS NOT NULL THEN");
  });

  it("retry después de convertir conserva el cálculo original del origen según el cliente", () => {
    expect(cuerpo).toContain("v_requiere := public.cliente_requiere_autorizacion(v_cliente_id, 'cotizacion');");
    expect(cuerpo).toContain("v_origen := CASE WHEN v_requiere THEN 'autorizacion_cliente' ELSE 'interna_cliente_de_casa' END;");
    const inicio = cuerpo.indexOf("IF v_estado_actual IN ('Aceptada','En operación') THEN");
    const fin = cuerpo.indexOf("IF v_vigencia IS NOT NULL", inicio);
    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(fin).toBeGreaterThan(inicio);
    const retry = cuerpo.slice(inicio, fin);
    expect(retry).toContain("'origen_aceptacion', v_origen");
    expect(retry).toContain("'sin_cambios', true");
    expect(retry).not.toMatch(/^\s*(UPDATE|INSERT INTO|DELETE FROM)\b/m);
  });

  it("retry exige ganadora/ganada/sello íntegro; calificación y abierta sólo en primera aceptación", () => {
    const inicio = cuerpo.indexOf("IF v_reintento_prospecto THEN");
    const primera = cuerpo.indexOf("    ELSE\n      IF v_op.cotizacion_ganadora_id", inicio);
    const retry = cuerpo.slice(inicio, primera);
    expect(retry).toContain("v_op.cotizacion_ganadora_id IS DISTINCT FROM p_cotizacion_id");
    expect(retry).toContain("v_etapa.tipo::text IS DISTINCT FROM 'ganada'");
    expect(retry).toContain("v_version_aceptada IS DISTINCT FROM v_version");
    expect(retry).toContain("v_aceptada_en IS NULL OR v_aceptada_por IS NULL");
    expect(retry).not.toContain("v_lead.estado");
    expect(retry).not.toContain("'abierta'");
    expect(cuerpo.slice(primera)).toContain("v_lead.estado::text NOT IN ('Calificado','Prospecto')");
  });

  it("la migración forward y el espejo tienen exactamente los mismos bytes", () => {
    expect(readFileSync(join(process.cwd(), "supabase/migrations/20261012160000_aceptacion_prospectos_crm.sql"), "utf8")).toBe(sql);
  });
});

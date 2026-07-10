/**
 * Tests unitarios del detector de patrón "auto-borrado" en RPCs.
 */
import { describe, it, expect } from "vitest";
import { auditSql, analyzeBody, scoreFinding } from "../../scripts/lib/rpcSync";

const VULNERABLE = `
CREATE OR REPLACE FUNCTION public.actualizar_embarque_completo(p_payload jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_incoming_venta_ids uuid[];
  v_new_id uuid;
BEGIN
  v_incoming_venta_ids := ARRAY(SELECT (elem->>'id')::uuid FROM jsonb_array_elements(p_payload->'venta') elem WHERE elem ? 'id');
  -- loop
  INSERT INTO conceptos_venta(descripcion) VALUES ('x') RETURNING id INTO v_new_id;
  -- (bug: falta array_append aquí)
  UPDATE conceptos_venta SET deleted_at = now() WHERE embarque_id = p_id AND NOT (id = ANY(v_incoming_venta_ids));
END;
$$;
`;

const FIXED = `
CREATE OR REPLACE FUNCTION public.actualizar_ok(p jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_incoming_ids uuid[];
  v_new_id uuid;
BEGIN
  v_incoming_ids := ARRAY(SELECT (e->>'id')::uuid FROM jsonb_array_elements(p) e);
  INSERT INTO t(a) VALUES ('x') RETURNING id INTO v_new_id;
  v_incoming_ids := array_append(v_incoming_ids, v_new_id);
  UPDATE t SET deleted_at = now() WHERE NOT (id = ANY(v_incoming_ids));
END;
$$;
`;

const BENIGN = `
CREATE OR REPLACE FUNCTION public.suma(a int, b int) RETURNS int LANGUAGE plpgsql AS $$
BEGIN RETURN a + b; END;
$$;
`;

describe("rpcSync auditor", () => {
  it("marca CRITICAL el patrón vulnerable", () => {
    const findings = auditSql("mig.sql", VULNERABLE);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("CRITICAL");
    expect(findings[0].functionName).toBe("actualizar_embarque_completo");
  });

  it("no marca nada cuando hay array_append tras el INSERT", () => {
    const findings = auditSql("mig.sql", FIXED);
    expect(findings).toHaveLength(0);
  });

  it("ignora funciones sin ninguna señal", () => {
    expect(auditSql("mig.sql", BENIGN)).toHaveLength(0);
  });

  it("scoreFinding devuelve HIGH con insert-sin-append + otra señal", () => {
    const sev = scoreFinding({
      capturePriorIds: false,
      insertReturningId: true,
      appendAfterInsert: false,
      deleteByComplement: true,
    });
    expect(sev).toBe("HIGH");
  });

  it("scoreFinding ignora captura + delete sin insert-sin-append", () => {
    const sev = scoreFinding({
      capturePriorIds: true,
      insertReturningId: true,
      appendAfterInsert: true,
      deleteByComplement: true,
    });
    expect(sev).toBeNull();
  });

  it("analyzeBody detecta insert sin append como señal cruda", () => {
    const s = analyzeBody(`
      INSERT INTO t(a) VALUES(1) RETURNING id INTO v_new;
      -- sin array_append
    `);
    expect(s.insertReturningId).toBe(true);
    expect(s.appendAfterInsert).toBe(false);
  });
});

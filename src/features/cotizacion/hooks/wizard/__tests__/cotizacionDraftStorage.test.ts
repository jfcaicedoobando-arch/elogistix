/**
 * Cobertura de ramas para cotizacionDraftStorage: parseo/validación del
 * draft persistido (localStorage vía safeLocalStorage) y sus casos borde.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadDraft,
  clearDraft,
  draftKey,
  DEBOUNCE_MS,
} from "@/features/cotizacion/hooks/wizard/cotizacionDraftStorage";

const USER = "user-1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("draftKey", () => {
  it("usa el userId cuando se proporciona", () => {
    expect(draftKey("abc")).toBe("lc:cotizacion:draft:abc");
  });

  it("usa 'anon' cuando el userId está vacío", () => {
    expect(draftKey("")).toBe("lc:cotizacion:draft:anon");
  });
});

describe("loadDraft (cotizacionDraftStorage)", () => {
  it("devuelve null cuando no hay nada guardado en cotizacionDraftStorage", () => {
    expect(loadDraft(USER)).toBeNull();
  });

  it("devuelve null si el JSON del draft está corrupto", () => {
    window.localStorage.setItem(draftKey(USER), "{ no-json");
    expect(loadDraft(USER)).toBeNull();
  });

  it("devuelve null si el JSON parseado no es un objeto", () => {
    window.localStorage.setItem(draftKey(USER), JSON.stringify("hola"));
    expect(loadDraft(USER)).toBeNull();
  });

  it("devuelve null si savedAt no es number", () => {
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ version: 3, savedAt: "no-es-numero", values: {} }),
    );
    expect(loadDraft(USER)).toBeNull();
  });

  it("devuelve null si la versión no es 1, 2 ni 3", () => {
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ version: 99, savedAt: Date.now(), values: {} }),
    );
    expect(loadDraft(USER)).toBeNull();
  });

  it("devuelve null y limpia storage cuando el borrador tiene más de 24h", () => {
    const stale = { version: 3, savedAt: Date.now() - 25 * 60 * 60 * 1000, values: {} };
    window.localStorage.setItem(draftKey(USER), JSON.stringify(stale));
    expect(loadDraft(USER)).toBeNull();
    expect(window.localStorage.getItem(draftKey(USER))).toBeNull();
  });

  it("draft v3 completo: no agrega avisos de paso/costos, sólo el de MSDS", () => {
    const fresh = {
      version: 3,
      savedAt: Date.now(),
      cotizacionId: "cot-1",
      currentStep: 2,
      costosInternos: [{ concepto: "Flete", monto: 100 }],
      values: { clienteId: "c-1" },
    };
    window.localStorage.setItem(draftKey(USER), JSON.stringify(fresh));
    const out = loadDraft(USER);
    expect(out?.version).toBe(3);
    expect(out?.cotizacionId).toBe("cot-1");
    expect(out?.currentStep).toBe(2);
    expect(out?.costosInternos).toEqual([{ concepto: "Flete", monto: 100 }]);
    expect(out?.noRestaurado).toEqual([
      "El archivo MSDS adjunto (si lo había) — vuelve a adjuntarlo",
    ]);
  });

  it("draft legacy (v1/v2): agrega avisos de paso y costos internos perdidos", () => {
    const legacy = { version: 1, savedAt: Date.now(), values: { clienteId: "c-1" } };
    window.localStorage.setItem(draftKey(USER), JSON.stringify(legacy));
    const out = loadDraft(USER);
    expect(out?.version).toBe(3);
    expect(out?.noRestaurado).toHaveLength(3);
    expect(out?.noRestaurado).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/paso del asistente/i),
        expect.stringMatching(/costos internos/i),
      ]),
    );
  });

  it("cotizacionId no-string se normaliza a null", () => {
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ version: 3, savedAt: Date.now(), cotizacionId: 123, values: {} }),
    );
    expect(loadDraft(USER)?.cotizacionId).toBeNull();
  });

  it("currentStep inválido (no number o < 1) se normaliza a 1", () => {
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ version: 3, savedAt: Date.now(), currentStep: 0, values: {} }),
    );
    expect(loadDraft(USER)?.currentStep).toBe(1);

    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ version: 3, savedAt: Date.now(), currentStep: "x", values: {} }),
    );
    expect(loadDraft(USER)?.currentStep).toBe(1);
  });

  it("costosInternos no-array se normaliza a []", () => {
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ version: 3, savedAt: Date.now(), costosInternos: "no-array", values: {} }),
    );
    expect(loadDraft(USER)?.costosInternos).toEqual([]);
  });

  it("revive validezPropuesta como Date cuando es un string ISO válido", () => {
    const iso = new Date("2024-05-01T00:00:00.000Z").toISOString();
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({
        version: 3,
        savedAt: Date.now(),
        values: { validezPropuesta: iso },
      }),
    );
    const out = loadDraft(USER);
    expect(out?.values.validezPropuesta).toBeInstanceOf(Date);
    expect((out?.values.validezPropuesta as Date).toISOString()).toBe(iso);
  });

  it("deja validezPropuesta sin tocar si el string no es una fecha válida", () => {
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({
        version: 3,
        savedAt: Date.now(),
        values: { validezPropuesta: "no-es-fecha" },
      }),
    );
    const out = loadDraft(USER);
    expect(out?.values.validezPropuesta).toBe("no-es-fecha");
  });

  it("no toca validezPropuesta si ya no es string (undefined)", () => {
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ version: 3, savedAt: Date.now(), values: {} }),
    );
    const out = loadDraft(USER);
    expect(out?.values.validezPropuesta).toBeUndefined();
  });
});

describe("clearDraft (cotizacionDraftStorage)", () => {
  it("elimina el draft persistido del usuario", () => {
    window.localStorage.setItem(draftKey(USER), "algo");
    clearDraft(USER);
    expect(window.localStorage.getItem(draftKey(USER))).toBeNull();
  });
});

describe("DEBOUNCE_MS", () => {
  it("expone un valor fijo de 800ms", () => {
    expect(DEBOUNCE_MS).toBe(800);
  });
});

/**
 * Cobertura de embarqueDraftStorage (M-13, v14-2): clave por usuario+org,
 * TTL 24 h, sesgo de reloj, parseo defensivo y detección de contenido.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  embarqueDraftKey,
  loadEmbarqueDraft,
  clearEmbarqueDraft,
  clearAllEmbarqueDrafts,
  embarqueDraftTieneContenido,
  EMBARQUE_DRAFT_DEBOUNCE_MS,
  type StoredEmbarqueDraft,
} from "@/features/embarques/hooks/wizard/embarqueDraftStorage";
import { DEFAULT_EMBARQUE_VALUES } from "@/features/embarques/domain/mappers/embarque";

const USER = "user-1";

function draftValido(overrides: Partial<StoredEmbarqueDraft> = {}): StoredEmbarqueDraft {
  return {
    version: 1,
    savedAt: Date.now(),
    values: { ...DEFAULT_EMBARQUE_VALUES, clienteId: "cli-1" },
    currentStep: 2,
    conceptosVenta: [],
    conceptosCosto: [],
    cotizacionVinculadaId: null,
    tabId: "tab-1",
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("embarqueDraftKey", () => {
  it("incluye organización y usuario (sin fuga cross-tenant)", () => {
    expect(embarqueDraftKey("abc", "org-1")).toBe("lc:embarque:draft:org-1:abc");
    expect(embarqueDraftKey("abc", "org-1")).not.toBe(embarqueDraftKey("abc", "org-2"));
    expect(embarqueDraftKey("")).toBe("lc:embarque:draft:sin-org:anon");
  });

  it("expone el debounce estándar", () => {
    expect(EMBARQUE_DRAFT_DEBOUNCE_MS).toBe(800);
  });
});

describe("loadEmbarqueDraft", () => {
  it("devuelve null cuando no hay nada guardado", () => {
    expect(loadEmbarqueDraft(USER)).toBeNull();
  });

  it("devuelve null si el JSON está corrupto", () => {
    window.localStorage.setItem(embarqueDraftKey(USER), "{ no-json");
    expect(loadEmbarqueDraft(USER)).toBeNull();
  });

  it("devuelve null si savedAt no es number", () => {
    window.localStorage.setItem(embarqueDraftKey(USER), JSON.stringify({ version: 1, savedAt: "ayer" }));
    expect(loadEmbarqueDraft(USER)).toBeNull();
  });

  it("descarta borradores expirados (>24 h) y limpia la clave", () => {
    const viejo = draftValido({ savedAt: Date.now() - 25 * 60 * 60 * 1000 });
    window.localStorage.setItem(embarqueDraftKey(USER), JSON.stringify(viejo));
    expect(loadEmbarqueDraft(USER)).toBeNull();
    expect(window.localStorage.getItem(embarqueDraftKey(USER))).toBeNull();
  });

  it("descarta timestamps en el futuro más allá del sesgo de reloj", () => {
    const futuro = draftValido({ savedAt: Date.now() + 60 * 60 * 1000 });
    window.localStorage.setItem(embarqueDraftKey(USER), JSON.stringify(futuro));
    expect(loadEmbarqueDraft(USER)).toBeNull();
  });

  it("rehidrata un borrador válido con defaults defensivos", () => {
    const draft = draftValido();
    window.localStorage.setItem(embarqueDraftKey(USER), JSON.stringify(draft));
    const cargado = loadEmbarqueDraft(USER);
    expect(cargado?.currentStep).toBe(2);
    expect(cargado?.values.clienteId).toBe("cli-1");
    expect(cargado?.tabId).toBe("tab-1");
  });

  it("tolera campos ausentes (shape parcial)", () => {
    window.localStorage.setItem(
      embarqueDraftKey(USER),
      JSON.stringify({ version: 1, savedAt: Date.now(), values: { ...DEFAULT_EMBARQUE_VALUES } }),
    );
    const cargado = loadEmbarqueDraft(USER);
    expect(cargado?.currentStep).toBe(1);
    expect(cargado?.conceptosVenta).toEqual([]);
    expect(cargado?.cotizacionVinculadaId).toBeNull();
    expect(cargado?.tabId).toBeUndefined();
  });
});

describe("clearEmbarqueDraft / clearAllEmbarqueDrafts", () => {
  it("clearEmbarqueDraft elimina sólo la clave del usuario", () => {
    window.localStorage.setItem(embarqueDraftKey(USER), JSON.stringify(draftValido()));
    window.localStorage.setItem(embarqueDraftKey("otro"), JSON.stringify(draftValido()));
    clearEmbarqueDraft(USER);
    expect(loadEmbarqueDraft(USER)).toBeNull();
    expect(window.localStorage.getItem(embarqueDraftKey("otro"))).not.toBeNull();
  });

  it("clearAllEmbarqueDrafts barre todos los drafts sin tocar otras claves", () => {
    window.localStorage.setItem(embarqueDraftKey(USER), JSON.stringify(draftValido()));
    window.localStorage.setItem(embarqueDraftKey("otro"), JSON.stringify(draftValido()));
    window.localStorage.setItem("lc:otra-cosa", "x");
    clearAllEmbarqueDrafts();
    expect(window.localStorage.getItem(embarqueDraftKey(USER))).toBeNull();
    expect(window.localStorage.getItem(embarqueDraftKey("otro"))).toBeNull();
    expect(window.localStorage.getItem("lc:otra-cosa")).toBe("x");
  });
});

describe("embarqueDraftTieneContenido", () => {
  it("los defaults solos NO cuentan como contenido", () => {
    expect(embarqueDraftTieneContenido({ ...DEFAULT_EMBARQUE_VALUES }, [], [])).toBe(false);
  });

  it("un cliente capturado sí cuenta", () => {
    expect(
      embarqueDraftTieneContenido({ ...DEFAULT_EMBARQUE_VALUES, clienteId: "c1" }, [], []),
    ).toBe(true);
  });

  it("un concepto de venta con importe sí cuenta", () => {
    expect(
      embarqueDraftTieneContenido({ ...DEFAULT_EMBARQUE_VALUES }, [
        { id: 1, concepto: "", cantidad: 1, precioUnitario: 100, moneda: "MXN", contenedorId: null },
      ], []),
    ).toBe(true);
  });

  it("un concepto de costo capturado sí cuenta", () => {
    expect(
      embarqueDraftTieneContenido({ ...DEFAULT_EMBARQUE_VALUES }, [], [
        { id: 1, proveedorId: "", concepto: "Flete", monto: 0, moneda: "MXN", contenedorId: null },
      ]),
    ).toBe(true);
  });

  it("contenedores capturados sí cuentan", () => {
    expect(
      embarqueDraftTieneContenido(
        { ...DEFAULT_EMBARQUE_VALUES, contenedores: [{ numero_contenedor: "MSCU1", tipo_contenedor: "40HC", bl_house: "", peso_kg: 0, volumen_m3: 0, piezas: 0, orden: 1 }] },
        [],
        [],
      ),
    ).toBe(true);
  });
});

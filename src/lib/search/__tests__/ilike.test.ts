import { describe, it, expect } from "vitest";
import { escapeIlike, ilikePattern, orIlike } from "../ilike";

describe("escapeIlike", () => {
  it("escapa % y _ y \\", () => {
    expect(escapeIlike("50% off_now")).toBe("50\\% off\\_now");
    expect(escapeIlike("a\\b")).toBe("a\\\\b");
  });
  it("respeta caracteres normales", () => {
    expect(escapeIlike("ACME S.A.")).toBe("ACME S.A.");
  });
});

describe("ilikePattern", () => {
  it("envuelve en % y aplica trim + escape", () => {
    expect(ilikePattern("  hola%  ")).toBe("%hola\\%%");
  });
});

describe("orIlike", () => {
  it("construye expresión OR sin quoting cuando no hay reservados", () => {
    expect(orIlike(["a", "b"], "foo")).toBe("a.ilike.%foo%,b.ilike.%foo%");
  });
  it("envuelve entre comillas cuando el término tiene , ( ) o \"", () => {
    expect(orIlike(["a"], "ACME, S.A.")).toBe('a.ilike."%ACME, S.A.%"');
    expect(orIlike(["a"], 'x"y')).toBe('a.ilike."%x""y%"');
    expect(orIlike(["a"], "(paren)")).toBe('a.ilike."%(paren)%"');
  });
  it("escapa comodines ilike aunque haya comas", () => {
    expect(orIlike(["a"], "50%, off")).toBe('a.ilike."%50\\%, off%"');
  });
});

import { describe, it, expect } from "vitest";
import { z, ZodError } from "zod";
import { createPayloadMapper, F } from "../genericPayloadMapper";

interface Form {
  clienteId: string;
  pesoKg: string;
  blMaster: string;
  modo: string;
  notas: string;
}

interface Row {
  cliente_id: string;
  peso_kg: number;
  bl_master: string | null;
  modo: "Marítimo" | "Aéreo";
  internal_flag: boolean;
}

const modoSchema = z.enum(["Marítimo", "Aéreo"]);

const mapper = createPayloadMapper<Form, Row>({
  fields: [
    F.str<Form, Row>()("clienteId", "cliente_id"),
    F.num<Form, Row>()("pesoKg", "peso_kg"),
    F.emptyNull<Form, Row>()("blMaster", "bl_master"),
    F.zod<Form, Row>(modoSchema)("modo", "modo"),
    {
      formPath: "notas",
      rowPath: "internal_flag",
      direction: "fromDb",
      fromDb: (v) => (v ? "sí" : "no"),
    },
  ],
  computedToDb: (_form, partial) => ({ ...partial, internal_flag: false }),
});

describe("genericPayloadMapper", () => {
  it("toDb coerciona tipos primitivos y aplica computedToDb", () => {
    const row = mapper.toDb({
      clienteId: "abc",
      pesoKg: "120.5",
      blMaster: "",
      modo: "Marítimo",
      notas: "ignorado en toDb",
    });
    expect(row).toEqual({
      cliente_id: "abc",
      peso_kg: 120.5,
      bl_master: null,
      modo: "Marítimo",
      internal_flag: false,
    });
  });

  it("fromDb convierte number → string y respeta direction:fromDb", () => {
    const form = mapper.fromDb({
      cliente_id: "abc",
      peso_kg: 99,
      bl_master: "BLX",
      modo: "Aéreo",
      internal_flag: true,
    });
    expect(form.clienteId).toBe("abc");
    expect(form.pesoKg).toBe("99");
    expect(form.blMaster).toBe("BLX");
    expect(form.modo).toBe("Aéreo");
    expect(form.notas).toBe("sí");
  });

  it("zod coerce lanza ZodError con valores inválidos", () => {
    expect(() =>
      mapper.toDb({
        clienteId: "a",
        pesoKg: "1",
        blMaster: "x",
        modo: "Terrestre",
        notas: "",
      }),
    ).toThrow(ZodError);
  });

  it("direction:fromDb no se aplica en toDb", () => {
    const row = mapper.toDb({
      clienteId: "a", pesoKg: "1", blMaster: "x", modo: "Marítimo", notas: "z",
    });
    // notas no debe haberse escrito en row
    expect((row as unknown as Record<string, unknown>).notas).toBeUndefined();
  });

  it("round-trip preserva campos comunes", () => {
    const input: Form = {
      clienteId: "c1", pesoKg: "10", blMaster: "BL1", modo: "Marítimo", notas: "",
    };
    const row = mapper.toDb(input);
    const back = mapper.fromDb(row);
    expect(back.clienteId).toBe("c1");
    expect(back.pesoKg).toBe("10");
    expect(back.blMaster).toBe("BL1");
    expect(back.modo).toBe("Marítimo");
  });

  it("rowSchema valida el payload final", () => {
    const strict = createPayloadMapper<{ a: string }, { a: string }>({
      fields: [F.str<{ a: string }, { a: string }>()("a", "a")],
      rowSchema: z.object({ a: z.string().min(3) }),
    });
    expect(() => strict.toDb({ a: "xx" })).toThrow(ZodError);
    expect(strict.toDb({ a: "xxxx" })).toEqual({ a: "xxxx" });
  });
});

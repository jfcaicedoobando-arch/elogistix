import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadClave, LeadExistente } from "@/features/crm/domain/leadsDedupe";

const { rpc, captureScope, assertCurrent } = vi.hoisted(() => ({
  rpc: vi.fn(),
  captureScope: vi.fn(),
  assertCurrent: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/lib/auth/authOperationScope", () => ({
  captureAuthOperationScope: captureScope,
}));

import { buscarLeadsDuplicados } from "../leadsDuplicados";
import { clasificarDuplicado, clasificarLote } from "@/features/crm/domain/leadsDedupe";

interface Peticion {
  claves: LeadClave[];
  desde: number;
  hasta: number;
}

interface Pagina {
  data: LeadExistente[] | null;
  error: unknown | null;
  count: number | null | undefined;
}

/** Simula exclusivamente el contrato paginado del RPC; ninguna conexión real. */
function simularRpc(responder: (p: Peticion) => Pagina | Promise<Pagina>) {
  const peticiones: Peticion[] = [];
  rpc.mockImplementation((nombre, args: { p_claves: LeadClave[] }, opciones) => {
    expect(nombre).toBe("crm_leads_buscar_duplicados");
    expect(opciones).toEqual({ count: "exact" });
    expect(args.p_claves.length).toBeGreaterThan(0);
    expect(args.p_claves.length).toBeLessThanOrEqual(500);
    return {
      order: (columna: string, orden: unknown) => {
        expect(columna).toBe("id");
        expect(orden).toEqual({ ascending: true });
        return {
          range: (desde: number, hasta: number) => {
            expect(hasta - desde + 1).toBe(500);
            const peticion = { claves: args.p_claves, desde, hasta };
            peticiones.push(peticion);
            return Promise.resolve(responder(peticion));
          },
        };
      },
    };
  });
  return peticiones;
}

function claves(cantidad: number): LeadClave[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    empresa: `Empresa ${i}`,
    email: `lead-${i}@example.test`,
  }));
}

function existente(id: string, email = `existente-${id}@example.test`): LeadExistente {
  return {
    id, empresa: `Empresa existente ${id}`, contacto: "Contacto",
    email, telefono: null, estado: "Nuevo",
  };
}

const vacia: Pagina = { data: [], error: null, count: 0 };

describe("buscarLeadsDuplicados: revisión completa y acotada", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    captureScope.mockReturnValue({
      organizationId: "org-prueba", assertCurrent, isCurrent: () => true,
    });
  });

  it("no consulta cuando no hay claves útiles", async () => {
    expect(await buscarLeadsDuplicados([{}, { empresa: null, email: "", telefono: null }])).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([501, 1001])("revisa las %i filas y detecta el duplicado en la última", async (cantidad) => {
    const filas = claves(cantidad);
    const ultimo = existente("duplicado-final", filas.at(-1)!.email!);
    const peticiones = simularRpc(({ claves: lote }) =>
      lote.some((clave) => clave.email === ultimo.email)
        ? { data: [ultimo], error: null, count: 1 }
        : vacia,
    );

    const encontrados = await buscarLeadsDuplicados(filas);
    const clasificaciones = clasificarLote(filas, encontrados);

    expect(peticiones.map((p) => p.claves.length)).toEqual(
      cantidad === 501 ? [500, 1] : [500, 500, 1],
    );
    expect(peticiones.flatMap((p) => p.claves).map((c) => c.email)).toEqual(filas.map((f) => f.email));
    expect(encontrados).toEqual([ultimo]);
    expect(clasificaciones).toHaveLength(cantidad);
    expect(clasificaciones[0].nivel).toBe("nuevo");
    expect(clasificaciones.at(-1)?.nivel).toBe("exacto");
    expect(clasificaciones.at(-1)?.existente?.id).toBe("duplicado-final");
  });

  it("deduplica 1001 claves normalizadas conservando las filas y el primer payload", async () => {
    const primera = {
      empresa: "ACME S.A. de C.V.", email: " Sales@acme.test ", telefono: "+52 (81) 1234-5678",
    };
    const variante = {
      empresa: "Acme sa de cv", email: "sales@ACME.TEST", telefono: "8112345678",
    };
    const filas = [primera, ...Array.from({ length: 1000 }, () => ({ ...variante }))];
    const original = JSON.stringify(filas);
    const peticiones = simularRpc(() => vacia);

    expect(await buscarLeadsDuplicados(filas)).toEqual([]);
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0].claves).toEqual([primera]);
    expect(JSON.stringify(filas)).toBe(original);
    const clasificaciones = clasificarLote(filas, []);
    expect(clasificaciones[0].nivel).toBe("nuevo");
    expect(clasificaciones.slice(1).every((c) => c.nivel === "exacto")).toBe(true);
    expect(clasificaciones.at(-1)?.campos).toContain("repetido en el archivo");
  });

  it("consolida por id las coincidencias compartidas entre lotes", async () => {
    const comun = existente("compartido");
    simularRpc(({ claves: lote }) => ({
      data: [comun, existente(lote[0].email!)], error: null, count: 2,
    }));

    const encontrados = await buscarLeadsDuplicados(claves(501));

    expect(encontrados).toHaveLength(3);
    expect(encontrados.filter((e) => e.id === comun.id)).toEqual([comun]);
    expect(new Set(encontrados.map((e) => e.id)).size).toBe(encontrados.length);
  });

  it("recupera más de 500 resultados de un solo lote", async () => {
    const datos = Array.from({ length: 1001 }, (_, i) => existente(`id-${i}`));
    const peticiones = simularRpc(({ desde, hasta }) => ({
      data: datos.slice(desde, hasta + 1), error: null, count: datos.length,
    }));

    expect(await buscarLeadsDuplicados([{ empresa: "Empresa" }])).toEqual(datos);
    expect(peticiones.map(({ desde, hasta }) => [desde, hasta])).toEqual([
      [0, 499], [500, 999], [1000, 1499],
    ]);
  });

  it("prioriza exacto por correo en una página posterior a 500 coincidencias débiles", async () => {
    const fila = { empresa: "Cuenta compartida", email: "objetivo@example.test" };
    const debiles = Array.from({ length: 500 }, (_, i) => ({
      ...existente(`00000000-0000-0000-0000-${i.toString().padStart(12, "0")}`),
      empresa: fila.empresa,
    }));
    const exacto = existente("00000000-0000-0000-0000-999999999999", fila.email);
    const datos = [...debiles, exacto];
    const peticiones = simularRpc(({ desde, hasta }) => ({
      data: datos.slice(desde, hasta + 1), error: null, count: datos.length,
    }));

    const encontrados = await buscarLeadsDuplicados([fila]);

    expect(peticiones.map((p) => p.desde)).toEqual([0, 500]);
    expect(debiles.every((e) => e.id < exacto.id)).toBe(true);
    expect(encontrados).toEqual(datos);
    expect(clasificarDuplicado(fila, debiles).nivel).toBe("posible");
    expect(clasificarDuplicado(fila, encontrados)).toEqual({
      nivel: "exacto", campos: ["correo"], existente: exacto,
    });
    expect(clasificarLote([fila], encontrados)[0]).toEqual({
      nivel: "exacto", campos: ["correo"], existente: exacto,
    });
  });

  it("prioriza exacto recuperado por una clave en un lote posterior al match débil", async () => {
    const filaObjetivo = { empresa: "Cuenta compartida", email: "objetivo@example.test" };
    const filas = [{ empresa: filaObjetivo.empresa }, ...claves(499), filaObjetivo];
    const debil = { ...existente("00000000-0000-0000-0000-000000000001"), empresa: filaObjetivo.empresa };
    const exacto = existente("00000000-0000-0000-0000-999999999999", filaObjetivo.email);
    const catalogo = [debil, exacto];
    const peticiones = simularRpc(({ claves: lote, desde, hasta }) => {
      // El primer lote sólo encuentra la cuenta; la clave con el correo del
      // lead objetivo está en el segundo lote y recupera la señal exacta.
      const encontrados = catalogo.filter((ex) => lote.some((clave) =>
        clasificarDuplicado(clave, [ex]).nivel !== "nuevo",
      ));
      return { data: encontrados.slice(desde, hasta + 1), error: null, count: encontrados.length };
    });

    const encontrados = await buscarLeadsDuplicados(filas);

    expect(peticiones.map((p) => p.claves.length)).toEqual([500, 1]);
    expect(peticiones[0].claves.some((c) => c.email === filaObjetivo.email)).toBe(false);
    expect(peticiones[1].claves[0]).toMatchObject(filaObjetivo);
    expect(encontrados.map((e) => e.id)).toEqual([debil.id, exacto.id]);
    expect(clasificarDuplicado(filaObjetivo, [debil]).nivel).toBe("posible");
    expect(clasificarDuplicado(filaObjetivo, encontrados)).toEqual({
      nivel: "exacto", campos: ["correo"], existente: exacto,
    });
    const clasificaciones = clasificarLote(filas, encontrados);
    expect(clasificaciones[0].nivel).toBe("posible");
    expect(clasificaciones.at(-1)).toEqual({ nivel: "exacto", campos: ["correo"], existente: exacto });
  });

  it("continúa si el servidor devuelve páginas menores al tamaño solicitado", async () => {
    const datos = Array.from({ length: 1205 }, (_, i) => existente(`id-${i}`));
    const peticiones = simularRpc(({ desde }) => ({
      data: datos.slice(desde, desde + 200), error: null, count: datos.length,
    }));

    expect(await buscarLeadsDuplicados([{ empresa: "Empresa" }])).toEqual(datos);
    expect(peticiones.map((p) => p.desde)).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
  });

  it("no pide una página adicional cuando el conteo termina en una página llena", async () => {
    const datos = Array.from({ length: 1000 }, (_, i) => existente(`id-${i}`));
    const peticiones = simularRpc(({ desde, hasta }) => ({
      data: datos.slice(desde, hasta + 1), error: null, count: datos.length,
    }));

    expect(await buscarLeadsDuplicados([{ empresa: "Empresa" }])).toHaveLength(1000);
    expect(peticiones).toHaveLength(2);
  });

  it("rechaza el fallo del segundo lote sin retornar coincidencias parciales", async () => {
    const fallo = { message: "Fallo del segundo lote", code: "OFFLINE" };
    simularRpc(({ claves: lote }) => lote[0].email === "lead-0@example.test"
      ? { data: [existente("primero")], error: null, count: 1 }
      : { data: null, error: fallo, count: null },
    );

    await expect(buscarLeadsDuplicados(claves(501))).rejects.toBe(fallo);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("rechaza el fallo de una página posterior sin publicar el primer resultado", async () => {
    const fallo = new Error("Fallo de página");
    simularRpc(({ desde }) => desde === 0
      ? { data: [existente("primero")], error: null, count: 2 }
      : { data: null, error: fallo, count: null },
    );

    await expect(buscarLeadsDuplicados([{ empresa: "Empresa" }])).rejects.toBe(fallo);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it.each([
    { caso: "conteo nulo", data: [], count: null },
    { caso: "conteo ausente", data: [], count: undefined },
    { caso: "conteo negativo", data: [], count: -1 },
    { caso: "conteo no entero", data: [], count: 1.5 },
    { caso: "conteo no finito", data: [], count: Number.NaN },
    { caso: "conteo no seguro", data: [], count: Number.MAX_SAFE_INTEGER + 1 },
    { caso: "datos nulos", data: null, count: 0 },
    { caso: "página vacía prematura", data: [], count: 1 },
    { caso: "más filas que el conteo", data: [existente("extra")], count: 0 },
    { caso: "más filas que el límite de página", data: Array.from({ length: 501 }, (_, i) => existente(`id-${i}`)), count: 501 },
  ])("falla cerrada ante $caso", async ({ data, count }) => {
    simularRpc(() => ({ data, count, error: null }));

    await expect(buscarLeadsDuplicados([{ empresa: "Empresa" }])).rejects.toThrow("No se pudo completar");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rechaza un conteo que cambia entre páginas", async () => {
    simularRpc(({ desde }) => ({
      data: [existente(`id-${desde}`)], error: null, count: desde === 0 ? 2 : 3,
    }));

    await expect(buscarLeadsDuplicados([{ empresa: "Empresa" }])).rejects.toThrow("No se pudo completar");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("rechaza páginas repetidas aunque el servidor anuncie un conteo completo", async () => {
    simularRpc(() => ({ data: [existente("repetido")], error: null, count: 2 }));

    await expect(buscarLeadsDuplicados([{ empresa: "Empresa" }])).rejects.toThrow("repetida");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("se detiene con error al alcanzar 200 páginas sin terminar el lote", async () => {
    const peticiones = simularRpc(({ desde }) => ({
      data: [existente(`id-${desde}`)], error: null, count: 201,
    }));

    await expect(buscarLeadsDuplicados([{ empresa: "Empresa" }])).rejects.toThrow("excedi");
    expect(peticiones).toHaveLength(200);
    expect(peticiones.at(-1)?.desde).toBe(199);
  });

  it("no consulta si la organización cambió antes de la primera petición", async () => {
    const fallo = new Error("Organización cambiada");
    assertCurrent.mockImplementation(() => { throw fallo; });
    simularRpc(() => vacia);

    await expect(buscarLeadsDuplicados(claves(501))).rejects.toBe(fallo);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("descarta la respuesta y aborta los lotes restantes si cambió el ámbito", async () => {
    const fallo = new Error("Usuario u organización cambiados");
    let vigente = true;
    assertCurrent.mockImplementation(() => { if (!vigente) throw fallo; });
    simularRpc(() => {
      vigente = false;
      return { data: [existente("otra-org")], error: null, count: 1 };
    });

    await expect(buscarLeadsDuplicados(claves(1001))).rejects.toBe(fallo);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(captureScope).toHaveBeenCalledTimes(1);
  });
});

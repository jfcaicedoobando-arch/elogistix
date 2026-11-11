import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import type { PropiedadCrm } from "@/features/crm/services/propiedadesCrm";
import type { ValorCrmPersistido } from "@/features/crm/services/valoresCrm";
import { crm } from "@/features/crm/queryKeys";
import { useAutoguardadoPropiedadesCrm } from "@/features/crm/hooks/useAutoguardadoPropiedadesCrm";
import { PropiedadesCard } from "../PropiedadesCard";

const io = vi.hoisted(() => ({
  from: vi.fn(), notifyError: vi.fn(), valores: [] as ValorCrmPersistido[],
  refresco: null as null | (() => Promise<{ data: ValorCrmPersistido[]; error: null }>),
  definiciones: null as null | (() => Promise<{ data: PropiedadCrm[]; error: null }>),
  writes: [] as Array<{
    fila: ValorCrmPersistido & { registro_id: string };
    version: string | null;
    resolve: (r: { data: ValorCrmPersistido | null; error: Error | { code: string } | null }) => void;
  }>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: io.from } }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: io.notifyError, notifySuccess: vi.fn() }));

const propiedades: PropiedadCrm[] = [
  { id: "nombre", etiqueta: "Nombre comercial", tipo: "texto" },
  { id: "volumen", etiqueta: "Volumen", tipo: "numero" },
  { id: "fecha", etiqueta: "Fecha de contacto", tipo: "fecha" },
  { id: "fuente", etiqueta: "Fuente", tipo: "seleccion" },
  { id: "modos", etiqueta: "Transporte", tipo: "multiseleccion" },
].map((p, orden) => ({
  ...p, tipo: p.tipo as PropiedadCrm["tipo"], objeto: "empresa", clave: p.id,
  orden, obligatoria: false, archivada: false,
  opciones: ["Referido", "Marítimo"].map((etiqueta) => ({ id: etiqueta, etiqueta, orden: 0, archivada: false, reemplaza_a: null })),
}));

function provider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Object.assign(Wrapper, { client });
}

function nombre(texto: string, updated_at = "2026-11-01T01:00:00Z"): ValorCrmPersistido {
  return { propiedad_id: "nombre", valor_texto: texto, valor_numero: null, valor_fecha: null, opcion_ids: null, updated_at };
}

async function completar(indice: number, error: Error | null = null) {
  await act(async () => {
    const write = io.writes[indice];
    const actual = io.valores.find((v) => v.propiedad_id === write.fila.propiedad_id);
    if (error) { write.resolve({ data: null, error }); return; }
    if ((actual?.updated_at ?? null) !== write.version) {
      write.resolve({ data: null, error: write.version === null ? { code: "23505" } : null });
      return;
    }
    io.valores = [...io.valores.filter((v) => v.propiedad_id !== write.fila.propiedad_id), write.fila];
    write.resolve({ data: write.fila, error: null });
  });
}
async function tarjeta(canEdit = true) {
  const wrapper = provider();
  const result = render(<PropiedadesCard objeto="empresa" registroId="empresa-1" canEdit={canEdit} />, { wrapper });
  await screen.findByLabelText("Nombre comercial");
  return { ...result, client: wrapper.client };
}

function escritura(datos: Omit<ValorCrmPersistido, "propiedad_id">, ids: Record<string, string> = {}) {
  const q = {
    eq(columna: string, valor: string) { ids[columna] = valor; return q; },
    select() { return q; },
    maybeSingle() {
      return new Promise<{ data: ValorCrmPersistido | null; error: Error | { code: string } | null }>((resolve) => {
        const fila = { ...datos, propiedad_id: ids.propiedad_id, registro_id: ids.registro_id };
        io.writes.push({ fila, version: ids.updated_at ?? null, resolve });
      });
    },
  };
  return q;
}

beforeEach(() => {
  io.valores = [];
  io.writes = [];
  io.refresco = null;
  io.definiciones = null;
  io.notifyError.mockClear();
  io.from.mockReset().mockImplementation((tabla: string) => ({
    select: () => ({ eq: () => ({
      order: () => ({ limit: async () => io.definiciones ? io.definiciones() : ({ data: propiedades, error: null }) }),
      limit: async () => io.refresco ? io.refresco() : ({ data: io.valores, error: null }),
    }) }),
    insert: (fila: ValorCrmPersistido & { registro_id: string }) => {
      expect(tabla).toBe("crm_valores");
      return escritura(fila, { propiedad_id: fila.propiedad_id, registro_id: fila.registro_id });
    },
    update: (fila: Omit<ValorCrmPersistido, "propiedad_id">) => {
      expect(tabla).toBe("crm_valores");
      return escritura(fila);
    },
  }));
});

describe("feedback de autoguardado en fichas CRM con IO ficticio", () => {
  it("explica el disparador, no escribe al teclear ni confirma antes de la respuesta", async () => {
    await tarjeta();
    expect(screen.getByText("Los cambios se guardan al salir de cada campo o al elegir una opción.")).toBeVisible();
    const input = screen.getByLabelText("Nombre comercial");
    fireEvent.change(input, { target: { value: "Acme" } });
    expect(io.writes).toHaveLength(0);
    expect(screen.getByText("Cambios sin guardar")).toBeVisible();
    fireEvent.blur(input);
    await waitFor(() => expect(io.writes).toHaveLength(1));
    expect(io.writes[0].fila).toMatchObject({ propiedad_id: "nombre", registro_id: "empresa-1", valor_texto: "Acme" });
    expect(input).toHaveAccessibleDescription("Guardando…");
    expect(screen.queryByText("Guardado")).toBeNull();
    await completar(0);
    await waitFor(() => expect(input).toHaveAccessibleDescription("Guardado"));
    expect(screen.getAllByText("Guardado")).toHaveLength(1);
    fireEvent.change(input, { target: { value: "Acme nueva" } });
    expect(input).toHaveAccessibleDescription("Cambios sin guardar");
    expect(screen.queryByText("Guardado")).toBeNull();
  });

  it("conserva la captura tras error y reintenta al salir de nuevo sin cambiar el valor", async () => {
    await tarjeta();
    const input = screen.getByLabelText("Nombre comercial");
    fireEvent.change(input, { target: { value: "Acme" } });
    fireEvent.blur(input);
    await waitFor(() => expect(io.writes).toHaveLength(1));
    await completar(0, new Error("Sin conexión"));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(input).toHaveValue("Acme");
    expect(input).toBeEnabled();
    expect(io.notifyError).toHaveBeenCalledOnce();
    fireEvent.blur(input);
    await waitFor(() => expect(io.writes).toHaveLength(2));
    expect(screen.queryByText("Guardado")).toBeNull();
    await completar(1);
    await waitFor(() => expect(input).toHaveAccessibleDescription("Guardado"));
  });

  it("limpia el aviso al revertir al valor conocido sin escribir ni afirmar otro guardado", async () => {
    await tarjeta();
    const input = screen.getByLabelText("Nombre comercial");
    fireEvent.change(input, { target: { value: "Acme" } });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(io.writes).toHaveLength(0);
    expect(screen.queryByText("Cambios sin guardar")).toBeNull();
    expect(screen.queryByText("Guardado")).toBeNull();
  });

  it("adopta una actualización entrante en un campo limpio y salir del campo no escribe", async () => {
    io.valores = [nombre("A")];
    const { client } = await tarjeta();
    const input = screen.getByLabelText("Nombre comercial");
    fireEvent.focus(input);
    act(() => { client.setQueryData(crm.propiedades.valores("empresa-1"), [nombre("B", "2026-11-02T01:00:00Z")]); });
    await waitFor(() => expect(input).toHaveValue("B"));
    fireEvent.blur(input);
    expect(io.writes).toHaveLength(0);
  });

  it("conserva el borrador tras un refresco concurrente y sólo sobrescribe con confirmación explícita", async () => {
    io.valores = [nombre("A")];
    const { client } = await tarjeta();
    const input = screen.getByLabelText("Nombre comercial");
    fireEvent.change(input, { target: { value: "Borrador" } });
    const version = "2026-11-02T01:00:00Z";
    io.valores = [nombre("B", version)];
    act(() => { client.setQueryData(crm.propiedades.valores("empresa-1"), io.valores); });
    expect(await screen.findByText("Valor actual: B")).toBeVisible();
    expect(input).toHaveValue("Borrador");
    fireEvent.blur(input);
    expect(io.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Guardar mi cambio" }));
    await waitFor(() => expect(io.writes[0]?.version).toBe(version));
    await completar(0);
    await waitFor(() => expect(input).toHaveAccessibleDescription("Guardado"));
    expect(input).toHaveValue("Borrador");
  });

  it.each([undefined, nombre("A")])("si la base cambia antes del commit conserva el borrador (%j)", async (original) => {
    io.valores = original ? [original] : [];
    await tarjeta();
    const input = screen.getByLabelText("Nombre comercial");
    fireEvent.change(input, { target: { value: "Borrador" } });
    fireEvent.blur(input);
    await waitFor(() => expect(io.writes[0]?.version).toBe(original?.updated_at ?? null));
    io.valores = [nombre("Actualización externa", "2026-11-03T01:00:00Z")];
    await completar(0);
    expect(await screen.findByRole("alert")).toHaveTextContent("El valor cambió mientras editabas");
    expect(input).toHaveValue("Borrador");
    fireEvent.blur(input);
    expect(io.writes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Usar valor actual" }));
    await waitFor(() => expect(input).toHaveValue("Actualización externa"));
    expect(io.writes).toHaveLength(1);
  });

  it.each([
    ["Volumen", "120", "valor_numero", 120],
    ["Fecha de contacto", "2026-11-02", "valor_fecha", "2026-11-02"],
  ])("mantiene el guardado al salir de %s", async (etiqueta, entrada, columna, valor) => {
    await tarjeta();
    const input = screen.getByLabelText(etiqueta);
    fireEvent.change(input, { target: { value: entrada } });
    expect(io.writes).toHaveLength(0);
    fireEvent.blur(input);
    await waitFor(() => expect(io.writes).toHaveLength(1));
    expect(io.writes[0].fila).toHaveProperty(columna, valor);
    await completar(0);
    await waitFor(() => expect(input).toHaveAccessibleDescription("Guardado"));
  });

  it("guarda una selección al elegir y permite repetirla después de un error", async () => {
    await tarjeta();
    const select = screen.getByRole("combobox", { name: "Fuente" });
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Referido" }));
    await waitFor(() => expect(io.writes).toHaveLength(1));
    expect(io.writes[0].fila.opcion_ids).toEqual(["Referido"]);
    expect(select).toHaveAccessibleDescription("Guardando…");
    await completar(0, new Error("Sin conexión"));
    expect(await screen.findByRole("alert")).toBeVisible();
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Referido" }));
    await waitFor(() => expect(io.writes).toHaveLength(2));
    await completar(1);
    await waitFor(() => {
      expect(select).toHaveAccessibleDescription("Guardado");
      expect(select).toHaveTextContent("Referido");
    });
  });

  it("distingue el fallo de refresco tras una escritura aceptada y reintenta sólo la consulta", async () => {
    await tarjeta();
    const select = screen.getByRole("combobox", { name: "Fuente" });
    io.refresco = async () => { throw new Error("Lectura interrumpida"); };
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Referido" }));
    await waitFor(() => expect(io.writes).toHaveLength(1));
    await completar(0);
    expect(await screen.findByRole("alert")).toHaveTextContent("Hay cambios guardados, pero no se pudieron actualizar las propiedades");
    expect(screen.queryByText(/^No se pudo guardar\./)).toBeNull();
    expect(io.notifyError).not.toHaveBeenCalled();
    io.refresco = null;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    const actualizado = await screen.findByRole("combobox", { name: "Fuente" });
    expect(actualizado).toHaveTextContent("Referido");
    expect(actualizado).toHaveAccessibleDescription("Guardado");
    expect(io.writes).toHaveLength(1);
  });

  it("muestra el valor confirmado del selector mientras se refresca la consulta", async () => {
    await tarjeta();
    const select = screen.getByRole("combobox", { name: "Fuente" });
    let resolver!: (r: { data: ValorCrmPersistido[]; error: null }) => void;
    io.refresco = () => new Promise((resolve) => { resolver = resolve; });
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Referido" }));
    await waitFor(() => expect(io.writes).toHaveLength(1));
    await completar(0);
    expect(select).toHaveTextContent("Referido");
    expect(select).toHaveAccessibleDescription("Guardado");
    await act(async () => { resolver({ data: io.valores, error: null }); });
    await waitFor(() => {
      expect(select).toHaveTextContent("Referido");
      expect(select).toHaveAccessibleDescription("Guardado");
    });
  });

  it("avisa si la consulta termina con otro valor sin decir que sigue actualizando ni repetir la escritura", async () => {
    await tarjeta();
    const select = screen.getByRole("combobox", { name: "Fuente" });
    let resolver!: (r: { data: ValorCrmPersistido[]; error: null }) => void;
    io.refresco = () => new Promise((resolve) => { resolver = resolve; });
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Referido" }));
    await waitFor(() => expect(io.writes).toHaveLength(1));
    await completar(0);
    expect(select).toHaveAccessibleDescription("Guardado");
    await act(async () => { resolver({ data: [{ ...io.valores[0], opcion_ids: ["Marítimo"] }], error: null }); });
    await waitFor(() => {
      expect(select).toHaveTextContent("Marítimo");
      expect(select).toHaveAccessibleDescription("El cambio se guardó, pero el campo muestra otro valor. Revisa la captura antes de continuar.");
    });
    expect(io.writes).toHaveLength(1);
  });

  it.each([false, true])("el estado refleja el texto local tras recuperar definiciones con valores lentos (edición posterior: %s)", async (editar) => {
    io.valores = [nombre("A")];
    await tarjeta();
    const input = screen.getByLabelText("Nombre comercial");
    fireEvent.change(input, { target: { value: "B" } });
    fireEvent.blur(input);
    await waitFor(() => expect(io.writes).toHaveLength(1));
    let resolver!: (r: { data: ValorCrmPersistido[]; error: null }) => void;
    io.refresco = () => new Promise((resolve) => { resolver = resolve; });
    io.definiciones = async () => { throw new Error("Definiciones interrumpidas"); };
    await completar(0);
    expect(await screen.findByRole("alert")).toHaveTextContent("Hay cambios guardados");
    io.definiciones = null;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    const remontado = await screen.findByLabelText("Nombre comercial");
    expect(remontado).toHaveValue("B");
    if (editar) fireEvent.change(remontado, { target: { value: "Borrador nuevo" } });
    await act(async () => { resolver({ data: io.valores, error: null }); });
    await waitFor(() => expect(remontado).toHaveAccessibleDescription(editar
      ? "Cambios sin guardar"
      : "Guardado"));
    expect(remontado).toHaveValue(editar ? "Borrador nuevo" : "B");
    expect(io.writes).toHaveLength(1);
  });

  it("guarda multiselección al marcar y asocia feedback con su grupo", async () => {
    await tarjeta();
    fireEvent.click(screen.getByRole("checkbox", { name: "Marítimo" }));
    await waitFor(() => expect(io.writes).toHaveLength(1));
    expect(io.writes[0].fila.opcion_ids).toEqual(["Marítimo"]);
    const group = screen.getByRole("group", { name: "Transporte" });
    expect(group).toHaveAccessibleDescription("Guardando…");
    await completar(0);
    await waitFor(() => expect(group).toHaveAccessibleDescription("Guardado"));
  });

  it("conserva el modo de lectura y resetea estados al cambiar de registro", async () => {
    const result = await tarjeta(false);
    expect(screen.getByLabelText("Nombre comercial")).toBeDisabled();
    expect(screen.queryByText(/Los cambios se guardan/)).toBeNull();
    result.rerender(<PropiedadesCard objeto="empresa" registroId="empresa-1" canEdit />);
    const input = screen.getByLabelText("Nombre comercial");
    fireEvent.change(input, { target: { value: "Acme" } });
    fireEvent.blur(input);
    await waitFor(() => expect(io.writes).toHaveLength(1));
    result.rerender(<PropiedadesCard objeto="empresa" registroId="empresa-2" canEdit />);
    await screen.findByLabelText("Nombre comercial");
    await completar(0);
    expect(screen.queryByText("Guardado")).toBeNull();
  });
});

describe("respuestas concurrentes del autoguardado", () => {
  it.each([null, new Error("Error anterior")])("ignora el resultado anterior %s tras una captura nueva", async (error) => {
    const { result } = renderHook(() => useAutoguardadoPropiedadesCrm("empresa-1"), { wrapper: provider() });
    act(() => { void result.current.guardarCampo({ propiedadId: "nombre", tipo: "texto", valor: "Anterior", version: null }); });
    await waitFor(() => expect(io.writes).toHaveLength(1));
    act(() => result.current.editar("nombre", true));
    await completar(0, error);
    expect(result.current.estados.nombre).toBe("editando");
  });

  it("una respuesta fuera de orden no reemplaza el estado de la última petición", async () => {
    const { result } = renderHook(() => useAutoguardadoPropiedadesCrm("empresa-1"), { wrapper: provider() });
    act(() => { void result.current.guardarCampo({ propiedadId: "nombre", tipo: "texto", valor: "Anterior", version: null }); });
    act(() => { void result.current.guardarCampo({ propiedadId: "nombre", tipo: "texto", valor: "Última", version: null }); });
    await waitFor(() => expect(io.writes).toHaveLength(2));
    await completar(1, new Error("Fallo vigente"));
    expect(result.current.estados.nombre).toBe("error");
    await completar(0);
    expect(result.current.estados.nombre).toBe("error");
  });

  it("mantiene independientes las respuestas de campos distintos", async () => {
    const { result } = renderHook(() => useAutoguardadoPropiedadesCrm("empresa-1"), { wrapper: provider() });
    act(() => { void result.current.guardarCampo({ propiedadId: "nombre", tipo: "texto", valor: "Acme", version: null }); });
    act(() => { void result.current.guardarCampo({ propiedadId: "volumen", tipo: "numero", valor: 10, version: null }); });
    await waitFor(() => expect(io.writes).toHaveLength(2));
    await completar(0);
    expect(result.current.estados).toEqual({ nombre: "guardado", volumen: "guardando" });
    await completar(1, new Error("Sin conexión"));
    expect(result.current.estados).toEqual({ nombre: "guardado", volumen: "error" });
  });
});

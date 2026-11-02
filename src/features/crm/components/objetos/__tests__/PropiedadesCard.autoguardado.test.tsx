import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import type { PropiedadCrm } from "@/features/crm/services/propiedadesCrm";
import type { ValorCrm } from "@/features/crm/services/valoresCrm";
import { useAutoguardadoPropiedadesCrm } from "@/features/crm/hooks/useAutoguardadoPropiedadesCrm";
import { PropiedadesCard } from "../PropiedadesCard";

const io = vi.hoisted(() => ({
  from: vi.fn(), notifyError: vi.fn(), valores: [] as ValorCrm[],
  refresco: null as null | (() => Promise<{ data: ValorCrm[]; error: null }>),
  writes: [] as Array<{ fila: ValorCrm & { registro_id: string }; resolve: (r: { error: Error | null }) => void }>,
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
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
async function completar(indice: number, error: Error | null = null) {
  await act(async () => {
    const write = io.writes[indice];
    if (!error) io.valores = [...io.valores.filter((v) => v.propiedad_id !== write.fila.propiedad_id), write.fila];
    write.resolve({ error });
  });
}
async function tarjeta(canEdit = true) {
  const result = render(<PropiedadesCard objeto="empresa" registroId="empresa-1" canEdit={canEdit} />, { wrapper: provider() });
  await screen.findByLabelText("Nombre comercial");
  return result;
}

beforeEach(() => {
  io.valores = [];
  io.writes = [];
  io.refresco = null;
  io.notifyError.mockClear();
  io.from.mockReset().mockImplementation((tabla: string) => ({
    select: () => ({ eq: () => ({
      order: () => ({ limit: async () => ({ data: propiedades, error: null }) }),
      limit: async () => io.refresco ? io.refresco() : ({ data: io.valores, error: null }),
    }) }),
    upsert: (fila: ValorCrm & { registro_id: string }) => {
      expect(tabla).toBe("crm_valores");
      return new Promise<{ error: Error | null }>((resolve) => io.writes.push({ fila, resolve }));
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

  it("espera al valor refrescado del selector antes de mostrar Guardado", async () => {
    await tarjeta();
    const select = screen.getByRole("combobox", { name: "Fuente" });
    let resolver!: (r: { data: ValorCrm[]; error: null }) => void;
    io.refresco = () => new Promise((resolve) => { resolver = resolve; });
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Referido" }));
    await waitFor(() => expect(io.writes).toHaveLength(1));
    await completar(0);
    expect(select).toHaveTextContent("Sin definir");
    expect(select).toHaveAccessibleDescription("Cambio guardado. Actualizando el campo…");
    expect(screen.queryByText("Guardado")).toBeNull();
    await act(async () => { resolver({ data: io.valores, error: null }); });
    await waitFor(() => {
      expect(select).toHaveTextContent("Referido");
      expect(select).toHaveAccessibleDescription("Guardado");
    });
  });

  it("avisa si la consulta termina con otro valor sin decir que sigue actualizando ni repetir la escritura", async () => {
    await tarjeta();
    const select = screen.getByRole("combobox", { name: "Fuente" });
    let resolver!: (r: { data: ValorCrm[]; error: null }) => void;
    io.refresco = () => new Promise((resolve) => { resolver = resolve; });
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Referido" }));
    await waitFor(() => expect(io.writes).toHaveLength(1));
    await completar(0);
    expect(select).toHaveAccessibleDescription("Cambio guardado. Actualizando el campo…");
    await act(async () => { resolver({ data: [{ ...io.valores[0], opcion_ids: ["Marítimo"] }], error: null }); });
    await waitFor(() => {
      expect(select).toHaveTextContent("Marítimo");
      expect(select).toHaveAccessibleDescription("El cambio se guardó, pero la última consulta devuelve otro valor. Revisa el campo.");
    });
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
    act(() => { void result.current.guardarCampo({ propiedadId: "nombre", tipo: "texto", valor: "Anterior" }); });
    await waitFor(() => expect(io.writes).toHaveLength(1));
    act(() => result.current.editar("nombre", true));
    await completar(0, error);
    expect(result.current.estados.nombre).toBe("editando");
  });

  it("una respuesta fuera de orden no reemplaza el estado de la última petición", async () => {
    const { result } = renderHook(() => useAutoguardadoPropiedadesCrm("empresa-1"), { wrapper: provider() });
    act(() => { void result.current.guardarCampo({ propiedadId: "nombre", tipo: "texto", valor: "Anterior" }); });
    act(() => { void result.current.guardarCampo({ propiedadId: "nombre", tipo: "texto", valor: "Última" }); });
    await waitFor(() => expect(io.writes).toHaveLength(2));
    await completar(1, new Error("Fallo vigente"));
    expect(result.current.estados.nombre).toBe("error");
    await completar(0);
    expect(result.current.estados.nombre).toBe("error");
  });

  it("mantiene independientes las respuestas de campos distintos", async () => {
    const { result } = renderHook(() => useAutoguardadoPropiedadesCrm("empresa-1"), { wrapper: provider() });
    act(() => { void result.current.guardarCampo({ propiedadId: "nombre", tipo: "texto", valor: "Acme" }); });
    act(() => { void result.current.guardarCampo({ propiedadId: "volumen", tipo: "numero", valor: 10 }); });
    await waitFor(() => expect(io.writes).toHaveLength(2));
    await completar(0);
    expect(result.current.estados).toEqual({ nombre: "guardado", volumen: "guardando" });
    await completar(1, new Error("Sin conexión"));
    expect(result.current.estados).toEqual({ nombre: "guardado", volumen: "error" });
  });
});

import { useState } from "react";
import { MemoryRouter } from "react-router";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBorradorNotaEmbarque } from "../../hooks/useBorradorNotaEmbarque";
import { TabNotas } from "../TabNotas";

const m = vi.hoisted(() => ({ crear: vi.fn(), salir: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canEdit: true }), useRegistrarActividad: () => ({ mutate: vi.fn() }) }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "operador@example.com" } }) }));
vi.mock("@/features/embarques/hooks", () => ({
  useActividadEmbarque: () => ({ grupos: [], conteos: {}, categoria: "todos", setCategoria: vi.fn(), items: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../../hooks/mutations/useNotaEmbarque", () => ({ useCreateNotaEmbarque: () => ({ mutateAsync: m.crear }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

function Detalle({ id = "e1" }: { id?: string }) {
  const borrador = useBorradorNotaEmbarque(id);
  const [tab, setTab] = useState("notas");
  return <>
    {borrador.guardDialog}
    <button onClick={() => borrador.confirmarSalida(m.salir)}>Volver</button>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList><TabsTrigger value="notas">Notas</TabsTrigger><TabsTrigger value="resumen">Resumen</TabsTrigger></TabsList>
      <TabsContent value="resumen">Datos del embarque</TabsContent>
      <TabsContent value="notas"><TabNotas notas={[]} embarqueId={id} texto={borrador.texto} onTextoChange={borrador.setTexto} enviando={borrador.enviando} onEnviar={borrador.enviarNota} /></TabsContent>
    </Tabs>
  </>;
}
const view = (id = "e1") => <MemoryRouter><Detalle id={id} /></MemoryRouter>;
beforeEach(() => { vi.clearAllMocks(); m.crear.mockResolvedValue("nota-1"); });

describe("borrador de nota del embarque", () => {
  it("sobrevive al desmontaje de la pestaña y protege la salida desde Resumen", () => {
    render(view());
    fireEvent.change(screen.getByRole("textbox", { name: "Nueva nota del embarque" }), { target: { value: "Confirmar cita con almacén" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Resumen" }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const recarga = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(recarga);
    expect(recarga.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(m.salir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notas" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("textbox")).toHaveValue("Confirmar cita con almacén");
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("limpia el borrador sólo después del envío confirmado y permite salir", async () => {
    render(view());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nota final" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enviar nota" })); });
    expect(screen.getByRole("textbox")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(m.salir).toHaveBeenCalledOnce();
  });

  it("no traslada borradores a otro embarque", () => {
    const { rerender } = render(view());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sólo e1" } });
    rerender(view("e2"));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("una respuesta tardía del embarque anterior no borra una nota nueva", async () => {
    let confirmar!: (id: string) => void;
    m.crear.mockImplementationOnce(() => new Promise<string>((resolve) => { confirmar = resolve; }));
    const { rerender } = render(view());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nota e1" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar nota" }));
    rerender(view("e2"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nota e2" } });
    await act(async () => { confirmar("nota-1"); });
    expect(screen.getByRole("textbox")).toHaveValue("Nota e2");
  });

  it("mantiene bloqueado el envío al desmontar y volver a Notas mientras responde", async () => {
    let confirmar!: (id: string) => void;
    m.crear.mockImplementationOnce(() => new Promise<string>((resolve) => { confirmar = resolve; }));
    render(view());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nota pendiente" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar nota" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Resumen" }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notas" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("textbox")).toHaveValue("Nota pendiente");
    expect(screen.getByRole("button", { name: "Enviar nota" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar nota" }));
    expect(m.crear).toHaveBeenCalledOnce();
    await act(async () => { confirmar("nota-1"); });
    expect(screen.getByRole("textbox")).toBeEnabled();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("sólo limpia la versión enviada y rechaza envíos simultáneos del mismo embarque", async () => {
    let confirmar!: (id: string) => void;
    m.crear.mockImplementationOnce(() => new Promise<string>((resolve) => { confirmar = resolve; }));
    const { result } = renderHook(() => useBorradorNotaEmbarque("e1"), { wrapper: MemoryRouter });
    act(() => { result.current.setTexto("Versión enviada"); });
    let envio!: Promise<void>;
    act(() => { envio = result.current.enviarNota(); void result.current.enviarNota(); });
    expect(m.crear).toHaveBeenCalledOnce();
    act(() => { result.current.setTexto("Borrador posterior"); });
    await act(async () => { confirmar("nota-1"); await envio; });
    expect(result.current.texto).toBe("Borrador posterior");
    expect(result.current.enviando).toBe(false);
  });

  it("conserva el borrador y habilita reintento después de un fallo tardío", async () => {
    let rechazar!: (error: Error) => void;
    m.crear.mockImplementationOnce(() => new Promise<string>((_resolve, reject) => { rechazar = reject; }));
    render(view());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Reintentar esta nota" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar nota" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Resumen" }), { button: 0, ctrlKey: false });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notas" }), { button: 0, ctrlKey: false });
    await act(async () => { rechazar(new Error("Sin conexión")); });
    expect(screen.getByRole("textbox")).toHaveValue("Reintentar esta nota");
    expect(screen.getByRole("button", { name: "Enviar nota" })).toBeEnabled();
    expect(m.crear).toHaveBeenCalledOnce();
  });
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExtraerCorreoDialog } from "../ExtraerCorreoDialog";
import type { FilaCorreo } from "../correo/comun";
import type { TarifaExistente } from "../duplicadosTarifas";

const mocks = vi.hoisted(() => {
  const organization: { id: string | null } = { id: "org-a" };
  return {
    organization, invoke: vi.fn(), puertos: vi.fn(), agentes: vi.fn(), navieras: vi.fn(),
    tipos: vi.fn(), rutas: vi.fn(), catalogos: vi.fn(), existentes: vi.fn(), insertarRuta: vi.fn(), insertarTarifa: vi.fn(), parser: vi.fn(),
    insertarPuerto: vi.fn(), insertarNaviera: vi.fn(),
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: mocks.organization.id }) }));
vi.mock("@/features/catalogos/services", () => ({ fetchPuertos: mocks.puertos, fetchNavieras: mocks.navieras, fetchTiposContenedor: mocks.tipos,
  insertPuerto: mocks.insertarPuerto, insertNaviera: mocks.insertarNaviera }));
vi.mock("@/features/costeo/services/importacionTarifasCorreo", () => ({
  fetchAgentesImportacionCorreo: mocks.agentes,
  fetchCatalogosImportacionCorreo: mocks.catalogos,
  fetchTarifasConflictosImportacion: mocks.existentes,
}));
vi.mock("@/features/costeo/services/rutas", () => ({ fetchCosteoRutas: mocks.rutas, insertCosteoRuta: mocks.insertarRuta }));
vi.mock("@/features/costeo/services/tarifas", () => ({ fetchCosteoTarifas: mocks.existentes, insertTarifaConRecargos: mocks.insertarTarifa }));
vi.mock("../correo/parsearCorreoTarifas", () => ({ parsearCorreoProveedor: mocks.parser }));
vi.mock("@/lib/date/mx", () => ({ hoyMx: () => "2026-10-14" }));

const correo = {
  proveedor: "longsail", asunto: "Tarifas sintéticas", fecha: "2026-10-14",
  textoPlano: "Contenido sintético", xlsxBase64: null, xlsxNombre: null,
};
const fila = (monto: number, tipo: "20" | "40" = "20"): FilaCorreo => ({
  Origen: "Shanghai", Destino: "Manzanillo", Agente: "Nombre del correo", Naviera: "MAEU",
  "Tarifa 20": tipo === "20" ? monto : 0, "Tarifa 40": tipo === "40" ? monto : 0,
  "Inicio de la vigencia": "2026-10-14", "Término de la vigencia": "2026-10-31",
  "Días libres": 21, Observaciones: "Sintética",
});
const existente: TarifaExistente = {
  id: "ex-1", agente_id: "ag-1", naviera_id: "nav-1", ruta_id: "ruta-1", tipo_contenedor_id: "t20",
  flete_base: 90, vigente_desde: "2026-10-01", vigente_hasta: "2026-10-20", estado_aprobacion: "borrador",
};
const props = () => ({ open: true, onOpenChange: vi.fn(), onDone: vi.fn() });
const buscar = () => fireEvent.click(screen.getByRole("button", { name: "Buscar tarifas en el correo" }));
const cargar = (total: number) => screen.getByRole("button", { name: `Cargar ${total} tarifa(s) en borrador` });
const prepararConflictos = () => {
  mocks.parser.mockResolvedValue({ filas: [fila(100), fila(200, "40"), fila(300, "40")], errores: [] });
  mocks.existentes.mockResolvedValue([existente]);
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.organization.id = "org-a";
  mocks.invoke.mockResolvedValue({ data: { correos: [correo] }, error: null });
  mocks.puertos.mockResolvedValue([{ id: "o", name: "Shanghai", code: "CNSHA" }, { id: "d", name: "Manzanillo", code: "MXZLO" }]);
  mocks.agentes.mockResolvedValue([{ id: "ag-1", nombre: "Agente Longsail México" }]);
  mocks.navieras.mockResolvedValue([{ id: "nav-1", name: "Maersk", code: "MAEU" }]);
  mocks.tipos.mockResolvedValue([{ id: "t20", code: "20GP" }, { id: "t40", code: "40HC" }]);
  mocks.rutas.mockResolvedValue([{ id: "ruta-1", puerto_origen_id: "o", puerto_destino_id: "d" }]);
  mocks.catalogos.mockImplementation(async (org: string) => {
    const [puertos, agentes, navieras, tipos, rutas] = await Promise.all([
      mocks.puertos(), mocks.agentes(org), mocks.navieras(), mocks.tipos(), mocks.rutas(org),
    ]);
    return { existencia: { puertos, navieras }, validacion: { puertos, agentes, navieras, tipos, rutas }, tiposComparacion: tipos };
  });
  mocks.existentes.mockResolvedValue([]);
  mocks.insertarRuta.mockResolvedValue({ id: "nueva-ruta" });
  mocks.insertarTarifa.mockResolvedValue({ id: "nueva-tarifa" });
  mocks.parser.mockResolvedValue({ filas: [fila(100)], errores: [] });
});

describe("ExtraerCorreoDialog", () => {
  it("prepara con la organización activa y no escribe antes de confirmar", async () => {
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    await waitFor(() => expect(cargar(1)).toBeEnabled());
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith("extraer-tarifas-correo", { body: { organizationId: "org-a" } });
    expect(mocks.agentes).toHaveBeenCalledTimes(2);
    expect(mocks.agentes).toHaveBeenNthCalledWith(1, "org-a");
    expect(mocks.agentes).toHaveBeenNthCalledWith(2, "org-a");
    expect(mocks.rutas).toHaveBeenCalledExactlyOnceWith("org-a");
    expect(mocks.existentes).toHaveBeenCalledExactlyOnceWith("org-a");
    expect(mocks.parser).toHaveBeenCalledExactlyOnceWith(correo, "2026-10-14");
    expect(mocks.insertarRuta).not.toHaveBeenCalled();
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
  });

  it.each([new Error("fallo de transporte"), { message: "acceso denegado" }])("muestra errores de invoke sin consultar catálogos ni importar", async (error) => {
    render(<ExtraerCorreoDialog {...props()} />);
    mocks.invoke.mockResolvedValue({ data: null, error });
    buscar();
    expect(await screen.findByText(`No se pudieron leer los correos: ${error.message}`)).toBeInTheDocument();
    expect(mocks.puertos).not.toHaveBeenCalled();
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Cargar/ })).not.toBeInTheDocument();
  });

  it("muestra respuesta inválida y no la interpreta como cero correos", async () => {
    mocks.invoke.mockResolvedValue({ data: { correos: [correo, { ...correo, proveedor: "otro" }] }, error: null });
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    expect(await screen.findByText(/No se pudieron leer los correos: .*respuesta inválida/)).toBeInTheDocument();
    expect(mocks.parser).not.toHaveBeenCalled();
    expect(mocks.puertos).not.toHaveBeenCalled();
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
  });

  it("muestra el fallo al cargar tarifas existentes sin ofrecer importación", async () => {
    mocks.existentes.mockRejectedValue(new Error("tarifario no disponible"));
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    expect(await screen.findByText(/No se pudieron leer los correos: tarifario no disponible/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cargar/ })).not.toBeInTheDocument();
  });

  it.each(["catalogos", "existentes"] as const)("bloquea preparación y altas si falla una página posterior de %s", async (lector) => {
    mocks.parser.mockResolvedValue({ filas: [{ ...fila(100), Origen: "Puerto Sintético" }], errores: [] });
    mocks[lector].mockRejectedValue(new Error("falló página posterior"));
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    expect(await screen.findByText(/No se pudieron leer los correos: falló página posterior/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cargar|Dar de alta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Dar de alta/ })).not.toBeInTheDocument();
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
    expect(mocks.insertarPuerto).not.toHaveBeenCalled();
    expect(mocks.insertarNaviera).not.toHaveBeenCalled();
  });

  it("muestra inactivos existentes sin ofrecer su alta ni importación", async () => {
    mocks.catalogos.mockResolvedValue({
      existencia: { puertos: [{ id: "o", name: "Shanghai", code: "CNSHA" }, { id: "d", name: "Manzanillo", code: "MXZLO" }],
        navieras: [{ id: "nav-1", name: "Maersk", code: "MAEU" }] },
      validacion: { puertos: [{ id: "d", name: "Manzanillo", code: "MXZLO" }], navieras: [], tipos: [],
        agentes: [{ id: "ag-1", nombre: "Agente Longsail México" }], rutas: [] },
      tiposComparacion: [],
    });
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    expect(await screen.findByText(/origen «Shanghai» está inactivo.*naviera «MAEU» está inactiva/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cargar|Dar de alta/ })).not.toBeInTheDocument();
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
    expect(mocks.insertarPuerto).not.toHaveBeenCalled();
    expect(mocks.insertarNaviera).not.toHaveBeenCalled();
  });

  it("desmarca un conflicto por alias y guarda el UUID preparado sólo al elegir conservarlo", async () => {
    mocks.tipos.mockResolvedValue([{ id: "t20", code: "20GP", idsEquivalentes: ["t20", "legacy"] }]);
    mocks.existentes.mockResolvedValue([{ ...existente, tipo_contenedor_id: "legacy" }]);
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    await waitFor(() => expect(cargar(0)).toBeDisabled());
    expect(screen.getByRole("checkbox", { name: /Fila 2:/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /Fila 2:/ }));
    fireEvent.click(cargar(1));
    await waitFor(() => expect(mocks.insertarTarifa).toHaveBeenCalledExactlyOnceWith("org-a", expect.objectContaining({ tipo_contenedor_id: "t20" })));
  });

  it("retira los pendientes anteriores y muestra el fallo al volver a prepararlos", async () => {
    mocks.parser.mockResolvedValue({ filas: [{ ...fila(100), Origen: "Puerto Sintético" }], errores: [] });
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Dar de alta Puerto Sintético" }));
    fireEvent.change(screen.getByLabelText("Código de Puerto Sintético"), { target: { value: "CNZZZ" } });
    fireEvent.click(screen.getByRole("button", { name: "Dar de alta 1 seleccionado(s)" }));
    const preparar = await screen.findByRole("button", { name: "Dar de alta 1 tarifa(s) pendientes" });
    mocks.existentes.mockRejectedValueOnce(new Error("falló página posterior"));
    fireEvent.click(preparar);
    expect(await screen.findByText(/No se pudieron preparar las tarifas: falló página posterior/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cargar|Dar de alta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Dar de alta/ })).not.toBeInTheDocument();
    expect(mocks.insertarPuerto).toHaveBeenCalledTimes(1);
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
  });

  it("conserva la selección inicial de main e importa únicamente la fila sin conflicto", async () => {
    prepararConflictos();
    const p = props();
    render(<ExtraerCorreoDialog {...p} />);
    buscar();
    await waitFor(() => expect(cargar(1)).toBeEnabled());
    expect(screen.getByRole("checkbox", { name: /Fila 2:/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Fila 4:/ })).not.toBeChecked();
    expect(screen.getByText(/Ya existe una tarifa en borrador/)).toBeInTheDocument();
    expect(screen.getByText(/Repetida en este lote con la fila 3/)).toBeInTheDocument();
    fireEvent.click(cargar(1));
    await waitFor(() => expect(p.onDone).toHaveBeenCalledTimes(1));
    expect(mocks.insertarTarifa).toHaveBeenCalledExactlyOnceWith("org-a", expect.objectContaining({ flete_base: 200, tipo_contenedor_id: "t40", ruta_id: "ruta-1", agente_id: "ag-1" }));
    expect(mocks.insertarRuta).not.toHaveBeenCalled();
  });

  it("permite conservar un conflicto existente de forma explícita", async () => {
    prepararConflictos();
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    await waitFor(() => expect(cargar(1)).toBeEnabled());
    fireEvent.click(screen.getByRole("checkbox", { name: /Fila 2:/ }));
    expect(screen.getByRole("checkbox", { name: /Fila 2:/ })).toBeChecked();
    fireEvent.click(cargar(2));
    await waitFor(() => expect(mocks.insertarTarifa).toHaveBeenCalledTimes(2));
    expect(mocks.insertarTarifa.mock.calls.map(([, input]) => input.flete_base)).toEqual([100, 200]);
  });

  it("permite desmarcar conflictos y conservar sólo el repetido elegido", async () => {
    prepararConflictos();
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    await waitFor(() => expect(cargar(1)).toBeEnabled());
    const existenteCheckbox = screen.getByRole("checkbox", { name: /Fila 2:/ });
    fireEvent.click(existenteCheckbox);
    fireEvent.click(existenteCheckbox);
    expect(existenteCheckbox).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /Fila 4:/ }));
    fireEvent.click(cargar(2));
    await waitFor(() => expect(mocks.insertarTarifa).toHaveBeenCalledTimes(2));
    expect(mocks.insertarTarifa.mock.calls.map(([, input]) => input.flete_base)).toEqual([200, 300]);
  });

  it("impide cargar cuando todos los renglones están deseleccionados", async () => {
    mocks.existentes.mockResolvedValue([existente]);
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    await waitFor(() => expect(cargar(0)).toBeDisabled());
    fireEvent.click(cargar(0));
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
  });

  it("reutiliza una ruta nueva sólo para las filas seleccionadas de la misma organización", async () => {
    mocks.rutas.mockResolvedValue([]);
    mocks.parser.mockResolvedValue({ filas: [fila(100), fila(200, "40"), fila(300, "40")], errores: [] });
    const p = props();
    render(<ExtraerCorreoDialog {...p} />);
    buscar();
    await waitFor(() => expect(cargar(2)).toBeEnabled());
    fireEvent.click(cargar(2));
    await waitFor(() => expect(p.onDone).toHaveBeenCalledTimes(1));
    expect(mocks.insertarRuta).toHaveBeenCalledExactlyOnceWith("org-a", { puerto_origen_id: "o", puerto_destino_id: "d" });
    expect(mocks.insertarTarifa).toHaveBeenCalledTimes(2);
    expect(mocks.insertarTarifa).toHaveBeenNthCalledWith(1, "org-a", expect.objectContaining({ ruta_id: "nueva-ruta", flete_base: 100 }));
    expect(mocks.insertarTarifa).toHaveBeenNthCalledWith(2, "org-a", expect.objectContaining({ ruta_id: "nueva-ruta", flete_base: 200 }));
  });

  it("muestra errores de importación y cuenta únicamente las creaciones exitosas", async () => {
    mocks.parser.mockResolvedValue({ filas: [fila(100), fila(200, "40")], errores: [] });
    mocks.insertarTarifa.mockRejectedValueOnce(new Error("fallo sintético al guardar"));
    const p = props();
    render(<ExtraerCorreoDialog {...p} />);
    buscar();
    await waitFor(() => expect(cargar(2)).toBeEnabled());
    fireEvent.click(cargar(2));
    expect(await screen.findByText("Fila 2: fallo sintético al guardar")).toBeInTheDocument();
    expect(mocks.insertarTarifa).toHaveBeenCalledTimes(2);
    expect(p.onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Se cargaron/)).toHaveTextContent("Se cargaron 1 tarifa(s) en borrador.");
  });

  it("oculta la extracción de otra organización y exige una nueva antes de importar", async () => {
    const p = props();
    const view = render(<ExtraerCorreoDialog {...p} />);
    buscar();
    await waitFor(() => expect(cargar(1)).toBeEnabled());
    mocks.organization.id = "org-b";
    view.rerender(<ExtraerCorreoDialog {...p} />);
    expect(screen.queryByRole("button", { name: /Cargar/ })).not.toBeInTheDocument();
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
    buscar();
    await waitFor(() => expect(mocks.existentes).toHaveBeenLastCalledWith("org-b"));
    await waitFor(() => expect(cargar(1)).toBeEnabled());
    fireEvent.click(cargar(1));
    await waitFor(() => expect(p.onDone).toHaveBeenCalledTimes(1));
    expect(mocks.insertarTarifa).toHaveBeenCalledExactlyOnceWith("org-b", expect.objectContaining({ flete_base: 100 }));
  });

  it("conserva la organización capturada si cambia durante una extracción pendiente", async () => {
    let completar!: (value: { data: { correos: typeof correo[] }; error: null }) => void;
    mocks.invoke.mockReturnValue(new Promise((resolve) => { completar = resolve; }));
    const p = props();
    const view = render(<ExtraerCorreoDialog {...p} />);
    buscar();
    mocks.organization.id = "org-b";
    view.rerender(<ExtraerCorreoDialog {...p} />);
    await act(async () => completar({ data: { correos: [correo] }, error: null }));
    expect(mocks.agentes).toHaveBeenCalledTimes(2);
    expect(mocks.agentes).toHaveBeenNthCalledWith(1, "org-a");
    expect(mocks.agentes).toHaveBeenNthCalledWith(2, "org-a");
    expect(mocks.rutas).toHaveBeenCalledExactlyOnceWith("org-a");
    expect(mocks.existentes).toHaveBeenCalledExactlyOnceWith("org-a");
    expect(screen.queryByRole("button", { name: /Cargar/ })).not.toBeInTheDocument();
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
  });

  it("no invoca la extracción sin organización", () => {
    mocks.organization.id = null;
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("conserva el acordeón por proveedor y permite desplegar las tarifas", async () => {
    render(<ExtraerCorreoDialog {...props()} />);
    buscar();
    const proveedor = await screen.findByRole("button", { name: /Longsail.*1 tarifa\(s\) por cargar/ });
    expect(proveedor).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(proveedor);
    expect(proveedor).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Fila 2: Shanghai.*Manzanillo.*Maersk/)).toBeInTheDocument();
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
    expect(mocks.insertarPuerto).not.toHaveBeenCalled();
    expect(mocks.insertarNaviera).not.toHaveBeenCalled();
  });

  it("preserva el alta mock de faltantes y prepara sus tarifas con catálogos frescos", async () => {
    mocks.parser.mockResolvedValue({ filas: [{ ...fila(100), Origen: "Puerto Sintético", Naviera: "Naviera Sintética" }], errores: [] });
    mocks.insertarPuerto.mockResolvedValue({ id: "puerto-sintetico" });
    mocks.insertarNaviera.mockResolvedValue({ id: "naviera-sintetica" });
    const p = props();
    render(<ExtraerCorreoDialog {...p} />);
    buscar();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Dar de alta Puerto Sintético" }));
    fireEvent.change(screen.getByLabelText("Código de Puerto Sintético"), { target: { value: "CNZZZ" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Dar de alta Naviera Sintética" }));
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dar de alta 2 seleccionado(s)" }));
    const preparar = await screen.findByRole("button", { name: "Dar de alta 1 tarifa(s) pendientes" });
    expect(mocks.insertarPuerto).toHaveBeenCalledExactlyOnceWith({ name: "Puerto Sintético", code: "CNZZZ", country: "China" });
    expect(mocks.insertarNaviera).toHaveBeenCalledExactlyOnceWith({ name: "Naviera Sintética", code: "NAVIERA SINTÉTICA" });
    mocks.puertos.mockResolvedValue([{ id: "puerto-sintetico", name: "Puerto Sintético", code: "CNZZZ" }, { id: "d", name: "Manzanillo", code: "MXZLO" }]);
    mocks.navieras.mockResolvedValue([{ id: "naviera-sintetica", name: "Naviera Sintética", code: "NAVIERA SINTÉTICA" }]);
    fireEvent.click(preparar);
    await waitFor(() => expect(cargar(1)).toBeEnabled());
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.puertos).toHaveBeenCalledTimes(2);
    expect(mocks.existentes).toHaveBeenNthCalledWith(2, "org-a");
    fireEvent.click(cargar(1));
    await waitFor(() => expect(p.onDone).toHaveBeenCalledTimes(1));
    expect(mocks.insertarTarifa).toHaveBeenCalledExactlyOnceWith("org-a", expect.objectContaining({ naviera_id: "naviera-sintetica", flete_base: 100 }));
  });

  it("no ofrece faltantes ni reintentos de otra organización", async () => {
    mocks.parser.mockResolvedValue({ filas: [{ ...fila(100), Origen: "Puerto Sintético" }], errores: [] });
    const p = props();
    const view = render(<ExtraerCorreoDialog {...p} />);
    buscar();
    expect(await screen.findByRole("checkbox", { name: "Dar de alta Puerto Sintético" })).toBeInTheDocument();
    mocks.organization.id = "org-b";
    view.rerender(<ExtraerCorreoDialog {...p} />);
    expect(screen.queryByRole("checkbox", { name: "Dar de alta Puerto Sintético" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tarifa\(s\) pendientes/ })).not.toBeInTheDocument();
    expect(mocks.insertarPuerto).not.toHaveBeenCalled();
    expect(mocks.insertarNaviera).not.toHaveBeenCalled();
    expect(mocks.insertarTarifa).not.toHaveBeenCalled();
  });
});

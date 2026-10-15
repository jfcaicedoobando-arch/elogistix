import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crm } from "@/features/crm/queryKeys";
import { LLAVE_SOLICITUD_RESPONDIDA } from "@/features/crm/services/solicitudRespondidaCrm";

const fetches = vi.hoisted(() => ({ empresa: vi.fn(), respuesta: vi.fn() }));
vi.mock("@/features/crm/services/empresaEliminadaCrm", () => ({ fetchOportunidadesEmpresaEliminada: fetches.empresa }));
vi.mock("@/features/crm/services/solicitudRespondidaCrm", async (original) => ({
  ...await original<typeof import("@/features/crm/services/solicitudRespondidaCrm")>(),
  fetchOportunidadesSolicitudRespondida: fetches.respuesta,
}));
import { EtiquetaEmpresaEliminada } from "@/features/crm/components/objetos/EtiquetaEmpresaEliminada";
import { EtiquetaSolicitudRespondida } from "@/features/crm/components/objetos/EtiquetaSolicitudRespondida";

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fetches.empresa.mockReset().mockResolvedValue(new Set(["o1"]));
  fetches.respuesta.mockReset().mockResolvedValue(new Set(["o2"]));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No se permite red real"); }));
});
afterEach(() => { cleanup(); client.clear(); });

describe("etiquetas de oportunidad compartidas", () => {
  it("conserva las llaves y una lectura por conjunto para varias tarjetas", async () => {
    render(<QueryClientProvider client={client}>
      {["o1", "o2", "sin-vínculos"].map((id) => <div key={id} data-testid={id}>
        <EtiquetaEmpresaEliminada oportunidadId={id} /><EtiquetaSolicitudRespondida oportunidadId={id} />
      </div>)}
    </QueryClientProvider>);
    await screen.findByText("Empresa eliminada"); await screen.findByText("Solicitud respondida");
    expect(screen.getByTestId("o1")).toHaveTextContent("Empresa eliminada");
    expect(screen.getByTestId("o2")).toHaveTextContent("Solicitud respondida");
    expect(screen.getByTestId("sin-vínculos")).toBeEmptyDOMElement();
    expect(fetches.empresa).toHaveBeenCalledTimes(1); expect(fetches.respuesta).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(crm.objetos.empresaEliminada)).toEqual(new Set(["o1"]));
    expect(client.getQueryData(LLAVE_SOLICITUD_RESPONDIDA)).toEqual(new Set(["o2"]));
  });

  it("invalidar oportunidades respondidas actualiza el badge aunque siga fresco", async () => {
    render(<QueryClientProvider client={client}><EtiquetaSolicitudRespondida oportunidadId="o2" /></QueryClientProvider>);
    await screen.findByText("Solicitud respondida");
    fetches.respuesta.mockResolvedValue(new Set());
    await act(() => client.invalidateQueries({ queryKey: LLAVE_SOLICITUD_RESPONDIDA }));
    await waitFor(() => expect(screen.queryByText("Solicitud respondida")).not.toBeInTheDocument());
    expect(fetches.respuesta).toHaveBeenCalledTimes(2);
  });
});

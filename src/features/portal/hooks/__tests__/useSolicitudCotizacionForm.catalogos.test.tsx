import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SolicitudRutaFields } from "@/features/portal/components/SolicitudRutaFields";
import { guardarSolicitudPreferencias, SOLICITUD_PREFS_DEFAULT } from "@/features/portal/domain/solicitudPreferencias";
import { useSolicitudCotizacionForm } from "../useSolicitudCotizacionForm";

const catalogo = vi.hoisted(() => ({
  puertos: [] as { id: string; name: string; country: string; code: string }[],
}));
vi.mock("@/features/catalogos/hooks", () => ({ usePuertos: () => ({ data: catalogo.puertos }) }));
vi.mock("@/features/catalogos", async () => ({
  PortSelect: (await import("@/features/catalogos/components/PortSelect")).default,
}));

function RutaEnEdicion() {
  const f = useSolicitudCotizacionForm("cli-1");
  return (
    <>
      <SolicitudRutaFields
        modo={f.modo} origen={f.origen} setOrigen={f.setOrigen}
        destino={f.destino} setDestino={f.setDestino}
        puertoOrigenId={f.puertoOrigenId} puertoDestinoId={f.puertoDestinoId}
        intentoEnvio={f.intentoEnvio} origenVacio={f.origenVacio} destinoVacio={f.destinoVacio}
      />
      <output aria-label="Identidad de puertos">{JSON.stringify([f.puertoOrigenId, f.puertoDestinoId])}</output>
    </>
  );
}

beforeEach(() => {
  guardarSolicitudPreferencias(SOLICITUD_PREFS_DEFAULT);
  catalogo.puertos = [];
});

describe("useSolicitudCotizacionForm · catálogo tardío", () => {
  it("conserva texto libre y selección mientras llega o se actualiza el catálogo", async () => {
    const { rerender } = render(<RutaEnEdicion />);
    fireEvent.click(screen.getByLabelText(/^Origen/));
    fireEvent.change(screen.getByPlaceholderText(/Buscar puerto/), { target: { value: "Puerto propio" } });
    fireEvent.click(await screen.findByRole("button", { name: /Usar.*Puerto propio/ }));
    expect(screen.getByLabelText(/^Origen/)).toHaveTextContent("Puerto propio");

    catalogo.puertos = [{ id: "p-1", name: "Valencia", country: "España", code: "ESVLC" }];
    rerender(<RutaEnEdicion />);
    expect(screen.getByLabelText(/^Origen/)).toHaveTextContent("Puerto propio");
    expect(screen.getByLabelText("Identidad de puertos")).toHaveTextContent("[null,null]");

    fireEvent.click(screen.getByLabelText(/^Destino/));
    fireEvent.click(await screen.findByRole("option", { name: /Valencia, España \(ESVLC\)/ }));
    expect(screen.getByLabelText(/^Destino/)).toHaveTextContent("Valencia, España (ESVLC)");
    expect(screen.getByLabelText("Identidad de puertos")).toHaveTextContent('[null,"p-1"]');

    catalogo.puertos = [{ id: "p-1", name: "Nombre actualizado", country: "España", code: "ESVLC" }];
    rerender(<RutaEnEdicion />);
    expect(screen.getByLabelText(/^Origen/)).toHaveTextContent("Puerto propio");
    expect(screen.getByLabelText(/^Destino/)).toHaveTextContent("Valencia, España (ESVLC)");
    expect(screen.getByLabelText("Identidad de puertos")).toHaveTextContent('[null,"p-1"]');
  });
});

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DataTable } from "@/components/shared/DataTable";
import { buildProformasColumns } from "../proformasColumns";
import { ProformaMobileCard } from "../ProformaMobileCard";
import { ProformasFiltrosCampos } from "../ProformasFiltrosCampos";
import { proformaFixture } from "./fixtures/proforma";

describe("presentación de proformas canceladas en listado", () => {
  it.each(["pendiente", "aceptada", "rechazada"])(
    "tabla y móvil priorizan Cancelada sobre %s y conservan cifras históricas",
    (estado_cliente) => {
      const proforma = proformaFixture({
        estado_proforma: "cancelada", estado_cliente, factura_id: "factura-historica",
        facturas_asociadas: [{ id: "factura-historica", estado: "Cancelada", uuid_fiscal: "uuid-historico", deleted_at: null }],
        total_mxn: 116, total_usd: 58, totales_origen: "encabezado_sin_detalle",
      });
      const table = render(<MemoryRouter><DataTable columns={buildProformasColumns({})} data={[proforma]} rowKey={(row) => row.id} /></MemoryRouter>);
      expect(screen.getByText("Cancelada")).toBeInTheDocument();
      expect(screen.queryByText("Facturada")).not.toBeInTheDocument();
      expect(screen.getByText("116.00")).toBeInTheDocument();
      expect(screen.getByText("58.00")).toBeInTheDocument();
      table.unmount();
      render(<ProformaMobileCard proforma={proforma} />);
      expect(screen.getByText("Cancelada")).toBeInTheDocument();
      expect(screen.queryByText(/Pendiente|Aceptada|Rechazada|Facturada/)).not.toBeInTheDocument();
      expect(screen.getByText(/MXN.*116.00/)).toBeInTheDocument();
      expect(screen.getByText(/USD.*58.00/)).toBeInTheDocument();
      expect(proforma.facturas_asociadas).toHaveLength(1);
    },
  );

  it("ofrece Cancelada en el selector Estado", () => {
    const onFiltroEstadoChange = vi.fn();
    render(<ProformasFiltrosCampos
      layout="inline" search="" onSearchChange={vi.fn()}
      filtroEstado="todas" onFiltroEstadoChange={onFiltroEstadoChange}
      filtroCliente="todos" onFiltroClienteChange={vi.fn()}
      filtroOperador="todos" onFiltroOperadorChange={vi.fn()}
      fechaDesde="" onFechaDesdeChange={vi.fn()} fechaHasta="" onFechaHastaChange={vi.fn()}
      clientes={[]} operadores={[]}
    />);
    fireEvent.click(screen.getByRole("combobox", { name: "Estado de la proforma" }));
    fireEvent.click(screen.getByRole("option", { name: "Cancelada" }));
    expect(onFiltroEstadoChange).toHaveBeenCalledWith("cancelada");
  });
});

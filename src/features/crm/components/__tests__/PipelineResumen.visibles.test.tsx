import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PipelineResumen from "../kanban/PipelineResumen";
import { resumenEtapasVisibles } from "../../domain/resumenEtapasVisibles";
import { totalesEtapa } from "../../domain/criterios";
import type { CrmOportunidadRow, CrmEtapaRow } from "../../hooks";

const etapas: Pick<CrmEtapaRow, "id" | "tipo">[] = [
  { id: "abierta", tipo: "abierta" }, { id: "ganada", tipo: "ganada" }, { id: "perdida", tipo: "perdida" },
];
const op = (etapa_id: string | null, moneda = "USD"): CrmOportunidadRow => ({ etapa_id, moneda, monto_estimado: 1000, monto_meta: 2000, probabilidad: 50 } as CrmOportunidadRow);

describe("resumen del conjunto visible, no sólo de abiertas", () => {
  it("identifica correctamente tres abiertas y una ganada sin cambiar los montos", () => {
    const oportunidades = [op("abierta"), op("abierta"), op("abierta"), op("ganada")];
    render(<PipelineResumen oportunidades={oportunidades} etapas={etapas} />);
    expect(screen.getByText("4 oportunidades visibles")).toBeInTheDocument();
    expect(screen.getByText("3 abiertas · 1 ganada · 0 perdidas")).toBeInTheDocument();
    expect(screen.queryByText("4 oportunidades abiertas")).not.toBeInTheDocument();
    expect(totalesEtapa(oportunidades)).toEqual({ cantidad: 4, porMoneda: [{ moneda: "USD", estimado: 4000, meta: 8000, ponderado: 2000 }] });
  });

  it("cuenta sólo las filas visibles y explicita las etapas desconocidas", () => {
    expect(resumenEtapasVisibles([op("ganada"), op("perdida"), op(null), op("borrada")], etapas)).toEqual({ abiertas: 0, ganadas: 1, perdidas: 1, sinEtapa: 2 });
    render(<PipelineResumen oportunidades={[op("ganada")]} etapas={etapas} />);
    expect(screen.getByText("1 oportunidad visible")).toBeInTheDocument();
    expect(screen.getByText("0 abiertas · 1 ganada · 0 perdidas")).toBeInTheDocument();
  });

  it("mantiene monedas separadas y no inventa cumplimiento global", () => {
    render(<PipelineResumen oportunidades={[op("abierta", "MXN"), op("ganada", "USD")]} etapas={etapas} />);
    expect(screen.getAllByText(/MXN.* · .*USD/)).toHaveLength(3);
    expect(screen.queryByText(/de la meta capturada/)).not.toBeInTheDocument();
  });

  it("maneja el conjunto vacío", () => {
    expect(resumenEtapasVisibles([], etapas)).toEqual({ abiertas: 0, ganadas: 0, perdidas: 0, sinEtapa: 0 });
    render(<PipelineResumen oportunidades={[]} etapas={etapas} />);
    expect(screen.getByText("0 oportunidades visibles")).toBeInTheDocument();
  });
});

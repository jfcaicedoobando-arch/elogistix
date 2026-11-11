import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CrmEtapaRow, CrmOportunidadRow } from "@/features/crm/hooks";

vi.mock("@/features/crm/hooks", () => ({ useProximasActividades: () => ({ data: new Map() }) }));
vi.mock("@/features/crm/hooks/useCriteriosEtapa", () => ({ useAvanceCriterios: () => ({ data: new Map() }) }));
vi.mock("@/features/crm/components/objetos/EtiquetaEmpresaEliminada", () => ({ EtiquetaEmpresaEliminada: () => null }));
vi.mock("@/features/crm/components/objetos/EtiquetaSolicitudRespondida", () => ({ EtiquetaSolicitudRespondida: () => null }));

import OportunidadKanban from "../OportunidadKanban";

const etapas = [
  { id: "e-1", nombre: "Calificación", tipo: "abierta", probabilidad_default: 25 },
  { id: "e-2", nombre: "Negociación", tipo: "abierta", probabilidad_default: 60 },
] as CrmEtapaRow[];
const op = { id: "op-1", nombre: "Importación", etapa_id: "e-1", moneda: "MXN", probabilidad: 25 } as CrmOportunidadRow;
function mount(puedeMover = true) {
  const onMover = vi.fn();
  const onClickCard = vi.fn();
  render(<OportunidadKanban etapas={etapas} oportunidades={[op]} onMover={onMover} onClickCard={onClickCard} puedeMover={() => puedeMover} />);
  return { onMover, onClickCard };
}
beforeEach(() => {
  // jsdom no calcula posiciones. Se conservan sensores/colisiones reales de dnd-kit
  // con dos columnas medibles, incluida una vacía como destino.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const etiqueta = this.getAttribute("aria-label");
    if (etiqueta === "Oportunidades en Calificación") return new DOMRect(0, 100, 288, 180);
    if (etiqueta === "Oportunidades en Negociación") return new DOMRect(300, 100, 288, 160);
    if (this.classList.contains("bg-card")) return new DOMRect(8, 108, 272, 100);
    return new DOMRect(0, 0, 900, 600);
  });
});
afterEach(() => vi.restoreAllMocks());

it("ofrece apertura nativa y enfoque incluso sin permiso de mover", () => {
  const { onClickCard } = mount(false);
  const abrir = screen.getByRole("button", { name: "Ver oportunidad Importación" });
  expect(abrir.tagName).toBe("BUTTON");
  act(() => abrir.focus());
  expect(abrir).toHaveFocus();
  fireEvent.click(abrir);
  expect(onClickCard).toHaveBeenCalledExactlyOnceWith("op-1");
  expect(screen.queryByRole("button", { name: "Mover Importación de etapa" })).not.toBeInTheDocument();
});

it("Espacio, flecha derecha y Espacio mueven a la etapa vacía sin abrir el detalle", async () => {
  const { onMover, onClickCard } = mount();
  const mover = screen.getByRole("button", { name: "Mover Importación de etapa" });
  mover.focus();
  fireEvent.keyDown(mover, { code: "Space", key: " " });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Moviendo Importación|Etapa de destino: Calificación/));
  fireEvent.keyDown(document, { code: "ArrowRight", key: "ArrowRight" });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Etapa de destino: Negociación"));
  fireEvent.keyDown(document, { code: "Space", key: " " });
  await waitFor(() => expect(onMover).toHaveBeenCalledExactlyOnceWith("op-1", "e-2", 60));
  expect(onClickCard).not.toHaveBeenCalled();
});

it("Escape cancela el cambio de etapa", async () => {
  const { onMover, onClickCard } = mount();
  const mover = screen.getByRole("button", { name: "Mover Importación de etapa" });
  mover.focus();
  fireEvent.keyDown(mover, { code: "Space", key: " " });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Moviendo Importación|Etapa de destino: Calificación/));
  fireEvent.keyDown(document, { code: "Escape", key: "Escape" });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Movimiento cancelado"));
  expect(onMover).not.toHaveBeenCalled();
  expect(onClickCard).not.toHaveBeenCalled();
});

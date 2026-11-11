import { fireEvent, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { CrmOportunidadRow } from "@/features/crm/hooks";
import OportunidadCard from "../OportunidadCard";

const perfil = vi.hoisted(() => ({ x: 0, onRender: vi.fn() }));
vi.mock("@dnd-kit/core", () => ({
  useDraggable: () => ({
    attributes: {}, listeners: {}, setNodeRef: () => undefined,
    transform: perfil.x ? { x: perfil.x, y: 0 } : null,
    isDragging: perfil.x > 0,
  }),
}));
vi.mock("@/components/shared/Hint", () => ({
  Hint: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/crm/components/objetos/EtiquetaEmpresaEliminada", () => ({
  EtiquetaEmpresaEliminada: () => null,
}));
vi.mock("@/features/crm/components/objetos/EtiquetaSolicitudRespondida", () => ({
  EtiquetaSolicitudRespondida: () => null,
}));
vi.mock("../OportunidadCard.parts", async (importOriginal) => {
  const { Profiler } = await import("react");
  const parts = await importOriginal<typeof import("../OportunidadCard.parts")>();
  return {
    ...parts,
    ProximaRow: (props: React.ComponentProps<typeof parts.ProximaRow>) => (
      <Profiler id="contenido-tarjeta" onRender={perfil.onRender}>
        <parts.ProximaRow {...props} />
      </Profiler>
    ),
  };
});

it("actualiza el arrastre sin volver a renderizar el contenido de la tarjeta", () => {
  perfil.x = 0;
  perfil.onRender.mockClear();
  const op = { id: "op-1", nombre: "Operación A", moneda: "MXN", probabilidad: 50 } as CrmOportunidadRow;
  const onClick = vi.fn();
  const tarjeta = () => <OportunidadCard op={op} onClick={onClick} esCerrada={false} />;
  const { container, rerender } = render(tarjeta());
  const card = container.firstElementChild as HTMLElement;
  for (let paso = 1; paso <= 20; paso += 1) {
    perfil.x = paso;
    rerender(tarjeta());
  }
  expect(card.style.transform).toBe("translate3d(20px, 0px, 0px)");
  fireEvent.click(card);
  expect(onClick).not.toHaveBeenCalled();
  perfil.x = 0;
  rerender(tarjeta());
  fireEvent.click(card);
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(perfil.onRender).toHaveBeenCalledTimes(1);
});

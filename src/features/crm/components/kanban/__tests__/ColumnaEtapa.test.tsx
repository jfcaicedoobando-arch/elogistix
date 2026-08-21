/**
 * Ola 8 · paginación por columna del kanban CRM: cada etapa renderiza como
 * máximo LIMITE_ETAPA_INICIAL tarjetas, muestra el aviso de truncamiento y
 * "Mostrar más" amplía la ventana por INCREMENTO_ETAPA.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import ColumnaEtapa, {
  INCREMENTO_ETAPA,
  LIMITE_ETAPA_INICIAL,
} from "@/features/crm/components/kanban/ColumnaEtapa";
import type { CrmEtapaRow, CrmOportunidadRow } from "@/features/crm/hooks";

const ETAPA = {
  id: "e1",
  nombre: "Calificación",
  tipo: "abierta",
  color: null,
  probabilidad_default: 50,
} as unknown as CrmEtapaRow;

function op(i: number): CrmOportunidadRow {
  return {
    id: `op-${i}`,
    etapa_id: ETAPA.id,
    nombre: `Oportunidad ${i}`,
    monto_estimado: 1000,
    probabilidad: 50,
  } as unknown as CrmOportunidadRow;
}

function renderColumna(n: number) {
  const ops = Array.from({ length: n }, (_, i) => op(i));
  return render(
    <DndContext>
      <ColumnaEtapa
        etapa={ETAPA}
        ops={ops}
        onClickCard={() => {}}
        proximasMap={new Map()}
        avanceMap={new Map()}
      />
    </DndContext>,
  );
}

describe("ColumnaEtapa · límite por etapa (Ola 8)", () => {
  it("sin truncamiento no muestra aviso ni botón", () => {
    renderColumna(3);
    expect(screen.queryByText(/Mostrando \d+ de \d+ en esta etapa/)).toBeNull();
    expect(screen.queryByText("Mostrar más")).toBeNull();
  });

  it("trunca en el límite, avisa y 'Mostrar más' amplía por incremento", () => {
    const total = LIMITE_ETAPA_INICIAL + 5;
    renderColumna(total);

    // Sólo se renderizan las primeras LIMITE_ETAPA_INICIAL tarjetas.
    expect(screen.queryByText(`Oportunidad ${LIMITE_ETAPA_INICIAL}`)).toBeNull();
    expect(
      screen.getByText(`Mostrando ${LIMITE_ETAPA_INICIAL} de ${total} en esta etapa`),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Mostrar más"));

    const esperado = Math.min(total, LIMITE_ETAPA_INICIAL + INCREMENTO_ETAPA);
    if (esperado >= total) {
      expect(screen.queryByText(/Mostrando \d+ de \d+ en esta etapa/)).toBeNull();
      expect(screen.getByText(`Oportunidad ${total - 1}`)).toBeTruthy();
    } else {
      expect(screen.getByText(`Mostrando ${esperado} de ${total} en esta etapa`)).toBeTruthy();
    }
  });
});

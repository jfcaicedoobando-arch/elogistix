/**
 * Tests para NavieraSelect (Q-13): valida el empty-state accionable.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavieraSelect } from "@/features/catalogos/components/NavieraSelect";

vi.mock("@/features/catalogos/hooks/useNavieras", () => ({
  useNavieras: vi.fn(),
}));

vi.mock("@/components/shared/NavieraFormDialog", () => ({
  NavieraFormDialog: () => null,
}));

import { useNavieras } from "@/features/catalogos/hooks/useNavieras";

describe("<NavieraSelect />", () => {
  it("muestra el empty-state con la CTA de crear naviera cuando el catálogo está vacío", () => {
    vi.mocked(useNavieras).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useNavieras>);
    render(<NavieraSelect value={null} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByTestId("naviera-select-empty")).toBeInTheDocument();
    expect(screen.getByText(/No hay navieras activas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear naviera/i })).toBeInTheDocument();
  });
});

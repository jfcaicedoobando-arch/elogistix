import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmbarquesSortIndicator } from "../EmbarquesSortIndicator";

function Listado() {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "expediente", dir: "desc" });
  return <><EmbarquesSortIndicator sortKey={sort.key} sortDir={sort.dir}
    onSortChange={(key, dir) => setSort({ key, dir })}
    onClear={() => setSort({ key: "expediente", dir: "desc" })} />
    <output>{`${sort.key}:${sort.dir}`}</output></>;
}

describe("orden del listado en móvil", () => {
  it("permite elegir ETA, dirección y restablecer el orden", () => {
    render(<Listado />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Ordenar embarques por" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "ETA" }));
    expect(screen.getByText("eta:desc")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Dirección del orden" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Ascendente" }));
    expect(screen.getByText("eta:asc")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restablecer orden" }));
    expect(screen.getByText("expediente:desc")).toBeInTheDocument();
  });
});

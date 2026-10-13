import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), set: vi.fn(), canEdit: true }));
vi.mock("@/features/embarques/services/comisionExclusion", () => ({
  fetchSinComisionEmbarque: mocks.fetch,
  setSinComisionEmbarque: mocks.set,
}));
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: () => ({ canEdit: mocks.canEdit }) }));

import { ComisionEmbarqueCard } from "../ComisionEmbarqueCard";

function testClient(): QueryClient {
  return (globalThis as unknown as { __TEST_QUERY_CLIENT__: QueryClient }).__TEST_QUERY_CLIENT__;
}

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.set.mockReset();
  mocks.canEdit = true;
});

describe("ComisionEmbarqueCard", () => {
  it("muestra ausencia sin fabricar una regla ni habilitar edición", async () => {
    mocks.fetch.mockResolvedValue(null);
    render(<ComisionEmbarqueCard embarqueId="e-1" />, { wrapper: createWrapper() });
    expect(await screen.findByRole("status")).toHaveTextContent("El embarque no está disponible");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("Genera comisión")).not.toBeInTheDocument();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("bloquea edición y el resultado anterior cuando falla la relectura con caché", async () => {
    const wrapper = createWrapper();
    const client = testClient();
    client.setQueryData(queryKeys.embarques.sinComision("e-1"), { override: null, efectivo: false });
    mocks.fetch.mockRejectedValue(new Error("Lectura fallida"));
    render(<ComisionEmbarqueCard embarqueId="e-1" />, { wrapper });
    expect(screen.getByRole("combobox")).toBeEnabled();
    await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.embarques.sinComision("e-1") }); });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo consultar la regla de comisión");
    expect(client.getQueryData(queryKeys.embarques.sinComision("e-1"))).toEqual({ override: null, efectivo: false });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("Genera comisión")).not.toBeInTheDocument();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("retira la edición cacheada cuando la relectura devuelve ausencia", async () => {
    const wrapper = createWrapper();
    const client = testClient();
    client.setQueryData(queryKeys.embarques.sinComision("e-1"), { override: true, efectivo: true });
    mocks.fetch.mockResolvedValue(null);
    render(<ComisionEmbarqueCard embarqueId="e-1" />, { wrapper });
    await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.embarques.sinComision("e-1") }); });
    expect(await screen.findByRole("status")).toHaveTextContent("El embarque no está disponible");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it.each([
    [null, false, "Heredar del cliente", "Genera comisión"],
    [null, true, "Heredar del cliente", "No genera comisión"],
    [true, true, "No genera comisión", "No genera comisión"],
    [false, false, "Sí genera comisión", "Genera comisión"],
  ] as const)("conserva override %s y efectivo %s para el embarque vigente", async (override, efectivo, label, result) => {
    mocks.fetch.mockResolvedValue({ override, efectivo });
    render(<ComisionEmbarqueCard embarqueId="e-1" />, { wrapper: createWrapper() });
    const select = await screen.findByRole("combobox");
    expect(select).toBeEnabled();
    expect(select).toHaveTextContent(label);
    expect(screen.getAllByText(result).length).toBeGreaterThan(0);
  });

  it.each([
    [null, "Heredar del cliente"], [true, "No genera comisión"], [false, "Sí genera comisión"],
  ] as const)("envía el override %s elegido en un embarque vigente", async (valor, label) => {
    mocks.fetch.mockResolvedValue({ override: valor === null ? false : null, efectivo: false });
    mocks.set.mockResolvedValue(undefined);
    render(<ComisionEmbarqueCard embarqueId="e-1" />, { wrapper: createWrapper() });
    const select = await screen.findByRole("combobox");
    select.focus();
    fireEvent.keyDown(select, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: label }));
    await waitFor(() => expect(mocks.set).toHaveBeenCalledWith("e-1", valor));
  });

  it("recupera la edición después de una lectura válida y respeta permisos", async () => {
    const wrapper = createWrapper();
    const client = testClient();
    mocks.fetch.mockRejectedValueOnce(new Error("Lectura fallida"));
    mocks.fetch.mockResolvedValue({ override: false, efectivo: false });
    mocks.canEdit = false;
    render(<ComisionEmbarqueCard embarqueId="e-1" />, { wrapper });
    await waitFor(() => expect(client.getQueryState(queryKeys.embarques.sinComision("e-1"))?.status).toBe("error"));
    await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.embarques.sinComision("e-1") }); });
    expect(await screen.findByRole("combobox")).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

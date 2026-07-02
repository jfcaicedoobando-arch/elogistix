import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEmailsOcultos } from "../useEmailsOcultos";

const KEY = (id: string) => `lc:proformas:emails-ocultos:${id}`;

describe("useEmailsOcultos", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("lista vacía cuando no hay clienteId", () => {
    const { result } = renderHook(() => useEmailsOcultos(null));
    expect(result.current.ocultos).toEqual([]);
    // Sin cliente, ocultar es no-op y no persiste.
    act(() => result.current.ocultar("a@b.com"));
    expect(result.current.ocultos).toEqual([]);
  });

  it("ocultar normaliza a lowercase y persiste en storage", () => {
    const { result } = renderHook(() => useEmailsOcultos("c1"));
    act(() => result.current.ocultar("Foo@Bar.com"));
    expect(result.current.ocultos).toEqual(["foo@bar.com"]);
    expect(JSON.parse(window.localStorage.getItem(KEY("c1"))!)).toEqual([
      "foo@bar.com",
    ]);
    expect(result.current.isOculto("FOO@bar.COM")).toBe(true);
  });

  it("ocultar deduplica y ignora vacíos", () => {
    const { result } = renderHook(() => useEmailsOcultos("c1"));
    act(() => {
      result.current.ocultar("a@b.com");
      result.current.ocultar("A@B.COM");
      result.current.ocultar("   ");
    });
    expect(result.current.ocultos).toEqual(["a@b.com"]);
  });

  it("restaurar, restaurarVarios y restaurarTodos", () => {
    const { result } = renderHook(() => useEmailsOcultos("c1"));
    act(() => {
      result.current.ocultar("a@b.com");
      result.current.ocultar("b@b.com");
      result.current.ocultar("c@b.com");
    });
    act(() => result.current.restaurar("A@B.com"));
    expect(result.current.ocultos).toEqual(["b@b.com", "c@b.com"]);
    act(() => result.current.restaurarVarios(["B@B.COM"]));
    expect(result.current.ocultos).toEqual(["c@b.com"]);
    act(() => result.current.restaurarTodos());
    expect(result.current.ocultos).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(KEY("c1"))!)).toEqual([]);
  });

  it("cambiar clienteId recarga desde storage la lista de ese cliente", () => {
    window.localStorage.setItem(KEY("c1"), JSON.stringify(["a@b.com"]));
    window.localStorage.setItem(KEY("c2"), JSON.stringify(["x@y.com"]));
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useEmailsOcultos(id),
      { initialProps: { id: "c1" } },
    );
    expect(result.current.ocultos).toEqual(["a@b.com"]);
    rerender({ id: "c2" });
    expect(result.current.ocultos).toEqual(["x@y.com"]);
  });

  it("storage con JSON inválido → lista vacía sin crash", () => {
    window.localStorage.setItem(KEY("c1"), "{not-json");
    const { result } = renderHook(() => useEmailsOcultos("c1"));
    expect(result.current.ocultos).toEqual([]);
  });

  it("storage con array que contiene no-strings filtra sólo strings", () => {
    window.localStorage.setItem(
      KEY("c1"),
      JSON.stringify(["a@b.com", 42, null, "b@b.com"]),
    );
    const { result } = renderHook(() => useEmailsOcultos("c1"));
    expect(result.current.ocultos).toEqual(["a@b.com", "b@b.com"]);
  });

  it("storage con valor no-array → lista vacía", () => {
    window.localStorage.setItem(KEY("c1"), JSON.stringify({ nope: true }));
    const { result } = renderHook(() => useEmailsOcultos("c1"));
    expect(result.current.ocultos).toEqual([]);
  });
});

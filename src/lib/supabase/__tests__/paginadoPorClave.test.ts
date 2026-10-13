import { expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { aplicarCursor, conAbortSignal, leerPaginasPorClave } from "../paginadoPorClave";
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: vi.fn() }));

it("rechaza páginas repetidas antes de devolver dinero duplicado", async () => {
  const pagina = vi.fn().mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
  await expect(leerPaginasPorClave<{ id: string }>("test", pagina, fila => [fila.id], { lote: 2 })).rejects.toThrow(/no avanzó/);
  expect(pagina).toHaveBeenCalledTimes(2);
});

it("propaga un error posterior y mantiene el cap duro visible", async () => {
  const pagina = vi.fn().mockResolvedValueOnce({ data: [{ id: "a" }, { id: "b" }], error: null })
    .mockResolvedValueOnce({ data: null, error: { message: "falló" } });
  await expect(leerPaginasPorClave<{ id: string }>("test", pagina, fila => [fila.id], { lote: 2 })).rejects.toEqual({ message: "falló" });
  await expect(leerPaginasPorClave("test", async () => ({ data: [{ id: "a" }, { id: "b" }], error: null }),
    fila => [fila.id], { lote: 2, capDuro: 2 })).rejects.toMatchObject({ code: "LC_RESULTADO_TRUNCADO" });
});

it("serializa el cursor compuesto mediante la API real del SDK", async () => {
  let url = "";
  const client = createClient("https://audit.invalid", "synthetic-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async input => { url = String(input); return new Response("[]", { headers: { "Content-Type": "application/json" } }); } },
  });
  const query = client.from("fixture").select("factura_id,embarque_id").order("factura_id").order("embarque_id").limit(1000);
  await aplicarCursor(query, ["factura_id", "embarque_id"], ["factura", "embarque"]);
  expect(new URL(url).searchParams.get("or")).toBe('(factura_id.gt."factura",and(factura_id.eq."factura",embarque_id.gt."embarque"))');
});

it("la señal llega al fetch del SDK y aborta la petición pendiente", async () => {
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  let observed: AbortSignal | null | undefined;
  const client = createClient("https://audit.invalid", "synthetic-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      observed = init?.signal; started();
      observed?.addEventListener("abort", () => reject(observed?.reason), { once: true });
    }) },
  });
  const pending = leerPaginasPorClave("test", () => conAbortSignal(client.from("fixture").select("id").order("id").limit(1000), controller.signal),
    fila => [String(fila.id)], { signal: controller.signal });
  await ready;
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(observed).toBe(controller.signal);
});

it("no empieza otra página después de cancelar una lectura", async () => {
  const controller = new AbortController();
  const pagina = vi.fn(async () => { controller.abort(); return { data: [{ id: "a" }], error: null }; });
  await expect(leerPaginasPorClave("test", pagina, fila => [fila.id], { lote: 1, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(pagina).toHaveBeenCalledTimes(1);
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarSolicitudPreferencias, SOLICITUD_PREFS_DEFAULT } from "@/features/portal/domain/solicitudPreferencias";
import { useSolicitudCotizacionForm } from "../useSolicitudCotizacionForm";

beforeEach(() => guardarSolicitudPreferencias(SOLICITUD_PREFS_DEFAULT));

describe("useSolicitudCotizacionForm · ciclo de edición", () => {
  it("valida ruta y cuenta sin recortar los valores capturados", () => {
    const { result, rerender } = renderHook(({ clienteId }) => useSolicitudCotizacionForm(clienteId), {
      initialProps: { clienteId: "" },
    });
    expect(result.current.faltantes).toEqual(["Origen", "Destino", "Cuenta vinculada"]);
    act(() => {
      result.current.setOrigen("  Valencia  ");
      result.current.setDestino(" \t ");
      result.current.setIntentoEnvio(true);
    });
    expect(result.current.origen).toBe("  Valencia  ");
    expect(result.current.origenVacio).toBe(false);
    expect(result.current.destinoVacio).toBe(true);
    expect(result.current.faltantes).toEqual(["Destino", "Cuenta vinculada"]);
    expect(result.current.puedeEnviar).toBe(false);
    act(() => result.current.setDestino("Manzanillo"));
    rerender({ clienteId: "cli-1" });
    expect(result.current.faltantes).toEqual([]);
    expect(result.current.puedeEnviar).toBe(true);
  });

  it("submit usa el resolver y entrega los valores validados sin recortarlos", async () => {
    const { result } = renderHook(() => useSolicitudCotizacionForm("cli-1"));
    const onSubmit = vi.fn();
    await act(async () => result.current.submit(onSubmit)());
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      result.current.setOrigen("  Valencia  ", "p-1");
      result.current.setDestino(" ");
    });
    await act(async () => result.current.submit(onSubmit)());
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => result.current.setDestino(" Manzanillo ", "p-2"));
    await act(async () => result.current.submit(onSubmit)());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      modo: "Marítimo", tipo: "Importación", tipoEmbarque: "FCL",
      origen: "  Valencia  ", destino: " Manzanillo ",
      puertoOrigenId: "p-1", puertoDestinoId: "p-2", mercancia: "", notas: "",
    });
  });

  it("vuelve a limpio cuando se revierten los campos y conserva setters funcionales", () => {
    const { result } = renderHook(() => useSolicitudCotizacionForm("cli-1"));
    act(() => {
      result.current.setModo("Aéreo");
      result.current.setTipo(() => "Exportación");
      result.current.setTipoEmbarque(() => "LCL");
      result.current.setOrigen("Ciudad A");
      result.current.setDestino("Ciudad B");
      result.current.setMercancia(() => "Refacciones");
      result.current.setNotas((prev) => `${prev}Nota`);
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.setModo("Marítimo");
      result.current.setTipo("Importación");
      result.current.setTipoEmbarque("FCL");
      result.current.setOrigen("");
      result.current.setDestino("");
      result.current.setMercancia("");
      result.current.setNotas("");
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("no trata como edición el texto sólo en blanco", () => {
    const { result } = renderHook(() => useSolicitudCotizacionForm("cli-1"));
    act(() => {
      result.current.setOrigen(" ");
      result.current.setDestino("\t");
      result.current.setMercancia(" \n");
      result.current.setNotas(" ");
    });
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setNotas(" Nota "));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.setNotas("  "));
    expect(result.current.isDirty).toBe(false);
  });

  it("reset adopta preferencias nuevas como baseline para la siguiente apertura", () => {
    const { result } = renderHook(() => useSolicitudCotizacionForm("cli-1"));
    act(() => {
      result.current.setModo("Aéreo");
      result.current.setTipo("Exportación");
      result.current.setTipoEmbarque("LCL");
      result.current.setOrigen("A", "p-1");
      result.current.setDestino("B", "p-2");
      result.current.setMercancia("Carga");
      result.current.setNotas("Nota");
      result.current.setIntentoEnvio(true);
    });
    guardarSolicitudPreferencias({ modo: "Aéreo", tipo: "Exportación", tipoEmbarque: "LCL" });
    act(() => result.current.reset());
    expect(result.current).toMatchObject({
      modo: "Aéreo", tipo: "Exportación", tipoEmbarque: "LCL",
      origen: "", destino: "", mercancia: "", notas: "",
      puertoOrigenId: null, puertoDestinoId: null, intentoEnvio: false,
      isDirty: false, puedeEnviar: false,
    });
    act(() => result.current.setModo("Marítimo"));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.setModo("Aéreo"));
    expect(result.current.isDirty).toBe(false);
  });

  it("cambios tardíos de cuenta y preferencias no sobrescriben una edición", () => {
    const { result, rerender } = renderHook(({ clienteId }) => useSolicitudCotizacionForm(clienteId), {
      initialProps: { clienteId: "" },
    });
    act(() => {
      result.current.setOrigen("Ruta escrita", "p-1");
      result.current.setDestino("Destino escrito", "p-2");
      result.current.setNotas("En edición");
    });
    guardarSolicitudPreferencias({ modo: "Terrestre", tipo: "Nacional", tipoEmbarque: "Terrestre" });
    rerender({ clienteId: "cli-1" });
    expect(result.current).toMatchObject({
      modo: "Marítimo", tipo: "Importación", tipoEmbarque: "FCL",
      origen: "Ruta escrita", destino: "Destino escrito", notas: "En edición",
      puertoOrigenId: "p-1", puertoDestinoId: "p-2", isDirty: true, puedeEnviar: true,
    });
    act(() => result.current.reset());
    expect(result.current).toMatchObject({
      modo: "Terrestre", tipo: "Nacional", tipoEmbarque: "Terrestre", isDirty: false,
    });
  });

  it("usa opciones válidas si preferencias almacenadas tienen modo o tipo desconocidos", () => {
    guardarSolicitudPreferencias({ modo: "Obsoleto", tipo: "Desconocido", tipoEmbarque: "LCL" });
    const { result } = renderHook(() => useSolicitudCotizacionForm("cli-1"));
    expect(result.current).toMatchObject({ modo: "Marítimo", tipo: "Importación", tipoEmbarque: "LCL", isDirty: false });
  });

  it("resuelve puertos repetidos incluso cuando ambas elecciones ocurren en el mismo evento", () => {
    const { result } = renderHook(() => useSolicitudCotizacionForm("cli-1"));
    act(() => {
      result.current.setOrigen("A", "p-1");
      result.current.setDestino("B", "p-1");
    });
    expect(result.current).toMatchObject({
      origen: "A", destino: "B", puertoOrigenId: null, puertoDestinoId: "p-1",
    });
  });
});

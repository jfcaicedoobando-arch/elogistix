import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCierreDialog, CIERRE_CONFIRM_TEXT, CIERRE_MOTIVO_MIN } from "../useCierreDialog";

describe("useCierreDialog", () => {
  it("inicia con diálogos cerrados y campos vacíos", () => {
    const { result } = renderHook(() => useCierreDialog());
    expect(result.current.openCerrar).toBe(false);
    expect(result.current.openReabrir).toBe(false);
    expect(result.current.confirmText).toBe("");
    expect(result.current.motivoReapertura).toBe("");
    expect(result.current.puedeConfirmarCerrar).toBe(false);
    expect(result.current.puedeConfirmarReabrir).toBe(false);
  });

  it("puedeConfirmarCerrar exige texto exacto 'CERRAR'", () => {
    const { result } = renderHook(() => useCierreDialog());
    act(() => result.current.setConfirmText("cerrar"));
    expect(result.current.puedeConfirmarCerrar).toBe(false);
    act(() => result.current.setConfirmText("CERRAR "));
    expect(result.current.puedeConfirmarCerrar).toBe(false);
    act(() => result.current.setConfirmText(CIERRE_CONFIRM_TEXT));
    expect(result.current.puedeConfirmarCerrar).toBe(true);
  });

  it(`puedeConfirmarReabrir exige motivo trim ≥${CIERRE_MOTIVO_MIN}`, () => {
    const { result } = renderHook(() => useCierreDialog());
    act(() => result.current.setMotivoReapertura("corto"));
    expect(result.current.puedeConfirmarReabrir).toBe(false);
    act(() => result.current.setMotivoReapertura("   " + "x".repeat(CIERRE_MOTIVO_MIN - 1) + "   "));
    expect(result.current.puedeConfirmarReabrir).toBe(false);
    act(() => result.current.setMotivoReapertura("x".repeat(CIERRE_MOTIVO_MIN)));
    expect(result.current.puedeConfirmarReabrir).toBe(true);
  });

  it("resetCerrar limpia estado de cerrar", () => {
    const { result } = renderHook(() => useCierreDialog());
    act(() => {
      result.current.setOpenCerrar(true);
      result.current.setConfirmText("CERRAR");
    });
    act(() => result.current.resetCerrar());
    expect(result.current.openCerrar).toBe(false);
    expect(result.current.confirmText).toBe("");
  });

  it("resetReabrir limpia estado de reapertura", () => {
    const { result } = renderHook(() => useCierreDialog());
    act(() => {
      result.current.setOpenReabrir(true);
      result.current.setMotivoReapertura("x".repeat(25));
    });
    act(() => result.current.resetReabrir());
    expect(result.current.openReabrir).toBe(false);
    expect(result.current.motivoReapertura).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCierreDialog, CIERRE_CONFIRM_TEXT, CIERRE_MOTIVO_MIN } from "../useCierreDialog";

// v13.137.36: TODOS los `act()` ahora se `await`ean. React 18 devuelve una
// Promise desde `act()` para flushear el scheduler concurrente; sin `await` la
// assertion corre antes del commit del state y puede emitir warnings que
// rompen la suite bajo strict mode.
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

  it("puedeConfirmarCerrar exige texto exacto 'CERRAR'", async () => {
    const { result } = renderHook(() => useCierreDialog());
    await act(async () => { result.current.setConfirmText("cerrar"); });
    expect(result.current.puedeConfirmarCerrar).toBe(false);
    await act(async () => { result.current.setConfirmText("CERRAR "); });
    expect(result.current.puedeConfirmarCerrar).toBe(false);
    await act(async () => { result.current.setConfirmText(CIERRE_CONFIRM_TEXT); });
    expect(result.current.puedeConfirmarCerrar).toBe(true);
  });

  it(`puedeConfirmarReabrir exige motivo trim ≥${CIERRE_MOTIVO_MIN}`, async () => {
    const { result } = renderHook(() => useCierreDialog());
    await act(async () => { result.current.setMotivoReapertura("corto"); });
    expect(result.current.puedeConfirmarReabrir).toBe(false);
    await act(async () => { result.current.setMotivoReapertura("   " + "x".repeat(CIERRE_MOTIVO_MIN - 1) + "   "); });
    expect(result.current.puedeConfirmarReabrir).toBe(false);
    await act(async () => { result.current.setMotivoReapertura("x".repeat(CIERRE_MOTIVO_MIN)); });
    expect(result.current.puedeConfirmarReabrir).toBe(true);
  });

  it("resetCerrar limpia estado de cerrar", async () => {
    const { result } = renderHook(() => useCierreDialog());
    await act(async () => {
      result.current.setOpenCerrar(true);
      result.current.setConfirmText("CERRAR");
    });
    await act(async () => { result.current.resetCerrar(); });
    expect(result.current.openCerrar).toBe(false);
    expect(result.current.confirmText).toBe("");
  });

  it("resetReabrir limpia estado de reapertura", async () => {
    const { result } = renderHook(() => useCierreDialog());
    await act(async () => {
      result.current.setOpenReabrir(true);
      result.current.setMotivoReapertura("x".repeat(25));
    });
    await act(async () => { result.current.resetReabrir(); });
    expect(result.current.openReabrir).toBe(false);
    expect(result.current.motivoReapertura).toBe("");
  });
});

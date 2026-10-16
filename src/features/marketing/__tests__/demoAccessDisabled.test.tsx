// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ComponentProps, FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProbarDemoButton } from "@/features/marketing/components/ProbarDemoButton";
import { DemoAccessDialog } from "@/features/marketing/components/DemoAccessDialog";
import { useDemoAccessForm, type DemoAccessValues } from "@/features/marketing/hooks/useDemoAccessForm";
import { DEMO_ACCESS_AVAILABILITY } from "@/features/marketing/lib/demoAccessAvailability";
import { mensajeAmigableDemo } from "@/features/marketing/services/demoErrorCopy";

const effects = vi.hoisted(() => ({
  insert: vi.fn().mockResolvedValue({ error: null }),
  from: vi.fn(),
  invoke: vi.fn().mockResolvedValue({ data: null, error: new Error("503 demo_unavailable: private-payload") }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: effects.from,
    functions: { invoke: effects.invoke },
    auth: { signInWithPassword: effects.signIn, signOut: effects.signOut },
  },
}));
vi.mock("react-router", () => ({ useNavigate: () => effects.navigate }));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: effects.toast }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: effects.notifyError }));

function expectNoAccessEffects() {
  for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  effects.from.mockReturnValue({ insert: effects.insert });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("release con acceso demo no disponible", () => {
  it.each([undefined, "Entrar ahora", "Probar demo gratis"])("deshabilita el CTA aunque label sea %s", (label) => {
    render(<ProbarDemoButton label={label} />);
    const button = screen.getByRole("button", { name: DEMO_ACCESS_AVAILABILITY.label });
    expect(button).toHaveProperty("disabled", true);
    expect(button.textContent).toBe(DEMO_ACCESS_AVAILABILITY.label);
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent)
      .toBe(DEMO_ACCESS_AVAILABILITY.message);
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("form")).toBeNull();
    expectNoAccessEffects();
  });

  it("conserva un botón nativo deshabilitado ante props de un caller JavaScript", () => {
    const onClick = vi.fn();
    const props = { asChild: true, disabled: false, onClick, "aria-label": "Entrar", hideIcon: true };
    render(<ProbarDemoButton {...props as ComponentProps<typeof ProbarDemoButton>} />);
    const button = screen.getByRole("button", { name: DEMO_ACCESS_AVAILABILITY.label });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expectNoAccessEffects();
  });

  it("un open directo sólo muestra un aviso sin montar diálogo, campos o formulario", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<DemoAccessDialog open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<DemoAccessDialog open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("status").textContent).toContain(DEMO_ACCESS_AVAILABILITY.message);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("form, input, textarea, select")).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    expectNoAccessEffects();
  });

  it.each([false, true])("bloquea submits repetidos con datos válidos=%s, sin timers o reintentos", async (valid) => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(() => useDemoAccessForm(onOpenChange));
    if (valid) {
      const values: DemoAccessValues = {
        nombre: "Visitante", empresa: "Empresa", email: "visitante@example.com",
        telefono: "+525512345678", aceptaContacto: true,
      };
      act(() => {
        for (const key of Object.keys(values) as (keyof DemoAccessValues)[]) result.current.set(key, values[key]);
      });
    }
    const preventDefault = vi.fn();
    const event = { preventDefault } as unknown as FormEvent;
    await act(async () => {
      await Promise.all(Array.from({ length: 5 }, () => result.current.handleSubmit(event)));
      await vi.runAllTimersAsync();
    });
    rerender();
    expect(preventDefault).toHaveBeenCalledTimes(5);
    expect(result.current.loading).toBe(false);
    expect(result.current.availability).toBe(DEMO_ACCESS_AVAILABILITY);
    expect(result.current.error).toBe(DEMO_ACCESS_AVAILABILITY.message);
    expect(vi.getTimerCount()).toBe(0);
    expect(onOpenChange).not.toHaveBeenCalled();
    expectNoAccessEffects();
  });

  it.each([
    new Error("Edge Function returned a non-2xx status code: private-payload"),
    new Error("503 demo_unavailable password=private-payload"),
    new Error("permission denied for table demo_leads private-payload"),
    "private-payload",
    { message: "private-payload", details: "private-payload", hint: "private-payload", code: "503" },
    { error: "demo_unavailable", password: "private-payload" },
    null, undefined,
  ])("muestra sólo copy saneado para %j", (error) => {
    const message = mensajeAmigableDemo(error);
    expect(message).toBe(DEMO_ACCESS_AVAILABILITY.message);
    expect(message).not.toMatch(/private-payload|password|503|non-2xx|intenta|reintent/i);
    expectNoAccessEffects();
  });
});

import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useForm, type UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "../../types";
import { COTIZACION_FORM_DEFAULTS } from "../../types/formDefaults";
import { draftKey, loadDraft, useCotizacionDraftAutosave } from "../../hooks/wizard/useCotizacionDraftAutosave";

const identity = vi.hoisted(() => ({ userId: "", organizationId: null as string | null }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: identity.userId ? { id: identity.userId } : null }) }));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: identity.organizationId }) }));

// Keep the real route wrapper and production autosave hook. Other page services
// are replaced by a minimal controller so this test makes no remote requests.
function useScopedController() {
  const form = useForm<CotizacionFormValues>({ defaultValues: COTIZACION_FORM_DEFAULTS });
  const autosave = useCotizacionDraftAutosave({ form, userId: identity.userId, organizationId: identity.organizationId,
    enabled: Boolean(identity.userId && identity.organizationId), cotizacionId: null, currentStep: 1, costosInternos: [], conceptosUSD: [], conceptosMXN: [], tipoCambioUsd: null });
  return { w: { form, currentStep: 1, cotizacionId: null }, userId: identity.userId, organizationId: identity.organizationId,
    clientes: [], flushDraft: autosave.flush, draftDetectado: null, banderaBorrador: false, conflictoSello: false, conflictoExterno: false };
}
vi.mock("../useNuevaCotizacionPageController", () => ({ useNuevaCotizacionPageController: () => useScopedController() }));
vi.mock("@/features/cotizacion/components/CotizacionWizardLayout", () => ({ default: ({ w, onFlushDraft }: { w: { form: UseFormReturn<CotizacionFormValues> }; onFlushDraft: () => void }) => (
  <><input aria-label="Cliente" {...w.form.register("clienteId")} /><button onClick={onFlushDraft}>Flush</button></>
) }));
vi.mock("@/features/cotizacion/components/wizard/CotizacionSuccessDialog", () => ({ CotizacionSuccessDialog: () => null }));
vi.mock("@/features/cotizacion/components/wizard/GuardarPlantillaDialog", () => ({ GuardarPlantillaDialog: () => null }));
vi.mock("@/features/cotizacion/components/wizard/PlantillaSelectorPaso1", () => ({ PlantillaSelectorPaso1: () => null }));

import NuevaCotizacion from "../NuevaCotizacion";
function capture(value: string) {
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value } });
  fireEvent.click(screen.getByText("Flush"));
}
beforeEach(() => { window.localStorage.clear(); identity.userId = ""; identity.organizationId = null; });

it("identidad async remonta el autosave y permite nueva captura sin copiar valores anónimos", () => {
  const page = render(<NuevaCotizacion />);
  capture("antes-de-identidad");
  expect(window.localStorage.getItem(draftKey("", null))).toBeNull();
  identity.userId = "user-A";
  page.rerender(<NuevaCotizacion />);
  expect(screen.getByLabelText("Cliente")).toHaveValue("");
  capture("sin-organizacion");
  expect(window.localStorage.getItem(draftKey("user-A", null))).toBeNull();
  identity.organizationId = "org-A";
  page.rerender(<NuevaCotizacion />);
  expect(screen.getByLabelText("Cliente")).toHaveValue("");
  expect(loadDraft("user-A", "org-A")).toBeNull();
  capture("cliente-nuevo");
  expect(loadDraft("user-A", "org-A")?.values.clienteId).toBe("cliente-nuevo");
});

it.each(["tenant", "usuario"])("cambio de %s remonta toda la captura y mantiene separados los borradores", scope => {
  identity.userId = "user-A"; identity.organizationId = "org-A";
  const page = render(<NuevaCotizacion />);
  capture("cliente-A");
  const previous = window.localStorage.getItem(draftKey("user-A", "org-A"));
  if (scope === "tenant") identity.organizationId = "org-B";
  else identity.userId = "user-B";
  page.rerender(<NuevaCotizacion />);
  expect(screen.getByLabelText("Cliente")).toHaveValue("");
  expect(loadDraft(identity.userId, identity.organizationId)).toBeNull();
  capture("cliente-B");
  expect(loadDraft(identity.userId, identity.organizationId)?.values.clienteId).toBe("cliente-B");
  expect(window.localStorage.getItem(draftKey("user-A", "org-A"))).toBe(previous);
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

const mocks = vi.hoisted(() => ({ request: vi.fn(), session: vi.fn(), emisor: vi.fn(), render: vi.fn(), blob: vi.fn(), upload: vi.fn() }));
vi.mock("../_networkRetry", () => ({ fetchConReintento: mocks.request, OFFLINE_MSG: "offline" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: mocks.session },
  storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) },
} }));
vi.mock("@/pdf/emisor", () => ({ cargarEmisorDocumento: mocks.emisor }));
vi.mock("@/pdf/documents/CotizacionDocument", () => ({ CotizacionDocument: () => null }));
vi.mock("@react-pdf/renderer", () => ({ pdf: mocks.render }));

import { enviarCotizacionPorEmail, type EnviarEmailInput } from "../enviarPorEmail";

const INPUT: EnviarEmailInput = {
  cotizacion: makeCotizacionRow({ organization_id: "org-a" }), destinatarios: [], cc: [],
  mensaje: "Prueba", asunto: "Prueba", marcarEnviada: false, totales: {},
};

beforeEach(() => {
  vi.resetAllMocks();
  setAuthSnapshot({ userId: "u1", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "u1", organizationId: "org-a" });
  mocks.session.mockResolvedValue({ data: { session: { access_token: "synthetic-token" } } });
  mocks.request.mockImplementation(async (_url, options) => {
    const action = JSON.parse(options.body).action;
    return new Response(JSON.stringify(action === "prepare"
      ? { upload_token: "synthetic-upload", path: "synthetic.pdf" }
      : { success: true, estado: "enviado" }), { status: 200 });
  });
  mocks.emisor.mockResolvedValue({ organizacionNombre: "Comercial A", razonSocial: "Empresa", rfc: "" });
  mocks.render.mockImplementation(() => ({ toBlob: mocks.blob }));
  mocks.blob.mockResolvedValue(new Blob(["synthetic-pdf"]));
  mocks.upload.mockResolvedValue({ error: null });
});

describe("PDF adjunto: identidad del documento", () => {
  it("el correo usa la misma org y marca comercial que la descarga", async () => {
    await enviarCotizacionPorEmail(INPUT);
    expect(mocks.emisor).toHaveBeenCalledWith("org-a");
    expect(mocks.render.mock.calls[0][0].props.emisor).toMatchObject({
      organizacionNombre: "Comercial A", razonSocial: "Empresa", rfc: "",
    });
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });

  it("rechaza tenant distinto antes de preparar el envío", async () => {
    await expect(enviarCotizacionPorEmail({ ...INPUT,
      cotizacion: { ...INPUT.cotizacion, organization_id: "org-b" },
    })).rejects.toThrow("no coincide");
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("no sube ni envía un PDF cuyo tenant cambió durante el render", async () => {
    let resolve!: (blob: Blob) => void;
    mocks.blob.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const pending = enviarCotizacionPorEmail(INPUT);
    const rejection = expect(pending).rejects.toThrow("cambió el usuario o la organización");
    await vi.waitFor(() => expect(mocks.blob).toHaveBeenCalledOnce());
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org-b" });
    resolve(new Blob(["synthetic-pdf"]));
    await rejection;
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it.each(["prepare", "send"])("no inicia %s con la sesión de otro tenant", async (phase) => {
    let resolve!: (value: unknown) => void;
    if (phase === "send") mocks.session.mockResolvedValueOnce({ data: { session: { access_token: "synthetic-token" } } });
    mocks.session.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const pending = enviarCotizacionPorEmail(INPUT);
    const rejection = expect(pending).rejects.toThrow("cambió el usuario o la organización");
    await vi.waitFor(() => expect(mocks.session).toHaveBeenCalledTimes(phase === "prepare" ? 1 : 2));
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org-b" });
    resolve({ data: { session: { access_token: "synthetic-new-token" } } });
    await rejection;
    expect(mocks.request).toHaveBeenCalledTimes(phase === "prepare" ? 0 : 1);
  });
});

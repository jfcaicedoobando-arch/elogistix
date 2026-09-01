/**
 * adjuntar-xml-entrante — Adjunta el XML faltante a un documento del buzón CxP
 * verificando los metadatos fiscales SERVER-SIDE (Ola 5 · O5.8 / BUG-18).
 *
 * Flujo:
 *  1. JWT válido (el actor se toma del token, nunca del body).
 *  2. Se lee el documento del buzón para derivar su organización objetivo.
 *  3. Ola P2: se autoriza al actor para ESA organización, se exige estado
 *     `por_capturar` y que `xml_path` caiga en su
 *     prefijo canónico — TODO antes de tocar Storage con service_role.
 *  4. Descarga el XML de Storage con service_role y verifica su SHA-256.
 *  5. Re-parsea el CFDI (`_shared/cfdiParser.ts`) — esa es la verdad fiscal.
 *  6. Si lo declarado por el cliente difiere → 409 LC_XML_METADATA_MISMATCH.
 *  7. Escribe vía `adjuntar_xml_entrante_verificado` (sólo service_role), que
 *     conserva sus propias validaciones como segunda defensa contra TOCTOU.
 */
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import { type AuthContext, authenticate } from "../_shared/auth.ts";
import { autorizarCxp } from "../_shared/cxpGuard.ts";
import { createLogger } from "../_shared/logger.ts";
import { captureEdgeException, wrapEdgeHandler } from "../_shared/sentry.ts";
import { parseCfdi } from "../_shared/cfdiParser.ts";
import { discrepanciasMeta, metaDesdeCfdi, sha256Hex } from "./verificacion.ts";
import {
  type DocumentoBuzon,
  respuestaRechazo,
  validarDocumento,
} from "./autorizacion.ts";

const BUCKET = "cxp-inbox";
const MAX_BYTES = 2 * 1024 * 1024;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Topes de uso por usuario y por organización (ventana de 1 h). */
const RL_USUARIO = { windowSeconds: 3600, max: 60 } as const;
const RL_ORG = { windowSeconds: 3600, max: 300 } as const;

interface Cuerpo {
  documento_id?: unknown;
  xml_path?: unknown;
  xml_nombre?: unknown;
  xml_hash?: unknown;
  declarado?: {
    uuid?: string | null;
    rfcEmisor?: string | null;
    total?: number | null;
    moneda?: string | null;
  } | null;
}

function leerCuerpo(body: Cuerpo) {
  const documentoId = typeof body.documento_id === "string"
    ? body.documento_id
    : "";
  const xmlPath = typeof body.xml_path === "string" ? body.xml_path : "";
  const xmlNombre = typeof body.xml_nombre === "string" ? body.xml_nombre : "";
  const xmlHash = typeof body.xml_hash === "string" ? body.xml_hash : "";
  if (!UUID_RE.test(documentoId)) throw new Error("400:documento_id inválido");
  if (!xmlPath || xmlPath.includes("..")) {
    throw new Error("400:xml_path inválido");
  }
  if (!xmlNombre) throw new Error("400:xml_nombre requerido");
  if (!/^[0-9a-f]{64}$/i.test(xmlHash)) {
    throw new Error("400:xml_hash inválido");
  }
  return {
    documentoId,
    xmlPath,
    xmlNombre,
    xmlHash,
    declarado: body.declarado ?? null,
  };
}

/**
 * Lee el documento del buzón y valida organización, estado y ruta antes de
 * cualquier acceso a Storage con service_role. Devuelve la Response de rechazo
 * o `null` si el acceso es legítimo.
 */
function verificarAcceso(args: {
  documento: DocumentoBuzon;
  xmlPath: string;
  userId: string;
  cors: Record<string, string>;
  log: ReturnType<typeof createLogger>;
}): Response | null {
  const chequeo = validarDocumento({
    documento: args.documento,
    orgActor: args.documento.organization_id,
    xmlPath: args.xmlPath,
  });
  if (chequeo.ok) return null;

  const { status, mensaje } = respuestaRechazo(chequeo.motivo);
  args.log.finish(status, chequeo.motivo, {
    user_id: args.userId,
    organization_id: args.documento.organization_id,
  });
  return errorResponse(mensaje, status, args.cors);
}

/**
 * Descarga el XML del buzón con service_role, verifica su SHA-256 contra lo
 * declarado y re-parsea el CFDI (verdad fiscal). Devuelve los metadatos del
 * servidor y el hash real verificado.
 */
async function descargarYParsear(
  adminClient: AuthContext["adminClient"],
  xmlPath: string,
  xmlHashDeclarado: string,
) {
  const { data: archivo, error: dlError } = await adminClient.storage.from(
    BUCKET,
  ).download(xmlPath);
  if (dlError || !archivo) {
    throw new Error("400:LC_XML_NO_ENCONTRADO: el XML no está en el buzón");
  }

  const bytes = await archivo.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("400:LC_XML_DEMASIADO_GRANDE: el XML excede 2 MB");
  }

  const hashReal = await sha256Hex(bytes);
  if (hashReal !== xmlHashDeclarado.toLowerCase()) {
    throw new Error(
      "409:LC_XML_HASH_MISMATCH: el archivo en el buzón no coincide con el declarado",
    );
  }

  try {
    return {
      servidor: metaDesdeCfdi(
        parseCfdi(new TextDecoder("utf-8").decode(bytes)),
      ),
      hashReal,
    };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    throw new Error(`400:LC_XML_INVALIDO: ${detalle}`, { cause: e });
  }
}

Deno.serve(
  wrapEdgeHandler("adjuntar-xml-entrante", async (req: Request) => {
    const preflight = handlePreflightStrict(req);
    if (preflight) return preflight;
    const cors = buildCors(req);
    const log = createLogger(req, "adjuntar-xml-entrante");

    try {
      const auth = await authenticate(req, log);
      const { userId, adminClient } = auth;
      const datos = leerCuerpo((await req.json()) as Cuerpo);
      const { data: docRow, error: docError } = await adminClient
        .from("embarque_facturas_entrantes")
        .select("id, organization_id, embarque_id, estado")
        .eq("id", datos.documentoId)
        .is("deleted_at", null)
        .maybeSingle();
      const documento = docError ? null : (docRow as DocumentoBuzon | null);
      if (!documento) {
        log.finish(404, "no_encontrado", { user_id: userId });
        return errorResponse(
          "LC_NO_ENCONTRADO: el documento del buzón no existe",
          404,
          cors,
        );
      }
      const autorizacion = await autorizarCxp(auth, cors, log, {
        organizationId: documento.organization_id,
        fn: "adjuntar-xml-entrante",
        rolesPermitidos: ROLES_ADJUNTAR_XML_ENTRANTE,
        rlUsuario: RL_USUARIO,
        rlOrg: RL_ORG,
        mensaje429:
          "Demasiadas solicitudes de adjuntar XML. Intenta más tarde.",
      });

      if (!autorizacion.ok) {
        if (autorizacion.res.status !== 403) return autorizacion.res;
        await autorizacion.res.body?.cancel();
        return errorResponse(
          "LC_NO_ENCONTRADO: el documento del buzón no existe",
          404,
          cors,
        );
      }

      // Ola P2: validar documento + ruta ANTES de descargar con service_role.
      const rechazo = verificarAcceso({
        documento,
        xmlPath: datos.xmlPath,
        userId,
        cors,
        log,
      });
      if (rechazo) return rechazo;

      const { servidor, hashReal } = await descargarYParsear(
        adminClient,
        datos.xmlPath,
        datos.xmlHash,
      );

      const fallos = discrepanciasMeta(datos.declarado, servidor);
      if (fallos.length > 0) {
        log.finish(409, "metadata_mismatch");
        return errorResponse(
          `LC_XML_METADATA_MISMATCH: los datos capturados no coinciden con el XML (${
            fallos.join(", ")
          })`,
          409,
          cors,
        );
      }

      const { error: rpcError } = await adminClient.rpc(
        "adjuntar_xml_entrante_verificado",
        {
          p_documento_id: datos.documentoId,
          p_actor: userId,
          p_xml_path: datos.xmlPath,
          p_xml_nombre: datos.xmlNombre,
          p_xml_hash: hashReal,
          p_uuid_fiscal: servidor.uuid,
          p_rfc_emisor: servidor.rfcEmisor,
          p_folio_serie: servidor.folioSerie,
          p_fecha_emision: servidor.fechaEmision,
          p_total_detectado: servidor.total,
          p_moneda_detectada: servidor.moneda,
          p_subtotal_detectado: servidor.subtotal,
        },
      );
      if (rpcError) {
        const esPermiso = /LC_FORBIDDEN|LC_NO_AUTORIZADO/.test(
          rpcError.message,
        );
        log.finish(esPermiso ? 403 : 400, "rpc_error");
        return errorResponse(rpcError.message, esPermiso ? 403 : 400, cors);
      }

      log.finish(200, "ok");
      return jsonResponse({ ok: true, meta: servidor }, 200, cors);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const match = /^(400|401|403|404|409|413):(.*)$/s.exec(msg);
      if (match) {
        const status = Number(match[1]);
        log.finish(status, "rechazado");
        return errorResponse(match[2], status, cors);
      }
      await captureEdgeException(e, { fn: "adjuntar-xml-entrante" });
      log.finish(500, "error");
      return errorResponse(msg, 500, cors);
    }
  }),
);

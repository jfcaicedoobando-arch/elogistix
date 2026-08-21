/**
 * adjuntar-xml-entrante — Adjunta el XML faltante a un documento del buzón CxP
 * verificando los metadatos fiscales SERVER-SIDE (Ola 5 · O5.8 / BUG-18).
 *
 * Flujo:
 *  1. JWT válido (el actor se toma del token, nunca del body).
 *  2. Descarga el XML de Storage con service_role y verifica su SHA-256.
 *  3. Re-parsea el CFDI (`parse-cfdi-xml/parser.ts`) — esa es la verdad fiscal.
 *  4. Si lo declarado por el cliente difiere → 409 LC_XML_METADATA_MISMATCH.
 *  5. Escribe vía `adjuntar_xml_entrante_verificado` (sólo service_role).
 */
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { captureEdgeException, wrapEdgeHandler } from "../_shared/sentry.ts";
import { parseCfdi } from "../parse-cfdi-xml/parser.ts";
import { discrepanciasMeta, metaDesdeCfdi, sha256Hex } from "./verificacion.ts";

const BUCKET = "cxp-inbox";
const MAX_BYTES = 2 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const documentoId = typeof body.documento_id === "string" ? body.documento_id : "";
  const xmlPath = typeof body.xml_path === "string" ? body.xml_path : "";
  const xmlNombre = typeof body.xml_nombre === "string" ? body.xml_nombre : "";
  const xmlHash = typeof body.xml_hash === "string" ? body.xml_hash : "";
  if (!UUID_RE.test(documentoId)) throw new Error("400:documento_id inválido");
  if (!xmlPath || xmlPath.includes("..")) throw new Error("400:xml_path inválido");
  if (!xmlNombre) throw new Error("400:xml_nombre requerido");
  if (!/^[0-9a-f]{64}$/i.test(xmlHash)) throw new Error("400:xml_hash inválido");
  return { documentoId, xmlPath, xmlNombre, xmlHash, declarado: body.declarado ?? null };
}

Deno.serve(
  wrapEdgeHandler("adjuntar-xml-entrante", async (req: Request) => {
    const preflight = handlePreflightStrict(req);
    if (preflight) return preflight;
    const cors = buildCors(req);
    const log = createLogger(req, "adjuntar-xml-entrante");

    try {
      const { userId, adminClient } = await authenticate(req, log);
      const datos = leerCuerpo((await req.json()) as Cuerpo);

      const { data: archivo, error: dlError } = await adminClient.storage
        .from(BUCKET)
        .download(datos.xmlPath);
      if (dlError || !archivo) throw new Error("400:LC_XML_NO_ENCONTRADO: el XML no está en el buzón");

      const bytes = await archivo.arrayBuffer();
      if (bytes.byteLength > MAX_BYTES) throw new Error("400:LC_XML_DEMASIADO_GRANDE: el XML excede 2 MB");

      const hashReal = await sha256Hex(bytes);
      if (hashReal !== datos.xmlHash.toLowerCase()) {
        throw new Error("409:LC_XML_HASH_MISMATCH: el archivo en el buzón no coincide con el declarado");
      }

      let servidor;
      try {
        servidor = metaDesdeCfdi(parseCfdi(new TextDecoder("utf-8").decode(bytes)));
      } catch (e) {
        const detalle = e instanceof Error ? e.message : String(e);
        throw new Error(`400:LC_XML_INVALIDO: ${detalle}`);
      }

      const fallos = discrepanciasMeta(datos.declarado, servidor);
      if (fallos.length > 0) {
        log.finish(409, "metadata_mismatch");
        return errorResponse(
          `LC_XML_METADATA_MISMATCH: los datos capturados no coinciden con el XML (${fallos.join(", ")})`,
          409,
          cors,
        );
      }

      const { error: rpcError } = await adminClient.rpc("adjuntar_xml_entrante_verificado", {
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
      });
      if (rpcError) {
        const esPermiso = /LC_FORBIDDEN|LC_NO_AUTORIZADO/.test(rpcError.message);
        log.finish(esPermiso ? 403 : 400, "rpc_error");
        return errorResponse(rpcError.message, esPermiso ? 403 : 400, cors);
      }

      log.finish(200, "ok");
      return jsonResponse({ ok: true, meta: servidor }, 200, cors);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const match = /^(400|401|403|409):(.*)$/s.exec(msg);
      if (match) {
        const status = Number(match[1]);
        log.finish(status, "rechazado");
        return errorResponse(match[2], status, cors);
      }
      captureEdgeException(e, { funcion: "adjuntar-xml-entrante" });
      log.finish(500, "error");
      return errorResponse(msg, 500, cors);
    }
  }),
);

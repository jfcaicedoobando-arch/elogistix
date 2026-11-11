import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type LocalFactura,
  reconciliarSiAplica,
  type SBClient,
} from "./reconciliacion.ts";

const factura: LocalFactura = {
  id: "factura",
  facturapi_id: "remota",
  organization_id: "organizacion",
  estado: "Emitida",
  cancellation_status: "pending",
  uuid_fiscal: null,
  sustituida_por: null,
  total: 100,
  moneda: "MXN",
  rfc_cliente: null,
};

for (const permitido of [true, false]) {
  Deno.test(`consulta de cancelación aceptada con permiso fiscal=${permitido}`, async () => {
    const llamadas: unknown[] = [];
    const supabase = {
      rpc(nombre: string, args: unknown) {
        llamadas.push([nombre, args]);
        return Promise.resolve({ error: permitido ? null : { code: "42501" } });
      },
      from(tabla: string) {
        llamadas.push(tabla);
        return { insert: () => Promise.resolve({ error: null }) };
      },
    } as unknown as SBClient;

    const reconciliada = await reconciliarSiAplica(
      supabase,
      factura,
      {
        status: "canceled",
        cancellation_status: "accepted",
      },
      ["estado distinto"],
      { id: "usuario" },
    );

    assertEquals(reconciliada, permitido);
    assertEquals(llamadas, [
      ["cerrar_cancelacion_factura_facturapi", { p_factura_id: "factura" }],
      ...(permitido ? ["bitacora_actividad"] : []),
    ]);
  });
}

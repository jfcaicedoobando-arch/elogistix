import { buildEstadoResultados } from "../../domain/estadoResultados";

/** Fictional, local-only records covering all transport modes, zero and losses. */
export function mobileEerrFixture() {
  const embarques = ["Marítimo", "Aéreo", "Terrestre", "Otros"].map((modo, i) => ({
    id: `fixture-${i}`, modo, tipo_cambio_usd: 20, tipo_cambio_eur: 22,
  }));
  return buildEstadoResultados(embarques,
    [123456789.12, -456789.25, 0, 1250.5].map((total, i) => ({
      embarque_id: `fixture-${i}`, descripcion: "Transporte y servicios logísticos", total, moneda: "MXN",
    })),
    [100000000, 123456.75, 50, 1000.25].map((monto, i) => ({
      embarque_id: `fixture-${i}`, concepto: "Costo operativo", monto, moneda: "MXN",
    })),
  );
}

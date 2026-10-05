import { describe, expect, it } from "vitest";
import { MODULOS } from "../ayudaModulos";
import { GLOSARIO } from "../ayudaGlosario";
import { DOCUMENTOS_OBLIGATORIOS_CLIENTE, DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO } from "@/features/cliente/domain/documentosCliente";
import { TIPO_IVA_AYUDA_GENERAL, TIPO_IVA_OPCIONES } from "@/lib/financial/tipoIvaSat";

function respuesta(modulo: string, pregunta: string): string {
  const faq = MODULOS.find((m) => m.id === modulo)?.faqs.find((f) => f.pregunta === pregunta);
  if (!faq) throw new Error(`FAQ ausente: ${modulo}/${pregunta}`);
  return faq.respuesta;
}

describe("Ayuda: contratos operativos actuales", () => {
  it("expediente sin crédito y con crédito comparte los requisitos de la ficha", () => {
    const texto = respuesta("clientes-portal", "¿Qué documentos necesita un cliente para operar?");
    for (const tipo of DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO) expect(texto).toContain(tipo);
    expect(texto).toContain(`${DOCUMENTOS_OBLIGATORIOS_CLIENTE.length} documentos`);
    expect(texto).toContain(`son ${DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO.length}`);
    expect(texto).not.toMatch(/11 documentos|bloquea operación/);
  });

  it("IVA comparte categorías y advertencia de no inferencia con el catálogo", () => {
    const texto = GLOSARIO.find((t) => t.termino === "Tratamiento de IVA")?.definicion;
    for (const opcion of TIPO_IVA_OPCIONES) expect(texto).toContain(opcion.label);
    expect(texto).toContain(TIPO_IVA_AYUDA_GENERAL);
    expect(texto).toContain("8% requiere habilitación");
    expect(texto).not.toContain("Configurable globalmente");
  });

  it("preparar una proforma crea borrador y el timbrado es posterior", () => {
    const texto = respuesta("facturacion", "¿Cómo emito una factura?");
    expect(texto.indexOf("Crear borrador de factura")).toBeLessThan(texto.indexOf("Por timbrar"));
    expect(texto.indexOf("Por timbrar")).toBeLessThan(texto.indexOf("usa Timbrar"));
    expect(texto).toContain("Nueva factura manual");
    expect(respuesta("facturacion", "¿Diferencia entre proforma y factura?")).toContain("política del cliente");
  });

  it("registrar un pago no promete conciliación y no fija tolerancia universal", () => {
    expect(respuesta("tesoreria", "¿Cómo registro un pago a proveedor?")).toContain("no confirma su conciliación bancaria");
    const texto = respuesta("tesoreria", "¿Cómo concilio movimientos bancarios?");
    expect(texto).toContain("Conciliar coincidencias únicas");
    expect(texto).toContain("coincidencias ambiguas");
    expect(texto).not.toContain("±$1");
  });
});

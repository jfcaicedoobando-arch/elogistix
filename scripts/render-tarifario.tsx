import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { TarifarioDocument } from "../src/pdf/documents/TarifarioDocument";

const cotizacion: any = {
  folio: "TAR-2026-0042",
  cliente_nombre: "Importadora del Pacífico, S.A. de C.V.",
  operador: "Ana López",
  created_at: new Date().toISOString(),
  vigencia_desde: "2026-06-01",
  vigencia_hasta: "2026-08-31",
  estado: "Vigente",
  notas: "Tarifas sujetas a disponibilidad de espacio y equipo. No incluye maniobras extraordinarias.",
  tarifas_informativas: JSON.stringify([
    { id: "1", modo: "Marítimo", modalidad_equipo: "FCL", tipo_contenedor: "40' HC", origen: "Shanghai", destino: "Manzanillo", unidad_medida: "Contenedor", precio: 4250.75, moneda: "USD", notas: "Tránsito 28 días" },
    { id: "2", modo: "Marítimo", modalidad_equipo: "FCL", tipo_contenedor: "20' STD", origen: "Ningbo", destino: "Lázaro Cárdenas", unidad_medida: "Contenedor", precio: 2890.00, moneda: "USD", notas: "Incluye THC" },
    { id: "3", modo: "Aéreo", modalidad_equipo: "General", origen: "Hong Kong", destino: "AICM", unidad_medida: "Kilogramo", precio: 5.25, moneda: "USD", notas: "Mín. 100 kg" },
    { id: "4", modo: "Terrestre", modalidad_equipo: "Porta Contenedor", origen: "Manzanillo", punto_intermedio: "Guadalajara", destino: "CDMX", unidad_medida: "Viaje", precio: 28500.00, moneda: "MXN", notas: "—" },
    { id: "5", modo: "Marítimo", modalidad_equipo: "LCL", origen: "Yantian", destino: "Veracruz", unidad_medida: "Metro cúbico", precio: 145.50, moneda: "USD", notas: "Mín. 1 m³" },
  ]),
};

const emisor = {
  razonSocial: "Libre Carga Logística",
  subtitulo: "Agente de carga internacional",
  rfc: "LCL120304XY1",
  direccion: "Av. Insurgentes Sur 1234, Col. Del Valle, CDMX 03100",
  contacto: "+52 55 1234 5678  ·  contacto@librecarga.com",
};

await renderToFile(
  React.createElement(TarifarioDocument, { cotizacion, emisor }),
  "/tmp/tarifario.pdf",
);
console.log("ok");

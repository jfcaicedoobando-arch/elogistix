import { View, Text } from "@react-pdf/renderer";
import { styles } from "../theme/styles";
import type { CotizacionRow, DimensionLCL, DimensionAerea } from "@/features/cotizacion/types";
import { buildDatosGenerales, buildMercancia } from "@/generators/cotizacion/datosGenerales";
import type { TipoContenedorCatalogo } from "@/features/cotizacion/utils/resolveTipoContenedorNombre";
import { KeyValueGrid } from "../components/KeyValueGrid";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { sanitizePdfText } from "../text/sanitizePdfText";

interface Props {
  c: CotizacionRow;
}

interface PropsConCatalogo extends Props {
  tiposContenedor?: ReadonlyArray<TipoContenedorCatalogo>;
}

/** Sección "Datos del Prospecto" sólo cuando aplica. */
function SeccionProspecto({ c }: Props) {
  if (!c.es_prospecto) return null;
  const items: Array<[string, string]> = [
    ["Empresa", c.prospecto_empresa || "-"],
    ["Contacto", c.prospecto_contacto || "-"],
    ["Email", c.prospecto_email || "-"],
    ["Teléfono", c.prospecto_telefono || "-"],
  ];
  return (
    <View wrap={false}>
      <Text style={styles.h3}>Datos del Prospecto</Text>
      <KeyValueGrid items={items} columns={4} />
    </View>
  );
}

/** Resumen ejecutivo de la ruta para lectura rápida del cliente. */
export function SeccionResumenRuta({ c }: Props) {
  const partes: string[] = [];
  if (c.origen || c.destino) partes.push(`${c.origen || '—'}  \u2192  ${c.destino || '—'}`);
  if (c.modo) partes.push(c.modo);
  if (c.incoterm) partes.push(c.incoterm);
  if (c.tiempo_transito_dias != null) partes.push(`Tránsito ${c.tiempo_transito_dias} días`);
  const esMaritimo = (c.modo || "").toLowerCase().startsWith("mar");
  const sinFleteVenta = esMaritimo && ["CIF", "CFR", "CIP", "CPT", "DAP", "DDP", "DAT"].includes(c.incoterm || "");
  if (partes.length === 0 && !sinFleteVenta) return null;
  return (
    <View style={{ marginTop: 4, marginBottom: 4 }} wrap={false}>
      <Text style={{ ...styles.paragraph, fontSize: 10 }}>{sanitizePdfText(partes.join("  ·  "))}</Text>
      {sinFleteVenta && (
        <Text style={{ ...styles.paragraph, fontSize: 9, fontStyle: "italic", marginTop: 2 }}>
          Términos {c.incoterm} (Incoterms® 2020): el vendedor en origen cubre el flete
          {(c.incoterm === "CIF" || c.incoterm === "CIP") ? " y el seguro" : ""} hasta el lugar de destino.
          Los conceptos cotizados corresponden únicamente a servicios locales en destino.
        </Text>
      )}
    </View>
  );
}

/** Tabla de dimensiones (LCL marítimo o aéreo). */
export function SeccionDimensiones({ c }: Props) {
  const esLcl = c.modo === "Marítimo" && c.tipo_embarque === "LCL";
  const esAereo = c.modo === "Aéreo";
  if (esLcl) {
    const lcl: DimensionLCL[] = Array.isArray(c.dimensiones_lcl) ? c.dimensiones_lcl : [];
    if (lcl.length === 0) return null;
    const cols: PdfColumn<DimensionLCL>[] = [
      { key: "piezas", title: "Piezas", cellStyle: styles.cellQty, render: (r) => String(r.piezas) },
      { key: "alto_cm", title: "Alto (cm)", cellStyle: styles.cellNum, render: (r) => String(r.alto_cm) },
      { key: "largo_cm", title: "Largo (cm)", cellStyle: styles.cellNum, render: (r) => String(r.largo_cm) },
      { key: "ancho_cm", title: "Ancho (cm)", cellStyle: styles.cellNum, render: (r) => String(r.ancho_cm) },
      { key: "volumen_m3", title: "Volumen m³", cellStyle: styles.cellNum, render: (r) => r.volumen_m3.toFixed(4) },
    ];
    return (
      <>
        <Text style={styles.h4}>Dimensiones</Text>
        <DataTable columns={cols} rows={lcl} />
        <Text style={{ ...styles.paragraph, textAlign: "right", fontSize: 9 }}>
          Total piezas: {c.piezas}   ·   Volumen total: {c.volumen_m3} m³
        </Text>
      </>
    );
  }
  if (esAereo) {
    const a: DimensionAerea[] = Array.isArray(c.dimensiones_aereas) ? c.dimensiones_aereas : [];
    if (a.length === 0) return null;
    const cols: PdfColumn<DimensionAerea>[] = [
      { key: "piezas", title: "Piezas", cellStyle: styles.cellQty, render: (r) => String(r.piezas) },
      { key: "alto_cm", title: "Alto (cm)", cellStyle: styles.cellNum, render: (r) => String(r.alto_cm) },
      { key: "largo_cm", title: "Largo (cm)", cellStyle: styles.cellNum, render: (r) => String(r.largo_cm) },
      { key: "ancho_cm", title: "Ancho (cm)", cellStyle: styles.cellNum, render: (r) => String(r.ancho_cm) },
      { key: "peso_volumetrico_kg", title: "Peso vol. (kg)", cellStyle: styles.cellNum, render: (r) => r.peso_volumetrico_kg.toFixed(2) },
    ];
    return (
      <>
        <Text style={styles.h4}>Dimensiones</Text>
        <DataTable columns={cols} rows={a} />
        <Text style={{ ...styles.paragraph, textAlign: "right", fontSize: 9 }}>
          Total piezas: {c.piezas}   ·   Peso volumétrico total: {c.peso_kg} kg
        </Text>
      </>
    );
  }
  return null;
}

export { SeccionProspecto };

/** Sección Datos Generales + Mercancía + descripción adicional + dimensiones. */
export function SeccionDatosYMercancia({ c, tiposContenedor = [] }: PropsConCatalogo) {
  return (
    <>
      <View wrap={false}>
        <Text style={styles.h3}>Datos Generales</Text>
        <KeyValueGrid items={buildDatosGenerales(c)} columns={3} />
      </View>
      <View wrap={false} style={{ marginTop: 8 }}>
        <Text style={styles.h3}>Mercancía</Text>
        <KeyValueGrid items={buildMercancia(c, tiposContenedor)} columns={3} />
      </View>
      {c.descripcion_adicional ? (
        <View style={{ marginTop: 6 }} wrap>
          <Text style={styles.label}>Descripción Adicional</Text>
          <Text style={{ ...styles.paragraph, fontSize: 9 }} wrap>{c.descripcion_adicional}</Text>
        </View>
      ) : null}
      <SeccionDimensiones c={c} />
    </>
  );
}

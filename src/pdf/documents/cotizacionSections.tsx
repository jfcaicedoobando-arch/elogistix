import { View, Text } from "@react-pdf/renderer";
import { formatDate } from "@/lib/formatters";
import { styles } from "../theme/styles";
import type { CotizacionRow, DimensionLCL, DimensionAerea } from "@/types/cotizacion";
import { buildDatosGenerales, buildMercancia } from "@/generators/cotizacion/datosGenerales";
import { KeyValueGrid } from "../components/KeyValueGrid";
import { DataTable, type PdfColumn } from "../components/DataTable";

interface Props {
  c: CotizacionRow;
}

/** Header propio de cotización: folio + cliente + badge de estado + fecha. */
function HeaderCotizacion({ c }: Props) {
  const nombre = c.es_prospecto ? `${c.prospecto_empresa} (Prospecto)` : c.cliente_nombre;
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.h1}>{c.folio}</Text>
        <Text style={{ marginTop: 4, fontSize: 11 }}>{nombre}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.badge}>{c.estado}</Text>
        <Text style={styles.metaLine}>Fecha: {formatDate(c.created_at.substring(0, 10))}</Text>
      </View>
    </View>
  );
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
    <>
      <Text style={styles.h3}>Datos del Prospecto</Text>
      <KeyValueGrid items={items} columns={4} />
    </>
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

export { HeaderCotizacion, SeccionProspecto };

/** Sección Datos Generales + Mercancía + descripción adicional + dimensiones. */
export function SeccionDatosYMercancia({ c }: Props) {
  return (
    <>
      <Text style={styles.h3}>Datos Generales</Text>
      <KeyValueGrid items={buildDatosGenerales(c)} columns={4} />
      <Text style={styles.h3}>Mercancía</Text>
      <KeyValueGrid items={buildMercancia(c)} columns={4} />
      {c.descripcion_adicional ? (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.label}>Descripción Adicional</Text>
          <Text>{c.descripcion_adicional}</Text>
        </View>
      ) : null}
      <SeccionDimensiones c={c} />
    </>
  );
}

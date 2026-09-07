import { Document, Page, renderToFile, StyleSheet, Text, View } from "@react-pdf/renderer";
import { NotasSection } from "../src/pdf/components/NotasSection";
import React from "react";

const s = StyleSheet.create({ page: { padding: 36, fontSize: 10 }, fill: { height: 620, backgroundColor: "#eef" } });

function Doc({ notas, relleno }: { notas: string; relleno: boolean }) {
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {relleno ? <View style={s.fill}><Text>relleno</Text></View> : null}
        <NotasSection notas={notas} />
      </Page>
    </Document>
  );
}

const cien = Array.from({ length: 100 }, () => "A").join("\n");
const largo = Array.from({ length: 120 }, (_, i) => `Linea ${i} con texto suficiente para verse`).join("\r\n");

await renderToFile(<Doc notas={cien} relleno />, "/tmp/notas/a.pdf");
await renderToFile(<Doc notas={largo} relleno={false} />, "/tmp/notas/b.pdf");
console.log("ok");

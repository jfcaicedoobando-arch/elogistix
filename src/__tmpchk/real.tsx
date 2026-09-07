import React from 'react';
import { Document, Page, Text, renderToFile } from '@react-pdf/renderer';
import { styles } from '../pdf/theme/styles';
import { Footer } from '../pdf/components/Footer';
const long='COMERCIALIZADORA Y AGENCIA ADUANAL INTERNACIONAL DEL PACIFICO SA DE CV';
const mk=(orient:'portrait'|'landscape')=>(
  <Document>
    <Page size="LETTER" orientation={orient} style={styles.page}>
      {[...Array(60)].map((_,i)=><Text key={i}>Linea de contenido {i}</Text>)}
      <Footer empresaNombre={long}/>
    </Page>
  </Document>);
await renderToFile(mk('portrait'),'/tmp/pdfchk/real-p.pdf');
await renderToFile(mk('landscape'),'/tmp/pdfchk/real-l.pdf');
console.log('ok');

import React from 'react';
import { Document, Page, Text, View, renderToFile } from '@react-pdf/renderer';
import { styles } from '../pdf/theme/styles';
const long='COMERCIALIZADORA Y AGENCIA ADUANAL INTERNACIONAL DEL PACIFICO SA DE CV';
const variants: Record<string, object> = {
  pct: { width: '42%' },
  pt: { width: 220 },
  pt_clip: { width: 220, maxLines: 1, textOverflow: 'ellipsis' },
  flexshrink: { flexGrow: 1, flexShrink: 1, flexBasis: 220 },
};
for (const [k, st] of Object.entries(variants)) {
  await renderToFile(
    <Document><Page size="LETTER" style={styles.page}>
      {[...Array(60)].map((_, i) => <Text key={i}>Linea {i}</Text>)}
      <View style={styles.footer} fixed>
        <Text style={st as never}>{long}</Text>
        <Text style={styles.footerColCenter}>Centro</Text>
        <Text style={styles.footerColRight} render={({ pageNumber }) => `Pagina ${pageNumber}`} />
      </View>
    </Page></Document>, `/tmp/pdfchk/v2-${k}.pdf`);
}
console.log('ok');

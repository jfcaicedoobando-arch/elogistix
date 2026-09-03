import { renderToFile, Document, Page, Text } from "@react-pdf/renderer";
import { Footer } from "../src/pdf/components/Footer";
import { styles } from "../src/pdf/theme/styles";
await renderToFile(
  <Document><Page size="LETTER" style={styles.page}><Text>hola</Text><Footer empresaNombre="ACME" /></Page></Document>,
  "/tmp/pdfqa/foot.pdf",
);

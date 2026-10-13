import { pdf } from '@react-pdf/renderer';
import { ReporteCarteraDocument } from './src/pdf/documents/ReporteCarteraDocument';
export async function renderBatch(props: Parameters<typeof ReporteCarteraDocument>[0]) {
  const blob = await pdf(<ReporteCarteraDocument {...props} />).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

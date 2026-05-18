import JSZip from "jszip";
import { saveAs } from "file-saver";

/**
 * Empaqueta un mapa de archivos `{ ruta: contenido }` dentro de una carpeta y
 * dispara la descarga del ZIP resultante con compresión DEFLATE nivel 6.
 */
export async function downloadZip(
  folderName: string,
  files: Record<string, string>,
  fileName: string,
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(folderName)!;
  for (const [name, content] of Object.entries(files)) {
    folder.file(name, content);
  }
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  saveAs(blob, fileName);
}

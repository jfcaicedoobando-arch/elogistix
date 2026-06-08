/**
 * Helper centralizado para descargar un Blob desde el navegador.
 *
 * Aplica el patrón defensivo: inyecta un `<a download>` temporal en el DOM,
 * invoca `.click()` y dentro de un bloque `finally` programa la revocación
 * de la URL del Blob con un `setTimeout` de 4s. Esto evita fugas de RAM al
 * exportar múltiples PDFs/CSVs pesados en la misma sesión y, a la vez, deja
 * tiempo suficiente para que el navegador inicie la descarga antes de que el
 * objeto sea liberado.
 *
 * Centralizado en 12.61.8 (antes existían 5 implementaciones duplicadas con
 * revocación inmediata sin `finally`, propensas a no liberar memoria si el
 * flujo lanzaba antes de `revokeObjectURL`).
 */
export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Pequeño delay para que el navegador inicie la descarga antes de revocar.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

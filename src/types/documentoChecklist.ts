/**
 * Tipo de dominio para checklist de documentos.
 * Movido desde src/components/DocumentChecklist.tsx para evitar que hooks importen tipos desde components.
 */
export interface DocumentoChecklist {
  nombre: string;
  archivo?: string;
  adjuntado: boolean;
}

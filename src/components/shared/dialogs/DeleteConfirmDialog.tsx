/**
 * `<DeleteConfirmDialog />` — re-export tipado del confirmador de doble paso
 * `DoubleConfirmDeleteDialog` (typable ELIMINAR).
 *
 * Se mantiene el componente físico existente para no romper consumidores
 * actuales; los nuevos call-sites deben importar desde este archivo para
 * cerrar la ola 1 sin duplicar lógica.
 */
export { default as DeleteConfirmDialog } from "@/components/shared/DoubleConfirmDeleteDialog";

/**
 * Mensaje de error inline reutilizado por los campos del formulario de
 * edición de proveedor.
 */
export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-body text-destructive">{message}</p>;
}

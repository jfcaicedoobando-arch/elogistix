/**
 * Tokens estandarizados para tamaños de DialogContent / AlertDialogContent.
 * Mantiene consistencia visual entre todos los modales del sistema.
 *
 * Uso:
 *   <DialogContent className={dialogSize.md}>...</DialogContent>
 *   <DialogContent className={cn(dialogSize.lg, scrollableDialog)}>...</DialogContent>
 *
 * Decisión de tamaños (mobile-first, breakpoint sm: 640px):
 * - sm  → confirmaciones, alerts, notas cortas       (sm:max-w-sm,  ~24rem)
 * - md  → CRUD de un campo o pocos campos            (sm:max-w-md,  ~28rem) ← default recomendado
 * - lg  → formularios cortos (cliente, contacto)     (sm:max-w-lg,  ~32rem)
 * - xl  → formularios medianos (proveedor, etc.)     (sm:max-w-xl,  ~36rem)
 * - 2xl → formularios largos                         (sm:max-w-2xl, ~42rem)
 * - 3xl → previews de documento, grandes selecciones (sm:max-w-3xl, ~48rem)
 * - 4xl → wizards inline, tablas anidadas            (sm:max-w-4xl, ~56rem)
 */
export const dialogSize = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
} as const;

/**
 * Aplicar a diálogos cuyo contenido puede exceder el viewport
 * (formularios largos, tablas, listas). Garantiza scroll interno
 * sin romper layout.
 */
export const scrollableDialog = "max-h-[85vh] overflow-y-auto";

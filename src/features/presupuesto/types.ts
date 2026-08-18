/**
 * Tipos de dominio de Presupuesto. La UI importa de aquí en lugar de
 * `@/integrations/supabase/types`.
 */
import type { Enums } from "@/types/db";

/** Clasificación contable de una categoría de presupuesto. */
export type TipoContable = Enums<"tipo_contable_categoria">;

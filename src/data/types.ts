import type { Enums } from "@/integrations/supabase/types";

/** Centralized role type derived from the database enum */
export type AppRole = Enums<"app_role">;

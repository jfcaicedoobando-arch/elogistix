import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
export function Probe() {
  useEffect(() => {
    supabase.from("x").select("*").then(() => {});
    fetch("/api").then(() => {});
  }, []);
  return null;
}

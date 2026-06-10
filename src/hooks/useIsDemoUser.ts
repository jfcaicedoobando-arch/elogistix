/**
 * Suscribe al estado auth y expone si el usuario actual está en la org demo.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchIsDemoUser } from "@/services/demoMode";

export function useIsDemoUser(): boolean {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async (userId: string | undefined) => {
      if (!userId) {
        if (!cancelled) setIsDemo(false);
        return;
      }
      const result = await fetchIsDemoUser(userId);
      if (!cancelled) setIsDemo(result);
    };

    supabase.auth.getUser().then(({ data }) => check(data.user?.id));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      check(session?.user?.id);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return isDemo;
}

/**
 * Suscribe al estado auth y expone si el usuario actual está en la org demo.
 * Toda interacción con supabase/client se hace vía services/demoMode.
 */
import { useEffect, useState } from "react";
import {
  fetchIsDemoUser,
  getCurrentUserId,
  subscribeAuthUserId,
} from "@/services/demoMode";

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

    getCurrentUserId().then(check);
    const unsubscribe = subscribeAuthUserId(check);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return isDemo;
}

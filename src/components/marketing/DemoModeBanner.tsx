/**
 * Banner persistente para usuarios logueados en la cuenta demo.
 * Se monta globalmente; queda oculto si el usuario no pertenece a la org demo.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

export function DemoModeBanner() {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async (userId: string | undefined) => {
      if (!userId) {
        if (!cancelled) setIsDemo(false);
        return;
      }
      const { data, error } = await supabase.rpc("is_demo_user", { _user_id: userId });
      if (cancelled) return;
      if (error) {
        setIsDemo(false);
        return;
      }
      setIsDemo(Boolean(data));
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

  if (!isDemo) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-accent px-4 py-2 text-center text-xs font-medium text-accent-foreground shadow-sm sm:text-sm"
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span>
        Estás en <strong>modo demo</strong> · datos de ejemplo, se reinician en cada acceso.
      </span>
    </div>
  );
}

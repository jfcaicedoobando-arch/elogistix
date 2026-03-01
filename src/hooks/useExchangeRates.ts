import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ExchangeRates {
  usdMxn: number;
  eurMxn: number;
}

export function useExchangeRates() {
  return useQuery<ExchangeRates>({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("exchange-rates");
      if (error) throw error;
      return {
        usdMxn: data?.usdMxn ?? 17.25,
        eurMxn: data?.eurMxn ?? 18.50,
      };
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}

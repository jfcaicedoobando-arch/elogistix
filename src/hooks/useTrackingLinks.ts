import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTrackingLinks(embarqueId?: string) {
  return useQuery({
    queryKey: ["tracking_links", embarqueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracking_links")
        .select("*")
        .eq("embarque_id", embarqueId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!embarqueId,
  });
}

export function useCreateTrackingLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      embarqueId,
      expiresAt,
    }: {
      embarqueId: string;
      expiresAt?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("tracking_links")
        .insert({
          embarque_id: embarqueId,
          expires_at: expiresAt || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tracking_links", data.embarque_id] });
    },
  });
}

export function useDeleteTrackingLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, embarqueId }: { id: string; embarqueId: string }) => {
      const { error } = await supabase
        .from("tracking_links")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return embarqueId;
    },
    onSuccess: (embarqueId) => {
      qc.invalidateQueries({ queryKey: ["tracking_links", embarqueId] });
    },
  });
}

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "documentos";

interface UploadFileOptions {
  upsert?: boolean;
  contentType?: string;
}

export async function uploadFile(path: string, file: File, options: UploadFileOptions = {}) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: options.upsert ?? false,
      contentType: options.contentType,
    });
  if (error) throw error;
  return data;
}


export async function getSignedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFile(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
export * from './facturas';

// NOTA: archivo regenerado por `email_domain.setup_email_infra`. Si vuelve a sobrescribirse,
// re-aplicar este compositor delgado que delega en queueAuth.ts + queueProcessor.ts. Ver
// mem://technical/process-email-queue-regeneration para el procedimiento completo.
import { wrapEdgeHandler } from "../_shared/sentry.ts"
import { authenticateRequest, loadQueueConfig } from "./queueAuth.ts"
import { processQueue, QueueResult } from "./queueProcessor.ts"

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: { get(key: string): string | undefined }
}

const QUEUES = ["auth_emails", "transactional_emails"] as const

const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

Deno.serve(wrapEdgeHandler("process-email-queue", async (req) => {
  const auth = await authenticateRequest(req)
  if (!auth.ok) return auth.response

  const { supabase, apiKey } = auth
  const config = await loadQueueConfig(supabase)
  if (config.rateLimited) return jsonResp({ skipped: true, reason: "rate_limited" })

  const sendUrl = Deno.env.get("LOVABLE_SEND_URL")
  let totalProcessed = 0

  for (const queue of QUEUES) {
    const ctx = {
      supabase,
      apiKey,
      queue,
      ttlMinutes: config.ttlMinutes[queue],
      sendUrl,
    }
    const result: QueueResult = await processQueue(ctx, config.batchSize, config.sendDelayMs)
    totalProcessed += result.totalProcessed
    if (result.stopped) {
      return jsonResp({ processed: totalProcessed, stopped: result.stopped })
    }
  }

  return jsonResp({ processed: totalProcessed })
}))

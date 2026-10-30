import { handler } from "./handler.ts";

export { validateFile } from "./handler.ts";

Deno.serve(handler);

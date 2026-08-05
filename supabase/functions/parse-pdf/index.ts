import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { OpenRouter } from "@openrouter/sdk";
import {
  ParsePdfResponseSchema,
  responseSchema,
  buildPrompt,
  type ParsePdfResponse,
} from "../_shared/parse-pdf-schema.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const DEFAULT_MODEL = "google/gemini-2.5-flash";

interface ParsePdfRequest {
  /** Quantized TSV text extracted client-side from the statement PDF. */
  tsv: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth context for RLS-protected queries
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify JWT via Auth service - requires a real user session, not just anon key
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError?.message ?? "Invalid or missing user session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { tsv }: ParsePdfRequest = await req.json();

    if (!tsv || typeof tsv !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing tsv in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const promptText = `${buildPrompt()}\n\n${tsv}`;

    // Initialize OpenRouter client
    const client = new OpenRouter({
      apiKey: Deno.env.get("OPENROUTER_API_KEY"),
    });

    // Call OpenRouter with extracted statement text and structured output schema
    const model = Deno.env.get("OPENROUTER_MODEL") ?? DEFAULT_MODEL;
    const response = await client.chat.send({
      chatRequest: {
        model,
        messages: [
          {
            role: "user",
            content: promptText,
          },
        ],
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "holdings",
            strict: true,
            schema: responseSchema,
          },
        },
      },
    });

    // Parse and validate the response
    const responseText = response.choices?.[0]?.message?.content;
    if (!responseText) {
      return new Response(
        JSON.stringify({ error: "No response from LLM" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsedResponse: ParsePdfResponse;
    try {
      const rawJson = JSON.parse(responseText);
      parsedResponse = ParsePdfResponseSchema.parse(rawJson);
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          error: "Failed to parse or validate LLM response",
          details: parseError instanceof Error ? parseError.message : "Unknown error",
          raw_response: responseText,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the validated holdings
    return new Response(
      JSON.stringify(parsedResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing statement:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Run `supabase functions serve --env-file ./supabase/.env`
  3. Get a user access token:
     - Sign up/in via your app, or
     - Use the Supabase Dashboard > Authentication > Users > Generate Link
  4. Make an HTTP request with the user's access token:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/parse-pdf' \
    --header 'Authorization: Bearer <USER_ACCESS_TOKEN>' \
    --header 'Content-Type: application/json' \
    --data '{"tsv":"# page=1 w=612 h=792\\n# cols: x y text\\n..."}'

  Note: The anon key will NOT work - you need a real user session token.

  Environment variables required:
    - OPENROUTER_API_KEY: Your OpenRouter API key (get from openrouter.ai/settings/keys)
    - OPENROUTER_MODEL (optional): Model to use, defaults to google/gemini-2.5-flash

*/

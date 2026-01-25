import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Define the schema once - used for both API request and response validation
const HoldingSchema = z.object({
  name: z.string().describe("Asset identifier: ticker symbol (e.g., AAPL, VTI) or descriptive name (e.g., 'Target Date 2060 Fund'). For cash, use '$CASH'."),
  quantity: z.number().describe("Number of shares/units as a decimal. For $CASH, this is the dollar amount."),
  total_value: z.number().describe("Total market value of this holding in dollars. Required for all holdings."),
  price: z.number().optional().describe("Per-share/per-unit price if explicitly shown. Optional - will be computed from total_value/quantity if not provided."),
});

const ParsePdfResponseSchema = z.object({
  holdings: z.array(HoldingSchema).describe("Array of all holdings/positions found in the statement"),
  statement_date: z.string().optional().describe("Statement date in YYYY-MM-DD format, if found"),
});

type ParsePdfResponse = z.infer<typeof ParsePdfResponseSchema>;

// Gemini-compatible JSON Schema (subset of full JSON Schema)
// Manually defined to avoid unsupported fields like additionalProperties
const geminiSchema = {
  type: "object",
  properties: {
    holdings: {
      type: "array",
      description: "Array of all holdings/positions found in the statement",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Asset identifier: ticker symbol (e.g., AAPL, VTI) or descriptive name (e.g., 'Target Date 2060 Fund'). For cash, use '$CASH'.",
          },
          quantity: {
            type: "number",
            description: "Number of shares/units as a decimal. For $CASH, this is the dollar amount.",
          },
          total_value: {
            type: "number",
            description: "Total market value of this holding in dollars. Required for all holdings.",
          },
          price: {
            type: "number",
            description: "Per-share/per-unit price if explicitly shown. Optional - will be computed from total_value/quantity if not provided.",
          },
        },
        required: ["name", "quantity", "total_value"],
      },
    },
    statement_date: {
      type: "string",
      description: "Statement date in YYYY-MM-DD format, if found",
    },
  },
  required: ["holdings"],
};

interface ParsePdfRequest {
  pdf_base64: string;
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
    const { pdf_base64 }: ParsePdfRequest = await req.json();

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: "Missing pdf_base64 in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user's existing assets to help LLM match against known assets
    const { data: existingAssets } = await supabase
      .from("assets")
      .select("ticker, name");

    // Build the prompt with optional existing securities context
    let promptText = `Analyze this investment statement PDF and extract all holdings/positions.

Rules:
- Extract every holding/position with its name, quantity (shares/units), and total market value
- For the name field, use the ticker symbol if one is shown (e.g., AAPL, VTI), otherwise use a descriptive name
- For each holding, also extract the per-share price if it's explicitly shown
- For cash or money-market balances, use name "$CASH" with quantity AND total_value both equal to the dollar amount
- Only include actual holdings, not transaction history
- Extract the statement date if visible`;

    if (existingAssets && existingAssets.length > 0) {
      const knownAssets = existingAssets
        .map((s) => s.ticker ?? s.name)
        .join(", ");
      promptText += `

Known assets: ${knownAssets}
If you are reasonably confident that a holding in this statement represents the same asset as one listed above, use that exact name from the list.`;
    }

    // Initialize Gemini client with API key (works for both AI Studio and Vertex AI)
    // For Vertex AI: set GOOGLE_GENAI_USE_VERTEXAI=true (API key includes project info)
    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    const useVertexAI = Deno.env.get("GOOGLE_GENAI_USE_VERTEXAI") === "true";
    const ai = new GoogleGenAI(useVertexAI
      ? { apiKey, vertexai: true }
      : { apiKey });

    // Call Gemini with the PDF and structured output schema
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              // be sure to pass data inline, not files API (stored)
              inlineData: {
                mimeType: "application/pdf",
                data: pdf_base64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: geminiSchema,
      },
      // be sure to use no tools like grounding with google search
    });

    // Parse and validate the response using the same schema
    const responseText = response.text;
    if (!responseText) {
      return new Response(
        JSON.stringify({ error: "No response from Gemini" }),
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
          error: "Failed to parse or validate Gemini response",
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
    console.error("Error processing PDF:", error);
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
    --data '{"pdf_base64":"<base64-encoded-pdf>"}'

  Note: The anon key will NOT work - you need a real user session token.

*/

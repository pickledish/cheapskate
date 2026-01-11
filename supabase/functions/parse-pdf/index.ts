import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Define the schema once - used for both API request and response validation
const HoldingSchema = z.object({
  ticker: z.string().describe("Stock/ETF/fund ticker symbol (e.g., AAPL, VTI, VTSAX). For cash, use '$CASH'. For unknown funds, use name in CAPS with underscores."),
  quantity: z.number().describe("Number of shares/units as a decimal. For $CASH, this is the dollar amount."),
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
          ticker: {
            type: "string",
            description: "Stock/ETF/fund ticker symbol (e.g., AAPL, VTI, VTSAX). For cash, use '$CASH'. For unknown funds, use name in CAPS with underscores.",
          },
          quantity: {
            type: "number",
            description: "Number of shares/units as a decimal. For $CASH, this is the dollar amount.",
          },
        },
        required: ["ticker", "quantity"],
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
    // Verify Authorization header exists (Supabase validates the JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
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

    // Initialize Gemini client (uses GEMINI_API_KEY env var)
    const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });

    // Call Gemini with the PDF and structured output schema
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: pdf_base64,
              },
            },
            {
              text: `Analyze this investment statement PDF and extract all holdings/positions.

Rules:
- Extract every holding/position with its ticker symbol and quantity (number of shares/units)
- For cash balances, use ticker "$CASH" and quantity as the dollar amount
- If a ticker symbol is unclear, use the fund name in CAPS with underscores (e.g., "TARGET_DATE_2050")
- Only include actual holdings, not transaction history
- Extract the statement date if visible`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: geminiSchema,
      },
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
  2. Set your Gemini API key: `supabase secrets set GEMINI_API_KEY=your-key-here`
  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/parse-pdf' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"pdf_base64":"<base64-encoded-pdf>"}'

*/

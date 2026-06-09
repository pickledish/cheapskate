import { z } from "zod";

export const HoldingSchema = z.object({
  name: z.string().describe("Asset identifier: ticker symbol (e.g., AAPL, VTI) or descriptive name (e.g., 'Target Date 2060 Fund'). For cash, use '$CASH'."),
  quantity: z.number().describe("Number of shares/units as a decimal. For $CASH, this is the dollar amount."),
  total_value: z.number().describe("Total market value of this holding in dollars. Required for all holdings."),
  price: z.number().optional().describe("Per-share/per-unit price if explicitly shown. Optional - will be computed from total_value/quantity if not provided."),
});

export const ParsePdfResponseSchema = z.object({
  holdings: z.array(HoldingSchema).describe("Array of all holdings/positions found in the statement"),
  statement_date: z.string().optional().describe("Statement date in YYYY-MM-DD format, if found"),
  last4: z.string().optional().describe("Last 4 digits of the account number, if found"),
});

export type Holding = z.infer<typeof HoldingSchema>;
export type ParsePdfResponse = z.infer<typeof ParsePdfResponseSchema>;

// JSON Schema for structured LLM output (OpenRouter/OpenAI compatible)
export const responseSchema = {
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
        additionalProperties: false,
      },
    },
    statement_date: {
      type: "string",
      description: "Statement date in YYYY-MM-DD format, if found",
    },
    last4: {
      type: "string",
      description: "Last 4 digits of the account number, if found",
    },
  },
  required: ["holdings"],
  additionalProperties: false,
};

// Backwards compatibility alias
export const geminiSchema = responseSchema;

const promptTemplate = `Analyze this investment statement PDF and extract all holdings/positions.

Rules:
- Extract every holding/position with its name, quantity (shares/units), and total market value
- For the name field, use the ticker symbol if one is shown (e.g., AAPL, VTI), otherwise use a descriptive name
- For each holding, also extract the per-share price if it's explicitly shown
- For cash or money-market balances, use name "$CASH" with quantity AND total_value both equal to the dollar amount
- For debt or liability balances (loans, mortgages, credit cards), use name "$DEBT" with quantity equal to the dollar amount owed and total_value as the negative of that amount
- Only include actual holdings, not transaction history
- Extract the statement date if visible (use YYYY-MM-DD format)
- Extract the last 4 digits of the account number if visible`;

export function buildPrompt(knownAssets?: string[]): string {
  if (!knownAssets || knownAssets.length === 0) {
    return promptTemplate;
  }

  return `${promptTemplate}

Known assets: ${knownAssets.join(", ")}
If you are reasonably confident that a holding in this statement represents the same asset as one listed above, use that exact name from the list.`;
}

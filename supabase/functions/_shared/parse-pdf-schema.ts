import { z } from "zod";

export const HoldingSchema = z.object({
  name: z.string().describe("Asset identifier: prefer ticker symbol (e.g., AAPL, VTI, VTTSX). Use a known-asset ticker when matched. For cash, use '$CASH'."),
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
            description: "Asset identifier: prefer ticker symbol (e.g., AAPL, VTI, VTTSX). Use a known-asset ticker when matched. For cash, use '$CASH'.",
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

/** Existing portfolio assets for matching statement holdings. */
export interface KnownAsset {
  ticker: string | null;
  name: string;
}

const promptTemplate = `You will receive text extracted from an investment statement PDF as compact TSV (tab-separated values).

Format:
- Page header: # page=N w=W h=H  (page size in PDF points)
- Column header: # cols: x y text
- Data rows: x<TAB>y<TAB>text
  - x and y are quantized integer PDF coordinates (origin bottom-left; y increases upward)
  - Similar x ≈ same column; similar y ≈ same line/row
  - Rows are ordered top-to-bottom, then left-to-right

Use the coordinates to align table columns (e.g. which number is shares vs price vs market value). Then extract all holdings/positions.

Rules:
- Extract every holding/position with its name, quantity (shares/units), and total market value
- For the name field: prefer a ticker symbol. If the holding matches a known asset below, use that asset's ticker (or its listed name if it has no ticker). If no known asset matches, use the ticker from the statement if shown, otherwise a descriptive name
- For each holding, also extract the per-share price if it's explicitly shown
- For cash or money-market balances, use name "$CASH" with quantity AND total_value both equal to the dollar amount
- For debt or liability balances (loans, mortgages, credit cards), use name "$DEBT" with quantity equal to the dollar amount owed and total_value as the negative of that amount
- Only include actual holdings, not transaction history
- Extract the statement date if visible (use YYYY-MM-DD format)
- Extract the last 4 digits of the account number if visible`;

function formatKnownAsset(asset: KnownAsset): string {
  const ticker = asset.ticker?.trim() || null;
  const name = asset.name.trim();
  if (ticker && name && ticker !== name) {
    return `${ticker} — ${name}`;
  }
  return ticker || name;
}

export function buildPrompt(knownAssets?: KnownAsset[]): string {
  if (!knownAssets || knownAssets.length === 0) {
    return promptTemplate;
  }

  const lines = knownAssets.map((a) => `- ${formatKnownAsset(a)}`).join("\n");
  return `${promptTemplate}

Known assets (ticker — name). Match statement holdings to these when reasonably confident (abbreviated names like "Vang Target Ret 2060" count). When matched, set the holding "name" field to that asset's ticker (left of the em dash), not the descriptive name:
${lines}`;
}

import { z } from "zod";

export const HoldingSchema = z.object({
  name: z.string().describe(
    "Fund/security name exactly as printed on the statement (e.g. 'Vanguard Target Retirement 2060', 'FID 500 INDEX'). Copy verbatim — do not normalize or substitute.",
  ),
  ticker: z.string().nullable().describe(
    "Ticker symbol only if it is printed on the statement (e.g. AAPL, VTI, VTTSX). Null if no ticker appears. Never infer a ticker from the fund name. For cash use '$CASH'; for debt/liabilities use '$DEBT'.",
  ),
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
            description:
              "Fund/security name exactly as printed on the statement (e.g. 'Vanguard Target Retirement 2060', 'FID 500 INDEX'). Copy verbatim — do not normalize or substitute.",
          },
          ticker: {
            type: ["string", "null"],
            description:
              "Ticker symbol only if it is printed on the statement (e.g. AAPL, VTI, VTTSX). Null if no ticker appears. Never infer a ticker from the fund name. For cash use '$CASH'; for debt/liabilities use '$DEBT'.",
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
        required: ["name", "ticker", "quantity", "total_value"],
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
- For the name field: copy the fund/security name exactly as printed on the statement. Do not normalize, abbreviate, or substitute a ticker
- For the ticker field: report a ticker ONLY if it is printed on the statement. If no ticker appears next to the holding, set ticker to null. Never infer or guess a ticker from the fund name (e.g. do not map "Vanguard Target Retirement 2060" to VTTSX)
- For each holding, also extract the per-share price if it's explicitly shown
- For cash or money-market balances, use ticker "$CASH" with quantity AND total_value both equal to the dollar amount
- For debt or liability balances (loans, mortgages, credit cards), use ticker "$DEBT" with quantity equal to the dollar amount owed and total_value as the negative of that amount
- Only include actual holdings, not transaction history
- Extract the statement date if visible (use YYYY-MM-DD format)
- Extract the last 4 digits of the account number if visible`;

export function buildPrompt(): string {
  return promptTemplate;
}

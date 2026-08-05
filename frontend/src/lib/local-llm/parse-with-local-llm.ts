import { pdfToQuantizedTsv } from '@/lib/pdf'
import {
  ParsePdfResponseSchema,
  geminiSchema,
  buildPrompt,
  type KnownAsset,
  type ParsePdfResponse,
} from '@shared/parse-pdf-schema'

export interface LocalLlmConfig {
  provider: 'ollama' | 'openai'
  port: string
}

export interface ParseWithLocalLlmOptions {
  config: LocalLlmConfig
  pdfArrayBuffer: ArrayBuffer
  knownAssets?: KnownAsset[]
}

export async function parseWithLocalLlm(
  options: ParseWithLocalLlmOptions
): Promise<ParsePdfResponse> {
  const { config, pdfArrayBuffer, knownAssets } = options
  const baseUrl = `http://localhost:${config.port}`

  const tsv = await pdfToQuantizedTsv(pdfArrayBuffer)
  const prompt = buildPrompt(knownAssets)
  const userContent = `${prompt}\n\n${tsv}`

  if (config.provider === 'ollama') {
    const model = await getFirstModelOllama(baseUrl)
    return callOllama(baseUrl, model, userContent)
  } else {
    const model = await getFirstModelOpenAI(baseUrl)
    return callOpenAI(baseUrl, model, userContent)
  }
}

async function getFirstModelOllama(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/tags`)
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const models = (data as { models?: Array<{ name?: string }> }).models ?? []
  const firstModel = models[0]?.name
  if (!firstModel) {
    throw new Error('No models available. Install one with ollama pull')
  }
  return firstModel
}

async function getFirstModelOpenAI(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/models`)
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const models = (data as { data?: Array<{ id?: string }> }).data ?? []
  const firstModel = models[0]?.id
  if (!firstModel) {
    throw new Error('No models available on the OpenAI-compatible server')
  }
  return firstModel
}

const FORMAT_PROMPT = 'Now output your findings as JSON.'

async function callOllama(
  baseUrl: string,
  model: string,
  userContent: string
): Promise<ParsePdfResponse> {
  const userMessage = { role: 'user', content: userContent }

  // First call: let the model think without JSON constraints
  const thinkResponse = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [userMessage],
      stream: false,
    }),
  })

  if (!thinkResponse.ok) {
    const errorText = await thinkResponse.text()
    throw new Error(`Ollama error: ${thinkResponse.status} - ${errorText}`)
  }

  const thinkResult = await thinkResponse.json()
  const thinkingContent = thinkResult.message?.content

  if (!thinkingContent) {
    throw new Error('No response content from Ollama')
  }

  // Second call: ask for JSON output with schema constraint
  // Include full conversation history for KV cache reuse
  const formatResponse = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        userMessage,
        { role: 'assistant', content: thinkingContent },
        { role: 'user', content: FORMAT_PROMPT },
      ],
      format: geminiSchema,
      stream: false,
    }),
  })

  if (!formatResponse.ok) {
    const errorText = await formatResponse.text()
    throw new Error(`Ollama error: ${formatResponse.status} - ${errorText}`)
  }

  const formatResult = await formatResponse.json()
  const content = formatResult.message?.content

  if (!content) {
    throw new Error('No response content from Ollama')
  }

  return parseAndValidateResponse(content, model)
}

async function callOpenAI(
  baseUrl: string,
  model: string,
  userContent: string
): Promise<ParsePdfResponse> {
  const userMessage = {
    role: 'user',
    content: userContent,
  }

  // First call: let the model think without JSON constraints
  const thinkResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [userMessage],
    }),
  })

  if (!thinkResponse.ok) {
    const errorText = await thinkResponse.text()
    throw new Error(`OpenAI-compatible API error: ${thinkResponse.status} - ${errorText}`)
  }

  const thinkResult = await thinkResponse.json()
  const thinkMessage = thinkResult.choices?.[0]?.message
  const thinkingContent = thinkMessage?.content || thinkMessage?.reasoning_content

  if (!thinkingContent) {
    throw new Error('No response content from OpenAI-compatible API')
  }

  // Second call: ask for JSON output with schema constraint
  // Include full conversation history for KV cache reuse
  const formatResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        userMessage,
        { role: 'assistant', content: thinkingContent },
        { role: 'user', content: FORMAT_PROMPT },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'parse_pdf_response',
          schema: geminiSchema,
        },
      },
    }),
  })

  if (!formatResponse.ok) {
    const errorText = await formatResponse.text()
    throw new Error(`OpenAI-compatible API error: ${formatResponse.status} - ${errorText}`)
  }

  const formatResult = await formatResponse.json()
  const formatMessage = formatResult.choices?.[0]?.message
  const content = formatMessage?.content || formatMessage?.reasoning_content

  if (!content) {
    throw new Error('No response content from OpenAI-compatible API')
  }

  return parseAndValidateResponse(content, model)
}

function parseAndValidateResponse(content: string, model: string): ParsePdfResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error(
      `Model "${model}" returned invalid JSON. Raw response:\n${content.slice(0, 500)}`
    )
  }

  try {
    return ParsePdfResponseSchema.parse(parsed)
  } catch (validationError) {
    throw new Error(
      `Model "${model}" returned unexpected format: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`
    )
  }
}

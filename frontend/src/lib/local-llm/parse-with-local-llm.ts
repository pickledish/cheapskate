import { pdfToDataUrls } from '@/lib/pdf'
import {
  ParsePdfResponseSchema,
  geminiSchema,
  buildPrompt,
  type ParsePdfResponse,
} from '@shared/parse-pdf-schema'

export interface LocalLlmConfig {
  provider: 'ollama' | 'openai'
  port: string
}

export interface ParseWithLocalLlmOptions {
  config: LocalLlmConfig
  pdfArrayBuffer: ArrayBuffer
  knownAssets?: string[]
}

export async function parseWithLocalLlm(
  options: ParseWithLocalLlmOptions
): Promise<ParsePdfResponse> {
  const { config, pdfArrayBuffer, knownAssets } = options
  const baseUrl = `http://localhost:${config.port}`

  const imageDataUrls = await pdfToDataUrls(pdfArrayBuffer)
  const prompt = buildPrompt(knownAssets)

  if (config.provider === 'ollama') {
    const model = await getFirstModelOllama(baseUrl)
    return callOllama(baseUrl, model, imageDataUrls, prompt)
  } else {
    const model = await getFirstModelOpenAI(baseUrl)
    return callOpenAI(baseUrl, model, imageDataUrls, prompt)
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

async function callOllama(
  baseUrl: string,
  model: string,
  imageDataUrls: string[],
  prompt: string
): Promise<ParsePdfResponse> {
  const images = imageDataUrls.map(stripDataUrlPrefix)

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
          images,
        },
      ],
      format: geminiSchema,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama error: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  const content = result.message?.content

  if (!content) {
    throw new Error('No response content from Ollama')
  }

  return parseAndValidateResponse(content, model)
}

async function callOpenAI(
  baseUrl: string,
  model: string,
  imageDataUrls: string[],
  prompt: string
): Promise<ParsePdfResponse> {
  const imageContent = imageDataUrls.map((url) => ({
    type: 'image_url' as const,
    image_url: { url },
  }))

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: prompt },
          ],
        },
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

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI-compatible API error: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  const message = result.choices?.[0]?.message
  const content = message?.content || message?.reasoning_content

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

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',')
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
}

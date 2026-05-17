export interface TestResult {
  success: boolean
  message: string
  models?: string[]
}

export async function testConnection(
  provider: 'ollama' | 'openai',
  port: string
): Promise<TestResult> {
  const baseUrl = `http://localhost:${port}`
  const endpoint = provider === 'ollama' ? '/api/tags' : '/v1/models'
  const url = `${baseUrl}${endpoint}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        success: false,
        message: `Server returned ${response.status}: ${response.statusText}`
      }
    }

    const data = await response.json()
    const models = extractModelNames(provider, data)

    return {
      success: true,
      message: models.length > 0
        ? `Connected! Found ${models.length} model${models.length === 1 ? '' : 's'}: ${models.join(', ')}`
        : 'Connected! No models found.',
      models
    }
  } catch (err) {
    clearTimeout(timeoutId)

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timed out. Is the server running?'
        }
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return {
          success: false,
          message: `Cannot connect to ${baseUrl}. Is the server running?`
        }
      }
      return {
        success: false,
        message: err.message
      }
    }

    return {
      success: false,
      message: 'Unknown error occurred'
    }
  }
}

function extractModelNames(provider: 'ollama' | 'openai', data: unknown): string[] {
  if (provider === 'ollama') {
    const ollama = data as { models?: Array<{ name?: string }> }
    return ollama.models?.map(m => m.name).filter((n): n is string => !!n) ?? []
  } else {
    const openai = data as { data?: Array<{ id?: string }> }
    return openai.data?.map(m => m.id).filter((id): id is string => !!id) ?? []
  }
}

export interface TestResult {
  success: boolean;
  message: string;
  models?: string[];
}

export async function testConnection(
  provider: 'ollama' | 'openai',
  port: string,
): Promise<TestResult> {
  const baseUrl = `http://localhost:${port}`;
  const endpoint = provider === 'ollama' ? '/api/tags' : '/v1/models';
  const url = `${baseUrl}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        message: `Server returned ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const models = extractModelNames(provider, data);

    return {
      success: true,
      message:
        models.length > 0
          ? `Connected! Found ${models.length} model${models.length === 1 ? '' : 's'}: ${models.join(', ')}`
          : 'Connected! No models found.',
      models,
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timed out. Is the server running?',
        };
      }

      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return await diagnoseNetworkError(baseUrl);
      }

      return {
        success: false,
        message: err.message,
      };
    }

    return {
      success: false,
      message: 'Unknown error occurred',
    };
  }
}

async function diagnoseNetworkError(baseUrl: string): Promise<TestResult> {
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
  const isPublicOrigin = !['localhost', '127.0.0.1', '[::1]'].some(
    (h) => window.location.hostname === h,
  );

  const serverReachable = await checkServerReachable(baseUrl);

  if (!serverReachable) {
    return {
      success: false,
      message: `Connection refused: No server is running at ${baseUrl}. Make sure your LLM server is started.`,
    };
  }

  if (isChrome && isPublicOrigin) {
    return {
      success: false,
      message: `Private Network Access blocked (Chrome security). Try Firefox/Safari, or see: chrome://flags/#block-insecure-private-network-requests`,
    };
  }

  return {
    success: false,
    message: `CORS blocked: The server at ${baseUrl} is running but doesn't allow requests from this origin. Enable CORS in your LLM server settings.`,
  };
}

async function checkServerReachable(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    await fetch(baseUrl, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

function extractModelNames(provider: 'ollama' | 'openai', data: unknown): string[] {
  if (provider === 'ollama') {
    const ollama = data as { models?: Array<{ name?: string }> };
    return ollama.models?.map((m) => m.name).filter((n): n is string => !!n) ?? [];
  } else {
    const openai = data as { data?: Array<{ id?: string }> };
    return openai.data?.map((m) => m.id).filter((id): id is string => !!id) ?? [];
  }
}

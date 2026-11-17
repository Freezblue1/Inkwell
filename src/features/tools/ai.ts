/**
 * Provider-agnostic AI client. The user supplies their own API key (stored
 * only in this browser). Requests go directly from the browser to the provider.
 */
import type { AISettings } from '@/types/models';

export interface AIRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AIClient {
  complete(req: AIRequest, signal?: AbortSignal): Promise<string>;
}

class AnthropicClient implements AIClient {
  constructor(private s: AISettings) {}
  async complete(req: AIRequest, signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${this.s.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.s.apiKey,
        'anthropic-version': '2023-06-01',
        // Required for calling the API directly from a browser with a user-supplied key.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.s.model || 'claude-sonnet-5-5',
        max_tokens: req.maxTokens ?? 1024,
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
      }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
  }
}

class OpenAICompatibleClient implements AIClient {
  constructor(private s: AISettings) {}
  async complete(req: AIRequest, signal?: AbortSignal): Promise<string> {
    const base = (this.s.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.s.apiKey}` },
      body: JSON.stringify({
        model: this.s.model,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }
}

async function errorText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } | string };
    const msg = typeof body.error === 'string' ? body.error : body.error?.message;
    return `${res.status}: ${msg ?? res.statusText}`;
  } catch {
    return `${res.status}: ${res.statusText}`;
  }
}

export function createAIClient(s: AISettings): AIClient {
  if (!s.apiKey) throw new Error('Add an API key in the assistant settings first.');
  return s.provider === 'anthropic' ? new AnthropicClient(s) : new OpenAICompatibleClient(s);
}

export const SYSTEM_PROMPT =
  'You are a thoughtful fiction-writing assistant inside a novel-writing app. Respect the author’s voice, tense and point of view. Be concise. Never add commentary around rewritten text unless asked.';

/**
 * Poster autofill: vision → structured fields.
 *
 * Default: Ollama (local or LAN) — no API keys. Install Ollama, run `ollama pull llava` (or another vision model).
 *
 * Override: VITE_POSTER_AUTOFILL_PROVIDER=openai | anthropic (+ keys as before).
 *
 * Dev: Vite proxies /ollama-proxy → OLLAMA_HOST (default http://127.0.0.1:11434). Remote lab machine: OLLAMA_HOST=http://10.x.x.x:11434
 * Prod: set VITE_OLLAMA_URL to the same base URL if Ollama is not on localhost (Ollama enables CORS by default).
 */

const OPENAI_MODEL = 'gpt-4o-mini';
const ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';

const POSTER_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    organizer: { type: 'string' },
    description: { type: 'string' },
    location: { type: 'array', items: { type: 'string' } },
    category: {
      type: 'array',
      items: { type: 'string', enum: ['career', 'club', 'performance', 'sports', 'wellness'] },
    },
    tags: { type: 'string' },
    single_event_date: { type: 'string' },
    repeating: { type: 'boolean' },
    next_occurring_date: { type: 'string' },
    frequency: { type: 'string' },
    days_of_week: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'title',
    'organizer',
    'description',
    'location',
    'category',
    'tags',
    'single_event_date',
    'repeating',
    'next_occurring_date',
    'frequency',
    'days_of_week',
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Extract event information from this poster image. This is a campus event poster (e.g., for Carnegie Mellon University).

Use empty string "" or empty array [] for any field you cannot determine from the poster.

- title: Event title (required if visible)
- organizer: Host or organizing group
- description: Event description or details
- location: Array of venue names (e.g. ["University Center", "Hunt Library"]). Match to common campus locations when possible.
- category: Array of 1+ from: career, club, performance, sports, wellness
- tags: Comma-separated keywords
- single_event_date: Date as YYYY-MM-DD if it's a one-time event
- repeating: true if the poster indicates a recurring event
- next_occurring_date: Next date as YYYY-MM-DD for recurring events
- frequency: "daily" | "weekly" | "bi-weekly" | "monthly" if recurring
- days_of_week: Array of weekday names (e.g. ["Monday", "Wednesday"]) if recurring`;

export function getOpenAiKey() {
  return import.meta.env.VITE_OPENAI_API_KEY || '';
}

export function getAnthropicKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || '';
}

function stripJsonFence(text) {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return m ? m[1].trim() : t;
}

function useDevProxy() {
  return import.meta.env.DEV === true;
}

function ollamaBaseUrl() {
  if (useDevProxy()) {
    return '/ollama-proxy';
  }
  const u = import.meta.env.VITE_OLLAMA_URL || 'http://127.0.0.1:11434';
  return u.replace(/\/$/, '');
}

function ollamaModel() {
  return import.meta.env.VITE_OLLAMA_MODEL || 'llava';
}

async function extractWithOllama({ imageBase64 }) {
  const url = `${ollamaBaseUrl()}/api/chat`;
  const jsonPrompt = `${SYSTEM_PROMPT}

Output a single JSON object only (no markdown). Keys exactly: title, organizer, description, location, category, tags, single_event_date, repeating, next_occurring_date, frequency, days_of_week. Use "" or [] when unknown.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel(),
      stream: false,
      format: 'json',
      messages: [
        {
          role: 'user',
          content: jsonPrompt,
          images: [imageBase64],
        },
      ],
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error || body?.message || res.statusText || 'Ollama request failed';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  const raw = body.message?.content;
  if (!raw) {
    throw new Error('No response from Ollama (is a vision model installed? e.g. ollama pull llava)');
  }
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  try {
    return JSON.parse(stripJsonFence(text));
  } catch {
    return JSON.parse(text);
  }
}

async function extractWithOpenAI({ imageBase64, mediaType }) {
  const devProxy = useDevProxy();
  const url = devProxy
    ? '/openai-proxy/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const headers = { 'Content-Type': 'application/json' };
  if (!devProxy) {
    const k = getOpenAiKey();
    if (!k) {
      throw new Error(
        'Add VITE_OPENAI_API_KEY to .env.local for production builds, or use npm run dev with OPENAI_API_KEY.'
      );
    }
    headers.Authorization = `Bearer ${k}`;
  }

  const payload = {
    model: OPENAI_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mediaType};base64,${imageBase64}`,
            },
          },
          { type: 'text', text: SYSTEM_PROMPT },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'poster_extraction',
        strict: true,
        schema: POSTER_EXTRACTION_SCHEMA,
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const resBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = resBody?.error?.message || res.statusText || 'OpenAI request failed';
    throw new Error(msg);
  }

  const text = resBody.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('No response from OpenAI');
  }
  return JSON.parse(text);
}

async function extractWithAnthropic({ imageBase64, mediaType }) {
  const devProxy = useDevProxy();
  const url = devProxy
    ? '/anthropic-proxy/v1/messages'
    : 'https://api.anthropic.com/v1/messages';
  const headers = {
    'Content-Type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (!devProxy) {
    const k = getAnthropicKey();
    if (!k) {
      throw new Error(
        'Add VITE_ANTHROPIC_API_KEY to .env.local for production builds, or use npm run dev with ANTHROPIC_API_KEY.'
      );
    }
    headers['x-api-key'] = k;
    headers['anthropic-version'] = '2023-06-01';
  }

  const jsonInstruction = `${SYSTEM_PROMPT}\n\nRespond with ONLY a single JSON object (no markdown, no code fences). Keys: title, organizer, description, location, category, tags, single_event_date, repeating, next_occurring_date, frequency, days_of_week. Use "" or [] when unknown.`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            { type: 'text', text: jsonInstruction },
          ],
        },
      ],
    }),
  });

  const resBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = resBody?.error?.message || res.statusText || 'Anthropic request failed';
    throw new Error(msg);
  }

  const text = resBody.content?.find((b) => b.type === 'text')?.text;
  if (!text) {
    throw new Error('No response from Claude');
  }
  return JSON.parse(stripJsonFence(text));
}

/**
 * @param {{ imageBase64: string, mediaType?: string }} opts
 * @returns {Promise<object>}
 */
export async function extractPosterInfoFromImage({ imageBase64, mediaType = 'image/jpeg' }) {
  const provider = (import.meta.env.VITE_POSTER_AUTOFILL_PROVIDER || 'ollama').toLowerCase();
  if (provider === 'openai') {
    return extractWithOpenAI({ imageBase64, mediaType });
  }
  if (provider === 'anthropic') {
    return extractWithAnthropic({ imageBase64, mediaType });
  }
  return extractWithOllama({ imageBase64 });
}

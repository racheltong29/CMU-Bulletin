/**
 * Poster autofill: sends base64 JPEG/PNG to Anthropic Claude by default (or OpenAI if configured).
 *
 * Local dev (`npm run dev`): use ANTHROPIC_API_KEY in .env.local (no VITE_ prefix) — Vite proxies
 * /anthropic-proxy so keys stay off the client. Override: VITE_POSTER_AUTOFILL_PROVIDER=openai + OPENAI_API_KEY.
 *
 * Production: VITE_ANTHROPIC_API_KEY (or VITE_OPENAI_API_KEY); prefer a backend proxy for real secrecy.
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

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText || 'OpenAI request failed';
    throw new Error(msg);
  }

  const text = body.choices?.[0]?.message?.content;
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
  const headers = { 'Content-Type': 'application/json' };
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

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText || 'Anthropic request failed';
    throw new Error(msg);
  }

  const text = body.content?.find((b) => b.type === 'text')?.text;
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
  const provider = (import.meta.env.VITE_POSTER_AUTOFILL_PROVIDER || 'anthropic').toLowerCase();
  if (provider === 'openai') {
    return extractWithOpenAI({ imageBase64, mediaType });
  }
  return extractWithAnthropic({ imageBase64, mediaType });
}

const functions = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const OpenAI = require('openai');

admin.initializeApp();

const openaiApiKey = defineString('OPENAI_API_KEY');
const OPENAI_MODEL = 'gpt-4o-mini';

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

exports.extractPosterInfo = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be logged in to use autofill.');
    }

    const { imageBase64, mediaType = 'image/jpeg' } = request.data;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', 'imageBase64 is required.');
    }

    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'OPENAI_API_KEY is not set. Add functions/.env with OPENAI_API_KEY=sk-... (see README).'
      );
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `Extract event information from this poster image. This is a campus event poster (e.g., for Carnegie Mellon University).

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

    try {
      const response = await openai.chat.completions.create({
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
              { type: 'text', text: prompt },
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
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error('No response from OpenAI');
      }

      return JSON.parse(text);
    } catch (err) {
      console.error('extractPosterInfo error:', err);
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError(
        'internal',
        err.message || 'Failed to extract poster information.'
      );
    }
  }
);

exports.deleteUserPosters = functions.auth.user.onDelete(async (user) => {
  const userId = user.uid;

  // Query for all posters uploaded by the deleted user
  const postersRef = admin.firestore().collection('posters');
  const userPostersQuery = postersRef.where('uploaded_by', '==', userId);

  try {
    const snapshot = await userPostersQuery.get();

    if (snapshot.empty) {
      console.log(`No posters found for user ${userId}.`);
      return null;
    }

    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Successfully deleted ${snapshot.size} posters for user ${userId}.`);
    return null;
  } catch (error) {
    console.error(`Error deleting posters for user ${userId}:`, error);
    return null;
  }
});

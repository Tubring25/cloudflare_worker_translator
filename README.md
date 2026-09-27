# Shortcut Translation

Cloudflare Worker for translating text from iOS Shortcuts. Gemini requests use
the Vertex AI REST API with an API key.

## Google Cloud setup

1. Enable billing and the Vertex AI API (`aiplatform.googleapis.com`) in your Google Cloud project.
2. Obtain an API key authorized to call Vertex AI in that project.
3. Set the following Worker configuration:

| Variable | Purpose |
| --- | --- |
| `VERTEX_API_KEY` | Secret containing your Vertex AI API key |
| `GOOGLE_CLOUD_PROJECT` | Required Google Cloud project ID |
| `GOOGLE_CLOUD_LOCATION` | Vertex location; defaults to `global` |
| `GEMINI_MODEL` | Defaults to the existing `gemini-3-flash-preview`; choose a model available to your project and location |
| `BURN_HAIR_API_TOKEN` | Existing token for the GPT fallback used by `/translate` |

The Worker sends `x-goog-api-key` directly to the project/location Vertex endpoint.
No service account JSON, token exchange or token refresh is needed. Use a key with
access to Vertex AI in the configured project; an AI Studio-only key is not sufficient.
`GOOGLE_GEMINI_API_KEY` and `GOOGLE_SERVICE_ACCOUNT_JSON` are no longer used.
Vertex generation requests time out after 20 seconds.

## Local development

Use Node.js 20+ and pnpm 8 (matching the existing lockfile and deployment workflow).

```sh
pnpm install --frozen-lockfile
```

Create a gitignored `.dev.vars` file:

```dotenv
GOOGLE_CLOUD_PROJECT="your-project-id"
VERTEX_API_KEY="your-vertex-api-key"
BURN_HAIR_API_TOKEN="your-fallback-token"
```

```sh
pnpm dev
```

Run the type check and mocked integration tests (no real API requests):

```sh
pnpm typecheck
pnpm test
```

## Deployment

Set `GOOGLE_CLOUD_PROJECT` and the model/location values in `wrangler.toml`, then upload the API key:

```sh
pnpm exec wrangler secret put VERTEX_API_KEY
pnpm exec wrangler secret put BURN_HAIR_API_TOKEN
pnpm deploy
```

## Shortcut requests

The existing URLs, request fields and successful response fields are unchanged:

- `POST /translate`: Vertex Gemini first, then the existing GPT fallback on failure.
- `POST /translate/gemini`: Vertex Gemini only.

Send a JSON request using the Shortcuts **Get Contents of URL** action:

```json
{"originalText":"Hello world","targetLanguage":"简体中文"}
```

Read `translatedText` from the returned dictionary. `/translate` also returns
`provider: "gemini"` or `provider: "gpt"`; the Gemini-only endpoint retains its
existing response without `provider`.

## References

- [Vertex REST generateContent](https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/projects.locations.publishers.models/generateContent)
- [Vertex API authentication quickstart](https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart)

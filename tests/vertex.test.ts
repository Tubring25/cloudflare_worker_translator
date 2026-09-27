import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import app from '../src/index'

const input = { originalText: 'Hello\nworld', targetLanguage: '简体中文' }
const success = {
  candidates: [{ finishReason: 'STOP', content: { parts: [
    { thought: true, text: 'internal reasoning' },
    { text: '你好\n' }, { text: '世界' },
  ] } }],
}

function environment() {
  return {
    GOOGLE_CLOUD_PROJECT: 'test-project',
    VERTEX_API_KEY: 'fake-vertex-key',
    BURN_HAIR_API_TOKEN: 'fake-fallback-token',
  }
}

function request(env: ReturnType<typeof environment>, route = '/translate/gemini') {
  return app.request(route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }, env)
}

afterEach(() => mock.restoreAll())

test('calls global Vertex directly with the API key and preserves the response', async () => {
  let calls = 0
  mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls++
    assert.ok(init.signal)
    assert.equal(url, 'https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/google/models/gemini-3-flash-preview:generateContent')
    const headers = new Headers(init.headers)
    assert.equal(headers.get('x-goog-api-key'), 'fake-vertex-key')
    assert.equal(headers.has('Authorization'), false)
    const body = JSON.parse(init.body as string)
    assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: input.originalText }] }])
    assert.match(body.systemInstruction.parts[0].text, /简体中文/)
    return Response.json(success)
  })
  const response = await request(environment())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ...input, translatedText: '你好\n世界' })
  assert.equal(calls, 1)
})

test('honors project, regional endpoint and model overrides while preserving provider', async () => {
  const env = { ...environment(), GOOGLE_CLOUD_PROJECT: 'other-project', GOOGLE_CLOUD_LOCATION: 'us-central1', GEMINI_MODEL: 'test-model' }
  mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, 'https://us-central1-aiplatform.googleapis.com/v1/projects/other-project/locations/us-central1/publishers/google/models/test-model:generateContent')
    return Response.json(success)
  })
  const response = await request(env, '/translate')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ...input, translatedText: '你好\n世界', provider: 'gemini' })
})

for (const failure of ['http', 'empty', 'blocked', 'truncated', 'timeout', 'auth'] as const) {
  test(`Vertex ${failure} failure falls back to GPT`, async () => {
    const env = environment()
    let fallbackCalls = 0
    mock.method(console, 'error', () => {})
    mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
      if (url.includes('aiplatform.googleapis.com')) {
        if (failure === 'auth') return Response.json({}, { status: 403 })
        if (failure === 'http') return Response.json({}, { status: 429 })
        if (failure === 'timeout') throw new DOMException('Timed out', 'TimeoutError')
        if (failure === 'empty') return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: ' ' }] } }] })
        if (failure === 'truncated') return Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }] })
        return Response.json({ promptFeedback: { blockReason: 'SAFETY' } })
      }
      assert.equal(url, 'https://burn.hair/v1/chat/completions')
      assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer fake-fallback-token')
      fallbackCalls++
      return Response.json({ choices: [{ message: { content: '备用译文' } }] })
    })
    const response = await request(env, '/translate')
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ...input, translatedText: '备用译文', provider: 'gpt' })
    assert.equal(fallbackCalls, 1)
  })
}

test('Gemini-only endpoint does not call fallback when credentials are invalid or Vertex fails', async () => {
  mock.method(console, 'error', () => {})
  let calls = 0
  mock.method(globalThis, 'fetch', async (url: string) => {
    calls++
    assert.ok(url.startsWith('https://aiplatform.googleapis.com/v1/projects/'))
    return Response.json({}, { status: 403 })
  })
  const invalid = { ...environment(), VERTEX_API_KEY: '' }
  const response = await request(invalid)
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'Failed to translate text' })
  assert.equal(calls, 0)
  assert.equal((await request(environment())).status, 500)
  assert.equal(calls, 1)
})

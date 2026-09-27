import { Hono } from 'hono'
import { translateWithVertex, type VertexEnv } from './vertex'

interface Env extends VertexEnv {
  BURN_HAIR_API_TOKEN: string
}

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => {
  return c.text('Translation API is running')
})

app.post('/translate', async (c) => {
  try {
    const { originalText, targetLanguage } = await c.req.json()
    if (!originalText || !targetLanguage) {
      return c.json({ error: 'Text and target language are required' }, 400)
    }

    // First try Gemini
    try {
      const translatedText = await translateWithVertex(c.env, originalText, targetLanguage)

      return c.json({
        originalText,
        translatedText,
        targetLanguage,
        provider: 'gemini'
      })
    } catch (geminiError) {
      console.error('Gemini translation failed, trying GPT:', geminiError)
      
      // Fallback to GPT
      const response = await fetch('https://burn.hair/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${c.env.BURN_HAIR_API_TOKEN}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Your task is to accurately translate the following text to ${targetLanguage}.`
            },
            {
              role: 'user',
              content: originalText
            }
          ]
        }),
      })

      const data = await response.json() as any
      const translateText = data.choices[0].message.content

      return c.json({
        originalText,
        translatedText: translateText,
        targetLanguage,
        provider: 'gpt'
      })
    }
  } catch (error) {
    console.error('Translation API error:', error)
    return c.json({ error: 'Failed to translate text' }, 500)
  }
})

app.post('/translate/gemini', async (c) => {
  try {
    const { originalText, targetLanguage } = await c.req.json()
    if (!originalText || !targetLanguage) {
      return c.json({ error: 'Text and target language are required' }, 400)
    }
    const translatedText = await translateWithVertex(c.env, originalText, targetLanguage)
    return c.json({
      originalText,
      targetLanguage,
      translatedText
    })
  } catch (error) {
    console.error('Translation API error:', error)
    return c.json({ error: 'Failed to translate text' }, 500)
  }
})

export default app

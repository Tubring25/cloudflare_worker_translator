import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Translation API is running')
})

app.post('/translate', async (c) => {
  try {
    const { originalText, targetLanguage } = await c.req.json()
    console.log(c.req.json())
    if (!originalText || !targetLanguage) {
      return c.json({ error: 'Text and target language are required' }, 400)
    }

    const response = await fetch('https://burn.hair/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${c.env.BURN_HAIR_API_TOKEN}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a translator. Translate the following text to ${targetLanguage}. Only respond with the translation, nothing else.`
          },
          {
            role: 'user',
            content: originalText
          }
        ]
      }),
    })

    const data = await response.json()
    const translateText = data.choices[0].message.content

    return c.json({
      originalText,
      translatedText: translateText,
      targetLanguage
    })
  } catch (error) {
    console.error('Translation API error:', error)
    return c.json({ error: 'Failed to translate text' }, 500)
  }
})

export default app

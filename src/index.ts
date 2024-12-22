import { Hono } from 'hono'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
            content: `You are a professional translator. Your task is to accurately translate the following text to ${targetLanguage}.`
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

app.post('/translate/gemini', async (c) => {
  try {
    const genAI = new GoogleGenerativeAI(c.env.GOOGLE_GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    const { originalText, targetLanguage } = await c.req.json()
    console.log(originalText, targetLanguage, genAI)

    const prompt = `You are a professional translator. Your task is to accurately translate the following text to ${targetLanguage}. 
    Rules:
    1. Maintain the original meaning and tone
    2. Preserve any formatting or special characters
    3. Only output the translation itself, no explanations or notes
    
    Text to translate:
    ${originalText}`;
    const result = await model.generateContent(prompt);
    return c.json({
      originalText,
      targetLanguage,
      translatedText: result.response.text()
    })
  } catch (error) {
    console.error('Translation API error:', error)
    return c.json({ error: 'Failed to translate text' }, 500)
  }
})

export default app

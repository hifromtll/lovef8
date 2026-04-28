import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  let text = '';
  let targetLanguage = 'English';

  try {
    const body = await req.json();

    text = typeof body?.text === 'string' ? body.text.trim() : '';
    targetLanguage =
      typeof body?.targetLanguage === 'string' && body.targetLanguage.trim()
        ? body.targetLanguage.trim()
        : 'English';

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const response = await client.responses.create({
      model: 'gpt-5.4-mini',
      input: `Translate this message to ${targetLanguage}. Return only the translated text:\n\n${text}`,
    });

    const translated = response.output_text?.trim() || text;

    console.log('TRANSLATED:', translated);

    return NextResponse.json({ translated });
  } catch (error) {
    console.error('translate route error:', error);
    return NextResponse.json({ translated: text || '' });
  }
}
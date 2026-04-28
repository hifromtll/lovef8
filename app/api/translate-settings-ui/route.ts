import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TranslateRequestBody = {
  texts?: unknown;
  targetLanguage?: unknown;
};

type TranslationItem = {
  original: string;
  translated: string;
};

function cleanTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TranslateRequestBody;

    const texts = cleanTextArray(body.texts);
    const targetLanguage =
      typeof body.targetLanguage === 'string' ? body.targetLanguage.trim() : '';

    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'targetLanguage is required.' },
        { status: 400 }
      );
    }

    if (texts.length === 0) {
      return NextResponse.json({ translations: [] });
    }

    if (targetLanguage.toLowerCase() === 'english') {
      return NextResponse.json({
        translations: texts.map((text) => ({
          original: text,
          translated: text,
        })),
      });
    }

    const dedupedTexts = Array.from(new Set(texts));

    const prompt = `
You are translating UI text for a dating app settings page.

Translate every item into ${targetLanguage}.

Rules:
- Return valid JSON only.
- Keep the same meaning and tone.
- Keep UI text short and natural.
- Do not explain anything.
- Do not add numbering.
- Do not omit any item.
- Preserve placeholders and examples naturally.
- Preserve brand/product names like LoveF8 exactly.
- Output this exact JSON shape:

{
  "translations": [
    { "original": "Settings", "translated": "..." }
  ]
}
`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: JSON.stringify({
            texts: dedupedTexts,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as {
      translations?: Array<{ original?: unknown; translated?: unknown }>;
    };

    const translatedMap = new Map<string, string>();

    for (const item of parsed.translations ?? []) {
      const original =
        typeof item.original === 'string' ? item.original.trim() : '';
      const translated =
        typeof item.translated === 'string' ? item.translated.trim() : '';

      if (!original) continue;
      translatedMap.set(original, translated || original);
    }

    const finalTranslations: TranslationItem[] = texts.map((text) => ({
      original: text,
      translated: translatedMap.get(text) || text,
    }));

    return NextResponse.json({
      translations: finalTranslations,
    });
  } catch (error) {
    console.error('translate-settings-ui route error:', error);

    return NextResponse.json(
      {
        error: 'Failed to translate settings UI text.',
      },
      { status: 500 }
    );
  }
}
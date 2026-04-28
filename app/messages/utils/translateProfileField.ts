import { supabase } from '@/lib/supabaseClient';

export async function translateProfileField({
  profileId,
  fieldKey,
  originalText,
  targetLanguage,
}: {
  profileId: string;
  fieldKey: string;
  originalText: string;
  targetLanguage: string;
}) {
  console.log('PROFILE FIELD START:', {
    fieldKey,
    originalText,
    targetLanguage,
  });

  if (!originalText || !targetLanguage) {
    console.log('PROFILE FIELD SKIP:', {
      fieldKey,
      reason: !originalText ? 'empty text' : 'missing target language',
    });
    return originalText;
  }

  const { data: existing, error: existingError } = await supabase
    .from('profile_translations')
    .select('translated_text')
    .eq('profile_id', profileId)
    .eq('target_language', targetLanguage)
    .eq('field_key', fieldKey)
    .maybeSingle();

  if (!existingError && existing?.translated_text) {
    console.log('PROFILE FIELD CACHE HIT:', fieldKey);
    return existing.translated_text;
  }

  console.log('PROFILE FIELD API CALL:', fieldKey);

  const res = await fetch('/api/translate-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: originalText,
      targetLanguage,
    }),
  });

  if (!res.ok) {
    console.log('PROFILE FIELD API FAIL:', fieldKey, res.status);
    return originalText;
  }

  const json = await res.json();
  const translated =
    typeof json?.translated === 'string' && json.translated.trim()
      ? json.translated.trim()
      : originalText;

  await supabase.from('profile_translations').upsert(
    {
      profile_id: profileId,
      target_language: targetLanguage,
      field_key: fieldKey,
      translated_text: translated,
    },
    {
      onConflict: 'profile_id,target_language,field_key',
    }
  );

  console.log('PROFILE FIELD SAVED:', fieldKey, translated);

  return translated;
}
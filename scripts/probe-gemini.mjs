/**
 * Quick production Gemini probe (uses Vercel env when run via: npx vercel env run --environment production -- node scripts/probe-gemini.mjs)
 */
const key = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
const preferred = String(process.env.GEMINI_MODEL || '').trim();
const models = [...new Set([
  preferred,
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
].filter(Boolean))];

console.log(`KEY_LEN=${key.length} PREFERRED=${JSON.stringify(preferred)}`);
if (!key) {
  console.error('No GEMINI_API_KEY in env');
  process.exit(2);
}

for (const model of models) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with JSON only: {"ok":true}' }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log(`${model}: FAIL ${String(json?.error?.message || res.status).slice(0, 180)}`);
    } else {
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`${model}: OK ${JSON.stringify(text).slice(0, 80)}`);
    }
  } catch (err) {
    console.log(`${model}: ERR ${err instanceof Error ? err.message : err}`);
  }
}

// ---------------------------------------------------------------------------
// Matrix Operator – Client-side Claude Haiku API Caller
// ---------------------------------------------------------------------------

const FALLBACK_TEXT = '[Signal lost — static on the line]';

/**
 * Call the Claude Haiku API via the local proxy route.
 * Returns the generated text on success, or fallback text on failure.
 */
export async function callHaiku(
  promptType: string,
  context: Record<string, unknown>,
): Promise<string> {
  try {
    const res = await fetch('/api/haiku', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptType, context }),
    });

    if (!res.ok) {
      console.warn(`Haiku API returned ${res.status}`);
      return FALLBACK_TEXT;
    }

    const data = await res.json();
    return data.text ?? FALLBACK_TEXT;
  } catch (err) {
    console.warn('Haiku API call failed:', err);
    return FALLBACK_TEXT;
  }
}

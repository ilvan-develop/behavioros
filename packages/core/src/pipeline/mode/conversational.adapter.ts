// ============================================================
// Conversational Mode Adapter — Skips heavy governance layers
// ============================================================

const SKIPPED_LAYERS = ['domain-invariants', 'decision'];

export function shouldSkipForConversational(layerId: string): boolean {
  return SKIPPED_LAYERS.includes(layerId);
}

// ============================================================
// Transactional Mode Adapter — Executes all layers (no skips)
// ============================================================

export function shouldSkipForTransactional(_layerId: string): boolean {
  return false;
}

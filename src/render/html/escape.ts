/**
 * HTML escaping (Story 4.1, extracted in 4.2 to a shared module).
 *
 * The narrative is LLM output and metric values carry repo-derived data — both
 * untrusted at the render boundary — so EVERY interpolated value is escaped
 * (OWASP A03 / stored-XSS into a shareable artifact). Shared by the renderer and
 * the chart/table modules so there is one escape implementation (no drift, no
 * circular import).
 */

/** Escape the five HTML-significant characters so untrusted text cannot inject markup. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Tiny URL string helpers shared across the provider/license clients.
 */

/**
 * Strip trailing `/` characters in a single linear left-to-right pass.
 *
 * Replaces the `replace(/\/+$/, "")` idiom: an end-anchored `+` quantifier is
 * super-linear under backtracking (SonarQube S5852) on adversarial input, while
 * this scan is unconditionally O(n).
 */
export function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 47 /* "/" */) {
    end -= 1;
  }
  return value.slice(0, end);
}

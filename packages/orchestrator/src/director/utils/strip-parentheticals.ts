/**
 * Strip parentheticals from screenplay dialogue text.
 *
 * Why: the director prompts already instruct the model to remove
 * parentheticals (`(angrily)`, `(O.S.)`, `(V.O.)`, `(CONT'D)`, etc.) from
 * the `text` field of every dialogue line. The model usually obeys, but
 * occasionally a stage direction leaks through and ends up spoken by TTS
 * (issue #218: "smiles angrily" was read aloud before the actual line).
 *
 * This helper is a defense-in-depth regex strip applied at the validation
 * boundary (DialogueLineSchema), so every TTS / alignment / scoring
 * consumer sees the clean text regardless of the model's compliance.
 *
 * Conservative scope:
 *   - Removes `(...)` runs and the surrounding whitespace
 *   - Collapses any resulting double-spaces
 *   - Leaves square brackets and curly braces alone (rare in dialogue)
 *   - Does not attempt nested-paren recovery — `(a (b) c)` strips the
 *     inner first then the outer; net result is the right thing.
 */
export function stripParentheticals(text: string): string {
  if (!text) return text;
  // Repeat until stable so nested parens get fully stripped:
  //   "(angrily) line" → " line" → "line"
  //   "(a (b) c) line" → "(a  c) line" → " line" → "line"
  let prev: string;
  let next = text;
  do {
    prev = next;
    next = prev.replace(/\s*\([^()]*\)\s*/g, ' ');
  } while (next !== prev);
  return next.replace(/\s+/g, ' ').trim();
}

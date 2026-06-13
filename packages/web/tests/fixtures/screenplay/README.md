# Screenplay parser fixture corpus

**Purpose:** Real-user file shapes that have broken or might break our
parseScreenplay pipeline. Each fixture proves the parser handles a class
of inputs that synthetic test strings don't cover.

---

## Why these exist

Today (2026-06-13) we found out our PDF parser hung on Chris's
`DIG - 3 Page Sample 1.0.pdf`. Our unit tests all passed — they mocked
the parser. There's no way for a unit test against a mock to surface
a hang on real PDF structures.

This corpus is the standing answer: each PR that touches
`lib/upload/parse-screenplay.ts` or the unpdf bump runs the integration
test in this directory, which calls the real parser against real files.

---

## What to add

For each net-new file class:

1. The file itself in this directory. Name it descriptively:
   `final-draft-12.pdf`, `highland-2-export.pdf`, `word-with-title-page.docx`, etc.
2. An entry in `corpus.json` describing it (see below).
3. Optional: a stripped/anonymised version of the original — see
   "Anonymising sensitive content" below.

The integration test reads `corpus.json` and iterates every entry.

---

## corpus.json schema

Each entry:

```json
{
  "file": "final-draft-12.pdf",
  "format": "pdf",
  "source": "Final Draft 12 export",
  "expectedMinPageCount": 1,
  "expectedTextContains": ["INT.", "FADE OUT"],
  "anonymised": false,
  "notes": "Title page with form fields — used to hang pdf-parse."
}
```

| Field | Required | Description |
|---|---|---|
| `file` | yes | filename in this directory |
| `format` | yes | `pdf`/`docx`/`fdx`/`fountain`/`txt`/`md` |
| `source` | yes | what produced it (Final Draft 12, Highland 2, Word, manual) |
| `expectedMinPageCount` | yes | parser must report ≥ this |
| `expectedTextContains` | yes | substrings the extracted text must contain |
| `anonymised` | yes | true if names/scenes were scrubbed before commit |
| `notes` | no | free-text context |

---

## Anonymising sensitive content

Real customer scripts can't be committed. Two acceptable shapes:

**Strip-and-replace:** open in a PDF editor, replace character names with
"CHAR_A/CHAR_B", scene headings with "INT. LOCATION_1 - DAY", dialogue
with arbitrary placeholder text of similar length. Preserves the
*structure* (which is what the parser interacts with) while removing the
content. Mark `anonymised: true`.

**Synthesise:** use the same tool to export a short demo script with
totally invented content. No anonymisation step needed. Mark
`anonymised: false`.

The integration test only checks length + scene-heading markers, so
either shape works. The point is to exercise the *parser's behavior on
real tool exports*, not to verify the content.

---

## Current state (2026-06-13)

The corpus starts empty in this PR — only the test harness and
`corpus.json` skeleton are checked in. Real fixtures will be added in
follow-up PRs as we collect them from Chris, Ryan, and our own demo
exports.

Each new fixture PR title should be:

> `test(fixtures): add <source> fixture`

so they're easy to find in the log.

---

## Running locally

```bash
pnpm --filter @story-magic/web test -- --run tests/integration/parse-screenplay-corpus
```

CI runs it on every PR touching `lib/upload/` or the unpdf dep version.

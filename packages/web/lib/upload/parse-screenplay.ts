import mammoth from 'mammoth';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (PDFs can be larger)
const WORDS_PER_PAGE = 250;
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.docx', '.pdf', '.fountain', '.fdx'] as const;

type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export interface ParseResult {
  text: string;
  pageCount: number;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

function sanitizeFilename(filename: string): string {
  // Strip path components and null bytes
  return filename.replace(/[\0]/g, '').replace(/^.*[/\\]/, '');
}

export function getProjectNameFromFilename(filename: string): string {
  const safe = sanitizeFilename(filename);
  const dot = safe.lastIndexOf('.');
  return dot > 0 ? safe.slice(0, dot) : safe;
}

function countPages(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return 0;
  return Math.ceil(wordCount / WORDS_PER_PAGE);
}

/**
 * Injects missing newlines into PDF-extracted screenplay text.
 *
 * unpdf (via pdfjs-dist) sometimes collapses inter-element whitespace when
 * merging text objects from a PDF page, causing scene headings, transitions,
 * and dialogue to run together. This function restores the structural breaks
 * that the downstream block parser relies on without touching already-correct
 * text (all replacements are guarded by a preceding non-newline character).
 */
export function restoreScreenplayLineBreaks(text: string): string {
  return text
    // Scene headings: require an uppercase letter after the prefix so
    // "EXT. door" mid-sentence doesn't trigger a false break.
    .replace(
      /([^\n])(?=INT\. [A-Z]|EXT\. [A-Z]|INT\/EXT\. [A-Z]|INT \/EXT\. [A-Z]|I\/E\. [A-Z])/g,
      '$1\n\n',
    )
    // Transitions: fixed tokens, safe to inject unconditionally when
    // they're not already on their own line.
    .replace(
      /([^\n])(?=FADE OUT\.|FADE IN:|CUT TO:|SMASH CUT|DISSOLVE TO:|WIPE TO:)/g,
      '$1\n',
    )
    // Normalise whitespace — collapse 3+ consecutive newlines left behind
    // by the page-join or by the replacements above.
    .replace(/\n{3,}/g, '\n\n');
}

export async function parseScreenplay(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const safe = sanitizeFilename(filename);
  const ext = getExtension(safe) as AllowedExtension;

  if (!ALLOWED_EXTENSIONS.includes(ext as AllowedExtension)) {
    throw new Error(
      `Unsupported file type "${ext}". Accepted formats: .txt, .md, .docx, .pdf, .fountain, .fdx`
    );
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`
    );
  }

  let text: string;

  switch (ext) {
    case '.txt':
    case '.md':
      text = buffer.toString('utf-8');
      break;
    case '.docx': {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      break;
    }
    case '.pdf': {
      // unpdf (a Node-friendly wrapper around modern pdfjs-dist) replaced
      // pdf-parse, which was unmaintained since ~2018 and hung indefinitely
      // on certain screenplay-tool exports — chris@servicevision.net hit
      // this 2026-06-13 with a 12 KB sample that 524'd at 100s. Dynamic
      // import keeps cold-start fast and matches the prior pattern.
      const { extractText, getDocumentProxy } = await import('unpdf');
      // pdfjs-dist wants a Uint8Array; build one off the underlying buffer
      // without copying.
      const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      // 20s timeout race stays as defense-in-depth — any PDF library can
      // have pathological cases. unpdf claims no hangs but we'd rather
      // fail fast with a clear message than let Cloudflare 524 us out at
      // 100s. Timer is cleared on the happy path so it doesn't outlive
      // the request and trigger a phantom rejection.
      // Race-with-sentinel pattern: the timeout RESOLVES (with a unique
      // symbol) rather than rejecting. That keeps the losing side from
      // surfacing as an unhandled rejection regardless of which branch
      // wins — a plain Promise.race with a rejecting timer flagged the
      // other promise's eventual settlement as unhandled (vitest fails
      // CI on that).
      const TIMEOUT = Symbol('pdf-parse-timeout');
      const parsePromise = (async () => {
        const pdf = await getDocumentProxy(uint8);
        const extracted = await extractText(pdf, { mergePages: false });
        const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
        return restoreScreenplayLineBreaks(pages.join('\n\n'));
      })();
      // Suppress the parse promise's eventual rejection if the timeout
      // wins — pdfjs-dist may throw during teardown after we move on.
      parsePromise.catch(() => {});

      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<typeof TIMEOUT>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(TIMEOUT), 20_000);
      });

      try {
        const result = await Promise.race([parsePromise, timeoutPromise]);
        if (result === TIMEOUT) {
          throw new Error(
            'PDF parse timed out after 20s — the file may be corrupt, scanned, or contain unsupported features. Try pasting the text directly, exporting as .txt/.docx, or saving the PDF as plain text.',
          );
        }
        text = result;
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
      break;
    }
    case '.fountain':
      text = parseFountain(buffer.toString('utf-8'));
      break;
    case '.fdx':
      text = parseFDX(buffer.toString('utf-8'));
      break;
  }

  return {
    text,
    pageCount: countPages(text),
  };
}

/**
 * Strips Fountain title page metadata, inline notes, and boneyard comments.
 * The Fountain spec defines the title page as a block of "Key: Value" lines
 * at the very start of the document, ending at the first blank line that is
 * followed by a line that is NOT a key:value pair.
 */
export function parseFountain(content: string): string {
  if (!content) return '';

  // Normalise line endings
  let text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Strip boneyard block comments /* ... */ (may span lines)
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip inline notes [[ ... ]] (may span lines)
  text = text.replace(/\[\[[\s\S]*?\]\]/g, '');

  // Strip title page: leading key:value block before first blank line
  const lines = text.split('\n');
  const titlePageEnd = detectTitlePageEnd(lines);
  if (titlePageEnd > 0) {
    text = lines.slice(titlePageEnd).join('\n');
  }

  return text.trim();
}

/** Returns the line index immediately after the title page block, or 0. */
function detectTitlePageEnd(lines: string[]): number {
  const keyValueRe = /^[A-Za-z][A-Za-z ]*:\s*.*/;
  let i = 0;
  // Skip leading key:value lines (allow continuation lines indented with whitespace)
  while (i < lines.length && (keyValueRe.test(lines[i]) || (i > 0 && /^\s+/.test(lines[i])))) {
    i++;
  }
  // Must be followed by a blank line separator to count as a valid title page
  if (i === 0 || i >= lines.length || lines[i].trim() !== '') return 0;
  // Skip the blank line(s)
  while (i < lines.length && lines[i].trim() === '') i++;
  return i;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extracts plain text from a Final Draft FDX XML file.
 * FDX has a predictable structure: Paragraph elements contain Text children.
 * Uses regex rather than a full XML parser to avoid adding a dependency.
 * Returns '' on empty input and tolerates malformed XML without throwing.
 */
export function parseFDX(xmlContent: string): string {
  if (!xmlContent.trim()) return '';

  try {
    const paragraphs: string[] = [];

    // Extract each <Paragraph ...>...</Paragraph> block
    const paragraphRe = /<Paragraph[^>]*>([\s\S]*?)<\/Paragraph>/gi;
    let paraMatch: RegExpExecArray | null;

    while ((paraMatch = paragraphRe.exec(xmlContent)) !== null) {
      const paraBody = paraMatch[1];
      // Concatenate all <Text ...>...</Text> nodes within the paragraph
      const textRe = /<Text[^>]*>([\s\S]*?)<\/Text>/gi;
      const parts: string[] = [];
      let textMatch: RegExpExecArray | null;

      while ((textMatch = textRe.exec(paraBody)) !== null) {
        parts.push(decodeXmlEntities(textMatch[1]));
      }

      const line = parts.join('').trim();
      if (line) paragraphs.push(line);
    }

    return paragraphs.join('\n');
  } catch {
    return '';
  }
}

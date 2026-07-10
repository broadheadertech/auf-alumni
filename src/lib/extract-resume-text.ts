/**
 * Client-side resume text extraction (no API key, no server round-trip).
 *
 * Reads the raw text out of an uploaded CV so it can seed the AUF CV editor.
 * "Extract text only" — we pull the plain text and let the alumna organize it
 * into the CV sections; we do NOT try to auto-map fields.
 *
 *   - PDF  → unpdf (bundles a serverless-friendly pdf.js build)
 *   - DOCX → mammoth (raw text)
 *   - TXT / anything else → decode as UTF-8
 *
 * Libraries are imported dynamically so they never touch the initial bundle —
 * they load only when an alumna actually imports a CV.
 */

export type ResumeTextResult = { text: string; chars: number };

function collapseWhitespace(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n") // trailing spaces
    .replace(/\n{3,}/g, "\n\n") // cap blank runs
    .trim();
}

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return value;
}

/**
 * Extract plain text from a resume file's bytes. `filename` selects the
 * decoder by extension. Throws with a friendly message on unreadable input.
 */
export async function extractResumeText(
  buffer: ArrayBuffer,
  filename: string,
): Promise<ResumeTextResult> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  let raw: string;
  try {
    if (ext === "pdf") {
      raw = await extractPdf(buffer);
    } else if (ext === "docx") {
      raw = await extractDocx(buffer);
    } else if (ext === "doc") {
      // Legacy binary .doc isn't reliably readable in the browser.
      throw new Error(
        "Old .doc files can't be read in the browser — re-save as PDF or DOCX.",
      );
    } else {
      raw = new TextDecoder("utf-8").decode(buffer);
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Could not read this file's text.");
  }
  const text = collapseWhitespace(raw);
  if (!text) {
    throw new Error(
      "No text found — the file may be a scanned image with no selectable text.",
    );
  }
  return { text, chars: text.length };
}

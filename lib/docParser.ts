import zlib from "zlib";

/**
 * Extracts a specific file entry from a ZIP archive buffer (.docx is a ZIP container).
 */
export function extractFromZip(zipBuffer: Buffer, targetFileName: string): Buffer | null {
  let offset = 0;
  const targetLower = targetFileName.toLowerCase();

  while (offset < zipBuffer.length - 30) {
    // Check local file header signature: 0x04034b50 (PK\x03\x04)
    if (zipBuffer.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }

    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraFieldLength = zipBuffer.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileName = zipBuffer.toString("utf-8", fileNameStart, fileNameStart + fileNameLength);

    const dataStart = fileNameStart + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (
      fileName.toLowerCase() === targetLower ||
      fileName.toLowerCase().endsWith("/" + targetLower)
    ) {
      const compressedData = zipBuffer.subarray(dataStart, dataEnd);
      if (compressionMethod === 0) {
        return compressedData;
      } else if (compressionMethod === 8) {
        try {
          return zlib.inflateRawSync(compressedData);
        } catch {
          try {
            return zlib.inflateSync(compressedData);
          } catch {
            return null;
          }
        }
      }
    }

    // Skip to next record
    offset = dataEnd;
  }

  // Fallback: search Central Directory if local header compressedSize was 0 (data descriptor flag)
  const cdSignature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  let cdOffset = zipBuffer.indexOf(cdSignature);
  while (cdOffset !== -1 && cdOffset < zipBuffer.length - 46) {
    const compressionMethod = zipBuffer.readUInt16LE(cdOffset + 10);
    const compressedSize = zipBuffer.readUInt32LE(cdOffset + 20);
    const fileNameLength = zipBuffer.readUInt16LE(cdOffset + 28);
    const extraLength = zipBuffer.readUInt16LE(cdOffset + 30);
    const commentLength = zipBuffer.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cdOffset + 42);

    const fileName = zipBuffer.toString("utf-8", cdOffset + 46, cdOffset + 46 + fileNameLength);

    if (
      fileName.toLowerCase() === targetLower ||
      fileName.toLowerCase().endsWith("/" + targetLower)
    ) {
      // Find actual data offset inside local file header
      if (localHeaderOffset < zipBuffer.length - 30) {
        const localFileNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localFileNameLen + localExtraLen;
        const dataEnd = dataStart + compressedSize;
        const compressedData = zipBuffer.subarray(dataStart, dataEnd);

        if (compressionMethod === 0) {
          return compressedData;
        } else if (compressionMethod === 8) {
          try {
            return zlib.inflateRawSync(compressedData);
          } catch {
            try {
              return zlib.inflateSync(compressedData);
            } catch {
              return null;
            }
          }
        }
      }
    }

    cdOffset = zipBuffer.indexOf(cdSignature, cdOffset + 46 + fileNameLength + extraLength + commentLength);
  }

  return null;
}

/**
 * Parses word/document.xml from a .docx file and returns formatted HTML and plain text.
 */
export function parseDocx(buffer: Buffer): { html: string; text: string } {
  try {
    const xmlBuffer = extractFromZip(buffer, "word/document.xml");
    if (!xmlBuffer) {
      return {
        html: "<p>Unable to extract document content from this .docx file.</p>",
        text: "Unable to extract document content.",
      };
    }

    const xml = xmlBuffer.toString("utf-8");
    const paragraphs: string[] = [];
    const textLines: string[] = [];

    // Parse paragraphs <w:p>...</w:p>
    const pRegex = /<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>/g;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pContent = pMatch[1];

      // Check heading style
      const headingMatch = /<w:pStyle\s+[^>]*w:val="Heading(\d)"/i.exec(pContent);
      const isTitle = /<w:pStyle\s+[^>]*w:val="Title"/i.test(pContent);

      // Check if it's a list item
      const isList = /<w:numPr>/i.test(pContent);

      // Parse text runs <w:r>...</w:r>
      const rRegex = /<w:r(?:\s+[^>]*)?>([\s\S]*?)<\/w:r>/g;
      let rMatch: RegExpExecArray | null;
      let paragraphHtml = "";
      let paragraphText = "";

      while ((rMatch = rRegex.exec(pContent)) !== null) {
        const rContent = rMatch[1];
        const isBold = /<w:b(?:\s+[^>]*)?\/>/i.test(rContent);
        const isItalic = /<w:i(?:\s+[^>]*)?\/>/i.test(rContent);
        const isUnderline = /<w:u(?:\s+[^>]*)?\/>/i.test(rContent);

        // Extract text inside <w:t>...</w:t>
        const tRegex = /<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/g;
        let tMatch: RegExpExecArray | null;
        let runText = "";

        while ((tMatch = tRegex.exec(rContent)) !== null) {
          runText += tMatch[1];
        }

        if (runText) {
          paragraphText += runText;
          let formatted = runText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          if (isBold) formatted = `<strong>${formatted}</strong>`;
          if (isItalic) formatted = `<em>${formatted}</em>`;
          if (isUnderline) formatted = `<u>${formatted}</u>`;

          paragraphHtml += formatted;
        }
      }

      if (paragraphText.trim()) {
        textLines.push(paragraphText);

        if (isTitle) {
          paragraphs.push(`<h1>${paragraphHtml}</h1>`);
        } else if (headingMatch) {
          const level = Math.min(Math.max(parseInt(headingMatch[1], 10), 1), 6);
          paragraphs.push(`<h${level}>${paragraphHtml}</h${level}>`);
        } else if (isList) {
          paragraphs.push(`<li>${paragraphHtml}</li>`);
        } else {
          paragraphs.push(`<p>${paragraphHtml}</p>`);
        }
      } else {
        // Empty paragraph: spacing
        paragraphs.push("<p>&nbsp;</p>");
      }
    }

    const html = paragraphs.length > 0 ? paragraphs.join("\n") : "<p>Empty document</p>";
    const text = textLines.join("\n");

    return { html, text };
  } catch (err) {
    return {
      html: `<p>Error parsing .docx document: ${err instanceof Error ? err.message : "Unknown error"}</p>`,
      text: "Error parsing document",
    };
  }
}

/**
 * Extracts readable text from legacy binary Word (.doc) files.
 */
export function parseDoc(buffer: Buffer): { html: string; text: string } {
  try {
    const raw = buffer.toString("binary");
    const extracted: string[] = [];

    // Scan for ASCII text sequences (4+ printable characters)
    const asciiRegex = /[\x20-\x7E\r\n\t]{4,}/g;
    let match: RegExpExecArray | null;

    while ((match = asciiRegex.exec(raw)) !== null) {
      const s = match[0].trim();
      // Filter out binary artifact strings, file headers, and fonts
      if (
        s.length >= 4 &&
        !s.startsWith("WordDocument") &&
        !s.startsWith("Normal.dot") &&
        !s.startsWith("Microsoft Word") &&
        !/^[0-9a-fA-F]{10,}$/.test(s)
      ) {
        extracted.push(s);
      }
    }

    const text = extracted.join("\n\n");
    const html = extracted
      .map(
        (p) =>
          `<p>${p
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</p>`
      )
      .join("\n");

    return {
      html: html || "<p>Unable to extract preview text from legacy .doc file.</p>",
      text: text || "Unable to extract preview text.",
    };
  } catch {
    return {
      html: "<p>Unable to read legacy .doc file format.</p>",
      text: "Unable to read .doc file.",
    };
  }
}

/**
 * Parses CSV or TSV data into headers and rows for spreadsheet display.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1, 1001).map(parseLine); // limit to 1000 rows for high performance

  return { headers, rows };
}

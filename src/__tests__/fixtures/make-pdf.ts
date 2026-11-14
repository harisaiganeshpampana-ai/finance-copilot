// Builds a small, valid text PDF for tests: each line is a list of [x, text] cells, so the
// layout looks like a real bank statement table (columns at fixed positions).

export type PdfLine = [number, string][];

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export function makePdf(pages: PdfLine[][]): Uint8Array {
  const objects: string[] = [];
  const pageIds: number[] = [];
  // 1: catalog, 2: pages, 3: font; then for each page: page object + content stream.
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  let next = 4;
  for (const lines of pages) {
    const pageId = next++;
    const contentId = next++;
    pageIds.push(pageId);
    const ops: string[] = [];
    lines.forEach((cells, row) => {
      const y = 800 - row * 16;
      for (const [x, text] of cells) ops.push(`BT /F1 9 Tf ${x} ${y} Td (${escape(text)}) Tj ET`);
    });
    const stream = ops.join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out, "latin1");
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

/** An HDFC-style PDF statement: Date, Narration, Withdrawal, Deposit, Closing Balance. */
export function hdfcStylePdf(): Uint8Array {
  const header: PdfLine = [
    [40, "Date"],
    [110, "Narration"],
    [330, "Withdrawal Amt."],
    [420, "Deposit Amt."],
    [510, "Closing Balance"],
  ];
  return makePdf([
    [
      [[40, "HDFC BANK LTD"]],
      [[40, "Statement of account  01/10/2026 to 31/10/2026"]],
      header,
      [[40, "01/10/26"], [110, "SALARY OCT ACME TECHNOLOGIES"], [430, "85,000.00"], [520, "1,02,500.00"]],
      [[40, "03/10/26"], [110, "UPI-SWIGGY-SWIGGY@YBL"], [340, "450.50"], [520, "1,02,049.50"]],
      [[110, "ORDER 12345 BANGALORE"]], // description wrapped onto a second line
    ],
    [
      header, // repeated on page 2
      [[40, "15/10/26"], [110, "NETFLIX SUBSCRIPTION"], [340, "649.00"], [520, "1,01,400.50"]],
    ],
  ]);
}

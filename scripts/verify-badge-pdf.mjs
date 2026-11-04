import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";

const fontFiles = [
  "inter-700.woff",
  "manrope-700.woff",
  "montserrat-700.woff",
  "poppins-700.woff",
  "roboto-700.woff",
];

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);

for (const file of fontFiles) {
  const bytes = await readFile(join(process.cwd(), "public", "fonts", file));
  const font = await pdf.embedFont(bytes, { subset: true });
  const page = pdf.addPage();
  page.drawText(`Credencial: João São Paulo (${file})`, { font, size: 18, x: 40, y: 700 });
}

const bytes = await pdf.save();
if (bytes.length === 0) throw new Error("O PDF de validação ficou vazio.");

console.log(`PDF de credencial validado: ${fontFiles.length} fontes e ${bytes.length} bytes.`);

import * as XLSX from "xlsx";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from "docx";

/* =============================================================
   تصدير Excel وWord — مشترك بين صفحات النظام
   ============================================================= */

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** تصدير جدول إلى ملف Excel حقيقي (xlsx) بدل CSV */
export function downloadExcel(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  sheetName = "البيانات",
) {
  const data = [headers, ...rows.map((r) => r.map((v) => v ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.min(
      52,
      Math.max(
        12,
        String(h).length + 4,
        ...rows.slice(0, 250).map((r) => String(r[i] ?? "").length + 2),
      ),
    ),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveBlob(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}

function run(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text,
    rightToLeft: true,
    font: "Arial",
    bold: opts.bold,
    size: opts.size,
    color: opts.color,
  });
}

function para(
  text: string,
  opts: {
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bold?: boolean;
    size?: number;
    color?: string;
  } = {},
) {
  return new Paragraph({
    heading: opts.heading,
    alignment: opts.alignment ?? AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { after: 120 },
    children: [run(text, { bold: opts.bold, size: opts.size, color: opts.color })],
  });
}

function makeTable(headers: string[], rows: (string | number)[][]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          shading: { fill: "E2E8F0", type: ShadingType.CLEAR, color: "auto" },
          verticalAlign: VerticalAlignTable.CENTER,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              bidirectional: true,
              children: [run(String(h), { bold: true, size: 20 })],
            }),
          ],
        }),
    ),
  });

  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: headers.map(
          (_, i) =>
            new TableCell({
              verticalAlign: VerticalAlignTable.CENTER,
              margins: { top: 50, bottom: 50, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  bidirectional: true,
                  children: [run(String(row[i] ?? ""), { size: 20 })],
                }),
              ],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [headerRow, ...bodyRows],
  });
}

async function saveDocx(
  filename: string,
  title: string,
  children: (Paragraph | Table)[],
) {
  const doc = new Document({
    creator: "عدالة",
    title,
    description: "مستند صادر من منصة عدالة",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 24, rightToLeft: true },
          paragraph: {
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveBlob(
    blob,
    filename.endsWith(".docx") ? filename : `${filename}.docx`,
  );
}

/** تصدير جدول إلى Word بتنسيق عربي RTL */
export async function downloadWordTable(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  opts: { subtitle?: string; footer?: string } = {},
) {
  const children: (Paragraph | Table)[] = [
    para(title, {
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      bold: true,
      size: 34,
    }),
  ];

  if (opts.subtitle) {
    children.push(
      para(opts.subtitle, {
        alignment: AlignmentType.CENTER,
        size: 22,
        color: "475569",
      }),
    );
  }

  children.push(
    para(`تاريخ التصدير: ${new Date().toLocaleString("ar-EG")}`, {
      alignment: AlignmentType.CENTER,
      size: 18,
      color: "64748B",
    }),
  );
  children.push(new Paragraph({ text: "" }));
  children.push(makeTable(headers, rows));

  if (opts.footer) {
    children.push(
      new Paragraph({ text: "" }),
      para(opts.footer, {
        alignment: AlignmentType.CENTER,
        size: 18,
        color: "64748B",
      }),
    );
  }

  await saveDocx(filename, title, children);
}

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "LI",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "TABLE",
  "UL",
  "OL",
]);

const HEADING_LEVELS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
};

function tableFromElement(table: HTMLTableElement) {
  const rows = Array.from(table.rows).map((row, rowIndex) => {
    const cells = Array.from(row.cells).map(
      (cell) =>
        new TableCell({
          shading:
            rowIndex === 0
              ? { fill: "E2E8F0", type: ShadingType.CLEAR, color: "auto" }
              : undefined,
          verticalAlign: VerticalAlignTable.CENTER,
          margins: { top: 50, bottom: 50, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              bidirectional: true,
              children: [
                run(cell.innerText.replace(/\s+/g, " ").trim(), {
                  bold: rowIndex === 0,
                  size: 20,
                }),
              ],
            }),
          ],
        }),
    );
    return new TableRow({ tableHeader: rowIndex === 0, children: cells });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows,
  });
}

/**
 * يحوّل عنصر HTML (مثل منطقة الطباعة أو ملف القضية) إلى مستند Word نصي منسّق.
 * يحافظ على العناوين والجداول والفقرات، ويتجاهل الصور والأزرار.
 */
export async function downloadWordFromElement(
  element: HTMLElement,
  filename: string,
  opts: { title?: string; subtitle?: string; footer?: string } = {},
) {
  const children: (Paragraph | Table)[] = [];

  if (opts.title) {
    children.push(
      para(opts.title, {
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        bold: true,
        size: 34,
      }),
    );
  }
  if (opts.subtitle) {
    children.push(
      para(opts.subtitle, {
        alignment: AlignmentType.CENTER,
        size: 22,
        color: "475569",
      }),
    );
  }
  if (opts.title || opts.subtitle) children.push(new Paragraph({ text: "" }));

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (text) children.push(para(text));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName;

    if (["SCRIPT", "STYLE", "SVG", "IMG", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
    if (tag === "BR") {
      children.push(new Paragraph({ text: "" }));
      return;
    }
    if (tag === "TABLE") {
      children.push(tableFromElement(el as HTMLTableElement));
      return;
    }
    if (HEADING_LEVELS[tag]) {
      const text = el.innerText.replace(/\s+/g, " ").trim();
      if (text) {
        children.push(
          para(text, {
            heading: HEADING_LEVELS[tag],
            bold: true,
            size: tag === "H1" ? 30 : tag === "H2" ? 26 : 24,
          }),
        );
      }
      return;
    }

    const hasBlockChild = Array.from(el.children).some((c) =>
      BLOCK_TAGS.has(c.tagName),
    );

    if (!hasBlockChild) {
      const text = el.innerText.replace(/\s+/g, " ").trim();
      if (text) {
        children.push(
          para(text, {
            bold: tag === "STRONG" || tag === "B",
            size: tag === "SMALL" ? 20 : undefined,
          }),
        );
      }
      return;
    }

    for (const child of Array.from(el.childNodes)) walk(child);
  };

  for (const child of Array.from(element.childNodes)) walk(child);

  if (!children.length) {
    const lines = element.innerText.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    for (const line of lines) children.push(para(line));
  }

  if (opts.footer) {
    children.push(
      new Paragraph({ text: "" }),
      para(opts.footer, {
        alignment: AlignmentType.CENTER,
        size: 18,
        color: "64748B",
      }),
    );
  }

  await saveDocx(filename, opts.title || filename, children);
}

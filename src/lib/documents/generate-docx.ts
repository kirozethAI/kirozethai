import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

// Conversor HTML→docx MÍNIMO e deliberado (Fase 15) — não é um parser HTML
// genérico. Os modelos jurídicos só usam um subconjunto pequeno e conhecido
// de tags (h1, h2, p, ul/li, hr, strong, em, br — ver a seed da migration e
// a tela de edição em /juridico/modelos), escrito/editado só por quem
// administra o sistema, não HTML arbitrário de terceiros. Por isso um
// parser via regex é seguro e suficiente aqui — evita depender de uma
// biblioteca de parsing HTML (ou de "html-to-docx", que costuma assumir um
// DOM de navegador e é frágil em ambiente serverless Node) só pra um
// conjunto de tags tão restrito.
//
// Decisão de biblioteca (pedida no escopo): `docx` (dolanmiu/docx) — API
// puramente JS pra montar o .docx programaticamente (Paragraph/TextRun),
// sem binário nativo, roda igual em Node local e na Vercel serverless.

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

type Bloco =
  | { tipo: "h1" | "h2"; texto: string }
  | { tipo: "p"; texto: string }
  | { tipo: "hr" }
  | { tipo: "ul"; itens: string[] };

function parseBlocos(html: string): Bloco[] {
  const blocos: Bloco[] = [];
  const regexBloco =
    /<h1>([\s\S]*?)<\/h1>|<h2>([\s\S]*?)<\/h2>|<ul>([\s\S]*?)<\/ul>|<hr\s*\/?>|<p>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;

  while ((match = regexBloco.exec(html)) !== null) {
    if (match[1] !== undefined) {
      blocos.push({ tipo: "h1", texto: match[1] });
    } else if (match[2] !== undefined) {
      blocos.push({ tipo: "h2", texto: match[2] });
    } else if (match[3] !== undefined) {
      const itens = [...match[3].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
      blocos.push({ tipo: "ul", itens });
    } else if (match[4] !== undefined) {
      blocos.push({ tipo: "p", texto: match[4] });
    } else {
      // Único caso restante na alternação é <hr/> (sem grupo de captura).
      blocos.push({ tipo: "hr" });
    }
  }

  return blocos;
}

// Texto inline de um bloco (dentro de h1/h2/p/li) — strong vira negrito, em
// vira itálico, br vira quebra de linha DENTRO do mesmo parágrafo (mesmo
// efeito visual de um <br/> em HTML), texto puro vira um TextRun normal.
function parseInline(html: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /<strong>([\s\S]*?)<\/strong>|<em>([\s\S]*?)<\/em>|<br\s*\/?>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    if (match[1] !== undefined) {
      runs.push(new TextRun({ text: decodeEntities(match[1]), bold: true }));
    } else if (match[2] !== undefined) {
      runs.push(new TextRun({ text: decodeEntities(match[2]), italics: true }));
    } else if (match[3] !== undefined) {
      runs.push(new TextRun({ text: decodeEntities(match[3]) }));
    } else {
      runs.push(new TextRun({ text: "", break: 1 }));
    }
  }

  return runs;
}

function blocoParaParagraphs(bloco: Bloco): Paragraph[] {
  switch (bloco.tipo) {
    case "h1":
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: parseInline(bloco.texto),
        }),
      ];
    case "h2":
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          children: parseInline(bloco.texto),
        }),
      ];
    case "p":
      return [
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 150 },
          children: parseInline(bloco.texto),
        }),
      ];
    case "hr":
      return [
        new Paragraph({
          spacing: { after: 300 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "999999" },
          },
        }),
      ];
    case "ul":
      return bloco.itens.map(
        (item) =>
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: parseInline(item),
          })
      );
  }
}

// Gera o .docx a partir do mesmo HTML final usado no PDF (Etapa 4) —
// mesmo conteúdo, 2 formatos de saída.
export async function renderHtmlToDocxBuffer(conteudoFinal: string): Promise<Buffer> {
  const blocos = parseBlocos(conteudoFinal);
  const children = blocos.flatMap(blocoParaParagraphs);

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

/*
  build_figure_legends.js — generate Figure_Legends.docx from the authoritative legends.

  The previous file was written by hand and had drifted badly: the Figure S3 legend was still
  a [[bracketed placeholder]] describing screenshots "you need to capture", the Supplementary
  Figure S4 legend was missing entirely, the figure-to-slide table pointed at slide numbers
  from an older deck, Figure 4 was still described as a placeholder to be generated, and the
  author line used "Krishna" where the family name is Chanumolu.

  Nothing here is retyped. Legend text is extracted verbatim from Manuscript_PlantPrimeEditor
  .docx and Supplementary_Data.docx, and the file map is read out of the .pptx itself, so the
  slide numbers and the editable/placed status cannot go stale while the deck changes.

    node analysis/build_figure_legends.js legends.json filemap.json out.docx

  None of those three paths is in this deposit: legends.json and filemap.json are written
  from the manuscript and the figure deck, neither of which is redistributed here. The
  script says so and exits rather than throwing.
*/
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
} = (function () {
  // 'docx' is the one npm dependency in this deposit and it is not vendored, because it is
  // needed only to regenerate the legends document, never to reproduce a number in the paper.
  // Without this guard the script died on a raw MODULE_NOT_FOUND stack trace.
  try { return require('docx'); }
  catch (e) {
    console.error('  this script needs the npm package "docx":  npm install docx');
    console.error('  nothing else in the deposit requires it, and no result in the paper');
    console.error('  depends on running this script.');
    process.exit(1);
  }
})();

const [legendsPath, filemapPath, outPath] = process.argv.slice(2);
// Same courtesy as the docx guard above: say what is missing instead of throwing a raw
// ERR_INVALID_ARG_TYPE stack at someone who ran the script to see what it does.
if (!legendsPath || !filemapPath || !outPath) {
  console.error('usage: node analysis/build_figure_legends.js <legends.json> <filemap.json> <out.docx>');
  console.error('  legends.json is extracted from the manuscript and supplementary;');
  console.error('  filemap.json is read out of the figure deck. Neither is part of this');
  console.error('  deposit, and no result in the paper depends on running this script.');
  process.exit(1);
}
for (const p of [legendsPath, filemapPath]) {
  if (!fs.existsSync(p)) { console.error('  not found: ' + p); process.exit(1); }
}
const L = JSON.parse(fs.readFileSync(legendsPath, 'utf8'));
const FM = JSON.parse(fs.readFileSync(filemapPath, 'utf8'));

const FONT = 'Arial';
const INK = '1F2937';
const MUTED = '6B7280';

const body = (text, opts = {}) => new Paragraph({
  spacing: { after: opts.after === undefined ? 180 : opts.after, line: 276 },
  alignment: AlignmentType.JUSTIFIED,
  children: [new TextRun({ text, font: FONT, size: 20, color: INK })],
});

const legendTitle = (text) => new Paragraph({
  spacing: { before: 240, after: 80 },
  keepNext: true,
  children: [new TextRun({ text, font: FONT, size: 20, bold: true, color: INK })],
});

const section = (text) => new Paragraph({
  spacing: { before: 400, after: 140 },
  children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: INK })],
});

const note = (text) => new Paragraph({
  spacing: { before: 120, after: 120 },
  children: [new TextRun({ text, font: FONT, size: 17, italics: true, color: MUTED })],
});

// ── table: three columns summing to the 9026 DXA text width of A4 at 1in margins ──
const COLW = [1400, 3560, 4066];
const cell = (text, { head = false, bold = false } = {}) => new TableCell({
  width: { size: 0, type: WidthType.DXA },
  shading: head ? { type: ShadingType.CLEAR, fill: 'E8EDF3' } : undefined,
  margins: { top: 60, bottom: 60, left: 110, right: 110 },
  children: [new Paragraph({
    children: [new TextRun({
      text, font: FONT, size: head ? 17 : 16, bold: head || bold, color: INK,
    })],
  })],
});

const rows = [new TableRow({
  tableHeader: true,
  children: [cell('Figure', { head: true }), cell('Editable source', { head: true }),
             cell('Notes', { head: true })],
})];
for (const r of FM) {
  rows.push(new TableRow({ children: [cell(r[0], { bold: true }), cell(r[1]), cell(r[2])] }));
}
const thin = { style: BorderStyle.SINGLE, size: 4, color: 'C9D2DD' };
const fileTable = new Table({
  columnWidths: COLW,
  width: { size: COLW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  borders: { top: thin, bottom: thin, left: thin, right: thin,
             insideHorizontal: thin, insideVertical: thin },
  rows,
});

// ── assemble ──
const kids = [
  new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: 'Plant Prime Editor — Figure legends',
                             font: FONT, size: 30, bold: true, color: INK })],
  }),
  new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text: 'Akhil, Dutta and Chanumolu',
                             font: FONT, size: 20, color: MUTED })],
  }),
  note('Some journals want legends inside the manuscript file, some want them separate, and '
     + 'some want both. This file is the separate version; the same text appears in the '
     + 'manuscript and, for the supplementary items, in Supplementary_Data.docx. The two are '
     + 'generated from one source, so they cannot disagree.'),
  section('Main figures'),
];

for (const k of ['1', '2', '3', '4', '5', '6']) {
  kids.push(legendTitle(L.main[k][0]));
  kids.push(body(L.main[k][1]));
}

kids.push(section('Supplementary figures'));
for (const k of ['Figure S1', 'Figure S2', 'Figure S3', 'Figure S4']) {
  kids.push(legendTitle(L.supp[k][0]));
  kids.push(body(L.supp[k][1]));
}

kids.push(section('Supplementary data'));
kids.push(legendTitle(L.supp['Data S1'][0]));
kids.push(body(L.supp['Data S1'][1]));

kids.push(section('Figure files'));
kids.push(note('Slide numbers and the editable/placed status below are read out of '
             + 'Figures_PlantPrimeEditor.pptx when this file is generated.'));
kids.push(fileTable);
kids.push(note('To export a print-ready figure from the PowerPoint file: select all shapes on '
             + 'the slide, right-click, Save as Picture, and choose SVG or PDF for a vector '
             + 'file. If the journal requires raster, set File → Page Setup to the final '
             + 'figure width first, then export at 600 dpi. Never scale a raster export up '
             + 'after the fact.'));

const doc = new Document({
  creator: 'Plant Prime Editor',
  title: 'Plant Prime Editor — Figure legends',
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: kids,
  }],
});

Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync(outPath, b);
  console.log('  wrote %s  (%d bytes, %d paragraphs, %d table rows)',
              outPath, b.length, kids.length, rows.length);
});

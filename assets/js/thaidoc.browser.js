/**
 * thaidoc.browser.js — สร้างเอกสารราชการไทย (.docx) ในเบราว์เซอร์ ตามระเบียบงานสารบรรณ
 * พอร์ตจาก skill thai-official-docx (scripts/thaidoc.js) — ตรรกะการจัดหน้าเหมือนต้นฉบับทุกประการ:
 *   - แทรก U+200B ตามขอบเขตคำไทย (บรรทัดเต็ม ไม่ห่าง)   - แยกภาษาไทย/อังกฤษรายช่วง (ไม่มีเส้นแดง)
 *   - กล่องกาถูกใช้ Wingdings                          - เส้นใต้หัวบันทึกไม่ยุบรวมกัน
 * ใช้ได้ทั้ง HTML ออฟไลน์ / PHP / Google Apps Script (รันฝั่งเบราว์เซอร์ทั้งหมด ไม่ต้องมีเซิร์ฟเวอร์)
 *
 * ต้องโหลดก่อน: vendor/docx/docx.iife.js (ให้ตัวแปร window.docx)
 * ใช้งาน:  const { R, P, BODY, ... } = ThaiDoc;   ThaiDoc.download([section...], 'ชื่อไฟล์.docx', { title })
 * ใน Node (ทดสอบ):  const ThaiDoc = require('./thaidoc.browser.js');  (ต้อง npm install docx)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('docx'), true);
  else root.ThaiDoc = factory(root.docx, false);
})(typeof self !== 'undefined' ? self : this, function (D, isNode) {
  'use strict';
  if (!D) throw new Error('ThaiDoc: ต้องโหลด vendor/docx/docx.iife.js ก่อน');
  /**
   * thaidoc.js — helpers for building Thai official documents (หนังสือราชการ) with docx-js.
   *
   * Everything here exists to work around three concrete Word behaviours that make
   * naive Thai .docx files look wrong. Read references/troubleshooting.md for the
   * measurements behind each one; the short version:
   *
   *   1. Word does not break a run of Thai text at word boundaries unless a chunk
   *      is too long to fit a line by itself. Lines end early and any justified /
   *      distributed alignment stretches them into gappy text. R() inserts U+200B
   *      at real word boundaries so Word can fill every line.
   *   2. Word proofs a run against w:val regardless of script. One language for the
   *      whole document means either every Thai word or every English word gets a
   *      red squiggle. R() splits each string into Thai and Latin spans and tags
   *      each with its own language.
   *   3. ☐/☑ (U+2610/2611) come out as colour emoji. WD() uses Wingdings instead.
   *
   * Requires: npm install docx   (v9+)
   */
  const {
    Paragraph, TextRun, Table, TableRow, TableCell, WidthType, VerticalMergeType,
    BorderStyle, ShadingType, VerticalAlign, AlignmentType, TabStopType, LeaderType,
    Tab, ImageRun, TableLayoutType, Header, PageNumber, Document, Packer,
  } = D;
  
  // ---------------------------------------------------------------- units + font
  const FONT = 'TH SarabunPSK';                 // ฟอนต์มาตรฐานหนังสือราชการ
  const F = { name: FONT, cs: FONT, eastAsia: FONT, hint: 'cs' };
  const CM = 566.929;                            // twips per cm
  const cm = (n) => Math.round(n * CM);
  const pt = (n) => Math.round(n * 2);           // pt -> half-points for `size`
  const A4 = { width: 11906, height: 16838 };
  
  /** ขอบกระดาษมาตรฐาน: ซ้าย 3 ซม. ขวา 2 ซม. (ระเบียบงานสารบรรณ) */
  const MARGIN_STD = { top: cm(2.0), right: cm(2.0), bottom: cm(2.0), left: cm(3.0), header: cm(1.0), footer: cm(1.0) };
  /** สำหรับหน้าที่มีตารางกว้าง ยอมลดขอบซ้ายลงได้ */
  const MARGIN_WIDE = { top: cm(2.0), right: cm(2.0), bottom: cm(1.6), left: cm(2.5), header: cm(1.0), footer: cm(1.0) };
  
  const contentWidth = (margin) => A4.width - margin.left - margin.right;
  
  // ------------------------------------------------- Thai word-break opportunities
  const _seg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  const _isThai = (c) => c >= '฀' && c <= '๿';
  
  // ICU's Thai dictionary does not know every word, and where it guesses wrong it
  // splits mid-word: วีดิทัศน์ -> วี|ดิ|ทัศน์, บูรณาการ -> บูรณ|า|การ. A break inside a
  // word is bad twice over -- Word may wrap there, and its spell checker then flags
  // the orphaned fragment with a red squiggle. Words listed here get their injected
  // break points removed again. Extend with addProtectedWords() for terms specific
  // to your document (place names, agency names, technical vocabulary).
  const PROTECTED_WORDS = [
    'วีดิทัศน์', 'วิดีทัศน์', 'ศิลปวัฒนธรรม', 'บูรณาการ', 'สารสัมพันธ์', 'กิจกรรม',
    'พินอิน', 'ฮิรางานะ', 'คาตากานะ', 'อิเล็กทรอนิกส์', 'สารสนเทศ', 'นวัตกรรม',
  ];
  let _protectCache = null;
  function _rawInject(text) {
    if (!_seg) return text;
    const parts = [..._seg.segment(text)].map((s) => s.segment);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (i > 0 && _isThai(parts[i - 1].slice(-1)) && _isThai(parts[i][0])) out += '​';
      out += parts[i];
    }
    return out;
  }
  /** เพิ่มคำที่ห้ามตัดกลางคำ (ศัพท์เฉพาะ ชื่อหน่วยงาน ชื่อเฉพาะ ฯลฯ) */
  function addProtectedWords(words) {
    for (const w of [].concat(words)) if (!PROTECTED_WORDS.includes(w)) PROTECTED_WORDS.push(w);
    _protectCache = null;
  }
  /** Insert U+200B at ICU word boundaries. Invisible, zero width, and the only
   *  thing that reliably makes Word fill Thai lines. */
  function zw(text) {
    if (!text) return text;
    let out = _rawInject(text);
    if (_protectCache === null) {
      // ICU splits a word differently depending on its surroundings, so matching the
      // word's standalone injected form is not enough. Allow an optional break point
      // between every character instead, then collapse the whole match back.
      _protectCache = PROTECTED_WORDS.map((w) => [
        new RegExp([...w].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('​?'), 'g'),
        w,
      ]);
    }
    for (const [re, clean] of _protectCache) out = out.replace(re, clean);
    return out;
  }
  
  // ----------------------------------------------------------- per-script runs
  function _splitByScript(text) {
    const re = /[A-Za-z][A-Za-z0-9&'’.\-]*(?:[ ]+[A-Za-z][A-Za-z0-9&'’.\-]*)*/g;
    const out = [];
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ t: text.slice(last, m.index), lang: 'th-TH' });
      out.push({ t: m[0], lang: 'en-US' });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ t: text.slice(last), lang: 'th-TH' });
    return out.length ? out : [{ t: text, lang: 'th-TH' }];
  }
  
  /** Correctly spelled Thai abbreviations that Word's Thai dictionary rejects.
   *  Exempting just these tokens is the same thing a person does with "Ignore All";
   *  it is not the same as switching proofing off for the document. Extend freely. */
  const ABBREVIATIONS = ['สพฐ', 'สพป', 'สพม', 'สพท', 'คศ', 'ปพ', 'ศธ', 'วฐ', 'กพ', 'อ.ก.ค.ศ'];
  
  // Compound words that are spelled correctly but that Word's own Thai dictionary
  // splits and then rejects -- verified by spell-checking them as plain text with no
  // break points inserted at all, so this is Word's limitation, not ours. Unlike the
  // abbreviations above these sit inside longer compounds, so they match anywhere
  // rather than only at a word boundary. Extend with addUncheckedWords().
  const UNCHECKED_WORDS = ['ศิลปวัฒนธรรม', 'วีดิทัศน์', 'วิดีทัศน์', 'ฮิรางานะ', 'คาตากานะ'];
  function addUncheckedWords(words) {
    for (const w of [].concat(words)) if (!UNCHECKED_WORDS.includes(w)) UNCHECKED_WORDS.push(w);
  }
  const _esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // จับได้ทั้งคำย่อ (ต้องอยู่ติดขอบคำ) และคำประสม (อยู่ที่ไหนก็ได้) ในนัดเดียว
  const _skipRe = () =>
    new RegExp(
      '(?:(?:^|(?<=[\\s(“‘]))(' + ABBREVIATIONS.map(_esc).join('|') + ')(?=[.\\s)”’\\d]|$))'
      + '|(' + UNCHECKED_WORDS.map(_esc).join('|') + ')', 'g');
  
  function _mkRun(text, o, lang, skipProof) {
    return new TextRun({
      text,
      font: F,
      size: o.size || pt(16),
      bold: !!o.bold,
      boldComplexScript: !!o.bold,           // w:bCs — without it Thai stays light
      underline: o.underline ? { type: 'single' } : undefined,
      color: o.color,
      language: { value: lang, bidirectional: 'th-TH' },
      noProof: (skipProof || o.noProof) || undefined,
    });
  }
  
  /**
   * Build the runs for one string. Returns an ARRAY — call sites flatten.
   * opts: { size, bold, underline, color, noProof }
   * Use noProof only for label lines that are not sentences (e.g. "P – Plan  คือ  การวางแผน"),
   * which every grammar checker flags as fragments.
   */
  function R(text, o = {}) {
    const t = (text === undefined || text === null) ? '' : String(text);
    if (t === '') return [_mkRun('', o, 'th-TH')];
    const out = [];
    for (const s of _splitByScript(t)) {
      if (s.lang === 'en-US') { out.push(_mkRun(s.t, o, 'en-US')); continue; }
      const re = _skipRe();
      let last = 0, m;
      while ((m = re.exec(s.t)) !== null) {
        const word = m[1] || m[2];
        const at = m.index + m[0].length - word.length;
        if (at > last) out.push(_mkRun(zw(s.t.slice(last, at)), o, 'th-TH'));
        out.push(_mkRun(word, o, 'th-TH', true));
        last = at + word.length;
      }
      if (last < s.t.length) out.push(_mkRun(zw(s.t.slice(last)), o, 'th-TH'));
    }
    return out;
  }
  
  /** Wingdings glyphs — '¨' empty box, 'þ' checked box. */
  function WD(ch, size) {
    return new TextRun({
      text: ch, font: { name: 'Wingdings', cs: 'Wingdings', hint: 'default' },
      size: size || pt(15), noProof: true,
    });
  }
  // สัญลักษณ์ที่ใช้บ่อยในแบบฟอร์มราชการ ทุกตัวเป็นอักขระในฟอนต์ Wingdings
  // อย่าใช้ ☐ ☑ ♦ ✓ แบบ Unicode เพราะ Word จะดึงฟอนต์อิโมจิสีมาแทน
  const BOX = { EMPTY: '¨', CHECKED: 'þ', CROSSED: 'ý', DIAMOND: 't', BIGDIAMOND: 'u', CHECK: 'ü' };
  
  // ---------------------------------------------------------------- paragraphs
  function P(o = {}) {
    const kids = (o.children ? o.children : (o.text !== undefined ? [R(o.text, o)] : [])).flat();
    return new Paragraph({
      children: kids,
      alignment: o.align,
      indent: o.indent,
      spacing: Object.assign(
        { line: o.line || 240, lineRule: 'auto', before: o.before || 0, after: o.after || 0 },
        o.spacing || {}),
      tabStops: o.tabStops,
      border: o.border,
      keepNext: o.keepNext,
      pageBreakBefore: o.pageBreakBefore,
    });
  }
  
  /** ย่อหน้าเนื้อความ: ย่อหน้า 2.5 ซม. + กระจายแบบไทย (ตัวอักษรชิดปกติเพราะ zw() ทำให้บรรทัดเต็ม) */
  const BODY = (text, o = {}) =>
    P(Object.assign({ text, align: AlignmentType.THAI_DISTRIBUTE, indent: { firstLine: cm(2.5) } }, o));
  
  const EMPTY = (n = 1, size = pt(16)) => Array.from({ length: n }, () => P({ text: '', size }));
  
  /** เส้นประให้เติมข้อความ. Uses a dot-leader tab, NOT a paragraph bottom border:
   *  Word merges the borders of consecutive identically-bordered paragraphs into
   *  one rule, so three bordered paragraphs render as a single line. */
  function DOTLINE(o = {}) {
    return new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: o.width || 9026, leader: LeaderType.DOT }],
      spacing: { line: 240, lineRule: 'auto', before: o.before || 0, after: o.after || 0 },
      indent: o.indent,
      children: [new TextRun({ children: [new Tab()], font: F, size: o.size || pt(16) })],
    });
  }
  
  /** "รายวิชา ............ จำนวน 1 ชั่วโมง/สัปดาห์" — left text, tab, right text. */
  function TABLINE(left, right, o = {}) {
    return new Paragraph({
      tabStops: [{ type: TabStopType.LEFT, position: o.pos || cm(11.0) }],
      indent: o.indent || { left: cm(1.6) },
      spacing: { line: o.line || 240, lineRule: 'auto', before: 0, after: 0 },
      children: [R(left, o), new TextRun({ children: [new Tab()], font: F, size: o.size || pt(16) }), R(right, o)].flat(),
    });
  }
  
  /** บรรทัดสารบัญ พร้อมจุดไข่ปลานำเลขหน้า */
  function TOCLINE(left, page, o = {}) {
    return new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: o.pos || cm(15.8), leader: LeaderType.DOT }],
      spacing: { line: o.line || 300, lineRule: 'auto', before: 60, after: 60 },
      indent: o.indent,
      children: [R(left, o), new TextRun({ children: [new Tab()], font: F, size: o.size || pt(16) }), R(page, o)].flat(),
    });
  }
  
  // -------------------------------------------------------------------- tables
  const TB = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const ALL_BORDERS = { top: TB, bottom: TB, left: TB, right: TB, insideHorizontal: TB, insideVertical: TB };
  const NO_BORDERS = Object.fromEntries(
    ['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical'].map((k) => [k, { style: BorderStyle.NONE }]));
  const CELLMARGIN = { top: 40, bottom: 40, left: 70, right: 70 };
  
  /** Cell paragraphs. Each line: a string, {t,bold,align,indent}, or {runs:[{t,bold}]} for mixed weight. */
  function cellPars(lines, o = {}) {
    const size = o.size || pt(14);   // tables usually drop to 14 pt so columns fit
    return lines.map((l) => {
      if (typeof l === 'string') l = { t: l };
      const common = {
        align: l.align || o.align || AlignmentType.LEFT,
        indent: l.indent !== undefined ? l.indent : o.indent,
        spacing: { before: l.before || 0, after: l.after === undefined ? 20 : l.after },
        line: 240,
      };
      if (l.runs) {
        return P(Object.assign({ children: l.runs.map((r) => (r.wingdings
          ? [WD(r.t, r.size || size)]
          : R(r.t, { size: r.size || size, bold: r.bold }))).flat() }, common));
      }
      return P(Object.assign({ text: l.t, size: l.size || size, bold: l.bold || o.bold }, common));
    });
  }
  
  /** One cell. opts: { width, fill, valign, merge, size, bold, align, indent } */
  function TD(lines, o = {}) {
    return new TableCell({
      width: { size: o.width, type: WidthType.DXA },
      margins: o.margins || CELLMARGIN,
      verticalAlign: o.valign || VerticalAlign.TOP,
      shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
      verticalMerge: o.merge,
      children: o.merge === VerticalMergeType.CONTINUE ? [P({ text: '', size: o.size || pt(14) })] : cellPars(lines, o),
    });
  }
  
  /** hanging-indent helpers for cell content */
  const BULLET = (t, extra = {}) => Object.assign({ t: '- ' + t, indent: { left: 170, hanging: 170 } }, extra);
  const NUMBER = (i, t, extra = {}) => Object.assign({ t: i + '. ' + t, indent: { left: 200, hanging: 200 } }, extra);
  
  // ------------------------------------------------------- headers / memo block
  /** กล่องเลขหน้ามุมขวาบน เช่น "หน้า ๓" หรือ "PA1/ส" */
  function pageBox(children, width = 1100) {
    return new Table({
      alignment: AlignmentType.RIGHT,
      layout: TableLayoutType.FIXED,
      columnWidths: [width],
      rows: [new TableRow({ children: [new TableCell({
        width: { size: width, type: WidthType.DXA },
        margins: { top: 20, bottom: 20, left: 60, right: 60 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240, lineRule: 'auto' }, children: children.flat() })],
      })] })],
    });
  }
  const headerText = (t, size) => new Header({ children: [pageBox(R(t, { size: size || pt(14) }))] });
  const headerAutoPage = (label = 'หน้า ', size) => new Header({ children: [pageBox([
    R(label, { size: size || pt(14) }).flat(),
    new TextRun({ children: [PageNumber.CURRENT], font: F, size: size || pt(14) }),
  ].flat())] });
  const headerBlank = () => new Header({ children: [P({ text: '', size: 2 })] });
  
  /**
   * หัว "บันทึกข้อความ": ครุฑ 1.5 ซม. ชิดซ้าย + คำว่า บันทึกข้อความ 29 pt ตัวหนา กึ่งกลางหน้ากระดาษ.
   * Laid out as a 3-column borderless table so the title centres on the PAGE, not
   * on the space left of the emblem.
   * garudaPng: Buffer of assets/garuda.png
   */
  function memoHeading(garudaPng, width) {
    const side = 1400;
    return new Table({
      layout: TableLayoutType.FIXED,
      columnWidths: [side, width - side * 2, side],
      borders: NO_BORDERS,
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: side, type: WidthType.DXA }, margins: { left: 0, right: 0 }, verticalAlign: VerticalAlign.TOP,
          children: [P({ align: AlignmentType.LEFT, children: [new ImageRun({ type: 'png', data: garudaPng, transformation: { width: 52, height: 56 } })] })] }),
        new TableCell({ width: { size: width - side * 2, type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM,
          children: [P({ text: 'บันทึกข้อความ', bold: true, size: pt(29), align: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: side, type: WidthType.DXA }, children: [P({ text: '', size: 20 })] }),
      ] })],
    });
  }
  
  /**
   * บรรทัดหัวเรื่อง (ส่วนราชการ / ที่ / วันที่ / เรื่อง) พร้อมเส้นใต้เต็มความกว้าง
   *
   * Word merges consecutive paragraphs that carry an *identical* bottom border
   * into one bordered block and draws the rule only once, at the end of the block.
   * Three field lines therefore come out with a single rule under the last one --
   * and because the paragraphs still occupy the right space, it is easy to miss
   * until someone looks at the printed page. Alternating the border colour by one
   * imperceptible step (000000 / 010101) makes each paragraph its own block, so
   * every field keeps its own underline. Verified by counting rules in the render.
   */
  let _fieldSeq = 0;
  function memoField(children, o = {}) {
    const shade = o.color || ((_fieldSeq++ % 2) ? '010101' : '000000');
    return new Paragraph({
      children: children.flat(),
      spacing: { before: o.before || 20, after: o.after || 20, line: 240, lineRule: 'auto' },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: shade } },
      tabStops: o.tabStops,
    });
  }
  /** เริ่มนับสีเส้นใหม่ เผื่อสร้างหลายเอกสารในสคริปต์เดียว */
  const resetMemoFields = () => { _fieldSeq = 0; };
  /** ป้ายกำกับหัวเรื่อง ขนาด 20 pt ตัวหนา ตามระเบียบ */
  const memoLabel = (t) => R(t, { bold: true, size: pt(20) });
  
  // ------------------------------------------------------------------ document
  /** โหมดทดลองใช้ (vs-demo.js / vipsys): ทุกหน้ามีหัวกระดาษ "ฉบับทดลองใช้" — ฉบับที่ซื้อแล้วไม่มี */
  function demoActive() {
    if (isNode || typeof window === 'undefined') return false;
    try { return window.VSDemo ? !!window.VSDemo.active : !!window.VS_DEMO; } catch (e) { return false; }
  }
  function demoMark(sections) {
    const mark = () => new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 60 },
      children: R('ฉบับทดลองใช้ — สร้างจากระบบทดลอง System ห้องสื่อครูคอม', { size: pt(12), bold: true, color: 'C0392B', noProof: true }),
    });
    return sections.map((s) => {
      const h = Object.assign({}, s.headers || {});
      ['default', 'first', 'even'].forEach((k) => {
        if (k !== 'default' && !h[k]) return;
        const old = (h[k] && h[k].options && h[k].options.children) || [];
        h[k] = new Header({ children: [mark(), ...old] });
      });
      return Object.assign({}, s, { headers: h });
    });
  }

  /** Wrap sections in a Document whose defaults already carry the Thai font+language. */
  function makeDoc(sections, meta = {}) {
    if (demoActive()) sections = demoMark(sections);
    return new Document({
      creator: meta.creator || '',
      title: meta.title || '',
      description: meta.description || '',
      styles: { default: { document: {
        run: { font: F, size: pt(16), language: { value: 'th-TH', bidirectional: 'th-TH' } },
        paragraph: { spacing: { line: 240, lineRule: 'auto' } },
      } } },
      sections,
    });
  }

  // ================================================================ ฝั่งเบราว์เซอร์
  const GARUDA_B64 = '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';
  /** ตราครุฑ (สูง 1.5 ซม.) เป็น Uint8Array สำหรับ memoHeading() */
  function garuda() {
    if (isNode) return Buffer.from(GARUDA_B64, 'base64');
    const bin = atob(GARUDA_B64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  const toBlob = (doc) => Packer.toBlob(doc);
  /** ดาวน์โหลดไฟล์ .docx — sections: array ของ section (หรือส่ง Document ที่ makeDoc แล้ว) */
  async function download(sectionsOrDoc, filename, meta) {
    const doc = Array.isArray(sectionsOrDoc) ? makeDoc(sectionsOrDoc, meta || {}) : sectionsOrDoc;
    const name = String(filename || 'เอกสาร.docx').replace(/[\\/:*?"<>|]+/g, '').replace(/(\.docx)?$/i, '.docx');
    if (isNode) { const fs = require('fs'); fs.writeFileSync(name, await Packer.toBuffer(doc)); return name; }
    const blob = await toBlob(doc);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return name;
  }
  /** Node เท่านั้น: บันทึกไฟล์ */
  const save = (doc, path) => Packer.toBuffer(doc).then((b) => { require('fs').writeFileSync(path, b); return path; });

  // ============================================ ตัวช่วยระดับสูง (ใช้ซ้ำทุกระบบ)
  const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  /** เลขไทย: thaiNum('2569') → '๒๕๖๙' */
  const thaiNum = (s) => String(s).replace(/[0-9]/g, (d) => TH_DIGITS[+d]);
  /** วันที่แบบราชการ: thaiDate(new Date()) → '18 ตุลาคม พ.ศ. 2569' · {era:false} → '18 ตุลาคม 2569' (ช่องวันที่บันทึกข้อความ) · {thaiDigits:true} ใช้เลขไทย */
  function thaiDate(d, o = {}) {
    const x = d instanceof Date ? d : new Date(d);
    if (isNaN(x)) return '';
    const s = x.getDate() + ' ' + TH_MONTHS[x.getMonth()] + (o.era === false ? ' ' : ' พ.ศ. ') + (x.getFullYear() + 543);
    return o.thaiDigits ? thaiNum(s) : s;
  }

  /** บล็อกลงนาม (กึ่งกลางครึ่งขวาของหน้า) — { name, position, prefix:'ลงชื่อ', date:true|string, left } */
  function signBlock(o = {}) {
    const left = o.left !== undefined ? o.left : cm(6.5);
    const C = AlignmentType.CENTER;
    const rows = [
      P({ text: (o.prefix || 'ลงชื่อ') + '................................................' + (o.suffix || ''), align: C, indent: { left }, keepNext: true }),
      P({ text: '(' + (o.name || '................................................') + ')', align: C, indent: { left }, keepNext: true }),
    ];
    if (o.position !== false) rows.push(P({ text: 'ตำแหน่ง ' + (o.position || '................................................'), align: C, indent: { left }, keepNext: !!o.date }));
    if (o.date) rows.push(P({ text: typeof o.date === 'string' ? o.date : '........../........../..........', align: C, indent: { left } }));
    return rows;
  }

  /**
   * บันทึกข้อความ 1 ฉบับ (section) ตามระเบียบงานสารบรรณ
   * { agency, docNo, date, subject, to, paragraphs:[string], signer:{name,position}, after:[...children] }
   * ค่าที่ไม่รู้ให้เว้นว่าง → ระบบเติมจุดไข่ปลาให้ผู้ใช้กรอกเอง (ห้ามเดาเลขที่หนังสือ/ตัวเลข)
   */
  function memo(o = {}) {
    const W = contentWidth(MARGIN_STD);
    const dots = (v, n) => (v && String(v).trim()) ? String(v) : '.'.repeat(n || 40);
    return {
      properties: { page: { size: A4, margin: MARGIN_STD } },
      children: [
        memoHeading(garuda(), W),
        memoField([memoLabel('ส่วนราชการ'), R('  ' + dots(o.agency, 60))]),
        memoField([memoLabel('ที่'), R('  ' + dots(o.docNo, 20)), R('                              '), memoLabel('วันที่'), R('  ' + dots(o.date, 30))]),
        memoField([memoLabel('เรื่อง'), R('  ' + dots(o.subject, 60))]),
        ...EMPTY(1, 10),
        P({ children: [memoLabel('เรียน'), R('  ' + dots(o.to, 40))] }),
        ...(o.paragraphs || []).map((t) => BODY(t)),
        ...EMPTY(1, 20),
        ...signBlock(Object.assign({ position: (o.signer || {}).position }, o.signer || {})),
        ...(o.after || []),
      ],
    };
  }

  /**
   * รายงานแบบตาราง (section) — หัวรายงานกึ่งกลาง + ตารางเส้นทึบ หัวตารางสีเทา D9D9D9 + ช่องลงนาม
   * { title, subtitle:[string], columns:[{label, width(ซม.), align:'left'|'center'|'right'}], rows:[[cell...]],
   *   landscape, signers:[{label, name, position}], pageNumbers:true, note }
   * ความกว้างคอลัมน์รวมต้อง ≤ ความกว้างเนื้อหา (แนวตั้ง 16 ซม. / แนวนอน 24.7 ซม. เมื่อใช้ขอบมาตรฐาน)
   */
  function reportTable(o = {}) {
    const landscape = !!o.landscape;
    const margin = landscape ? { top: cm(2.0), right: cm(2.0), bottom: cm(1.6), left: cm(2.5), header: cm(1.0), footer: cm(1.0) } : MARGIN_STD;
    const pageW = landscape ? A4.height : A4.width;
    const W = pageW - margin.left - margin.right;
    const cols = o.columns || [];
    let widths = cols.map((c) => cm(c.width || 3));
    const sum = widths.reduce((a, b) => a + b, 0);
    widths = widths.map((w) => Math.floor(w * W / sum));          // ปรับให้รวมเท่าความกว้างเนื้อหาพอดี
    widths[widths.length - 1] += W - widths.reduce((a, b) => a + b, 0);
    const AL = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT };
    const head = new TableRow({ tableHeader: !!o.repeatHeader, children: cols.map((c, i) => TD([{ t: c.label, bold: true, align: AlignmentType.CENTER }], { width: widths[i], fill: 'D9D9D9', valign: VerticalAlign.CENTER })) });
    const body = (o.rows || []).map((r) => new TableRow({ children: cols.map((c, i) => {
      const v = r[i];
      const lines = Array.isArray(v) ? v : [v === null || v === undefined ? '' : String(v)];
      return TD(lines.map((t) => (typeof t === 'object' ? t : { t: String(t) })), { width: widths[i], align: AL[c.align] || AlignmentType.LEFT });
    }) }));
    const table = new Table({ layout: TableLayoutType.FIXED, columnWidths: widths, borders: ALL_BORDERS, rows: [head, ...body] });
    const children = [
      P({ text: o.title || 'รายงาน', bold: true, size: pt(18), align: AlignmentType.CENTER }),
      ...(o.subtitle || []).map((s) => P({ text: s, align: AlignmentType.CENTER })),
      ...EMPTY(1, 10),
      table,
    ];
    if (o.note) children.push(...EMPTY(1, 10), P({ text: o.note, size: pt(14) }));
    if (o.signers && o.signers.length) {
      children.push(...EMPTY(1, 20));
      // ช่องลงนามหลายคน: ตารางไร้เส้น แบ่งเท่า ๆ กัน
      const n = o.signers.length, cw = Math.floor(W / n);
      children.push(new Table({ layout: TableLayoutType.FIXED, columnWidths: Array(n).fill(cw), borders: NO_BORDERS, rows: [new TableRow({ children: o.signers.map((s) => new TableCell({
        width: { size: cw, type: WidthType.DXA }, borders: NO_BORDERS,
        children: [
          P({ text: 'ลงชื่อ.......................................', align: AlignmentType.CENTER }),
          P({ text: '(' + (s.name || '.......................................') + ')', align: AlignmentType.CENTER }),
          P({ text: s.position || s.label || '', align: AlignmentType.CENTER }),
        ],
      })) })] }));
    }
    return {
      properties: { page: { size: landscape ? { width: A4.height, height: A4.width, orientation: D.PageOrientation.LANDSCAPE } : A4, margin, pageNumbers: o.pageNumbers ? { start: 1 } : undefined } },
      headers: o.pageNumbers ? { default: headerAutoPage() } : undefined,
      children,
    };
  }

  return {
    D, FONT, F, CM, cm, pt, A4, MARGIN_STD, MARGIN_WIDE, contentWidth,
    zw, addProtectedWords, PROTECTED_WORDS, R, WD, BOX, P, BODY, EMPTY, DOTLINE, TABLINE, TOCLINE,
    TB, ALL_BORDERS, NO_BORDERS, CELLMARGIN, cellPars, TD, BULLET, NUMBER,
    pageBox, headerText, headerAutoPage, headerBlank,
    memoHeading, memoField, memoLabel, resetMemoFields, ABBREVIATIONS,
    UNCHECKED_WORDS, addUncheckedWords, makeDoc,
    garuda, toBlob, download, save, thaiNum, thaiDate, signBlock, memo, reportTable,
  };
});

/* =====================================================================
   รายงานราชการ (.docx ผ่าน ThaiDoc เท่านั้น) + ตัวอย่าง HTML บนจอ (official-print.css)
   รายงานทุกชนิดสร้างจาก "แบบจำลองรายงาน" เดียวกัน → docx และ HTML ตรงกันเสมอ
     1) แบบบันทึกผลการประเมินรายห้อง (A4 แนวนอน)
     2) แบบบันทึกคะแนนรายชิ้นงาน (A4 แนวนอน)
     3) บัญชีรายชื่อนักเรียนที่ต้องซ่อมเสริม (A4 แนวตั้ง)
     4) บันทึกข้อความรายงานผล + ตารางสรุปรายห้อง/ระดับชั้น/รายด้าน (A4)
   ใช้ได้ทั้งเบราว์เซอร์และ Node (dev/build-docs.js → audit.js)
   ค่าที่ไม่มีในข้อมูล (เลขที่หนังสือ ชื่อผู้ลงนาม ฯลฯ) เว้นจุดไข่ปลาเสมอ — ห้ามเดา
   ===================================================================== */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./presets.js'));
    else root.Docs = factory(root.Core, root.Presets);
})(typeof self !== 'undefined' ? self : this, function (Core, Presets) {
    'use strict';

    const C = Core;
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const DOTS = (n) => '.'.repeat(n);
    const dots = (v, n) => (v && String(v).trim() ? String(v) : DOTS(n));
    const fmt = (n) => Number(n || 0).toLocaleString('en-US');
    const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const memoDate = (d) => `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
    const fullName = (s) => (s ? `${s.prefix || ''}${s.firstName || ''}${s.lastName ? ` ${s.lastName}` : ''}`.trim() : '');
    const thaiList = (arr) => (arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join(' ')} และ ${arr[arr.length - 1]}`);
    const p2 = (v) => C.pctText(v);
    const LV = C.LV;

    /* ---------- รวบรวมข้อมูล ---------- */
    function context(data, classes, term) {
        const t = String(term || data.school.semester || '1');
        const names = (classes && classes.length ? classes : data.classes.map((c) => c.name)).filter((n) => data.classes.some((c) => c.name === n));
        const list = names.map((n) => Object.assign(C.classResult(data, n, t), { info: data.classes.find((c) => c.name === n) || { name: n } }));
        const merged = C.mergeResults(list);
        const tpl = Object.assign({}, Presets.TEMPLATE, data.tpl || {});
        const year = data.school.academicYear || DOTS(8);
        const termFull = `ภาคเรียนที่ ${t} ปีการศึกษา ${year}`;
        const rg = C.cutRanges(data.criteria.cut);
        const n = merged.rows.length;
        const good = merged.count.total[3] + merged.count.total[2];
        const vars = {
            โรงเรียน: data.school.name || 'โรงเรียน', ภาคเรียน: t, ปีการศึกษา: year, ภาคเรียนเต็ม: termFull,
            ขอบเขต: names.length === 1 ? `ชั้น ${names[0]}` : `ชั้น ${thaiList(names)}`, จำนวน: fmt(n),
            ดีขึ้นไป: fmt(good), ร้อยละดีขึ้นไป: C.pctOf(good, n), ซ่อมเสริม: fmt(merged.remedial.length),
            ช่วงดีเยี่ยม: rg[3], ช่วงดี: rg[2], ช่วงผ่าน: rg[1], ช่วงไม่ผ่าน: rg[0],
        };
        return { data, school: data.school, tpl, term: t, termFull, classes: list, merged, vars, criteria: data.criteria };
    }
    const fill = (ctx, text) => Presets.fill(text, ctx.vars);
    const weightText = (ctx) => `น้ำหนักคะแนน: ${C.ASPECTS.map((a) => `${a.name} ร้อยละ ${ctx.criteria.weights[a.id] || 0}`).join('  ')}`;
    const countLine = (cnt, n) => `${LV.map((l) => `${C.LEVEL[l].name} ${cnt[l]} คน (ร้อยละ ${C.pctOf(cnt[l], n)})`).join('  ')}${cnt.none ? `  ยังไม่มีคะแนน ${cnt.none} คน` : ''}`;

    /* =================== แบบจำลองรายงาน =================== */
    /** 1) แบบบันทึกผลรายห้อง */
    function recordModels(ctx) {
        return ctx.classes.map((k) => {
            const cols = [
                { label: 'เลขที่', w: 1.1, c: 1 }, { label: 'ชื่อ - สกุล', w: 5.6 },
                ...C.ASPECTS.flatMap((a) => [{ label: `${a.name} (ร้อยละ)`, w: 2.0, c: 1 }, { label: 'ระดับ', w: 1.7, c: 1 }]),
                { label: 'รวมถ่วงน้ำหนัก (ร้อยละ)', w: 2.3, c: 1 }, { label: 'ผลการประเมิน', w: 2.2, c: 1 },
            ];
            const rows = k.rows.map(({ st, r }) => ({
                cells: [String(st.no ?? ''), fullName(st), ...C.IDS.flatMap((a) => [p2(r.aspects[a].pct), r.aspects[a].level == null ? '-' : C.LEVEL[r.aspects[a].level].name]), p2(r.total), C.levelName(r.level)],
                bad: r.remedial,
            }));
            const n = k.rows.length;
            return {
                kind: 'record', landscape: true,
                title: ctx.tpl.recordTitle,
                subs: [`ชั้น ${k.cls}  ${ctx.termFull}`, ctx.school.name || DOTS(50)],
                cols, rows,
                empty: 'ยังไม่มีนักเรียนในห้องนี้',
                notes: [`สรุป: นักเรียน ${n} คน  ${countLine(k.count.total, n)}`, fill(ctx, ctx.tpl.refText), weightText(ctx)],
                signers: [
                    { name: (k.info || {}).teacher, position: ctx.tpl.teacherPos },
                    { name: ctx.school.measureHead, position: ctx.tpl.measurePos },
                    { name: ctx.school.director, position: ctx.tpl.directorPos },
                ],
            };
        });
    }

    /** 2) แบบบันทึกคะแนนรายชิ้นงาน */
    function scoreModels(ctx) {
        return ctx.classes.map((k) => {
            const tasks = k.tasks;
            const tw = tasks.length > 6 ? 1.6 : 2.2;
            const cols = [
                { label: 'เลขที่', w: 1.1, c: 1 }, { label: 'ชื่อ - สกุล', w: 5.4 },
                ...tasks.map((t, i) => ({ label: `${i + 1}. ${t.title} (เต็ม ${C.IDS.reduce((a, x) => a + (Number(t.max[x]) || 0), 0)})`, w: tw, c: 1, small: true })),
                { label: 'อ่าน', w: 1.5, c: 1 }, { label: 'คิด', w: 1.5, c: 1 }, { label: 'เขียน', w: 1.5, c: 1 }, { label: 'ร้อยละ', w: 1.7, c: 1 },
            ];
            const rows = k.rows.map(({ st, r }) => ({
                cells: [String(st.no ?? ''), fullName(st), ...tasks.map((t) => {
                    const sc = (ctx.data.scores[t.id] || {})[st.id] || {};
                    const has = C.IDS.some((a) => (Number(t.max[a]) || 0) > 0 && C.isNum(sc[a]));
                    return has ? String(C.IDS.reduce((a, x) => a + (C.isNum(sc[x]) && Number(t.max[x]) > 0 ? Number(sc[x]) : 0), 0)) : '-';
                }), ...C.IDS.map((a) => (r.aspects[a].max ? `${r.aspects[a].got}/${r.aspects[a].max}` : '-')), p2(r.total)],
                bad: r.remedial,
            }));
            return {
                kind: 'score', landscape: true,
                title: ctx.tpl.scoreTitle,
                subs: [`ชั้น ${k.cls}  ${ctx.termFull}`, ctx.school.name || DOTS(50)],
                cols, rows,
                empty: 'ยังไม่มีนักเรียนในห้องนี้',
                notes: [tasks.length ? `ชิ้นงาน: ${tasks.map((t, i) => `${i + 1}) ${t.title} (อ่าน ${t.max.read || 0} คิด ${t.max.think || 0} เขียน ${t.max.write || 0})`).join('  ')}` : 'ยังไม่มีชิ้นงานในภาคเรียนนี้', '- = ยังไม่ได้บันทึกคะแนน'],
                signers: [{ name: (k.info || {}).teacher, position: ctx.tpl.teacherPos }, { name: ctx.school.measureHead, position: ctx.tpl.measurePos }],
            };
        });
    }

    /** 3) บัญชีรายชื่อซ่อมเสริม */
    function remedialModel(ctx) {
        const rem = ctx.data.remedial || {};
        const rows = ctx.merged.remedial.map(({ st, r }) => {
            const x = rem[`${ctx.term}:${st.id}`] || {};
            const weak = r.weak.length ? r.weak.map((a) => C.ASPECT[a].name).join(', ') : 'ผลรวมไม่ผ่าน';
            return { cells: [st.cls, String(st.no ?? ''), fullName(st), weak, p2(r.total), x.activity || '', x.result || ''] };
        });
        return {
            kind: 'remedial', landscape: false,
            title: ctx.tpl.remedialTitle,
            subs: [`นักเรียน${ctx.vars.ขอบเขต}  ${ctx.termFull}`, ctx.school.name || DOTS(50)],
            cols: [{ label: 'ชั้น', w: 1.3, c: 1 }, { label: 'เลขที่', w: 1.1, c: 1 }, { label: 'ชื่อ - สกุล', w: 3.9 }, { label: 'ด้านที่ไม่ผ่าน', w: 2.4 }, { label: 'ร้อยละรวม', w: 1.5, c: 1 }, { label: 'กิจกรรมซ่อมเสริม', w: 3.6 }, { label: 'ผลการซ่อมเสริม', w: 2.2 }],
            rows,
            empty: 'ไม่มีนักเรียนที่ต้องซ่อมเสริม',
            notes: [`รวม ${fmt(rows.length)} คน จากนักเรียนทั้งหมด ${ctx.vars.จำนวน} คน`, fill(ctx, ctx.tpl.refText)],
            signers: [{ name: ctx.classes.length === 1 ? ctx.classes[0].info.teacher : '', position: ctx.tpl.teacherPos }, { name: ctx.school.academicHead, position: ctx.tpl.academicPos }],
        };
    }

    /** ตารางสรุปสำหรับแนบท้ายบันทึกข้อความ */
    function summaryTables(ctx) {
        const head = (first) => [{ label: first, w: 2.4 }, { label: 'จำนวน', w: 1.5, c: 1 }, ...LV.map((l) => ({ label: C.LEVEL[l].name, w: 2.1, c: 1 })), { label: 'ร้อยละ ดีขึ้นไป', w: 1.9, c: 1 }];
        const cell = (cnt, l, n) => (cnt[l] ? `${cnt[l]} (${C.pctOf(cnt[l], n)})` : '-');
        const line = (name, cnt, n, bold) => ({ cells: [name, fmt(n), ...LV.map((l) => cell(cnt, l, n)), C.pctOf(cnt[3] + cnt[2], n)], bold });
        const byClass = ctx.classes.map((k) => line(k.cls, k.count.total, k.rows.length));
        // ระดับชั้น
        const grades = [...new Set(ctx.classes.map((k) => C.gradeOf(k.cls)))];
        const byGrade = grades.map((g) => { const m = C.mergeResults(ctx.classes.filter((k) => C.gradeOf(k.cls) === g)); return line(g, m.count.total, m.rows.length); });
        const n = ctx.merged.rows.length;
        const total = line('รวม', ctx.merged.count.total, n, true);
        const byAspect = C.ASPECTS.map((a) => ({ cells: [a.name, p2(ctx.merged.avg[a.id]), ...LV.map((l) => cell(ctx.merged.count[a.id], l, n))] }));
        byAspect.push({ bold: true, cells: ['รวมถ่วงน้ำหนัก', p2(ctx.merged.avg.total), ...LV.map((l) => cell(ctx.merged.count.total, l, n))] });
        return [
            { caption: 'ตารางที่ 1 ผลการประเมินจำแนกตามห้องเรียน (จำนวนคน (ร้อยละ))', cols: head('ชั้น/ห้อง'), rows: [...byClass, total] },
            { caption: 'ตารางที่ 2 ผลการประเมินจำแนกตามระดับชั้น', cols: head('ระดับชั้น'), rows: [...byGrade, total] },
            { caption: 'ตารางที่ 3 ผลการประเมินจำแนกตามด้าน', cols: [{ label: 'ด้าน', w: 3.4 }, { label: 'คะแนนเฉลี่ย (ร้อยละ)', w: 2.4, c: 1 }, ...LV.map((l) => ({ label: C.LEVEL[l].name, w: 2.3, c: 1 }))], rows: byAspect },
        ];
    }

    /** 4) บันทึกข้อความ */
    function memoDefaults(ctx, today) {
        const one = ctx.classes.length === 1 ? ctx.classes[0].info || {} : {};
        return {
            agency: ctx.school.agency || ctx.school.name || '',
            docNo: '',
            date: memoDate(today || new Date()),
            to: ctx.tpl.memoTo || (ctx.school.director ? `${ctx.tpl.directorPos}${ctx.school.name ? ctx.school.name.replace(/^โรงเรียน/, '') : ''}` : ctx.tpl.directorPos),
            signerName: ctx.classes.length === 1 ? (one.teacher || '') : (ctx.school.measureHead || ''),
            signerPosition: ctx.classes.length === 1 ? (one.teacher ? `${ctx.tpl.teacherPos} ${ctx.classes[0].cls}` : '') : (ctx.school.measureHead ? ctx.tpl.measurePos : ''),
            suggestions: (ctx.tpl.suggestions || []).slice(),
        };
    }
    function memoModel(ctx, form) {
        const f = Object.assign(memoDefaults(ctx), form || {});
        const paragraphs = [fill(ctx, ctx.tpl.memoIntro), fill(ctx, ctx.tpl.memoResult)];
        const sug = (f.suggestions || []).filter((s) => String(s).trim());
        if (sug.length) paragraphs.push(`ข้อเสนอแนะ ${sug.map((s, i) => `(${i + 1}) ${s}`).join(' ')}`);
        paragraphs.push(fill(ctx, ctx.tpl.memoClose));
        return {
            agency: f.agency, docNo: f.docNo, date: f.date, to: f.to,
            subject: fill(ctx, ctx.tpl.memoSubject), paragraphs,
            signer: { name: f.signerName, position: f.signerPosition },
            tables: summaryTables(ctx),
            remedial: remedialModel(ctx),
        };
    }

    /* =================== ThaiDoc (.docx) =================== */
    function pageOf(T, landscape) {
        if (!landscape) return { page: { size: T.A4, margin: T.MARGIN_STD }, W: T.contentWidth(T.MARGIN_STD) };
        const margin = { top: T.cm(2.0), right: T.cm(1.5), bottom: T.cm(1.5), left: T.cm(2.0), header: T.cm(0.8), footer: T.cm(0.8) };
        // docx สลับกว้าง/สูงเองเมื่อกำหนด LANDSCAPE → ส่งขนาด A4 แนวตั้ง
        return { page: { size: { width: T.A4.width, height: T.A4.height, orientation: T.D.PageOrientation.LANDSCAPE }, margin }, W: T.A4.height - margin.left - margin.right };
    }
    function widthsOf(T, cols, W) {
        const sum = cols.reduce((a, c) => a + c.w, 0);
        const w = cols.map((c) => Math.floor((T.cm(c.w) * W) / T.cm(sum)));
        w[w.length - 1] += W - w.reduce((a, b) => a + b, 0);
        return w;
    }
    function gridTable(T, W, cols, rows, emptyText) {
        const D = T.D;
        const AL = D.AlignmentType;
        const VA = D.VerticalAlign;
        const widths = widthsOf(T, cols, W);
        const tight = { top: 10, bottom: 10, left: 50, right: 50 };
        const head = new D.TableRow({ tableHeader: true, cantSplit: true, children: cols.map((c, i) => T.TD([{ t: c.label, bold: true, align: AL.CENTER, after: 0, size: T.pt(c.small ? 12 : 14) }], { width: widths[i], fill: 'D9D9D9', valign: VA.CENTER, margins: tight })) });
        const body = rows.length ? rows.map((r) => new D.TableRow({ cantSplit: true, children: r.cells.map((v, i) => T.TD([{ t: String(v ?? ''), bold: !!r.bold, after: 0 }], { width: widths[i], align: cols[i].c ? AL.CENTER : AL.LEFT, valign: VA.CENTER, margins: tight, fill: r.bold ? 'F2F2F2' : undefined })) }))
            : [new D.TableRow({ children: cols.map((c, i) => T.TD([{ t: i === 1 || cols.length < 2 ? emptyText || '-' : '', after: 0 }], { width: widths[i], margins: tight })) })];
        return new D.Table({ layout: D.TableLayoutType.FIXED, columnWidths: widths, borders: T.ALL_BORDERS, rows: [head, ...body] });
    }
    function signersTable(T, W, signers) {
        const D = T.D;
        const n = signers.length;
        const cw = Math.floor(W / n);
        return new D.Table({
            layout: D.TableLayoutType.FIXED, columnWidths: Array(n).fill(cw), borders: T.NO_BORDERS,
            rows: [new D.TableRow({ cantSplit: true, children: signers.map((s) => new D.TableCell({
                width: { size: cw, type: D.WidthType.DXA }, borders: T.NO_BORDERS,
                children: [
                    T.P({ text: `ลงชื่อ${DOTS(34)}`, align: D.AlignmentType.CENTER, keepNext: true }),
                    T.P({ text: `(${dots(s.name, 34)})`, align: D.AlignmentType.CENTER, keepNext: true }),
                    T.P({ text: s.position || '', align: D.AlignmentType.CENTER }),
                ],
            })) })],
        });
    }
    function modelSection(T, m) {
        const D = T.D;
        const AL = D.AlignmentType;
        const pg = pageOf(T, m.landscape);
        const children = [
            T.P({ text: m.title, bold: true, size: T.pt(18), align: AL.CENTER }),
            ...m.subs.map((s) => T.P({ text: s, align: AL.CENTER })),
            ...T.EMPTY(1, 6),
            gridTable(T, pg.W, m.cols, m.rows, m.empty),
            ...T.EMPTY(1, 6),
            ...m.notes.map((t) => T.P({ text: t, size: T.pt(14), keepNext: true })),
            T.P({ text: '', size: T.pt(10), keepNext: true }),
            signersTable(T, pg.W, m.signers),
        ];
        return { properties: { page: pg.page }, children };
    }
    const sectionsOf = (T, models) => models.map((m) => modelSection(T, m));

    function memoSections(T, ctx, form) {
        const D = T.D;
        const AL = D.AlignmentType;
        const m = memoModel(ctx, form);
        T.resetMemoFields();
        const memo = T.memo({ agency: m.agency, docNo: m.docNo, date: m.date, to: m.to, subject: m.subject, paragraphs: m.paragraphs, signer: m.signer });
        const W = T.contentWidth(T.MARGIN_STD);
        const children = [
            T.P({ text: ctx.tpl.summaryTitle, bold: true, size: T.pt(18), align: AL.CENTER }),
            T.P({ text: `นักเรียน${ctx.vars.ขอบเขต}  ${ctx.termFull}`, align: AL.CENTER }),
            T.P({ text: ctx.school.name || DOTS(50), align: AL.CENTER }),
        ];
        m.tables.forEach((t) => {
            children.push(...T.EMPTY(1, 8), T.P({ text: t.caption, bold: true, keepNext: true }), gridTable(T, W, t.cols, t.rows));
        });
        children.push(...T.EMPTY(1, 6), T.P({ text: fill(ctx, ctx.tpl.refText), size: T.pt(14) }), T.P({ text: weightText(ctx), size: T.pt(14) }));
        children.push(...T.EMPTY(1, 16), ...T.signBlock({ name: m.signer.name, position: m.signer.position || 'ผู้รายงาน' }));
        return [memo, { properties: { page: { size: T.A4, margin: T.MARGIN_STD } }, children }, modelSection(T, m.remedial)];
    }

    /* =================== HTML บนจอ / พิมพ์ =================== */
    function signsHTML(list) {
        return `<div class="gov-signs">${list.map((s) => `<div><p>ลงชื่อ${DOTS(34)}</p><p>(${esc(dots(s.name, 34))})</p><p>${esc(s.position || '')}</p></div>`).join('')}</div>`;
    }
    function tableHTML(cols, rows, emptyText) {
        return `<table class="gov-table"><thead><tr>${cols.map((c) => `<th style="width:${c.w}cm${c.small ? ';font-size:12pt' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
            <tbody>${rows.length ? rows.map((r) => `<tr${r.bold ? ' class="gov-total"' : ''}>${r.cells.map((v, i) => `<td class="${cols[i].c ? 'c' : ''}${r.bad && /ไม่ผ่าน/.test(v) ? ' rec-bad' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="c">${esc(emptyText || '-')}</td></tr>`}</tbody></table>`;
    }
    function modelHTML(m) {
        return `<section class="gov-page${m.landscape ? ' landscape' : ''}">
            <h2 class="gov-title">${esc(m.title)}</h2>
            ${m.subs.map((s) => `<p class="gov-subtitle">${esc(s)}</p>`).join('')}
            ${tableHTML(m.cols, m.rows, m.empty)}
            <p class="gov-note">${m.notes.map(esc).join('<br>')}</p>
            ${signsHTML(m.signers)}
        </section>`;
    }
    const modelsHTML = (models) => models.map(modelHTML).join('');
    function memoHTML(ctx, form, garudaSrc) {
        const m = memoModel(ctx, form);
        return `<section class="gov-page">
                <div class="gov-memo-head"><img src="${garudaSrc}" alt="ตราครุฑ"><h1>บันทึกข้อความ</h1><span></span></div>
                <p class="gov-field"><b>ส่วนราชการ</b>&nbsp; ${esc(dots(m.agency, 60))}</p>
                <p class="gov-field"><b>ที่</b>&nbsp; ${esc(dots(m.docNo, 20))}<span class="gov-tab"></span><b>วันที่</b>&nbsp; ${esc(dots(m.date, 30))}</p>
                <p class="gov-field"><b>เรื่อง</b>&nbsp; ${esc(m.subject)}</p>
                <p class="gov-to"><b>เรียน</b>&nbsp; ${esc(dots(m.to, 40))}</p>
                ${m.paragraphs.map((p) => `<p class="gov-body">${esc(p)}</p>`).join('')}
                <div class="gov-sign"><p>ลงชื่อ${DOTS(48)}</p><p>(${esc(dots(m.signer.name, 48))})</p><p>ตำแหน่ง ${esc(dots(m.signer.position, 48))}</p></div>
            </section>
            <section class="gov-page">
                <h2 class="gov-title">${esc(ctx.tpl.summaryTitle)}</h2>
                <p class="gov-subtitle">นักเรียน${esc(ctx.vars.ขอบเขต)}  ${esc(ctx.termFull)}</p>
                <p class="gov-subtitle">${esc(ctx.school.name || DOTS(50))}</p>
                ${m.tables.map((t) => `<p class="gov-cap">${esc(t.caption)}</p>${tableHTML(t.cols, t.rows)}`).join('')}
                <p class="gov-note">${esc(fill(ctx, ctx.tpl.refText))}<br>${esc(weightText(ctx))}</p>
                <div class="gov-sign"><p>ลงชื่อ${DOTS(48)}</p><p>(${esc(dots(m.signer.name, 48))})</p><p>ตำแหน่ง ${esc(m.signer.position || 'ผู้รายงาน')}</p></div>
            </section>
            ${modelHTML(m.remedial)}`;
    }

    return { context, recordModels, scoreModels, remedialModel, memoModel, memoDefaults, summaryTables, sectionsOf, modelSection, memoSections, modelHTML, modelsHTML, memoHTML, memoDate, fullName, fill };
});

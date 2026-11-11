/* =====================================================================
   Excel (SheetJS): นำเข้ารายชื่อ • ไฟล์แม่แบบ • ส่งออกผลการประเมิน/คะแนนรายชิ้นงาน
   ===================================================================== */
(function () {
    'use strict';

    const demoRow = () => (window.VSDemo && VSDemo.active ? [[`${VSDemo.watermark} — สร้างจากระบบทดลอง ไม่ใช่เอกสารจริง`]] : []);
    function sheet(rows, widths) {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
        return ws;
    }
    const safeSheet = (s) => String(s).replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
    const r2 = (v) => (v == null ? '' : Math.round(v * 100) / 100);

    /** อ่านไฟล์ Excel/CSV → [{no, code, prefix, firstName, lastName, cls}] */
    async function readStudents(file, defaultCls) {
        const buf = await U.readFileAsArrayBuffer(file);
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        return parseRows(rows, defaultCls);
    }
    /** แปลงตาราง (แถวแรกเป็นหัวคอลัมน์ ถ้ามี) */
    function parseRows(rows, defaultCls) {
        const clean = rows.map((r) => r.map((v) => U.norm(v))).filter((r) => r.some(Boolean));
        if (!clean.length) return [];
        const head = clean[0].map((h) => h.replace(/\s/g, ''));
        const find = (...keys) => head.findIndex((h) => keys.some((k) => h.includes(k)));
        let ix = { no: find('เลขที่'), code: find('เลขประจำตัว', 'รหัส'), prefix: find('คำนำหน้า'), first: find('ชื่อ-สกุล', 'ชื่อ-นามสกุล', 'ชื่อ'), last: find('สกุล', 'นามสกุล'), cls: find('ชั้น', 'ห้อง') };
        let body = clean.slice(1);
        if (ix.first < 0) { ix = { no: 0, code: 1, prefix: -1, first: 2, last: -1, cls: 3 }; body = clean; }
        if (ix.last === ix.first) ix.last = -1;
        return body.map((r) => {
            let prefix = ix.prefix >= 0 ? r[ix.prefix] : '';
            let first = r[ix.first] || '';
            let last = ix.last >= 0 ? r[ix.last] : '';
            if (!prefix) { const m = /^(ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง)\s*/.exec(first); if (m) { prefix = m[1].replace('เด็กชาย', 'ด.ช.').replace('เด็กหญิง', 'ด.ญ.'); first = first.slice(m[0].length); } }
            if (!last && first.includes(' ')) { const p = first.split(' '); first = p.shift(); last = p.join(' '); }
            return { no: ix.no >= 0 ? U.toInt(r[ix.no], '') : '', code: ix.code >= 0 ? r[ix.code] : '', prefix, firstName: first, lastName: last, cls: Store.normClass((ix.cls >= 0 && r[ix.cls]) || defaultCls || '') };
        }).filter((s) => s.firstName);
    }

    function template() {
        const wb = XLSX.utils.book_new();
        const rows = [['เลขที่', 'เลขประจำตัว', 'คำนำหน้า', 'ชื่อ', 'สกุล', 'ชั้น/ห้อง'], [1, '61011', 'ด.ช.', 'ธนกฤต', 'สุขสวัสดิ์', 'ป.6/1'], [2, '61012', 'ด.ญ.', 'ณัฐธิดา', 'แก้วมณี', 'ป.6/1']];
        XLSX.utils.book_append_sheet(wb, sheet(rows, [8, 14, 10, 18, 18, 10]), 'รายชื่อนักเรียน');
        XLSX.writeFile(wb, 'แม่แบบรายชื่อนักเรียน.xlsx');
    }
    function exportStudents() {
        const rows = [['เลขที่', 'เลขประจำตัว', 'คำนำหน้า', 'ชื่อ', 'สกุล', 'ชั้น/ห้อง']];
        Store.studentsOf('').forEach((s) => rows.push([s.no, s.code, s.prefix, s.firstName, s.lastName, s.cls]));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet([...demoRow(), ...rows], [8, 14, 10, 18, 18, 10]), 'รายชื่อนักเรียน');
        XLSX.writeFile(wb, `รายชื่อนักเรียน_${U.stamp()}.xlsx`);
    }

    /** ส่งออกผลการประเมิน: ชีตสรุป + ชีตต่อห้อง (ผล) + ชีตต่อห้อง (คะแนนรายชิ้นงาน) */
    function exportResults(classes) {
        const d = Store.data;
        const ctx = Docs.context(d, classes, Store.term());
        const wb = XLSX.utils.book_new();
        const head = [...demoRow(), [d.school.name || 'โรงเรียน'], [`ผลการประเมินการอ่าน คิดวิเคราะห์ และเขียน ${ctx.termFull}`]];
        const sum = [...head, [], ['ห้อง', 'จำนวน', 'ดีเยี่ยม', 'ดี', 'ผ่าน', 'ไม่ผ่าน', 'ยังไม่มีคะแนน', 'เฉลี่ยอ่าน', 'เฉลี่ยคิดวิเคราะห์', 'เฉลี่ยเขียน', 'เฉลี่ยรวม', 'ต้องซ่อมเสริม']];
        ctx.classes.forEach((k) => { const c = k.count.total; sum.push([k.cls, k.rows.length, c[3], c[2], c[1], c[0], c.none, r2(k.avg.read), r2(k.avg.think), r2(k.avg.write), r2(k.avg.total), k.remedial.length]); });
        const m = ctx.merged; const c = m.count.total;
        sum.push(['รวม', m.rows.length, c[3], c[2], c[1], c[0], c.none, r2(m.avg.read), r2(m.avg.think), r2(m.avg.write), r2(m.avg.total), m.remedial.length]);
        XLSX.utils.book_append_sheet(wb, sheet(sum, [10, 8, 9, 9, 9, 9, 12, 10, 14, 10, 10, 12]), 'สรุปรายห้อง');
        ctx.classes.forEach((k) => {
            const rows = [...head, [`ชั้น ${k.cls}`], ['เลขที่', 'เลขประจำตัว', 'ชื่อ - สกุล', 'อ่าน (ร้อยละ)', 'ระดับ', 'คิดวิเคราะห์ (ร้อยละ)', 'ระดับ', 'เขียน (ร้อยละ)', 'ระดับ', 'รวมถ่วงน้ำหนัก', 'ผลการประเมิน', 'ซ่อมเสริม']];
            k.rows.forEach(({ st, r }) => rows.push([st.no, st.code, Store.fullName(st), ...Core.IDS.flatMap((a) => [r2(r.aspects[a].pct), r.aspects[a].level == null ? '' : Core.LEVEL[r.aspects[a].level].name]), r2(r.total), Core.levelName(r.level), r.remedial ? 'ต้องซ่อมเสริม' : '']));
            XLSX.utils.book_append_sheet(wb, sheet(rows, [7, 12, 28, 11, 9, 16, 9, 11, 9, 13, 13, 13]), safeSheet(`ผล ${k.cls}`));
            const tr = [...head, [`คะแนนรายชิ้นงาน ชั้น ${k.cls}`], ['เลขที่', 'ชื่อ - สกุล', ...k.tasks.flatMap((t, i) => Core.IDS.filter((a) => t.max[a] > 0).map((a) => `${i + 1}.${Core.ASPECT[a].short} (${t.max[a]})`))]];
            k.rows.forEach(({ st }) => tr.push([st.no, Store.fullName(st), ...k.tasks.flatMap((t) => Core.IDS.filter((a) => t.max[a] > 0).map((a) => { const v = ((d.scores[t.id] || {})[st.id] || {})[a]; return Core.isNum(v) ? Number(v) : ''; }))]));
            tr.push([], ['ชิ้นงาน'], ...k.tasks.map((t, i) => [`${i + 1}`, t.title, t.date ? U.thDate(t.date) : '']));
            XLSX.utils.book_append_sheet(wb, sheet(tr, [7, 28]), safeSheet(`คะแนน ${k.cls}`));
        });
        const name = `ผลอ่านคิดวิเคราะห์เขียน_${classes && classes.length === 1 ? classes[0].replace('/', '-') : 'ทุกห้อง'}_ภาค${ctx.term}-${d.school.academicYear}.xlsx`;
        XLSX.writeFile(wb, U.safeFileName(name));
        return name;
    }

    window.Excel = { readStudents, parseRows, template, exportStudents, exportResults };
})();

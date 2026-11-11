/* =====================================================================
   แกนคำนวณ: ด้านการประเมิน (อ่าน / คิดวิเคราะห์ / เขียน) น้ำหนัก เกณฑ์แปลผล 4 ระดับ
   ใช้ได้ทั้งเบราว์เซอร์และ Node (dev/test-engine.js, dev/build-docs.js)

   โครงข้อมูลที่เกี่ยวข้อง
   - criteria.weights   { read, think, write }   น้ำหนัก (ร้อยละ) — ด้านที่ยังไม่มีชิ้นงานจะไม่นำมาคิด
   - criteria.cut       { excellent, good, pass } คะแนนร้อยละขั้นต่ำของแต่ละระดับ
   - tasks[]            { id, cls, term, title, date, kind, max:{read,think,write} }
   - scores[taskId][studentId] = { read, think, write }  (ช่องว่าง = ยังไม่ได้บันทึก)
   ===================================================================== */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const ASPECTS = [
        { id: 'read', name: 'การอ่าน', short: 'อ่าน', icon: 'fa-book-open-reader', color: '#0A84FF' },
        { id: 'think', name: 'การคิดวิเคราะห์', short: 'คิดวิเคราะห์', icon: 'fa-brain', color: '#BF5AF2' },
        { id: 'write', name: 'การเขียน', short: 'เขียน', icon: 'fa-pen-nib', color: '#FF9F0A' },
    ];
    const ASPECT = Object.fromEntries(ASPECTS.map((a) => [a.id, a]));
    const IDS = ASPECTS.map((a) => a.id);

    const LEVEL = {
        3: { name: 'ดีเยี่ยม', tone: 'ok', color: '#16a34a' },
        2: { name: 'ดี', tone: 'info', color: '#2563eb' },
        1: { name: 'ผ่าน', tone: 'warn', color: '#d97706' },
        0: { name: 'ไม่ผ่าน', tone: 'bad', color: '#e11d48' },
    };
    const LV = [3, 2, 1, 0];

    /* ค่าเริ่มต้น — แก้ไขได้ทั้งหมดในหน้า "เกณฑ์และตัวชี้วัด" */
    const DEFAULT_CRITERIA = {
        weights: { read: 35, think: 30, write: 35 },
        cut: { excellent: 80, good: 65, pass: 50 },
        indicators: {
            read: [
                'สามารถอ่านเพื่อหาข้อมูลสารสนเทศเสริมประสบการณ์จากสื่อประเภทต่าง ๆ',
                'สามารถจับประเด็นสำคัญ ข้อเท็จจริง ความคิดเห็นเรื่องที่อ่าน',
            ],
            think: [
                'สามารถวิเคราะห์ วิจารณ์ได้อย่างสมเหตุสมผล',
                'สามารถเปรียบเทียบ เชื่อมโยงเหตุและผล และสรุปความคิดเห็นเรื่องที่อ่าน',
            ],
            write: [
                'สามารถสรุปความคิดเห็นเรื่องที่อ่าน และสร้างสรรค์งานเขียน',
                'สามารถเขียนแสดงความคิดเห็น เขียนสื่อสารด้วยภาษาที่ถูกต้อง เหมาะสม',
            ],
        },
    };

    const isNum = (v) => v !== '' && v != null && Number.isFinite(Number(v));
    const round1 = (n) => Math.round(n * 10) / 10;
    const pctText = (v) => (v == null ? '-' : (Math.round(v * 100) / 100).toFixed(2));

    /** ระดับจากคะแนนร้อยละ */
    function levelOf(pct, cut) {
        if (pct == null || !Number.isFinite(pct)) return null;
        const c = cut || DEFAULT_CRITERIA.cut;
        if (pct >= c.excellent) return 3;
        if (pct >= c.good) return 2;
        if (pct >= c.pass) return 1;
        return 0;
    }
    const levelName = (l) => (l == null ? 'ยังไม่ครบ' : LEVEL[l].name);

    /** ช่วงคะแนนของแต่ละระดับ (ข้อความ) */
    function cutRanges(cut) {
        const c = cut || DEFAULT_CRITERIA.cut;
        const m = (v) => (Math.round((v - 0.01) * 100) / 100).toFixed(2).replace(/\.00$/, '');
        return {
            3: `${c.excellent}–100`,
            2: `${c.good}–${m(c.excellent)}`,
            1: `${c.pass}–${m(c.good)}`,
            0: `ต่ำกว่า ${c.pass}`,
        };
    }

    /** ชิ้นงานของห้อง/ภาคเรียน (เรียงตามวันที่) */
    function tasksOf(data, cls, term) {
        return (data.tasks || []).filter((t) => t.cls === cls && String(t.term) === String(term))
            .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.title).localeCompare(String(b.title), 'th'));
    }

    /**
     * ผลของนักเรียน 1 คน
     * คืน { aspects:{read:{got,max,pct,level,missing}}, total, level, missing, remedial, weak:[aspectId] }
     */
    function studentResult(data, sid, tasks) {
        const cr = data.criteria || DEFAULT_CRITERIA;
        const out = { aspects: {}, total: null, level: null, missing: 0, remedial: false, weak: [] };
        let wSum = 0;
        let acc = 0;
        IDS.forEach((a) => {
            let got = 0;
            let max = 0;
            let planned = 0;
            let missing = 0;
            tasks.forEach((t) => {
                const m = Number((t.max || {})[a]) || 0;
                if (m <= 0) return;
                planned += m;
                const v = ((data.scores[t.id] || {})[sid] || {})[a];
                if (isNum(v)) { got += Number(v); max += m; } else missing += 1;
            });
            const pct = max > 0 ? (got * 100) / max : null;
            const level = levelOf(pct, cr.cut);
            out.aspects[a] = { got, max, planned, pct, level, missing };
            out.missing += missing;
            const w = Number(cr.weights[a]) || 0;
            if (pct != null && w > 0) { wSum += w; acc += w * pct; }
        });
        out.total = wSum > 0 ? acc / wSum : null;
        out.level = levelOf(out.total, cr.cut);
        out.weak = IDS.filter((a) => out.aspects[a].level === 0);
        out.remedial = out.level === 0 || out.weak.length > 0;
        return out;
    }

    /** นับจำนวนตามระดับ { 3, 2, 1, 0, none } */
    const emptyCount = () => ({ 3: 0, 2: 0, 1: 0, 0: 0, none: 0 });
    function addCount(c, l) { if (l == null) c.none += 1; else c[l] += 1; }

    /**
     * ผลทั้งห้อง: { cls, tasks, rows:[{st, r}], count:{total, read, think, write}, avg:{...}, remedial:[...] }
     */
    function classResult(data, cls, term) {
        const tasks = tasksOf(data, cls, term);
        const students = (data.students || []).filter((s) => s.cls === cls)
            .sort((a, b) => (Number(a.no) || 9999) - (Number(b.no) || 9999) || String(a.firstName).localeCompare(String(b.firstName), 'th'));
        const rows = students.map((st) => ({ st, r: studentResult(data, st.id, tasks) }));
        const count = { total: emptyCount() };
        const avg = {};
        IDS.forEach((a) => { count[a] = emptyCount(); });
        rows.forEach(({ r }) => {
            addCount(count.total, r.level);
            IDS.forEach((a) => addCount(count[a], r.aspects[a].level));
        });
        const mean = (arr) => { const v = arr.filter((x) => x != null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
        avg.total = mean(rows.map((x) => x.r.total));
        IDS.forEach((a) => { avg[a] = mean(rows.map((x) => x.r.aspects[a].pct)); });
        return { cls, term: String(term), tasks, rows, count, avg, remedial: rows.filter((x) => x.r.remedial) };
    }

    /** ระดับชั้นจากชื่อห้อง: "ม.1/2" → "ม.1" */
    const gradeOf = (cls) => String(cls || '').split('/')[0].trim();

    /** รวมหลายห้อง (เช่น ทั้งระดับชั้น / ทั้งโรงเรียน) */
    function mergeResults(list) {
        const count = { total: emptyCount() };
        IDS.forEach((a) => { count[a] = emptyCount(); });
        const rows = [];
        list.forEach((cr) => {
            rows.push(...cr.rows);
            ['total', ...IDS].forEach((k) => LV.concat('none').forEach((l) => { count[k][l] += cr.count[k][l]; }));
        });
        const mean = (arr) => { const v = arr.filter((x) => x != null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
        const avg = { total: mean(rows.map((x) => x.r.total)) };
        IDS.forEach((a) => { avg[a] = mean(rows.map((x) => x.r.aspects[a].pct)); });
        return { rows, count, avg, remedial: rows.filter((x) => x.r.remedial) };
    }

    /** ร้อยละของจำนวน (ข้อความ 2 ตำแหน่ง) */
    const pctOf = (n, total) => (total ? ((n * 100) / total).toFixed(2) : '0.00');

    return { ASPECTS, ASPECT, IDS, LEVEL, LV, DEFAULT_CRITERIA, isNum, round1, pctText, pctOf, levelOf, levelName, cutRanges, tasksOf, studentResult, classResult, mergeResults, gradeOf, emptyCount };
});

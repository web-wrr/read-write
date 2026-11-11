/* =====================================================================
   ข้อมูลตัวอย่าง (ชื่อสมมติทั้งหมด) — ป.6/1 ป.6/2 ม.1/1 ภาคเรียนที่ 1/2569
   แต่ละห้องมีชิ้นงาน 4–5 ชิ้น คะแนนสมจริง มีนักเรียนบางคนต้องซ่อมเสริม
   ใช้ได้ทั้งเบราว์เซอร์และ Node
   ===================================================================== */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./presets.js'));
    else root.Demo = factory(root.Core, root.Presets);
})(typeof self !== 'undefined' ? self : this, function (Core, Presets) {
    'use strict';

    const BOYS = ['ธนกฤต', 'ภูมิพัฒน์', 'ณัฐวุฒิ', 'กิตติพัฒน์', 'ปิยะพงษ์', 'ศุภกร', 'ธีรภัทร', 'วรเมธ', 'ภาคิน', 'ชยพล', 'อัครพล', 'ณภัทร',
        'พีรพัฒน์', 'ธนวัฒน์', 'กันตภณ', 'ปุณณวิช', 'รัชชานนท์', 'ศิวกร', 'ธนภัทร', 'จิรายุ', 'วีรภัทร', 'ภัทรพล', 'ปกรณ์', 'นนทพัทธ์'];
    const GIRLS = ['ณัฐธิดา', 'ปุณยวีร์', 'กัญญาณัฐ', 'พิมพ์ชนก', 'ชนิสรา', 'ธัญชนก', 'วรรณกานต์', 'ศิริกาญจน์', 'กมลชนก', 'ภัทรวดี',
        'ปาณิสรา', 'สุพิชญา', 'อรปรียา', 'ณิชาภัทร', 'ธนพร', 'ชญานิศ', 'ปวีณ์ธิดา', 'เบญญาภา', 'กชพร', 'รินรดา', 'พรนภัส', 'ญาดา'];
    const SURNAMES = ['สุขสวัสดิ์', 'ศรีสุข', 'แก้วมณี', 'ทองดี', 'บุญมา', 'จันทร์หอม', 'พรหมวงศ์', 'สมบูรณ์ชัย', 'รุ่งเรืองศรี', 'วงศ์ใหญ่',
        'ชัยมงคล', 'ศักดิ์ดี', 'มีสุข', 'บุญประเสริฐ', 'อินทรสุวรรณ', 'เพชรรัตน์', 'ปัญญาดี', 'คำแก้ว', 'สายทอง', 'ทองคำ', 'ศรีวงศ์',
        'กาญจนวงศ์', 'นาคสวัสดิ์', 'พึ่งบุญ', 'ใจงาม', 'สุวรรณรัตน์', 'เรืองชัย', 'แก้วประเสริฐ', 'บุญเรือง', 'ธนสาร'];

    const CLASSES = [
        { name: 'ป.6/1', n: 28, boys: 14, code: 6101, teacher: 'นางสาวอรวรรณ ใจดี', base: 74, kids: true },
        { name: 'ป.6/2', n: 26, boys: 13, code: 6201, teacher: 'นายธีระ แก้วกล้า', base: 66, kids: true },
        { name: 'ม.1/1', n: 30, boys: 15, code: 7101, teacher: 'นางพรทิพย์ ศรีงาม', base: 70, kids: true },
    ];
    // ชิ้นงานต่อห้อง (index ใน Presets.TASKS) + วันที่
    const PLAN = [[0, '2026-06-12'], [3, '2026-07-03'], [6, '2026-07-24'], [8, '2026-08-21'], [11, '2026-09-11']];
    const WEAK = { 'ป.6/1': [9], 'ป.6/2': [4, 17, 22], 'ม.1/1': [11, 26] };

    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function build() {
        const rand = rng(2569);
        const now = new Date().toISOString();
        const students = [];
        const tasks = [];
        const scores = {};
        const remedial = {};
        const used = new Set();
        let sn = 0;
        let tn = 0;
        CLASSES.forEach((c, ci) => {
            const kidPrefix = c.name.startsWith('ป') || c.name.startsWith('ม.1');
            const ids = [];
            const ability = {};
            for (let i = 1; i <= c.n; i += 1) {
                const boy = i <= c.boys;
                const pool = boy ? BOYS : GIRLS;
                let first; let last; let guard = 0;
                do {
                    first = pool[Math.floor(rand() * pool.length)];
                    last = SURNAMES[Math.floor(rand() * SURNAMES.length)];
                    guard += 1;
                } while ((used.has(`${first} ${last}`) || used.has(`${c.name}:${first}`)) && guard < 300);
                used.add(`${first} ${last}`);
                used.add(`${c.name}:${first}`);
                sn += 1;
                const id = `s_demo${String(sn).padStart(3, '0')}`;
                students.push({ id, no: i, code: String(c.code * 10 + i), prefix: kidPrefix ? (boy ? 'ด.ช.' : 'ด.ญ.') : (boy ? 'นาย' : 'นางสาว'), firstName: first, lastName: last, cls: c.name });
                ids.push(id);
                const weak = (WEAK[c.name] || []).includes(i);
                ability[id] = weak ? 38 + rand() * 12 : Math.max(48, Math.min(98, c.base + (rand() - 0.5) * 34 + (boy ? -2 : 2)));
            }
            // ม.1/1 ชิ้นสุดท้ายยังกรอกไม่ครบ (สมจริง: ครูกำลังบันทึก)
            PLAN.forEach(([pi, date], k) => {
                const p = Presets.TASKS[pi];
                tn += 1;
                const t = { id: `t_demo${String(tn).padStart(3, '0')}`, cls: c.name, term: '1', title: p.title, kind: p.kind, date, max: Object.assign({}, p.max), note: '' };
                tasks.push(t);
                scores[t.id] = {};
                ids.forEach((sid, idx) => {
                    if (ci === 2 && k === PLAN.length - 1 && idx >= 18) return;
                    const row = {};
                    Core.IDS.forEach((a, ai) => {
                        const m = t.max[a];
                        if (!m) return;
                        const shift = [0, -4, -2][ai] + (rand() - 0.5) * 18;
                        const pct = Math.max(0, Math.min(100, ability[sid] + shift));
                        row[a] = Math.max(0, Math.min(m, Math.round((pct / 100) * m)));
                    });
                    scores[t.id][sid] = row;
                });
            });
        });
        // บันทึกซ่อมเสริมตัวอย่าง 2 คน
        const s1 = students.find((s) => s.cls === 'ป.6/2' && s.no === 4);
        const s2 = students.find((s) => s.cls === 'ป.6/1' && s.no === 9);
        if (s1) remedial[`1:${s1.id}`] = { activity: Presets.REMEDIAL[0], result: Presets.REMEDIAL_RESULT[1], note: 'ฝึกอ่านช่วงพักกลางวัน' };
        if (s2) remedial[`1:${s2.id}`] = { activity: Presets.REMEDIAL[5], result: Presets.REMEDIAL_RESULT[2], note: '' };

        return {
            app: 'vs-read-think-write',
            schemaVersion: 1,
            createdAt: now,
            updatedAt: now,
            school: {
                name: 'โรงเรียนบ้านตัวอย่างวิทยา',
                agency: 'โรงเรียนบ้านตัวอย่างวิทยา',
                area: 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาตัวอย่าง เขต 1',
                academicYear: '2569',
                semester: '1',
                director: 'นายสมเกียรติ ตัวอย่าง',
                academicHead: 'นางสุนีย์ ศรีวิชาการ',
                measureHead: 'นายวัฒนา วัดผลดี',
                logo: '',
            },
            criteria: JSON.parse(JSON.stringify(Core.DEFAULT_CRITERIA)),
            tpl: JSON.parse(JSON.stringify(Presets.TEMPLATE)),
            classes: CLASSES.map((c) => ({ name: c.name, teacher: c.teacher })),
            students,
            tasks,
            scores,
            remedial,
            register: [
                { id: 'r_demo001', no: 1, year: '2569', date: '2026-09-30', subject: 'รายงานผลการประเมินการอ่าน คิดวิเคราะห์ และเขียน ภาคเรียนที่ 1 ปีการศึกษา 2569', scope: 'ป.6/1', note: '' },
            ],
        };
    }

    return { build, CLASSES, rng };
});

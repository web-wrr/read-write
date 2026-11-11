/* =====================================================================
   หน้า: ชิ้นงาน/บันทึกคะแนน • แปลผลรายคน • สรุปรายห้อง/ระดับชั้น (กราฟ) • ซ่อมเสริม
   ===================================================================== */
(function () {
    'use strict';
    const esc = U.esc;
    const V = (window.Views = window.Views || {});
    const charts = [];
    const killCharts = () => { while (charts.length) { try { charts.pop().destroy(); } catch (e) { /* ข้าม */ } } };
    const sumMax = (t) => Core.IDS.reduce((a, x) => a + (Number(t.max[x]) || 0), 0);
    const tone = ['#e11d48', '#f59e0b', '#2563eb', '#16a34a'];

    /* ============================ ชิ้นงาน / บันทึกคะแนน ============================ */
    V.scores = {
        render(el, params) {
            const classes = Store.classList();
            const cls = UI.currentClass(params.cls);
            const tasks = cls ? Store.tasksOf(cls) : [];
            let tid = params.task && tasks.some((t) => t.id === params.task) ? params.task : (tasks.some((t) => t.id === Store.meta.lastTask) ? Store.meta.lastTask : (tasks[tasks.length - 1] || {}).id);
            el.innerHTML = U.hero({ icon: 'fa-pen-to-square', title: 'ชิ้นงาน / บันทึกคะแนน', sub: `${esc(Store.termText())} • เลือกชิ้นงานสำเร็จรูป แล้วกรอกคะแนน อ่าน / คิดวิเคราะห์ / เขียน`,
                side: cls ? '<button type="button" class="btn-x cta" id="sc-add"><i class="fas fa-plus"></i>เพิ่มชิ้นงาน</button>' : '' });
            if (!classes.length) { el.innerHTML += UI.needStudents(); return; }
            const done = (t) => Store.studentsOf(cls).filter((s) => { const r = (Store.data.scores[t.id] || {})[s.id]; return r && Core.IDS.every((a) => !(t.max[a] > 0) || Core.isNum(r[a])); }).length;
            const nSt = Store.studentsOf(cls).length;
            const taskCards = tasks.map((t, i) => {
                const k = done(t);
                return `<button type="button" class="task-card${t.id === tid ? ' active' : ''}" data-task="${t.id}" data-demo-allow>
                    <span class="tk-no">${i + 1}</span><span class="tk-main"><b>${esc(t.title)}</b><small>${t.date ? esc(U.thDate(t.date)) : 'ไม่ระบุวันที่'} • เต็ม ${sumMax(t)}</small>
                    <span class="tk-max">${Core.ASPECTS.filter((a) => t.max[a.id] > 0).map((a) => `<i class="asp-chip asp-${a.id}">${a.short} ${t.max[a.id]}</i>`).join('')}</span></span>
                    <span class="tk-prog ${k === nSt && nSt ? 'ok' : ''}">${k}/${nSt}</span></button>`;
            }).join('');
            el.innerHTML += UI.classPills(cls)
                + (tasks.length ? `<div class="task-strip">${taskCards}</div><div id="sc-grid"></div>`
                    : UI.panel({ title: `ยังไม่มีชิ้นงานของชั้น ${esc(cls)}`, icon: 'fa-clipboard-list', body: UI.empty('fa-clipboard-list', 'ยังไม่มีชิ้นงานในภาคเรียนนี้', 'กด "เพิ่มชิ้นงาน" แล้วเลือกจากชิ้นงานสำเร็จรูป เช่น อ่านจับใจความ เขียนย่อความ', '<button type="button" class="btn-x primary" id="sc-add2"><i class="fas fa-plus"></i>เพิ่มชิ้นงาน</button>') }));
            UI.bindPills(el, (c) => App.go('scores', { cls: c }));
            el.querySelector('#sc-add').onclick = () => editTask(null, cls);
            if (el.querySelector('#sc-add2')) el.querySelector('#sc-add2').onclick = () => editTask(null, cls);
            el.querySelectorAll('[data-task]').forEach((b) => { b.onclick = () => { Store.setMeta({ lastTask: b.dataset.task }); App.go('scores', { cls, task: b.dataset.task }); }; });
            if (tid) renderGrid(el.querySelector('#sc-grid'), cls, Store.task(tid));
        },
    };

    function renderGrid(box, cls, t) {
        const list = Store.studentsOf(cls);
        const asp = Core.ASPECTS.filter((a) => t.max[a.id] > 0);
        const sc = Store.data.scores[t.id] || (Store.data.scores[t.id] = {});
        const cell = (s, a) => { const v = (sc[s.id] || {})[a.id]; return `<td class="c"><input class="sc-in" data-sid="${s.id}" data-a="${a.id}" inputmode="decimal" autocomplete="off" value="${Core.isNum(v) ? v : ''}" aria-label="${esc(a.name)} ${esc(Store.fullName(s))}"></td>`; };
        const rowTotal = (s) => { const r = sc[s.id] || {}; let g = 0; let m = 0; asp.forEach((a) => { if (Core.isNum(r[a.id])) { g += Number(r[a.id]); m += t.max[a.id]; } }); return m ? { g, p: (g * 100) / m } : null; };
        const ind = Store.data.criteria.indicators;
        box.innerHTML = UI.panel({
            title: esc(t.title), sub: `${esc(t.kind || 'ชิ้นงาน')} • ${t.date ? esc(U.thDate(t.date)) : ''} • กด Enter ลงช่องถัดไป ↑↓ เลื่อนขึ้นลง`, icon: 'fa-table-cells', tone: 'info', flush: true,
            tools: `<button type="button" class="btn-x ghost sm" id="tk-edit"><i class="fas fa-pen"></i>แก้ไขชิ้นงาน</button><button type="button" class="btn-x ghost sm" id="tk-del" data-act="delete"><i class="fas fa-trash"></i>ลบชิ้นงาน</button>`,
            body: `<div class="dt-wrap"><table class="dt score-grid"><thead><tr><th class="c" style="width:56px">เลขที่</th><th class="sticky-name">ชื่อ - สกุล</th>
                ${asp.map((a) => `<th class="c th-asp asp-${a.id}" title="${esc(ind[a.id].join(' / '))}"><i class="fas ${a.icon}"></i> ${a.name}<small>เต็ม ${t.max[a.id]}</small>
                    <div class="th-act"><button type="button" class="icon-btn" data-fill="${a.id}" title="ช่องที่ว่าง = คะแนนเต็ม" data-demo-allow><i class="fas fa-fill-drip"></i></button><button type="button" class="icon-btn" data-clear="${a.id}" title="ล้างคอลัมน์นี้" data-demo-allow><i class="fas fa-eraser"></i></button></div></th>`).join('')}
                <th class="c">รวม (${asp.reduce((p, a) => p + t.max[a.id], 0)})</th><th class="c">ร้อยละ</th></tr></thead>
                <tbody>${list.map((s) => { const tt = rowTotal(s); return `<tr><td class="c">${esc(s.no)}</td><td class="sticky-name fw-bold">${esc(Store.fullName(s))}</td>${asp.map((a) => cell(s, a)).join('')}<td class="c fw-bold" data-tot="${s.id}">${tt ? tt.g : '-'}</td><td class="c" data-pct="${s.id}">${tt ? UI.level(Core.levelOf(tt.p, Store.data.criteria.cut), true) : '-'}</td></tr>`; }).join('') || U.emptyRow(asp.length + 4, 'fa-user-plus', 'ยังไม่มีนักเรียนในห้องนี้')}</tbody></table></div>`,
        });
        const inputs = [...box.querySelectorAll('.sc-in')];
        const save = U.debounce(() => Store.commit('score'), 250);
        const refreshRow = (sid) => {
            const tt = rowTotal({ id: sid });
            box.querySelector(`[data-tot="${sid}"]`).textContent = tt ? tt.g : '-';
            box.querySelector(`[data-pct="${sid}"]`).innerHTML = tt ? UI.level(Core.levelOf(tt.p, Store.data.criteria.cut), true) : '-';
        };
        const setVal = (inp) => {
            const { sid, a } = inp.dataset;
            const raw = inp.value.trim();
            const max = t.max[a];
            if (!sc[sid]) sc[sid] = {};
            if (raw === '') { delete sc[sid][a]; inp.classList.remove('is-bad'); } else {
                const v = Number(raw.replace(',', '.'));
                if (!Number.isFinite(v) || v < 0 || v > max) { inp.classList.add('is-bad'); inp.title = `คะแนนต้องอยู่ระหว่าง 0–${max}`; return; }
                inp.classList.remove('is-bad');
                sc[sid][a] = v;
            }
            refreshRow(sid);
            save();
        };
        inputs.forEach((inp, i) => {
            inp.addEventListener('input', () => setVal(inp));
            inp.addEventListener('focus', () => inp.select());
            inp.addEventListener('keydown', (e) => {
                const cols = asp.length;
                let j = null;
                if (e.key === 'Enter' || e.key === 'ArrowDown') j = i + cols;
                else if (e.key === 'ArrowUp') j = i - cols;
                if (j == null) return;
                e.preventDefault();
                if (inputs[j]) inputs[j].focus();
                else if (e.key === 'Enter' && inputs[(i % cols) + 1]) inputs[(i % cols) + 1].focus();
            });
        });
        box.querySelectorAll('[data-fill]').forEach((b) => { b.onclick = () => { inputs.filter((x) => x.dataset.a === b.dataset.fill && !x.value.trim()).forEach((x) => { x.value = t.max[b.dataset.fill]; setVal(x); }); U.toast('เติมคะแนนเต็มในช่องที่ว่างแล้ว', { type: 'ok' }); }; });
        box.querySelectorAll('[data-clear]').forEach((b) => {
            b.onclick = async () => {
                if (!(await U.confirm('ล้างคะแนนทั้งคอลัมน์?', `${esc(Core.ASPECT[b.dataset.clear].name)} ของชิ้นงานนี้ทุกคน`, { danger: true, confirmText: 'ล้างคอลัมน์' }))) return;
                inputs.filter((x) => x.dataset.a === b.dataset.clear).forEach((x) => { x.value = ''; setVal(x); });
            };
        });
        box.querySelector('#tk-edit').onclick = () => editTask(t.id, cls);
        box.querySelector('#tk-del').onclick = async () => {
            if (!(await U.confirm('ลบชิ้นงานนี้?', `"${esc(t.title)}" และคะแนนทั้งหมดของชิ้นงานนี้`, { danger: true, confirmText: '<i class="fas fa-trash"></i> ลบชิ้นงาน' }))) return;
            const d = Store.data;
            d.tasks = d.tasks.filter((x) => x.id !== t.id);
            delete d.scores[t.id];
            Store.setMeta({ lastTask: '' });
            Store.commit('change');
        };
    }

    async function editTask(id, cls) {
        const t = id ? Store.task(id) : { title: '', kind: '', date: new Date().toISOString().slice(0, 10), max: { read: 10, think: 10, write: 10 }, note: '' };
        const presets = Presets.TASKS;
        const r = await U.sheet({
            title: id ? 'แก้ไขชิ้นงาน' : `เพิ่มชิ้นงาน ชั้น ${cls}`, icon: 'fa-clipboard-list', tone: ['var(--hero-1)', 'var(--hero-2)', 'var(--hero-3)'], width: 760,
            sub: 'เลือกชิ้นงานสำเร็จรูปด้านล่าง ระบบเติมชื่อและคะแนนเต็มให้ (แก้ได้ทุกช่อง)',
            body: `<div class="preset-grid">${Presets.KINDS.map((k) => `<div><small>${esc(k)}</small>${presets.map((p, i) => (p.kind === k ? `<button type="button" class="chip" data-tp="${i}">${esc(p.title)}</button>` : '')).join('')}</div>`).join('')}</div>
                <div class="row g-2 mt-1">
                <div class="col-12"><label class="form-label">ชื่อชิ้นงาน</label><input class="form-control" id="et-title" value="${esc(t.title)}" placeholder="เช่น อ่านบทความแล้วสรุปใจความสำคัญ"></div>
                <div class="col-6"><label class="form-label">ประเภท</label><select class="form-select" id="et-kind">${U.options(['', ...Presets.KINDS], t.kind)}</select></div>
                <div class="col-6"><label class="form-label">วันที่</label><input class="form-control" type="date" id="et-date" value="${esc(t.date)}"></div>
                ${Core.ASPECTS.map((a) => `<div class="col-4"><label class="form-label">${a.name} (เต็ม)</label><input class="form-control text-center" type="number" min="0" max="100" inputmode="numeric" id="et-${a.id}" value="${t.max[a.id]}"></div>`).join('')}
                <div class="col-12"><small class="text-muted">ใส่ 0 = ชิ้นงานนี้ไม่ประเมินด้านนั้น</small></div></div>`,
            didOpen: (pop) => pop.querySelectorAll('[data-tp]').forEach((b) => {
                b.onclick = () => {
                    const p = presets[+b.dataset.tp];
                    pop.querySelector('#et-title').value = p.title;
                    pop.querySelector('#et-kind').value = p.kind;
                    Core.IDS.forEach((a) => { pop.querySelector(`#et-${a}`).value = p.max[a]; });
                    pop.querySelectorAll('[data-tp]').forEach((x) => x.classList.toggle('active', x === b));
                };
            }),
            confirmText: '<i class="fas fa-check"></i> บันทึกชิ้นงาน',
            preConfirm: () => {
                const v = (x) => document.getElementById(x).value;
                const title = U.norm(v('et-title'));
                if (!title) { Swal.showValidationMessage('กรุณากรอกชื่อชิ้นงาน หรือเลือกจากชิ้นงานสำเร็จรูป'); return false; }
                const max = {};
                Core.IDS.forEach((a) => { max[a] = Math.max(0, U.toNum(v(`et-${a}`), 0)); });
                if (!Core.IDS.some((a) => max[a] > 0)) { Swal.showValidationMessage('ต้องมีคะแนนเต็มอย่างน้อย 1 ด้าน'); return false; }
                return { title, kind: v('et-kind'), date: v('et-date'), max };
            },
        });
        if (!r.isConfirmed) return;
        let tid = id;
        if (id) Object.assign(t, r.value);
        else { tid = U.uid('t'); Store.data.tasks.push(Object.assign({ id: tid, cls, term: Store.term(), note: '' }, r.value)); }
        Store.setMeta({ lastTask: tid });
        Store.commit('change', { normalize: true });
        App.go('scores', { cls, task: tid });
        U.toast('บันทึกชิ้นงานแล้ว — กรอกคะแนนได้เลย', { type: 'ok' });
    }

    /* ============================ แปลผลรายคน ============================ */
    V.results = {
        render(el, params) {
            const classes = Store.classList();
            el.innerHTML = U.hero({ icon: 'fa-ranking-star', title: 'แปลผลรายคน', sub: `${esc(Store.termText())} • คำนวณจากคะแนนทุกชิ้นงาน ถ่วงน้ำหนัก แล้วแปลผล 4 ระดับ` });
            if (!classes.length) { el.innerHTML += UI.needStudents(); return; }
            const cls = UI.currentClass(params.cls);
            const lv = ['3', '2', '1', '0'].includes(params.lv) ? Number(params.lv) : null;
            const res = Store.result(cls);
            const rows = res.rows.filter((x) => lv == null || x.r.level === lv);
            const ac = (r, a) => `<td class="c">${UI.pct(r.aspects[a].pct)}</td><td class="c">${UI.level(r.aspects[a].level, true)}</td>`;
            el.innerHTML += UI.classPills(cls)
                + UI.seg('rs-lv', [{ key: 'all', label: 'ทั้งหมด', icon: 'fa-users', count: res.rows.length }, ...Core.LV.map((l) => ({ key: String(l), label: Core.LEVEL[l].name, count: res.count.total[l] }))], lv == null ? 'all' : String(lv))
                + UI.panel({
                    title: `ผลการประเมินชั้น ${esc(cls)}`, sub: `ชิ้นงาน ${res.tasks.length} ชิ้น • เฉลี่ยรวม ${UI.pct(res.avg.total)} • กดชื่อเพื่อดูคะแนนรายชิ้นงาน`, icon: 'fa-ranking-star', tone: 'ok', flush: true,
                    tools: `<a class="btn-x ghost sm" href="#/reports?type=record&cls=${encodeURIComponent(cls)}"><i class="fas fa-file-word"></i>แบบบันทึกผล</a>`,
                    body: `<div class="dt-wrap"><table class="dt res-table"><thead><tr><th class="c">เลขที่</th><th class="sticky-name">ชื่อ - สกุล</th>${Core.ASPECTS.map((a) => `<th class="c" colspan="2"><i class="fas ${a.icon}" style="color:${a.color}"></i> ${a.name}</th>`).join('')}<th class="c">รวมถ่วงน้ำหนัก</th><th class="c">ผลการประเมิน</th></tr></thead>
                    <tbody>${rows.map(({ st, r }) => `<tr class="${r.remedial ? 'row-bad' : ''}"><td class="c">${esc(st.no)}</td><td class="sticky-name"><a href="#" class="stu-link" data-stu="${st.id}"><b>${esc(Store.fullName(st))}</b></a>${r.missing ? `<small class="d-block text-muted">ยังไม่มีคะแนน ${r.missing} รายการ</small>` : ''}</td>${Core.IDS.map((a) => ac(r, a)).join('')}<td class="c fw-bold">${UI.pct(r.total)}</td><td class="c">${UI.level(r.level)}</td></tr>`).join('') || U.emptyRow(10, 'fa-filter', 'ไม่มีนักเรียนในระดับนี้')}</tbody></table></div>`,
                });
            UI.bindPills(el, (c) => App.go('results', { cls: c }));
            UI.bindSeg(el, 'rs-lv', (k) => App.go('results', k === 'all' ? { cls } : { cls, lv: k }));
            el.querySelectorAll('[data-stu]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); showStudent(a.dataset.stu); }; });
        },
    };
    function showStudent(sid) {
        const st = Store.student(sid);
        const tasks = Store.tasksOf(st.cls);
        const r = Core.studentResult(Store.data, sid, tasks);
        const sc = (t, a) => { if (!(t.max[a] > 0)) return '<span class="text-muted">·</span>'; const v = ((Store.data.scores[t.id] || {})[sid] || {})[a]; return Core.isNum(v) ? `${v}<small>/${t.max[a]}</small>` : '<span class="tag warn">ยังไม่มี</span>'; };
        U.sheet({
            title: Store.fullName(st), sub: `ชั้น ${esc(st.cls)} เลขที่ ${esc(st.no)} • ${esc(Store.termText())}`, icon: 'fa-user-graduate', tone: ['var(--hero-1)', 'var(--hero-2)', 'var(--hero-3)'], width: 820, showCancel: false, confirmText: 'ปิด',
            body: `<div class="asp-row mini">${Core.ASPECTS.map((a) => `<div class="asp-card asp-${a.id}"><div class="asp-top">${UI.ic(a.icon, a.id)}<div><b>${a.name}</b><small>${r.aspects[a.id].got}/${r.aspects[a.id].max}</small></div><strong>${UI.pct(r.aspects[a.id].pct)}</strong></div>${UI.level(r.aspects[a.id].level)}</div>`).join('')}
                <div class="asp-card"><div class="asp-top">${UI.ic('fa-star', 'ac')}<div><b>รวมถ่วงน้ำหนัก</b><small>&nbsp;</small></div><strong>${UI.pct(r.total)}</strong></div>${UI.level(r.level)}</div></div>
                <div class="dt-wrap mt-2"><table class="dt"><thead><tr><th>ชิ้นงาน</th>${Core.ASPECTS.map((a) => `<th class="c">${a.short}</th>`).join('')}</tr></thead><tbody>${tasks.map((t) => `<tr><td>${esc(t.title)}<small class="d-block text-muted">${t.date ? esc(U.thDate(t.date)) : ''}</small></td>${Core.IDS.map((a) => `<td class="c">${sc(t, a)}</td>`).join('')}</tr>`).join('') || U.emptyRow(4, 'fa-clipboard', 'ยังไม่มีชิ้นงาน')}</tbody></table></div>`,
        });
    }
    V.results.showStudent = showStudent;

    /* ============================ สรุปรายห้อง / ระดับชั้น ============================ */
    V.summary = {
        leave: killCharts,
        render(el, params) {
            killCharts();
            const classes = Store.classList();
            el.innerHTML = U.hero({ icon: 'fa-chart-column', title: 'สรุปผลรายห้อง / ระดับชั้น', sub: `${esc(Store.termText())} • จำนวนนักเรียนแต่ละระดับ คะแนนเฉลี่ยรายด้าน` });
            if (!classes.length) { el.innerHTML += UI.needStudents(); return; }
            const by = params.by === 'grade' ? 'grade' : 'class';
            const res = classes.map((c) => Store.result(c));
            let groups;
            if (by === 'grade') {
                const g = [...new Set(classes.map(Core.gradeOf))];
                groups = g.map((name) => Object.assign(Core.mergeResults(res.filter((x) => Core.gradeOf(x.cls) === name)), { name, n: res.filter((x) => Core.gradeOf(x.cls) === name).length }));
            } else groups = res.map((x) => Object.assign({ name: x.cls }, x));
            const all = Core.mergeResults(res);
            const line = (g, bold) => { const n = g.rows.length; const c = g.count.total; return `<tr${bold ? ' class="fw-bold tr-total"' : ''}><td>${esc(g.name)}</td><td class="c">${n}</td>${Core.LV.map((l) => `<td class="c">${c[l]} <small class="text-muted">(${Core.pctOf(c[l], n)})</small></td>`).join('')}<td class="c">${UI.pct(g.avg.read)}</td><td class="c">${UI.pct(g.avg.think)}</td><td class="c">${UI.pct(g.avg.write)}</td><td class="c">${UI.pct(g.avg.total)}</td><td class="c">${Core.pctOf(c[3] + c[2], n)}</td><td class="c">${g.remedial.length}</td></tr>`; };
            el.innerHTML += UI.seg('sm-by', [{ key: 'class', label: 'รายห้อง', icon: 'fa-door-open', count: classes.length }, { key: 'grade', label: 'ระดับชั้น', icon: 'fa-layer-group', count: new Set(classes.map(Core.gradeOf)).size }], by)
                + `<div class="dash-grid2">
                    ${UI.panel({ title: 'จำนวนนักเรียนแต่ละระดับ', icon: 'fa-chart-column', tone: 'info', body: '<div class="chart-box tall"><canvas id="sm-c1"></canvas></div>' })}
                    ${UI.panel({ title: 'คะแนนเฉลี่ยรายด้าน (ร้อยละ)', icon: 'fa-chart-bar', tone: 'purple', body: '<div class="chart-box tall"><canvas id="sm-c2"></canvas></div>' })}
                </div>`
                + UI.panel({ title: by === 'grade' ? 'ตารางสรุปตามระดับชั้น' : 'ตารางสรุปรายห้อง', sub: 'จำนวนคน (ร้อยละ)', icon: 'fa-table', tone: 'teal', flush: true,
                    tools: '<a class="btn-x ghost sm" href="#/reports?type=memo"><i class="fas fa-file-word"></i>รายงานสรุป Word</a>',
                    body: `<div class="dt-wrap"><table class="dt"><thead><tr><th>${by === 'grade' ? 'ระดับชั้น' : 'ห้อง'}</th><th class="c">จำนวน</th>${Core.LV.map((l) => `<th class="c">${Core.LEVEL[l].name}</th>`).join('')}<th class="c">อ่าน</th><th class="c">คิดวิเคราะห์</th><th class="c">เขียน</th><th class="c">เฉลี่ยรวม</th><th class="c">% ดีขึ้นไป</th><th class="c">ซ่อมเสริม</th></tr></thead>
                    <tbody>${groups.map((g) => line(g)).join('')}${line(Object.assign({ name: 'รวมทั้งหมด' }, all), true)}</tbody></table></div>` });
            UI.bindSeg(el, 'sm-by', (k) => App.go('summary', k === 'grade' ? { by: 'grade' } : null));
            if (!window.Chart) return;
            charts.push(new Chart(el.querySelector('#sm-c1'), {
                type: 'bar',
                data: { labels: groups.map((g) => g.name), datasets: Core.LV.map((l) => ({ label: Core.LEVEL[l].name, data: groups.map((g) => g.count.total[l]), backgroundColor: tone[l], borderRadius: 6 })) },
                options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } } },
            }));
            charts.push(new Chart(el.querySelector('#sm-c2'), {
                type: 'bar',
                data: { labels: groups.map((g) => g.name), datasets: [...Core.ASPECTS.map((a) => ({ label: a.name, data: groups.map((g) => (g.avg[a.id] == null ? null : Math.round(g.avg[a.id] * 100) / 100)), backgroundColor: a.color, borderRadius: 6 })), { label: 'รวมถ่วงน้ำหนัก', data: groups.map((g) => (g.avg.total == null ? null : Math.round(g.avg.total * 100) / 100)), backgroundColor: '#0f172a', borderRadius: 6 }] },
                options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { min: 0, max: 100 } } },
            }));
        },
    };

    /* ============================ ซ่อมเสริม ============================ */
    V.remedial = {
        render(el, params) {
            const classes = Store.classList();
            el.innerHTML = U.hero({ icon: 'fa-hand-holding-heart', title: 'นักเรียนที่ต้องซ่อมเสริม', sub: 'ผลรวมหรือด้านใดด้านหนึ่งอยู่ในระดับ "ไม่ผ่าน" • เลือกกิจกรรมซ่อมเสริมสำเร็จรูปและบันทึกผล' });
            if (!classes.length) { el.innerHTML += UI.needStudents(); return; }
            const cls = params.cls && (params.cls === '*' || classes.includes(params.cls)) ? params.cls : '*';
            const res = (cls === '*' ? classes : [cls]).map((c) => Store.result(c));
            const list = Core.mergeResults(res).remedial;
            const rem = Store.data.remedial;
            const key = (sid) => `${Store.term()}:${sid}`;
            const rTone = (x) => (/ผ่านเกณฑ์/.test(x) ? 'ok' : /กำลัง/.test(x) ? 'info' : /ยังไม่ผ่าน/.test(x) ? 'bad' : 'warn');
            el.innerHTML += UI.classPills(cls, { all: true }) + UI.panel({
                title: `รายชื่อ ${list.length} คน`, sub: cls === '*' ? 'ทุกห้อง' : `ชั้น ${esc(cls)}`, icon: 'fa-list', tone: 'bad', flush: true,
                tools: `<a class="btn-x ghost sm" href="#/reports?type=remedial&cls=${encodeURIComponent(cls)}"><i class="fas fa-file-word"></i>บัญชีรายชื่อ Word</a>`,
                body: `<div class="dt-wrap"><table class="dt"><thead><tr><th>ชั้น</th><th class="c">เลขที่</th><th>ชื่อ - สกุล</th><th>ด้านที่ไม่ผ่าน</th><th class="c">ร้อยละรวม</th><th>กิจกรรมซ่อมเสริม</th><th>ผล</th><th class="c">บันทึก</th></tr></thead><tbody>
                ${list.map(({ st, r }) => { const x = rem[key(st.id)] || {}; return `<tr><td>${esc(st.cls)}</td><td class="c">${esc(st.no)}</td><td class="fw-bold">${esc(Store.fullName(st))}</td><td>${r.weak.length ? r.weak.map((a) => `<i class="asp-chip asp-${a}">${Core.ASPECT[a].short} ${UI.pct(r.aspects[a].pct)}</i>`).join(' ') : '<span class="text-muted">ผลรวม</span>'}</td><td class="c">${UI.pct(r.total)}</td><td class="rm-act">${esc(x.activity || '') || '<span class="text-muted">ยังไม่ได้เลือก</span>'}</td><td>${x.result ? UI.tag(rTone(x.result), x.result) : UI.tag('warn', 'ยังไม่ดำเนินการ')}</td><td class="c"><button type="button" class="btn-x primary sm" data-rm="${st.id}"><i class="fas fa-pen"></i>บันทึก</button></td></tr>`; }).join('') || U.emptyRow(8, 'fa-face-smile', 'ไม่มีนักเรียนที่ต้องซ่อมเสริม')}
                </tbody></table></div>`,
            });
            UI.bindPills(el, (c) => App.go('remedial', { cls: c }));
            el.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => editRemedial(b.dataset.rm); });
        },
    };
    async function editRemedial(sid) {
        const st = Store.student(sid);
        const k = `${Store.term()}:${sid}`;
        const x = Store.data.remedial[k] || {};
        const r = await U.sheet({
            title: `ซ่อมเสริม: ${Store.fullName(st)}`, sub: `ชั้น ${esc(st.cls)} เลขที่ ${esc(st.no)}`, icon: 'fa-hand-holding-heart', tone: ['var(--hero-1)', 'var(--hero-2)', 'var(--hero-3)'], width: 760,
            body: `<label class="form-label">กิจกรรมซ่อมเสริม (กดเลือก หรือพิมพ์เอง)</label>${UI.presetInput('rm-act', x.activity, Presets.REMEDIAL, { area: true, rows: 2 })}
                <div class="row g-2 mt-1"><div class="col-md-6"><label class="form-label">ผลการซ่อมเสริม</label><select class="form-select" id="rm-res">${U.options(Presets.REMEDIAL_RESULT, x.result || Presets.REMEDIAL_RESULT[0])}</select></div>
                <div class="col-md-6"><label class="form-label">หมายเหตุ</label><input class="form-control" id="rm-note" value="${esc(x.note || '')}"></div></div>`,
            didOpen: (pop) => UI.bindPresets(pop, { 'rm-act': Presets.REMEDIAL }, 'append'),
            confirmText: '<i class="fas fa-check"></i> บันทึก',
            preConfirm: () => ({ activity: document.getElementById('rm-act').value.trim(), result: document.getElementById('rm-res').value, note: U.norm(document.getElementById('rm-note').value) }),
        });
        if (!r.isConfirmed) return;
        Store.data.remedial[k] = r.value;
        Store.commit('change');
        U.toast('บันทึกการซ่อมเสริมแล้ว', { type: 'ok' });
    }
})();

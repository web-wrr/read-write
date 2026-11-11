/* =====================================================================
   หน้า: หน้าหลัก • ข้อมูลโรงเรียน • ทะเบียนนักเรียน (+นำเข้า Excel) • เกณฑ์/ตัวชี้วัด/น้ำหนัก
   ===================================================================== */
(function () {
    'use strict';
    const esc = U.esc;
    const V = (window.Views = window.Views || {});
    const charts = [];
    const killCharts = () => { while (charts.length) { try { charts.pop().destroy(); } catch (e) { /* ข้าม */ } } };
    const heroSide = (items) => items.map((x) => `<div class="hero-stat${x.cls ? ` ${x.cls}` : ''}"><i class="fas ${x.icon}"></i><b>${x.v}</b> ${x.t}</div>`).join('');

    /* ============================ หน้าหลัก ============================ */
    V.dashboard = {
        leave: killCharts,
        render(el) {
            killCharts();
            const d = Store.data;
            const classes = Store.classList();
            const res = classes.map((c) => Store.result(c));
            const all = Core.mergeResults(res);
            const n = all.rows.length;
            const tasks = d.tasks.filter((t) => t.term === Store.term());
            const good = all.count.total[3] + all.count.total[2];
            let html = U.hero({ icon: 'fa-book-open-reader', title: 'การอ่าน คิดวิเคราะห์ และเขียน', sub: `${esc(d.school.name || 'ยังไม่ได้ตั้งชื่อโรงเรียน')} • ${esc(Store.termText())}`, cls: 'hero--dash',
                side: n ? heroSide([{ icon: 'fa-star', v: `${Core.pctOf(good, n)}%`, t: 'ดีขึ้นไป' }, { icon: 'fa-hand-holding-heart', v: all.remedial.length, t: 'ต้องซ่อมเสริม', cls: all.remedial.length ? 'is-alert' : '' }]) : '' });
            if (!classes.length) { el.innerHTML = html + UI.needStudents(); return; }
            html += `<div class="dash-stats">
                ${UI.stat('fa-user-graduate', n, `นักเรียน ${classes.length} ห้อง`, 'info', '#/students')}
                ${UI.stat('fa-clipboard-list', tasks.length, 'ชิ้นงานภาคเรียนนี้', 'purple', '#/scores')}
                ${UI.stat('fa-chart-line', UI.pct(all.avg.total), 'คะแนนเฉลี่ยรวม (ร้อยละ)', 'teal', '#/summary')}
                ${UI.stat('fa-medal', all.count.total[3], 'ระดับดีเยี่ยม', 'ok', '#/results')}
                ${UI.stat('fa-thumbs-up', all.count.total[2], 'ระดับดี', 'info', '#/results')}
                ${UI.stat('fa-circle-check', all.count.total[1], 'ระดับผ่าน', 'warn', '#/results')}
                ${UI.stat('fa-triangle-exclamation', all.count.total[0], 'ไม่ผ่าน', 'bad', '#/remedial')}
            </div>`;
            const aspectCards = Core.ASPECTS.map((a) => `<div class="asp-card asp-${a.id}">
                <div class="asp-top">${UI.ic(a.icon, a.id, 'lg')}<div><b>${a.name}</b><small>น้ำหนัก ${d.criteria.weights[a.id]}%</small></div><strong>${UI.pct(all.avg[a.id])}</strong></div>
                ${UI.levelBar(all.count[a.id])}</div>`).join('');
            const classRows = res.map((r) => `<tr><td><a href="#/results?cls=${encodeURIComponent(r.cls)}" class="fw-bold">${esc(r.cls)}</a></td><td class="c">${r.rows.length}</td><td class="c">${r.tasks.length}</td><td class="c">${UI.pct(r.avg.total)}</td><td style="min-width:220px">${UI.levelBar(r.count.total)}</td><td class="c">${r.remedial.length ? UI.tag('bad', `${r.remedial.length} คน`) : UI.tag('ok', 'ไม่มี')}</td></tr>`).join('');
            const remList = all.remedial.slice(0, 8).map(({ st, r }) => `<li><span><b>${esc(Store.fullName(st))}</b><small>${esc(st.cls)} เลขที่ ${esc(st.no)} • ${esc(r.weak.map((a) => Core.ASPECT[a].short).join(', ') || 'ผลรวม')}</small></span>${UI.tag('bad', `${UI.pct(r.total)}%`)}</li>`).join('');
            html += `<div class="asp-row">${aspectCards}</div>
            <div class="dash-grid2">
                ${UI.panel({ title: 'ผลการประเมินรายห้อง', sub: 'สัดส่วน ดีเยี่ยม / ดี / ผ่าน / ไม่ผ่าน', icon: 'fa-chart-column', tone: 'info', body: '<div class="chart-box tall"><canvas id="dash-chart"></canvas></div>' })}
                ${UI.panel({ title: 'สรุปรายห้อง', icon: 'fa-table-list', tone: 'teal', flush: true, body: `<div class="dt-wrap"><table class="dt"><thead><tr><th>ห้อง</th><th class="c">นักเรียน</th><th class="c">ชิ้นงาน</th><th class="c">เฉลี่ย</th><th>ระดับ</th><th class="c">ซ่อมเสริม</th></tr></thead><tbody>${classRows}</tbody></table></div><div class="p-3">${UI.levelLegend()}</div>` })}
                ${UI.panel({ title: 'นักเรียนที่ต้องซ่อมเสริม', sub: 'ด้านใดด้านหนึ่งหรือผลรวมไม่ผ่านเกณฑ์', icon: 'fa-hand-holding-heart', tone: 'bad', cls: 'panel--pink', tools: '<a class="btn-x ghost sm" href="#/remedial">ดูทั้งหมด</a>', body: remList ? `<ul class="mini-list">${remList}</ul>` : UI.empty('fa-face-smile', 'ไม่มีนักเรียนที่ต้องซ่อมเสริม', '') })}
            </div>`;
            el.innerHTML = html;
            if (window.Chart) {
                const ctx = el.querySelector('#dash-chart');
                charts.push(new Chart(ctx, {
                    type: 'bar',
                    data: { labels: res.map((r) => r.cls), datasets: Core.LV.map((l) => ({ label: Core.LEVEL[l].name, data: res.map((r) => r.count.total[l]), backgroundColor: ['#e11d48', '#f59e0b', '#2563eb', '#16a34a'][l], borderRadius: 6 })) },
                    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } } },
                }));
            }
        },
    };

    /* ============================ ข้อมูลโรงเรียน ============================ */
    V.school = {
        render(el) {
            const s = Store.data.school;
            const f = (id, label, val, ph, col) => `<div class="${col || 'col-md-6'}"><label class="form-label" for="${id}">${label}</label><input class="form-control" id="${id}" value="${esc(val)}" placeholder="${esc(ph || '')}"></div>`;
            el.innerHTML = U.hero({ icon: 'fa-school', title: 'ข้อมูลโรงเรียน / ผู้ลงนาม', sub: 'ตั้งครั้งเดียว ใช้ในทุกรายงานและบันทึกข้อความ' })
                + UI.panel({ title: 'หน่วยงาน', icon: 'fa-building-columns', body: `<div class="row g-3">
                    ${f('sc-name', 'ชื่อโรงเรียน', s.name, 'เช่น โรงเรียนบ้าน...')}
                    ${f('sc-agency', 'ส่วนราชการ (หัวบันทึกข้อความ)', s.agency, 'เช่น โรงเรียน... อำเภอ... จังหวัด...')}
                    ${f('sc-area', 'สังกัด / เขตพื้นที่', s.area, 'สำนักงานเขตพื้นที่การศึกษา...')}
                    <div class="col-md-3"><label class="form-label">ภาคเรียน</label><select class="form-select" id="sc-sem">${U.options([{ value: '1', text: 'ภาคเรียนที่ 1' }, { value: '2', text: 'ภาคเรียนที่ 2' }], s.semester)}</select></div>
                    <div class="col-md-3"><label class="form-label">ปีการศึกษา</label><input class="form-control" id="sc-year" inputmode="numeric" maxlength="4" value="${esc(s.academicYear)}"></div>
                    <div class="col-12"><label class="form-label">ตราโรงเรียน (แสดงที่เมนูซ้าย)</label><div class="logo-row"><span class="logo-box" id="sc-logo-box">${s.logo ? `<img src="${s.logo}" alt="">` : '<i class="fas fa-image"></i>'}</span>
                        <button type="button" class="btn-x ghost sm" id="sc-logo"><i class="fas fa-upload"></i>เลือกรูป</button>${s.logo ? '<button type="button" class="btn-x ghost sm" id="sc-logo-x" data-demo-allow><i class="fas fa-xmark"></i>เอาตราออก</button>' : ''}</div></div>
                </div>` })
                + UI.panel({ title: 'ผู้ลงนามในเอกสาร', sub: 'ครูประจำชั้นกำหนดที่หน้า "ทะเบียนนักเรียนรายห้อง"', icon: 'fa-signature', tone: 'purple', body: `<div class="row g-3">
                    ${f('sc-dir', 'ผู้อำนวยการโรงเรียน', s.director, 'ชื่อ - สกุล', 'col-md-4')}
                    ${f('sc-aca', 'หัวหน้ากลุ่มบริหารวิชาการ', s.academicHead, 'ชื่อ - สกุล', 'col-md-4')}
                    ${f('sc-mea', 'หัวหน้างานวัดผลและประเมินผล', s.measureHead, 'ชื่อ - สกุล', 'col-md-4')}
                    <div class="col-12"><div class="note"><i class="fas fa-circle-info"></i><div>ช่องที่เว้นว่างจะแสดงเป็นจุดไข่ปลาในเอกสาร ให้เขียนด้วยมือได้ • คำว่าตำแหน่งแก้ได้ที่เมนู "แม่แบบเอกสาร"</div></div></div>
                </div>` })
                + '<div class="form-actions"><button type="button" class="btn-x primary lg" id="sc-save"><i class="fas fa-floppy-disk"></i>บันทึกข้อมูลโรงเรียน</button></div>';
            const $ = (id) => el.querySelector(`#${id}`);
            $('sc-save').onclick = () => {
                const y = $('sc-year').value.trim();
                if (!/^25\d\d$/.test(y)) { U.alert('ปีการศึกษาไม่ถูกต้อง', 'กรุณากรอก พ.ศ. 4 หลัก เช่น 2569', 'warning'); return; }
                Object.assign(s, { name: U.norm($('sc-name').value), agency: U.norm($('sc-agency').value), area: U.norm($('sc-area').value), semester: $('sc-sem').value, academicYear: y, director: U.norm($('sc-dir').value), academicHead: U.norm($('sc-aca').value), measureHead: U.norm($('sc-mea').value) });
                Store.commit('term');
                U.toast('บันทึกข้อมูลโรงเรียนแล้ว', { type: 'ok' });
            };
            $('sc-logo').onclick = async () => {
                const file = await U.pickFile('image/*');
                if (!file) return;
                if (file.size > 3 * 1024 * 1024) { U.alert('ไฟล์ใหญ่เกินไป', 'กรุณาเลือกรูปไม่เกิน 3 MB', 'warning'); return; }
                const img = new Image();
                img.onload = () => {
                    const k = Math.min(1, 256 / Math.max(img.width, img.height));
                    const cv = document.createElement('canvas');
                    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
                    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                    s.logo = cv.toDataURL('image/png');
                    URL.revokeObjectURL(img.src);
                    Store.commit('change');
                    U.toast('เปลี่ยนตราโรงเรียนแล้ว', { type: 'ok' });
                };
                img.onerror = () => U.alert('เปิดรูปไม่ได้', 'กรุณาเลือกไฟล์รูป .png หรือ .jpg', 'error');
                img.src = URL.createObjectURL(file);
            };
            if ($('sc-logo-x')) $('sc-logo-x').onclick = () => { s.logo = ''; Store.commit('change'); };
        },
    };

    /* ============================ ทะเบียนนักเรียน ============================ */
    let importRows = [];
    V.students = {
        render(el, params) {
            const tab = params.tab === 'import' ? 'import' : 'list';
            const classes = Store.classList();
            el.innerHTML = U.hero({ icon: 'fa-user-graduate', title: 'ทะเบียนนักเรียนรายห้อง', sub: `${classes.length} ห้อง • ${Store.data.students.length} คน`,
                side: '<button type="button" class="btn-x cta" id="st-add-cls"><i class="fas fa-plus"></i>เพิ่มห้องเรียน</button>' })
                + UI.seg('st-tab', [{ key: 'list', label: 'รายชื่อรายห้อง', icon: 'fa-users', count: Store.data.students.length }, { key: 'import', label: 'นำเข้าจาก Excel', icon: 'fa-file-excel' }], tab)
                + '<div id="st-body"></div>';
            UI.bindSeg(el, 'st-tab', (k) => App.go('students', k === 'import' ? { tab: 'import' } : null));
            el.querySelector('#st-add-cls').onclick = () => editClass(null);
            const body = el.querySelector('#st-body');
            if (tab === 'import') renderImport(body); else renderList(body, params);
        },
    };

    function renderList(body, params) {
        const classes = Store.classList();
        if (!classes.length) { body.innerHTML = UI.needStudents(); return; }
        const cls = UI.currentClass(params.cls);
        const info = Store.classInfo(cls) || {};
        const list = Store.studentsOf(cls);
        body.innerHTML = UI.classPills(cls) + UI.panel({
            title: `ชั้น ${esc(cls)}`, sub: `ครูประจำชั้น/ครูผู้สอน: ${esc(info.teacher || 'ยังไม่ได้ระบุ')}`, icon: 'fa-users', tone: 'info', flush: true,
            tools: `<button type="button" class="btn-x ghost sm" id="st-edit-cls"><i class="fas fa-pen"></i>แก้ไขห้อง</button>
                <button type="button" class="btn-x ghost sm" id="st-del-cls" data-act="delete"><i class="fas fa-trash"></i>ลบห้อง</button>
                <button type="button" class="btn-x primary sm" id="st-add"><i class="fas fa-user-plus"></i>เพิ่มนักเรียน</button>
                <button type="button" class="btn-x green sm" id="st-xlsx"><i class="fas fa-file-excel"></i>ส่งออก Excel</button>`,
            body: `<div class="dt-wrap"><table class="dt"><thead><tr><th class="c" style="width:70px">เลขที่</th><th>เลขประจำตัว</th><th>ชื่อ - สกุล</th><th class="c" style="width:110px">จัดการ</th></tr></thead><tbody>
                ${list.length ? list.map((s) => `<tr><td class="c">${esc(s.no)}</td><td>${esc(s.code)}</td><td class="fw-bold">${esc(Store.fullName(s))}</td><td class="c"><button type="button" class="icon-btn" data-edit="${s.id}" title="แก้ไข"><i class="fas fa-pen"></i></button> <button type="button" class="icon-btn del" data-del="${s.id}" title="ลบ"><i class="fas fa-trash"></i></button></td></tr>`).join('') : U.emptyRow(4, 'fa-user-plus', 'ยังไม่มีนักเรียนในห้องนี้ — กด "เพิ่มนักเรียน" หรือนำเข้าจาก Excel')}
            </tbody></table></div>`,
        });
        UI.bindPills(body, (c) => App.go('students', { cls: c }));
        body.querySelector('#st-edit-cls').onclick = () => editClass(cls);
        body.querySelector('#st-del-cls').onclick = () => delClass(cls);
        body.querySelector('#st-add').onclick = () => editStudent(null, cls);
        body.querySelector('#st-xlsx').onclick = () => Excel.exportStudents();
        body.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => editStudent(b.dataset.edit, cls); });
        body.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => delStudent(b.dataset.del); });
    }

    async function editClass(name) {
        const info = name ? Store.classInfo(name) : { name: '', teacher: '' };
        const r = await U.sheet({
            title: name ? `แก้ไขห้อง ${name}` : 'เพิ่มห้องเรียน', icon: 'fa-door-open', tone: ['var(--hero-1)', 'var(--hero-2)', 'var(--hero-3)'],
            body: `<div class="row g-2"><div class="col-5"><label class="form-label">ชั้น/ห้อง</label><input class="form-control" id="ec-name" value="${esc(info.name)}" placeholder="เช่น ป.6/1"></div>
                <div class="col-7"><label class="form-label">ครูประจำชั้น / ครูผู้สอน</label><input class="form-control" id="ec-t" value="${esc(info.teacher)}" placeholder="ชื่อ - สกุล"></div></div>`,
            confirmText: '<i class="fas fa-check"></i> บันทึก',
            preConfirm: () => {
                const n = Store.normClass(document.getElementById('ec-name').value);
                if (!n) { Swal.showValidationMessage('กรุณากรอกชื่อห้อง'); return false; }
                if (n !== name && Store.classInfo(n)) { Swal.showValidationMessage('มีห้องนี้อยู่แล้ว'); return false; }
                return { name: n, teacher: U.norm(document.getElementById('ec-t').value) };
            },
        });
        if (!r.isConfirmed) return;
        const d = Store.data;
        if (name) {
            const c = Store.classInfo(name);
            c.teacher = r.value.teacher;
            if (r.value.name !== name) {
                c.name = r.value.name;
                d.students.forEach((s) => { if (s.cls === name) s.cls = r.value.name; });
                d.tasks.forEach((t) => { if (t.cls === name) t.cls = r.value.name; });
            }
        } else d.classes.push(r.value);
        Store.setMeta({ lastClass: r.value.name });
        Store.commit('change', { normalize: true });
        U.toast('บันทึกห้องเรียนแล้ว', { type: 'ok' });
    }
    async function delClass(name) {
        const n = Store.studentsOf(name).length;
        const ok = await U.confirm(`ลบห้อง ${name}?`, `นักเรียน ${n} คน ชิ้นงานและคะแนนของห้องนี้จะถูกลบทั้งหมด`, { danger: true, confirmText: '<i class="fas fa-trash"></i> ลบห้อง' });
        if (!ok) return;
        const d = Store.data;
        const tids = d.tasks.filter((t) => t.cls === name).map((t) => t.id);
        d.tasks = d.tasks.filter((t) => t.cls !== name);
        tids.forEach((id) => { delete d.scores[id]; });
        d.students = d.students.filter((s) => s.cls !== name);
        d.classes = d.classes.filter((c) => c.name !== name);
        Store.setMeta({ lastClass: '' });
        Store.commit('change', { normalize: true });
        U.toast(`ลบห้อง ${U.esc(name)} แล้ว`, { type: 'ok' });
    }
    async function editStudent(id, cls) {
        const s = id ? Store.student(id) : { no: Store.studentsOf(cls).length + 1, code: '', prefix: 'ด.ช.', firstName: '', lastName: '', cls };
        const r = await U.sheet({
            title: id ? 'แก้ไขข้อมูลนักเรียน' : `เพิ่มนักเรียน ชั้น ${cls}`, icon: 'fa-user-pen', tone: ['var(--hero-1)', 'var(--hero-2)', 'var(--hero-3)'],
            body: `<div class="row g-2">
                <div class="col-4"><label class="form-label">เลขที่</label><input class="form-control" id="es-no" inputmode="numeric" value="${esc(s.no)}"></div>
                <div class="col-8"><label class="form-label">เลขประจำตัว</label><input class="form-control" id="es-code" inputmode="numeric" value="${esc(s.code)}"></div>
                <div class="col-4"><label class="form-label">คำนำหน้า</label><select class="form-select" id="es-pre">${U.options(Store.PREFIXES, s.prefix)}</select></div>
                <div class="col-8"><label class="form-label">ชั้น/ห้อง</label><select class="form-select" id="es-cls">${U.options(Store.classList(), s.cls)}</select></div>
                <div class="col-6"><label class="form-label">ชื่อ</label><input class="form-control" id="es-first" value="${esc(s.firstName)}"></div>
                <div class="col-6"><label class="form-label">สกุล</label><input class="form-control" id="es-last" value="${esc(s.lastName)}"></div></div>`,
            confirmText: '<i class="fas fa-check"></i> บันทึก',
            preConfirm: () => {
                const v = (x) => document.getElementById(x).value;
                if (!U.norm(v('es-first'))) { Swal.showValidationMessage('กรุณากรอกชื่อ'); return false; }
                return { no: U.toInt(v('es-no'), ''), code: U.norm(v('es-code')), prefix: v('es-pre'), firstName: U.norm(v('es-first')), lastName: U.norm(v('es-last')), cls: v('es-cls') };
            },
        });
        if (!r.isConfirmed) return;
        if (id) Object.assign(s, r.value); else Store.data.students.push(Object.assign({ id: U.uid('s') }, r.value));
        Store.commit('change', { normalize: true });
        U.toast('บันทึกข้อมูลนักเรียนแล้ว', { type: 'ok' });
    }
    async function delStudent(id) {
        const s = Store.student(id);
        const ok = await U.confirm('ลบนักเรียนคนนี้?', `${U.esc(Store.fullName(s))} (${U.esc(s.cls)}) และคะแนนทั้งหมดของนักเรียนคนนี้`, { danger: true, confirmText: '<i class="fas fa-trash"></i> ลบ' });
        if (!ok) return;
        const d = Store.data;
        d.students = d.students.filter((x) => x.id !== id);
        Object.values(d.scores).forEach((m) => { delete m[id]; });
        Store.commit('change', { normalize: true });
    }

    function renderImport(body) {
        const classes = Store.classList();
        body.innerHTML = UI.panel({ title: 'นำเข้ารายชื่อจาก Excel / CSV', sub: 'คอลัมน์: เลขที่ • เลขประจำตัว • คำนำหน้า • ชื่อ • สกุล • ชั้น/ห้อง (ไม่มีคอลัมน์ชั้น = ใช้ห้องที่เลือก)', icon: 'fa-file-excel', tone: 'ok', body: `
                <div class="row g-3 align-items-end">
                    <div class="col-md-4"><label class="form-label">ห้องเริ่มต้น (ถ้าไฟล์ไม่มีคอลัมน์ชั้น)</label><input class="form-control" id="im-cls" list="im-cls-list" value="${esc(UI.currentClass())}" placeholder="เช่น ป.6/1"><datalist id="im-cls-list">${classes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
                    <div class="col-md-8 d-flex flex-wrap gap-2">
                        <button type="button" class="btn-x primary" id="im-file" data-demo-lock="นำเข้ารายชื่อจาก Excel"><i class="fas fa-file-arrow-up"></i>เลือกไฟล์ Excel / CSV</button>
                        <button type="button" class="btn-x ghost" id="im-tpl"><i class="fas fa-download"></i>ดาวน์โหลดไฟล์แม่แบบ</button>
                    </div>
                    <div class="col-12"><label class="form-label">หรือคัดลอกจาก Excel แล้ววางที่นี่ (มีแถวหัวคอลัมน์หรือไม่ก็ได้)</label><textarea class="form-control" id="im-paste" rows="4" placeholder="เลขที่&#9;เลขประจำตัว&#9;ชื่อ-สกุล&#9;ชั้น"></textarea>
                        <button type="button" class="btn-x ghost sm mt-2" id="im-paste-go" data-demo-lock="วางรายชื่อจำนวนมาก"><i class="fas fa-paste"></i>อ่านข้อมูลที่วาง</button></div>
                </div>` }) + '<div id="im-preview"></div>';
        const $ = (id) => body.querySelector(`#${id}`);
        $('im-tpl').onclick = () => Excel.template();
        $('im-file').onclick = async () => {
            if (!VSDemo.allow('นำเข้ารายชื่อจาก Excel')) return;
            const file = await U.pickFile('.xlsx,.xls,.csv');
            if (!file) return;
            try { importRows = await Excel.readStudents(file, $('im-cls').value); } catch (e) { U.alert('อ่านไฟล์ไม่ได้', U.esc(e.message), 'error'); return; }
            preview(body);
        };
        $('im-paste-go').onclick = () => {
            if (!VSDemo.allow('วางรายชื่อจำนวนมาก')) return;
            const rows = $('im-paste').value.split(/\r?\n/).map((l) => l.split('\t'));
            importRows = Excel.parseRows(rows, $('im-cls').value);
            preview(body);
        };
    }
    function preview(body) {
        const box = body.querySelector('#im-preview');
        if (!importRows.length) { box.innerHTML = UI.panel({ title: 'ไม่พบรายชื่อ', icon: 'fa-circle-exclamation', tone: 'bad', body: UI.empty('fa-table', 'อ่านรายชื่อไม่ได้', 'ตรวจว่ามีคอลัมน์ "ชื่อ" หรือข้อมูลเรียง เลขที่ • เลขประจำตัว • ชื่อ-สกุล • ชั้น') }); return; }
        const noCls = importRows.filter((r) => !r.cls).length;
        const dup = importRows.filter((r) => Store.data.students.some((s) => s.cls === r.cls && s.firstName === r.firstName && s.lastName === r.lastName)).length;
        box.innerHTML = UI.panel({ title: `ตรวจก่อนนำเข้า ${importRows.length} คน`, sub: `${dup ? `ซ้ำกับที่มีอยู่ ${dup} คน (จะข้าม) • ` : ''}${noCls ? `ไม่มีชั้น ${noCls} คน (จะข้าม)` : 'ข้อมูลครบ'}`, icon: 'fa-list-check', tone: 'info', flush: true,
            tools: '<button type="button" class="btn-x primary sm" id="im-go" data-demo-lock="นำเข้ารายชื่อ"><i class="fas fa-check"></i>นำเข้า</button>',
            body: `<div class="dt-wrap"><table class="dt"><thead><tr><th>เลขที่</th><th>เลขประจำตัว</th><th>ชื่อ - สกุล</th><th>ชั้น</th></tr></thead><tbody>${importRows.map((r) => `<tr${!r.cls ? ' class="row-bad"' : ''}><td>${esc(r.no)}</td><td>${esc(r.code)}</td><td>${esc(`${r.prefix}${r.firstName} ${r.lastName}`)}</td><td>${r.cls ? esc(r.cls) : UI.tag('bad', 'ไม่มีชั้น')}</td></tr>`).join('')}</tbody></table></div>` });
        box.querySelector('#im-go').onclick = () => {
            if (!VSDemo.allow('นำเข้ารายชื่อ')) return;
            const d = Store.data;
            let n = 0;
            importRows.forEach((r) => {
                if (!r.cls || d.students.some((s) => s.cls === r.cls && s.firstName === r.firstName && s.lastName === r.lastName)) return;
                d.students.push(Object.assign({ id: U.uid('s') }, r));
                n += 1;
            });
            importRows = [];
            Store.commit('change', { normalize: true, immediate: true });
            U.toast(`นำเข้ารายชื่อ ${n} คนแล้ว`, { type: 'ok' });
            App.go('students');
        };
    }

    /* ============================ เกณฑ์ / ตัวชี้วัด / น้ำหนัก ============================ */
    V.criteria = {
        render(el) {
            const cr = Store.data.criteria;
            const rg = Core.cutRanges(cr.cut);
            const wsum = Core.IDS.reduce((a, x) => a + (Number(cr.weights[x]) || 0), 0);
            el.innerHTML = U.hero({ icon: 'fa-sliders', title: 'เกณฑ์การประเมิน ตัวชี้วัด และน้ำหนัก', sub: 'คะแนนรายชิ้นงาน → ร้อยละรายด้าน → รวมถ่วงน้ำหนัก → แปลผล 4 ระดับอัตโนมัติ' })
                + `<div class="dash-grid2">
                ${UI.panel({ title: 'น้ำหนักคะแนนแต่ละด้าน (ร้อยละ)', sub: wsum === 100 ? 'รวม 100 พอดี' : `รวม ${wsum} — ระบบคิดตามสัดส่วนให้อัตโนมัติ`, icon: 'fa-scale-balanced', tone: 'purple', body: `<div class="row g-3">${Core.ASPECTS.map((a) => `<div class="col-4"><label class="form-label"><i class="fas ${a.icon}" style="color:${a.color}"></i> ${a.name}</label><input class="form-control text-center fw-bold" type="number" min="0" max="100" inputmode="numeric" id="cw-${a.id}" value="${cr.weights[a.id]}"></div>`).join('')}
                    <div class="col-12 d-flex flex-wrap gap-2"><span class="small text-muted align-self-center">ชุดสำเร็จรูป:</span>
                        <button type="button" class="chip" data-w="35,30,35" data-demo-allow>35 / 30 / 35</button><button type="button" class="chip" data-w="34,33,33" data-demo-allow>เท่ากัน</button><button type="button" class="chip" data-w="30,40,30" data-demo-allow>เน้นคิดวิเคราะห์ 30 / 40 / 30</button><button type="button" class="chip" data-w="30,30,40" data-demo-allow>เน้นเขียน 30 / 30 / 40</button></div></div>` })}
                ${UI.panel({ title: 'เกณฑ์แปลผล (คะแนนร้อยละขั้นต่ำ)', sub: 'ใช้กับทั้งรายด้านและผลรวม', icon: 'fa-ranking-star', tone: 'ok', body: `<div class="row g-3">
                    ${[['excellent', 3], ['good', 2], ['pass', 1]].map(([k, l]) => `<div class="col-4"><label class="form-label">${UI.level(l)} ตั้งแต่</label><input class="form-control text-center fw-bold" type="number" min="0" max="100" step="0.5" inputmode="decimal" id="cc-${k}" value="${cr.cut[k]}"></div>`).join('')}
                    <div class="col-12"><table class="dt"><thead><tr><th>ระดับ</th><th>ช่วงคะแนนร้อยละ</th><th>ความหมาย</th></tr></thead><tbody>
                        <tr><td>${UI.level(3)}</td><td>${rg[3]}</td><td>อ่าน คิดวิเคราะห์ และเขียนได้ดีเยี่ยม</td></tr>
                        <tr><td>${UI.level(2)}</td><td>${rg[2]}</td><td>อ่าน คิดวิเคราะห์ และเขียนได้ดี</td></tr>
                        <tr><td>${UI.level(1)}</td><td>${rg[1]}</td><td>ผ่านเกณฑ์ขั้นต่ำ</td></tr>
                        <tr><td>${UI.level(0)}</td><td>${rg[0]}</td><td>ต้องซ่อมเสริม</td></tr></tbody></table></div>
                    <div class="col-12 d-flex flex-wrap gap-2"><span class="small text-muted align-self-center">ชุดสำเร็จรูป:</span><button type="button" class="chip" data-c="80,65,50" data-demo-allow>80 / 65 / 50</button><button type="button" class="chip" data-c="80,70,60" data-demo-allow>80 / 70 / 60</button><button type="button" class="chip" data-c="75,60,50" data-demo-allow>75 / 60 / 50</button></div></div>` })}
                </div>`
                + UI.panel({ title: 'ตัวชี้วัด (แสดงในหน้าบันทึกคะแนนและคู่มือ)', sub: 'แก้ข้อความได้ บรรทัดละ 1 ตัวชี้วัด', icon: 'fa-list-check', tone: 'info', body: `<div class="row g-3">${Core.ASPECTS.map((a) => `<div class="col-lg-4"><label class="form-label"><i class="fas ${a.icon}" style="color:${a.color}"></i> ${a.name}</label><textarea class="form-control" rows="4" id="ci-${a.id}">${esc(cr.indicators[a.id].join('\n'))}</textarea></div>`).join('')}</div>` })
                + `<div class="form-actions"><button type="button" class="btn-x ghost" id="cr-default" data-demo-allow><i class="fas fa-rotate-left"></i>คืนค่าเริ่มต้น</button><button type="button" class="btn-x primary lg" id="cr-save"><i class="fas fa-floppy-disk"></i>บันทึกเกณฑ์</button></div>`;
            const $ = (id) => el.querySelector(`#${id}`);
            el.querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => { const v = b.dataset.w.split(','); Core.IDS.forEach((a, i) => { $(`cw-${a}`).value = v[i]; }); }; });
            el.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { const v = b.dataset.c.split(','); ['excellent', 'good', 'pass'].forEach((k, i) => { $(`cc-${k}`).value = v[i]; }); }; });
            $('cr-default').onclick = async () => {
                if (!(await U.confirm('คืนค่าเกณฑ์เริ่มต้น?', 'น้ำหนัก 35/30/35 • เกณฑ์ 80/65/50 • ตัวชี้วัดชุดเดิม'))) return;
                Store.data.criteria = U.clone(Core.DEFAULT_CRITERIA);
                Store.commit('change');
            };
            $('cr-save').onclick = () => {
                const w = {}; const c = {};
                Core.IDS.forEach((a) => { w[a] = Math.max(0, Math.min(100, U.toNum($(`cw-${a}`).value, 0))); });
                ['excellent', 'good', 'pass'].forEach((k) => { c[k] = Math.max(0, Math.min(100, U.toNum($(`cc-${k}`).value, 0))); });
                if (!Core.IDS.some((a) => w[a] > 0)) { U.alert('น้ำหนักไม่ถูกต้อง', 'ต้องมีน้ำหนักอย่างน้อย 1 ด้าน', 'warning'); return; }
                if (!(c.excellent > c.good && c.good > c.pass)) { U.alert('เกณฑ์ไม่ถูกต้อง', 'ต้องเรียง ดีเยี่ยม &gt; ดี &gt; ผ่าน', 'warning'); return; }
                cr.weights = w; cr.cut = c;
                Core.IDS.forEach((a) => { cr.indicators[a] = $(`ci-${a}`).value.split('\n').map(U.norm).filter(Boolean); });
                Store.commit('change');
                U.toast('บันทึกเกณฑ์แล้ว — ผลการประเมินคำนวณใหม่ทั้งหมด', { type: 'ok' });
            };
        },
    };
})();

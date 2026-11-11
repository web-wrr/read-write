/* =====================================================================
   หน้า: รายงาน Word/Excel (พิมพ์เป็นชุด) • ทะเบียนคุมเลขที่ • แม่แบบเอกสาร • สำรองข้อมูล
   ===================================================================== */
(function () {
    'use strict';
    const esc = U.esc;
    const V = (window.Views = window.Views || {});
    const TYPES = [
        { key: 'record', label: 'แบบบันทึกผลรายห้อง', icon: 'fa-table-list' },
        { key: 'score', label: 'คะแนนรายชิ้นงาน', icon: 'fa-table-cells' },
        { key: 'remedial', label: 'บัญชีซ่อมเสริม', icon: 'fa-hand-holding-heart' },
        { key: 'memo', label: 'บันทึกข้อความรายงานผล', icon: 'fa-envelope-open-text' },
        { key: 'excel', label: 'ส่งออก Excel', icon: 'fa-file-excel' },
    ];
    let memoForm = null; // ค่าที่แก้ในฟอร์มบันทึกข้อความ (คงไว้ระหว่างเปลี่ยนห้อง)
    let fitHandler = null;
    const GARUDA = 'assets/vendor/garuda.png';

    function nextNo() {
        const y = Store.data.school.academicYear;
        return Store.data.register.filter((r) => r.year === y).reduce((a, r) => Math.max(a, r.no), 0) + 1;
    }
    const docNoText = (no, year) => `${Store.data.tpl.docPrefix ? `${Store.data.tpl.docPrefix}` : ''}${no}/${year}`;

    V.reports = {
        leave() { if (fitHandler) window.removeEventListener('resize', fitHandler); fitHandler = null; },
        render(el, params) {
            const classes = Store.classList();
            const type = TYPES.some((t) => t.key === params.type) ? params.type : 'record';
            el.innerHTML = U.hero({ icon: 'fa-file-word', title: 'รายงาน Word / Excel', sub: 'ตัวอย่างบนจอตรงกับไฟล์ .docx • เลือก "ทุกห้อง" เพื่อพิมพ์เป็นชุด' })
                + UI.seg('rp-type', TYPES, type);
            if (!classes.length) { el.innerHTML += UI.needStudents(); return; }
            const cls = params.cls === '*' || (params.cls && classes.includes(params.cls)) ? params.cls : (type === 'memo' || type === 'remedial' || type === 'excel' ? '*' : UI.currentClass());
            const names = cls === '*' ? null : [cls];
            const ctx = Docs.context(Store.data, names, Store.term());
            UI.bindSeg(el, 'rp-type', (k) => App.go('reports', { type: k, cls }));
            el.insertAdjacentHTML('beforeend', UI.classPills(cls, { all: true }));
            UI.bindPills(el, (c) => App.go('reports', { type, cls: c }));
            const fname = `${cls === '*' ? 'ทุกห้อง' : cls.replace('/', '-')}_ภาค${ctx.term}-${Store.data.school.academicYear}`;

            if (type === 'excel') {
                el.insertAdjacentHTML('beforeend', UI.panel({ title: 'ส่งออกผลการประเมินเป็น Excel', sub: 'ชีตสรุปรายห้อง + ผลรายคนและคะแนนรายชิ้นงานแยกตามห้อง', icon: 'fa-file-excel', tone: 'ok', body: `
                    <div class="dash-stats">${UI.stat('fa-users', ctx.merged.rows.length, `นักเรียน ${ctx.classes.length} ห้อง`, 'info')}${UI.stat('fa-clipboard-list', ctx.classes.reduce((a, k) => a + k.tasks.length, 0), 'ชิ้นงาน', 'purple')}${UI.stat('fa-chart-line', UI.pct(ctx.merged.avg.total), 'เฉลี่ยรวม', 'teal')}</div>
                    <button type="button" class="btn-x green lg" id="rp-xlsx"><i class="fas fa-file-excel"></i>ดาวน์โหลด Excel (${esc(cls === '*' ? 'ทุกห้อง' : cls)})</button>` }));
                el.querySelector('#rp-xlsx').onclick = () => { const n = Excel.exportResults(names); U.toast(`สร้างไฟล์ ${esc(n)} แล้ว`, { type: 'ok' }); };
                return;
            }

            let formHtml = '';
            if (type === 'memo') {
                const def = Docs.memoDefaults(ctx, new Date());
                memoForm = Object.assign(def, memoForm || {}, { suggestions: (memoForm && memoForm.suggestions) || def.suggestions });
                const f = memoForm;
                formHtml = UI.panel({ title: 'ข้อมูลบันทึกข้อความ', sub: 'ช่องว่าง = จุดไข่ปลาให้เขียนเอง • ข้อความหลักแก้ที่เมนู "แม่แบบเอกสาร"', icon: 'fa-pen-to-square', tone: 'purple', body: `<div class="row g-2">
                    <div class="col-md-6"><label class="form-label">ส่วนราชการ</label><input class="form-control" data-mf="agency" value="${esc(f.agency)}"></div>
                    <div class="col-md-6"><label class="form-label">ที่ (เลขที่หนังสือ)</label><div class="input-group"><input class="form-control" data-mf="docNo" value="${esc(f.docNo)}" placeholder="เว้นว่างได้"><button type="button" class="btn btn-outline-secondary" id="mf-issue" title="ออกเลขจากทะเบียนคุมเลขที่"><i class="fas fa-hashtag"></i> ออกเลข ${nextNo()}/${esc(Store.data.school.academicYear)}</button></div></div>
                    <div class="col-md-4"><label class="form-label">วันที่</label><input class="form-control" data-mf="date" value="${esc(f.date)}"></div>
                    <div class="col-md-8"><label class="form-label">เรียน</label><input class="form-control" data-mf="to" value="${esc(f.to)}"></div>
                    <div class="col-md-6"><label class="form-label">ผู้รายงาน (ชื่อ - สกุล)</label><input class="form-control" data-mf="signerName" value="${esc(f.signerName)}"></div>
                    <div class="col-md-6"><label class="form-label">ตำแหน่งผู้รายงาน</label><input class="form-control" data-mf="signerPosition" value="${esc(f.signerPosition)}"></div>
                    <div class="col-12"><label class="form-label">ข้อเสนอแนะ (บรรทัดละข้อ — กดเลือกข้อความสำเร็จรูปได้)</label>${UI.presetInput('mf-sug', f.suggestions.join('\n'), Presets.SUGGEST, { area: true, rows: 3 })}</div>
                </div>` });
            }
            const actions = `<div class="rp-actions"><button type="button" class="btn-x primary lg" id="rp-docx"><i class="fas fa-file-word"></i>ดาวน์โหลด Word (.docx)</button><button type="button" class="btn-x ghost lg" id="rp-print"><i class="fas fa-print"></i>พิมพ์ / บันทึก PDF</button>
                <span class="rp-hint"><i class="fas fa-circle-info"></i>${cls === '*' ? `พิมพ์เป็นชุด ${ctx.classes.length} ห้องในไฟล์เดียว` : `ชั้น ${esc(cls)}`} • ${esc(ctx.termFull)}</span></div>`;
            el.insertAdjacentHTML('beforeend', `<div class="rp-layout${formHtml ? ' has-form' : ''}"><div class="rp-side">${formHtml}${actions}</div><div class="pv-box" id="rp-pv"><div class="pv-inner" id="rp-inner"></div></div></div>`);

            const build = () => {
                if (type === 'record') return { html: Docs.modelsHTML(Docs.recordModels(ctx)), docx: (T) => Docs.sectionsOf(T, Docs.recordModels(ctx)), name: `แบบบันทึกผลอ่านคิดวิเคราะห์เขียน_${fname}` };
                if (type === 'score') return { html: Docs.modelsHTML(Docs.scoreModels(ctx)), docx: (T) => Docs.sectionsOf(T, Docs.scoreModels(ctx)), name: `คะแนนรายชิ้นงาน_${fname}` };
                if (type === 'remedial') return { html: Docs.modelHTML(Docs.remedialModel(ctx)), docx: (T) => [Docs.modelSection(T, Docs.remedialModel(ctx))], name: `บัญชีซ่อมเสริม_${fname}` };
                return { html: Docs.memoHTML(ctx, memoForm, GARUDA), docx: (T) => Docs.memoSections(T, ctx, memoForm), name: `บันทึกข้อความรายงานผลอ่านคิดวิเคราะห์เขียน_${fname}` };
            };
            const box = el.querySelector('#rp-pv');
            const draw = () => { el.querySelector('#rp-inner').innerHTML = build().html; UI.fitPreview(box); };
            draw();
            fitHandler = U.debounce(() => UI.fitPreview(box), 120);
            window.addEventListener('resize', fitHandler);
            setTimeout(() => UI.fitPreview(box), 300);

            if (type === 'memo') {
                const upd = U.debounce(draw, 250);
                el.querySelectorAll('[data-mf]').forEach((inp) => inp.addEventListener('input', () => { memoForm[inp.dataset.mf] = inp.value; upd(); }));
                const sug = el.querySelector('#mf-sug');
                sug.addEventListener('input', () => { memoForm.suggestions = sug.value.split('\n').map((s) => s.trim()).filter(Boolean); upd(); });
                UI.bindPresets(el, { 'mf-sug': Presets.SUGGEST }, 'append');
                el.querySelector('#mf-issue').onclick = async () => {
                    const no = nextNo();
                    const y = Store.data.school.academicYear;
                    const subject = Presets.fill(ctx.tpl.memoSubject, ctx.vars);
                    const ok = await U.confirm(`ออกเลขที่ ${no}/${y}?`, `บันทึกลงทะเบียนคุมเลขที่: <b>${esc(subject)}</b>`, { icon: 'question', confirmText: 'ออกเลข' });
                    if (!ok) return;
                    Store.data.register.push({ id: U.uid('r'), no, year: y, date: new Date().toISOString().slice(0, 10), subject, scope: cls === '*' ? 'ทุกห้อง' : cls, note: '' });
                    memoForm.docNo = docNoText(no, y);
                    Store.commit('change');
                    U.toast(`ออกเลขที่ ${esc(memoForm.docNo)} แล้ว`, { type: 'ok' });
                };
            }
            el.querySelector('#rp-docx').onclick = async () => {
                const b = build();
                try {
                    const n = await ThaiDoc.download(b.docx(ThaiDoc), `${U.safeFileName(b.name)}.docx`, { title: b.name });
                    if (n) U.toast(`สร้างไฟล์ ${esc(n)} แล้ว`, { type: 'ok' });
                } catch (e) { console.error(e); U.alert('สร้างไฟล์ไม่สำเร็จ', esc(e.message), 'error'); }
            };
            el.querySelector('#rp-print').onclick = () => UI.print(build().html);
        },
    };

    /* ============================ ทะเบียนคุมเลขที่ ============================ */
    V.register = {
        render(el) {
            const d = Store.data;
            const y = d.school.academicYear;
            const list = d.register.slice().sort((a, b) => U.cmp(b.year, a.year) || b.no - a.no);
            el.innerHTML = U.hero({ icon: 'fa-list-ol', title: 'ทะเบียนคุมเลขที่เอกสาร', sub: `เลขถัดไปของปี ${esc(y)}: ${nextNo()}/${esc(y)} • ออกเลขอัตโนมัติจากหน้ารายงานบันทึกข้อความได้`,
                side: '<button type="button" class="btn-x cta" id="rg-add"><i class="fas fa-plus"></i>ออกเลขใหม่</button>' })
                + UI.panel({ title: `ทะเบียน ${list.length} รายการ`, icon: 'fa-book', tone: 'info', flush: true,
                    body: `<div class="dt-wrap"><table class="dt"><thead><tr><th class="c">เลขที่</th><th>วันที่</th><th>เรื่อง</th><th>ขอบเขต</th><th>หมายเหตุ</th><th class="c">จัดการ</th></tr></thead><tbody>
                    ${list.map((r) => `<tr><td class="c fw-bold">${esc(docNoText(r.no, r.year))}</td><td>${r.date ? esc(U.thDate(r.date)) : ''}</td><td>${esc(r.subject)}</td><td>${esc(r.scope)}</td><td>${esc(r.note)}</td><td class="c"><button type="button" class="icon-btn" data-ed="${r.id}" title="แก้ไข"><i class="fas fa-pen"></i></button> <button type="button" class="icon-btn del" data-del="${r.id}" title="ลบ"><i class="fas fa-trash"></i></button></td></tr>`).join('') || U.emptyRow(6, 'fa-hashtag', 'ยังไม่มีการออกเลข')}
                    </tbody></table></div>` });
            el.querySelector('#rg-add').onclick = () => edit(null);
            el.querySelectorAll('[data-ed]').forEach((b) => { b.onclick = () => edit(b.dataset.ed); });
            el.querySelectorAll('[data-del]').forEach((b) => {
                b.onclick = async () => {
                    const r = d.register.find((x) => x.id === b.dataset.del);
                    if (!(await U.confirm(`ลบเลขที่ ${esc(docNoText(r.no, r.year))}?`, esc(r.subject), { danger: true, confirmText: '<i class="fas fa-trash"></i> ลบ' }))) return;
                    d.register = d.register.filter((x) => x !== r);
                    Store.commit('change');
                };
            });
            async function edit(id) {
                const r = id ? d.register.find((x) => x.id === id) : { no: nextNo(), year: y, date: new Date().toISOString().slice(0, 10), subject: '', scope: '', note: '' };
                const subs = ['รายงานผลการประเมินการอ่าน คิดวิเคราะห์ และเขียน', 'ขออนุมัติจัดกิจกรรมซ่อมเสริมการอ่าน คิดวิเคราะห์ และเขียน', 'รายงานผลการซ่อมเสริมการอ่าน คิดวิเคราะห์ และเขียน', 'ส่งแบบบันทึกผลการประเมินการอ่าน คิดวิเคราะห์ และเขียน'];
                const res = await U.sheet({
                    title: id ? 'แก้ไขรายการทะเบียน' : 'ออกเลขที่ใหม่', icon: 'fa-hashtag', tone: ['var(--hero-1)', 'var(--hero-2)', 'var(--hero-3)'], width: 720,
                    body: `<div class="row g-2"><div class="col-4"><label class="form-label">เลขที่</label><input class="form-control" id="rg-no" inputmode="numeric" value="${r.no}"></div>
                        <div class="col-4"><label class="form-label">ปี</label><input class="form-control" id="rg-y" inputmode="numeric" value="${esc(r.year)}"></div>
                        <div class="col-4"><label class="form-label">วันที่</label><input class="form-control" type="date" id="rg-d" value="${esc(r.date)}"></div>
                        <div class="col-12"><label class="form-label">เรื่อง</label>${UI.presetInput('rg-s', r.subject, subs)}</div>
                        <div class="col-6"><label class="form-label">ขอบเขต (ห้อง)</label><input class="form-control" id="rg-sc" value="${esc(r.scope)}"></div>
                        <div class="col-6"><label class="form-label">หมายเหตุ</label><input class="form-control" id="rg-n" value="${esc(r.note)}"></div></div>`,
                    didOpen: (pop) => UI.bindPresets(pop, { 'rg-s': subs }),
                    confirmText: '<i class="fas fa-check"></i> บันทึก',
                    preConfirm: () => {
                        const v = (x) => document.getElementById(x).value;
                        const no = U.toInt(v('rg-no'), 0);
                        if (no < 1) { Swal.showValidationMessage('เลขที่ไม่ถูกต้อง'); return false; }
                        if (d.register.some((x) => x.id !== id && x.no === no && x.year === v('rg-y').trim())) { Swal.showValidationMessage('เลขที่นี้ถูกใช้แล้ว'); return false; }
                        if (!U.norm(v('rg-s'))) { Swal.showValidationMessage('กรุณากรอกเรื่อง'); return false; }
                        return { no, year: v('rg-y').trim(), date: v('rg-d'), subject: U.norm(v('rg-s')), scope: U.norm(v('rg-sc')), note: U.norm(v('rg-n')) };
                    },
                });
                if (!res.isConfirmed) return;
                if (id) Object.assign(r, res.value); else d.register.push(Object.assign({ id: U.uid('r') }, res.value));
                Store.commit('change');
            }
        },
    };

    /* ============================ แม่แบบเอกสาร ============================ */
    const TPL_FIELDS = [
        ['memoSubject', 'เรื่อง (บันทึกข้อความ)', 1], ['memoTo', 'เรียน (เว้นว่าง = ผู้อำนวยการโรงเรียน...)', 1], ['memoIntro', 'ย่อหน้าที่ 1 (ตามที่...)', 3], ['memoResult', 'ย่อหน้าที่ 2 (ผลการประเมิน)', 3], ['memoClose', 'ย่อหน้าปิด', 1],
        ['refText', 'ข้อความเกณฑ์การตัดสิน (ท้ายตาราง)', 2], ['recordTitle', 'ชื่อแบบบันทึกผลรายห้อง', 1], ['scoreTitle', 'ชื่อแบบบันทึกคะแนนรายชิ้นงาน', 1], ['remedialTitle', 'ชื่อบัญชีซ่อมเสริม', 1], ['summaryTitle', 'ชื่อตารางสรุปแนบท้าย', 1],
        ['teacherPos', 'ตำแหน่ง: ครู', 1], ['measurePos', 'ตำแหน่ง: งานวัดผล', 1], ['academicPos', 'ตำแหน่ง: วิชาการ', 1], ['directorPos', 'ตำแหน่ง: ผู้บริหาร', 1], ['docPrefix', 'คำนำหน้าเลขที่หนังสือ (เช่น ศธ 04xxx.xxx/)', 1],
    ];
    V.templates = {
        render(el) {
            const tpl = Store.data.tpl;
            const vars = ['โรงเรียน', 'ภาคเรียน', 'ปีการศึกษา', 'ภาคเรียนเต็ม', 'ขอบเขต', 'จำนวน', 'ดีขึ้นไป', 'ร้อยละดีขึ้นไป', 'ซ่อมเสริม', 'ช่วงดีเยี่ยม', 'ช่วงดี', 'ช่วงผ่าน', 'ช่วงไม่ผ่าน'];
            el.innerHTML = U.hero({ icon: 'fa-file-pen', title: 'แม่แบบเอกสาร', sub: 'แก้ข้อความทุกส่วนของรายงานได้ • ใช้ตัวแปรในวงเล็บปีกกา ระบบเติมค่าให้อัตโนมัติ' })
                + UI.panel({ title: 'ตัวแปรที่ใช้ได้', sub: 'กดเพื่อคัดลอก', icon: 'fa-code', tone: 'teal', body: `<div class="preset-chips">${vars.map((v) => `<button type="button" class="chip" data-var="{${v}}" data-demo-allow>{${esc(v)}}</button>`).join('')}</div>
                    <div class="note mt-2"><i class="fas fa-triangle-exclamation"></i><div>ข้อความเริ่มต้นอ้างอิงหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช 2551 — ควรให้งานวัดผล/วิชาการตรวจเทียบกับแนวปฏิบัติและแบบฟอร์มฉบับปัจจุบันของโรงเรียน/เขตพื้นที่ก่อนใช้จริง</div></div>` })
                + UI.panel({ title: 'ข้อความในเอกสาร', icon: 'fa-pen-nib', tone: 'purple', body: `<div class="row g-3">${TPL_FIELDS.map(([k, label, rows]) => `<div class="${rows > 1 ? 'col-12' : 'col-md-6'}"><label class="form-label">${esc(label)}</label>${rows > 1 ? `<textarea class="form-control" rows="${rows}" data-tpl="${k}">${esc(tpl[k] || '')}</textarea>` : `<input class="form-control" data-tpl="${k}" value="${esc(tpl[k] || '')}">`}</div>`).join('')}
                    <div class="col-12"><label class="form-label">ข้อเสนอแนะเริ่มต้น (บรรทัดละข้อ)</label>${UI.presetInput('tp-sug', (tpl.suggestions || []).join('\n'), Presets.SUGGEST, { area: true, rows: 3 })}</div></div>` })
                + '<div class="form-actions"><button type="button" class="btn-x ghost" id="tp-reset" data-demo-allow><i class="fas fa-rotate-left"></i>คืนค่าเริ่มต้น</button><button type="button" class="btn-x primary lg" id="tp-save"><i class="fas fa-floppy-disk"></i>บันทึกแม่แบบ</button></div>';
            UI.bindPresets(el, { 'tp-sug': Presets.SUGGEST }, 'append');
            el.querySelectorAll('[data-var]').forEach((b) => { b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.var); } catch (e) { /* ข้าม */ } U.toast(`คัดลอก ${esc(b.dataset.var)} แล้ว`); }; });
            el.querySelector('#tp-save').onclick = () => {
                el.querySelectorAll('[data-tpl]').forEach((i) => { tpl[i.dataset.tpl] = i.value.trim(); });
                tpl.suggestions = el.querySelector('#tp-sug').value.split('\n').map((s) => s.trim()).filter(Boolean);
                memoForm = null;
                Store.commit('change');
                U.toast('บันทึกแม่แบบเอกสารแล้ว', { type: 'ok' });
            };
            el.querySelector('#tp-reset').onclick = async () => {
                if (!(await U.confirm('คืนค่าแม่แบบเริ่มต้น?', 'ข้อความที่แก้ไว้ทั้งหมดจะกลับเป็นค่าเริ่มต้น'))) return;
                Store.data.tpl = U.clone(Presets.TEMPLATE);
                memoForm = null;
                Store.commit('change');
            };
        },
    };

    /* ============================ สำรอง / เปิดไฟล์ ============================ */
    V.backup = {
        render(el) {
            const m = Store.meta;
            el.innerHTML = U.hero({ icon: 'fa-floppy-disk', title: 'สำรอง / เปิดไฟล์ข้อมูล', sub: 'ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้ — บันทึกเป็นไฟล์ .json เพื่อสำรองหรือย้ายเครื่อง' })
                + `<div class="dash-grid2">
                ${UI.panel({ title: 'บันทึกไฟล์ข้อมูล (.json)', sub: `สำรองล่าสุด: ${m.lastBackupAt ? esc(U.thDate(m.lastBackupAt, true)) : 'ยังไม่เคยสำรอง'}`, icon: 'fa-download', tone: 'ok', body: '<p>เก็บไฟล์ไว้ในแฟลชไดรฟ์ หรือ Google Drive ทุกครั้งที่บันทึกคะแนนเสร็จ</p><button type="button" class="btn-x green lg" id="bk-save"><i class="fas fa-download"></i>บันทึกไฟล์ข้อมูล</button>' })}
                ${UI.panel({ title: 'เปิดไฟล์ข้อมูล', sub: 'แทนที่ข้อมูลปัจจุบันด้วยไฟล์ที่เลือก', icon: 'fa-folder-open', tone: 'info', body: `<p>ใช้ย้ายข้อมูลจากเครื่องอื่น หรือกู้คืนจากไฟล์สำรอง</p><button type="button" class="btn-x primary lg" id="bk-open" data-demo-lock="เปิดไฟล์ข้อมูล (.json)"><i class="fas fa-folder-open"></i>เปิดไฟล์ข้อมูล</button>
                    ${Store.hasPrevious() ? '<button type="button" class="btn-x ghost lg" id="bk-prev" data-demo-lock="กู้คืนข้อมูลชุดก่อน"><i class="fas fa-clock-rotate-left"></i>กู้คืนข้อมูลชุดก่อนหน้า</button>' : ''}` })}
                ${UI.panel({ title: 'ข้อมูลตัวอย่าง / เริ่มใหม่', icon: 'fa-flask', tone: 'warn', cls: 'panel--orange', body: `<p>ทดลองด้วยข้อมูลตัวอย่าง (ชื่อสมมติ) หรือล้างข้อมูลทั้งหมดเพื่อเริ่มใช้งานจริง</p>
                    <button type="button" class="btn-x orange" id="bk-demo"><i class="fas fa-flask"></i>โหลดข้อมูลตัวอย่าง</button>
                    <button type="button" class="btn-x ghost" id="bk-reset" data-demo-lock="ล้างข้อมูลทั้งหมด"><i class="fas fa-broom"></i>ล้างข้อมูลทั้งหมด</button>` })}
                </div>`;
            const $ = (id) => el.querySelector(`#${id}`);
            $('bk-save').onclick = App.backupNow;
            $('bk-open').onclick = App.openFile;
            if ($('bk-prev')) $('bk-prev').onclick = async () => {
                if (!VSDemo.allow('กู้คืนข้อมูลชุดก่อน')) return;
                if (!(await U.confirm('กู้คืนข้อมูลชุดก่อนหน้า?', 'ข้อมูลปัจจุบันจะสลับกับชุดก่อนหน้า (สลับกลับได้)'))) return;
                Store.restorePrevious();
                U.toast('กู้คืนแล้ว', { type: 'ok' });
            };
            $('bk-demo').onclick = async () => {
                if (!Store.isEmpty() && !(await U.confirm('โหลดข้อมูลตัวอย่าง?', 'ข้อมูลปัจจุบันจะถูกแทนที่ (กู้คืนชุดก่อนได้ที่หน้านี้) — แนะนำให้บันทึกไฟล์สำรองก่อน'))) return;
                App.loadDemo();
            };
            $('bk-reset').onclick = async () => {
                if (!VSDemo.allow('ล้างข้อมูลทั้งหมด')) return;
                const r = await Swal.fire({ title: 'ล้างข้อมูลทั้งหมด?', html: 'รายชื่อ ชิ้นงาน คะแนน และทะเบียนทั้งหมดจะถูกลบ<br>พิมพ์คำว่า <b>ล้างข้อมูล</b> เพื่อยืนยัน', icon: 'warning', input: 'text', showCancelButton: true, confirmButtonText: 'ล้างข้อมูล', cancelButtonText: 'ยกเลิก', buttonsStyling: false, reverseButtons: true, customClass: { popup: 'swal-x', confirmButton: 'btn-x orange lg', cancelButton: 'btn-x ghost lg' }, preConfirm: (v) => (v.trim() === 'ล้างข้อมูล' ? true : (Swal.showValidationMessage('กรุณาพิมพ์ "ล้างข้อมูล"'), false)) });
                if (!r.isConfirmed) return;
                Store.resetAll();
                Store.setMeta({ dismissedWelcome: true });
                U.toast('ล้างข้อมูลแล้ว (กู้คืนชุดก่อนได้ที่หน้านี้)', { type: 'ok' });
            };
        },
    };
})();

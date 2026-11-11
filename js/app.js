/* =====================================================================
   ตัวควบคุมหลัก: เมนู, เปลี่ยนหน้า (#/หน้า), สถานะการสำรองข้อมูล, หน้าต่างต้อนรับ
   ===================================================================== */
(function () {
    'use strict';

    const MENU = [
        { route: 'dashboard', label: 'หน้าหลัก', icon: 'fa-house' },
        { group: 'ข้อมูลพื้นฐาน' },
        { route: 'school', label: 'ข้อมูลโรงเรียน / ผู้ลงนาม', icon: 'fa-school' },
        { route: 'students', label: 'ทะเบียนนักเรียนรายห้อง', icon: 'fa-user-graduate', count: (d) => d.students.length },
        { route: 'criteria', label: 'เกณฑ์ ตัวชี้วัด น้ำหนัก', icon: 'fa-sliders' },
        { group: 'บันทึกและประเมินผล' },
        { route: 'scores', label: 'ชิ้นงาน / บันทึกคะแนน', icon: 'fa-pen-to-square', count: (d) => d.tasks.filter((t) => t.term === (d.school.semester || '1')).length },
        { route: 'results', label: 'แปลผลรายคน', icon: 'fa-ranking-star' },
        { route: 'summary', label: 'สรุปรายห้อง / ระดับชั้น', icon: 'fa-chart-column' },
        { route: 'remedial', label: 'ซ่อมเสริม', icon: 'fa-hand-holding-heart', count: () => remedialCount() },
        { group: 'รายงาน / ตั้งค่า' },
        { route: 'reports', label: 'รายงาน Word / Excel', icon: 'fa-file-word' },
        { route: 'register', label: 'ทะเบียนคุมเลขที่เอกสาร', icon: 'fa-list-ol' },
        { route: 'templates', label: 'แม่แบบเอกสาร', icon: 'fa-file-pen' },
        { route: 'backup', label: 'สำรอง / เปิดไฟล์ข้อมูล', icon: 'fa-floppy-disk' },
    ];

    function remedialCount() {
        return Store.classList().reduce((a, c) => a + Store.result(c).remedial.length, 0);
    }

    const App = { current: null, params: {}, MENU };

    App.go = (route, params) => {
        const q = params ? `?${new URLSearchParams(params).toString()}` : '';
        const target = `#/${route}${q}`;
        if (location.hash === target) App.render(); else location.hash = target;
    };
    function parseHash() {
        const h = location.hash.replace(/^#\/?/, '');
        const [route, qs] = h.split('?');
        const params = {};
        if (qs) new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
        return { route: route || 'dashboard', params };
    }

    function renderMenu() {
        const d = Store.data;
        document.getElementById('sb-menu').innerHTML = MENU.map((m) => {
            if (m.group) return `<div class="sb-group">${U.esc(m.group)}</div>`;
            const n = m.count ? m.count(d) : null;
            const badge = n ? `<span class="sb-badge">${n}</span>` : '';
            return `<a class="sb-link${App.current === m.route ? ' active' : ''}" href="#/${m.route}"><i class="fas ${m.icon}"></i><span>${U.esc(m.label)}</span>${badge}</a>`;
        }).join('');
    }
    function renderBackupBox() {
        const m = Store.meta;
        const warn = Store.needsBackup();
        const box = document.getElementById('sb-backup');
        box.className = `sb-backup${warn ? ' is-warn' : ''}`;
        box.innerHTML = `
            <b><i class="fas ${warn ? 'fa-triangle-exclamation' : 'fa-shield-halved'}"></i>${warn ? 'มีข้อมูลที่ยังไม่ได้สำรอง' : 'สำรองข้อมูลแล้ว'}</b>
            <div>สำรองล่าสุด: ${m.lastBackupAt ? U.esc(U.thDate(m.lastBackupAt, true)) : 'ยังไม่เคยสำรอง'}</div>
            <div class="sb-backup-actions">
                <button type="button" data-act="save"><i class="fas fa-download"></i> บันทึกไฟล์</button>
                <button type="button" class="ghost" data-act="open" data-demo-lock="เปิดไฟล์ข้อมูล (.json)"><i class="fas fa-folder-open"></i> เปิดไฟล์</button>
            </div>`;
        box.querySelector('[data-act="save"]').onclick = App.backupNow;
        box.querySelector('[data-act="open"]').onclick = App.openFile;
        const btn = document.getElementById('tb-backup-btn');
        btn.classList.toggle('orange', warn);
        btn.classList.toggle('green', !warn);
    }
    function renderTop() {
        const item = MENU.find((m) => m.route === App.current) || MENU[0];
        document.getElementById('tb-title').innerHTML = `<i class="fas ${item.icon}"></i><span>${U.esc(item.label)}</span>`;
        document.getElementById('tb-term').innerHTML = `<i class="fas fa-calendar-check"></i><span>${U.esc(Store.termText())}</span>`;
        const s = Store.data.school;
        document.getElementById('sb-school').textContent = s.name || 'บันทึก • แปลผล • รายงาน';
        const logo = document.getElementById('sb-logo');
        logo.innerHTML = s.logo ? `<img src="${s.logo}" alt="ตราโรงเรียน">` : '<i class="fas fa-book-open-reader"></i>';
        logo.classList.toggle('has-img', !!s.logo);
        const saved = document.getElementById('tb-saved');
        if (!Store.storageOk) saved.innerHTML = '<i class="fas fa-circle-xmark" style="color:#e11d48"></i><span>บันทึกลงเบราว์เซอร์ไม่ได้</span>';
        else if (Store.meta.lastSavedAt) saved.innerHTML = `<i class="fas fa-circle-check"></i><span>บันทึกแล้ว ${new Date(Store.meta.lastSavedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>`;
        else saved.innerHTML = '';
        document.title = `${item.label} • โปรแกรมบันทึกการอ่าน คิดวิเคราะห์ และเขียน`;
    }
    App.refreshChrome = () => { renderMenu(); renderBackupBox(); renderTop(); };

    App.render = () => {
        const { route, params } = parseHash();
        const view = window.Views[route] ? route : 'dashboard';
        const changed = App.current !== view;
        if (App.current && window.Views[App.current] && window.Views[App.current].leave) window.Views[App.current].leave();
        App.current = view;
        App.params = params;
        const el = document.getElementById('view');
        el.innerHTML = '';
        window.Views[view].render(el, params);
        if (changed) window.scrollTo(0, 0);
        App.refreshChrome();
    };
    function onStoreChange(reason) {
        if (reason === 'replace' || reason === 'reset' || reason === 'term') { App.render(); return; }
        if (reason === 'change') {
            const y = window.scrollY;
            App.render();
            window.scrollTo(0, y);
            return;
        }
        App.refreshChrome();
    }

    App.backupNow = async () => {
        const name = await Store.exportFile();
        if (name) U.toast(`บันทึกไฟล์ข้อมูลแล้ว: <b>${U.esc(name)}</b><br><small>เก็บไฟล์นี้ไว้ในแฟลชไดรฟ์/Google Drive เพื่อความปลอดภัย</small>`, { type: 'ok', ms: 5000 });
    };
    App.openFile = async () => {
        if (!VSDemo.allow('เปิดไฟล์ข้อมูล (.json)')) return;
        const file = await U.pickFile('.json,application/json');
        if (!file) return;
        let text = '';
        try { text = await U.readFileAsText(file); } catch (e) { U.alert('เปิดไฟล์ไม่สำเร็จ', U.esc(e.message), 'error'); return; }
        const res = Store.parseBackup(text);
        if (!res.ok) { U.alert('เปิดไฟล์ไม่ได้', U.esc(res.error), 'error'); return; }
        const s = res.summary;
        const ok = await U.confirm('เปิดไฟล์ข้อมูลนี้?', `
            <div style="text-align:left">
                <div class="note warn"><i class="fas fa-triangle-exclamation"></i><div>ข้อมูลในโปรแกรมตอนนี้จะถูก<b>แทนที่</b>ด้วยข้อมูลในไฟล์<br><small>(ระบบเก็บข้อมูลเดิมไว้ 1 ชุด กู้คืนได้ที่หน้า "สำรอง / เปิดไฟล์ข้อมูล")</small></div></div>
                <dl class="detail-grid">
                    <dt>ไฟล์</dt><dd>${U.esc(file.name)}</dd>
                    <dt>โรงเรียน</dt><dd>${U.esc(s.school || '-')}</dd>
                    <dt>ปีการศึกษา</dt><dd>${U.esc(s.year)}</dd>
                    <dt>นักเรียน</dt><dd>${s.students.toLocaleString()} คน • ${s.classes} ห้อง • ชิ้นงาน ${s.tasks} ชิ้น</dd>
                    <dt>บันทึกเมื่อ</dt><dd>${U.esc(U.thDate(s.savedAt, true))}</dd>
                </dl>
            </div>`, { confirmText: '<i class="fas fa-folder-open"></i> เปิดไฟล์นี้', icon: 'question' });
        if (!ok) return;
        Store.replaceAll(res.data, 'replace');
        Store.setMeta({ lastBackupAt: new Date().toISOString(), lastBackupName: file.name, lastChangeAt: new Date().toISOString() });
        App.refreshChrome();
        U.toast(`เปิดไฟล์ <b>${U.esc(file.name)}</b> แล้ว`, { type: 'ok' });
    };
    App.loadDemo = () => {
        Store.replaceAll(window.Demo.build(), 'replace');
        Store.setMeta({ lastClass: 'ป.6/2', lastTask: '' });
        U.toast('โหลดข้อมูลตัวอย่างแล้ว — ลองเปิดเมนู "ชิ้นงาน / บันทึกคะแนน" หรือ "สรุปรายห้อง"', { type: 'ok', ms: 4500 });
    };

    App.pickTerm = async () => {
        const s = Store.data.school;
        const r = await U.sheet({
            title: 'ภาคเรียนที่กำลังบันทึก', icon: 'fa-calendar-check', tone: ['var(--hero-1)', 'var(--hero-2)', 'var(--hero-3)'],
            sub: 'ชิ้นงานและคะแนนแยกตามภาคเรียน เปลี่ยนได้ตลอดเวลา',
            body: `<div class="row g-2">
                <div class="col-6"><label class="form-label">ภาคเรียน</label><select class="form-select" id="pt-term">${U.options([{ value: '1', text: 'ภาคเรียนที่ 1' }, { value: '2', text: 'ภาคเรียนที่ 2' }], s.semester)}</select></div>
                <div class="col-6"><label class="form-label">ปีการศึกษา</label><input class="form-control" id="pt-year" inputmode="numeric" maxlength="4" value="${U.esc(s.academicYear)}"></div></div>`,
            confirmText: '<i class="fas fa-check"></i> ใช้ภาคเรียนนี้',
            preConfirm: () => {
                const y = document.getElementById('pt-year').value.trim();
                if (!/^25\d\d$/.test(y)) { Swal.showValidationMessage('กรุณากรอกปีการศึกษาเป็น พ.ศ. 4 หลัก เช่น 2569'); return false; }
                return { term: document.getElementById('pt-term').value, year: y };
            },
        });
        if (!r.isConfirmed) return;
        s.semester = r.value.term;
        s.academicYear = r.value.year;
        Store.commit('term');
        U.toast(`เปลี่ยนเป็น ${U.esc(Store.termText())} แล้ว`, { type: 'ok' });
    };

    async function welcome() {
        if (!Store.isEmpty() || Store.meta.dismissedWelcome) return;
        const r = await Swal.fire({
            html: `
                <div class="sheet-head">
                    <span class="sh-ic"><i class="fas fa-book-open-reader"></i></span>
                    <div><h3>ยินดีต้อนรับสู่โปรแกรมบันทึกการอ่าน คิดวิเคราะห์ และเขียน</h3><p>บันทึกคะแนนรายชิ้นงาน แปลผล 4 ระดับอัตโนมัติ รายงานรายห้อง — ใช้งานได้โดยไม่ต้องต่ออินเทอร์เน็ต</p></div>
                </div>
                <div class="sheet-body">
                    <div class="note warn"><i class="fas fa-database"></i><div>ข้อมูลเก็บไว้ใน<b>เบราว์เซอร์ของเครื่องนี้</b> หากล้างข้อมูลเบราว์เซอร์ ข้อมูลจะหาย<br>กรุณากด <b>"บันทึกไฟล์ข้อมูล (.json)"</b> เพื่อสำรองเป็นไฟล์อยู่เสมอ</div></div>
                    <div class="steps">
                        <div class="step"><b>1</b><div><strong>รายชื่อนักเรียน</strong>นำเข้าจาก Excel รายห้อง</div></div>
                        <div class="step"><b>2</b><div><strong>บันทึกคะแนน</strong>เลือกชิ้นงานสำเร็จรูป แล้วกรอกคะแนน</div></div>
                        <div class="step"><b>3</b><div><strong>แปลผลและรายงาน</strong>ดีเยี่ยม/ดี/ผ่าน/ไม่ผ่าน • Word • Excel</div></div>
                    </div>
                </div>`,
            width: 760,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-play"></i> เริ่มใหม่ (ข้อมูลว่าง)',
            denyButtonText: '<i class="fas fa-flask"></i> ทดลองด้วยข้อมูลตัวอย่าง',
            cancelButtonText: '<i class="fas fa-folder-open"></i> เปิดไฟล์ข้อมูลเดิม',
            buttonsStyling: false,
            customClass: { popup: 'sheet', confirmButton: 'btn-x primary lg', denyButton: 'btn-x orange lg', cancelButton: 'btn-x ghost lg' },
            allowOutsideClick: false,
            didOpen: () => {
                VSDemo.lock(Swal.getConfirmButton(), 'เริ่มใหม่ (ข้อมูลว่าง)');
                VSDemo.lock(Swal.getCancelButton(), 'เปิดไฟล์ข้อมูลเดิม');
            },
        });
        Store.setMeta({ dismissedWelcome: true });
        if (r.isDenied || VSDemo.active) App.loadDemo();
        else if (r.dismiss === Swal.DismissReason.cancel) App.openFile();
        else App.go('school');
    }

    function init() {
        Store.load();
        VSDemo.onReset(() => App.loadDemo());
        Store.on(onStoreChange);
        window.addEventListener('hashchange', App.render);
        document.getElementById('tb-backup-btn').onclick = App.backupNow;
        document.getElementById('tb-term').onclick = App.pickTerm;
        window.addEventListener('beforeunload', () => Store.flush());
        App.render();
        welcome();
        setInterval(() => { renderTop(); renderBackupBox(); }, 60000);
    }

    window.App = App;
    window.Views = window.Views || {};
    document.addEventListener('DOMContentLoaded', init);
})();

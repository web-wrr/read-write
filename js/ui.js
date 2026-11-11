/* =====================================================================
   ส่วนประกอบหน้าจอที่ใช้ร่วมกันทุกหน้า (ตามแบบ vs-kit/ui/UI-PATTERN.md)
   ===================================================================== */
(function () {
    'use strict';
    const esc = U.esc;
    const TONES = { ok: ['#30D158', '#00C7BE'], warn: ['#FF9F0A', '#FF375F'], bad: ['#FF375F', '#BF5AF2'], info: ['#0A84FF', '#5E5CE6'], ac: ['var(--ac)', 'var(--ac-2)'], teal: ['#00C7BE', '#0A84FF'], purple: ['#5E5CE6', '#BF5AF2'], pink: ['#FF375F', '#FF9F0A'], read: ['#0A84FF', '#00C7BE'], think: ['#5E5CE6', '#BF5AF2'], write: ['#FF9F0A', '#FF375F'] };
    const UI = { TONES, esc };

    UI.ic = (icon, tone, size) => { const t = TONES[tone] || TONES.ac; return `<span class="ic-box ${size || 'sm'}" style="--a:${t[0]};--b:${t[1]}"><i class="fas ${icon}"></i></span>`; };
    UI.stat = (icon, value, label, tone, href) => {
        const t = TONES[tone] || TONES.ac;
        const tag = href ? 'a' : 'div';
        return `<${tag} class="stat-card" style="--a:${t[0]};--b:${t[1]}"${href ? ` href="${href}"` : ''}>${UI.ic(icon, tone, 'lg')}<div><b>${value}</b><span>${label}</span></div></${tag}>`;
    };
    UI.panel = (o) => `
        <div class="panel ${o.cls || ''}"${o.id ? ` id="${o.id}"` : ''}>
            <div class="panel-head">${UI.ic(o.icon || 'fa-list', o.tone || 'ac')}<div><h3>${o.title}</h3>${o.sub ? `<small>${o.sub}</small>` : ''}</div>
                ${o.tools ? `<div class="panel-tools">${o.tools}</div>` : ''}</div>
            <div class="panel-body${o.flush ? ' p-0' : ''}">${o.body || ''}</div>
        </div>`;
    UI.empty = (icon, title, text, action) => `<div class="empty-state">${UI.ic(icon, 'ac', 'lg')}<h3>${title}</h3><p>${text || ''}</p>${action || ''}</div>`;
    UI.tag = (tone, text, icon) => `<span class="tag ${tone || ''}">${icon ? `<i class="fas ${icon}"></i>` : ''}${esc(text)}</span>`;
    UI.seg = (id, items, active) => `<div class="tab-row"><div class="seg" id="${id}">${items.map((it) => `<button type="button" data-tab="${it.key}" class="${it.key === active ? 'active' : ''}" data-demo-allow>${it.icon ? `<i class="fas ${it.icon}"></i>` : ''}${esc(it.label)}${it.count != null ? ` <span class="cnt">${it.count}</span>` : ''}</button>`).join('')}</div></div>`;
    UI.bindSeg = (root, id, fn) => { const el = root.querySelector(`#${id}`); if (!el) return; el.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => fn(b.dataset.tab); }); };

    /** ป้ายระดับผล */
    UI.level = (l, small) => (l == null ? '<span class="lv lv-none">ยังไม่ครบ</span>' : `<span class="lv lv-${l}${small ? ' sm' : ''}">${Core.LEVEL[l].name}</span>`);
    UI.pct = (v) => (v == null ? '<span class="text-muted">-</span>' : (Math.round(v * 100) / 100).toFixed(2));

    /** ห้องเรียนปัจจุบัน */
    UI.currentClass = (param, allowAll) => {
        const list = Store.classList();
        if (allowAll && param === '*') return '*';
        if (param && list.includes(param)) return param;
        if (Store.meta.lastClass && list.includes(Store.meta.lastClass)) return Store.meta.lastClass;
        return list[0] || '';
    };
    /** แถบเลือกห้อง */
    UI.classPills = (cur, opts) => {
        const o = opts || {};
        const pills = Store.classList().map((c) => `<button type="button" class="room-pill${c === cur ? ' active' : ''}" data-cls="${esc(c)}" data-demo-allow>${esc(c)} <small>${Store.studentsOf(c).length} คน</small></button>`);
        if (o.all) pills.push(`<button type="button" class="room-pill${cur === '*' ? ' active' : ''}" data-cls="*" data-demo-allow><i class="fas fa-layer-group"></i> ทุกห้อง <small>${Store.data.students.length} คน</small></button>`);
        return `<div class="room-pills">${pills.join('')}</div>`;
    };
    UI.bindPills = (root, fn) => root.querySelectorAll('.room-pill').forEach((b) => { b.onclick = () => { if (b.dataset.cls !== '*') Store.setMeta({ lastClass: b.dataset.cls }); fn(b.dataset.cls); }; });

    UI.needStudents = () => UI.panel({ title: 'ยังไม่มีรายชื่อนักเรียน', icon: 'fa-user-graduate', body: UI.empty('fa-user-graduate', 'ยังไม่มีรายชื่อนักเรียน', 'เริ่มจากนำเข้ารายชื่อจาก Excel หรือเพิ่มห้องเรียนและรายชื่อเอง',
        '<a class="btn-x primary" href="#/students?tab=import"><i class="fas fa-file-excel"></i>นำเข้ารายชื่อ</a> <a class="btn-x ghost" href="#/students"><i class="fas fa-plus"></i>เพิ่มห้องเรียน</a>') });

    /** แถบสัดส่วนระดับ */
    UI.levelBar = (c) => {
        const n = c[3] + c[2] + c[1] + c[0] + (c.none || 0);
        if (!n) return '<div class="lvbar"><i class="lvbar-none" style="width:100%"></i></div>';
        const seg = (k, cls, label) => (c[k] ? `<i class="${cls}" style="width:${(c[k] * 100) / n}%" title="${label} ${c[k]} คน">${(c[k] * 100) / n >= 9 ? c[k] : ''}</i>` : '');
        return `<div class="lvbar">${seg(3, 'lvbar-3', 'ดีเยี่ยม')}${seg(2, 'lvbar-2', 'ดี')}${seg(1, 'lvbar-1', 'ผ่าน')}${seg(0, 'lvbar-0', 'ไม่ผ่าน')}${seg('none', 'lvbar-none', 'ยังไม่ครบ')}</div>`;
    };
    UI.levelLegend = () => `<div class="lv-legend">${Core.LV.map((l) => `<span><b class="lvbar-${l}"></b>${Core.LEVEL[l].name}</span>`).join('')}<span><b class="lvbar-none"></b>ยังไม่ครบ</span></div>`;

    /** ช่องข้อความ + ปุ่มเลือกข้อความสำเร็จรูป */
    UI.presetInput = (id, value, list, opts) => {
        const o = opts || {};
        return `<div class="preset-wrap">${o.area ? `<textarea class="form-control" id="${id}" rows="${o.rows || 2}">${esc(value || '')}</textarea>` : `<input class="form-control" id="${id}" value="${esc(value || '')}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`}
            <div class="preset-chips">${list.map((t, i) => `<button type="button" class="chip" data-preset-for="${id}" data-i="${i}" data-demo-allow title="${esc(t)}"><i class="fas fa-plus"></i>${esc(t.length > 46 ? `${t.slice(0, 44)}…` : t)}</button>`).join('')}</div></div>`;
    };
    UI.bindPresets = (root, lists, mode) => {
        root.querySelectorAll('[data-preset-for]').forEach((b) => {
            b.onclick = () => {
                const el = root.querySelector(`#${b.dataset.presetFor}`);
                const t = lists[b.dataset.presetFor][+b.dataset.i];
                if (!el) return;
                if (mode === 'append' && el.tagName === 'TEXTAREA' && el.value.trim()) el.value = `${el.value.trim()}\n${t}`;
                else el.value = t;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.focus();
            };
        });
    };

    /** ย่อหน้ากระดาษ A4 ให้พอดีกรอบตัวอย่าง */
    UI.fitPreview = (box) => {
        if (!box) return;
        const inner = box.querySelector('.pv-inner');
        if (!inner) return;
        inner.style.transform = '';
        inner.style.width = '';
        const pageW = inner.scrollWidth || 800;
        const k = Math.min(1, box.clientWidth / pageW);
        inner.style.transform = `scale(${k})`;
        inner.style.width = `${pageW}px`;
        box.style.height = `${Math.ceil(inner.scrollHeight * k)}px`;
    };
    UI.print = (html) => {
        const root = document.getElementById('print-root');
        root.innerHTML = html;
        setTimeout(() => { window.print(); }, 120);
    };

    window.UI = UI;
})();

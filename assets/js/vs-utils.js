/* ฟังก์ชันช่วยทั่วไป (ไม่ขึ้นกับข้อมูล) */
(function () {
    'use strict';

    const U = {};

    U.esc = (value) => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    U.$ = (sel, root) => (root || document).querySelector(sel);
    U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    U.uid = (prefix) => `${prefix || 'id'}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

    U.clone = (obj) => JSON.parse(JSON.stringify(obj));

    U.debounce = (fn, ms) => {
        let t = null;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    };

    const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });
    U.cmp = (a, b) => collator.compare(String(a ?? ''), String(b ?? ''));
    U.sortBy = (list, keyFn) => list.slice().sort((a, b) => U.cmp(keyFn(a), keyFn(b)));

    U.norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
    U.normKey = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

    U.toInt = (v, fallback) => {
        const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
        return Number.isFinite(n) ? n : fallback;
    };
    U.toNum = (v, fallback) => {
        const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
        return Number.isFinite(n) ? n : fallback;
    };

    /* เวลา "08:30" <-> นาที */
    U.toMin = (hhmm) => {
        const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(hhmm || '').trim());
        return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
    };
    U.fromMin = (min) => {
        if (min == null || !Number.isFinite(min)) return '';
        const h = Math.floor(min / 60) % 24;
        const m = min % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    U.timeRange = (a, b) => (a && b ? `${a}–${b}` : (a || b || ''));

    const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    U.thDate = (iso, withTime) => {
        if (!iso) return '-';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '-';
        let s = `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
        if (withTime) s += ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
        return s;
    };
    U.thDateFull = (d) => `${d.getDate()} ${TH_MONTHS_FULL[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
    U.ago = (iso) => {
        if (!iso) return 'ยังไม่เคย';
        const diff = (Date.now() - new Date(iso).getTime()) / 1000;
        if (diff < 60) return 'เมื่อสักครู่';
        if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
        return `${Math.floor(diff / 86400)} วันที่แล้ว`;
    };
    U.stamp = () => {
        const d = new Date();
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear() + 543}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
    };
    U.safeFileName = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80);

    /* สีสด ๆ สำหรับวิชา/ครู (ไม่หม่น) */
    U.PALETTE = ['#0A84FF', '#5E5CE6', '#BF5AF2', '#FF375F', '#FF9F0A', '#30D158', '#00C7BE', '#FF453A',
        '#64D2FF', '#AC8E68', '#FF6482', '#32ADE6', '#34C759', '#AF52DE', '#FF8A00', '#00A3A3',
        '#2563EB', '#DB2777', '#059669', '#D97706', '#7C3AED', '#0891B2', '#E11D48', '#65A30D'];
    U.hashColor = (key) => {
        let h = 0;
        const s = String(key || '');
        for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return U.PALETTE[h % U.PALETTE.length];
    };
    U.initials = (name) => {
        const s = U.norm(name).replace(/^(นาย|นางสาว|นาง|น\.ส\.|ว่าที่ร้อยตรี|ว่าที่ ร\.ต\.|ดร\.|Mr\.|Mrs\.|Ms\.)\s*/i, '');
        return s ? s.charAt(0) : '?';
    };

    /* ---------- Toast ---------- */
    let toastEl = null;
    let toastTimer = null;
    U.toast = (msg, opts) => {
        const o = Object.assign({ type: '', icon: '', ms: 3200, action: null, actionText: '' }, opts || {});
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'toast-x';
            document.body.appendChild(toastEl);
        }
        const icon = o.icon || ({ bad: 'fa-circle-xmark', warn: 'fa-triangle-exclamation', ok: 'fa-circle-check' }[o.type] || 'fa-circle-info');
        toastEl.className = `toast-x${o.type ? ` is-${o.type}` : ''}`;
        toastEl.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>${o.action ? `<button type="button">${U.esc(o.actionText || 'ย้อนกลับ')}</button>` : ''}`;
        if (o.action) {
            toastEl.querySelector('button').onclick = () => { toastEl.classList.remove('show'); o.action(); };
        }
        requestAnimationFrame(() => toastEl.classList.add('show'));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), o.ms);
    };

    /* ---------- SweetAlert helpers ---------- */
    const swalBase = {
        customClass: { popup: 'swal-x', confirmButton: 'btn-x primary lg', cancelButton: 'btn-x ghost lg', denyButton: 'btn-x danger lg' },
        buttonsStyling: false,
        reverseButtons: true,
        confirmButtonText: 'ตกลง',
        cancelButtonText: 'ยกเลิก',
    };
    U.alert = (title, html, icon) => Swal.fire(Object.assign({}, swalBase, { title, html, icon: icon || 'info' }));
    U.confirm = (title, html, opts) => {
        const o = opts || {};
        return Swal.fire(Object.assign({}, swalBase, {
            title,
            html,
            icon: o.icon || 'warning',
            showCancelButton: true,
            confirmButtonText: o.confirmText || 'ยืนยัน',
            cancelButtonText: o.cancelText || 'ยกเลิก',
            focusCancel: o.focusCancel !== false,
            customClass: Object.assign({}, swalBase.customClass, { confirmButton: `btn-x ${o.danger ? 'orange' : 'primary'} lg` }),
        })).then((r) => r.isConfirmed);
    };
    /* หน้าต่างฟอร์ม: head = {title, sub, icon, tone:[c1,c2,c3]} */
    U.sheet = (opts) => {
        const tone = opts.tone || ['#4338ca', '#7c3aed', '#db2777'];
        const html = `
            <div class="sheet-head" style="--s1:${tone[0]};--s2:${tone[1]};--s3:${tone[2]}">
                <span class="sh-ic"><i class="fas ${opts.icon || 'fa-pen'}"></i></span>
                <div><h3>${U.esc(opts.title)}</h3>${opts.sub ? `<p>${opts.sub}</p>` : ''}</div>
            </div>
            <div class="sheet-body">${opts.body || ''}</div>`;
        return Swal.fire({
            html,
            width: opts.width || 640,
            showCancelButton: opts.showCancel !== false,
            showConfirmButton: opts.showConfirm !== false,
            showDenyButton: !!opts.denyText,
            confirmButtonText: opts.confirmText || '<i class="fas fa-save"></i> บันทึก',
            cancelButtonText: opts.cancelText || 'ยกเลิก',
            denyButtonText: opts.denyText || '',
            buttonsStyling: false,
            reverseButtons: true,
            focusConfirm: false,
            customClass: {
                popup: 'sheet',
                confirmButton: `btn-x ${opts.confirmClass || 'primary'} lg`,
                cancelButton: 'btn-x ghost lg',
                denyButton: `btn-x ${opts.denyClass || 'danger'} lg`,
            },
            didOpen: (el) => {
                if (opts.didOpen) opts.didOpen(el);
                const first = el.querySelector('[autofocus], input:not([type=hidden]):not([type=checkbox]), select, textarea');
                if (first && opts.autofocus !== false) setTimeout(() => first.focus(), 30);
            },
            preConfirm: opts.preConfirm,
            preDeny: opts.preDeny,
        });
    };

    /* ---------- ดาวน์โหลดไฟล์ ---------- */
    U.downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    };

    U.readFileAsText = (file) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsText(file, 'utf-8');
    });
    U.readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsArrayBuffer(file);
    });
    U.pickFile = (accept) => new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept || '';
        input.style.display = 'none';
        input.onchange = () => { resolve(input.files && input.files[0] ? input.files[0] : null); input.remove(); };
        document.body.appendChild(input);
        input.click();
    });

    U.options = (list, selected, opts) => {
        const o = opts || {};
        const sel = Array.isArray(selected) ? selected.map(String) : [String(selected ?? '')];
        let html = o.placeholder ? `<option value="">${U.esc(o.placeholder)}</option>` : '';
        html += list.map((it) => {
            const v = typeof it === 'object' ? it.value : it;
            const t = typeof it === 'object' ? it.text : it;
            return `<option value="${U.esc(v)}"${sel.includes(String(v)) ? ' selected' : ''}>${U.esc(t)}</option>`;
        }).join('');
        return html;
    };

    /* ส่วนหัวหน้า (hero) ไล่สี */
    U.hero = (o) => `
        <section class="hero ${o.cls || ''}">
            <div class="hero-main">
                <span class="hero-icon"><i class="fas ${o.icon}"></i></span>
                <div><h2 class="hero-title">${U.esc(o.title)}</h2>${o.sub ? `<p class="hero-sub">${o.sub}</p>` : ''}</div>
            </div>
            <div class="hero-side">${o.side || ''}</div>
        </section>`;

    U.emptyRow = (cols, icon, text) => `<tr><td colspan="${cols}" class="dt-empty"><i class="fas ${icon}"></i>${text}</td></tr>`;

    window.U = U;
})();

/* VS Kit — โหมดทดลองใช้ (Demo mode) ใช้ร่วมกันทุกระบบ
 *
 * เปิดเมื่อ: หน้าเว็บมี window.VS_DEMO = { name, buyUrl }  (vipsys ใส่ให้เองตอนนำระบบขึ้นเป็น "ทดลองใช้")
 *            หรือเปิด URL ด้วย ?vsdemo=1 (ไว้ทดสอบบนเครื่องตัวเอง)
 * ฉบับที่ลูกค้าซื้อไปไม่มี VS_DEMO → ไฟล์นี้ไม่ทำอะไรเลย (โหลดไว้ได้ ไม่มีผล)
 *
 * วิธีใช้ในระบบ
 *   - ปุ่ม/ลิงก์/ช่องเลือกไฟล์/ฟอร์ม ที่ต้องล็อกตอนทดลอง → ใส่ data-demo-lock="ชื่อฟีเจอร์"
 *       เช่น เริ่มใหม่ (ข้อมูลว่าง), เปิดไฟล์ข้อมูลเดิม, นำเข้า Excel, วางรายชื่อ, ล้างข้อมูลทั้งหมด, กู้คืนข้อมูล
 *   - ปุ่มที่สร้างตอนรันไทม์ (เช่นปุ่มใน SweetAlert) → VSDemo.lock(element, 'ชื่อฟีเจอร์')
 *   - โค้ดที่ไม่ได้เริ่มจากการคลิก (ลากไฟล์มาวาง, วางข้อมูล, คีย์ลัด) → if (!VSDemo.allow('นำเข้าข้อมูล')) return;
 *   - VSDemo.active (true/false) ใช้ตัดสินใจในโค้ด เช่น ใส่ลายน้ำ "ฉบับทดลองใช้" ใน PDF ที่สร้างเอง
 *   - VSDemo.onReset(fn) → แถบทดลองจะมีปุ่ม "เริ่มข้อมูลตัวอย่างใหม่" เรียก fn
 *   - VSDemo.watermark → ข้อความลายน้ำมาตรฐาน
 * อัตโนมัติ: แถบ "โหมดทดลองใช้" + ปุ่มซื้อ, ล็อกปุ่ม "เริ่มใหม่ (ข้อมูลว่าง)" / "เปิดไฟล์ข้อมูลเดิม" ในหน้าต่างต้อนรับ,
 *            ลายน้ำ "ฉบับทดลองใช้" ตอนพิมพ์, หัวกระดาษ "ฉบับทดลองใช้" ในไฟล์ .docx ที่สร้างด้วย ThaiDoc
 */
(function () {
    'use strict';
    if (window.VSDemo) return; // โหลดซ้ำ (vipsys ใส่ให้ + ระบบโหลดเอง) ใช้ตัวแรก

    var cfg = window.VS_DEMO || null;
    try { if (!cfg && /[?&]vsdemo=1(&|$)/.test(location.search)) cfg = {}; } catch (e) { /* ignore */ }
    var active = !!cfg;
    cfg = cfg || {};
    var resetFns = [];
    var WATERMARK = 'ฉบับทดลองใช้';

    var api = {
        active: active,
        config: cfg,
        watermark: WATERMARK,
        /** true = ทำต่อได้ · false = โหมดทดลอง (แสดงคำอธิบายให้แล้ว) */
        allow: function (label) { if (!active) return true; notify(label); return false; },
        /** ล็อกปุ่มที่สร้างตอนรันไทม์ */
        lock: function (el, label) { if (active && el && el.setAttribute) el.setAttribute('data-demo-lock', label || textOf(el)); return el; },
        onReset: function (fn) { if (typeof fn === 'function') resetFns.push(fn); if (active) whenReady(renderBar); },
        buy: buy,
    };
    window.VSDemo = api;
    if (!active) return;

    document.documentElement.classList.add('vs-demo');

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function textOf(el) { return (el.getAttribute('aria-label') || el.title || el.textContent || '').replace(/\s+/g, ' ').trim(); }
    function whenReady(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }

    function buy() {
        var u = cfg.buyUrl;
        if (!u) return;
        try { (window.top || window).location.href = u; } catch (e) { location.href = u; }
    }

    function notify(label) {
        label = (label || '').trim() || 'ฟีเจอร์นี้';
        var why = 'ในโหมดทดลองใช้ได้กับข้อมูลตัวอย่างเท่านั้น';
        var S = window.Swal;
        // มีหน้าต่าง SweetAlert เปิดอยู่ (เช่นหน้าต้อนรับ) → แจ้งในหน้าต่างเดิม ไม่ปิดหน้าต่างนั้นทิ้ง
        if (S && S.isVisible && S.isVisible() && !document.querySelector('.swal2-popup.vsd-popup')) {
            S.showValidationMessage('<span class="vsd-vm"><i class="fas fa-lock"></i> <b>' + esc(label) + '</b> ใช้ได้เมื่อซื้อระบบแล้ว ' + why
                + (cfg.buyUrl ? ' · <a href="' + esc(cfg.buyUrl) + '" target="_top" class="vsd-link">ดูวิธีซื้อ</a>' : '') + '</span>');
            return;
        }
        if (!S) {
            if (window.confirm(label + ' ใช้ได้เมื่อซื้อระบบแล้ว\n' + why + (cfg.buyUrl ? '\n\nไปหน้าซื้อระบบนี้หรือไม่?' : ''))) buy();
            return;
        }
        S.fire({
            icon: 'info',
            title: 'ใช้ได้ในฉบับเต็ม',
            html: '<b>' + esc(label) + '</b> ใช้ได้เมื่อซื้อระบบแล้ว<br>' + why
                + '<div class="vsd-pop-note">ลองใช้ฟีเจอร์อื่นกับข้อมูลตัวอย่างต่อได้เลย</div>',
            showCancelButton: !!cfg.buyUrl,
            showConfirmButton: true,
            reverseButtons: true,
            confirmButtonText: cfg.buyUrl ? '<i class="fas fa-cart-shopping"></i> ดูรายละเอียด / ซื้อระบบนี้' : 'ทดลองต่อ',
            cancelButtonText: 'ทดลองต่อ',
            buttonsStyling: false,
            customClass: { popup: 'swal-x vsd-popup', confirmButton: 'btn-x primary lg', cancelButton: 'btn-x ghost lg' },
        }).then(function (r) { if (r.isConfirmed && cfg.buyUrl) buy(); });
    }

    // หน้าต่าง SweetAlert ที่มีปุ่มถูกล็อก (เช่นหน้าต้อนรับ) ห้ามปิดด้วย Esc / คลิกพื้นหลัง / ปุ่ม × — กันเลี่ยงไปเริ่มแบบข้อมูลว่าง
    function lockedSwalOpen() {
        var p = document.querySelector('.swal2-container .swal2-popup');
        return !!(p && !p.classList.contains('vsd-popup') && p.querySelector('.swal2-actions [data-demo-lock]'));
    }
    function hintSwal() {
        if (window.Swal && window.Swal.showValidationMessage) {
            window.Swal.showValidationMessage('<span class="vsd-vm"><i class="fas fa-flask"></i> โหมดทดลอง: เลือกปุ่มที่ไม่มีรูปกุญแจเพื่อทดลองต่อ</span>');
        }
    }
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !lockedSwalOpen()) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        hintSwal();
    }, true);

    // ---- โหมดทดลอง: ห้ามลบข้อมูล · ห้ามดาวน์โหลดไฟล์ (Word/PDF/Excel/ฯลฯ) · ห้ามพิมพ์ — ดูตัวอย่างบนหน้าจอได้
    var DEL_LABEL = 'ลบข้อมูล (ทดลองเพิ่ม/แก้ไขได้)';
    var DL_LABEL = 'ดาวน์โหลดไฟล์ (Word / PDF / Excel) — ดูตัวอย่างบนหน้าจอได้';
    var PRINT_LABEL = 'พิมพ์ / บันทึกเป็น PDF — ดูตัวอย่างบนหน้าจอได้';
    function isFileLink(a) {
        if (!a || a.tagName !== 'A' || a.closest('[data-demo-allow]')) return false;
        return a.hasAttribute('download') || /^(blob:|data:)/i.test(a.getAttribute('href') || '');
    }
    function isDeleteEl(el) {
        if (!el || !el.matches || el.closest('[data-demo-allow], .vsd-bar, .vsd-popup')) return false;
        if (el.matches('.icon-btn.del, .btn-del, [data-act="delete"], [data-act="del"], [data-action="delete"], [data-action="del"]')) return true;
        if (el.querySelector('i.fa-trash, i.fa-trash-can, i.fa-trash-alt, i.fa-trash-arrow-up, i.fa-trash-xmark')) return true;
        var t = textOf(el);
        return t.length <= 40 && /^(ลบ|ล้างข้อมูล|ยืนยันการลบ)/.test(t);
    }
    var aClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (isFileLink(this)) { notify(DL_LABEL); return; } return aClick.apply(this, arguments); };
    var dispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (ev) {
        if (ev && ev.type === 'click' && this && this.tagName === 'A' && isFileLink(this)) { notify(DL_LABEL); return false; }
        return dispatch.apply(this, arguments);
    };
    var wOpen = window.open;
    window.open = function (u) { if (/^(blob:|data:)/i.test(String(u || ''))) { notify(DL_LABEL); return null; } return wOpen.apply(window, arguments); };
    window.print = function () { notify(PRINT_LABEL); };
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) { e.preventDefault(); e.stopPropagation(); notify(e.key.toLowerCase() === 'p' ? PRINT_LABEL : DL_LABEL); }
    }, true);

    // ---- ดักการคลิก/ส่งฟอร์มที่ถูกล็อก (capture: ทำงานก่อนโค้ดของระบบ)
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.classList && (t.classList.contains('swal2-container') || (t.closest && t.closest('.swal2-close'))) && lockedSwalOpen()) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            hintSwal();
            return;
        }
        var link = t && t.closest ? t.closest('a') : null;
        if (link && isFileLink(link)) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); notify(DL_LABEL); return; }
        var del = t && t.closest ? t.closest('button, a, [role="button"], .icon-btn') : null;
        if (del && isDeleteEl(del)) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); notify(DEL_LABEL); return; }
        var el = t && t.closest ? t.closest('[data-demo-lock]') : null;
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        notify(el.getAttribute('data-demo-lock') || textOf(el));
    }, true);
    document.addEventListener('submit', function (e) {
        var f = e.target;
        if (!f || !f.matches || !f.matches('form[data-demo-lock]')) return;
        e.preventDefault();
        e.stopPropagation();
        notify(f.getAttribute('data-demo-lock'));
    }, true);
    document.addEventListener('change', function (e) {
        var el = e.target;
        if (!el || !el.matches || !el.matches('input[type=file][data-demo-lock]')) return;
        e.stopPropagation();
        try { el.value = ''; } catch (x) { /* ignore */ }
        notify(el.getAttribute('data-demo-lock'));
    }, true);

    // ---- ล็อกปุ่มในหน้าต่างต้อนรับแบบมาตรฐานอัตโนมัติ (ระบบควรใส่ VSDemo.lock เองด้วย)
    var AUTO = [/เริ่มใหม่\s*\(ข้อมูลว่าง\)/, /เปิดไฟล์ข้อมูลเดิม/, /^(ลบ|ล้างข้อมูล|ยืนยันการลบ)/];
    function scanSwal(root) {
        var btns = root.querySelectorAll('.swal2-actions button');
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i], t = textOf(b);
            if (b.hasAttribute('data-demo-lock') && b.getAttribute('data-demo-auto') === t) continue;
            if (b.getAttribute('data-demo-auto')) { b.removeAttribute('data-demo-lock'); b.removeAttribute('data-demo-auto'); }
            for (var j = 0; j < AUTO.length; j++) {
                if (AUTO[j].test(t)) { b.setAttribute('data-demo-lock', t); b.setAttribute('data-demo-auto', t); break; }
            }
        }
    }
    var watched = null;
    function watchSwal() {
        var c = document.querySelector('.swal2-container');
        if (!c || c === watched) return;
        watched = c;
        scanSwal(c);
        new MutationObserver(function () { scanSwal(c); }).observe(c, { childList: true, subtree: true, characterData: true });
    }

    // ---- แถบโหมดทดลอง + ลายน้ำตอนพิมพ์
    var CSS = ''
        + 'html.vs-demo [data-demo-lock]{cursor:not-allowed!important;filter:saturate(.45);opacity:.78}'
        + 'html.vs-demo [data-demo-lock]:not(input):not(select):not(textarea)::after{content:"\\f023";font-family:"Font Awesome 6 Free","Font Awesome 5 Free",sans-serif;font-weight:900;font-size:.82em;margin-left:.45em;display:inline-block}'
        + '.vsd-bar{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin:0;padding:.55rem 1rem;'
        + 'background:linear-gradient(90deg,#fff7ed,#fef3c7);border-bottom:1px solid #fcd34d;color:#78350f;font-size:.9rem;line-height:1.35;position:relative;z-index:5}'
        + '.vsd-bar .vsd-ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex:0 0 auto;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff}'
        + '.vsd-bar .vsd-txt{flex:1 1 220px;min-width:0}.vsd-bar .vsd-txt b{color:#9a3412}'
        + '.vsd-bar .vsd-act{display:flex;gap:.4rem;flex-wrap:wrap}'
        + '.vsd-btn{display:inline-flex;align-items:center;gap:.35rem;border:1px solid #fbbf24;background:#fff;color:#92400e;border-radius:999px;padding:.32rem .8rem;font:inherit;font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}'
        + '.vsd-btn:hover{background:#fffbeb;color:#78350f}'
        + '.vsd-btn.buy{background:linear-gradient(135deg,#f59e0b,#ea580c);border-color:transparent;color:#fff}.vsd-btn.buy:hover{filter:brightness(1.05);color:#fff}'
        + '.vsd-x{border:0;background:transparent;color:#b45309;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:1rem}'
        + '.vsd-x:hover{background:rgba(245,158,11,.15)}'
        + '.vsd-bar.is-float{position:fixed;left:12px;bottom:12px;right:auto;max-width:min(560px,calc(100vw - 24px));border:1px solid #fcd34d;border-radius:14px;box-shadow:0 10px 30px rgba(120,53,15,.18);z-index:2147483000}'
        + '.vsd-pill{position:fixed;left:12px;bottom:12px;z-index:2147483000;display:none;align-items:center;gap:.4rem;border:1px solid #fcd34d;background:#fff7ed;color:#92400e;border-radius:999px;padding:.45rem .85rem;font-size:.85rem;font-weight:700;box-shadow:0 6px 18px rgba(120,53,15,.18);cursor:pointer}'
        + 'html.vsd-min .vsd-bar.is-float{display:none}html.vsd-min .vsd-pill{display:inline-flex}'
        + '.vsd-vm{display:block;text-align:left;line-height:1.45;font-size:.95rem}.vsd-vm b{white-space:nowrap}'
        + '.vsd-pop-note{margin-top:.6rem;font-size:.9em;color:#64748b}.vsd-link{font-weight:700;text-decoration:underline}'
        + '.vsd-wm{display:none}'
        + '@media (max-width:575.98px){.vsd-bar{padding:.5rem .75rem;font-size:.85rem}.vsd-bar .vsd-ic,.vsd-bar .vsd-name{display:none}}'
        + '@media print{.vsd-bar,.vsd-pill{display:none!important}'
        + 'html.vs-demo body>*:not(#vsd-wm){display:none!important}'
        + 'body>#vsd-wm.vsd-wm{display:block!important;position:static;margin:30vh auto 0;text-align:center;'
        + 'font:700 28pt "Sarabun","TH SarabunPSK",sans-serif;color:#b91c1c;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
        + 'body>#vsd-wm.vsd-wm::after{content:"พิมพ์และบันทึกเป็น PDF ได้เมื่อซื้อระบบแล้ว";display:block;margin-top:12pt;font-size:16pt;font-weight:600;color:#475569}}';

    function renderBar() {
        var bar = document.querySelector('.vsd-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'vsd-bar';
            bar.setAttribute('role', 'note');
            var name = cfg.name ? '<span class="vsd-name">“' + esc(cfg.name) + '” </span>' : '';
            bar.innerHTML = '<span class="vsd-ic"><i class="fas fa-flask"></i></span>'
                + '<span class="vsd-txt"><b>โหมดทดลองใช้</b> ' + name + 'ใช้ได้กับข้อมูลตัวอย่าง · ทดลองเพิ่ม/แก้ไขได้ แต่การลบ ดาวน์โหลดไฟล์ และพิมพ์ ใช้ได้เมื่อซื้อระบบแล้ว</span>'
                + '<span class="vsd-act"></span>';
            var main = document.querySelector('.app-main');
            if (main) main.insertBefore(bar, main.firstChild);
            else {
                bar.classList.add('is-float');
                document.body.appendChild(bar);
                var pill = document.createElement('button');
                pill.type = 'button';
                pill.className = 'vsd-pill';
                pill.innerHTML = '<i class="fas fa-flask"></i> โหมดทดลองใช้';
                pill.addEventListener('click', function () { setMin(false); });
                document.body.appendChild(pill);
            }
        }
        var act = bar.querySelector('.vsd-act');
        var html = '';
        if (resetFns.length) html += '<button type="button" class="vsd-btn" data-vsd="reset"><i class="fas fa-rotate"></i> เริ่มข้อมูลตัวอย่างใหม่</button>';
        if (cfg.buyUrl) html += '<a class="vsd-btn buy" href="' + esc(cfg.buyUrl) + '" target="_top"><i class="fas fa-cart-shopping"></i> ซื้อระบบนี้</a>';
        if (bar.classList.contains('is-float')) html += '<button type="button" class="vsd-x" data-vsd="min" title="ย่อแถบนี้" aria-label="ย่อแถบโหมดทดลอง"><i class="fas fa-minus"></i></button>';
        act.innerHTML = html;
    }
    function setMin(on) {
        document.documentElement.classList.toggle('vsd-min', on);
        try { sessionStorage.setItem('vsd-min', on ? '1' : ''); } catch (e) { /* ignore */ }
    }

    document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-vsd]') : null;
        if (!b) return;
        e.preventDefault();
        if (b.getAttribute('data-vsd') === 'min') { setMin(true); return; }
        var go = function () { resetFns.forEach(function (fn) { try { fn(); } catch (x) { console.error(x); } }); };
        if (!window.Swal) { if (window.confirm('ล้างสิ่งที่ทดลองไว้ แล้วเริ่มจากข้อมูลตัวอย่างใหม่?')) go(); return; }
        window.Swal.fire({
            icon: 'question', title: 'เริ่มข้อมูลตัวอย่างใหม่?', html: 'สิ่งที่ทดลองแก้ไขไว้จะหายไป แล้วโหลดข้อมูลตัวอย่างชุดเดิมให้ใหม่',
            showCancelButton: true, reverseButtons: true, focusCancel: true,
            confirmButtonText: '<i class="fas fa-rotate"></i> เริ่มใหม่', cancelButtonText: 'ยกเลิก',
            buttonsStyling: false, customClass: { popup: 'swal-x vsd-popup', confirmButton: 'btn-x primary lg', cancelButton: 'btn-x ghost lg' },
        }).then(function (r) { if (r.isConfirmed) go(); });
    });

    var style = document.createElement('style');
    style.id = 'vsd-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);

    whenReady(function () {
        renderBar();
        var wm = document.createElement('div');
        wm.className = 'vsd-wm';
        wm.id = 'vsd-wm'; // id ทำให้ชนะกฎซ่อนทุกอย่างนอก #print-root ใน official-print.css ตอนพิมพ์
        wm.setAttribute('aria-hidden', 'true');
        wm.textContent = WATERMARK;
        document.body.appendChild(wm);
        try { if (sessionStorage.getItem('vsd-min') === '1') setMin(true); } catch (e) { /* ignore */ }
        watchSwal();
        new MutationObserver(watchSwal).observe(document.body, { childList: true });
    });
})();

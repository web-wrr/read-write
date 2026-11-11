/* VS Kit — พฤติกรรมโครงหน้า: เมนูซ้ายแบบลิ้นชักบนมือถือ/แท็บเล็ต (< 992px) */
(function () {
    'use strict';
    var shell = document.querySelector('.app-shell');
    if (!shell) return;
    function open() { shell.classList.add('sb-open'); document.documentElement.style.overflow = 'hidden'; }
    function close() { shell.classList.remove('sb-open'); document.documentElement.style.overflow = ''; }
    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-sb-open]')) { e.preventDefault(); open(); return; }
        if (e.target.closest('[data-sb-close]')) { e.preventDefault(); close(); return; }
        // แตะเมนูแล้วปิดลิ้นชักอัตโนมัติ (เฉพาะจอเล็ก)
        if (e.target.closest('.app-sidebar a.sb-link') && window.matchMedia('(max-width: 991.98px)').matches) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 992) close(); });
    window.VSShell = { open: open, close: close };
})();

/* VS Kit — ถามยืนยันก่อนออกจากระบบ (SweetAlert2) ใช้กับทุกระบบ
   ใส่ data-logout ที่ลิงก์ <a href="logout.php" data-logout> หรือปุ่มในฟอร์ม <button type="submit" data-logout>
   ปรับข้อความได้: data-logout="ข้อความเพิ่มเติม" */
(function () {
    'use strict';
    function ask(note) {
        if (!window.Swal) return Promise.resolve(window.confirm('ต้องการออกจากระบบใช่หรือไม่?'));
        return Swal.fire({
            icon: 'question',
            title: 'ออกจากระบบ?',
            html: note || 'ต้องการออกจากระบบตอนนี้ใช่หรือไม่',
            showCancelButton: true,
            focusCancel: true,
            reverseButtons: true,
            confirmButtonText: '<i class="fas fa-right-from-bracket"></i> ออกจากระบบ',
            cancelButtonText: 'ยกเลิก',
            buttonsStyling: false,
            customClass: { popup: 'swal-x', confirmButton: 'btn-x danger-solid lg', cancelButton: 'btn-x ghost lg' },
        }).then(function (r) { return r.isConfirmed; });
    }
    document.addEventListener('click', function (e) {
        var el = e.target.closest('[data-logout]');
        if (!el || el.dataset.logoutOk === '1') return;
        e.preventDefault();
        e.stopPropagation();
        var note = el.getAttribute('data-logout');
        ask(note && note !== '' ? note : '').then(function (ok) {
            if (!ok) return;
            var form = el.closest('form');
            if (form && el.tagName !== 'A') {
                if (form.requestSubmit) form.requestSubmit(el); else form.submit();
            } else if (el.href) {
                window.location.href = el.href;
            } else {
                // ปุ่มที่ทำงานด้วย JavaScript ของระบบเอง: ปล่อยคลิกผ่านครั้งเดียว แล้วกลับมาถามทุกครั้งเหมือนเดิม
                el.dataset.logoutOk = '1';
                el.click();
                delete el.dataset.logoutOk;
            }
        });
    }, true);
})();

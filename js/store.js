/* =====================================================================
   ที่เก็บข้อมูล: localStorage + สำรอง/เปิดไฟล์ .json (แบบเดียวกับระบบจัดตารางสอน)
   โครงข้อมูลดูที่ newData() และคำอธิบายใน js/core.js
   ===================================================================== */
(function () {
    'use strict';

    const KEY = 'vs_read_think_write.data.v1';
    const KEY_PREV = 'vs_read_think_write.data.v1.previous';
    const KEY_META = 'vs_read_think_write.meta.v1';
    const SCHEMA_VERSION = 1;
    const APP_ID = 'vs-read-think-write';
    const PREFIXES = ['ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว', 'นาง'];
    const TERMS = ['1', '2'];
    const str = (v) => (v == null ? '' : String(v));

    function newData() {
        const now = new Date().toISOString();
        const y = new Date().getFullYear() + 543;
        return {
            app: APP_ID,
            schemaVersion: SCHEMA_VERSION,
            createdAt: now,
            updatedAt: now,
            school: { name: '', agency: '', area: '', academicYear: String(new Date().getMonth() < 4 ? y - 1 : y), semester: '1', director: '', academicHead: '', measureHead: '', logo: '' },
            criteria: U.clone(Core.DEFAULT_CRITERIA),
            tpl: U.clone(Presets.TEMPLATE),
            classes: [],
            students: [],
            tasks: [],
            scores: {},
            remedial: {},
            register: [],
        };
    }

    /* แปลงชื่อห้องให้เป็นรูปแบบเดียวกัน เช่น "ป 6/1" "ป.๖/๑" → "ป.6/1" */
    function normClass(v) {
        let s = U.norm(String(v ?? '').replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))));
        s = s.replace(/\s*\/\s*/g, '/');
        s = s.replace(/^(ม|ป|อ|ปวช|ปวส)\s*\.?\s*(\d)/, '$1.$2');
        return s;
    }

    function normalize(raw) {
        const base = newData();
        const d = Object.assign(base, raw || {});
        d.app = APP_ID;
        d.school = Object.assign(newData().school, d.school || {});
        Object.keys(d.school).forEach((k) => { d.school[k] = str(d.school[k]); });
        if (!TERMS.includes(d.school.semester)) d.school.semester = '1';

        // เกณฑ์
        const cr = Object.assign(U.clone(Core.DEFAULT_CRITERIA), d.criteria || {});
        cr.weights = Object.assign({}, Core.DEFAULT_CRITERIA.weights, cr.weights || {});
        Core.IDS.forEach((a) => { cr.weights[a] = Math.max(0, Math.min(100, U.toNum(cr.weights[a], 0))); });
        cr.cut = Object.assign({}, Core.DEFAULT_CRITERIA.cut, cr.cut || {});
        ['excellent', 'good', 'pass'].forEach((k) => { cr.cut[k] = Math.max(0, Math.min(100, U.toNum(cr.cut[k], Core.DEFAULT_CRITERIA.cut[k]))); });
        if (!(cr.cut.excellent >= cr.cut.good && cr.cut.good >= cr.cut.pass)) cr.cut = Object.assign({}, Core.DEFAULT_CRITERIA.cut);
        cr.indicators = Object.assign({}, Core.DEFAULT_CRITERIA.indicators, cr.indicators || {});
        Core.IDS.forEach((a) => { cr.indicators[a] = (Array.isArray(cr.indicators[a]) ? cr.indicators[a] : []).map(U.norm).filter(Boolean); });
        d.criteria = cr;
        d.tpl = Object.assign(U.clone(Presets.TEMPLATE), d.tpl || {});
        if (!Array.isArray(d.tpl.suggestions)) d.tpl.suggestions = [];

        // นักเรียน
        const ids = new Set();
        d.students = (Array.isArray(d.students) ? d.students : []).filter((s) => s && typeof s === 'object').map((s) => {
            const x = {
                id: s.id && !ids.has(String(s.id)) ? String(s.id) : U.uid('s'),
                no: s.no === '' || s.no == null ? '' : U.toInt(s.no, ''),
                code: str(s.code).trim(), prefix: U.norm(s.prefix), firstName: U.norm(s.firstName), lastName: U.norm(s.lastName), cls: normClass(s.cls),
            };
            ids.add(x.id);
            return x;
        });
        const seen = new Map();
        (Array.isArray(d.classes) ? d.classes : []).forEach((k) => {
            const name = normClass(k && k.name);
            if (name && !seen.has(name)) seen.set(name, { name, teacher: U.norm(k.teacher) });
        });
        d.students.forEach((s) => { if (s.cls && !seen.has(s.cls)) seen.set(s.cls, { name: s.cls, teacher: '' }); });
        d.classes = [...seen.values()].sort((a, b) => U.cmp(a.name, b.name));

        // ชิ้นงาน + คะแนน
        const tids = new Set();
        d.tasks = (Array.isArray(d.tasks) ? d.tasks : []).filter((t) => t && typeof t === 'object').map((t) => {
            const x = { id: t.id && !tids.has(String(t.id)) ? String(t.id) : U.uid('t'), cls: normClass(t.cls), term: TERMS.includes(str(t.term)) ? str(t.term) : '1', title: U.norm(t.title) || 'ชิ้นงาน', kind: U.norm(t.kind), date: str(t.date).slice(0, 10), note: str(t.note), max: {} };
            Core.IDS.forEach((a) => { x.max[a] = Math.max(0, Math.min(1000, U.toNum((t.max || {})[a], 0))); });
            tids.add(x.id);
            return x;
        });
        const sc = d.scores && typeof d.scores === 'object' ? d.scores : {};
        const outScores = {};
        d.tasks.forEach((t) => {
            const src = sc[t.id] && typeof sc[t.id] === 'object' ? sc[t.id] : {};
            const o = {};
            Object.keys(src).forEach((sid) => {
                if (!ids.has(sid) || !src[sid]) return;
                const row = {};
                Core.IDS.forEach((a) => {
                    const v = src[sid][a];
                    if (Core.isNum(v) && t.max[a] > 0) row[a] = Math.max(0, Math.min(t.max[a], Number(v)));
                });
                if (Object.keys(row).length) o[sid] = row;
            });
            outScores[t.id] = o;
        });
        d.scores = outScores;
        d.remedial = d.remedial && typeof d.remedial === 'object' ? d.remedial : {};
        d.register = (Array.isArray(d.register) ? d.register : []).filter((r) => r && typeof r === 'object').map((r) => ({ id: r.id || U.uid('r'), no: U.toInt(r.no, 0), year: str(r.year), date: str(r.date).slice(0, 10), subject: str(r.subject), scope: str(r.scope), note: str(r.note) }));
        d.schemaVersion = SCHEMA_VERSION;
        return d;
    }

        /* ---------- ตั้งค่าเชื่อมต่อส่วนกลาง (Google Apps Script) ---------- */
       const PROXY_URL = 'https://script.google.com/a/macros/ska2.go.th/s/AKfycbytX-KekEqfaquHhn3ERrjAvpECm1CREX2QQCLUfeDVReZN65OrKpZmkYO6XYRZaxYl/exec';
       let isSaving = false;
   
       /* ---------- สถานะ ---------- */
       const listeners = new Set();
       let data = null;
       let meta = { lastBackupAt: null, lastBackupName: '', lastChangeAt: null, lastSavedAt: null, dismissedWelcome: false, lastClass: '', lastTask: '' };
       let storageOk = true;
   
       function loadMeta() { try { meta = Object.assign(meta, JSON.parse(localStorage.getItem(KEY_META) || '{}')); } catch (e) { /* ค่าเริ่มต้น */ } }
       function saveMeta() { try { localStorage.setItem(KEY_META, JSON.stringify(meta)); } catch (e) { /* ไม่เป็นไร */ } }
   
       // 1. ดึงข้อมูลจาก GitHub มาแสดง (อ่านตรงจาก GitHub ได้เลย ไม่ต้องใช้ Token)
       async function syncFromGitHub() {
           try {
               const url = ['https://github.com', 'repos', 'web-wrr', 'read-write', 'contents', 'data.json?t=' + Date.now()].join('/');
               const res = await fetch(url);
               if (!res.ok) throw new Error('โหลดจาก GitHub ไม่สำเร็จ');
               
               const file = await res.json();
               const content = decodeURIComponent(escape(atob(file.content)));
               const parsed = JSON.parse(content);
   
               if (parsed && Object.keys(parsed).length > 0) {
                   data = normalize(parsed);
                   localStorage.setItem(KEY, JSON.stringify(data));
                   emit('sync');
               }
           } catch (e) {
               console.warn('ใช้ข้อมูลสำรองในเครื่องแทนเนื่องจาก:', e);
           }
       }
   
       function load() {
           loadMeta();
           try {
               const raw = localStorage.getItem(KEY);
               data = raw ? normalize(JSON.parse(raw)) : newData();
           } catch (e) {
               console.warn('โหลดข้อมูลไม่สำเร็จ', e);
               storageOk = false;
               data = newData();
           }
           syncFromGitHub();
           return data;
       }
   
       // 2. บันทึกลงเบราว์เซอร์ และส่งขึ้น GitHub ผ่านตัวกลาง Google Apps Script
       async function persist() {
           try {
               localStorage.setItem(KEY, JSON.stringify(data));
               meta.lastSavedAt = new Date().toISOString();
               saveMeta();
               storageOk = true;
           } catch (e) {
               storageOk = false;
               console.error('บันทึกลงเบราว์เซอร์ไม่สำเร็จ', e);
           }
   
           if (!PROXY_URL || PROXY_URL.includes('นำ_URL')) return;
           if (isSaving) return;
           isSaving = true;
   
           try {
               const res = await fetch(PROXY_URL, {
                   method: 'POST',
                   headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                   body: JSON.stringify(data, null, 2)
               });
   
               const result = await res.json();
               if (result.status === 'ok') {
                   U.toast('บันทึกข้อมูลขึ้นส่วนกลางสำเร็จ', { type: 'ok', ms: 2500 });
               } else {
                   throw new Error(result.message || 'บันทึกไม่สำเร็จ');
               }
           } catch (e) {
               console.error('บันทึกขึ้นส่วนกลางไม่สำเร็จ:', e);
               U.toast('บันทึกขึ้นส่วนกลางไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต', { type: 'bad', ms: 5000 });
           } finally {
               isSaving = false;
           }
       }
   
       const persistSoon = U.debounce(persist, 1500);

  
    function emit(reason) { listeners.forEach((fn) => { try { fn(reason); } catch (e) { console.error(e); } }); }
    function commit(reason, opts) {
        if (opts && opts.normalize) data = normalize(data);
        data.updatedAt = new Date().toISOString();
        meta.lastChangeAt = data.updatedAt;
        if (opts && opts.immediate) persist(); else persistSoon();
        emit(reason || 'change');
    }
    function replaceAll(newRaw, reason) {
        try { localStorage.setItem(KEY_PREV, JSON.stringify(data)); } catch (e) { /* อาจเต็ม */ }
        data = normalize(newRaw);
        commit(reason || 'replace', { immediate: true });
    }
    function hasPrevious() { try { return !!localStorage.getItem(KEY_PREV); } catch (e) { return false; } }
    function restorePrevious() {
        const raw = localStorage.getItem(KEY_PREV);
        if (!raw) return false;
        const cur = data;
        data = normalize(JSON.parse(raw));
        try { localStorage.setItem(KEY_PREV, JSON.stringify(cur)); } catch (e) { /* ไม่เป็นไร */ }
        commit('replace', { immediate: true });
        return true;
    }

    /* ---------- สำรองเป็นไฟล์ ---------- */
    function backupFileName() {
        const sc = data.school;
        return `${U.safeFileName(['อ่านคิดวิเคราะห์เขียน', sc.name || 'โรงเรียน', `ปี${sc.academicYear || ''}`, U.stamp()].join('_'))}.json`;
    }
    async function exportFile() {
        const text = JSON.stringify(Object.assign({}, data, { exportedAt: new Date().toISOString() }));
        const name = backupFileName();
        let savedName = name;
        const blob = () => new Blob([text], { type: 'application/json' });
        if (window.showSaveFilePicker && !(window.VSDemo && VSDemo.active)) {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'ไฟล์ข้อมูล (.json)', accept: { 'application/json': ['.json'] } }] });
                const w = await handle.createWritable();
                await w.write(blob());
                await w.close();
                savedName = handle.name || name;
            } catch (e) {
                if (e && e.name === 'AbortError') return null;
                U.downloadBlob(blob(), name);
            }
        } else {
            U.downloadBlob(blob(), name);
        }
        meta.lastBackupAt = new Date().toISOString();
        meta.lastBackupName = savedName;
        saveMeta();
        emit('backup');
        return savedName;
    }
    function parseBackup(text) {
        let obj;
        try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (e) { return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์ JSON ที่ถูกต้อง' }; }
        if (!obj || typeof obj !== 'object') return { ok: false, error: 'รูปแบบไฟล์ไม่ถูกต้อง' };
        if (obj.app !== APP_ID) return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์ข้อมูลของโปรแกรมบันทึกการอ่าน คิดวิเคราะห์ และเขียน' };
        if ((obj.schemaVersion || 1) > SCHEMA_VERSION) return { ok: false, error: 'ไฟล์นี้สร้างจากโปรแกรมรุ่นใหม่กว่า กรุณาใช้โปรแกรมรุ่นล่าสุด' };
        const d = normalize(U.clone(obj));
        return { ok: true, data: d, summary: { school: d.school.name, year: d.school.academicYear, students: d.students.length, classes: d.classes.length, tasks: d.tasks.length, savedAt: obj.exportedAt || obj.updatedAt } };
    }
    function needsBackup() {
        if (!meta.lastChangeAt) return false;
        if (!meta.lastBackupAt) return true;
        return new Date(meta.lastChangeAt) > new Date(meta.lastBackupAt);
    }
    const isEmpty = () => !data.students.length && !data.classes.length;
    const resetAll = () => replaceAll(newData(), 'reset');

    /* ---------- ตัวช่วยอ่านข้อมูล ---------- */
    const byClassNo = (a, b) => U.cmp(a.cls, b.cls) || (U.toInt(a.no, 9999) - U.toInt(b.no, 9999)) || U.cmp(a.firstName, b.firstName);
    const classList = () => data.classes.map((c) => c.name);
    const classInfo = (name) => data.classes.find((c) => c.name === name) || null;
    const studentsOf = (cls) => data.students.filter((s) => !cls || s.cls === cls).sort(byClassNo);
    const student = (id) => data.students.find((s) => s.id === id) || null;
    const fullName = (s) => (s ? `${s.prefix || ''}${s.firstName || ''}${s.lastName ? ` ${s.lastName}` : ''}`.trim() : '');
    const term = () => data.school.semester || '1';
    const termText = (t) => `ภาคเรียนที่ ${t || term()}/${data.school.academicYear || '-'}`;
    const tasksOf = (cls, t) => Core.tasksOf(data, cls, t || term());
    const task = (id) => data.tasks.find((t) => t.id === id) || null;
    const result = (cls, t) => Core.classResult(data, cls, t || term());

    window.addEventListener('storage', (e) => {
        if (e.key === KEY_META) { loadMeta(); emit('backup'); return; }
        if (e.key !== KEY || e.newValue == null) return;
        try {
            data = normalize(JSON.parse(e.newValue));
            loadMeta();
            emit('replace');
            U.toast('ข้อมูลถูกแก้ไขจากอีกหน้าต่างหนึ่ง — แสดงข้อมูลล่าสุดแล้ว', { type: 'warn', ms: 5000 });
        } catch (err) { /* ข้าม */ }
    });

    window.Store = {
        KEY, PREFIXES, TERMS, SCHEMA_VERSION, APP_ID,
        load, commit, replaceAll, resetAll, newData, normalize, normClass,
        exportFile, parseBackup, backupFileName, needsBackup, isEmpty, hasPrevious, restorePrevious,
        classList, classInfo, studentsOf, student, fullName, term, termText, tasksOf, task, result, byClassNo,
        get data() { return data; },
        get meta() { return meta; },
        get storageOk() { return storageOk; },
        setMeta(patch) { Object.assign(meta, patch); saveMeta(); },
        on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        flush: persist,
    };
})();

/* =====================================================================
   รูปภาพ / ไฟล์แนบของบันทึกเหตุการณ์ ศปก. — เก็บในเครื่องนี้ (IndexedDB) ไม่ขึ้นเว็บสาธารณะ
   - รูปย่อให้ด้านยาวไม่เกิน 1600 พิกเซล (JPEG) + ภาพเล็ก 400 พิกเซลสำหรับแสดงในรายการ
   - ไฟล์อื่น (เช่น PDF) เก็บตามจริง ไม่เกิน 50 MB ต่อไฟล์
   - บันทึก ศปก. เก็บเฉพาะรหัสไฟล์และคำบรรยายใน ev.log[].media = [{ id, kind, name, type, size, w, h, caption }]
   ===================================================================== */
window.LamhinMedia = (function () {
    'use strict';
    const DB = 'lamhin-media', STORE = 'files';
    const MAX_SIDE = 1600, THUMB_SIDE = 400, MAX_FILE = 50 * 1024 * 1024;
    let dbP = null;
    function db() {
        if (!dbP) {
            dbP = new Promise((res, rej) => {
                if (!window.indexedDB) { rej(new Error('เบราว์เซอร์นี้เก็บรูปในเครื่องไม่ได้')); return; }
                const r = indexedDB.open(DB, 1);
                r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
                r.onsuccess = () => res(r.result);
                r.onerror = () => rej(r.error || new Error('เปิดที่เก็บรูปไม่ได้'));
            }).catch((e) => { dbP = null; throw e; });
        }
        return dbP;
    }
    function req(mode, fn) {
        return db().then((d) => new Promise((res, rej) => {
            const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
            let out;
            const r = fn(s);
            if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
            t.oncomplete = () => res(out);
            t.onerror = () => rej(t.error);
            t.onabort = () => rej(t.error || new Error('บันทึกรูปไม่สำเร็จ (พื้นที่เครื่องอาจเต็ม)'));
        }));
    }
    const uid = () => 'md' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // ย่อรูป: ด้านยาวไม่เกิน side พิกเซล → JPEG (หมุนตามข้อมูล EXIF ให้อัตโนมัติ)
    function loadImage(file) {
        if (window.createImageBitmap) {
            return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file)).catch(() => viaImg(file));
        }
        return viaImg(file);
    }
    function viaImg(file) {
        return new Promise((res, rej) => {
            const u = URL.createObjectURL(file), im = new Image();
            im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); };
            im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('เปิดรูปไม่ได้')); };
            im.src = u;
        });
    }
    function toJpeg(src, side, q) {
        const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
        const k = Math.min(1, side / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
        g.drawImage(src, 0, 0, w, h);
        return new Promise((res, rej) => c.toBlob((b) => (b ? res({ blob: b, w: w, h: h }) : rej(new Error('ย่อรูปไม่สำเร็จ'))), 'image/jpeg', q));
    }

    // เพิ่มไฟล์ที่เลือก → [{ id, kind, name, type, size, w, h }] (เก็บลงเครื่องแล้ว)
    function add(files) {
        const list = Array.from(files || []);
        return list.reduce((p, f) => p.then((out) => one(f).then((m) => { if (m) out.push(m); return out; })), Promise.resolve([]));
    }
    function one(f) {
        const isImg = /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name || '');
        if (!isImg) {
            if (f.size > MAX_FILE) return Promise.reject(new Error('ไฟล์ ' + f.name + ' ใหญ่เกิน 50 MB'));
            const m = { id: uid(), kind: 'file', name: f.name || 'ไฟล์แนบ', type: f.type || 'application/octet-stream', size: f.size, w: 0, h: 0 };
            return req('readwrite', (s) => s.put(Object.assign({ blob: f, created: Date.now() }, m))).then(() => m);
        }
        return loadImage(f).then((im) => Promise.all([toJpeg(im, MAX_SIDE, 0.82), toJpeg(im, THUMB_SIDE, 0.72)]).then((r) => {
            if (im.close) try { im.close(); } catch (e) { /* ไม่ต้อง */ }
            const m = { id: uid(), kind: 'image', name: (f.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', size: r[0].blob.size, w: r[0].w, h: r[0].h };
            return req('readwrite', (s) => s.put(Object.assign({ blob: r[0].blob, thumb: r[1].blob, created: Date.now() }, m))).then(() => m);
        }));
    }

    function get(id) { return req('readonly', (s) => s.get(id)); }
    const urls = new Map();
    // object URL สำหรับแสดงในหน้าเว็บ (thumb = ภาพเล็ก)
    function url(id, thumb) {
        const k = id + (thumb ? ':t' : '');
        if (urls.has(k)) return Promise.resolve(urls.get(k));
        return get(id).then((r) => {
            const b = r && (thumb && r.thumb ? r.thumb : r.blob);
            if (!b) return '';
            const u = URL.createObjectURL(b);
            urls.set(k, u);
            return u;
        });
    }
    function blobTo(b, as) {
        return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); })
            .then((d) => (as === 'b64' ? d.split(',')[1] : d));
    }
    // data URL (หน้าพิมพ์) / base64 (ไฟล์ Word) ของรูปขนาดเต็ม
    function dataUrl(id) { return get(id).then((r) => (r && r.blob ? blobTo(r.blob, 'data') : '')); }
    function b64(id) { return get(id).then((r) => (r && r.blob ? blobTo(r.blob, 'b64') : '')); }
    function del(ids) {
        const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
        if (!list.length) return Promise.resolve();
        list.forEach((id) => [id, id + ':t'].forEach((k) => { if (urls.has(k)) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); } }));
        return req('readwrite', (s) => { list.forEach((id) => s.delete(id)); return null; }).catch(() => {});
    }
    // เปิดไฟล์แนบ (ไม่ใช่รูป) ในแท็บใหม่ / ดาวน์โหลด
    function open(id) {
        return get(id).then((r) => {
            if (!r || !r.blob) throw new Error('ไม่พบไฟล์ในเครื่องนี้');
            const u = URL.createObjectURL(r.blob);
            const a = document.createElement('a');
            a.href = u; a.target = '_blank'; a.rel = 'noopener';
            if (!/^(image\/|application\/pdf|video\/|audio\/|text\/)/.test(r.type || '')) a.download = r.name || 'ไฟล์แนบ';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(u), 60000);
        });
    }
    const sizeText = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
    // ลบไฟล์ที่ไม่มีรายการใดอ้างถึง (keep = Set ของรหัสที่ยังใช้) และเก่ากว่า olderMs
    function gc(keep, olderMs) {
        const cut = Date.now() - (olderMs || 0);
        return req('readwrite', (s) => {
            const r = s.openCursor();
            r.onsuccess = () => {
                const c = r.result; if (!c) return;
                const v = c.value || {};
                if (!keep.has(v.id) && (v.created || 0) < cut) c.delete();
                c.continue();
            };
            return null;
        }).catch(() => {});
    }

    return { add: add, get: get, url: url, dataUrl: dataUrl, b64: b64, del: del, open: open, gc: gc, sizeText: sizeText, supported: !!window.indexedDB };
})();

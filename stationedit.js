/**
 * โหมดกรอกเวรทุกสายงานบนหน้า GitHub (สำหรับงานธุรการ — ไม่ต้องเข้าเว็บแอปงานสอบสวน)
 *
 * ใช้หน้าจอกรอกชุดเดียวกับเว็บแอป (dash/stationapp.js) แล้วส่งไปบันทึกลง Google Sheet
 * ผ่าน API ของเว็บแอปหลัก (POST ...?api=station)
 * ทุกคำขอต้องแนบ "รหัสธุรการ" ที่ผู้ดูแลตั้งไว้ในเว็บแอป — รหัสเก็บไว้ในแท็บนี้เท่านั้น ปิดแท็บแล้วหาย
 */
window.SVA_REMOTE = true;
const ST_PIN = 'st-editor-pin';
function stPinGet() { try { return sessionStorage.getItem(ST_PIN) || ''; } catch (e) { return ''; } }
function stPinSet(v) { try { if (v) sessionStorage.setItem(ST_PIN, v); else sessionStorage.removeItem(ST_PIN); } catch (e) { } }

/** เรียกฟังก์ชันฝั่งเซิร์ฟเวอร์ (ส่งเป็น text/plain เพื่อไม่ติด CORS preflight ของ Apps Script) */
function stCall(action, args, pin) {
    return fetch(API_URL + '?api=station', {
        method: 'POST',
        body: JSON.stringify({ action: action, args: args || [], pin: pin || stPinGet() })
    }).then((r) => r.json()).then((j) => {
        if (!j.ok) throw new Error(j.error || 'บันทึกไม่สำเร็จ');
        return j.result;
    });
}

// google.script.run เทียม — stationapp.js เรียกใช้ได้เหมือนอยู่ในเว็บแอป
window.google = {
    script: {
        get run() {
            let ok = () => { }, bad = () => { };
            const o = new Proxy({}, {
                get(t, k) {
                    if (k === 'withSuccessHandler') return (f) => { ok = f; return o; };
                    if (k === 'withFailureHandler') return (f) => { bad = f; return o; };
                    return (...args) => {
                        stCall(k, args).then(ok).catch((e) => {
                            if (/รหัส/.test(e.message)) stPinSet('');   // รหัสถูกเปลี่ยน/ผิด → ขอใหม่ครั้งหน้า
                            bad(e);
                        });
                    };
                }
            });
            return o;
        }
    }
};

// ---------- เข้า/ออกโหมดแก้ไข ----------
window.stEditOpen = function () {
    if (stPinGet()) { stEditEnter(); return; }
    $('pinErr').textContent = '';
    $('pinInput').value = '';
    $('pinModal').hidden = false;
    setTimeout(() => $('pinInput').focus(), 50);
};
function stPinSubmit() {
    const pin = $('pinInput').value.trim();
    if (!pin) { $('pinErr').textContent = 'กรุณาใส่รหัส'; return; }
    const btn = $('pinOk');
    btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ…';
    stCall('check', [], pin).then(() => {
        stPinSet(pin);
        $('pinModal').hidden = true;
        stEditEnter();
    }).catch((e) => {
        $('pinErr').textContent = e.message;
    }).finally(() => { btn.disabled = false; btn.textContent = 'เข้าสู่โหมดแก้ไข'; });
}
function stEditEnter() {
    document.body.classList.add('st-editing');
    $('svEditor').hidden = false;
    if (typeof LamhinScene !== 'undefined' && LamhinScene.isReady()) LamhinScene.setVisible(false);
    SVA.date = stDate ? new Date(stDate) : currentDutyDate();
    SVA.data = null;
    renderStationDuty();
    $('svEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.stEditClose = function () {
    document.body.classList.remove('st-editing');
    $('svEditor').hidden = true;
    SVA.mode = '';
    loadData();                 // ดึงข้อมูลใหม่ให้หน้าอ่านเห็นสิ่งที่เพิ่งบันทึก
    scene3dFollowTab();
};

document.addEventListener('DOMContentLoaded', () => {
    $('pinOk').addEventListener('click', stPinSubmit);
    $('pinCancel').addEventListener('click', () => { $('pinModal').hidden = true; });
    $('pinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') stPinSubmit(); });
});

// ==========================================================
// เช็คชื่อเวรประจำวัน (หน้า "เวร สน." รายวัน)
// เช่น ผู้บังคับบัญชามาตรวจ: ติ๊ก มาพบ / ติดภารกิจ / ไม่มา + หมายเหตุ
// บันทึกไว้ในเครื่องนี้เท่านั้น (localStorage) และไม่ออกในภาพ/PDF ที่ส่งออก
// ==========================================================
const CK_KEY = 'st-check-v1', CK_ON_KEY = 'st-check-on', CK_KEEP_DAYS = 62;
const CK_STATES = {
    in: { t: 'มาพบ', ic: 'fa-circle-check' },
    busy: { t: 'ติดภารกิจ', ic: 'fa-briefcase' },
    out: { t: 'ไม่มา', ic: 'fa-circle-xmark' },
};
let ckAll = null, ckBox = null, ckDate = null;

function ckLoad() {
    if (ckAll) return ckAll;
    try { ckAll = JSON.parse(localStorage.getItem(CK_KEY) || '{}') || {}; } catch (e) { ckAll = {}; }
    return ckAll;
}
function ckSave() {
    // เก็บไว้ราว 2 เดือน ที่เก่ากว่านั้นทิ้ง
    const cut = new Date(); cut.setDate(cut.getDate() - CK_KEEP_DAYS);
    const cutK = ckDayKey(cut);
    Object.keys(ckAll).forEach((k) => { if (k < cutK || !Object.keys(ckAll[k]).length) delete ckAll[k]; });
    try { localStorage.setItem(CK_KEY, JSON.stringify(ckAll)); } catch (e) { }
}
function ckIsOn() { try { return localStorage.getItem(CK_ON_KEY) === '1'; } catch (e) { return false; } }
function ckSetOn(on) { try { localStorage.setItem(CK_ON_KEY, on ? '1' : '0'); } catch (e) { } }
function ckDayKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function ckDay() { const all = ckLoad(), k = ckDayKey(ckDate); return all[k] || (all[k] = {}); }
function ckEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/** เรียกหลังวาดใบเวรรายวันลง box */
window.stCheckApply = function (box, date) {
    ckBox = box; ckDate = date;
    if (!box.__ckBound) { box.__ckBound = true; box.addEventListener('click', ckClick); }
    ckPaint();
};

function ckPaint() {
    const box = ckBox; if (!box) return;
    const on = ckIsOn(), day = ckDay();
    const rows = [...box.querySelectorAll('tr[data-ck]')];
    box.querySelectorAll('.ck-bar,.ck-row').forEach((e) => e.remove());
    let n = { in: 0, busy: 0, out: 0 };
    rows.forEach((tr) => {
        const v = day[tr.dataset.ck];
        tr.classList.remove('ck-in', 'ck-busy', 'ck-out');
        if (v && CK_STATES[v.s]) { n[v.s]++; if (on) tr.classList.add('ck-' + v.s); }
        if (!on) return;
        const cell = tr.querySelector('.sv-name'); if (!cell) return;
        const row = document.createElement('div');
        row.className = 'ck-row';
        row.innerHTML = '<span class="ck-btns">' + Object.keys(CK_STATES).map((s) =>
            `<button type="button" class="ck-btn ck-b-${s}${v && v.s === s ? ' on' : ''}" data-s="${s}" title="${CK_STATES[s].t}">`
            + `<i class="fa-solid ${CK_STATES[s].ic}"></i><span class="ck-t"> ${CK_STATES[s].t}</span></button>`).join('')
            + `<button type="button" class="ck-btn ck-b-note${v && v.n ? ' on' : ''}" data-s="note" title="หมายเหตุ"><i class="fa-solid fa-pen"></i></button></span>`
            + (v && (v.at || v.n) ? `<div class="ck-info">${v.s && CK_STATES[v.s] ? CK_STATES[v.s].t + (v.at ? ' ' + v.at + ' น.' : '') : ''}`
                + (v.n ? `${v.s ? ' · ' : ''}<b>${ckEsc(v.n)}</b>` : '') + '</div>' : '');
        cell.appendChild(row);
    });
    const done = n.in + n.busy + n.out;
    const bar = document.createElement('div');
    bar.className = 'ck-bar' + (on ? ' on' : '');
    bar.innerHTML = !rows.length ? '' : on
        ? `<b><i class="fa-solid fa-list-check"></i> เช็คชื่อ</b>`
          + `<span class="ck-sum ck-s-in"><i class="fa-solid fa-circle-check"></i> มาพบ ${n.in}</span><span class="ck-sum ck-s-busy"><i class="fa-solid fa-briefcase"></i> ติดภารกิจ ${n.busy}</span>`
          + `<span class="ck-sum ck-s-out"><i class="fa-solid fa-circle-xmark"></i> ไม่มา ${n.out}</span><span class="ck-sum">ยังไม่เช็ค ${rows.length - done}</span>`
          + `<span class="ck-sp"></span>`
          + `<button type="button" class="ck-act" data-a="clear"${done || Object.keys(ckDay()).length ? '' : ' disabled'}><i class="fa-solid fa-eraser"></i> ล้างทั้งหมด</button>`
          + `<button type="button" class="ck-act pri" data-a="off">เสร็จ</button>`
        : `<button type="button" class="ck-act pri" data-a="on"><i class="fa-solid fa-list-check"></i> เช็คชื่อ</button>`
          + (done ? `<span class="ck-sum">เช็คแล้ว ${done}/${rows.length} · มาพบ ${n.in}</span>` : '')
          + `<span class="ck-note">บันทึกในเครื่องนี้ ไม่ออกในภาพ/PDF</span>`;
    if (rows.length) box.insertBefore(bar, box.firstChild);
}

function ckClick(e) {
    const act = e.target.closest('.ck-act');
    if (act) {
        const a = act.dataset.a;
        if (a === 'on' || a === 'off') { ckSetOn(a === 'on'); ckPaint(); return; }
        if (a === 'clear' && confirm('ล้างการเช็คชื่อทั้งหมดของวันนี้?')) {
            delete ckLoad()[ckDayKey(ckDate)]; ckSave(); ckPaint();
        }
        return;
    }
    const btn = e.target.closest('.ck-btn'); if (!btn) return;
    const k = btn.closest('tr[data-ck]').dataset.ck, day = ckDay();
    const v = day[k] || {};
    if (btn.dataset.s === 'note') {
        const name = k.split('|').pop();
        const t = prompt('หมายเหตุ — ' + name + '\n(เว้นว่าง = ลบหมายเหตุ)', v.n || '');
        if (t == null) return;
        v.n = t.trim();
        if (!v.n) delete v.n;
    } else if (v.s === btn.dataset.s) {   // กดซ้ำ = ยกเลิกติ๊ก
        delete v.s; delete v.at;
    } else {
        const now = new Date();
        v.s = btn.dataset.s;
        v.at = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }
    if (v.s || v.n) day[k] = v; else delete day[k];
    ckSave(); ckPaint();
}

// ==========================================================
// เช็คชื่อเวรประจำวัน (หน้า "เวร สน." รายวัน)
// เช่น ผู้บังคับบัญชามาตรวจ: กดสถานะ มา / ไม่มา / ติดภารกิจ + หมายเหตุ
// บันทึกไว้ในเครื่องนี้เท่านั้น (localStorage) และไม่ออกในภาพ/PDF ที่ส่งออก
// โหมดเช็คชื่อต่อคอลัมน์ไว้ท้ายแถว (บรรทัดเดียว แถวไม่สูงขึ้น) คอลัมน์เดิมกว้างเท่าเดิม — ตารางเลื่อนซ้าย-ขวาแทน
// ==========================================================
const CK_KEY = 'st-check-v1', CK_ON_KEY = 'st-check-on', CK_KEEP_DAYS = 62;
const CK_STATES = {
    in: { t: 'มา', ic: 'fa-circle-check' },
    out: { t: 'ไม่มา', ic: 'fa-circle-xmark' },
    busy: { t: 'ติดภารกิจ', ic: 'fa-briefcase' },
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

// เปิดโหมดเช็คชื่อ: ล็อกความกว้างคอลัมน์เดิม แล้วต่อคอลัมน์ "เช็คชื่อ / หมายเหตุ" ท้ายตาราง
function ckAddColumn(table) {
    table.classList.add('ck-on');
    const hr = table.querySelector('thead tr');
    if (hr) {
        [...hr.children].forEach((th) => {
            const w = th.getBoundingClientRect().width;
            if (w) th.style.width = th.style.minWidth = w + 'px';   // คอลัมน์ที่ซ่อนบนจอแคบ (กว้าง 0) ไม่ต้องล็อก
        });
        hr.insertAdjacentHTML('beforeend', '<th class="ck-th">เช็คชื่อ / หมายเหตุ</th>');
    }
    table.querySelectorAll('tbody tr').forEach((tr) => {
        if (tr.classList.contains('sv-sec')) { const td = tr.firstElementChild; td.colSpan = td.colSpan + 1; }
        else tr.insertAdjacentHTML('beforeend', tr.dataset.ck ? '<td class="ck-cell"></td>' : '<td class="ck-cell ck-none"></td>');
    });
    const wrap = document.createElement('div');
    wrap.className = 'ck-scroll';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
    wrap.__ckJump = true;   // เลื่อนหลังเติมช่องเช็คชื่อแล้ว (ckPaint)
}
// จอแคบ: เลื่อนตารางให้ช่องเช็คชื่อมาต่อท้ายชื่อ (ชื่อตรึงซ้าย) ทันทีที่เปิดโหมด
function ckJump(table) {
    const wrap = table.parentNode;
    if (!wrap.__ckJump) return;
    delete wrap.__ckJump;
    const th = table.querySelector('.ck-th'), nameTh = table.querySelector('thead th:nth-child(2)');
    if (th && nameTh && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = th.offsetLeft - nameTh.offsetWidth;
}

function ckCellHtml(v) {
    return '<div class="ck-line"><span class="ck-seg">'
        + Object.keys(CK_STATES).map((s) => `<button type="button" class="ck-b-${s}${v.s === s ? ' on' : ''}" data-s="${s}">`
            + `<i class="fa-solid ${CK_STATES[s].ic}"></i> ${CK_STATES[s].t}</button>`).join('')
        + '</span>'
        + (v.at ? `<small class="ck-at">${v.at} น.</small>` : '')
        + (v.n
            ? `<span class="ck-ntext">${ckEsc(v.n)}</span>`
              + '<button type="button" class="ck-ico" data-s="note" title="แก้ไขหมายเหตุ"><i class="fa-solid fa-pen"></i></button>'
              + '<button type="button" class="ck-ico ck-del" data-s="delnote" title="ลบหมายเหตุ"><i class="fa-solid fa-trash-can"></i></button>'
            : '<button type="button" class="ck-addnote" data-s="note"><i class="fa-solid fa-plus"></i> หมายเหตุ</button>')
        + '</div>';
}

function ckPaint() {
    const box = ckBox; if (!box) return;
    const on = ckIsOn(), day = ckDay();
    const table = box.querySelector('.sv-day .sv-table');
    const rows = [...box.querySelectorAll('tr[data-ck]')];
    box.querySelectorAll('.ck-bar').forEach((e) => e.remove());
    if (on && table && !table.classList.contains('ck-on')) ckAddColumn(table);
    const n = { in: 0, busy: 0, out: 0 };
    rows.forEach((tr) => {
        const v = day[tr.dataset.ck] || {};
        if (CK_STATES[v.s]) n[v.s]++;
        const cell = tr.querySelector('.ck-cell');
        if (cell) { cell.className = 'ck-cell' + (v.s ? ' ck-c-' + v.s : ''); cell.innerHTML = ckCellHtml(v); }
    });
    if (on && table) ckJump(table);
    if (!rows.length) return;
    const done = n.in + n.busy + n.out;
    const bar = document.createElement('div');
    bar.className = 'ck-bar' + (on ? ' on' : '');
    bar.innerHTML = on
        ? `<b><i class="fa-solid fa-list-check"></i> เช็คชื่อ</b>`
          + `<span class="ck-sum ck-s-in">มา ${n.in}</span><span class="ck-sum ck-s-out">ไม่มา ${n.out}</span>`
          + `<span class="ck-sum ck-s-busy">ติดภารกิจ ${n.busy}</span><span class="ck-sum">ยังไม่เช็ค ${rows.length - done}</span>`
          + `<span class="ck-sp"></span>`
          + `<button type="button" class="ck-act" data-a="clear"${Object.keys(day).length ? '' : ' disabled'}><i class="fa-solid fa-eraser"></i> ล้างทั้งหมด</button>`
          + `<button type="button" class="ck-act pri" data-a="off">เสร็จ</button>`
        : `<button type="button" class="ck-act pri" data-a="on"><i class="fa-solid fa-list-check"></i> เช็คชื่อ</button>`
          + (done ? `<span class="ck-sum">เช็คแล้ว ${done}/${rows.length} · มา ${n.in}</span>` : '')
          + `<span class="ck-note">บันทึกในเครื่องนี้ ไม่ออกในภาพ/PDF</span>`;
    box.insertBefore(bar, box.firstChild);
}

function ckSet(k, s) {
    const day = ckDay(), v = day[k] || {};
    if (s === 'note') {
        const t = prompt('หมายเหตุ — ' + k.split('|').pop() + '\n(เว้นว่าง = ลบหมายเหตุ)', v.n || '');
        if (t == null) return;
        v.n = t.trim();
        if (!v.n) delete v.n;
    } else if (s === 'delnote') {
        if (!confirm('ลบหมายเหตุ "' + v.n + '" ?')) return;
        delete v.n;
    } else if (v.s === s) {   // กดสถานะเดิมซ้ำ = ยกเลิก
        delete v.s; delete v.at;
    } else {
        const now = new Date();
        v.s = s;
        v.at = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }
    if (v.s || v.n) day[k] = v; else delete day[k];
    ckSave(); ckPaint();
}

function ckClick(e) {
    const act = e.target.closest('.ck-act');
    if (act) {
        const a = act.dataset.a;
        // เปิด/ปิดโหมด = วาดตารางใหม่ (ปิดแล้วเป็นตารางเดิมล้วน)
        if (a === 'on' || a === 'off') { ckSetOn(a === 'on'); renderStation(); return; }
        if (a === 'clear' && confirm('ล้างการเช็คชื่อทั้งหมดของวันนี้?')) {
            delete ckLoad()[ckDayKey(ckDate)]; ckSave(); ckPaint();
        }
        return;
    }
    const b = e.target.closest('.ck-cell button[data-s]');
    if (b) ckSet(b.closest('tr[data-ck]').dataset.ck, b.dataset.s);
}

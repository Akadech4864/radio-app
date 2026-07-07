/**
 * Config
 * IMPORTANT: User MUST replace this URL with their new Apps Script Web App URL after redeploying!
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxEFJh88uUU1_O3_4-jntXNHzlWdQpc0Jln-2rySR35CP83EKyEzwTZQFoUEeFyVnel/exec"; 

// Data State
let appData = {
    duty: [],
    mission: []
};

// Current Date State
let selectedDate = new Date();
let currentCalendarDate = new Date();
let currentSearchQuery = '';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const displayDateLabel = document.getElementById('displayDateLabel');
const investigatorDuty = document.getElementById('investigatorDuty');
const assistantDuty = document.getElementById('assistantDuty');
const dailyMissions = document.getElementById('dailyMissions');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const calendarDays = document.getElementById('calendarDays');
const searchLegend = document.getElementById('searchLegend');
const searchResultsPanel = document.getElementById('searchResultsPanel');
const searchResultsList = document.getElementById('searchResultsList');

// Initialize
async function init() {
    setupEventListeners();
    updateDisplayDateLabel();
    
    await loadData();
}

function setupEventListeners() {
    
    searchInput.addEventListener('change', (e) => {
        currentSearchQuery = e.target.value.toLowerCase();
        
        if (currentSearchQuery) {
            searchLegend.style.display = 'block';
        } else {
            searchLegend.style.display = 'none';
        }
        
        // Reset date to today when searching for a person
        selectedDate = new Date();
        currentCalendarDate = new Date();
        updateDisplayDateLabel();
        renderDashboard();
        
        renderCalendar();
        handleSearch(e.target.value);
    });

    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    const resetHomeBtn = document.getElementById('resetHomeBtn');
    if(resetHomeBtn) {
        resetHomeBtn.addEventListener('click', () => {
            selectedDate = new Date();
            currentCalendarDate = new Date();
            currentSearchQuery = '';
            searchInput.value = '';
            searchResultsPanel.style.display = 'none';
            searchLegend.style.display = 'none';
            updateDisplayDateLabel();
            renderDashboard();
            renderCalendar();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}


function formatShortThaiDate(dateObj) {
    if (!dateObj) return '';
    const thMonthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const d = dateObj.getDate();
    const m = thMonthsShort[dateObj.getMonth()];
    const y = (dateObj.getFullYear() + 543).toString().slice(-2);
    return `${d} ${m}.${y}`; // e.g. 12 มิ.ย.69
}

function updateDisplayDateLabel() {
    displayDateLabel.innerText = "ข้อมูลประจำวันที่ " + formatShortThaiDate(selectedDate);
}

// Utility to parse Thai dates from sheet (dd/MM/yyyy)
function parseSheetDate(dateStr) {
    if (!dateStr) return null;
    try {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Assume dd/mm/yyyy or dd/mm/yyyy HH:mm:ss
            return new Date(`${parts[2].split(' ')[0]}-${parts[1]}-${parts[0]}`);
        }
        return new Date(dateStr);
    } catch(e) {
        return null;
    }
}

// Fetch Data
async function loadData() {
    try {
        if(API_URL === "YOUR_NEW_APPS_SCRIPT_WEB_APP_URL_HERE" || API_URL === "") {
            // Mock data for preview until user sets the URL
            console.log("Using mock data for preview. Please set API_URL in app.js.");
            appData = {
                duty: [], mission: [], personnel: []
            };
        } else {
            const response = await fetch(`${API_URL}?api=radio`);
            const data = await response.json();
            appData = data;
        }
        
        if (appData && appData.personnel) {
            let optionsHtml = '<option value="">เลือกรายชื่อจากตาราง...</option>';
            for (let i = 1; i < appData.personnel.length; i++) {
                let row = appData.personnel[i];
                if (row && row[1]) {
                    optionsHtml += `<option value="${row[1]}">${row[1]}</option>`;
                }
            }
            searchInput.innerHTML = optionsHtml;
        }
        
        renderDashboard();
        renderCalendar();
    } catch (error) {
        console.error("Error loading data:", error);
        
        // Safeguard appData so renderCalendar doesn't crash
        if (!appData || !appData.duty) {
            appData = { duty: [], mission: [], personnel: [] };
        }
        
        showError("ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบ API URL: " + error.message);
        // Ensure calendar and dashboard still render empty state
        renderDashboard();
        renderCalendar();
    }
}

function showError(msg) {
    investigatorDuty.innerHTML = `<div class="empty-state" style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</div>`;
    assistantDuty.innerHTML = `<div class="empty-state" style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</div>`;
    dailyMissions.innerHTML = `<div class="empty-state" style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</div>`;
}

function extractCleanName(name) {
    if (!name) return '';
    return name.replace(/ว่าที่|ร\.ต\.ต\.|ร\.ต\.ท\.|ร\.ต\.อ\.|พ\.ต\.ต\.|พ\.ต\.ท\.|พ\.ต\.อ\.|ด\.ต\.|จ\.ส\.ต\.|ส\.ต\.อ\.|ส\.ต\.ท\.|ส\.ต\.ต\.|นายพลตำรวจ|พล\.ต\.|พล\.ต\.ต\.|หญิง|ผู้กำกับ|พัน|พนักงานสอบสวน/g, '').trim().toLowerCase();
}

function formatShortName(fullName) {
    if (!fullName) return '';
    let parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName + 'ฯ';
    parts.pop();
    return parts.join(' ') + 'ฯ';
}

function getPersonImage(name) {
    if (!appData.personnel) return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    let nameClean = extractCleanName(name);
    
    for (let row of appData.personnel) {
        if (!row) continue;
        let rowStr = row.join(' ').toLowerCase();
        if (nameClean.length > 2 && rowStr.includes(nameClean)) {
            let urlCell = row.find(cell => cell && typeof cell === 'string' && cell.startsWith('http'));
            if (urlCell) return urlCell;
        }
    }
    return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'; // default avatar
}

function getPersonPhone(name) {
    if (!appData.personnel) return '';
    let nameClean = extractCleanName(name);
    
    for (let row of appData.personnel) {
        if (!row) continue;
        let rowStr = row.join(' ').toLowerCase();
        if (nameClean.length > 2 && rowStr.includes(nameClean)) {
            // Column 3 is the formatted phone number, Column 10 is the dialable one if exists
            let phone = row[3];
            let dial = row[10] || row[3];
            if (phone) return { display: phone, dial: dial };
        }
    }
    return null;
}

function isSameDate(dateStr, targetDate) {
    if (!dateStr) return false;
    let parts = String(dateStr).split('/');
    if (parts.length !== 3) return false;
    let d = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10) - 1;
    let y = parseInt(parts[2], 10);
    if (y > 2500) y -= 543;
    return (d === targetDate.getDate() && m === targetDate.getMonth() && y === targetDate.getFullYear());
}

// Rendering Dashboard
function renderDashboard() {
    // Find duties
    let invs = [];
    let assts = [];
    
    // Assume Duty sheet structure: [Date, Investigator, Assistant, ...]
    const dutyRows = appData.duty.filter(r => isSameDate(r[0], selectedDate));
    dutyRows.forEach(row => {
        if(row[1]) invs.push(row[1]);
        if(row[2]) assts.push(row[2]);
    });

    investigatorDuty.innerHTML = invs.length > 0 
        ? invs.map(i => {
            let phoneInfo = getPersonPhone(i);
            let phoneLink = phoneInfo ? `<a href="tel:${phoneInfo.dial}" class="duty-phone" onclick="event.stopPropagation();"><i class="fa-solid fa-phone"></i> ${phoneInfo.display}</a>` : '';
            return `
            <div class="duty-item">
                <div class="duty-info-wrapper">
                    <img src="${getPersonImage(i)}" alt="${i}" class="duty-face">
                    <div class="duty-details">
                        <span class="duty-name">${i}</span>
                        ${phoneLink}
                    </div>
                </div>
                <span class="badge badge-duty">เวร</span>
            </div>`}).join('') 
        : '<div class="empty-state">ไม่มีข้อมูลพนักงานสอบสวนเวร</div>';
        
    assistantDuty.innerHTML = assts.length > 0 
        ? assts.map(a => {
            let phoneInfo = getPersonPhone(a);
            let phoneLink = phoneInfo ? `<a href="tel:${phoneInfo.dial}" class="duty-phone" onclick="event.stopPropagation();"><i class="fa-solid fa-phone"></i> ${phoneInfo.display}</a>` : '';
            return `
            <div class="duty-item">
                <div class="duty-info-wrapper">
                    <img src="${getPersonImage(a)}" alt="${a}" class="duty-face">
                    <div class="duty-details">
                        <span class="duty-name">${a}</span>
                        ${phoneLink}
                    </div>
                </div>
                <span class="badge badge-duty">ผู้ช่วยฯ</span>
            </div>`}).join('') 
        : '<div class="empty-state">ไม่มีข้อมูลผู้ช่วยพนักงานสอบสวน</div>';

    // Find missions
    // Assume Mission sheet: [Date, Time, Location, Title, Participants, ...]
    const missionRows = appData.mission.filter(r => isSameDate(r[0], selectedDate));
    dailyMissions.innerHTML = missionRows.length > 0
        ? missionRows.map(m => {
            let participants = m[4] ? m[4].split(/,|\n/).map(p => p.trim()).filter(p => p) : [];
            let shortNamesStr = participants.map(p => formatShortName(p)).join(', ');
            let faceHtml = participants.map(p => `<img src="${getPersonImage(p)}" alt="${p}" class="mission-face" title="${p}">`).join('');
            
            return `
            <div class="mission-item">
                <div>
                    <div class="mission-title">${m[3] || 'ไม่ระบุภารกิจ'}</div>
                    <div class="mission-details">
                        <i class="fa-regular fa-clock"></i> ${m[1] || '-'} | 
                        <i class="fa-solid fa-location-dot"></i> ${m[2] || '-'}
                    </div>
                    <div class="mission-details" style="margin-top:4px">
                        <i class="fa-solid fa-users"></i> ${shortNamesStr || '-'}
                    </div>
                    ${m[5] ? `<div class="mission-details" style="margin-top:4px; color: var(--primary); font-weight: 500;">
                        <i class="fa-solid fa-user-tie"></i> ปธ. ${m[5]}
                    </div>` : ''}
                    ${faceHtml ? `<div class="mission-faces-container">${faceHtml}</div>` : ''}
                </div>
            </div>
          `}).join('')
        : '<div class="empty-state">ไม่มีภารกิจวันนี้</div>';
}

// Rendering Calendar
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const thMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    currentMonthLabel.innerText = `${thMonths[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = '';
    
    // Empty cells
    for(let i=0; i<firstDay; i++) {
        html += `<div class="day-cell empty"></div>`;
    }
    
    // Days
    const today = new Date();
    for(let i=1; i<=daysInMonth; i++) {
        const cellDate = new Date(year, month, i);
        
        let classes = ['day-cell'];
        
        if (cellDate.toDateString() === today.toDateString()) classes.push('today');
        if (cellDate.toDateString() === selectedDate.toDateString()) classes.push('active');
        
        // Check duty and mission for indicators
        let hasDuty = false;
        let hasMission = false;
        
        if (currentSearchQuery) {
            hasDuty = appData.duty.some(r => isSameDate(r[0], cellDate) && ((r[1] && r[1].toLowerCase().includes(currentSearchQuery)) || (r[2] && r[2].toLowerCase().includes(currentSearchQuery))));
            hasMission = appData.mission.some(r => isSameDate(r[0], cellDate) && (r.join(' ').toLowerCase().includes(currentSearchQuery)));
            
            if (hasDuty) {
                classes.push('highlight-search-day');
            }
        } else {
            hasDuty = appData.duty.some(r => isSameDate(r[0], cellDate));
            hasMission = appData.mission.some(r => isSameDate(r[0], cellDate));
        }
        
        if (hasDuty) classes.push('has-duty');
        if (hasMission) classes.push('has-mission');
        
        html += `<div class="${classes.join(' ')}" onclick="selectDate(${year}, ${month}, ${i})">${i}</div>`;
    }
    
    calendarDays.innerHTML = html;
}

window.selectDate = function(y, m, d) {
    selectedDate = new Date(y, m, d);
    updateDisplayDateLabel();
    renderDashboard();
    renderCalendar();
    
    // Scroll down to the details view
    document.querySelector('.content-grid-bottom').scrollIntoView({ behavior: 'smooth' });
    
    // Scroll search results panel to the selected date if visible
    scrollToSearchResult(selectedDate);
}

function scrollToSearchResult(dateObj) {
    if (searchResultsPanel.style.display !== 'none') {
        const day = dateObj.getDate();
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();
        
        const items = document.querySelectorAll('.search-item');
        // Remove active class from all items
        for (let el of items) {
            el.classList.remove('active-search-item');
        }
        
        for (let el of items) {
            const dStr = el.getAttribute('data-date');
            const dObj = parseSheetDate(dStr);
            if (dObj && dObj.getDate() === day && dObj.getMonth() + 1 === month && dObj.getFullYear() === year) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Add persistent highlight
                el.classList.add('active-search-item');
                
                break;
            }
        }
    }
}


// Run
init();

// Searching
function handleSearch(query) {
    if(!query || query.trim() === '') {
        searchResultsPanel.style.display = 'none';
        return;
    }
    
    query = query.toLowerCase();
    let results = [];
    
    // Search Duty
    appData.duty.forEach(r => {
        const inv = r[1] ? r[1].toLowerCase() : '';
        const asst = r[2] ? r[2].toLowerCase() : '';
        
        if (inv.includes(query) || asst.includes(query)) {
            let matches = [];
            if (inv.includes(query)) matches.push(`พงส.: ${r[1]}`);
            if (asst.includes(query)) matches.push(`ผู้ช่วยฯ: ${r[2]}`);
            
            results.push({
                date: r[0],
                type: 'duty',
                text: matches.join(' / ')
            });
        }
    });
    
    // Search Mission
    appData.mission.forEach(r => {
        const rowStr = r.join(' ').toLowerCase();
        if (rowStr.includes(query)) {
            results.push({
                date: r[0],
                type: 'mission',
                text: `ภารกิจ: ${r[3]} - ${r[4]}`
            });
        }
    });
    
    if (results.length > 0) {
        // Sort by date (assuming dd/mm/yyyy)
        results.sort((a,b) => parseSheetDate(a.date) - parseSheetDate(b.date));
        
        searchResultsList.innerHTML = results.map(res => {
            let formattedDate = formatShortThaiDate(parseSheetDate(res.date));
            let badgeClass = res.type === 'duty' ? 'badge-duty' : 'badge-mission';
            let badgeText = res.type === 'duty' ? 'เวร' : 'ภารกิจ';
            return `
            <div class="search-item" data-date="${res.date}" style="cursor:pointer" onclick="goToDateStr('${res.date}')">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span class="date-tag"><i class="fa-regular fa-calendar-check"></i> ${formattedDate}</span>
                    <span class="badge ${badgeClass}">${badgeText}</span>
                </div>
                <div>${res.text}</div>
            </div>
            `;
        }).join('');
    } else {
        searchResultsList.innerHTML = '<div class="empty-state">ไม่พบข้อมูล</div>';
    }
    
    searchResultsPanel.style.display = 'block';
    
    // Find closest date and scroll
    let closestDateObj = null;
    let minDiff = Infinity;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    results.forEach(res => {
        const d = parseSheetDate(res.date);
        const diff = Math.abs(d - today);
        if (diff < minDiff) {
            minDiff = diff;
            closestDateObj = d;
        }
    });
    
    if (closestDateObj) {
        setTimeout(() => {
            scrollToSearchResult(closestDateObj);
        }, 100);
    }
}

window.goToDateStr = function(dateStr) {
    const d = parseSheetDate(dateStr);
    if(d) {
        selectedDate = d;
        currentCalendarDate = new Date(d);
        updateDisplayDateLabel();
        renderDashboard();
        renderCalendar();
        
        // On mobile, might want to scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

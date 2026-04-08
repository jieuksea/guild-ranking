const initialMembers = [
    "天くんのパパ", "Ｔ－Ａ", "なみいー", "TKKGHS", "よっしー202512", "赤毛ザル", "くの字", "シンシド",
    "78ワークス", "オノモン", "指揮官1889e2041", "0125shinkono0104", "taihs", "ハイジ2026", "モモンガ777",
    "れーーーすん", "のぶさん19", "いなっちミオ", "指揮官2326b2041", "botti family", "ぎょんぎょん",
    "指揮官200522041", "指揮官1d4cb2041", "森繁", "ちかみた", "こやぺん", "指揮官199582041", "パオきち",
    "ちゃーこ将軍", "きゃっつ", "がごめ昆布", "指揮官1fcf62041", "ムムー－－", "シエラ7777", "指揮官1f9302041",
    "Issa2026", "指揮官2488d2031", "あいちょんぺ"
];

const rolePriority = ["盟主", "戦神", "女神", "理事", "執事", "R4", "R3", "R2", "R1"];
const roles = [...rolePriority].reverse();

let members = [];
let dailyData = {};
let weeklyData = {};
let currentRankingWeekStart = '';
let currentWeeklyWeekStart = '';
let thresholds = { R2: 5000, R3: 10000, R4: 20000, Ex: 40000 };

async function init() {
    // 1. まずローカルのデータをロード
    const savedMembers = localStorage.getItem('guildRankingData');
    if (savedMembers) {
        members = JSON.parse(savedMembers);
    } else {
        members = initialMembers.map(name => ({ name, role: 'R1' }));
    }

    const savedDaily = localStorage.getItem('guildDailyContribution');
    if (savedDaily) dailyData = JSON.parse(savedDaily);

    const savedWeekly = localStorage.getItem('guildWeeklyContribution');
    if (savedWeekly) weeklyData = JSON.parse(savedWeekly);

    const savedThresholds = localStorage.getItem('guildPromotionThresholds');
    if (savedThresholds) thresholds = JSON.parse(savedThresholds);

    // 2. Firebaseが設定されていればクラウドから最新を取得
    if (window.db) {
        console.log("Firebase同期を開始します...");
        try {
            const doc = await db.collection('guild').doc('current').get();
            if (doc.exists) {
                const data = doc.data();
                if (data.members) members = data.members;
                if (data.dailyData) dailyData = data.dailyData;
                if (data.weeklyData) weeklyData = data.weeklyData;
                if (data.thresholds) thresholds = data.thresholds;
                console.log("Firebaseからのデータ取得に成功しました。");
                showSyncBadge(true);
            }
        } catch (e) {
            console.error("Firebase同期失敗:", e);
            showSyncBadge(false);
        }
    }

    // 3. UIの初期化
    if (document.getElementById('thresholdR2')) document.getElementById('thresholdR2').value = thresholds.R2;
    if (document.getElementById('thresholdR3')) document.getElementById('thresholdR3').value = thresholds.R3;
    if (document.getElementById('thresholdR4')) document.getElementById('thresholdR4').value = thresholds.R4;
    if (document.getElementById('thresholdEx')) document.getElementById('thresholdEx').value = thresholds.Ex;

    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const monStr = formatDate(monday);
    currentRankingWeekStart = monStr;
    currentWeeklyWeekStart = monStr;

    if (document.getElementById('rankingWeekPicker')) document.getElementById('rankingWeekPicker').value = monStr;
    if (document.getElementById('weeklyWeekPicker')) document.getElementById('weeklyWeekPicker').value = monStr;

    setupTabs();
    initCalendar();
    setupEntryForms();
    renderTable();
    updateRankingWeekDisplay();
    updateWeeklyInputWeekDisplay();
    renderDailyGrid();
    updateStats();
}

function showSyncBadge(success) {
    let badge = document.getElementById('firebase-status');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'firebase-status';
        badge.style = "position:fixed; bottom:20px; right:20px; font-size:12px; padding:5px 10px; border-radius:20px; background:rgba(0,0,0,0.5); z-index:100; pointer-events:none;";
        document.body.appendChild(badge);
    }
    badge.innerHTML = success ? "🟢 Cloud Sync Active" : "⚪ Offline Mode";
    badge.style.color = success ? "#2ecc71" : "#b2bec3";
}

function initCalendar() {
    const calendar = document.getElementById('specificDatePicker');
    if (calendar) {
        calendar.value = formatDate(new Date());
        calendar.addEventListener('change', renderDailyGrid);
    }
}

function setupEntryForms() {
    const dailyBtn = document.getElementById('applyBulkBtn');
    if (dailyBtn) dailyBtn.addEventListener('click', handleBulkInput);

    const weeklyBtn = document.getElementById('applyWeeklyBulkBtn');
    if (weeklyBtn) weeklyBtn.addEventListener('click', handleWeeklyBulkInput);

    const simBtn = document.getElementById('updateSimBtn');
    if (simBtn) simBtn.addEventListener('click', () => {
        if (!checkAuth()) return;
        thresholds.R2 = parseInt(document.getElementById('thresholdR2').value) || 0;
        thresholds.R3 = parseInt(document.getElementById('thresholdR3').value) || 0;
        thresholds.R4 = parseInt(document.getElementById('thresholdR4').value) || 0;
        thresholds.Ex = parseInt(document.getElementById('thresholdEx').value) || 0;
        save();
        renderSimulator();
    });
}

function setupTabs() {
    const btns = document.querySelectorAll('.nav-btn');
    const contents = document.querySelectorAll('.tab-content');
    const title = document.getElementById('current-view-title');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            btns.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${tab}`).classList.add('active');

            if (tab === 'manage') title.textContent = '連盟員管理 & 役職設定';
            if (tab === 'daily') { title.textContent = '毎日用：ポイント入力'; renderDailyGrid(); }
            if (tab === 'daily-ranking') { title.textContent = 'ランキング(毎日)：週次集計'; renderDailyRankingSummary(); }
            if (tab === 'weekly') { title.textContent = '毎週用：週計ポイント入力'; renderWeeklyGrid(); }
            if (tab === 'simulator') { title.textContent = '昇格シミュレーター'; renderSimulator(); }
        });
    });
}

function checkAuth() {
    return prompt("パスワードは？") === "jieu";
}

function exportData() {
    const data = {
        members,
        dailyData,
        weeklyData,
        thresholds,
        version: "1.0",
        exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guild_data_${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!confirm('既存のデータが上書きされます。よろしいですか？')) return;
    if (!checkAuth()) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            if (data.members) members = data.members;
            if (data.dailyData) dailyData = data.dailyData;
            if (data.weeklyData) weeklyData = data.weeklyData;
            if (data.thresholds) thresholds = data.thresholds;
            
            save();
            init(); // 再初期化
            alert('インポートが完了しました！');
        } catch (err) {
            alert('ファイルの読み込みに失敗しました。形式を確認してください。');
        }
    };
    reader.readAsText(file);
}

// --- 毎日用ロジック ---
function handleBulkInput() {
    if (!checkAuth()) return;
    const area = document.getElementById('bulkInputArea');
    const date = document.getElementById('specificDatePicker').value;
    if (!area || !date) return;
    if (!dailyData[date]) dailyData[date] = {};

    area.value.split('\n').forEach(line => {
        const match = line.match(/^(.+?)[,\s：:　]+(\d+)$/);
        if (match) {
            const pastedName = match[1].trim();
            const normPasted = normalizeName(pastedName);
            const pts = parseInt(match[2]);
            
            const member = members.find(m => normalizeName(m.name) === normPasted);
            if (member) dailyData[date][member.name] = pts;
        }
    });

    save();
    renderDailyGrid();
    area.value = '';
    alert('反映しました！');
}

function normalizeName(str) {
    if (!str) return "";
    let n = str.normalize('NFKC') // 全角半角統一
               .replace(/[ぁ-ん]/g, s => String.fromCharCode(s.charCodeAt(0) + 0x60)); // ひらがな→カタカナ
    
    const smallKanaMap = {
        'ァ':'ア','ィ':'イ','ゥ':'ウ','ェ':'エ','ォ':'オ',
        'ッ':'ツ','ャ':'ヤ','ュ':'ユ','ョ':'ヨ','ヮ':'ワ','ヶ':'ケ','ヶ':'ケ'
    };
    n = n.replace(/[ァィゥェォッャュョヮヵヶ]/g, s => smallKanaMap[s] || s); // 小書き→大書き
    
    return n.replace(/[ー―－‐]+(?=[ー―－‐])|[-ー―－‐]/g, 'ー') // 長音・ハイフン類を1つの「ー」に
            .replace(/ー+/g, 'ー') // 連続する長音を1つに
            .replace(/\s+/g, '') 
            .toLowerCase();
}

function renderDailyGrid() {
    const grid = document.getElementById('dailyInputGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const date = document.getElementById('specificDatePicker').value;
    if (!date) return;

    members.forEach(member => {
        const pts = (dailyData[date] && dailyData[date][member.name]) || '';
        const cell = document.createElement('div');
        cell.className = 'input-cell';
        cell.innerHTML = `<span class="input-cell-name">${member.name}</span>
            <input type="number" class="input-cell-points" value="${pts}" placeholder="0" 
                   onchange="updateDailyPoint('${date}', '${member.name}', this.value)">`;
        grid.appendChild(cell);
    });
}

function updateDailyPoint(date, name, value) {
    if (!dailyData[date]) dailyData[date] = {};
    dailyData[date][name] = parseInt(value) || 0;
}

// --- 毎週用ロジック ---
function handleWeeklyBulkInput() {
    if (!checkAuth()) return;
    const area = document.getElementById('weeklyBulkArea');
    if (!area || !currentWeeklyWeekStart) return;
    if (!weeklyData[currentWeeklyWeekStart]) weeklyData[currentWeeklyWeekStart] = {};

    area.value.split('\n').forEach(line => {
        const match = line.match(/^(.+?)[,\s：:　]+(\d+)$/);
        if (match) {
            const pastedName = match[1].trim();
            const normPasted = normalizeName(pastedName);
            const pts = parseInt(match[2]);
            
            const member = members.find(m => normalizeName(m.name) === normPasted);
            if (member) weeklyData[currentWeeklyWeekStart][member.name] = pts;
        }
    });

    save();
    renderWeeklyGrid();
    area.value = '';
    alert('週計データを反映しました！');
}

function renderWeeklyGrid() {
    const grid = document.getElementById('weeklyInputGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!currentWeeklyWeekStart) return;

    members.forEach(member => {
        const pts = (weeklyData[currentWeeklyWeekStart] && weeklyData[currentWeeklyWeekStart][member.name]) || '';
        const cell = document.createElement('div');
        cell.className = 'input-cell';
        cell.innerHTML = `<span class="input-cell-name">${member.name}</span>
            <input type="number" class="input-cell-points" value="${pts}" placeholder="0" 
                   onchange="updateWeeklyPoint('${currentWeeklyWeekStart}', '${member.name}', this.value)">`;
        grid.appendChild(cell);
    });
}

function updateWeeklyPoint(date, name, value) {
    if (!weeklyData[date]) weeklyData[date] = {};
    weeklyData[date][name] = parseInt(value) || 0;
}

// --- ランキング表示 ---
function renderDailyRankingSummary() {
    const tbody = document.getElementById('dailySummaryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const weekDays = getWeekDays(currentRankingWeekStart);

    const summary = members.map(m => {
        let total = 0;
        const pts = [];
        for (let i = 0; i < 6; i++) {
            const p = (dailyData[weekDays[i]] && dailyData[weekDays[i]][m.name]) || 0;
            pts.push(p);
            total += p;
        }
        return { name: m.name, role: m.role, pts, total };
    }).sort((a, b) => b.total - a.total);

    summary.forEach((m, idx) => {
        const tr = document.createElement('tr');
        if (idx < 3) tr.className = `rank-${idx + 1}`;
        tr.innerHTML = `<td><span class="rank-badge">${idx + 1}</span></td>
            <td class="sticky-col member-name">${m.name}</td><td>${m.role}</td>
            ${m.pts.map(p => `<td>${p.toLocaleString()}</td>`).join('')}
            <td class="total-col">${m.total.toLocaleString()}</td>`;
        tbody.appendChild(tr);
    });
}

function updateRankingWeekDisplay() {
    const days = getWeekDays(currentRankingWeekStart);
    const target = document.getElementById('rankingWeekRangeDisplay');
    if (target) target.textContent = `${days[0].replace(/-/g, '/')} - ${days[6].replace(/-/g, '/')}`;
}

function updateWeeklyInputWeekDisplay() {
    const days = getWeekDays(currentWeeklyWeekStart);
    const target = document.getElementById('weeklyRangeDisplay');
    if (target) target.textContent = `${days[0].replace(/-/g, '/')} - ${days[6].replace(/-/g, '/')}`;
}

// --- 管理・共通 ---
function renderTable(filter = '') {
    const tbody = document.getElementById('memberListBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const sorted = [...members].sort((a, b) => {
        const pA = rolePriority.indexOf(a.role);
        const pB = rolePriority.indexOf(b.role);
        return (pA - pB) || a.name.localeCompare(b.name, 'ja');
    });

    sorted.filter(m => m.name.toLowerCase().includes(filter.toLowerCase())).forEach((m, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td>
            <td>
                <input type="text" class="name-edit-input" 
                       value="${m.name}" 
                       onchange="updateName('${m.name}', this.value)">
            </td>
            <td><select class="role-select" onchange="updateRole('${m.name}', this.value)">
                ${roles.map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select></td>
            <td><button class="btn-delete" onclick="removeMember('${m.name}')">×</button></td>`;
        tbody.appendChild(tr);
    });
}

function updateName(oldName, newName) {
    newName = newName.trim();
    if (!newName || oldName === newName) {
        renderTable(); // 元に戻す
        return;
    }
    
    if (!checkAuth()) {
        renderTable();
        return;
    }
    
    if (members.find(m => m.name === newName)) {
        alert('その名前は既に存在します。');
        renderTable(); 
        return;
    }

    // 1. メンバーリストの更新
    const m = members.find(x => x.name === oldName);
    if (m) m.name = newName;

    // 2. 毎日用データの移行
    Object.keys(dailyData).forEach(date => {
        if (dailyData[date][oldName] !== undefined) {
            dailyData[date][newName] = dailyData[date][oldName];
            delete dailyData[date][oldName];
        }
    });

    // 3. 毎週用データの移行
    Object.keys(weeklyData).forEach(week => {
        if (weeklyData[week][oldName] !== undefined) {
            weeklyData[week][newName] = weeklyData[week][oldName];
            delete weeklyData[week][oldName];
        }
    });

    save();
    renderTable();
    updateStats();
    alert(`「${oldName}」を「${newName}」に変更し、全てのポイントデータを引き継ぎました。`);
}

function updateRole(name, role) {
    if (!checkAuth()) {
        renderTable();
        return;
    }
    const m = members.find(x => x.name === name);
    if (m) m.role = role;
    save();
}

function removeMember(name) {
    if (!checkAuth()) return;
    if (true) { // 既定のフローを維持 
        // 1. メンバーリストから削除
        members = members.filter(x => x.name !== name);
        
        // 2. 毎日用データから削除
        Object.keys(dailyData).forEach(date => {
            delete dailyData[date][name];
        });

        // 3. 毎週用データから削除
        Object.keys(weeklyData).forEach(week => {
            delete weeklyData[week][name];
        });

        save();
        renderTable();
        updateStats();
    }
}

// --- シミュレーター ---
function renderSimulator() {
    const tbody = document.getElementById('simBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // weeklyDataの中から直近（最新）の日付を取得
    const weekKeys = Object.keys(weeklyData).filter(k => Object.keys(weeklyData[k]).length > 0).sort();
    const latestWeekKey = weekKeys.length > 0 ? weekKeys[weekKeys.length - 1] : null;

    const currentPoints = latestWeekKey ? weeklyData[latestWeekKey] : {};

    // 表示用タイトルの更新
    const title = document.querySelector('#tab-simulator .grid-header p');
    if (title && latestWeekKey) {
        const d = latestWeekKey.replace(/-/g, '/');
        title.textContent = `直近の毎週用データ (${d}開始の週) を参照中`;
    }

    const roleLevels = { "盟主": 4, "戦神": 4, "女神": 4, "理事": 4, "執事": 4, "R4": 3, "R3": 2, "R2": 1, "R1": 0 };
    const levelRoles = ["R1", "R2", "R3", "R4", "幹部級"];

    // 役職の優先順位でソート
    const sortedMembers = [...members].sort((a, b) => {
        const pA = rolePriority.indexOf(a.role);
        const pB = rolePriority.indexOf(b.role);
        return (pA - pB) || a.name.localeCompare(b.name, 'ja');
    });

    sortedMembers.forEach(m => {
        const pts = currentPoints[m.name] || 0;
        let recLevel = 0;
        if (pts >= thresholds.Ex) recLevel = 4;
        else if (pts >= thresholds.R4) recLevel = 3;
        else if (pts >= thresholds.R3) recLevel = 2;
        else if (pts >= thresholds.R2) recLevel = 1;

        const currentLevel = roleLevels[m.role] !== undefined ? roleLevels[m.role] : 0;

        let status = "維持";
        let statusClass = "status-stable";

        // 幹部級（レベル4）は判定対象外とする
        if (currentLevel === 4) {
            status = "判定対象外";
            statusClass = "status-stable";
        } else if (recLevel > currentLevel) {
            status = "昇格推奨";
            statusClass = "status-up";
        } else if (recLevel < currentLevel) {
            status = "降格対象";
            statusClass = "status-down";
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.name}</td>
            <td class="numeric-col">${pts.toLocaleString()}</td>
            <td>${m.role}</td>
            <td style="font-weight:700; color: var(--secondary);">${levelRoles[recLevel]}</td>
            <td><span class="sim-status ${statusClass}">${status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function save() {
    localStorage.setItem('guildRankingData', JSON.stringify(members));
    localStorage.setItem('guildDailyContribution', JSON.stringify(dailyData));
    localStorage.setItem('guildWeeklyContribution', JSON.stringify(weeklyData));
    localStorage.setItem('guildPromotionThresholds', JSON.stringify(thresholds));

    // Firebase同期
    if (window.db) {
        db.collection('guild').doc('current').set({
            members,
            dailyData,
            weeklyData,
            thresholds,
            lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => console.log("クラウドに保存しました。"))
          .catch(e => console.error("クラウド保存失敗:", e));
    }
}

function updateStats() {
    const count = document.getElementById('memberCount');
    if (count) count.textContent = members.length;
}

// イベント
const rwp = document.getElementById('rankingWeekPicker');
if (rwp) rwp.addEventListener('change', e => {
    currentRankingWeekStart = getMonStr(e.target.value);
    updateRankingWeekDisplay(); renderDailyRankingSummary();
});

const wwp = document.getElementById('weeklyWeekPicker');
if (wwp) wwp.addEventListener('change', e => {
    currentWeeklyWeekStart = getMonStr(e.target.value);
    updateWeeklyInputWeekDisplay(); renderWeeklyGrid();
});

document.getElementById('memberSearch').addEventListener('input', e => renderTable(e.target.value));
document.getElementById('addMemberBtn').addEventListener('click', () => {
    const name = document.getElementById('newMemberName').value.trim();
    if (!name) return;
    if (!checkAuth()) return;
    
    members.push({ name, role: 'R1' });
    document.getElementById('newMemberName').value = '';
    save(); renderTable(); updateStats();
});
document.getElementById('saveData').addEventListener('click', () => { 
    if (checkAuth()) {
        save(); 
        alert('保存しました！'); 
    }
});

document.getElementById('exportDataBtn').addEventListener('click', exportData);
document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
document.getElementById('importFileInput').addEventListener('change', handleImport);

function getMonStr(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return formatDate(new Date(d.setDate(diff)));
}

function getWeekDays(startDateStr) {
    const start = new Date(startDateStr);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i); return formatDate(d);
    });
}

function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

init();

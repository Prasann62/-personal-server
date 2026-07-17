// State variables
let trainingEntries = JSON.parse(localStorage.getItem('trainingEntries')) || [];
let personalBests = JSON.parse(localStorage.getItem('personalBests')) || {};
let reminderSettings = JSON.parse(localStorage.getItem('reminderSettings')) || { time: '18:00', enabled: false };

// Men's Indian National Records (in seconds)
const NATIONAL_RECORDS = {
    '100m': 10.09,
    '200m': 20.32,
    '400m': 44.98,
    '800m': 104.93,
    '1500m': 215.24,
    '5000m': 783.93,
    '10000m': 1620.22
};

// DOM Elements
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
const logDateInput = document.getElementById('log-date');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupNavigation();
    setupForms();
    setupDataActions();
    setupReminders();
    
    // Set default date to today
    logDateInput.valueAsDate = new Date();
    
    // Initial Render
    renderDashboard();
    renderHistory();
    renderRecords();
    
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => {
                console.log('Service Worker Registered');
                // Request periodic sync if supported and enabled
                if ('periodicSync' in reg && reminderSettings.enabled) {
                    reg.periodicSync.register('daily-reminder', {
                        minInterval: 12 * 60 * 60 * 1000 // 12 hours
                    }).catch(console.error);
                }
            })
            .catch(console.error);
    }
}

// Navigation Logic
function setupNavigation() {
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            
            navBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetId).classList.add('active');
            
            // Re-render views if needed when navigating to them
            if(targetId === 'home') renderDashboard();
            if(targetId === 'history') renderHistory();
            if(targetId === 'records') renderRecords();
            if(targetId === 'calculator') renderCalculator();
        });
    });
}

// Form Handlers
function setupForms() {
    const logForm = document.getElementById('log-form');
    logForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const entry = {
            id: Date.now().toString(),
            date: document.getElementById('log-date').value,
            weight_kg: document.getElementById('log-weight').value ? parseFloat(document.getElementById('log-weight').value) : null,
            session_type: document.getElementById('log-type').value,
            distance_km: document.getElementById('log-distance').value ? parseFloat(document.getElementById('log-distance').value) : null,
            time_min: document.getElementById('log-time').value ? parseFloat(document.getElementById('log-time').value) : null,
            notes: document.getElementById('log-notes').value
        };
        
        trainingEntries.push(entry);
        saveData();
        showToast('Entry logged successfully!');
        
        // Reset non-date fields
        document.getElementById('log-weight').value = '';
        document.getElementById('log-distance').value = '';
        document.getElementById('log-time').value = '';
        document.getElementById('log-notes').value = '';
        
        // Navigate to home
        document.querySelector('.nav-btn[data-target="home"]').click();
    });

    const recordForm = document.getElementById('record-form');
    recordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const distance = document.getElementById('record-distance').value;
        const timeInput = document.getElementById('record-time').value.trim();
        
        const seconds = parseTime(timeInput);
        if (seconds === null) {
            showToast('Invalid time format. Use mm:ss or seconds.');
            return;
        }
        
        personalBests[distance] = seconds;
        saveData();
        renderRecords();
        showToast(`Record updated for ${distance}`);
        document.getElementById('record-time').value = '';
    });

    const tdeeForm = document.getElementById('tdee-form');
    if (tdeeForm) {
        tdeeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const gender = document.getElementById('tdee-gender').value;
            const age = parseInt(document.getElementById('tdee-age').value);
            const weight = parseFloat(document.getElementById('tdee-weight').value);
            const height = parseFloat(document.getElementById('tdee-height').value);
            const activity = parseFloat(document.getElementById('tdee-activity').value);
            
            // Mifflin-St Jeor Equation
            let bmr = (10 * weight) + (6.25 * height) - (5 * age);
            bmr += (gender === 'male') ? 5 : -161;
            
            const tdee = bmr * activity;
            
            const resultBox = document.getElementById('tdee-result');
            resultBox.style.display = 'block';
            resultBox.innerHTML = `
                <h4 style="color:var(--primary); margin-bottom: 0.5rem;">Results:</h4>
                <p><strong>BMR:</strong> ${Math.round(bmr)} kcal/day</p>
                <p><strong>Maintenance (TDEE):</strong> ${Math.round(tdee)} kcal/day</p>
                <hr style="margin: 0.5rem 0; border: none; border-top: 1px solid var(--border);">
                <p style="font-size: 0.85rem; color: var(--text-muted);">
                    To lose weight (0.5kg/week): ~${Math.round(tdee - 500)} kcal/day<br>
                    To gain muscle (0.25kg/week): ~${Math.round(tdee + 250)} kcal/day
                </p>
            `;
        });
    }

    const burnForm = document.getElementById('burn-form');
    if (burnForm) {
        burnForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = document.getElementById('burn-type').value;
            const weight = parseFloat(document.getElementById('burn-weight').value);
            const time = parseInt(document.getElementById('burn-time').value);
            
            // Estimated MET values
            const metValues = {
                'easy run': 8.3,
                'interval run': 11.0,
                'endurance run': 9.8,
                'calisthenics': 8.0,
                'mixed+dumbbell': 6.0,
                'kettlebell': 8.0
            };
            
            const met = metValues[type] || 8.0;
            // Calories Burned = MET * Weight (kg) * (Time in min / 60)
            const caloriesBurned = met * weight * (time / 60);
            
            const resultBox = document.getElementById('burn-result');
            resultBox.style.display = 'block';
            resultBox.innerHTML = `
                <h4 style="color:var(--primary); margin-bottom: 0.5rem;">Estimated Burn:</h4>
                <p style="font-size: 1.5rem; font-weight: bold;">${Math.round(caloriesBurned)} <span style="font-size: 1rem; font-weight: normal; color: var(--text-muted);">kcal</span></p>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">Based on a MET value of ${met}</p>
            `;
        });
    }
}

// Rendering Logic
function renderDashboard() {
    document.getElementById('total-entries').textContent = trainingEntries.length;
    
    // Sort entries by date desc
    const sorted = [...trainingEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Recent List
    const recentList = document.getElementById('recent-list');
    recentList.innerHTML = '';
    const last5 = sorted.slice(0, 5);
    
    if (last5.length === 0) {
        recentList.innerHTML = '<li style="text-align:center;color:var(--text-muted)">No entries yet.</li>';
    } else {
        last5.forEach(entry => {
            const li = document.createElement('li');
            const distTime = (entry.distance_km ? entry.distance_km + 'km ' : '') + 
                             (entry.time_min ? entry.time_min + 'min' : '');
            li.innerHTML = `
                <div class="entry-details">
                    <strong>${entry.session_type}</strong>
                    <span>${formatDate(entry.date)} ${distTime ? '- ' + distTime : ''}</span>
                </div>
            `;
            recentList.appendChild(li);
        });
    }

    // Weight Logic
    const weightEntries = sorted.filter(e => e.weight_kg !== null);
    const currentWeightEl = document.getElementById('current-weight');
    const weightChangeEl = document.getElementById('weight-change');
    
    if (weightEntries.length > 0) {
        const latestWeight = weightEntries[0].weight_kg;
        currentWeightEl.textContent = `${latestWeight} kg`;
        
        // Find weight 7 days ago approx
        const latestDate = new Date(weightEntries[0].date);
        const sevenDaysAgo = new Date(latestDate);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // Find closest entry to 7 days ago
        let oldWeight = null;
        for (let i = 1; i < weightEntries.length; i++) {
            const d = new Date(weightEntries[i].date);
            if (d <= sevenDaysAgo) {
                oldWeight = weightEntries[i].weight_kg;
                break;
            }
        }
        
        if (oldWeight !== null) {
            const diff = (latestWeight - oldWeight).toFixed(1);
            const sign = diff > 0 ? '+' : '';
            weightChangeEl.textContent = `7-day: ${sign}${diff} kg`;
        } else {
            weightChangeEl.textContent = '7-day: -- kg';
        }
    } else {
        currentWeightEl.textContent = '-- kg';
        weightChangeEl.textContent = '7-day: -- kg';
    }

    // Streak Logic
    document.getElementById('logging-streak').textContent = `${calculateStreak(sorted)} days`;
}

function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';
    
    const sorted = [...trainingEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No history available.</td></tr>';
        return;
    }

    sorted.forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(entry.date)}</td>
            <td>${entry.session_type}</td>
            <td>${entry.distance_km || '-'}</td>
            <td>${entry.time_min || '-'}</td>
            <td><button class="btn-small" onclick="deleteEntry('${entry.id}')">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderRecords() {
    const recordsList = document.getElementById('records-list');
    recordsList.innerHTML = '';
    
    const distances = ['100m', '200m', '400m', '800m', '1500m', '5000m', '10000m'];
    
    distances.forEach(dist => {
        const nr = NATIONAL_RECORDS[dist];
        const pb = personalBests[dist];
        
        const div = document.createElement('div');
        div.className = 'record-item';
        
        let content = `
            <div class="record-header">
                <h4>${dist}</h4>
                <div class="record-times">
                    PB: <strong>${pb ? formatSeconds(pb) : '--'}</strong> / NR: ${formatSeconds(nr)}
                </div>
            </div>
        `;
        
        if (pb) {
            // Calculate percentage based on speed (time). Faster = lower time.
            // A PB > NR means they are slower. NR / PB * 100 gives % of NR pace.
            let percent = (nr / pb) * 100;
            if (percent > 100) percent = 100; // Cap at 100 if faster than NR (unlikely!)
            
            content += `
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                </div>
                <span class="progress-text">${percent.toFixed(1)}% of National Record Pace</span>
            `;
        }
        
        div.innerHTML = content;
        recordsList.appendChild(div);
    });
}

function renderCalculator() {
    // Attempt to prefill weight from history
    const sorted = [...trainingEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
    const weightEntries = sorted.filter(e => e.weight_kg !== null);
    
    if (weightEntries.length > 0) {
        const latestWeight = weightEntries[0].weight_kg;
        const tdeeWeight = document.getElementById('tdee-weight');
        const burnWeight = document.getElementById('burn-weight');
        
        if (tdeeWeight && !tdeeWeight.value) tdeeWeight.value = latestWeight;
        if (burnWeight && !burnWeight.value) burnWeight.value = latestWeight;
    }
}

// Data Actions
function setupDataActions() {
    const exportBtn = document.getElementById('export-btn');
    const importFile = document.getElementById('import-file');
    
    exportBtn.addEventListener('click', () => {
        const data = {
            trainingEntries,
            personalBests,
            reminderSettings
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `training_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Data exported successfully.');
    });
    
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.trainingEntries) trainingEntries = data.trainingEntries;
                if (data.personalBests) personalBests = data.personalBests;
                if (data.reminderSettings) reminderSettings = data.reminderSettings;
                
                saveData();
                renderDashboard();
                renderHistory();
                renderRecords();
                
                // Reset reminder UI
                document.getElementById('reminder-time').value = reminderSettings.time;
                updateReminderBtnUI();
                
                showToast('Data imported successfully.');
            } catch (err) {
                showToast('Error importing data. Invalid format.');
            }
        };
        reader.readAsText(file);
    });
}

// Reminders
function setupReminders() {
    const reminderTimeInput = document.getElementById('reminder-time');
    const enableBtn = document.getElementById('enable-reminder');
    
    reminderTimeInput.value = reminderSettings.time;
    updateReminderBtnUI();
    
    enableBtn.addEventListener('click', () => {
        if (!reminderSettings.enabled) {
            Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                    reminderSettings.enabled = true;
                    reminderSettings.time = reminderTimeInput.value;
                    saveData();
                    updateReminderBtnUI();
                    showToast('Reminders enabled!');
                } else {
                    showToast('Notification permission denied.');
                }
            });
        } else {
            // Disable
            reminderSettings.enabled = false;
            saveData();
            updateReminderBtnUI();
            showToast('Reminders disabled.');
        }
    });
    
    reminderTimeInput.addEventListener('change', () => {
        reminderSettings.time = reminderTimeInput.value;
        saveData();
    });

    // Check reminders periodically
    setInterval(checkReminder, 60000); // check every minute
    checkReminder(); // check on load
}

function updateReminderBtnUI() {
    const btn = document.getElementById('enable-reminder');
    if (reminderSettings.enabled) {
        btn.textContent = 'Disable Daily Reminder';
        btn.classList.remove('primary');
        btn.classList.add('secondary');
    } else {
        btn.textContent = 'Enable Daily Reminder';
        btn.classList.remove('secondary');
        btn.classList.add('primary');
    }
}

function checkReminder() {
    if (!reminderSettings.enabled || Notification.permission !== 'granted') return;
    
    const now = new Date();
    const [hours, minutes] = reminderSettings.time.split(':').map(Number);
    
    // Check if it's past the reminder time today
    if (now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes)) {
        
        // Check if an entry exists for today
        const todayStr = now.toISOString().split('T')[0];
        const hasLoggedToday = trainingEntries.some(e => e.date === todayStr);
        
        // Check if we already reminded today (using a separate flag to avoid spamming)
        const lastReminded = localStorage.getItem('lastRemindedDate');
        
        if (!hasLoggedToday && lastReminded !== todayStr) {
            new Notification("Training Reminder", {
                body: "Time to log today's training — don't break your streak.",
                icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2MxNDQwZSI+PHBhdGggZD0iTTEzLjUgNS41Yy44MyAwIDEuNS0uNjcgMS41LTEuNVMxNC4zMyAyLjUgMTMuNSAyLjUgMTIgMy4xNyAxMiA0czLjY3IDEuNSAxLjUgMS41ek0xNSAxNS41bDIuNSAyLjNWMjRINTF2LTUuNWwtMi4zLTIuM3YtMy40bDItLjYgMS40IDEuNWMtLjQuOC0xIDEuNS0xLjYgMS45TDExLjUgMjA4em0tNy0zLjVMMiA5di0yaDMuM2wxLjcgMS40TDExIDd2LTJjMC0xLjEtLjktMi0yLTJINi41QzUuMSAzIDQgNC4xIDQgNS41UzUuMSA4IDYuNSA4SDdWNi41Yy0uNiAwLTEuMS0uNC0xLjEtMWgwem0xMy0zYzEuMSAwIDItLjkgMi0ydjJIMjBsLTEuNy0xLjRMMTQgOS40di0yLjV6Ii8+PC9zdmc+",
            });
            localStorage.setItem('lastRemindedDate', todayStr);
        }
    }
}

// Helpers
window.deleteEntry = function(id) {
    if (confirm('Are you sure you want to delete this entry?')) {
        trainingEntries = trainingEntries.filter(e => e.id !== id);
        saveData();
        renderHistory();
        renderDashboard();
        showToast('Entry deleted');
    }
}

function saveData() {
    localStorage.setItem('trainingEntries', JSON.stringify(trainingEntries));
    localStorage.setItem('personalBests', JSON.stringify(personalBests));
    localStorage.setItem('reminderSettings', JSON.stringify(reminderSettings));
}

function calculateStreak(sortedDescEntries) {
    if (sortedDescEntries.length === 0) return 0;
    
    // Get unique dates sorted descending
    const dates = [...new Set(sortedDescEntries.map(e => e.date))].sort((a,b) => new Date(b) - new Date(a));
    
    let streak = 0;
    let expectedDate = new Date(); // Start checking from today
    // Normalize to midnight
    expectedDate.setHours(0,0,0,0);
    
    // Check if there is an entry for today
    let firstDate = new Date(dates[0]);
    firstDate.setHours(0,0,0,0);
    
    // If the latest entry is neither today nor yesterday, streak is 0
    let diffDaysFirst = Math.floor((expectedDate - firstDate) / (1000 * 60 * 60 * 24));
    if (diffDaysFirst > 1) return 0;
    
    // If it's yesterday, we set expectedDate to yesterday to start counting
    if (diffDaysFirst === 1) {
        expectedDate.setDate(expectedDate.getDate() - 1);
    }
    
    for (let i = 0; i < dates.length; i++) {
        const entryDate = new Date(dates[i]);
        entryDate.setHours(0,0,0,0);
        
        if (entryDate.getTime() === expectedDate.getTime()) {
            streak++;
            expectedDate.setDate(expectedDate.getDate() - 1); // move back one day
        } else {
            break;
        }
    }
    return streak;
}

function parseTime(input) {
    if (!input) return null;
    if (input.includes(':')) {
        const parts = input.split(':');
        if (parts.length === 2) {
            const m = parseInt(parts[0], 10);
            const s = parseFloat(parts[1]);
            if (!isNaN(m) && !isNaN(s)) {
                return (m * 60) + s;
            }
        }
    } else {
        const s = parseFloat(input);
        if (!isNaN(s)) return s;
    }
    return null;
}

function formatSeconds(sec) {
    if (sec >= 60) {
        const m = Math.floor(sec / 60);
        const s = (sec % 60).toFixed(2).replace(/\.00$/, '');
        return `${m}:${s.padStart(sec % 60 < 10 ? 5 : 4, '0')}`; // simple padding
    }
    return sec.toFixed(2).replace(/\.00$/, '') + 's';
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show';
    setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
}

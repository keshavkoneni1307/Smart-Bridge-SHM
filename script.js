const API_URL = "http://localhost:5000";
let charts = {};
let isSimulatedMode = false;

// Fallback Telemetry Generator when server is unavailable
let simulatedReadings = Array.from({ length: 15 }, (_, i) => {
    const time = new Date(Date.now() - (14 - i) * 10000);
    const stress = +(180 + Math.sin(i * 0.5) * 45 + Math.random() * 10).toFixed(1);
    const vibration = +(2.1 + Math.cos(i * 0.3) * 0.8 + Math.random() * 0.3).toFixed(2);
    const tilt = +(0.15 + Math.sin(i * 0.2) * 0.1 + Math.random() * 0.05).toFixed(2);
    let status = "SAFE";
    if (stress > 230 || vibration > 3.0) status = "CRITICAL";
    else if (stress > 210 || vibration > 2.6) status = "WARNING";
    
    return {
        timestamp: time.toISOString(),
        stress,
        vibration,
        tilt,
        health_score: status === "SAFE" ? Math.floor(88 + Math.random() * 10) : (status === "WARNING" ? Math.floor(65 + Math.random() * 10) : Math.floor(35 + Math.random() * 10)),
        status
    };
});

let simulatedAlerts = [
    { timestamp: new Date(Date.now() - 120000).toISOString(), type: "High Vibration", value: "3.2 Hz", status: "CRITICAL" },
    { timestamp: new Date(Date.now() - 450000).toISOString(), type: "Stress Spike", value: "215 MPa", status: "WARNING" }
];

function produceSimulatedPoint() {
    const now = new Date();
    const stress = +(180 + Math.sin(now.getTime() / 5000) * 40 + Math.random() * 15).toFixed(1);
    const vibration = +(2.0 + Math.sin(now.getTime() / 4000) * 0.7 + Math.random() * 0.4).toFixed(2);
    const tilt = +(0.15 + Math.cos(now.getTime() / 6000) * 0.08 + Math.random() * 0.02).toFixed(2);
    
    let status = "SAFE";
    if (stress > 225 || vibration > 2.9) status = "CRITICAL";
    else if (stress > 205 || vibration > 2.5) status = "WARNING";

    const health = status === "SAFE" ? Math.floor(88 + Math.random() * 8) : (status === "WARNING" ? Math.floor(65 + Math.random() * 10) : Math.floor(35 + Math.random() * 10));

    const newPoint = {
        timestamp: now.toISOString(),
        stress,
        vibration,
        tilt,
        health_score: health,
        status
    };

    simulatedReadings.push(newPoint);
    if (simulatedReadings.length > 30) simulatedReadings.shift();

    if (status !== "SAFE" && Math.random() > 0.6) {
        simulatedAlerts.unshift({
            timestamp: now.toISOString(),
            type: status === "CRITICAL" ? "Severe Oscillation/Load" : "Elevated Strain",
            value: `${stress} MPa / ${vibration} Hz`,
            status
        });
        if (simulatedAlerts.length > 15) simulatedAlerts.pop();
    }

    return newPoint;
}

// Tab Switching
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(el => {
        el.classList.remove('bg-slate-700', 'text-white');
        el.classList.add('text-slate-300');
    });

    document.getElementById(`page-${tabId}`).classList.remove('hidden');
    const activeTabBtn = document.getElementById(`tab-${tabId}`);
    if (activeTabBtn) {
        activeTabBtn.classList.add('bg-slate-700', 'text-white');
        activeTabBtn.classList.remove('text-slate-300');
    }

    if (tabId === 'graphs') loadCharts();
    if (tabId === 'alerts') loadAlerts();
    if (tabId === 'history') loadHistoryTable();
}

async function retryConnection() {
    isSimulatedMode = false;
    document.getElementById("api-status-banner").classList.add("hidden");
    await fetchLatestData();
}

// Fetch Latest Telemetry from API
async function fetchLatestData() {
    let data;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`${API_URL}/api/latest`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("API response error");
        data = await response.json();
        document.getElementById("api-status-banner").classList.add("hidden");
    } catch (err) {
        isSimulatedMode = true;
        document.getElementById("api-status-banner").classList.remove("hidden");
        data = produceSimulatedPoint();
    }

    // UI Updates
    document.getElementById("stress-value").textContent = data.stress ?? "--";
    document.getElementById("vibration-value").textContent = data.vibration ?? "--";
    document.getElementById("tilt-value").textContent = data.tilt ?? "--";
    document.getElementById("health-score").textContent = data.health_score ?? "--";
    document.getElementById("health-score-visual").textContent = data.health_score ?? "--";

    const badge = document.getElementById("bridge-status-badge");
    badge.textContent = data.status ?? "UNKNOWN";
    if (data.status === "SAFE") {
        badge.className = "px-4 py-1.5 rounded-full font-bold text-lg bg-emerald-100 text-emerald-800 border border-emerald-300";
    } else if (data.status === "WARNING") {
        badge.className = "px-4 py-1.5 rounded-full font-bold text-lg bg-amber-100 text-amber-800 border border-amber-300";
    } else if (data.status === "CRITICAL") {
        badge.className = "px-4 py-1.5 rounded-full font-bold text-lg bg-rose-100 text-rose-800 border border-rose-300";
    }

    const healthCircle = document.getElementById("health-circle");
    if (data.health_score >= 80) healthCircle.style.borderColor = "#10b981";
    else if (data.health_score >= 50) healthCircle.style.borderColor = "#f59e0b";
    else healthCircle.style.borderColor = "#f43f5e";

    if (data.timestamp) {
        document.getElementById("last-updated").textContent = new Date(data.timestamp).toLocaleTimeString("en-IN");
    }

    const activeGraphPage = !document.getElementById("page-graphs").classList.contains("hidden");
    if (activeGraphPage) loadCharts();

    const activeHistoryPage = !document.getElementById("page-history").classList.contains("hidden");
    if (activeHistoryPage) loadHistoryTable();
}

// Load Charts
async function loadCharts() {
    let readings = [];
    if (!isSimulatedMode) {
        try {
            const response = await fetch(`${API_URL}/api/history`);
            if (response.ok) readings = (await response.json()).reverse();
        } catch (err) {
            isSimulatedMode = true;
        }
    }

    if (isSimulatedMode || readings.length === 0) readings = [...simulatedReadings];

    const labels = readings.map(item => new Date(item.timestamp).toLocaleTimeString("en-IN"));

    const configChart = (canvasId, label, data, color) => {
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return;
        
        if (charts[canvasId]) charts[canvasId].destroy();

        const ctx = canvasEl.getContext('2d');
        charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: color,
                    backgroundColor: color + '15',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#f1f5f9' } }
                }
            }
        });
    };

    configChart("stressChart", "Stress", readings.map(r => r.stress), "#6366f1");
    configChart("vibrationChart", "Vibration", readings.map(r => r.vibration), "#06b6d4");
    configChart("tiltChart", "Tilt", readings.map(r => r.tilt), "#f59e0b");
}

// Load Alerts
async function loadAlerts() {
    let alerts = [];
    if (!isSimulatedMode) {
        try {
            const response = await fetch(`${API_URL}/api/alerts`);
            if (response.ok) alerts = await response.json();
        } catch (err) {
            isSimulatedMode = true;
        }
    }

    if (isSimulatedMode || alerts.length === 0) alerts = simulatedAlerts;

    const tbody = document.getElementById("alerts-table-body");
    tbody.innerHTML = "";

    if (alerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-6 text-center text-slate-400">No alerts logged yet</td></tr>`;
        return;
    }

    alerts.forEach(a => {
        const date = new Date(a.timestamp);
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="px-6 py-4">${date.toLocaleDateString("en-IN")}</td>
                <td class="px-6 py-4">${date.toLocaleTimeString("en-IN")}</td>
                <td class="px-6 py-4 font-semibold">${a.type}</td>
                <td class="px-6 py-4">${a.value}</td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${a.status === 'CRITICAL' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}">
                        ${a.status}
                    </span>
                </td>
            </tr>`;
    });
}

// Load History
async function loadHistoryTable() {
    let readings = [];
    if (!isSimulatedMode) {
        try {
            const response = await fetch(`${API_URL}/api/history`);
            if (response.ok) readings = await response.json();
        } catch (err) {
            isSimulatedMode = true;
        }
    }

    if (isSimulatedMode || readings.length === 0) readings = [...simulatedReadings].reverse();

    const tbody = document.getElementById("history-table-body");
    tbody.innerHTML = "";

    if (readings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-6 text-center text-slate-400">No telemetry records available</td></tr>`;
        return;
    }

    readings.forEach(r => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="px-6 py-4">${new Date(r.timestamp).toLocaleString("en-IN")}</td>
                <td class="px-6 py-4 font-mono">${r.stress}</td>
                <td class="px-6 py-4 font-mono">${r.vibration}</td>
                <td class="px-6 py-4 font-mono">${r.tilt}</td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium ${r.status === 'SAFE' ? 'bg-emerald-50 text-emerald-600' : (r.status === 'WARNING' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}">
                        ${r.status}
                    </span>
                </td>
            </tr>`;
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();
    switchTab('dashboard');
    fetchLatestData();
    setInterval(fetchLatestData, 3000);
});
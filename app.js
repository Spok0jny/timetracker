// State Management
let state = {
    projects: [],
    hourlyRate: 100,
    activeIntervals: {} // To track active setInterval objects by project ID
};

// DOM Elements
const hourlyRateInput = document.getElementById('hourly-rate');
const addProjectForm = document.getElementById('add-project-form');
const projectNameInput = document.getElementById('project-name');
const projectsList = document.getElementById('projects-list');
const emptyState = document.getElementById('empty-state');
const totalTimeEl = document.getElementById('total-time');
const totalEarningsEl = document.getElementById('total-earnings');

// Modal Elements
const editModal = document.getElementById('edit-modal');
const modalProjectName = document.getElementById('modal-project-name');
const modalHours = document.getElementById('modal-hours');
const modalMinutes = document.getElementById('modal-minutes');
const modalSeconds = document.getElementById('modal-seconds');
const saveModalBtn = document.getElementById('save-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalPaid = document.getElementById('modal-paid');
let currentEditingProjectId = null;

// Initialize App
function init() {
    loadLocalStorage();
    setupEventListeners();
    renderAll();
    startRunningTimers();
}

// Load Data from Local Storage
function loadLocalStorage() {
    const savedRate = localStorage.getItem('jt_hourly_rate');
    if (savedRate !== null) {
        state.hourlyRate = parseFloat(savedRate);
        hourlyRateInput.value = state.hourlyRate;
    }

    const savedProjects = localStorage.getItem('jt_projects');
    if (savedProjects !== null) {
        state.projects = JSON.parse(savedProjects);
    }
}

// Save Data to Local Storage
function saveLocalStorage() {
    localStorage.setItem('jt_hourly_rate', state.hourlyRate);
    localStorage.setItem('jt_projects', JSON.stringify(state.projects));
}

// Start timers that were running when the app loaded
function startRunningTimers() {
    state.projects.forEach(project => {
        if (project.isRunning) {
            setupTimerInterval(project.id);
        }
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Hourly rate input change
    hourlyRateInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.hourlyRate = isNaN(val) || val < 0 ? 0 : val;
        saveLocalStorage();
        updateTotals();
        // Update all project money displays
        state.projects.forEach(p => updateProjectMoneyDisplay(p));
    });

    // Form submission
    addProjectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = projectNameInput.value.trim();
        if (name) {
            addProject(name);
            projectNameInput.value = '';
        }
    });

    // Modal controls
    cancelModalBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);
    saveModalBtn.addEventListener('click', saveModalChanges);
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeModal();
        }
    });

    const setFullyPaidBtn = document.getElementById('modal-set-fully-paid');
    if (setFullyPaidBtn) {
        setFullyPaidBtn.addEventListener('click', () => {
            const hours = parseInt(modalHours.value) || 0;
            const minutes = parseInt(modalMinutes.value) || 0;
            const seconds = parseInt(modalSeconds.value) || 0;
            const newTotalSeconds = (hours * 3600) + (minutes * 60) + seconds;
            
            const hoursDec = newTotalSeconds / 3600;
            const earnings = hoursDec * state.hourlyRate;
            modalPaid.value = (Math.round(earnings * 100) / 100).toFixed(2);
        });
    }
}

// Add a project
function addProject(name) {
    const newProject = {
        id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: name,
        elapsedSeconds: 0,
        isRunning: false,
        lastStarted: null,
        paidAmount: 0
    };

    state.projects.push(newProject);
    saveLocalStorage();
    renderAll();
}

// Delete a project
function deleteProject(id) {
    // Clear interval if running
    if (state.activeIntervals[id]) {
        clearInterval(state.activeIntervals[id]);
        delete state.activeIntervals[id];
    }

    state.projects = state.projects.filter(p => p.id !== id);
    saveLocalStorage();
    renderAll();
}

// Toggle play/pause timer
function toggleTimer(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;

    if (project.isRunning) {
        // Pause timer
        const now = Date.now();
        const additionalSeconds = Math.floor((now - project.lastStarted) / 1000);
        project.elapsedSeconds += additionalSeconds;
        project.isRunning = false;
        project.lastStarted = null;

        if (state.activeIntervals[id]) {
            clearInterval(state.activeIntervals[id]);
            delete state.activeIntervals[id];
        }
    } else {
        // Play timer
        project.isRunning = true;
        project.lastStarted = Date.now();
        setupTimerInterval(id);
    }

    saveLocalStorage();
    renderProjectCard(project);
    updateTotals();
}

// Setup setInterval for running timer
function setupTimerInterval(id) {
    if (state.activeIntervals[id]) {
        clearInterval(state.activeIntervals[id]);
    }

    state.activeIntervals[id] = setInterval(() => {
        const project = state.projects.find(p => p.id === id);
        if (project && project.isRunning) {
            const card = document.getElementById(project.id);
            if (card) {
                // Get absolute elapsed time including current running session
                const totalSec = getProjectTotalSeconds(project);
                const timeEl = card.querySelector('.project-time');
                if (timeEl) {
                    timeEl.textContent = formatTime(totalSec);
                }
                updateProjectMoneyDisplay(project);
                updateTotals();
            }
        }
    }, 200); // Fast interval for snappy updates
}

// Helper to get total seconds for a project (handling running state)
function getProjectTotalSeconds(project) {
    let total = project.elapsedSeconds;
    if (project.isRunning && project.lastStarted) {
        total += Math.floor((Date.now() - project.lastStarted) / 1000);
    }
    return total;
}

// Format Seconds into hh:mm:ss
function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

// Convert seconds to earnings
function calculateEarnings(seconds) {
    const hours = seconds / 3600;
    return hours * state.hourlyRate;
}

// Format currency in PLN
function formatCurrency(amount) {
    return amount.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
}

// Render dynamic project card content
function renderProjectCard(project) {
    let card = document.getElementById(project.id);
    const totalSec = getProjectTotalSeconds(project);
    const earnings = calculateEarnings(totalSec);
    const paidAmount = project.paidAmount || 0;
    const remainingAmount = earnings - paidAmount;

    const cardHTML = `
        <div class="project-info">
            <span class="project-name">${escapeHTML(project.name)}</span>
            <span class="project-meta">${project.isRunning ? 'Śledzenie czasu w toku...' : 'Wstrzymany'}</span>
        </div>
        <div class="project-time-wrapper">
            <span class="project-time ${project.isRunning ? 'running' : ''}">${formatTime(totalSec)}</span>
            <span class="project-time-label">Czas</span>
        </div>
        <div class="project-money-wrapper">
            <span class="project-money">${formatCurrency(earnings)}</span>
            <span class="project-money-label">Zarobek</span>
        </div>
        <div class="project-paid-wrapper">
            <span class="project-paid">${formatCurrency(paidAmount)}</span>
            <span class="project-paid-label">Zapłacono</span>
        </div>
        <div class="project-remaining-wrapper">
            <span class="project-remaining ${remainingAmount > 0.01 ? 'pending' : 'settled'}">${formatCurrency(remainingAmount)}</span>
            <span class="project-remaining-label">Do rozliczenia</span>
        </div>
        <div class="project-actions">
            <button class="btn-icon ${project.isRunning ? 'pause-btn' : 'play-btn'}" onclick="toggleTimer('${project.id}')" title="${project.isRunning ? 'Wstrzymaj' : 'Uruchom'}">
                ${project.isRunning ? 
                    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : 
                    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
                }
            </button>
            <button class="btn-icon edit-btn" onclick="openEditModal('${project.id}')" title="Edytuj czas i płatność">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-icon delete-btn" onclick="deleteProject('${project.id}')" title="Usuń projekt">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        </div>
    `;

    if (!card) {
        card = document.createElement('div');
        card.id = project.id;
        card.className = 'project-card';
        projectsList.appendChild(card);
    }

    card.className = `project-card ${project.isRunning ? 'active' : ''}`;
    card.innerHTML = cardHTML;
}

// Update only the money display on active project card
function updateProjectMoneyDisplay(project) {
    const card = document.getElementById(project.id);
    if (card) {
        const totalSec = getProjectTotalSeconds(project);
        const earnings = calculateEarnings(totalSec);
        const paidAmount = project.paidAmount || 0;
        const remainingAmount = earnings - paidAmount;

        const moneyEl = card.querySelector('.project-money');
        if (moneyEl) {
            moneyEl.textContent = formatCurrency(earnings);
        }

        const remainingEl = card.querySelector('.project-remaining');
        if (remainingEl) {
            remainingEl.textContent = formatCurrency(remainingAmount);
            if (remainingAmount > 0.01) {
                remainingEl.classList.add('pending');
                remainingEl.classList.remove('settled');
            } else {
                remainingEl.classList.remove('pending');
                remainingEl.classList.add('settled');
            }
        }
    }
}

// Render entire list
function renderAll() {
    // Remove existing projects except the empty state
    const cards = projectsList.querySelectorAll('.project-card');
    cards.forEach(c => c.remove());

    if (state.projects.length === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
        state.projects.forEach(project => {
            renderProjectCard(project);
        });
    }
    updateTotals();
}

// Update global totals in the footer
function updateTotals() {
    let totalSeconds = 0;
    let totalPaid = 0;

    state.projects.forEach(project => {
        totalSeconds += getProjectTotalSeconds(project);
        totalPaid += project.paidAmount || 0;
    });

    const totalEarnings = calculateEarnings(totalSeconds);
    const totalRemaining = totalEarnings - totalPaid;

    totalTimeEl.textContent = formatTotalTime(totalSeconds);
    totalEarningsEl.textContent = formatCurrency(totalEarnings);

    const totalPaidEl = document.getElementById('total-paid');
    if (totalPaidEl) {
        totalPaidEl.textContent = formatCurrency(totalPaid);
    }

    const totalRemainingEl = document.getElementById('total-remaining');
    if (totalRemainingEl) {
        totalRemainingEl.textContent = formatCurrency(totalRemaining);
    }
}

// Format total time with Polish labels
function formatTotalTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

// Open manual adjustment modal
window.openEditModal = function(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;

    currentEditingProjectId = id;
    modalProjectName.textContent = project.name;

    // Get current time breakdown
    const totalSec = getProjectTotalSeconds(project);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    modalHours.value = hours;
    modalMinutes.value = minutes;
    modalSeconds.value = seconds;

    modalPaid.value = project.paidAmount !== undefined ? project.paidAmount : 0;

    editModal.classList.add('active');
};

// Close modal
function closeModal() {
    editModal.classList.remove('active');
    currentEditingProjectId = null;
}

// Save changes from modal
function saveModalChanges() {
    if (!currentEditingProjectId) return;

    const project = state.projects.find(p => p.id === currentEditingProjectId);
    if (!project) return;

    const hours = parseInt(modalHours.value) || 0;
    const minutes = parseInt(modalMinutes.value) || 0;
    const seconds = parseInt(modalSeconds.value) || 0;

    const newTotalSeconds = (hours * 3600) + (minutes * 60) + seconds;

    project.elapsedSeconds = newTotalSeconds;

    const paidVal = parseFloat(modalPaid.value);
    project.paidAmount = isNaN(paidVal) || paidVal < 0 ? 0 : paidVal;

    if (project.isRunning) {
        // If it was running, reset the running timestamp to now since we modified elapsed time
        project.lastStarted = Date.now();
    }

    saveLocalStorage();
    renderProjectCard(project);
    updateTotals();
    closeModal();
}

// Escaping utility for strings to prevent XSS
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Run app init
init();

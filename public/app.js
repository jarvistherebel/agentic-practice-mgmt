// Agentic Practice Management System - Frontend
// Single Page Application

const API_URL = '';

// State
let currentView = 'dashboard';
let practitioners = [];
let services = [];
let patients = [];
let appointments = [];
let agentActivities = [];

// Initialize
async function init() {
    await loadData();
    render();
    startRealtimeUpdates();
}

async function loadData() {
    try {
        const [practitionersRes, servicesRes, patientsRes, dashboardRes] = await Promise.all([
            fetch('/api/practitioners'),
            fetch('/api/services'),
            fetch('/api/patients'),
            fetch('/api/dashboard')
        ]);
        
        practitioners = await practitionersRes.json();
        services = await servicesRes.json();
        patients = await patientsRes.json();
        const dashboard = await dashboardRes.json();
        agentActivities = dashboard.recentAgentActivity;
    } catch (err) {
        console.error('Failed to load data:', err);
    }
}

function startRealtimeUpdates() {
    // Simulate real-time agent activity updates
    setInterval(async () => {
        const res = await fetch('/api/agent-activities');
        agentActivities = await res.json();
        if (currentView === 'dashboard') {
            renderDashboard();
        }
    }, 5000);
}

// Render main app
function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="flex h-screen">
            ${renderSidebar()}
            <div class="flex-1 overflow-auto">
                ${renderHeader()}
                <main class="p-6">
                    ${currentView === 'dashboard' ? renderDashboard() : ''}
                    ${currentView === 'calendar' ? renderCalendar() : ''}
                    ${currentView === 'patients' ? renderPatients() : ''}
                    ${currentView === 'agents' ? renderAgents() : ''}
                    ${currentView === 'voice' ? renderVoiceAI() : ''}
                </main>
            </div>
        </div>
    `;
}

function renderSidebar() {
    const menuItems = [
        { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
        { id: 'calendar', icon: 'fa-calendar', label: 'Calendar' },
        { id: 'patients', icon: 'fa-users', label: 'Patients' },
        { id: 'voice', icon: 'fa-phone', label: 'Voice AI', badge: 'LIVE' },
        { id: 'agents', icon: 'fa-robot', label: 'AI Agents' },
    ];
    
    return `
        <aside class="w-64 bg-slate-900 text-white">
            <div class="p-6 border-b border-slate-700">
                <h1 class="text-xl font-bold flex items-center gap-2">
                    <i class="fa-solid fa-heart-pulse text-blue-400"></i>
                    City Physio
                </h1>
                <p class="text-xs text-slate-400 mt-1">Agentic Practice Management</p>
            </div>
            <nav class="p-4">
                ${menuItems.map(item => `
                    <button onclick="navigate('${item.id}')" 
                        class="sidebar-link w-full text-left px-4 py-3 rounded-lg mb-1 flex items-center gap-3 transition-all ${currentView === item.id ? 'bg-blue-600' : 'hover:bg-slate-800'}">
                        <i class="fa-solid ${item.icon} w-5"></i>
                        <span>${item.label}</span>
                        ${item.badge ? `<span class="ml-auto bg-green-500 text-xs px-2 py-0.5 rounded-full agent-pulse">${item.badge}</span>` : ''}
                    </button>
                `).join('')}
            </nav>
            <div class="absolute bottom-0 w-64 p-4 border-t border-slate-700">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <i class="fa-solid fa-user text-white"></i>
                    </div>
                    <div>
                        <p class="text-sm font-medium">Dr. Sarah Chen</p>
                        <p class="text-xs text-slate-400">Admin</p>
                    </div>
                </div>
            </div>
        </aside>
    `;
}

function renderHeader() {
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    
    return `
        <header class="bg-white border-b px-6 py-4 flex items-center justify-between">
            <div>
                <h2 class="text-2xl font-bold text-gray-800">${currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h2>
                <p class="text-gray-500">${today}</p>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                    <div class="w-2 h-2 bg-green-500 rounded-full agent-pulse"></div>
                    <span class="text-sm text-green-700 font-medium">AI Agents Active</span>
                </div>
                <button class="p-2 text-gray-400 hover:text-gray-600">
                    <i class="fa-solid fa-bell"></i>
                </button>
                <button class="p-2 text-gray-400 hover:text-gray-600">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
        </header>
    `;
}

function renderDashboard() {
    const stats = [
        { label: "Today's Appointments", value: 8, icon: 'fa-calendar-check', color: 'blue', trend: '+2' },
        { label: 'Pending Notes', value: 3, icon: 'fa-file-medical', color: 'amber', trend: 'AI drafting' },
        { label: 'Active Patients', value: 156, icon: 'fa-users', color: 'green', trend: '+12 this month' },
        { label: 'Overdue Invoices', value: 2, icon: 'fa-pound-sign', color: 'red', trend: 'AI chasing' },
    ];
    
    return `
        <div class="space-y-6">
            <!-- Stats Grid -->
            <div class="grid grid-cols-4 gap-6">
                ${stats.map(stat => `
                    <div class="bg-white rounded-xl p-6 shadow-sm card-hover transition-all cursor-pointer border border-gray-100">
                        <div class="flex items-start justify-between">
                            <div>
                                <p class="text-gray-500 text-sm">${stat.label}</p>
                                <p class="text-3xl font-bold text-gray-800 mt-1">${stat.value}</p>
                            </div>
                            <div class="w-12 h-12 rounded-lg bg-${stat.color}-100 flex items-center justify-center">
                                <i class="fa-solid ${stat.icon} text-${stat.color}-600 text-xl"></i>
                            </div>
                        </div>
                        <div class="mt-4 flex items-center gap-2">
                            <span class="text-xs font-medium text-${stat.color}-600 bg-${stat.color}-50 px-2 py-1 rounded-full">
                                ${stat.trend}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="grid grid-cols-3 gap-6">
                <!-- Agent Activity Feed -->
                <div class="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div class="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h3 class="font-bold text-gray-800 flex items-center gap-2">
                            <i class="fa-solid fa-robot text-purple-500"></i>
                            AI Agent Activity
                        </h3>
                        <span class="text-xs text-gray-500">Live updates</span>
                    </div>
                    <div class="p-6 space-y-4 max-h-96 overflow-auto">
                        ${agentActivities.slice(0, 10).map((activity, i) => `
                            <div class="flex items-start gap-4 p-4 rounded-lg ${i === 0 ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'} animate-fade-in">
                                <div class="w-10 h-10 rounded-full ${getAgentColor(activity.agentType)} flex items-center justify-center flex-shrink-0">
                                    <i class="fa-solid ${getAgentIcon(activity.agentType)} text-white text-sm"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm font-medium text-gray-800">${activity.action}</p>
                                    <p class="text-xs text-gray-500 mt-1">
                                        ${activity.patient ? `for ${activity.patient.firstName} ${activity.patient.lastName}` : ''} 
                                        • ${new Date(activity.timestamp).toLocaleTimeString()}
                                    </p>
                                </div>
                                <span class="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                    ${activity.status}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="space-y-6">
                    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 class="font-bold text-gray-800 mb-4">Quick Actions</h3>
                        <div class="space-y-3">
                            <button onclick="navigate('voice')" class="w-full p-4 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-left hover:shadow-lg transition-all">
                                <div class="flex items-center gap-3">
                                    <i class="fa-solid fa-phone text-xl"></i>
                                    <div>
                                        <p class="font-medium">Test Voice AI</p>
                                        <p class="text-xs text-blue-100">Simulate a patient call</p>
                                    </div>
                                </div>
                            </button>
                            <button class="w-full p-4 rounded-lg bg-gray-50 text-left hover:bg-gray-100 transition-all border border-gray-200">
                                <div class="flex items-center gap-3">
                                    <i class="fa-solid fa-plus text-gray-400"></i>
                                    <div>
                                        <p class="font-medium text-gray-700">New Appointment</p>
                                        <p class="text-xs text-gray-500">Book manually</p>
                                    </div>
                                </div>
                            </button>
                            <button class="w-full p-4 rounded-lg bg-gray-50 text-left hover:bg-gray-100 transition-all border border-gray-200">
                                <div class="flex items-center gap-3">
                                    <i class="fa-solid fa-file-medical text-gray-400"></i>
                                    <div>
                                        <p class="font-medium text-gray-700">Write Note</p>
                                        <p class="text-xs text-gray-500">Create treatment note</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                    
                    <!-- AI Status -->
                    <div class="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
                        <h3 class="font-bold mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-brain"></i>
                            AI System Status
                        </h3>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-purple-100">Scheduling Agent</span>
                                <span class="text-xs bg-green-400 text-green-900 px-2 py-0.5 rounded-full">Online</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-purple-100">Documentation Agent</span>
                                <span class="text-xs bg-green-400 text-green-900 px-2 py-0.5 rounded-full">Online</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-purple-100">Patient Comms</span>
                                <span class="text-xs bg-green-400 text-green-900 px-2 py-0.5 rounded-full">Online</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-purple-100">Billing Agent</span>
                                <span class="text-xs bg-green-400 text-green-900 px-2 py-0.5 rounded-full">Online</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCalendar() {
    const today = new Date();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({length: 12}, (_, i) => i + 8);
    
    return `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100">
            <div class="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 class="font-bold text-gray-800">Week of ${today.toLocaleDateString('en-GB')}</h3>
                <div class="flex gap-2">
                    ${practitioners.map(p => `
                        <span class="px-3 py-1 rounded-full text-xs font-medium" style="background: ${p.color}20; color: ${p.color}">
                            ${p.name}
                        </span>
                    `).join('')}
                </div>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-8 gap-2">
                    <div class="text-sm font-medium text-gray-400">Time</div>
                    ${days.map(day => `
                        <div class="text-center text-sm font-medium text-gray-600 pb-2">${day}</div>
                    `).join('')}
                    
                    ${hours.map(hour => `
                        <div class="text-xs text-gray-400 py-4">${hour}:00</div>
                        ${days.map(() => `
                            <div class="border border-gray-100 rounded p-2 min-h-16 hover:bg-gray-50 cursor-pointer transition-colors">
                                ${Math.random() > 0.7 ? `
                                    <div class="bg-blue-100 text-blue-800 text-xs p-1 rounded">
                                        Booked
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderPatients() {
    return `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100">
            <div class="p-6 border-b border-gray-100 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <h3 class="font-bold text-gray-800">Patients</h3>
                    <div class="relative">
                        <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input type="text" placeholder="Search patients..." class="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                </div>
                <button class="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                    <i class="fa-solid fa-plus mr-2"></i>New Patient
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left p-4 text-sm font-medium text-gray-600">Patient</th>
                            <th class="text-left p-4 text-sm font-medium text-gray-600">Contact</th>
                            <th class="text-left p-4 text-sm font-medium text-gray-600">Status</th>
                            <th class="text-left p-4 text-sm font-medium text-gray-600">Last Visit</th>
                            <th class="text-left p-4 text-sm font-medium text-gray-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${patients.slice(0, 10).map(patient => `
                            <tr class="border-t border-gray-100 hover:bg-gray-50">
                                <td class="p-4">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium">
                                            ${patient.firstName[0]}${patient.lastName[0]}
                                        </div>
                                        <div>
                                            <p class="font-medium text-gray-800">${patient.firstName} ${patient.lastName}</p>
                                            <p class="text-xs text-gray-500">ID: ${patient.id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td class="p-4 text-sm text-gray-600">
                                    <p>${patient.phone}</p>
                                    <p class="text-xs text-gray-400">${patient.email}</p>
                                </td>
                                <td class="p-4">
                                    <span class="px-2 py-1 rounded-full text-xs font-medium ${patient.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                                        ${patient.status}
                                    </span>
                                </td>
                                <td class="p-4 text-sm text-gray-600">
                                    ${new Date(patient.createdAt).toLocaleDateString('en-GB')}
                                </td>
                                <td class="p-4">
                                    <button class="text-blue-500 hover:text-blue-700 text-sm font-medium">View</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderAgents() {
    const agents = [
        { name: 'Scheduling Agent', icon: 'fa-calendar', color: 'blue', status: 'Active', tasks: 47, description: 'Handles bookings, cancellations, and calendar optimisation' },
        { name: 'Documentation Agent', icon: 'fa-file-medical', color: 'purple', status: 'Active', tasks: 23, description: 'Generates SOAP notes, letters, and reports from sessions' },
        { name: 'Patient Comms Agent', icon: 'fa-comments', color: 'green', status: 'Active', tasks: 156, description: 'Manages WhatsApp, SMS, and email communications' },
        { name: 'Billing Agent', icon: 'fa-pound-sign', color: 'amber', status: 'Active', tasks: 12, description: 'Creates invoices, processes payments, chases overdue' },
        { name: 'Intelligence Agent', icon: 'fa-brain', color: 'red', status: 'Active', tasks: 8, description: 'Analytics, predictions, and strategic insights' },
    ];
    
    return `
        <div class="grid grid-cols-2 gap-6">
            ${agents.map(agent => `
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 card-hover">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-xl bg-${agent.color}-100 flex items-center justify-center">
                                <i class="fa-solid ${agent.icon} text-${agent.color}-600 text-2xl"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-800">${agent.name}</h3>
                                <span class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">${agent.status}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-bold text-gray-800">${agent.tasks}</p>
                            <p class="text-xs text-gray-500">tasks today</p>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 mb-4">${agent.description}</p>
                    <div class="flex gap-2">
                        <button class="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                            View Logs
                        </button>
                        <button class="flex-1 py-2 rounded-lg bg-${agent.color}-500 text-white text-sm font-medium hover:bg-${agent.color}-600">
                            Configure
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderVoiceAI() {
    return `
        <div class="max-w-2xl mx-auto">
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <div class="text-center mb-8">
                    <div class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                        <i class="fa-solid fa-phone text-white text-3xl"></i>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800">Voice AI Booking</h3>
                    <p class="text-gray-500 mt-2">Test the AI receptionist with a simulated call</p>
                </div>
                
                <div class="bg-gray-50 rounded-xl p-6 mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-sm font-medium text-gray-600">Demo Phone Number</span>
                        <span class="text-lg font-bold text-gray-800">+44 20 7946 0958</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm text-gray-500">
                        <div class="w-2 h-2 bg-green-500 rounded-full agent-pulse"></div>
                        AI Agent is online and ready
                    </div>
                </div>
                
                <div class="space-y-4">
                    <button onclick="simulateVoiceCall()" class="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium hover:shadow-lg transition-all flex items-center justify-center gap-3">
                        <i class="fa-solid fa-play"></i>
                        Simulate Incoming Call
                    </button>
                    
                    <div id="call-simulation" class="hidden">
                        <div class="border border-gray-200 rounded-xl p-4 bg-gray-50">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-3 h-3 bg-red-500 rounded-full agent-pulse"></div>
                                <span class="text-sm font-medium text-gray-700">Live Call Simulation</span>
                            </div>
                            <div class="space-y-3" id="transcript">
                                <div class="flex gap-3">
                                    <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <i class="fa-solid fa-robot text-blue-600 text-xs"></i>
                                    </div>
                                    <div class="bg-white rounded-lg p-3 text-sm text-gray-700 shadow-sm">
                                        Hello, this is City Physio London. I'm your AI assistant. How can I help you today?
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-8 pt-6 border-t border-gray-100">
                    <h4 class="font-medium text-gray-800 mb-3">What the Voice AI can do:</h4>
                    <ul class="space-y-2 text-sm text-gray-600">
                        <li class="flex items-center gap-2">
                            <i class="fa-solid fa-check text-green-500"></i>
                            Book, reschedule, or cancel appointments
                        </li>
                        <li class="flex items-center gap-2">
                            <i class="fa-solid fa-check text-green-500"></i>
                            Answer questions about services and pricing
                        </li>
                        <li class="flex items-center gap-2">
                            <i class="fa-solid fa-check text-green-500"></i>
                            Check availability across all practitioners
                        </li>
                        <li class="flex items-center gap-2">
                            <i class="fa-solid fa-check text-green-500"></i>
                            Send confirmation SMS after booking
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    `;
}

function simulateVoiceCall() {
    document.getElementById('call-simulation').classList.remove('hidden');
    const transcript = document.getElementById('transcript');
    
    const messages = [
        { speaker: 'patient', text: "Hi, I'd like to book an appointment for next week please." },
        { speaker: 'ai', text: "Of course! Are you a new patient or have you visited us before?" },
        { speaker: 'patient', text: "I'm new. I need a physiotherapist for my lower back pain." },
        { speaker: 'ai', text: "I can help with that. We have availability with Dr. Sarah Chen on Tuesday at 2pm or Thursday at 10am. Which would work better for you?" },
        { speaker: 'patient', text: "Tuesday at 2pm sounds good." },
        { speaker: 'ai', text: "Perfect! I've booked you in for Tuesday at 2pm with Dr. Sarah Chen for an Initial Consultation. Can I take your name and phone number please?" },
    ];
    
    let i = 0;
    const interval = setInterval(() => {
        if (i >= messages.length) {
            clearInterval(interval);
            // Add booking confirmation
            transcript.innerHTML += `
                <div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div class="flex items-center gap-2 text-green-700 text-sm font-medium">
                        <i class="fa-solid fa-check-circle"></i>
                        Appointment booked! Confirmation SMS sent.
                    </div>
                </div>
            `;
            return;
        }
        
        const msg = messages[i];
        transcript.innerHTML += `
            <div class="flex gap-3 animate-fade-in">
                <div class="w-8 h-8 rounded-full ${msg.speaker === 'ai' ? 'bg-blue-100' : 'bg-green-100'} flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid ${msg.speaker === 'ai' ? 'fa-robot text-blue-600' : 'fa-user text-green-600'} text-xs"></i>
                </div>
                <div class="bg-white rounded-lg p-3 text-sm text-gray-700 shadow-sm">
                    ${msg.text}
                </div>
            </div>
        `;
        i++;
    }, 1500);
}

function getAgentColor(type) {
    const colors = {
        scheduling: 'bg-blue-500',
        documentation: 'bg-purple-500',
        patient_comms: 'bg-green-500',
        billing: 'bg-amber-500',
        intelligence: 'bg-red-500'
    };
    return colors[type] || 'bg-gray-500';
}

function getAgentIcon(type) {
    const icons = {
        scheduling: 'fa-calendar',
        documentation: 'fa-file-medical',
        patient_comms: 'fa-comments',
        billing: 'fa-pound-sign',
        intelligence: 'fa-brain'
    };
    return icons[type] || 'fa-robot';
}

function navigate(view) {
    currentView = view;
    render();
}

// Start the app
init();

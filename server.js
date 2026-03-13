const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { format, addDays, startOfWeek, isSameDay } = require('date-fns');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory data store
const db = {
  practitioners: [
    { id: 'p1', name: 'Dr. Sarah Chen', role: 'Senior Physiotherapist', color: '#3b82f6' },
    { id: 'p2', name: 'Mark Wilson', role: 'Sports Therapist', color: '#10b981' },
    { id: 'p3', name: 'Emma Thompson', role: 'Massage Therapist', color: '#f59e0b' }
  ],
  services: [
    { id: 's1', name: 'Initial Consultation', duration: 45, price: 75, color: '#3b82f6' },
    { id: 's2', name: 'Follow-up Session', duration: 30, price: 55, color: '#10b981' },
    { id: 's3', name: 'Sports Massage', duration: 45, price: 60, color: '#f59e0b' },
    { id: 's4', name: 'Home Visit', duration: 45, price: 95, color: '#ef4444' }
  ],
  patients: [],
  appointments: [],
  notes: [],
  invoices: [],
  agentActivities: [],
  messages: []
};

// Generate sample data
function generateSampleData() {
  const firstNames = ['James', 'Emma', 'Oliver', 'Sophie', 'William', 'Isabella', 'Henry', 'Mia', 'Alexander', 'Charlotte'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  
  for (let i = 0; i < 20; i++) {
    const patient = {
      id: `pat${i + 1}`,
      firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
      lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
      phone: `+447${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
      email: `patient${i + 1}@example.com`,
      dateOfBirth: new Date(1970 + Math.floor(Math.random() * 40), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)),
      status: Math.random() > 0.3 ? 'active' : 'inactive',
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000))
    };
    db.patients.push(patient);
  }

  // Generate appointments for this week
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const dayOffset = Math.floor(Math.random() * 14) - 2;
    const hour = 8 + Math.floor(Math.random() * 10);
    const practitioner = db.practitioners[Math.floor(Math.random() * db.practitioners.length)];
    const service = db.services[Math.floor(Math.random() * db.services.length)];
    const patient = db.patients[Math.floor(Math.random() * db.patients.length)];
    
    const appointment = {
      id: `apt${i + 1}`,
      patientId: patient.id,
      practitionerId: practitioner.id,
      serviceId: service.id,
      date: format(addDays(today, dayOffset), 'yyyy-MM-dd'),
      time: `${hour.toString().padStart(2, '0')}:00`,
      duration: service.duration,
      status: dayOffset < 0 ? 'completed' : (Math.random() > 0.8 ? 'cancelled' : 'confirmed'),
      notes: '',
      createdAt: new Date()
    };
    db.appointments.push(appointment);
  }

  // Generate agent activities
  const agentTypes = ['scheduling', 'documentation', 'patient_comms', 'billing', 'intelligence'];
  const actions = [
    'Booked appointment via voice AI',
    'Generated SOAP note from session',
    'Sent appointment reminder',
    'Created invoice',
    'Answered patient question',
    'Filled cancellation from waitlist',
    'Chased overdue payment',
    'Identified at-risk patient'
  ];

  for (let i = 0; i < 25; i++) {
    db.agentActivities.push({
      id: `act${i + 1}`,
      agentType: agentTypes[Math.floor(Math.random() * agentTypes.length)],
      action: actions[Math.floor(Math.random() * actions.length)],
      patientId: db.patients[Math.floor(Math.random() * db.patients.length)].id,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000)),
      status: 'completed'
    });
  }
}

generateSampleData();

// Routes

// Dashboard stats
app.get('/api/dashboard', (req, res) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayAppointments = db.appointments.filter(a => a.date === today && a.status !== 'cancelled');
  const pendingNotes = db.appointments.filter(a => a.status === 'completed' && !a.notes).length;
  const overdueInvoices = db.invoices.filter(i => i.status === 'pending' && new Date(i.dueDate) < new Date()).length;
  
  res.json({
    todayAppointments: todayAppointments.length,
    pendingNotes,
    overdueInvoices,
    activePatients: db.patients.filter(p => p.status === 'active').length,
    recentAgentActivity: db.agentActivities.slice(0, 10)
  });
});

// Practitioners
app.get('/api/practitioners', (req, res) => {
  res.json(db.practitioners);
});

// Services
app.get('/api/services', (req, res) => {
  res.json(db.services);
});

// Patients
app.get('/api/patients', (req, res) => {
  res.json(db.patients);
});

app.get('/api/patients/:id', (req, res) => {
  const patient = db.patients.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  
  const patientAppointments = db.appointments.filter(a => a.patientId === patient.id);
  const patientNotes = db.notes.filter(n => n.patientId === patient.id);
  
  res.json({ ...patient, appointments: patientAppointments, notes: patientNotes });
});

// Appointments
app.get('/api/appointments', (req, res) => {
  const { date, practitionerId, patientId } = req.query;
  let appointments = db.appointments;
  
  if (date) appointments = appointments.filter(a => a.date === date);
  if (practitionerId) appointments = appointments.filter(a => a.practitionerId === practitionerId);
  if (patientId) appointments = appointments.filter(a => a.patientId === patientId);
  
  // Enrich with patient and service info
  const enriched = appointments.map(a => ({
    ...a,
    patient: db.patients.find(p => p.id === a.patientId),
    practitioner: db.practitioners.find(p => p.id === a.practitionerId),
    service: db.services.find(s => s.id === a.serviceId)
  }));
  
  res.json(enriched);
});

app.post('/api/appointments', (req, res) => {
  const appointment = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date()
  };
  db.appointments.push(appointment);
  
  // Log agent activity
  db.agentActivities.unshift({
    id: uuidv4(),
    agentType: 'scheduling',
    action: 'New appointment booked',
    patientId: appointment.patientId,
    timestamp: new Date(),
    status: 'completed'
  });
  
  res.status(201).json(appointment);
});

// Voice AI webhook
app.post('/api/voice-webhook', (req, res) => {
  const { type, patientPhone, message } = req.body;
  
  // Simulate voice AI processing
  const response = {
    success: true,
    action: type === 'booking' ? 'appointment_booked' : 'information_provided',
    message: 'Voice AI processed request'
  };
  
  // Log activity
  db.agentActivities.unshift({
    id: uuidv4(),
    agentType: 'scheduling',
    action: `Voice AI: ${type}`,
    timestamp: new Date(),
    status: 'completed'
  });
  
  res.json(response);
});

// Agent activities
app.get('/api/agent-activities', (req, res) => {
  const activities = db.agentActivities.slice(0, 50).map(a => ({
    ...a,
    patient: db.patients.find(p => p.id === a.patientId)
  }));
  res.json(activities);
});

// Generate SOAP note from session data
app.post('/api/generate-note', (req, res) => {
  const { appointmentId, sessionTranscript } = req.body;
  
  // Simulate AI note generation
  const note = {
    id: uuidv4(),
    appointmentId,
    type: 'SOAP',
    subjective: 'Patient reports continued improvement in knee mobility. Pain level reduced from 6/10 to 3/10.',
    objective: 'ROM: Knee flexion 0-125° (improved from 110°). Gait normal. No swelling observed.',
    assessment: 'Good progress with rehabilitation. Patient responding well to treatment protocol.',
    plan: 'Continue with current exercise program. Schedule follow-up in 2 weeks. Consider discharge if progress maintained.',
    generatedAt: new Date(),
    status: 'draft'
  };
  
  db.notes.push(note);
  
  // Log activity
  db.agentActivities.unshift({
    id: uuidv4(),
    agentType: 'documentation',
    action: 'Generated SOAP note from session',
    timestamp: new Date(),
    status: 'completed'
  });
  
  res.json(note);
});

// Availability check
app.get('/api/availability', (req, res) => {
  const { date, practitionerId, serviceId } = req.query;
  
  // Generate available slots
  const slots = [];
  const startHour = 8;
  const endHour = 19;
  
  for (let hour = startHour; hour < endHour; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    const existing = db.appointments.find(a => 
      a.date === date && 
      a.time === time && 
      a.practitionerId === practitionerId &&
      a.status !== 'cancelled'
    );
    
    if (!existing) {
      slots.push({ time, available: true });
    }
  }
  
  res.json({ date, practitionerId, slots });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Agentic Practice Management Server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
});

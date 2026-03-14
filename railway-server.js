const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { format, addDays } = require('date-fns');
const fs = require('fs');
const https = require('https');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1';

// Helper function to make OpenAI API requests
async function openAIRequest(endpoint, data, isFormData = false) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.openai.com',
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    };

    if (!isFormData) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    if (isFormData) {
      data.pipe(req);
    } else {
      req.write(JSON.stringify(data));
      req.end();
    }
  });
}

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
  const firstNames = ['James', 'Emma', 'Oliver', 'Sophie', 'William', 'Isabella', 'Henry', 'Mia', 'Alexander', 'Charlotte', 'Lucas', 'Amelia'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Taylor', 'Anderson'];
  
  for (let i = 0; i < 25; i++) {
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

  const today = new Date();
  for (let i = 0; i < 40; i++) {
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
      status: dayOffset < 0 ? 'completed' : (Math.random() > 0.85 ? 'cancelled' : 'confirmed'),
      notes: Math.random() > 0.5 ? 'Sample notes' : '',
      createdAt: new Date()
    };
    db.appointments.push(appointment);
  }

  const agentTypes = ['scheduling', 'documentation', 'patient_comms', 'billing', 'intelligence'];
  const actions = [
    'Booked appointment via voice AI',
    'Generated SOAP note from session',
    'Sent appointment reminder',
    'Created invoice',
    'Answered patient question',
    'Filled cancellation from waitlist',
    'Chased overdue payment',
    'Identified at-risk patient',
    'Optimised practitioner schedule',
    'Generated weekly report'
  ];

  for (let i = 0; i < 30; i++) {
    db.agentActivities.push({
      id: `act${i + 1}`,
      agentType: agentTypes[Math.floor(Math.random() * agentTypes.length)],
      action: actions[Math.floor(Math.random() * actions.length)],
      patientId: db.patients[Math.floor(Math.random() * db.patients.length)].id,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 48 * 60 * 60 * 1000)),
      status: 'completed'
    });
  }
  
  // Sort by timestamp desc
  db.agentActivities.sort((a, b) => b.timestamp - a.timestamp);
}

generateSampleData();

// Routes
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

// ==================== PRACTITIONER MANAGEMENT ====================

// Get all practitioners
app.get('/api/practitioners', (req, res) => {
  const enriched = db.practitioners.map(p => ({
    ...p,
    appointmentCount: db.appointments.filter(a => a.practitionerId === p.id && a.status !== 'cancelled').length,
    nextAvailable: getNextAvailableSlot(p.id)
  }));
  res.json(enriched);
});

// Get single practitioner
app.get('/api/practitioners/:id', (req, res) => {
  const practitioner = db.practitioners.find(p => p.id === req.params.id);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  
  const practitionerAppointments = db.appointments.filter(a => a.practitionerId === practitioner.id);
  const today = format(new Date(), 'yyyy-MM-dd');
  
  res.json({
    ...practitioner,
    appointments: practitionerAppointments,
    todayAppointments: practitionerAppointments.filter(a => a.date === today && a.status !== 'cancelled').length,
    totalAppointments: practitionerAppointments.length,
    services: db.services.filter(s => practitioner.serviceIds?.includes(s.id) || true)
  });
});

// Create new practitioner (admin only)
app.post('/api/practitioners', (req, res) => {
  const { name, role, email, phone, color, bio, specializations, workingHours } = req.body;
  
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required' });
  }
  
  const practitioner = {
    id: uuidv4(),
    name,
    role,
    email: email || '',
    phone: phone || '',
    color: color || getRandomColor(),
    bio: bio || '',
    specializations: specializations || [],
    workingHours: workingHours || {
      monday: { start: '09:00', end: '17:00', enabled: true },
      tuesday: { start: '09:00', end: '17:00', enabled: true },
      wednesday: { start: '09:00', end: '17:00', enabled: true },
      thursday: { start: '09:00', end: '17:00', enabled: true },
      friday: { start: '09:00', end: '17:00', enabled: true },
      saturday: { start: '09:00', end: '13:00', enabled: false },
      sunday: { start: '09:00', end: '13:00', enabled: false }
    },
    isActive: true,
    createdAt: new Date()
  };
  
  db.practitioners.push(practitioner);
  
  db.agentActivities.unshift({
    id: uuidv4(),
    agentType: 'scheduling',
    action: `New practitioner added: ${name}`,
    timestamp: new Date(),
    status: 'completed'
  });
  
  res.status(201).json(practitioner);
});

// Update practitioner
app.patch('/api/practitioners/:id', (req, res) => {
  const practitioner = db.practitioners.find(p => p.id === req.params.id);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  
  const { name, role, email, phone, color, bio, specializations, workingHours, isActive } = req.body;
  
  if (name !== undefined) practitioner.name = name;
  if (role !== undefined) practitioner.role = role;
  if (email !== undefined) practitioner.email = email;
  if (phone !== undefined) practitioner.phone = phone;
  if (color !== undefined) practitioner.color = color;
  if (bio !== undefined) practitioner.bio = bio;
  if (specializations !== undefined) practitioner.specializations = specializations;
  if (workingHours !== undefined) practitioner.workingHours = workingHours;
  if (isActive !== undefined) practitioner.isActive = isActive;
  
  practitioner.updatedAt = new Date();
  
  res.json(practitioner);
});

// Delete practitioner
app.delete('/api/practitioners/:id', (req, res) => {
  const index = db.practitioners.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Practitioner not found' });
  
  // Check for future appointments
  const futureAppointments = db.appointments.filter(
    a => a.practitionerId === req.params.id && 
    a.date >= format(new Date(), 'yyyy-MM-dd') &&
    a.status !== 'cancelled'
  );
  
  if (futureAppointments.length > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete practitioner with future appointments',
      appointments: futureAppointments.length
    });
  }
  
  db.practitioners.splice(index, 1);
  res.status(204).send();
});

// Get practitioner's calendar
app.get('/api/practitioners/:id/calendar', (req, res) => {
  const { startDate, endDate } = req.query;
  const practitioner = db.practitioners.find(p => p.id === req.params.id);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  
  let appointments = db.appointments.filter(a => a.practitionerId === req.params.id);
  
  if (startDate) appointments = appointments.filter(a => a.date >= startDate);
  if (endDate) appointments = appointments.filter(a => a.date <= endDate);
  
  const enriched = appointments.map(a => ({
    ...a,
    patient: db.patients.find(p => p.id === a.patientId),
    service: db.services.find(s => s.id === a.serviceId)
  }));
  
  res.json({
    practitioner,
    appointments: enriched,
    workingHours: practitioner.workingHours
  });
});

// ==================== SERVICE/APPOINTMENT TYPE MANAGEMENT ====================

// Get all services
app.get('/api/services', (req, res) => {
  const enriched = db.services.map(s => ({
    ...s,
    appointmentCount: db.appointments.filter(a => a.serviceId === s.id).length
  }));
  res.json(enriched);
});

// Get single service
app.get('/api/services/:id', (req, res) => {
  const service = db.services.find(s => s.id === req.params.id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

// Create new service (admin only)
app.post('/api/services', (req, res) => {
  const { name, duration, price, color, description, category } = req.body;
  
  if (!name || !duration || !price) {
    return res.status(400).json({ error: 'Name, duration, and price are required' });
  }
  
  const service = {
    id: uuidv4(),
    name,
    duration: parseInt(duration),
    price: parseFloat(price),
    color: color || getRandomColor(),
    description: description || '',
    category: category || 'general',
    isActive: true,
    createdAt: new Date()
  };
  
  db.services.push(service);
  
  db.agentActivities.unshift({
    id: uuidv4(),
    agentType: 'scheduling',
    action: `New service added: ${name}`,
    timestamp: new Date(),
    status: 'completed'
  });
  
  res.status(201).json(service);
});

// Update service
app.patch('/api/services/:id', (req, res) => {
  const service = db.services.find(s => s.id === req.params.id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  
  const { name, duration, price, color, description, category, isActive } = req.body;
  
  if (name !== undefined) service.name = name;
  if (duration !== undefined) service.duration = parseInt(duration);
  if (price !== undefined) service.price = parseFloat(price);
  if (color !== undefined) service.color = color;
  if (description !== undefined) service.description = description;
  if (category !== undefined) service.category = category;
  if (isActive !== undefined) service.isActive = isActive;
  
  service.updatedAt = new Date();
  
  res.json(service);
});

// Delete service
app.delete('/api/services/:id', (req, res) => {
  const index = db.services.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Service not found' });
  
  // Check for future appointments using this service
  const futureAppointments = db.appointments.filter(
    a => a.serviceId === req.params.id && 
    a.date >= format(new Date(), 'yyyy-MM-dd') &&
    a.status !== 'cancelled'
  );
  
  if (futureAppointments.length > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete service with future appointments',
      appointments: futureAppointments.length
    });
  }
  
  db.services.splice(index, 1);
  res.status(204).send();
});

app.get('/api/patients', (req, res) => res.json(db.patients));

app.get('/api/patients/:id', (req, res) => {
  const patient = db.patients.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const patientAppointments = db.appointments.filter(a => a.patientId === patient.id);
  const patientNotes = db.notes.filter(n => n.patientId === patient.id);
  res.json({ ...patient, appointments: patientAppointments, notes: patientNotes });
});

// ==================== APPOINTMENT/BOOKING SYSTEM ====================

// Get appointments with filtering
app.get('/api/appointments', (req, res) => {
  const { date, practitionerId, patientId, status, startDate, endDate } = req.query;
  let appointments = db.appointments;
  
  if (date) appointments = appointments.filter(a => a.date === date);
  if (startDate) appointments = appointments.filter(a => a.date >= startDate);
  if (endDate) appointments = appointments.filter(a => a.date <= endDate);
  if (practitionerId) appointments = appointments.filter(a => a.practitionerId === practitionerId);
  if (patientId) appointments = appointments.filter(a => a.patientId === patientId);
  if (status) appointments = appointments.filter(a => a.status === status);
  
  // Sort by date and time
  appointments.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
  
  const enriched = appointments.map(a => ({
    ...a,
    patient: db.patients.find(p => p.id === a.patientId),
    practitioner: db.practitioners.find(p => p.id === a.practitionerId),
    service: db.services.find(s => s.id === a.serviceId)
  }));
  
  res.json(enriched);
});

// Get single appointment
app.get('/api/appointments/:id', (req, res) => {
  const appointment = db.appointments.find(a => a.id === req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  
  res.json({
    ...appointment,
    patient: db.patients.find(p => p.id === appointment.patientId),
    practitioner: db.practitioners.find(p => p.id === appointment.practitionerId),
    service: db.services.find(s => s.id === appointment.serviceId)
  });
});

// Create new appointment with availability check
app.post('/api/appointments', (req, res) => {
  const { patientId, practitionerId, serviceId, date, time, notes } = req.body;
  
  // Validation
  if (!patientId || !practitionerId || !serviceId || !date || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Check practitioner exists
  const practitioner = db.practitioners.find(p => p.id === practitionerId);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  if (!practitioner.isActive) return res.status(400).json({ error: 'Practitioner is not active' });
  
  // Check service exists
  const service = db.services.find(s => s.id === serviceId);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  if (!service.isActive) return res.status(400).json({ error: 'Service is not active' });
  
  // Check for conflicts
  const existingAppointment = db.appointments.find(a => 
    a.practitionerId === practitionerId && 
    a.date === date && 
    a.time === time && 
    a.status !== 'cancelled'
  );
  
  if (existingAppointment) {
    return res.status(409).json({ 
      error: 'Time slot is not available',
      conflict: existingAppointment
    });
  }
  
  // Check practitioner's working hours
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });
  const workingDay = practitioner.workingHours?.[dayOfWeek];
  
  if (workingDay && !workingDay.enabled) {
    return res.status(400).json({ error: 'Practitioner does not work on this day' });
  }
  
  if (workingDay && (time < workingDay.start || time > workingDay.end)) {
    return res.status(400).json({ 
      error: 'Time is outside working hours',
      workingHours: workingDay
    });
  }
  
  const appointment = { 
    id: uuidv4(), 
    patientId, 
    practitionerId, 
    serviceId, 
    date, 
    time, 
    duration: service.duration,
    notes: notes || '',
    status: 'confirmed',
    createdAt: new Date() 
  };
  
  db.appointments.push(appointment);
  
  const patient = db.patients.find(p => p.id === patientId);
  
  db.agentActivities.unshift({
    id: uuidv4(),
    agentType: 'scheduling',
    action: `New appointment booked: ${service.name} for ${patient?.firstName} ${patient?.lastName} with ${practitioner.name}`,
    patientId,
    timestamp: new Date(),
    status: 'completed'
  });
  
  res.status(201).json({
    ...appointment,
    patient,
    practitioner,
    service
  });
});

// Update appointment
app.patch('/api/appointments/:id', (req, res) => {
  const appointment = db.appointments.find(a => a.id === req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  
  const { date, time, status, notes, practitionerId, serviceId } = req.body;
  
  // Check for conflicts if changing time/practitioner
  if ((date !== undefined && date !== appointment.date) || 
      (time !== undefined && time !== appointment.time) ||
      (practitionerId !== undefined && practitionerId !== appointment.practitionerId)) {
    
    const newPractitionerId = practitionerId || appointment.practitionerId;
    const newDate = date || appointment.date;
    const newTime = time || appointment.time;
    
    const existingAppointment = db.appointments.find(a => 
      a.id !== appointment.id &&
      a.practitionerId === newPractitionerId && 
      a.date === newDate && 
      a.time === newTime && 
      a.status !== 'cancelled'
    );
    
    if (existingAppointment) {
      return res.status(409).json({ 
        error: 'Time slot is not available',
        conflict: existingAppointment
      });
    }
  }
  
  if (date !== undefined) appointment.date = date;
  if (time !== undefined) appointment.time = time;
  if (status !== undefined) appointment.status = status;
  if (notes !== undefined) appointment.notes = notes;
  if (practitionerId !== undefined) appointment.practitionerId = practitionerId;
  if (serviceId !== undefined) {
    appointment.serviceId = serviceId;
    const service = db.services.find(s => s.id === serviceId);
    if (service) appointment.duration = service.duration;
  }
  
  appointment.updatedAt = new Date();
  
  res.json({
    ...appointment,
    patient: db.patients.find(p => p.id === appointment.patientId),
    practitioner: db.practitioners.find(p => p.id === appointment.practitionerId),
    service: db.services.find(s => s.id === appointment.serviceId)
  });
});

// Cancel appointment
app.post('/api/appointments/:id/cancel', (req, res) => {
  const appointment = db.appointments.find(a => a.id === req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  
  appointment.status = 'cancelled';
  appointment.cancelledAt = new Date();
  appointment.cancellationReason = req.body.reason || '';
  
  db.agentActivities.unshift({
    id: uuidv4(),
    agentType: 'scheduling',
    action: `Appointment cancelled: ${appointment.date} at ${appointment.time}`,
    patientId: appointment.patientId,
    timestamp: new Date(),
    status: 'completed'
  });
  
  res.json(appointment);
});

// Delete appointment (hard delete)
app.delete('/api/appointments/:id', (req, res) => {
  const index = db.appointments.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Appointment not found' });
  
  db.appointments.splice(index, 1);
  res.status(204).send();
});

app.post('/api/voice-webhook', (req, res) => {
  const { type } = req.body;
  db.agentActivities.unshift({
    id: uuidv4(),
    agentType: 'scheduling',
    action: `Voice AI: ${type}`,
    timestamp: new Date(),
    status: 'completed'
  });
  res.json({ success: true, action: type === 'booking' ? 'appointment_booked' : 'information_provided' });
});

app.get('/api/agent-activities', (req, res) => {
  const activities = db.agentActivities.slice(0, 50).map(a => ({
    ...a,
    patient: db.patients.find(p => p.id === a.patientId)
  }));
  res.json(activities);
});

// Transcribe audio using Whisper API
app.post('/api/transcribe', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const { audioBase64, appointmentId } = req.body;
    
    if (!audioBase64) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const tempFile = `/tmp/audio-${Date.now()}.webm`;
    
    // Write to temp file
    fs.writeFileSync(tempFile, audioBuffer);

    // Create form data for Whisper API
    const form = new FormData();
    form.append('file', fs.createReadStream(tempFile), { filename: 'audio.webm', contentType: 'audio/webm' });
    form.append('model', 'whisper-1');
    form.append('language', 'en');

    // Make request to Whisper API
    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          ...form.getHeaders()
        }
      };

      const request = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      request.on('error', reject);
      form.pipe(request);
    });

    // Clean up temp file
    fs.unlinkSync(tempFile);

    // Log the transcription activity
    db.agentActivities.unshift({
      id: uuidv4(),
      agentType: 'documentation',
      action: 'Transcribed session audio with Whisper',
      patientId: appointmentId ? db.appointments.find(a => a.id === appointmentId)?.patientId : null,
      timestamp: new Date(),
      status: 'completed'
    });

    res.json({
      transcript: response.text,
      duration: response.duration || null,
      language: response.language || 'en'
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: error.message || 'Transcription failed' });
  }
});

// Generate SOAP note from transcript using GPT-4o
app.post('/api/generate-note', async (req, res) => {
  if (!OPENAI_API_KEY) {
    // Fallback to mock data if no API key
    const { appointmentId } = req.body;
    const note = {
      id: uuidv4(),
      appointmentId,
      type: 'SOAP',
      subjective: 'Patient reports continued improvement in knee mobility. Pain level reduced from 6/10 to 3/10.',
      objective: 'ROM: Knee flexion 0-125° (improved from 110°). Gait normal. No swelling observed.',
      assessment: 'Good progress with rehabilitation. Patient responding well to treatment protocol.',
      plan: 'Continue with current exercise program. Schedule follow-up in 2 weeks.',
      generatedAt: new Date(),
      status: 'draft',
      source: 'mock'
    };
    db.notes.push(note);
    db.agentActivities.unshift({
      id: uuidv4(),
      agentType: 'documentation',
      action: 'Generated SOAP note from session',
      timestamp: new Date(),
      status: 'completed'
    });
    return res.json(note);
  }

  try {
    const { appointmentId, transcript, patientContext } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'No transcript provided' });
    }

    // Get appointment details for context
    const appointment = db.appointments.find(a => a.id === appointmentId);
    const patient = appointment ? db.patients.find(p => p.id === appointment.patientId) : null;
    const practitioner = appointment ? db.practitioners.find(p => p.id === appointment.practitionerId) : null;
    const service = appointment ? db.services.find(s => s.id === appointment.serviceId) : null;

    // Build the prompt for GPT-4o
    const systemPrompt = `You are an expert physiotherapy documentation assistant. Generate a professional SOAP note from the session transcript.

SOAP Note Structure:
- Subjective: Patient's reported symptoms, pain levels, history, concerns
- Objective: Measurable findings, ROM tests, observations, assessments performed
- Assessment: Clinical interpretation, diagnosis, progress evaluation
- Plan: Treatment provided, exercises prescribed, next steps, follow-up

Guidelines:
- Use professional medical terminology
- Be concise but thorough
- Include specific measurements where mentioned
- Note any changes from previous sessions
- Flag any concerns for follow-up`;

    const userPrompt = `Generate a SOAP note from this physiotherapy session transcript:

${transcript}

${patient ? `Patient: ${patient.firstName} ${patient.lastName}` : ''}
${service ? `Service: ${service.name}` : ''}
${practitioner ? `Practitioner: ${practitioner.name}` : ''}
${patientContext ? `Additional Context: ${patientContext}` : ''}

Provide the note in JSON format with fields: subjective, objective, assessment, plan`;

    // Call GPT-4o
    const response = await openAIRequest('/chat/completions', {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const noteContent = JSON.parse(response.choices[0].message.content);

    const note = {
      id: uuidv4(),
      appointmentId,
      patientId: patient?.id,
      type: 'SOAP',
      subjective: noteContent.subjective || '',
      objective: noteContent.objective || '',
      assessment: noteContent.assessment || '',
      plan: noteContent.plan || '',
      transcript,
      generatedAt: new Date(),
      status: 'draft',
      source: 'ai',
      model: 'gpt-4o'
    };

    db.notes.push(note);
    db.agentActivities.unshift({
      id: uuidv4(),
      agentType: 'documentation',
      action: `Generated SOAP note with GPT-4o for ${patient ? patient.firstName + ' ' + patient.lastName : 'patient'}`,
      patientId: patient?.id,
      timestamp: new Date(),
      status: 'completed'
    });

    res.json(note);

  } catch (error) {
    console.error('Note generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate note' });
  }
});

// Get all notes for a patient
app.get('/api/notes', (req, res) => {
  const { patientId, appointmentId } = req.query;
  let notes = db.notes;
  
  if (patientId) notes = notes.filter(n => n.patientId === patientId);
  if (appointmentId) notes = notes.filter(n => n.appointmentId === appointmentId);
  
  // Enrich with patient info
  const enriched = notes.map(n => ({
    ...n,
    patient: n.patientId ? db.patients.find(p => p.id === n.patientId) : null,
    appointment: n.appointmentId ? db.appointments.find(a => a.id === n.appointmentId) : null
  }));
  
  res.json(enriched);
});

// Get single note
app.get('/api/notes/:id', (req, res) => {
  const note = db.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  
  res.json({
    ...note,
    patient: note.patientId ? db.patients.find(p => p.id === note.patientId) : null,
    appointment: note.appointmentId ? db.appointments.find(a => a.id === note.appointmentId) : null
  });
});

// Update note (for editing/saving)
app.patch('/api/notes/:id', (req, res) => {
  const note = db.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  
  const { subjective, objective, assessment, plan, status } = req.body;
  
  if (subjective !== undefined) note.subjective = subjective;
  if (objective !== undefined) note.objective = objective;
  if (assessment !== undefined) note.assessment = assessment;
  if (plan !== undefined) note.plan = plan;
  if (status !== undefined) note.status = status;
  
  note.updatedAt = new Date();
  
  res.json(note);
});

// Delete note
app.delete('/api/notes/:id', (req, res) => {
  const index = db.notes.findIndex(n => n.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Note not found' });
  
  db.notes.splice(index, 1);
  res.status(204).send();
});

// ==================== AVAILABILITY SYSTEM ====================

app.get('/api/availability', (req, res) => {
  const { date, practitionerId, serviceId, duration } = req.query;
  
  if (!date) return res.status(400).json({ error: 'Date is required' });
  
  const requestedDuration = parseInt(duration) || 30;
  const service = serviceId ? db.services.find(s => s.id === serviceId) : null;
  const actualDuration = service ? service.duration : requestedDuration;
  
  // If specific practitioner requested
  if (practitionerId) {
    const practitioner = db.practitioners.find(p => p.id === practitionerId);
    if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
    
    const slots = getAvailableSlots(date, practitioner, actualDuration);
    
    return res.json({
      date,
      practitionerId,
      serviceId,
      duration: actualDuration,
      slots
    });
  }
  
  // Return availability for all practitioners
  const allAvailability = db.practitioners
    .filter(p => p.isActive !== false)
    .map(practitioner => ({
      practitioner,
      slots: getAvailableSlots(date, practitioner, actualDuration)
    }))
    .filter(a => a.slots.length > 0);
  
  res.json({
    date,
    serviceId,
    duration: actualDuration,
    practitioners: allAvailability
  });
});

// Helper function to get available slots
function getAvailableSlots(date, practitioner, duration = 30) {
  const slots = [];
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });
  const workingDay = practitioner.workingHours?.[dayOfWeek];
  
  if (!workingDay || !workingDay.enabled) return slots;
  
  const startHour = parseInt(workingDay.start.split(':')[0]);
  const startMinute = parseInt(workingDay.start.split(':')[1]);
  const endHour = parseInt(workingDay.end.split(':')[0]);
  const endMinute = parseInt(workingDay.end.split(':')[1]);
  
  // Generate slots every 15 minutes
  for (let hour = startHour; hour < endHour || (hour === endHour && 0 < endMinute); hour++) {
    for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += 15) {
      if (hour === endHour && minute >= endMinute) break;
      
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Check if slot is available
      const slotEndHour = hour + Math.floor((minute + duration) / 60);
      const slotEndMinute = (minute + duration) % 60;
      
      // Check for conflicts with existing appointments
      const hasConflict = db.appointments.some(a => 
        a.practitionerId === practitioner.id && 
        a.date === date && 
        a.status !== 'cancelled' &&
        isTimeOverlapping(time, duration, a.time, a.duration || 30)
      );
      
      if (!hasConflict) {
        slots.push({
          time,
          available: true,
          practitionerId: practitioner.id,
          practitionerName: practitioner.name
        });
      }
    }
  }
  
  return slots;
}

// Helper function to check time overlap
function isTimeOverlapping(start1, duration1, start2, duration2) {
  const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  
  const s1 = toMinutes(start1);
  const e1 = s1 + duration1;
  const s2 = toMinutes(start2);
  const e2 = s2 + duration2;
  
  return s1 < e2 && s2 < e1;
}

// Helper function to get next available slot
function getNextAvailableSlot(practitionerId) {
  const practitioner = db.practitioners.find(p => p.id === practitionerId);
  if (!practitioner) return null;
  
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const date = format(addDays(today, i), 'yyyy-MM-dd');
    const slots = getAvailableSlots(date, practitioner, 30);
    if (slots.length > 0) {
      return { date, time: slots[0].time };
    }
  }
  return null;
}

// Helper function to get random color
function getRandomColor() {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  return colors[Math.floor(Math.random() * colors.length)];
}

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Agentic Practice Management Server running on port ${PORT}`);
});

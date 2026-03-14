const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { format, addDays } = require('date-fns');
const fs = require('fs');
const https = require('https');
const FormData = require('form-data');
const DatabaseManager = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new DatabaseManager();
db.seedIfEmpty();

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

// Routes
app.get('/api/dashboard', (req, res) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayAppointments = db.getAppointments({ date: today, status: 'confirmed' });
  const pendingNotes = db.getNotes().filter(n => n.status === 'draft').length;
  const activePatients = db.getPatients().filter(p => p.status === 'active').length;
  const recentAgentActivity = db.getAgentActivities(10);
  
  res.json({
    todayAppointments: todayAppointments.length,
    pendingNotes,
    overdueInvoices: 0, // Not implemented yet
    activePatients,
    recentAgentActivity
  });
});

// ==================== PRACTITIONER MANAGEMENT ====================

// Get all practitioners
app.get('/api/practitioners', (req, res) => {
  const practitioners = db.getPractitioners();
  const enriched = practitioners.map(p => {
    const appointmentCount = db.getAppointments({ practitionerId: p.id, status: 'confirmed' }).length;
    return {
      ...p,
      specializations: JSON.parse(p.specializations || '[]'),
      workingHours: JSON.parse(p.workingHours || '{}'),
      appointmentCount,
      nextAvailable: getNextAvailableSlot(p.id)
    };
  });
  res.json(enriched);
});

// Get single practitioner
app.get('/api/practitioners/:id', (req, res) => {
  const practitioner = db.getPractitioner(req.params.id);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  
  const practitionerAppointments = db.getAppointments({ practitionerId: practitioner.id });
  const today = format(new Date(), 'yyyy-MM-dd');
  
  res.json({
    ...practitioner,
    specializations: JSON.parse(practitioner.specializations || '[]'),
    workingHours: JSON.parse(practitioner.workingHours || '{}'),
    appointments: practitionerAppointments,
    todayAppointments: practitionerAppointments.filter(a => a.date === today && a.status !== 'cancelled').length,
    totalAppointments: practitionerAppointments.length
  });
});

// Create new practitioner (admin only)
app.post('/api/practitioners', (req, res) => {
  const { name, role, email, phone, color, bio, specializations, workingHours } = req.body;
  
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required' });
  }
  
  const practitioner = db.createPractitioner({
    name, role, email, phone, color, bio, specializations, workingHours
  });
  
  db.createAgentActivity({
    agentType: 'scheduling',
    action: `New practitioner added: ${name}`,
    status: 'completed'
  });
  
  res.status(201).json({
    ...practitioner,
    specializations: JSON.parse(practitioner.specializations || '[]'),
    workingHours: JSON.parse(practitioner.workingHours || '{}')
  });
});

// Update practitioner
app.patch('/api/practitioners/:id', (req, res) => {
  const practitioner = db.updatePractitioner(req.params.id, req.body);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  
  res.json({
    ...practitioner,
    specializations: JSON.parse(practitioner.specializations || '[]'),
    workingHours: JSON.parse(practitioner.workingHours || '{}')
  });
});

// Delete practitioner
app.delete('/api/practitioners/:id', (req, res) => {
  // Check for future appointments
  const futureAppointments = db.getAppointments({
    practitionerId: req.params.id,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'confirmed'
  });
  
  if (futureAppointments.length > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete practitioner with future appointments',
      appointments: futureAppointments.length
    });
  }
  
  db.deletePractitioner(req.params.id);
  res.status(204).send();
});

// Get practitioner's calendar
app.get('/api/practitioners/:id/calendar', (req, res) => {
  const { startDate, endDate } = req.query;
  const practitioner = db.getPractitioner(req.params.id);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  
  const appointments = db.getAppointments({
    practitionerId: req.params.id,
    startDate,
    endDate
  });
  
  const enriched = appointments.map(a => ({
    ...a,
    patient: db.getPatient(a.patientId),
    service: db.getService(a.serviceId)
  }));
  
  res.json({
    practitioner: {
      ...practitioner,
      workingHours: JSON.parse(practitioner.workingHours || '{}')
    },
    appointments: enriched
  });
});

// ==================== SERVICE/APPOINTMENT TYPE MANAGEMENT ====================

// Get all services
app.get('/api/services', (req, res) => {
  const services = db.getServices();
  const enriched = services.map(s => ({
    ...s,
    appointmentCount: db.getAppointments({ serviceId: s.id }).length
  }));
  res.json(enriched);
});

// Get single service
app.get('/api/services/:id', (req, res) => {
  const service = db.getService(req.params.id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

// Create new service (admin only)
app.post('/api/services', (req, res) => {
  const { name, duration, price, color, description, category } = req.body;
  
  if (!name || !duration || !price) {
    return res.status(400).json({ error: 'Name, duration, and price are required' });
  }
  
  const service = db.createService({ name, duration: parseInt(duration), price: parseFloat(price), color, description, category });
  
  db.createAgentActivity({
    agentType: 'scheduling',
    action: `New service added: ${name}`,
    status: 'completed'
  });
  
  res.status(201).json(service);
});

// Update service
app.patch('/api/services/:id', (req, res) => {
  const service = db.updateService(req.params.id, req.body);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

// Delete service
app.delete('/api/services/:id', (req, res) => {
  // Check for future appointments using this service
  const futureAppointments = db.getAppointments({
    serviceId: req.params.id,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'confirmed'
  });
  
  if (futureAppointments.length > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete service with future appointments',
      appointments: futureAppointments.length
    });
  }
  
  db.deleteService(req.params.id);
  res.status(204).send();
});

// ==================== PATIENT CRM SYSTEM ====================

// Get all patients with optional search
app.get('/api/patients', (req, res) => {
  const { search, status } = req.query;
  let patients = db.getPatients();

  if (search) {
    const searchLower = search.toLowerCase();
    patients = patients.filter(p =>
      p.firstName.toLowerCase().includes(searchLower) ||
      p.lastName.toLowerCase().includes(searchLower) ||
      p.email.toLowerCase().includes(searchLower) ||
      p.phone.includes(search)
    );
  }

  if (status) {
    patients = patients.filter(p => p.status === status);
  }

  // Enrich with appointment counts
  const enriched = patients.map(p => {
    const appointments = db.getAppointments({ patientId: p.id });
    const lastAppointment = appointments
      .filter(a => a.date < format(new Date(), 'yyyy-MM-dd'))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const nextAppointment = appointments
      .filter(a => a.date >= format(new Date(), 'yyyy-MM-dd') && a.status === 'confirmed')
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    return {
      ...p,
      totalAppointments: appointments.length,
      lastAppointment,
      nextAppointment
    };
  });

  res.json(enriched);
});

// Create new patient
app.post('/api/patients', (req, res) => {
  const {
    firstName, lastName, phone, email, dateOfBirth, gender, address,
    emergencyContactName, emergencyContactPhone, insuranceProvider, insuranceNumber,
    referredBy, notes, medicalHistory, allergies, medications
  } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  const patient = db.createPatient({
    firstName, lastName, phone, email, dateOfBirth, gender, address,
    emergencyContactName, emergencyContactPhone, insuranceProvider, insuranceNumber,
    referredBy, notes, medicalHistory, allergies, medications
  });

  db.createAgentActivity({
    agentType: 'patient_comms',
    action: `New patient registered: ${firstName} ${lastName}`,
    patientId: patient.id,
    status: 'completed'
  });

  res.status(201).json(patient);
});

// Get single patient with full details
app.get('/api/patients/:id', (req, res) => {
  const patient = db.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const appointments = db.getAppointments({ patientId: patient.id });
  const notes = db.getNotes({ patientId: patient.id });
  const communications = db.getPatientCommunications(patient.id);
  const documents = db.getPatientDocuments(patient.id);

  // Calculate stats
  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter(a => a.status === 'completed').length;
  const cancelledAppointments = appointments.filter(a => a.status === 'cancelled').length;
  const totalSpent = appointments.reduce((sum, a) => {
    const service = db.getService(a.serviceId);
    return sum + (service?.price || 0);
  }, 0);

  res.json({
    ...patient,
    appointments: appointments.map(a => ({
      ...a,
      practitioner: db.getPractitioner(a.practitionerId),
      service: db.getService(a.serviceId)
    })),
    notes,
    communications,
    documents,
    stats: {
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      totalSpent,
      notesCount: notes.length
    }
  });
});

// Update patient
app.patch('/api/patients/:id', (req, res) => {
  const patient = db.updatePatient(req.params.id, req.body);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
});

// Delete patient
app.delete('/api/patients/:id', (req, res) => {
  // Check for appointments
  const appointments = db.getAppointments({ patientId: req.params.id });
  if (appointments.length > 0) {
    return res.status(400).json({
      error: 'Cannot delete patient with appointment history',
      appointments: appointments.length
    });
  }

  db.deletePatient(req.params.id);
  res.status(204).send();
});

// Get patient timeline (all activities)
app.get('/api/patients/:id/timeline', (req, res) => {
  const patient = db.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const appointments = db.getAppointments({ patientId: patient.id })
    .map(a => ({ ...a, type: 'appointment', practitioner: db.getPractitioner(a.practitionerId), service: db.getService(a.serviceId) }));
  const notes = db.getNotes({ patientId: patient.id })
    .map(n => ({ ...n, type: 'note' }));
  const communications = db.getPatientCommunications(patient.id)
    .map(c => ({ ...c, type: 'communication' }));

  // Combine and sort by date
  const timeline = [...appointments, ...notes, ...communications]
    .sort((a, b) => {
      const dateA = a.date || a.generatedAt || a.sentAt;
      const dateB = b.date || b.generatedAt || b.sentAt;
      return new Date(dateB) - new Date(dateA);
    });

  res.json(timeline);
});

// Add patient communication
app.post('/api/patients/:id/communications', (req, res) => {
  const { type, direction, content } = req.body;

  const communication = db.createPatientCommunication({
    patientId: req.params.id,
    type,
    direction,
    content
  });

  res.status(201).json(communication);
});

// Add patient document
app.post('/api/patients/:id/documents', (req, res) => {
  const { title, type, fileUrl, content } = req.body;

  const document = db.createPatientDocument({
    patientId: req.params.id,
    title,
    type,
    fileUrl,
    content
  });

  res.status(201).json(document);
});

// ==================== APPOINTMENT/BOOKING SYSTEM ====================

// Get appointments with filtering
app.get('/api/appointments', (req, res) => {
  const { date, practitionerId, patientId, status, startDate, endDate } = req.query;
  const appointments = db.getAppointments({ date, practitionerId, patientId, status, startDate, endDate });
  
  const enriched = appointments.map(a => ({
    ...a,
    patient: db.getPatient(a.patientId),
    practitioner: db.getPractitioner(a.practitionerId),
    service: db.getService(a.serviceId)
  }));
  
  res.json(enriched);
});

// Get single appointment
app.get('/api/appointments/:id', (req, res) => {
  const appointment = db.getAppointment(req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  
  res.json({
    ...appointment,
    patient: db.getPatient(appointment.patientId),
    practitioner: db.getPractitioner(appointment.practitionerId),
    service: db.getService(appointment.serviceId)
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
  const practitioner = db.getPractitioner(practitionerId);
  if (!practitioner) return res.status(404).json({ error: 'Practitioner not found' });
  if (practitioner.isActive === 0) return res.status(400).json({ error: 'Practitioner is not active' });
  
  // Check service exists
  const service = db.getService(serviceId);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  if (service.isActive === 0) return res.status(400).json({ error: 'Service is not active' });
  
  // Check for conflicts
  const existingAppointments = db.getAppointments({ practitionerId, date, status: 'confirmed' });
  const hasConflict = existingAppointments.some(a => a.time === time);
  
  if (hasConflict) {
    return res.status(409).json({ 
      error: 'Time slot is not available'
    });
  }
  
  // Check practitioner's working hours
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });
  const workingHours = JSON.parse(practitioner.workingHours || '{}');
  const workingDay = workingHours[dayOfWeek];
  
  if (workingDay && !workingDay.enabled) {
    return res.status(400).json({ error: 'Practitioner does not work on this day' });
  }
  
  if (workingDay && (time < workingDay.start || time > workingDay.end)) {
    return res.status(400).json({ 
      error: 'Time is outside working hours',
      workingHours: workingDay
    });
  }
  
  const appointment = db.createAppointment({
    patientId, practitionerId, serviceId, date, time, duration: service.duration, notes
  });
  
  const patient = db.getPatient(patientId);
  
  db.createAgentActivity({
    agentType: 'scheduling',
    action: `New appointment booked: ${service.name} for ${patient?.firstName} ${patient?.lastName} with ${practitioner.name}`,
    patientId,
    status: 'completed'
  });
  
  res.status(201).json({
    ...appointment,
    patient,
    practitioner: { ...practitioner, workingHours: JSON.parse(practitioner.workingHours || '{}') },
    service
  });
});

// Update appointment
app.patch('/api/appointments/:id', (req, res) => {
  const existing = db.getAppointment(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  
  const { date, time, practitionerId } = req.body;
  
  // Check for conflicts if changing time/practitioner
  if (date || time || practitionerId) {
    const newPractitionerId = practitionerId || existing.practitionerId;
    const newDate = date || existing.date;
    const newTime = time || existing.time;
    
    const conflicts = db.getAppointments({
      practitionerId: newPractitionerId,
      date: newDate,
      status: 'confirmed'
    }).filter(a => a.id !== req.params.id && a.time === newTime);
    
    if (conflicts.length > 0) {
      return res.status(409).json({ 
        error: 'Time slot is not available'
      });
    }
  }
  
  const appointment = db.updateAppointment(req.params.id, req.body);
  
  res.json({
    ...appointment,
    patient: db.getPatient(appointment.patientId),
    practitioner: db.getPractitioner(appointment.practitionerId),
    service: db.getService(appointment.serviceId)
  });
});

// Cancel appointment
app.post('/api/appointments/:id/cancel', (req, res) => {
  const appointment = db.updateAppointment(req.params.id, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancellationReason: req.body.reason || ''
  });
  
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  
  db.createAgentActivity({
    agentType: 'scheduling',
    action: `Appointment cancelled: ${appointment.date} at ${appointment.time}`,
    patientId: appointment.patientId,
    status: 'completed'
  });
  
  res.json(appointment);
});

// Delete appointment (hard delete)
app.delete('/api/appointments/:id', (req, res) => {
  db.deleteAppointment(req.params.id);
  res.status(204).send();
});

app.post('/api/voice-webhook', (req, res) => {
  const { type } = req.body;
  db.createAgentActivity({
    agentType: 'scheduling',
    action: `Voice AI: ${type}`,
    status: 'completed'
  });
  res.json({ success: true, action: type === 'booking' ? 'appointment_booked' : 'information_provided' });
});

app.get('/api/agent-activities', (req, res) => {
  const activities = db.getAgentActivities(50).map(a => ({
    ...a,
    patient: a.patientId ? db.getPatient(a.patientId) : null
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
    const appointment = appointmentId ? db.getAppointment(appointmentId) : null;
    db.createAgentActivity({
      agentType: 'documentation',
      action: 'Transcribed session audio with Whisper',
      patientId: appointment?.patientId,
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
    const note = db.createNote({
      appointmentId,
      type: 'SOAP',
      subjective: 'Patient reports continued improvement in knee mobility. Pain level reduced from 6/10 to 3/10.',
      objective: 'ROM: Knee flexion 0-125° (improved from 110°). Gait normal. No swelling observed.',
      assessment: 'Good progress with rehabilitation. Patient responding well to treatment protocol.',
      plan: 'Continue with current exercise program. Schedule follow-up in 2 weeks.',
      status: 'draft',
      source: 'mock'
    });

    db.createAgentActivity({
      agentType: 'documentation',
      action: 'Generated SOAP note from session',
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
    const appointment = appointmentId ? db.getAppointment(appointmentId) : null;
    const patient = appointment ? db.getPatient(appointment.patientId) : null;
    const practitioner = appointment ? db.getPractitioner(appointment.practitionerId) : null;
    const service = appointment ? db.getService(appointment.serviceId) : null;

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

    const note = db.createNote({
      appointmentId,
      patientId: patient?.id,
      type: 'SOAP',
      subjective: noteContent.subjective || '',
      objective: noteContent.objective || '',
      assessment: noteContent.assessment || '',
      plan: noteContent.plan || '',
      transcript,
      status: 'draft',
      source: 'ai',
      model: 'gpt-4o'
    });

    db.createAgentActivity({
      agentType: 'documentation',
      action: `Generated SOAP note with GPT-4o for ${patient ? patient.firstName + ' ' + patient.lastName : 'patient'}`,
      patientId: patient?.id,
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
  const notes = db.getNotes({ patientId, appointmentId });

  // Enrich with patient info
  const enriched = notes.map(n => ({
    ...n,
    patient: n.patientId ? db.getPatient(n.patientId) : null,
    appointment: n.appointmentId ? db.getAppointment(n.appointmentId) : null
  }));

  res.json(enriched);
});

// Get single note
app.get('/api/notes/:id', (req, res) => {
  const note = db.getNote(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  res.json({
    ...note,
    patient: note.patientId ? db.getPatient(note.patientId) : null,
    appointment: note.appointmentId ? db.getAppointment(note.appointmentId) : null
  });
});

// Update note (for editing/saving)
app.patch('/api/notes/:id', (req, res) => {
  const note = db.updateNote(req.params.id, req.body);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  res.json(note);
});

// Delete note
app.delete('/api/notes/:id', (req, res) => {
  db.deleteNote(req.params.id);
  res.status(204).send();
});

// ==================== AVAILABILITY SYSTEM ====================

app.get('/api/availability', (req, res) => {
  const { date, practitionerId, serviceId, duration } = req.query;

  if (!date) return res.status(400).json({ error: 'Date is required' });

  const requestedDuration = parseInt(duration) || 30;
  const service = serviceId ? db.getService(serviceId) : null;
  const actualDuration = service ? service.duration : requestedDuration;

  // If specific practitioner requested
  if (practitionerId) {
    const practitioner = db.getPractitioner(practitionerId);
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
  const allPractitioners = db.getPractitioners().filter(p => p.isActive !== 0);
  const allAvailability = allPractitioners
    .map(practitioner => ({
      practitioner: {
        ...practitioner,
        workingHours: JSON.parse(practitioner.workingHours || '{}')
      },
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
  const workingHours = JSON.parse(practitioner.workingHours || '{}');
  const workingDay = workingHours[dayOfWeek];

  if (!workingDay || !workingDay.enabled) return slots;

  const startHour = parseInt(workingDay.start.split(':')[0]);
  const startMinute = parseInt(workingDay.start.split(':')[1]);
  const endHour = parseInt(workingDay.end.split(':')[0]);
  const endMinute = parseInt(workingDay.end.split(':')[1]);

  // Get existing appointments for this date and practitioner
  const existingAppointments = db.getAppointments({
    practitionerId: practitioner.id,
    date: date,
    status: 'confirmed'
  });

  // Generate slots every 15 minutes
  for (let hour = startHour; hour < endHour || (hour === endHour && 0 < endMinute); hour++) {
    for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += 15) {
      if (hour === endHour && minute >= endMinute) break;

      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      // Check for conflicts with existing appointments
      const hasConflict = existingAppointments.some(a =>
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
  const practitioner = db.getPractitioner(practitionerId);
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

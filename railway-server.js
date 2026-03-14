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

app.get('/api/practitioners', (req, res) => res.json(db.practitioners));
app.get('/api/services', (req, res) => res.json(db.services));
app.get('/api/patients', (req, res) => res.json(db.patients));

app.get('/api/patients/:id', (req, res) => {
  const patient = db.patients.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const patientAppointments = db.appointments.filter(a => a.patientId === patient.id);
  const patientNotes = db.notes.filter(n => n.patientId === patient.id);
  res.json({ ...patient, appointments: patientAppointments, notes: patientNotes });
});

app.get('/api/appointments', (req, res) => {
  const { date, practitionerId, patientId } = req.query;
  let appointments = db.appointments;
  
  if (date) appointments = appointments.filter(a => a.date === date);
  if (practitionerId) appointments = appointments.filter(a => a.practitionerId === practitionerId);
  if (patientId) appointments = appointments.filter(a => a.patientId === patientId);
  
  const enriched = appointments.map(a => ({
    ...a,
    patient: db.patients.find(p => p.id === a.patientId),
    practitioner: db.practitioners.find(p => p.id === a.practitionerId),
    service: db.services.find(s => s.id === a.serviceId)
  }));
  
  res.json(enriched);
});

app.post('/api/appointments', (req, res) => {
  const appointment = { id: uuidv4(), ...req.body, createdAt: new Date() };
  db.appointments.push(appointment);
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

app.get('/api/availability', (req, res) => {
  const { date, practitionerId } = req.query;
  const slots = [];
  for (let hour = 8; hour < 19; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    const existing = db.appointments.find(a => 
      a.date === date && a.time === time && a.practitionerId === practitionerId && a.status !== 'cancelled'
    );
    if (!existing) slots.push({ time, available: true });
  }
  res.json({ date, practitionerId, slots });
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Agentic Practice Management Server running on port ${PORT}`);
});

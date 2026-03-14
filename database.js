const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DATABASE_PATH || './practice.db';

class DatabaseManager {
  constructor() {
    this.db = new Database(DB_PATH);
    this.init();
  }

  init() {
    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS practitioners (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        color TEXT DEFAULT '#3b82f6',
        bio TEXT,
        specializations TEXT,
        workingHours TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        duration INTEGER NOT NULL,
        price REAL NOT NULL,
        color TEXT DEFAULT '#3b82f6',
        description TEXT,
        category TEXT DEFAULT 'general',
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        dateOfBirth TEXT,
        gender TEXT,
        address TEXT,
        emergencyContactName TEXT,
        emergencyContactPhone TEXT,
        insuranceProvider TEXT,
        insuranceNumber TEXT,
        referredBy TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        medicalHistory TEXT,
        allergies TEXT,
        medications TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS patientCommunications (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        type TEXT NOT NULL,
        direction TEXT NOT NULL,
        content TEXT NOT NULL,
        sentAt TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'sent',
        FOREIGN KEY (patientId) REFERENCES patients(id)
      );

      CREATE TABLE IF NOT EXISTS patientDocuments (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        fileUrl TEXT,
        content TEXT,
        uploadedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patientId) REFERENCES patients(id)
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        practitionerId TEXT NOT NULL,
        serviceId TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        duration INTEGER,
        status TEXT DEFAULT 'confirmed',
        notes TEXT,
        cancelledAt TEXT,
        cancellationReason TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patientId) REFERENCES patients(id),
        FOREIGN KEY (practitionerId) REFERENCES practitioners(id),
        FOREIGN KEY (serviceId) REFERENCES services(id)
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        appointmentId TEXT,
        patientId TEXT,
        type TEXT DEFAULT 'SOAP',
        subjective TEXT,
        objective TEXT,
        assessment TEXT,
        plan TEXT,
        transcript TEXT,
        status TEXT DEFAULT 'draft',
        source TEXT,
        model TEXT,
        generatedAt TEXT,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointmentId) REFERENCES appointments(id),
        FOREIGN KEY (patientId) REFERENCES patients(id)
      );

      CREATE TABLE IF NOT EXISTS agentActivities (
        id TEXT PRIMARY KEY,
        agentType TEXT NOT NULL,
        action TEXT NOT NULL,
        patientId TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'completed',
        FOREIGN KEY (patientId) REFERENCES patients(id)
      );

      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
      CREATE INDEX IF NOT EXISTS idx_appointments_practitioner ON appointments(practitionerId);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patientId);
      CREATE INDEX IF NOT EXISTS idx_notes_patient ON notes(patientId);
      CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON agentActivities(timestamp);
    `);

    console.log('Database initialized');
  }

  // Practitioners
  getPractitioners() {
    return this.db.prepare('SELECT * FROM practitioners ORDER BY name').all();
  }

  getPractitioner(id) {
    return this.db.prepare('SELECT * FROM practitioners WHERE id = ?').get(id);
  }

  createPractitioner(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO practitioners (id, name, role, email, phone, color, bio, specializations, workingHours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.name,
      data.role,
      data.email || '',
      data.phone || '',
      data.color || '#3b82f6',
      data.bio || '',
      JSON.stringify(data.specializations || []),
      JSON.stringify(data.workingHours || this.getDefaultWorkingHours())
    );
    return this.getPractitioner(id);
  }

  updatePractitioner(id, data) {
    const fields = [];
    const values = [];
    
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
    if (data.bio !== undefined) { fields.push('bio = ?'); values.push(data.bio); }
    if (data.specializations !== undefined) { fields.push('specializations = ?'); values.push(JSON.stringify(data.specializations)); }
    if (data.workingHours !== undefined) { fields.push('workingHours = ?'); values.push(JSON.stringify(data.workingHours)); }
    if (data.isActive !== undefined) { fields.push('isActive = ?'); values.push(data.isActive ? 1 : 0); }
    
    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE practitioners SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getPractitioner(id);
  }

  deletePractitioner(id) {
    const stmt = this.db.prepare('DELETE FROM practitioners WHERE id = ?');
    return stmt.run(id);
  }

  // Services
  getServices() {
    return this.db.prepare('SELECT * FROM services ORDER BY name').all();
  }

  getService(id) {
    return this.db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  }

  createService(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO services (id, name, duration, price, color, description, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.name, data.duration, data.price, data.color || '#3b82f6', data.description || '', data.category || 'general');
    return this.getService(id);
  }

  updateService(id, data) {
    const fields = [];
    const values = [];
    
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.duration !== undefined) { fields.push('duration = ?'); values.push(data.duration); }
    if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.isActive !== undefined) { fields.push('isActive = ?'); values.push(data.isActive ? 1 : 0); }
    
    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getService(id);
  }

  deleteService(id) {
    const stmt = this.db.prepare('DELETE FROM services WHERE id = ?');
    return stmt.run(id);
  }

  // Patients
  getPatients() {
    return this.db.prepare('SELECT * FROM patients ORDER BY lastName, firstName').all();
  }

  getPatient(id) {
    return this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  }

  createPatient(data) {
    const id = data.id || uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO patients (id, firstName, lastName, phone, email, dateOfBirth, gender, address, 
        emergencyContactName, emergencyContactPhone, insuranceProvider, insuranceNumber, 
        referredBy, status, notes, medicalHistory, allergies, medications)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, 
      data.firstName, 
      data.lastName, 
      data.phone || '', 
      data.email || '', 
      data.dateOfBirth || '',
      data.gender || '',
      data.address || '',
      data.emergencyContactName || '',
      data.emergencyContactPhone || '',
      data.insuranceProvider || '',
      data.insuranceNumber || '',
      data.referredBy || '',
      data.status || 'active', 
      data.notes || '',
      data.medicalHistory || '',
      data.allergies || '',
      data.medications || ''
    );
    return this.getPatient(id);
  }

  updatePatient(id, data) {
    const fields = [];
    const values = [];
    
    const fieldMap = {
      firstName: 'firstName', lastName: 'lastName', phone: 'phone', email: 'email',
      dateOfBirth: 'dateOfBirth', gender: 'gender', address: 'address',
      emergencyContactName: 'emergencyContactName', emergencyContactPhone: 'emergencyContactPhone',
      insuranceProvider: 'insuranceProvider', insuranceNumber: 'insuranceNumber',
      referredBy: 'referredBy', status: 'status', notes: 'notes',
      medicalHistory: 'medicalHistory', allergies: 'allergies', medications: 'medications'
    };
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        fields.push(`${dbField} = ?`);
        values.push(data[key]);
      }
    }
    
    if (fields.length === 0) return this.getPatient(id);
    
    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getPatient(id);
  }

  deletePatient(id) {
    const stmt = this.db.prepare('DELETE FROM patients WHERE id = ?');
    return stmt.run(id);
  }

  // Patient Communications
  getPatientCommunications(patientId) {
    return this.db.prepare('SELECT * FROM patientCommunications WHERE patientId = ? ORDER BY sentAt DESC').all(patientId);
  }

  createPatientCommunication(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO patientCommunications (id, patientId, type, direction, content, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.patientId, data.type, data.direction, data.content, data.status || 'sent');
    return { id, ...data };
  }

  // Patient Documents
  getPatientDocuments(patientId) {
    return this.db.prepare('SELECT * FROM patientDocuments WHERE patientId = ? ORDER BY uploadedAt DESC').all(patientId);
  }

  createPatientDocument(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO patientDocuments (id, patientId, title, type, fileUrl, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.patientId, data.title, data.type, data.fileUrl || '', data.content || '');
    return { id, ...data };
  }

  // Appointments
  getAppointments(filters = {}) {
    let query = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    
    if (filters.date) { query += ' AND date = ?'; params.push(filters.date); }
    if (filters.startDate) { query += ' AND date >= ?'; params.push(filters.startDate); }
    if (filters.endDate) { query += ' AND date <= ?'; params.push(filters.endDate); }
    if (filters.practitionerId) { query += ' AND practitionerId = ?'; params.push(filters.practitionerId); }
    if (filters.patientId) { query += ' AND patientId = ?'; params.push(filters.patientId); }
    if (filters.status) { query += ' AND status = ?'; params.push(filters.status); }
    
    query += ' ORDER BY date DESC, time DESC';
    
    return this.db.prepare(query).all(...params);
  }

  getAppointment(id) {
    return this.db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  }

  createAppointment(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO appointments (id, patientId, practitionerId, serviceId, date, time, duration, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.patientId, data.practitionerId, data.serviceId, data.date, data.time, data.duration || 30, data.notes || '');
    return this.getAppointment(id);
  }

  updateAppointment(id, data) {
    const fields = [];
    const values = [];
    
    if (data.date !== undefined) { fields.push('date = ?'); values.push(data.date); }
    if (data.time !== undefined) { fields.push('time = ?'); values.push(data.time); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    if (data.practitionerId !== undefined) { fields.push('practitionerId = ?'); values.push(data.practitionerId); }
    if (data.serviceId !== undefined) { fields.push('serviceId = ?'); values.push(data.serviceId); }
    if (data.duration !== undefined) { fields.push('duration = ?'); values.push(data.duration); }
    if (data.cancelledAt !== undefined) { fields.push('cancelledAt = ?'); values.push(data.cancelledAt); }
    if (data.cancellationReason !== undefined) { fields.push('cancellationReason = ?'); values.push(data.cancellationReason); }
    
    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getAppointment(id);
  }

  deleteAppointment(id) {
    const stmt = this.db.prepare('DELETE FROM appointments WHERE id = ?');
    return stmt.run(id);
  }

  // Notes
  getNotes(filters = {}) {
    let query = 'SELECT * FROM notes WHERE 1=1';
    const params = [];
    
    if (filters.patientId) { query += ' AND patientId = ?'; params.push(filters.patientId); }
    if (filters.appointmentId) { query += ' AND appointmentId = ?'; params.push(filters.appointmentId); }
    
    query += ' ORDER BY generatedAt DESC';
    
    return this.db.prepare(query).all(...params);
  }

  getNote(id) {
    return this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  }

  createNote(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO notes (id, appointmentId, patientId, type, subjective, objective, assessment, plan, transcript, status, source, model, generatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.appointmentId || null,
      data.patientId || null,
      data.type || 'SOAP',
      data.subjective || '',
      data.objective || '',
      data.assessment || '',
      data.plan || '',
      data.transcript || '',
      data.status || 'draft',
      data.source || '',
      data.model || '',
      new Date().toISOString()
    );
    return this.getNote(id);
  }

  updateNote(id, data) {
    const fields = [];
    const values = [];
    
    if (data.subjective !== undefined) { fields.push('subjective = ?'); values.push(data.subjective); }
    if (data.objective !== undefined) { fields.push('objective = ?'); values.push(data.objective); }
    if (data.assessment !== undefined) { fields.push('assessment = ?'); values.push(data.assessment); }
    if (data.plan !== undefined) { fields.push('plan = ?'); values.push(data.plan); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    
    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = this.db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getNote(id);
  }

  deleteNote(id) {
    const stmt = this.db.prepare('DELETE FROM notes WHERE id = ?');
    return stmt.run(id);
  }

  // Agent Activities
  getAgentActivities(limit = 50) {
    return this.db.prepare('SELECT * FROM agentActivities ORDER BY timestamp DESC LIMIT ?').all(limit);
  }

  createAgentActivity(data) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO agentActivities (id, agentType, action, patientId, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.agentType, data.action, data.patientId || null, data.status || 'completed');
    return { id, ...data };
  }

  // Helper methods
  getDefaultWorkingHours() {
    return {
      monday: { start: '09:00', end: '17:00', enabled: true },
      tuesday: { start: '09:00', end: '17:00', enabled: true },
      wednesday: { start: '09:00', end: '17:00', enabled: true },
      thursday: { start: '09:00', end: '17:00', enabled: true },
      friday: { start: '09:00', end: '17:00', enabled: true },
      saturday: { start: '09:00', end: '13:00', enabled: false },
      sunday: { start: '09:00', end: '13:00', enabled: false }
    };
  }

  // Seed data if empty
  seedIfEmpty() {
    const practitionerCount = this.db.prepare('SELECT COUNT(*) as count FROM practitioners').get().count;
    
    if (practitionerCount === 0) {
      console.log('Seeding initial data...');
      
      // Seed practitioners
      const practitioners = [
        { name: 'Dr. Sarah Chen', role: 'Senior Physiotherapist', color: '#3b82f6' },
        { name: 'Mark Wilson', role: 'Sports Therapist', color: '#10b981' },
        { name: 'Emma Thompson', role: 'Massage Therapist', color: '#f59e0b' }
      ];
      practitioners.forEach(p => this.createPractitioner(p));
      
      // Seed services
      const services = [
        { name: 'Initial Consultation', duration: 45, price: 75, color: '#3b82f6', category: 'consultation' },
        { name: 'Follow-up Session', duration: 30, price: 55, color: '#10b981', category: 'treatment' },
        { name: 'Sports Massage', duration: 45, price: 60, color: '#f59e0b', category: 'massage' },
        { name: 'Home Visit', duration: 45, price: 95, color: '#ef4444', category: 'home-visit' }
      ];
      services.forEach(s => this.createService(s));
      
      console.log('Initial data seeded');
    }
  }
}

module.exports = DatabaseManager;

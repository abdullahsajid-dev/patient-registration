'use strict';

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Normalize a phone number to digits-only for dedup comparison.
 * Strips +1, spaces, dashes, parentheses.
 */
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  // Strip leading country code "1" if 11 digits (US number)
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

/**
 * Wrap a result in the standard JSON envelope.
 */
function envelope(data, error = null) {
  return { data, error };
}

// ─────────────────────────────────────────────
// Patient Service
// ─────────────────────────────────────────────

/**
 * Create a new patient record.
 * Throws an error if a patient with the same phone already exists (active record).
 */
function createPatient(fields) {
  const {
    first_name, last_name, date_of_birth, phone,
    email, address, city, state, zip, reason_for_visit, call_transcript
  } = fields;

  const normalizedPhone = normalizePhone(phone);

  // Check for existing active patient by phone
  const existing = db.prepare(
    `SELECT * FROM patients WHERE phone = ? AND deleted_at IS NULL`
  ).get(normalizedPhone);

  if (existing) {
    const err = new Error('DUPLICATE_PATIENT');
    err.patient = existing;
    throw err;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO patients
      (id, first_name, last_name, date_of_birth, phone, email, address, city, state, zip, reason_for_visit, call_transcript, created_at, updated_at)
    VALUES
      (@id, @first_name, @last_name, @date_of_birth, @phone, @email, @address, @city, @state, @zip, @reason_for_visit, @call_transcript, @created_at, @updated_at)
  `).run({
    id, first_name, last_name, date_of_birth,
    phone: normalizedPhone,
    email: email || null,
    address: address || null,
    city: city || null,
    state: state || null,
    zip: zip || null,
    reason_for_visit: reason_for_visit || null,
    call_transcript: call_transcript ? JSON.stringify(call_transcript) : null,
    created_at: now,
    updated_at: now,
  });

  return db.prepare(`SELECT * FROM patients WHERE id = ?`).get(id);
}

/**
 * Get all active patients (not soft-deleted).
 */
function getAllPatients({ limit = 50, offset = 0 } = {}) {
  return db.prepare(
    `SELECT * FROM patients WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(limit, offset);
}

/**
 * Get a single patient by ID.
 */
function getPatientById(id) {
  return db.prepare(
    `SELECT * FROM patients WHERE id = ? AND deleted_at IS NULL`
  ).get(id);
}

/**
 * Find a patient by phone number (for duplicate detection).
 */
function findPatientByPhone(phone) {
  const normalizedPhone = normalizePhone(phone);
  return db.prepare(
    `SELECT * FROM patients WHERE phone = ? AND deleted_at IS NULL`
  ).get(normalizedPhone);
}

/**
 * Update a patient record (partial updates allowed).
 */
function updatePatient(id, fields) {
  const patient = db.prepare(
    `SELECT * FROM patients WHERE id = ? AND deleted_at IS NULL`
  ).get(id);

  if (!patient) return null;

  const updatableFields = [
    'first_name', 'last_name', 'date_of_birth', 'phone',
    'email', 'address', 'city', 'state', 'zip', 'reason_for_visit', 'call_transcript'
  ];

  const updates = {};
  for (const key of updatableFields) {
    if (fields[key] !== undefined) {
      updates[key] = key === 'phone' ? normalizePhone(fields[key]) : fields[key];
    }
  }

  if (Object.keys(updates).length === 0) return patient;

  updates.updated_at = new Date().toISOString();
  updates.id = id;

  const setClauses = Object.keys(updates)
    .filter(k => k !== 'id')
    .map(k => `${k} = @${k}`)
    .join(', ');

  db.prepare(`UPDATE patients SET ${setClauses} WHERE id = @id`).run(updates);

  return db.prepare(`SELECT * FROM patients WHERE id = ?`).get(id);
}

/**
 * Soft-delete a patient by setting deleted_at timestamp.
 */
function deletePatient(id) {
  const patient = db.prepare(
    `SELECT * FROM patients WHERE id = ? AND deleted_at IS NULL`
  ).get(id);

  if (!patient) return false;

  db.prepare(
    `UPDATE patients SET deleted_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), id);

  return true;
}

/**
 * Log a call to the call_logs table.
 */
function logCall(callData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO call_logs
      (id, patient_id, vapi_call_id, started_at, ended_at, duration_seconds, outcome, summary, created_at)
    VALUES
      (@id, @patient_id, @vapi_call_id, @started_at, @ended_at, @duration_seconds, @outcome, @summary, @created_at)
  `).run({
    id,
    patient_id: callData.patient_id || null,
    vapi_call_id: callData.vapi_call_id || null,
    started_at: callData.started_at || null,
    ended_at: callData.ended_at || null,
    duration_seconds: callData.duration_seconds || null,
    outcome: callData.outcome || null,
    summary: callData.summary || null,
    created_at: now,
  });
  return id;
}

module.exports = {
  createPatient, getAllPatients, getPatientById,
  findPatientByPhone, updatePatient, deletePatient,
  logCall, envelope,
};

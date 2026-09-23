'use strict';

const express = require('express');
const router = express.Router();

const {
  createPatient, getAllPatients, getPatientById,
  updatePatient, deletePatient, envelope
} = require('../services/patientService');

const {
  validateCreatePatient,
  validateUpdatePatient,
  validateIdParam,
} = require('../middleware/validate');

// ─────────────────────────────────────────────
// POST /patients — Create a new patient
// ─────────────────────────────────────────────
router.post('/', validateCreatePatient, (req, res) => {
  try {
    const patient = createPatient(req.body);
    console.log(`[PATIENTS] Created patient: ${patient.id} (${patient.first_name} ${patient.last_name})`);
    return res.status(201).json(envelope(patient));
  } catch (err) {
    if (err.message === 'DUPLICATE_PATIENT') {
      return res.status(409).json({
        data: null,
        error: {
          code: 'DUPLICATE_PATIENT',
          message: `A patient with this phone number already exists.`,
          existing_patient: {
            id: err.patient.id,
            first_name: err.patient.first_name,
            last_name: err.patient.last_name,
          },
        },
      });
    }
    console.error('[PATIENTS] Create error:', err);
    return res.status(500).json(envelope(null, { code: 'INTERNAL_ERROR', message: err.message }));
  }
});

// ─────────────────────────────────────────────
// GET /patients — List all active patients
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const patients = getAllPatients({ limit, offset });
    return res.status(200).json(envelope(patients));
  } catch (err) {
    console.error('[PATIENTS] List error:', err);
    return res.status(500).json(envelope(null, { code: 'INTERNAL_ERROR', message: err.message }));
  }
});

// ─────────────────────────────────────────────
// GET /patients/:id — Get a single patient
// ─────────────────────────────────────────────
router.get('/:id', validateIdParam, (req, res) => {
  try {
    const patient = getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json(envelope(null, { code: 'NOT_FOUND', message: 'Patient not found.' }));
    }
    return res.status(200).json(envelope(patient));
  } catch (err) {
    console.error('[PATIENTS] Get error:', err);
    return res.status(500).json(envelope(null, { code: 'INTERNAL_ERROR', message: err.message }));
  }
});

// ─────────────────────────────────────────────
// PUT /patients/:id — Update a patient (partial)
// ─────────────────────────────────────────────
router.put('/:id', validateUpdatePatient, (req, res) => {
  try {
    const updated = updatePatient(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json(envelope(null, { code: 'NOT_FOUND', message: 'Patient not found.' }));
    }
    console.log(`[PATIENTS] Updated patient: ${updated.id}`);
    return res.status(200).json(envelope(updated));
  } catch (err) {
    console.error('[PATIENTS] Update error:', err);
    return res.status(500).json(envelope(null, { code: 'INTERNAL_ERROR', message: err.message }));
  }
});

// ─────────────────────────────────────────────
// DELETE /patients/:id — Soft-delete a patient
// ─────────────────────────────────────────────
router.delete('/:id', validateIdParam, (req, res) => {
  try {
    const deleted = deletePatient(req.params.id);
    if (!deleted) {
      return res.status(404).json(envelope(null, { code: 'NOT_FOUND', message: 'Patient not found.' }));
    }
    console.log(`[PATIENTS] Soft-deleted patient: ${req.params.id}`);
    return res.status(200).json(envelope({ deleted: true, id: req.params.id }));
  } catch (err) {
    console.error('[PATIENTS] Delete error:', err);
    return res.status(500).json(envelope(null, { code: 'INTERNAL_ERROR', message: err.message }));
  }
});

module.exports = router;

'use strict';

/**
 * Vapi Webhook Handler
 *
 * Vapi calls this endpoint for two event types:
 *   1. tool-calls  — when the assistant invokes a registered tool (function)
 *   2. end-of-call-report — call summary after the call ends
 *
 * Docs: https://docs.vapi.ai/server-url
 */

const express = require('express');
const router = express.Router();

const {
  createPatient, findPatientByPhone, updatePatient, logCall, envelope
} = require('../services/patientService');

// ─────────────────────────────────────────────
// POST /vapi/webhook — main Vapi event receiver
// ─────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Missing message payload' });
  }

  const eventType = message.type;
  console.log(`[VAPI] Event received: ${eventType}`);

  // ── Tool Call Handler ──────────────────────
  if (eventType === 'tool-calls') {
    const toolCallResults = [];

    for (const toolCall of message.toolCallList || []) {
      const { id: toolCallId, function: fn } = toolCall;
      const args = fn.arguments || {};

      console.log(`[VAPI] Tool call: ${fn.name}`, JSON.stringify(args));

      try {
        let result;

        switch (fn.name) {

          // ── check_existing_patient ───────────
          case 'check_existing_patient': {
            const patient = findPatientByPhone(args.phone);
            if (patient) {
              result = {
                exists: true,
                patient_id: patient.id,
                first_name: patient.first_name,
                last_name: patient.last_name,
                message: `Found existing patient: ${patient.first_name} ${patient.last_name}`,
              };
            } else {
              result = { exists: false, message: 'No existing patient found with this phone number.' };
            }
            break;
          }

          // ── register_patient ─────────────────
          case 'register_patient': {
            const patient = createPatient({
              first_name: args.first_name,
              last_name: args.last_name,
              date_of_birth: args.date_of_birth,
              phone: args.phone,
              email: args.email,
              address: args.address,
              city: args.city,
              state: args.state,
              zip: args.zip,
              reason_for_visit: args.reason_for_visit,
            });

            // Log the call action
            console.log(`[VAPI] Patient registered: ${JSON.stringify({
              id: patient.id,
              name: `${patient.first_name} ${patient.last_name}`,
              phone: patient.phone,
              dob: patient.date_of_birth,
              reason: patient.reason_for_visit,
            })}`);

            result = {
              success: true,
              patient_id: patient.id,
              message: `Successfully registered ${patient.first_name} ${patient.last_name}.`,
            };
            break;
          }

          // ── update_patient ───────────────────
          case 'update_patient': {
            const updated = updatePatient(args.patient_id, {
              first_name: args.first_name,
              last_name: args.last_name,
              date_of_birth: args.date_of_birth,
              phone: args.phone,
              email: args.email,
              address: args.address,
              city: args.city,
              state: args.state,
              zip: args.zip,
              reason_for_visit: args.reason_for_visit,
            });

            if (!updated) {
              result = { success: false, message: 'Patient record not found.' };
            } else {
              console.log(`[VAPI] Patient updated: ${updated.id}`);
              result = {
                success: true,
                patient_id: updated.id,
                message: `Successfully updated ${updated.first_name} ${updated.last_name}'s record.`,
              };
            }
            break;
          }

          // ── Unknown tool ──────────────────────
          default:
            result = { error: `Unknown tool: ${fn.name}` };
        }

        toolCallResults.push({ toolCallId, result });

      } catch (err) {
        console.error(`[VAPI] Tool call error (${fn.name}):`, err.message);

        // Handle duplicate patient gracefully
        if (err.message === 'DUPLICATE_PATIENT') {
          toolCallResults.push({
            toolCallId,
            result: {
              success: false,
              duplicate: true,
              patient_id: err.patient.id,
              first_name: err.patient.first_name,
              last_name: err.patient.last_name,
              message: `A patient with this phone number already exists: ${err.patient.first_name} ${err.patient.last_name}.`,
            },
          });
        } else {
          toolCallResults.push({
            toolCallId,
            result: {
              success: false,
              error: 'An internal error occurred while processing your request.',
            },
          });
        }
      }
    }

    return res.status(200).json({ results: toolCallResults });
  }

  // ── End-of-Call Report ─────────────────────
  if (eventType === 'end-of-call-report') {
    const call = message.call || {};
    console.log(`[VAPI] Call ended. Duration: ${call.endedAt ? 'N/A' : 'unknown'}s`);
    console.log(`[VAPI] Call summary:`, message.summary || 'No summary');

    // Optionally log call to DB
    try {
      logCall({
        vapi_call_id: call.id,
        started_at: call.startedAt,
        ended_at: call.endedAt,
        outcome: message.summary ? 'completed' : 'abandoned',
        summary: message.summary || null,
      });
    } catch (logErr) {
      console.error('[VAPI] Failed to log call:', logErr.message);
    }

    return res.status(200).json({ received: true });
  }

  // ── Other events (status-update, etc.) ────
  return res.status(200).json({ received: true });
});

module.exports = router;

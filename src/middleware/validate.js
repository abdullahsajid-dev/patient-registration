'use strict';

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware: collect express-validator errors and return 422 if any.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed.',
        details: errors.array(),
      },
    });
  }
  next();
}

// ─────────────────────────────────────────────
// Reusable field validators
// ─────────────────────────────────────────────

const validateCreatePatient = [
  body('first_name')
    .trim().notEmpty().withMessage('first_name is required')
    .isLength({ max: 100 }).withMessage('first_name max 100 chars')
    .escape(),

  body('last_name')
    .trim().notEmpty().withMessage('last_name is required')
    .isLength({ max: 100 }).withMessage('last_name max 100 chars')
    .escape(),

  body('date_of_birth')
    .trim().notEmpty().withMessage('date_of_birth is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date_of_birth must be YYYY-MM-DD')
    .custom((value) => {
      const d = new Date(value);
      if (isNaN(d.getTime())) throw new Error('date_of_birth is not a valid date');
      if (d > new Date()) throw new Error('date_of_birth cannot be in the future');
      const minDate = new Date('1900-01-01');
      if (d < minDate) throw new Error('date_of_birth is too far in the past');
      return true;
    }),

  body('phone')
    .trim().notEmpty().withMessage('phone is required')
    .matches(/^[\d\s\-\+\(\)\.]+$/).withMessage('phone contains invalid characters')
    .custom((value) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        throw new Error('phone must have 10–15 digits');
      }
      return true;
    }),

  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim().isEmail().withMessage('email must be a valid email address')
    .normalizeEmail(),

  body('address').optional().trim().isLength({ max: 200 }).escape(),
  body('city').optional().trim().isLength({ max: 100 }).escape(),
  body('state').optional().trim().isLength({ max: 100 }).escape(),
  body('zip').optional().trim().isLength({ max: 20 }).escape(),
  body('reason_for_visit').optional().trim().isLength({ max: 500 }).escape(),

  handleValidationErrors,
];

const validateUpdatePatient = [
  param('id').isUUID().withMessage('id must be a valid UUID'),
  // All fields optional for partial update — same rules as create
  body('first_name').optional().trim().isLength({ max: 100 }).escape(),
  body('last_name').optional().trim().isLength({ max: 100 }).escape(),
  body('date_of_birth')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date_of_birth must be YYYY-MM-DD')
    .custom((value) => {
      if (!value) return true;
      const d = new Date(value);
      if (isNaN(d.getTime())) throw new Error('date_of_birth is not a valid date');
      if (d > new Date()) throw new Error('date_of_birth cannot be in the future');
      return true;
    }),
  body('phone')
    .optional()
    .matches(/^[\d\s\-\+\(\)\.]+$/).withMessage('phone contains invalid characters'),
  body('email').optional({ nullable: true }).trim().isEmail().normalizeEmail(),
  body('address').optional().trim().isLength({ max: 200 }).escape(),
  body('city').optional().trim().isLength({ max: 100 }).escape(),
  body('state').optional().trim().isLength({ max: 100 }).escape(),
  body('zip').optional().trim().isLength({ max: 20 }).escape(),
  body('reason_for_visit').optional().trim().isLength({ max: 500 }).escape(),

  handleValidationErrors,
];

const validateIdParam = [
  param('id').isUUID().withMessage('id must be a valid UUID'),
  handleValidationErrors,
];

module.exports = {
  validateCreatePatient,
  validateUpdatePatient,
  validateIdParam,
  handleValidationErrors,
};

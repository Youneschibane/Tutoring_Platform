const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getArchivedUser,
  getDeletionAuditTrail,
  permanentlyDeleteExpiredAccounts
} = require('../utils/accountDeletionService');
const { getCronJobStatus, triggerDeletionNow } = require('../utils/cronService');

// =====================
// ADMIN ONLY ROUTES
// =====================

/**
 * Get cron job status
 * GET /api/admin/deletion-status
 */
router.get('/deletion-status', protect, restrictTo('admin'), (req, res) => {
  try {
    const status = getCronJobStatus();
    res.status(200).json({
      status: 'success',
      data: status
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * Manually trigger deletion job
 * POST /api/admin/trigger-deletion
 */
router.post('/trigger-deletion', protect, restrictTo('admin'), async (req, res) => {
  try {
    const result = await triggerDeletionNow();
    res.status(200).json({
      status: 'success',
      message: `${result.deletedCount} accounts permanently deleted`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * Get deletion audit trail
 * POST /api/admin/deletion-audit
 * Body: { role?, startDate?, endDate? }
 */
router.post('/deletion-audit', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { role, startDate, endDate } = req.body;
    
    const filters = {};
    if (role) filters.role = role;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const auditTrail = await getDeletionAuditTrail(filters);
    
    res.status(200).json({
      status: 'success',
      message: 'Deletion audit trail retrieved',
      data: auditTrail
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * Search for archived user by email/phone
 * POST /api/admin/archived-user
 * Body: { email, phone }
 */
router.post('/archived-user', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { email, phone } = req.body;
    
    if (!email && !phone) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email or phone is required'
      });
    }

    const searchTerm = email || phone;
    const archived = await getArchivedUser(searchTerm);

    if (!archived) {
      return res.status(404).json({
        status: 'fail',
        message: 'Archived user not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Archived user data found',
      data: archived
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;

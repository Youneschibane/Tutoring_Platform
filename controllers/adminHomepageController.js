// adminStats.js
const User = require('./userModel');
const Teacher = require('./teacherModel');
const Service = require('./serviceModel');
const Seance = require('./sessionModel');   // your file is named sessionModel.js

/**
 * 1. Total active users (not admin, not soft-deleted, not permanently banned)
 */
async function getTotalUsersCount() {
  return User.countDocuments({
    role: { $ne: 'admin' },
    isDeleted: false,
    isPermanentlyBanned: false
  });
}

/**
 * 2. Total teachers (same conditions applied on User collection)
 *    If you prefer counting Teacher documents that have a matching active User,
 *    you can join, but counting users with role 'teacher' is simpler and matches
 *    the "same condition" requirement.
 */
async function getTotalTeachersCount() {
  return User.countDocuments({
    role: 'teacher',
    isDeleted: false,
    isPermanentlyBanned: false
  });
}

/**
 * 3. Total services (including soft‑deleted ones)
 */
async function getTotalServicesCount() {
  // No filter on isDeleted → counts everything
  return Service.countDocuments();
}

/**
 * 4. Monthly assured sessions table
 *    Returns array of { yearMonth: "2025-01", count: 12 }
 *    Sorted chronologically.
 */
async function getMonthlyAssuredSessions() {
  const pipeline = [
    // Keep only sessions that were effectively held
    { $match: { statut: 'assuree' } },
    // Group by year-month extracted from date_seance
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$date_seance' } },
        count: { $sum: 1 }
      }
    },
    // Sort from earliest to latest
    { $sort: { _id: 1 } },
    // Rename _id to yearMonth for a cleaner output
    {
      $project: {
        _id: 0,
        yearMonth: '$_id',
        count: 1
      }
    }
  ];

  return Seance.aggregate(pipeline);
}

module.exports = {
  getTotalUsersCount,
  getTotalTeachersCount,
  getTotalServicesCount,
  getMonthlyAssuredSessions
};
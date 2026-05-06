const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Service = require('../models/serviceModel');
const Seance = require('../models/sessionModel');   

const monthNames = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai',
  'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
];

const fillMonths = (aggregated) => {
  const map = new Map(aggregated.map(a => [a._id, a.count]));
  return monthNames.map((name, idx) => ({
    month: name,
    count: map.get(idx + 1) || 0
  }));
};


async function getTotalUsersCount() {
  return User.countDocuments({
    role: { $ne: 'admin' },
    isDeleted: false,
    isPermanentlyBanned: false
  });
}

async function getTotalTeachersCount() {
  return User.countDocuments({
    role: 'teacher',
    isDeleted: false,
    isPermanentlyBanned: false
  });
}

async function getTotalServicesCount() {
  return Service.countDocuments();
}

const getSessionChart = async () => {
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;
  const startThisYear = new Date(thisYear, 0, 1);
  const startLastYear = new Date(lastYear, 0, 1);
  const endLastYear   = new Date(lastYear, 11, 31, 23, 59, 59, 999);

  const [thisYearSessions, lastYearSessions] = await Promise.all([
    Seance.aggregate([
      { $match: { statut: 'assuree', date_seance: { $gte: startThisYear } } },
      { $group: { _id: { $month: '$date_seance' }, count: { $sum: 1 } } }
    ]),
    Seance.aggregate([
      { $match: { statut: 'assuree', date_seance: { $gte: startLastYear, $lte: endLastYear } } },
      { $group: { _id: { $month: '$date_seance' }, count: { $sum: 1 } } }
    ])
  ]);

  return {
    thisYear: fillMonths(thisYearSessions),
    lastYear: fillMonths(lastYearSessions)
  };
}

module.exports = {
  getTotalUsersCount,
  getTotalTeachersCount,
  getTotalServicesCount,
  getSessionChart
};
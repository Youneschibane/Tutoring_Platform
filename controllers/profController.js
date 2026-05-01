const Teacher = require('../models/teacherModel');
const Devis = require('../models/devisModel');
const Review = require('../models/evaluation');
const Seance = require('../models/sessionModel'); 
const Service = require('../models/serviceModel');
const User = require('../models/userModel');

const calculateTrend = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  const trend = ((current - previous) / previous) * 100;
  return Number(trend.toFixed(2));
};

const durationExpr = {
  $subtract: [
    {
      $add: [
        { $multiply: [{ $toInt: { $substr: ['$heure_fin', 0, 2] } }, 60] },
        { $toInt: { $substr: ['$heure_fin', 3, 2] } }
      ]
    },
    {
      $add: [
        { $multiply: [{ $toInt: { $substr: ['$heure_debut', 0, 2] } }, 60] },
        { $toInt: { $substr: ['$heure_debut', 3, 2] } }
      ]
    }
  ]
};

const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.idmembre;
    const now = new Date();

    const teacher = await Teacher.findOne({ id_enseignant: teacherId });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    const longId = teacher._id;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth      = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const startOfThisYear = new Date(now.getFullYear(), 0, 1);
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
    const endOfLastYear   = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);

    const [
      totalServices,
      devisStudents,
      sessionStudents,        
      totalComments,
      recentComments,
      devisStats,
      sessionStats,           
      todaySessions,

      commentsThisMonth,
      commentsLastMonth,
      devisStudentsThisMonth,
      devisStudentsLastMonth,
      durationThisMonth,
      durationLastMonth,
      servicesThisMonth,
      servicesLastMonth,

      sessionsPerMonth,

      commentsThisYear,
      commentsLastYear,
      studentsThisYearRaw,
      studentsLastYearRaw,
      servicesThisYear,
      servicesLastYear,
      sessionsThisYear,
      sessionsLastYear,
      sessionsPerMonthLastYear,

    ] = await Promise.all([

      Service.countDocuments({ id_enseignant: teacherId, isDeleted: false }),

      Devis.distinct('id_eleve', { id_enseignant: teacherId, statut: 'Accepte' }),

      Seance.aggregate([
        { $match: { enseignant: longId, statut: 'assuree' } },
        { $unwind: '$etudiants' },
        { $group: { _id: '$etudiants' } }
      ]),

      Review.countDocuments({ id_enseignant: teacherId, visible: true }),

      Review.find({ id_enseignant: teacherId, visible: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('id_participation', 'firstname lastname'),

      Devis.aggregate([
        { $match: { id_enseignant: teacherId, statut: 'Accepte' } },
        { $group: { _id: null, totalDurée: { $sum: '$duree_estimee' }, count: { $sum: 1 } } }
      ]),

      Seance.aggregate([
        { $match: { enseignant: longId, statut: 'assuree' } },
        {
          $addFields: { durationMinutes: durationExpr }
        },
        {
          $group: {
            _id: null,
            totalDurée: { $sum: '$durationMinutes' },
            count: { $sum: 1 }
          }
        }
      ]),

      Seance.find({
        enseignant: longId,
        date_seance: { $gte: startOfToday, $lte: endOfToday }
      }).sort({ heure_debut: 1 }),

      Review.countDocuments({ id_enseignant: teacherId, date_evaluation : { $gte: startOfCurrentMonth } }),
      Review.countDocuments({ id_enseignant: teacherId, date_evaluation : { $gte: startOfLastMonth, $lte: endOfLastMonth } }),

      Devis.distinct('id_eleve', { id_enseignant: teacherId, statut: 'Accepte', dateReponse: { $gte: startOfCurrentMonth } }),
      Devis.distinct('id_eleve', { id_enseignant: teacherId, statut: 'Accepte', dateReponse: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),

      Seance.aggregate([
        { $match: { enseignant: longId, statut: 'assuree', date_seance: { $gte: startOfCurrentMonth } } },
        { $addFields: { durationMinutes: durationExpr } },
        { $group: { _id: null, total: { $sum: '$durationMinutes' }, count: { $sum: 1 } } }
      ]),

      Seance.aggregate([
        { $match: { enseignant: longId, statut: 'assuree', date_seance: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $addFields: { durationMinutes: durationExpr } },
        { $group: { _id: null, total: { $sum: '$durationMinutes' }, count: { $sum: 1 } } }
      ]),

      Service.countDocuments({ id_enseignant: teacherId, date_creation: { $gte: startOfCurrentMonth } }),
      Service.countDocuments({ id_enseignant: teacherId, date_creation: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),

      Seance.aggregate([
        { $match: { enseignant: longId, date_seance: { $gte: startOfThisYear } } },
        {
          $group: {
            _id: { year: { $year: '$date_seance' }, month: { $month: '$date_seance' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      Review.countDocuments({ id_enseignant: teacherId,date_evaluation : { $gte: startOfThisYear } }),
      Review.countDocuments({ id_enseignant: teacherId,date_evaluation : { $gte: startOfLastYear, $lte: endOfLastYear } }),

      Devis.distinct('id_eleve', { id_enseignant: teacherId, statut: 'Accepte', dateReponse: { $gte: startOfThisYear } }),
      Devis.distinct('id_eleve', { id_enseignant: teacherId, statut: 'Accepte', dateReponse: { $gte: startOfLastYear, $lte: endOfLastYear } }),

      Service.countDocuments({ id_enseignant: teacherId, date_creation: { $gte: startOfThisYear } }),
      Service.countDocuments({ id_enseignant: teacherId, date_creation: { $gte: startOfLastYear, $lte: endOfLastYear } }),

      Seance.countDocuments({ enseignant: longId, statut: 'assuree', date_seance: { $gte: startOfThisYear } }),
      Seance.countDocuments({ enseignant: longId, statut: 'assuree', date_seance: { $gte: startOfLastYear, $lte: endOfLastYear } }),

      Seance.aggregate([
        { $match: { enseignant: longId, date_seance: { $gte: startOfLastYear, $lte: endOfLastYear } } },
        {
          $group: {
            _id: { month: { $month: '$date_seance' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.month': 1 } }
      ]),
    ]);

    const allUniqueStudents = new Set([
      ...devisStudents.map(id => id.toString()),
      ...sessionStudents.map(s => s._id.toString())
    ]);

    const dSum       = devisStats[0]?.totalDurée || 0;
    const dCount     = devisStats[0]?.count || 0;
    const sSum       = sessionStats[0]?.totalDurée || 0; 
    const sCount     = sessionStats[0]?.count || 0;
    const totalCount = dCount + sCount;
    const avgSessionDuration = totalCount > 0 ? Math.round((dSum + sSum) / totalCount) : 0;

    const commentsTrend = calculateTrend(commentsThisMonth, commentsLastMonth);
    const studentsTrend = calculateTrend(devisStudentsThisMonth.length, devisStudentsLastMonth.length);
    const servicesTrend = calculateTrend(servicesThisMonth, servicesLastMonth);

    const avgDurThisMonth = durationThisMonth[0]?.count > 0
      ? durationThisMonth[0].total / durationThisMonth[0].count : 0;
    const avgDurLastMonth = durationLastMonth[0]?.count > 0
      ? durationLastMonth[0].total / durationLastMonth[0].count : 0;
    const durationTrend = calculateTrend(avgDurThisMonth, avgDurLastMonth);

    const yearlyTrends = {
      comments: calculateTrend(commentsThisYear, commentsLastYear),
      students: calculateTrend(studentsThisYearRaw.length, studentsLastYearRaw.length),
      services: calculateTrend(servicesThisYear, servicesLastYear),
      sessions: calculateTrend(sessionsThisYear, sessionsLastYear),
      raw: {
        comments: { thisYear: commentsThisYear,           lastYear: commentsLastYear },
        students: { thisYear: studentsThisYearRaw.length, lastYear: studentsLastYearRaw.length },
        services: { thisYear: servicesThisYear,           lastYear: servicesLastYear },
        sessions: { thisYear: sessionsThisYear,           lastYear: sessionsLastYear },
      }
    };

    const monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

    const sessionChartThisYear = sessionsPerMonth.map(s => ({
      month: monthNames[s._id.month - 1],
      count: s.count
    }));

    const sessionChartLastYear = sessionsPerMonthLastYear.map(s => ({
      month: monthNames[s._id.month - 1],
      count: s.count
    }));

    const recentCommentsWithNames = await Promise.all(
      recentComments.map(async (e) => {
        const user = await User.findOne({ idmembre: e.id_eleve });
        return {
          ...e.toObject(),
          nom_eleve: user ? `${user.firstname} ${user.familyname}` : 'Élève',
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalServices,
          totalStudents: allUniqueStudents.size,
          avgSessionDuration, 
          totalComments,
          monthlyTrends: {
            students: studentsTrend,
            duration: durationTrend,
            comments: commentsTrend,
            services: servicesTrend,
          },
          yearlyTrends,
        },
        sessionChart: {
          thisYear: sessionChartThisYear,
          lastYear: sessionChartLastYear,
        },
        recentComments: recentCommentsWithNames,
        todaySessions
      }
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { getTeacherDashboard };

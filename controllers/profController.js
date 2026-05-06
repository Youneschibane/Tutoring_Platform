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

    Seance.aggregate([
  {
    $match: {
      enseignant: longId,
      date_seance: { $gte: startOfToday, $lte: endOfToday }
    }
  },
  {
    $lookup: {
      from:         'services',
      localField:   'service',
      foreignField: '_id',
      as:           'serviceData'
    }
  },
  { $unwind: '$serviceData' },
  {
    $match: {
      'serviceData.isDeleted': false  
    }
  },
  { $sort: { heure_debut: 1 } }
    ]),
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


const getTeacherFullProfile = async (req, res) => {
  try {
    console.log(`Fetching full profile for teacher ID: ${req.params.id}`);
    //afficher le type de id_enseignant
    console.log(`Type of id_enseignant: ${typeof req.params.id}`);

    const teacherId = parseInt(req.params.id);
    

    // 0. Vérification ID
    if (!teacherId) {
      return res.status(400).json({
        status: 'fail',
        message: 'ID enseignant invalide'
      });
    }

    // 1. Récupérer Teacher
    const teacher = await Teacher.findOne({
      id_enseignant: teacherId,
      
    })
      .populate('reviewedBy', 'firstname familyname')
      .select('-__v')
      .lean();

    if (!teacher) {
      return res.status(404).json({
        status: 'fail',
        message: 'Enseignant introuvable'
      });
    }
    console.log(`Teacher data for ID ${teacherId}:`, teacher);
   
    // 2. Récupérer User associé
    const user = await User.findOne({
      idmembre: teacherId,
     
    })
      .select(`
        firstname 
        familyname 
        email 
        numberphone 
        photo_profil 
        createdAt
      `)
      .lean();
      console.log(`User data for teacher ID ${teacherId}:`, user);

    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'Utilisateur associé introuvable'
      });
    }

    // 3. Construire les documents depuis teacher (CV + Diplômes)
    const documents = [];

    // CV
    if (teacher.documents?.cv?.url) {
      documents.push({
        type: 'cv',
        url: teacher.documents.cv.url,
        uploadedAt: teacher.documents.cv.uploadedAt || null
      });
    }

    // Diplômes
    if (teacher.documents?.diplomes?.length > 0) {
      teacher.documents.diplomes.forEach(diplome => {
        documents.push({
          type: 'diplome',
          nom: diplome.nom,
          matiere: diplome.matiere,
          cycle: diplome.cycle,
          url: diplome.url,
          uploadedAt: diplome.uploadedAt
        });
      });
    }

    // 4. Réponse propre
    const pendingDocuments = [];
    if (teacher.pending_diplomes?.length > 0) {
      teacher.pending_diplomes.forEach((pending) => {
        pendingDocuments.push({
          type: 'pending_diplome',
          nom: pending.nom,
          subjects: pending.subjects || (pending.matiere && pending.cycle ? [{ matiere: pending.matiere, cycle: pending.cycle, status: 'pending' }] : []),
          url: pending.url,
          uploadedAt: pending.uploadedAt
        });
      });
    }

    const response = {
      teacher: {
        id: teacher.id_enseignant,
        description: teacher.description_pedagogique,
        modalite: teacher.modalite,
        deplacement: teacher.deplacement,
        rayon: teacher.rayon_deplacement,
        location: teacher.location,
        rating: teacher.rating,
        reviewsCount: teacher.reviewsCount,
        subjects: teacher.subjects,
        accepted: teacher.accepted,
        status: teacher.acceptanceStatus,
        reviewedBy: teacher.reviewedBy
      },

      user: {
        fullname: `${user.firstname} ${user.familyname}`,
        email: user.email,
        phone: user.numberphone,
        photo: user.photo_profil,
        memberSince: user.createdAt
      },

      stats: {
        documentsCount: documents.length,
        pendingDocumentsCount: pendingDocuments.length,
        rating: teacher.rating,
        reviews: teacher.reviewsCount
      },

      documents,
      pendingDocuments
    };

    return res.status(200).json({
      status: 'success',
      data: response
    });

  } catch (error) {
    console.error('getTeacherFullProfile error:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Erreur serveur'
    });
  }
};

module.exports = { getTeacherDashboard , getTeacherFullProfile};

const Teacher = require('../models/teacherModel');
const User = require('../models/userModel');
const Review = require('../models/evaluation');
const Session = require('../models/sessionModel');
const Service = require('../models/serviceModel');
const Document = require('../models/documentModel');
const sendEmail = require('../utils/sendEmail');

const CYCLE_ORDER = ['Primaire', 'College', 'Lycee', 'ESI'];

const normalizeSubjectName = (subject) => (subject || '').trim();

const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

const ALLOWED_SORT_FIELDS = ['rating', 'reviewsCount', 'createdAt', 'firstname', 'familyname'];

const TEACHER_FIELDS = new Set([
  'nature', 'deplacement', 'rayon_deplacement', 'description_pedagogique',
  'parcours_academique', 'experience_professionnelle', 'certifications',
  'actif', 'rating', 'reviewsCount', 'online', 'subjects'
]);

const USER_FIELDS = new Set([
  'firstname', 'familyname', 'email', 'numberphone', 'postaladr'
]);


const buildFieldFilter = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string')  return { $regex: value, $options: 'i' };
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number')  return value;
  if (Array.isArray(value))       return { $in: value };

  if (typeof value === 'object') {
    const filter = {};
    if (value.min  !== undefined) filter.$gte = value.min;
    if (value.max  !== undefined) filter.$lte = value.max;
    if (value.from !== undefined) filter.$gte = new Date(value.from);
    if (value.to   !== undefined) filter.$lte = new Date(value.to);
    if (value.in)  filter.$in  = value.in;
    if (value.nin) filter.$nin = value.nin;
    if (value.ne   !== undefined) filter.$ne = value.ne;
    if (value.exists !== undefined) filter.$exists = value.exists;
    if (value.exact !== undefined) return { $regex: `^${value.exact}$`, $options: 'i' };
    return Object.keys(filter).length ? filter : undefined;
  }

  return value;
};

const validateParams = (body) => {
  const {
    page      = DEFAULT_PAGE,
    limit     = DEFAULT_LIMIT,
    sortBy    = 'createdAt',
    sortOrder = -1,
    ...filters
  } = body;

  return {
    page:      Math.max(1, parseInt(page) || DEFAULT_PAGE),
    limit:     Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT)),
    sortBy:    ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt',
    sortOrder: sortOrder === 1 || sortOrder === '1' ? 1 : -1,
    filters
  };
};


const buildPipeline = ({ teacherQuery, userQuery, sortBy, sortOrder, page, limit }) => {
  const pipeline = [];

  pipeline.push({ $match: teacherQuery });

  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'id_enseignant',
      foreignField: 'idmembre',
      as: 'user'
    }
  });
  pipeline.push({ $unwind: '$user' });

  if (Object.keys(userQuery).length) {
    pipeline.push({ $match: userQuery });
  }

  pipeline.push({ $sort: { [sortBy]: sortOrder } });

  pipeline.push({ $skip: (page - 1) * limit });
  pipeline.push({ $limit: limit });

  pipeline.push({
    $project: {
      _id:                       0,
      id_enseignant:             1,
      nature:                    1,
      rating:                    1,
      reviewsCount:              1,
      online:                    1,
      actif:                     1,
      subjects:                  1,
      deplacement:               1,
      rayon_deplacement:         1,
      description_pedagogique:   1,
      parcours_academique:       1,
      experience_professionnelle:1,
      certifications:            1,
      firstname:   '$user.firstname',
      familyname:  '$user.familyname',
      email:       '$user.email',
      numberphone: '$user.numberphone',
      postaladr:   '$user.postaladr',
      createdAt:   '$user.createdAt',
    }
  });

  return pipeline;
};


const allTeachers = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, parseInt(req.query.limit) || DEFAULT_LIMIT);

    const pipeline = buildPipeline({
      teacherQuery: {},
      userQuery:    {},
      sortBy:       'createdAt',
      sortOrder:    -1,
      page,
      limit
    });

    const countPipeline = [
      ...pipeline.slice(0, -2),
      { $count: 'total' }
    ];

    const [teachers, countResult] = await Promise.all([
      Teacher.aggregate(pipeline),
      Teacher.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total ?? 0;

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: teachers
    });

  } catch (error) {
    console.error('getAllTeachers error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};


const searchTeachers = async (req, res) => {
  try {
    const { page, limit, sortBy, sortOrder, filters } = validateParams(req.body);

    const teacherQuery = {};
    const userQuery    = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;

      // ── Filtre matière : subjects est un tableau d'objets { name, cycle }
      // On utilise $elemMatch pour matcher sur le champ name
      if (key === 'subject') {
        teacherQuery['subjects'] = {
          $elemMatch: { name: { $regex: String(value).trim(), $options: 'i' } }
        };
        continue;
      }

      const built = buildFieldFilter(value);
      if (built === undefined) continue;

      if (TEACHER_FIELDS.has(key)) {
        teacherQuery[key] = built;
      } else if (USER_FIELDS.has(key)) {
        userQuery[`user.${key}`] = built;
      }
    }

    const pipeline = buildPipeline({
      teacherQuery,
      userQuery,
      sortBy,
      sortOrder,
      page,
      limit
    });

    const countPipeline = [
      ...pipeline.slice(0, -2),
      { $count: 'total' }
    ];

    const [teachers, countResult] = await Promise.all([
      Teacher.aggregate(pipeline),
      Teacher.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total ?? 0;

    return res.status(200).json({
      status:     'success',
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      results:    teachers.length,
      data:       teachers
    });

  } catch (error) {
    console.error('searchTeachers error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};



const getTeacherDetails = async (req, res) => {
  try {
    const teacherObjectId = req.params.id; 

    const teacher = await Teacher.findById(teacherObjectId);
    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: 'Enseignant non trouvé.' });
    }

    const user = await User.findOne(
      { idmembre: teacher.id_enseignant },
      'firstname familyname email numberphone postaladr createdAt'
    );

    const [
      seancesAssurees,
      seancesAnnulees,
      seancesReportees,
      totalServices,
      comments,
    ] = await Promise.all([
      Session.countDocuments({ enseignant: teacherObjectId, statut: 'assuree' }),
      Session.countDocuments({ enseignant: teacherObjectId, statut: 'annulee' }),
      Session.countDocuments({ enseignant: teacherObjectId, statut: 'reportee' }),
      Service.countDocuments({ id_enseignant: teacher.id_enseignant, isDeleted: false }),
      Review.find({ id_enseignant: teacher.id_enseignant })
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    return res.status(200).json({
      status: 'success',
      data: {
        teacher: {
          _id:                       teacher._id,
          id_enseignant:             teacher.id_enseignant,
          nature:                    teacher.nature,
          actif:                     teacher.actif,
          accepted:                  teacher.accepted,
          online:                    teacher.online,
          deplacement:               teacher.deplacement,
          rayon_deplacement:         teacher.rayon_deplacement,
          description_pedagogique:   teacher.description_pedagogique,
          certifications:            teacher.certifications,
          subjects:                  teacher.subjects,
          photo_profil:              teacher.photo_profil,
          rating:                    teacher.rating,
          reviewsCount:              teacher.reviewsCount,
          latitude:                  teacher.latitude,
          longitude:                 teacher.longitude,
        },
        user: user || {},
        stats: {
          seancesAssurees,    
          seancesAnnulees,    
          seancesReportees,   
          totalServices,      
          rate: {
            score: teacher.rating,        
            count: teacher.reviewsCount,  
          }
        },
        comments,
      }
    });

  } catch (error) {
    console.error('getTeacherDetails error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};


const mergeSubjectsFromDiplomas = (existingSubjects = [], diplomas = []) => {
  const subjectsMap = new Map();

  const addSubject = (name, cycle) => {
    const trimmedName = normalizeSubjectName(name);
    if (!trimmedName || !cycle) return;

    const key = trimmedName.toLowerCase();
    const current = subjectsMap.get(key);
    const cycleRank = CYCLE_ORDER.indexOf(cycle);

    if (!current) {
      subjectsMap.set(key, { name: trimmedName, cycle });
      return;
    }

    const currentRank = CYCLE_ORDER.indexOf(current.cycle);
    if (cycleRank > currentRank) {
      current.cycle = cycle;
    }
  };

  existingSubjects.forEach((subject) => {
    addSubject(subject.name, subject.cycle);
  });

  diplomas.forEach((diploma) => {
    addSubject(diploma.matiere, diploma.cycle);
  });

  return Array.from(subjectsMap.values());
};

const getPendingTeachers = async (req, res) => {
  try {
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 10;
    const skip = (page - 1) * limit;

    const result = await Teacher.aggregate([
      { $match: { acceptanceStatus: 'pending' } },
      {
        $lookup: {
          from: 'users',
          localField: 'id_enseignant',
          foreignField: 'idmembre',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          id_enseignant: 1,
          acceptanceStatus: 1,
          nature: 1,
          subjects: 1,
          rating: 1,
          createdAt: 1,
          firstname: '$user.firstname',
          familyname: '$user.familyname',
          email: '$user.email',
          numberphone: '$user.numberphone',
          photo_profil: '$user.photo_profil'
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    const total = await Teacher.countDocuments({ acceptanceStatus: 'pending' });

    return res.status(200).json({
      status: 'success',
      total,
      page,
      pages: Math.ceil(total / limit),
      data: result
    });

  } catch (error) {
    console.error('getPendingTeachers error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const getTeacherFullProfile = async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id);

    if (!teacherId) {
      return res.status(400).json({ status: 'fail', message: 'ID enseignant invalide' });
    }

    const teacher = await Teacher.findOne({ id_enseignant: teacherId })
      .populate('reviewedBy', 'firstname familyname')
      .select('-__v')
      .lean();

    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: 'Enseignant introuvable' });
    }

    const user = await User.findOne({ idmembre: teacherId })
      .select('firstname familyname email numberphone photo_profil createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'Utilisateur associé introuvable' });
    }

    const documents = [];

    if (teacher.documents?.cv?.url) {
      documents.push({
        type: 'cv',
        url: teacher.documents.cv.url,
        uploadedAt: teacher.documents.cv.uploadedAt || null
      });
    }

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

    return res.status(200).json({ status: 'success', data: response });

  } catch (error) {
    console.error('getTeacherFullProfile error:', error);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
};

const acceptTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    if (!id) {
      return res.status(400).json({ status: 'fail', message: 'ID enseignant invalide' });
    }

    const teacher = await Teacher.findOne({ id_enseignant: parseInt(id, 10) });
    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: 'Enseignant introuvable' });
    }

    teacher.accepted = true;
    teacher.acceptanceStatus = 'accepted';
    teacher.rejectionReason = null;
    teacher.reviewedAt = new Date();
    teacher.reviewedBy = adminId;

    await teacher.save();

    const user = await User.findOne({ idmembre: parseInt(id, 10) });
    if (user && user.email) {
      (async () => {
        try {
          await sendEmail({
            email: user.email,
            subject: '✅ Votre compte a été approuvé',
            message: `Bonjour ${user.firstname},\n\nFélicitations ! Votre compte de professionnel a été approuvé par notre équipe administrative.\n\nVous pouvez maintenant accéder à toutes les fonctionnalités de la plateforme :\n- Créer et gérer vos services\n- Ajouter des séances de cours\n- Partager des documents avec vos élèves\n- Consulter les demandes de devis\n\nBienvenue sur notre plateforme !\n\nCordialement,\nL'équipe d'administration`
          });
        } catch (emailError) {
          console.error('Email notification failed:', emailError.message);
        }
      })();
    }

    return res.status(200).json({
      status: 'success',
      message: 'Enseignant approuvé avec succès',
      data: teacher
    });
  } catch (error) {
    console.error('acceptTeacher error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const reviewTeacherDiplome = async (req, res) => {
  try {
    const { id, diplome_id } = req.params;
    const { reviews } = req.body;

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Un tableau reviews est requis et doit contenir au moins un sujet.'
      });
    }

    const teacher = await Teacher.findOne({ id_enseignant: parseInt(id, 10) });
    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: 'Enseignant introuvable' });
    }

    const pending = teacher.pending_diplomes.id(diplome_id);
    if (!pending) {
      return res.status(404).json({ status: 'fail', message: 'Diplôme en attente introuvable' });
    }

    const pendingSubjects = Array.isArray(pending.subjects)
      ? pending.subjects
      : pending.matiere && pending.cycle
        ? [{ matiere: pending.matiere, cycle: pending.cycle, status: 'pending' }]
        : [];

    const subjectStatusMap = new Map();
    reviews.forEach((review) => {
      if (!review?.matiere || !review?.status) return;
      subjectStatusMap.set(review.matiere.trim().toLowerCase(), review.status.toLowerCase());
    });

    const acceptedSubjects = [];
    const rejectedSubjects = [];
    const remainingSubjects = [];

    for (const subject of pendingSubjects) {
      const matiereKey = subject.matiere.trim().toLowerCase();
      const status = subjectStatusMap.get(matiereKey);

      if (status === 'accepted') {
        acceptedSubjects.push(subject);
      } else if (status === 'rejected') {
        rejectedSubjects.push(subject);
      } else {
        remainingSubjects.push(subject);
      }
    }

    teacher.documents = teacher.documents || {};
    teacher.documents.diplomes = teacher.documents.diplomes || [];

    const alreadyAccepted = new Set(
      teacher.documents.diplomes.map((d) => `${d.matiere?.trim().toLowerCase()}|${d.cycle}`)
    );

    for (const subject of acceptedSubjects) {
      const subjectKey = `${subject.matiere.trim().toLowerCase()}|${subject.cycle}`;
      if (!alreadyAccepted.has(subjectKey)) {
        teacher.documents.diplomes.push({
          url: pending.url,
          publicId: pending.publicId,
          nom: pending.nom,
          matiere: subject.matiere,
          cycle: subject.cycle,
          uploadedAt: pending.uploadedAt || new Date()
        });
        alreadyAccepted.add(subjectKey);
      }
    }

    teacher.subjects = mergeSubjectsFromDiplomas(teacher.subjects, teacher.documents.diplomes);

    if (remainingSubjects.length === 0) {
      teacher.pending_diplomes.pull(diplome_id);
    } else {
      pending.subjects = remainingSubjects;
    }

    await teacher.save();

    return res.status(200).json({
      status: 'success',
      message: 'Diplôme examiné avec succès.',
      data: {
        acceptedSubjects,
        rejectedSubjects,
        remainingSubjects,
        teacherSubjects: teacher.subjects,
        acceptedDiplomasCount: teacher.documents.diplomes.length
      }
    });
  } catch (error) {
    console.error('reviewTeacherDiplome error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const rejectTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ status: 'fail', message: 'Raison de rejet obligatoire' });
    }

    const teacher = await Teacher.findOneAndUpdate(
      { id_enseignant: parseInt(id) },
      {
        accepted: false,
        acceptanceStatus: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedBy: adminId
      },
      { returnDocument: "after", runValidators: false }
    );

    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: 'Enseignant introuvable' });
    }

    const user = await User.findOne({ idmembre: parseInt(id) });
    if (user && user.email) {
      (async () => {
        try {
          await sendEmail({
            email: user.email,
            subject: '❌ Votre compte n\'a pas été approuvé',
            message: `Bonjour ${user.firstname},\n\nNous regrettons d'vous informer que votre demande d'inscription en tant qu'enseignant n'a pas été approuvée à ce stade.\n\nRaison du rejet :\n${reason}\n\nNous vous encourageons à corriger votre profil et réessayer. Si vous avez des questions, n'hésitez pas à nous contacter.\n\nCordialement,\nL'équipe d'administration`
          });
        } catch (emailError) {
          console.error('Email notification failed:', emailError.message);
        }
      })();
    }

    return res.status(200).json({
      status: 'success',
      message: 'Enseignant rejeté avec succès',
      data: teacher
    });
  } catch (error) {
    console.error('rejectTeacher error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  allTeachers,
  searchTeachers,
  getTeacherDetails,
  getPendingTeachers,
  getTeacherFullProfile,
  acceptTeacher,
  rejectTeacher,
  reviewTeacherDiplome
};
const Service = require('../models/serviceModel');
const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');

// =========================
// CONSTANTS
// =========================
const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 10;

const ALLOWED_SORT_FIELDS = [
  'score', 'rating', 'reviewsCount', 'date_creation'
];

const NIVEAU_MAP = {
  'Primaire': 'Primaire',
  'Collège':  'College',
  'Lycée':    'Lycee',
  'ESI':      'ESI'
};

// =========================
// UTILS
// =========================
const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// =========================
// RESOLVERS (Same as yours)
// =========================
const resolveTeacherIdsByName = async (query) => {
  if (!query) return null;

  const safe  = escapeRegex(query);
  const regex = new RegExp(safe, 'i');

  const users = await User.find({
    role: 'teacher',
    $or: [
      { firstname:  regex },
      { familyname: regex },
      {
        $expr: {
          $regexMatch: {
            input:   { $concat: ['$firstname', ' ', '$familyname'] },
            regex:   safe,
            options: 'i'
          }
        }
      },
      {
        $expr: {
          $regexMatch: {
            input:   { $concat: ['$familyname', ' ', '$firstname'] },
            regex:   safe,
            options: 'i'
          }
        }
      }
    ]
  }).select('idmembre').lean();

  return users.map(u => u.idmembre);
};

const resolveTeacherIdsByGeo = async ({ lat, lng, radius, city }) => {
  if (lat && lng && radius) {
    const teachers = await Teacher.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: Number(radius)
        }
      }
    }).select('id_enseignant').lean();

    return teachers.map(t => t.id_enseignant);
  }

  if (city) {
    const teachers = await Teacher.find({
      ville: { $regex: escapeRegex(city), $options: 'i' }
    }).select('id_enseignant').lean();

    return teachers.map(t => t.id_enseignant);
  }

  return null;
};

// =========================
// FILTER BUILDER (Same as yours)
// =========================
const buildFilter = ({
  safeQuery,
  statut,
  niveauSchema,
  annee_concerne,
  matiere,
  type_service,
  modalite_service,
  prix,
  teacherNameIds,
  geoTeacherIds,
}) => {
  const filter = {
    isDeleted:               false,
    suspendu:                false,
    'archivedMeta.isArchived': false,
  };

  if (statut === 'actif')    filter.actif = true;
  if (statut === 'inactive') filter.actif = false;

  if (safeQuery) {
    const orClauses = [
      { nom_service: { $regex: safeQuery, $options: 'i' } },
      { description: { $regex: safeQuery, $options: 'i' } },
      { matiere:     { $regex: safeQuery, $options: 'i' } },
    ];
    if (teacherNameIds && teacherNameIds.length) {
      orClauses.push({ id_enseignant: { $in: teacherNameIds } });
    }
    filter.$or = orClauses;
  }

  if (geoTeacherIds !== null) {
    if (filter.$or) {
      filter.$and = [
        { $or: filter.$or },
        { id_enseignant: { $in: geoTeacherIds } }
      ];
      delete filter.$or;
    } else {
      filter.id_enseignant = { $in: geoTeacherIds };
    }
  }

  if (niveauSchema) filter.niveau_concerne = niveauSchema;
  if (annee_concerne) filter.annee_concerne = { $regex: escapeRegex(annee_concerne), $options: 'i' };
  if (matiere) filter.matiere = { $regex: escapeRegex(matiere), $options: 'i' };
  if (type_service) filter.type_service = type_service;
  // if (modalite_service) filter.modalite_service = modalite_service; // Uncomment if added to Service schema

  if (prix && typeof prix === 'object') {
    const prixFilter = {};
    if (prix.min !== undefined && !isNaN(Number(prix.min))) prixFilter.$gte = Number(prix.min);
    if (prix.max !== undefined && !isNaN(Number(prix.max))) prixFilter.$lte = Number(prix.max);
    if (Object.keys(prixFilter).length) filter.prix = prixFilter;
  }

  return filter;
};

// =========================
// PIPELINE BUILDER (Modified to Group by Teacher)
// =========================
const buildPipeline = ({ filter, safeQuery, finalSort, finalOrder, pageNum, limitNum, rating }) => {
  const pipeline = [];

  // 1. Filter Services based on frontend queries
  pipeline.push({ $match: filter });

  // 2. GROUP BY id_enseignant to get Unique Teachers offering these services
  pipeline.push({
    $group: {
      _id: '$id_enseignant'
    }
  });

  // 3. Join the unique Teachers
  pipeline.push({
    $lookup: {
      from:         'teachers',
      localField:   '_id',
      foreignField: 'id_enseignant',
      as:           'teacher'
    }
  });
  pipeline.push({ $unwind: { path: '$teacher', preserveNullAndEmptyArrays: false } });

  // 4. Ensure Teacher is globally active & accepted
  pipeline.push({
    $match: {
      'teacher.acceptanceStatus': 'accepted',
      'teacher.actif': true
    }
  });

  // 5. Join the User data (Names, Emails, Photos)
  pipeline.push({
    $lookup: {
      from:         'users',
      localField:   '_id',
      foreignField: 'idmembre',
      as:           'user'
    }
  });
  pipeline.push({ $unwind: { path: '$user', preserveNullAndEmptyArrays: false } });

  // 6. Apply Minimum Rating filter if provided
  if (rating && rating.min !== undefined && !isNaN(Number(rating.min))) {
    pipeline.push({
      $match: { 'teacher.rating': { $gte: Number(rating.min) } }
    });
  }

  // 7. Calculate Teacher Relevance Score
  pipeline.push({
    $addFields: {
      score: {
        $add: [
          ...(safeQuery ? [
            {
              $cond: [
                {
                  $or: [
                    { $regexMatch: { input: { $ifNull: ['$user.firstname',  ''] }, regex: safeQuery, options: 'i' } },
                    { $regexMatch: { input: { $ifNull: ['$user.familyname', ''] }, regex: safeQuery, options: 'i' } }
                  ]
                },
                5, 0 // Bonus points if the text search matches the teacher's name
              ]
            }
          ] : []),
          { $multiply: [{ $ifNull: ['$teacher.rating',       0] }, 2]   },
          { $multiply: [{ $ifNull: ['$teacher.reviewsCount', 0] }, 0.2] },
          { $cond: [{ $eq: ['$teacher.online', true] }, 5, 0] }
        ]
      }
    }
  });

  // 8. Sorting
  pipeline.push({ $sort: { [finalSort]: finalOrder } });

  // 9. Pagination & Formatting explicitly for the TeacherCard
  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [
        { $skip:  (pageNum - 1) * limitNum },
        { $limit: limitNum },
        {
          $project: {
            _id:                     0,
            id_enseignant:           '$_id', // the grouped ID
            firstname:               '$user.firstname',
            familyname:              '$user.familyname',
            email:                   '$user.email',
            photo_profil:            '$user.photo_profil',
            rating:                  '$teacher.rating',
            reviewsCount:            '$teacher.reviewsCount',
            subjects:                '$teacher.subjects',
            nature:                  '$teacher.nature',
            online:                  '$teacher.online',
            description_pedagogique: '$teacher.description_pedagogique',
            deplacement:             '$teacher.deplacement',
            rayon_deplacement:       '$teacher.rayon_deplacement',
            modalite:                '$teacher.modalite',
            score:                   1
          }
        }
      ]
    }
  });

  return pipeline;
};

// =========================
// MAIN CONTROLLER
// =========================
// =========================
// MAIN CONTROLLER
// =========================
const searchTeacherPro = async (req, res) => {
  try {
    const {
      q = '',
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
      sortBy = 'score',
      sortOrder = -1,
      statut = 'actif',
      
      // --- Updated Destructuring with Fallbacks ---
      niveau_concerne,
      niveau,          // fallback
      annee_concerne,
      annee,           // fallback
      matiere,
      type_service,
      modalite_service,
      prix,
      rating,
      lat,
      lng,
      radius,
      city,
    } = req.body;

    // --- FIX: Resolve fields ---
    const resolvedNiveau = niveau_concerne || niveau;
    const resolvedAnnee  = annee_concerne || annee;

    const query     = typeof q === 'string' ? q.trim() : '';
    const safeQuery = query ? escapeRegex(query) : '';

    const pageNum  = Math.max(1, parseInt(page)  || DEFAULT_PAGE);
    const limitNum = Math.min(50, parseInt(limit) || DEFAULT_LIMIT);

    const resolvedSortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'score';
    const finalSort      = !query && resolvedSortBy === 'score' ? 'rating' : resolvedSortBy;
    const finalOrder     = sortOrder === 1 || sortOrder === '1' ? 1 : -1;

    // --- Apply resolved variables ---
    const niveauSchema = resolvedNiveau ? (NIVEAU_MAP[resolvedNiveau] ?? null) : null;

    const [teacherNameIds, geoTeacherIds] = await Promise.all([
      resolveTeacherIdsByName(query),
      resolveTeacherIdsByGeo({ lat, lng, radius, city })
    ]);

    const filter = buildFilter({
      safeQuery,
      statut,
      niveauSchema,
      annee_concerne: resolvedAnnee, // Passed the resolved year here
      matiere,
      type_service,
      modalite_service,
      prix,
      teacherNameIds,
      geoTeacherIds,
    });

    const pipeline = buildPipeline({
      filter, safeQuery, finalSort, finalOrder,
      pageNum, limitNum,
      rating
    });

    const result = await Service.aggregate(pipeline);
    const total  = result[0]?.metadata[0]?.total || 0;
    const data   = result[0]?.data || [];

    return res.status(200).json({
      status:     'success',
      query,
      page:       pageNum,
      limit:      limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      results:    data.length,
      data
    });

  } catch (error) {
    console.error('searchTeacherPro error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { searchTeacherPro };
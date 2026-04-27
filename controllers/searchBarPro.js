const Service = require('../models/serviceModel');
const User    = require('../models/userModel');

// =========================
// CONSTANTS
// =========================
const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 10;

const ALLOWED_SORT_FIELDS = [
  'score', 'prix', 'rating', 'reviewsCount', 'date_creation'
];

const SERVICE_FIELDS = new Set([
  'type_service', 'niveau_concerne', 'annee_concerne',
  'modalite_service', 'actif'
]);

// =========================
// FIELD FILTER BUILDER
// =========================
const buildFieldFilter = (value) => {
  if (value === undefined || value === null || value === '') return undefined;

  if (typeof value === 'string')  return { $regex: value, $options: 'i' };
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number')  return value;

  if (typeof value === 'object') {
    const f = {};
    if (value.min  !== undefined) f.$gte = value.min;
    if (value.max  !== undefined) f.$lte = value.max;
    if (value.in)                 f.$in  = value.in;
    if (value.nin)                f.$nin = value.nin;
    if (value.exact) return { $regex: `^${value.exact}$`, $options: 'i' };
    return Object.keys(f).length ? f : undefined;
  }

  return value;
};

// =========================
// TEACHER ID RESOLVER
// =========================
const resolveTeacherIds = async (query) => {
  const regex = new RegExp(query, 'i');

  const users = await User.find({
    role: 'teacher',
    $or: [
      { firstname:  regex },
      { familyname: regex },
      {
        $expr: {
          $regexMatch: {
            input:   { $concat: ['$firstname', ' ', '$familyname'] },
            regex:   query,
            options: 'i'
          }
        }
      },
      {
        $expr: {
          $regexMatch: {
            input:   { $concat: ['$familyname', ' ', '$firstname'] },
            regex:   query,
            options: 'i'
          }
        }
      }
    ]
  }).select('idmembre').lean();

  return users.map(u => u.idmembre);
};

// =========================
// BASE FILTER BUILDER
// =========================
const buildBaseFilter = ({
  query, statut, matiere, prixMin,
  prixMax, type_service, niveau,
  teacherIds, ...extraFilters
}) => {
  const filter = {
    isDeleted: false,
    $and: [
      {
        $or: [
          { suspendu: false },
          { suspendu: { $exists: false } }
        ]
      }
    ]
  };

  if (statut === 'actif')    filter.actif = true;
  if (statut === 'inactive') filter.actif = false;

  filter.$or = [
    { nom_service: { $regex: query, $options: 'i' } },
    { description: { $regex: query, $options: 'i' } },
    { matiere:     { $regex: query, $options: 'i' } },
    ...(teacherIds.length ? [{ id_enseignant: { $in: teacherIds } }] : [])
  ];

  if (matiere)      filter.matiere          = { $regex: matiere, $options: 'i' };
  if (type_service) filter.type_service     = type_service;
  if (niveau)       filter.niveau_concerne  = niveau;

  if (prixMin || prixMax) {
    filter.prix = {};
    if (prixMin) filter.prix.$gte = Number(prixMin);
    if (prixMax) filter.prix.$lte = Number(prixMax);
  }

  for (const [key, value] of Object.entries(extraFilters)) {
    if (!SERVICE_FIELDS.has(key)) continue;
    const parsed = buildFieldFilter(value);
    if (parsed !== undefined) filter[key] = parsed;
  }

  return filter;
};

// =========================
// PIPELINE BUILDER
// =========================
const buildPipeline = ({ filter, query, finalSort, finalOrder, pageNum, limitNum }) => {
  const pipeline = [];

  pipeline.push({ $match: filter });

  // Join Teacher
  pipeline.push({
    $lookup: {
      from:         'teachers',
      localField:   'id_enseignant',
      foreignField: 'id_enseignant',
      as:           'teacher'
    }
  });
  pipeline.push({ $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } });

  // Join User
  pipeline.push({
    $lookup: {
      from:         'users',
      localField:   'teacher.id_enseignant',
      foreignField: 'idmembre',
      as:           'user'
    }
  });
  pipeline.push({ $unwind: { path: '$user', preserveNullAndEmptyArrays: true } });

  // Relevance score
  pipeline.push({
    $addFields: {
      score: {
        $add: [
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$nom_service', ''] }, regex: query, options: 'i' } }, 5, 0] },
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$matiere',     ''] }, regex: query, options: 'i' } }, 3, 0] },
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$description', ''] }, regex: query, options: 'i' } }, 2, 0] },
          {
            $cond: [
              {
                $or: [
                  { $regexMatch: { input: { $ifNull: ['$user.firstname',  ''] }, regex: query, options: 'i' } },
                  { $regexMatch: { input: { $ifNull: ['$user.familyname', ''] }, regex: query, options: 'i' } }
                ]
              },
              1, 0
            ]
          },
          { $multiply: [{ $ifNull: ['$teacher.rating',       0] }, 1]   },
          { $multiply: [{ $ifNull: ['$teacher.reviewsCount', 0] }, 0.1] }
        ]
      }
    }
  });

  pipeline.push({ $sort: { [finalSort]: finalOrder, date_creation: -1 } });

  // $facet — count + data en une seule query
  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [
        { $skip:  (pageNum - 1) * limitNum },
        { $limit: limitNum },
        {
          $project: {
            _id:                     0,
            id_service:              1,
            id_enseignant:           1,
            nom_service:             1,
            matiere:                 1,
            niveau_concerne:         1,
            annee_concerne:          1,
            type_service:            1,
            prix:                    1,
            duree_seance:            1,
            description:             1,
            nombre_max_participants: 1,
            actif:                   1,
            date_creation:           1,
            score:                   1,
            rating:                  '$teacher.rating',
            reviewsCount:            '$teacher.reviewsCount',
            photo_profil:            '$teacher.photo_profil',
            nature:                  '$teacher.nature',
            deplacement:             '$teacher.deplacement',
            description_pedagogique: '$teacher.description_pedagogique',
            teacher_firstname:       '$user.firstname',
            teacher_familyname:      '$user.familyname'
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
const searchBarPro = async (req, res) => {
  try {
    const {
      q            = '',
      page         = DEFAULT_PAGE,
      limit        = DEFAULT_LIMIT,
      statut       = 'actif',
      sortBy       = 'score',
      sortOrder    = -1,
      matiere,
      prixMin,
      prixMax,
      type_service,
      niveau,
      ...extraFilters
    } = req.body;

    const query      = q.trim();
    const pageNum    = Math.max(1, parseInt(page)  || DEFAULT_PAGE);
    const limitNum   = Math.min(50, parseInt(limit) || DEFAULT_LIMIT);
    const finalSort  = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'score';
    const finalOrder = sortOrder === 1 || sortOrder === '1' ? 1 : -1;

    

    const teacherIds = await resolveTeacherIds(query);

    const filter = buildBaseFilter({
      query, statut, matiere, prixMin, prixMax,
      type_service, niveau, teacherIds, ...extraFilters
    });

    const pipeline = buildPipeline({
      filter, query, finalSort, finalOrder, pageNum, limitNum
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
    console.error('searchBarPro error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { searchBarPro };
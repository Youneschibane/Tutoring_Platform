const Teacher = require('../models/teacherModel');
const User    = require('../models/userModel');
const axios   = require('axios');

// =========================
// CONSTANTS
// =========================
const DEFAULT_RADIUS = 10000;
const DEFAULT_PAGE   = 1;
const DEFAULT_LIMIT  = 20;
const EARTH_RADIUS   = 6378137;

const ALLOWED_SORT_FIELDS = ['score', 'rating', 'reviewsCount', 'date_creation'];

const TEACHER_FIELDS = new Set([
  'nature', 'deplacement', 'rayon_deplacement',
  'description_pedagogique', 'actif', 'rating',
  'reviewsCount', 'online', 'modalite'
]);

const USER_FIELDS    = new Set(['firstname', 'familyname', 'email', 'numberphone', 'postaladr']);
const SUBJECT_FIELDS = new Set(['subjects']);

// =========================
// CITY → GEO
// =========================
const getCoordinatesFromCity = async (city) => {
  try {
    const res = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params:  { q: city, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'teacher-search-api' },
        timeout: 5000
      }
    );

    if (!res.data?.length) throw new Error("Ville introuvable.");

    return [parseFloat(res.data[0].lon), parseFloat(res.data[0].lat)];
  } catch (err) {
    throw new Error("Erreur de géolocalisation : " + err.message);
  }
};

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
// QUERY BUILDER
// =========================
const buildQuery = (filters) => {
  const teacherQuery = {};
  const userQuery    = {};

  for (const [key, value] of Object.entries(filters)) {
    const parsed = buildFieldFilter(value);
    if (!parsed) continue;

    if (TEACHER_FIELDS.has(key)) teacherQuery[`teacher.${key}`]        = parsed;
    if (USER_FIELDS.has(key))    userQuery[`user.${key}`]              = parsed;
    if (SUBJECT_FIELDS.has(key)) teacherQuery['teacher.subjects.name'] = parsed;
  }

  return { teacherQuery, userQuery };
};

// =========================
// PIPELINE BUILDER
// =========================
const buildPipeline = ({
  baseMatch, userQuery, teacherQuery,
  center, radius, finalSort, finalOrder,
  pageNum, limitNum
}) => {
  const pipeline = [];

  pipeline.push({ $match: baseMatch });

  // Join User
  pipeline.push({
    $lookup: {
      from:         'users',
      localField:   'id_enseignant',
      foreignField: 'idmembre',
      as:           'user'
    }
  });
  pipeline.push({ $unwind: '$user' });

  if (Object.keys(userQuery).length) {
    pipeline.push({ $match: userQuery });
  }

  // Geo filter
  if (center) {
    pipeline.push({
      $match: {
        location: {
          $geoWithin: {
            $centerSphere: [center, radius / EARTH_RADIUS]
          }
        }
      }
    });
  }

  if (Object.keys(teacherQuery).length) {
    pipeline.push({ $match: teacherQuery });
  }

  // Score
  pipeline.push({
    $addFields: {
      score: {
        $add: [
          { $multiply: [{ $ifNull: ['$rating',       0] }, 2]   },
          { $multiply: [{ $ifNull: ['$reviewsCount', 0] }, 0.2] },
          { $cond:     [{ $ifNull: ['$online', false] }, 5, 0]  }
        ]
      }
    }
  });

  pipeline.push({ $sort: { [finalSort]: finalOrder } });

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
            id_enseignant:           1,
            nature:                  1,
            rating:                  1,
            reviewsCount:            1,
            online:                  1,
            subjects:                1,
            description_pedagogique: 1,
            deplacement:             1,
            rayon_deplacement:       1,
            photo_profil:            1,
            score:                   1,
            firstname:  '$user.firstname',
            familyname: '$user.familyname',
            email:      '$user.email'
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
const searchTeacherPro = async (req, res) => {
  try {
    const {
      q,
      city,
      lat,
      lng,
      radius    = DEFAULT_RADIUS,
      page      = DEFAULT_PAGE,
      limit     = DEFAULT_LIMIT,
      sortBy    = 'score',
      sortOrder = -1,
      ...filters
    } = req.body;

    const pageNum    = Math.max(1, parseInt(page)  || DEFAULT_PAGE);
    const limitNum   = Math.min(50, parseInt(limit) || DEFAULT_LIMIT);
    const finalSort  = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'score';
    const finalOrder = sortOrder === 1 || sortOrder === '1' ? 1 : -1;

    // Geo
    let center = null;
    if (city) {
      center = await getCoordinatesFromCity(city);
    } else if (lat && lng) {
      center = [parseFloat(lng), parseFloat(lat)];
    }

    // Base match
    const baseMatch = { acceptanceStatus: 'accepted', actif: true };

    if (q?.trim()) {
      baseMatch.$or = [
        { 'subjects.name':         { $regex: q, $options: 'i' } },
        { description_pedagogique: { $regex: q, $options: 'i' } },
        { nature:                  { $regex: q, $options: 'i' } }
      ];
    }

    const { teacherQuery, userQuery } = buildQuery(filters);

    const pipeline = buildPipeline({
      baseMatch, userQuery, teacherQuery,
      center, radius: Number(radius),
      finalSort, finalOrder, pageNum, limitNum
    });

    const result = await Teacher.aggregate(pipeline);
    const total  = result[0]?.metadata[0]?.total || 0;
    const data   = result[0]?.data || [];

    return res.status(200).json({
      status:     'success',
      page:       pageNum,
      limit:      limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      results:    data.length,
      data
    });

  } catch (err) {
    console.error('searchTeacherPro error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = { searchTeacherPro };
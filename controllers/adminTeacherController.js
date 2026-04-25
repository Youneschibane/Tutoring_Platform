const Teacher = require('../models/teacherModel');
const User = require('../models/userModel');


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

module.exports = { allTeachers, searchTeachers };


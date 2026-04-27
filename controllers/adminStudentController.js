const Student = require('../models/studentModel');
const User    = require('../models/userModel');

const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

const ALLOWED_SORT_FIELDS = ['createdAt', 'firstname', 'familyname', 'niveau_scolaire'];

const STUDENT_FIELDS = new Set([
  'niveau_scolaire', 'annee_scolaire', 'actif', 'wilaya', 'commune'
]);

const USER_FIELDS = new Set([
  'firstname', 'familyname', 'email', 'numberphone', 'postaladr'
]);

const EXACT_MATCH_FIELDS = new Set(['annee_scolaire', 'niveau_scolaire']);

const ANNEE_SCOLAIRE_OPTIONS = {
  primaire: ['1AP', '2AP', '3AP', '4AP', '5AP'],
  college:  ['1AM', '2AM', '3AM', '4AM'],
  lycee:    ['1AS', '1L', '2ASS', '2ASM', '2ASTM', '2ASGE', '2SLP', '2SLE',
             '3ASS', '3ASM', '3ASTM', '3ASGE', '3SLP', '3SLE'],
  esi:      ['1CP', '2CP', '1CS', '2CS-SIQ', '2CS-SID', '2CS-SIL', '2CS-SIT']
};

const VALID_ANNEE_SCOLAIRE = new Set(
  Object.values(ANNEE_SCOLAIRE_OPTIONS).flat()
);


const validateAnneeScolaire = (value) => {
  const values = Array.isArray(value) ? value : [value];
  const invalid = values.filter(v => !VALID_ANNEE_SCOLAIRE.has(v));
  if (invalid.length) {
    return `Invalid annee_scolaire value(s): ${invalid.join(', ')}. ` +
           `Allowed values: ${[...VALID_ANNEE_SCOLAIRE].join(', ')}`;
  }
  return null;
};

const buildFieldFilter = (value, exactMatch = false) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string')
    return exactMatch
      ? { $regex: `^${value}$`, $options: 'i' }
      : { $regex: value,        $options: 'i' };
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number')  return value;
  if (Array.isArray(value))       return { $in: value };
  if (typeof value === 'object') {
    const filter = {};
    if (value.min     !== undefined) filter.$gte    = value.min;
    if (value.max     !== undefined) filter.$lte    = value.max;
    if (value.from    !== undefined) filter.$gte    = new Date(value.from);
    if (value.to      !== undefined) filter.$lte    = new Date(value.to);
    if (value.in)                    filter.$in     = value.in;
    if (value.nin)                   filter.$nin    = value.nin;
    if (value.ne      !== undefined) filter.$ne     = value.ne;
    if (value.exists  !== undefined) filter.$exists = value.exists;
    if (value.exact   !== undefined) return { $regex: `^${value.exact}$`, $options: 'i' };
    return Object.keys(filter).length ? filter : undefined;
  }
  return value;
};

const validateParams = (body) => {
  const {
    page  = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
    sortBy    = 'createdAt',
    sortOrder = -1,
    ...filters
  } = body;
  return {
    page:      Math.max(1, parseInt(page)  || DEFAULT_PAGE),
    limit:     Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT)),
    sortBy:    ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt',
    sortOrder: sortOrder === 1 || sortOrder === '1' ? 1 : -1,
    filters
  };
};


const buildPipeline = ({ studentQuery, userQuery, sortBy, sortOrder, page, limit }) => {
  const pipeline = [];
  pipeline.push({ $match: studentQuery });
  pipeline.push({
    $lookup: {
      from: 'users', localField: 'id_eleve',
      foreignField: 'idmembre', as: 'user'
    }
  });
  pipeline.push({ $unwind: '$user' });
  if (Object.keys(userQuery).length) pipeline.push({ $match: userQuery });
  pipeline.push({ $sort:  { [sortBy]: sortOrder } });
  pipeline.push({ $skip:  (page - 1) * limit });
  pipeline.push({ $limit: limit });
  pipeline.push({
    $project: {
      _id: 0, id_eleve: 1, niveau_scolaire: 1, annee_scolaire: 1,
      actif: 1, wilaya: 1, commune: 1, objectifs_pedagogiques: 1,
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

const getAnneesByCycle = (req, res) => {
  const key = req.params.cycle.toLowerCase();

  if (!ANNEE_SCOLAIRE_OPTIONS[key]) {
    return res.status(400).json({
      status:  'error',
      message: `Invalid cycle "${key}". Allowed: ${Object.keys(ANNEE_SCOLAIRE_OPTIONS).join(', ')}`
    });
  }

  return res.status(200).json({
    status: 'success',
    cycle:  key,
    data:   ANNEE_SCOLAIRE_OPTIONS[key]
  });
};

const getAllStudents = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, parseInt(req.query.limit) || DEFAULT_LIMIT);

    const pipeline      = buildPipeline({ studentQuery: {}, userQuery: {}, sortBy: 'createdAt', sortOrder: -1, page, limit });
    const countPipeline = [...pipeline.slice(0, -2), { $count: 'total' }];

    const [students, countResult] = await Promise.all([
      Student.aggregate(pipeline),
      Student.aggregate(countPipeline)
    ]);

    return res.status(200).json({
      status: 'success', page, limit,
      total:      countResult[0]?.total ?? 0,
      totalPages: Math.ceil((countResult[0]?.total ?? 0) / limit),
      data:       students
    });
  } catch (error) {
    console.error('getAllStudents error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const searchStudents = async (req, res) => {
  try {
    const { page, limit, sortBy, sortOrder, filters } = validateParams(req.body);

    if (filters.annee_scolaire) {
      const error = validateAnneeScolaire(filters.annee_scolaire);
      if (error) return res.status(400).json({ status: 'error', message: error });
    }

    const studentQuery = {};
    const userQuery    = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      const built = buildFieldFilter(value, EXACT_MATCH_FIELDS.has(key));
      if (built === undefined) continue;
      if      (STUDENT_FIELDS.has(key)) studentQuery[key]        = built;
      else if (USER_FIELDS.has(key))    userQuery[`user.${key}`] = built;
    }

    const pipeline      = buildPipeline({ studentQuery, userQuery, sortBy, sortOrder, page, limit });
    const countPipeline = [...pipeline.slice(0, -2), { $count: 'total' }];

    const [students, countResult] = await Promise.all([
      Student.aggregate(pipeline),
      Student.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total ?? 0;
    return res.status(200).json({
      status: 'success', page, limit, total,
      totalPages: Math.ceil(total / limit),
      results:    students.length,
      data:       students
    });
  } catch (error) {
    console.error('searchStudents error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { getAllStudents, searchStudents, getCycles, getAnneesByCycle };
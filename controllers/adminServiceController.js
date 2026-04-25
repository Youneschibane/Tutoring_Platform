const Service = require('../models/serviceModel');
const Teacher = require('../models/teacherModel');
const User = require('../models/userModel');
const axios = require('axios');
const Education = require('../models/educationModel'); 


const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;
const EARTH_RADIUS  = 6378137;

const ALLOWED_SORT_FIELDS = ['prix', 'rating', 'duree_seance', 'date_creation', 'reviewsCount', 'score'];

const SERVICE_FIELDS = new Set([
  'nom_service', 'type_service', 'matiere', 'niveau_concerne',
  'nombre_max_participants', 'prix', 'duree_seance',
  'description', 'actif', 'modalite_service', 'date_creation'
]);

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
    if (value.ne   !== undefined) filter.$ne  = value.ne;
    if (value.exists !== undefined) filter.$exists = value.exists;
    if (value.exact  !== undefined) return { $regex: `^${value.exact}$`, $options: 'i' };
    return Object.keys(filter).length ? filter : undefined;
  }
  return value;
};

const validateParams = (body) => {
  const {
    page = DEFAULT_PAGE, limit = DEFAULT_LIMIT,
    sortBy = 'date_creation', sortOrder = -1,
    city, lat, lng, radius = 10000,
    ...filters
  } = body;
  return {
    page:      Math.max(1, parseInt(page) || DEFAULT_PAGE),
    limit:     Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT)),
    sortBy:    ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'date_creation',
    sortOrder: sortOrder === 1 || sortOrder === '1' ? 1 : -1,
    city, lat: lat ? parseFloat(lat) : null,
    lng: lng ? parseFloat(lng) : null,
    radius: Math.max(1000, parseFloat(radius) || 10000),
    filters
  };
};

const getCoordinatesFromCity = async (city) => {
  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: city, format: 'json', limit: 1 },
    headers: { 'User-Agent': 'tutor-app' },
    timeout: 5000
  });
  if (!response.data?.length) throw new Error('Ville invalide ou introuvable');
  return [parseFloat(response.data[0].lon), parseFloat(response.data[0].lat)];
};

const buildPipeline = ({ serviceQuery, teacherQuery, userQuery, center, radius, sortBy, sortOrder, page, limit }) => {
  const pipeline = [];

  pipeline.push({ $match: serviceQuery });

  pipeline.push({
    $lookup: { from: 'teachers', localField: 'id_enseignant', foreignField: 'id_enseignant', as: 'teacher' }
  });
  pipeline.push({ $unwind: '$teacher' });

  if (center) {
    pipeline.push({
      $match: {
        'teacher.location': {
          $geoWithin: { $centerSphere: [center, radius / EARTH_RADIUS] }
        }
      }
    });
  }

  if (Object.keys(teacherQuery).length) pipeline.push({ $match: teacherQuery });

  pipeline.push({
    $lookup: { from: 'users', localField: 'teacher.id_enseignant', foreignField: 'idmembre', as: 'user' }
  });
  pipeline.push({ $unwind: '$user' });

  if (Object.keys(userQuery).length) pipeline.push({ $match: userQuery });

  pipeline.push({
    $addFields: {
      score: {
        $add: [
          { $multiply: [{ $ifNull: ['$teacher.rating', 0] }, 2] },
          { $multiply: [{ $ifNull: ['$teacher.reviewsCount', 0] }, 0.1] },
          { $multiply: [{ $ifNull: ['$prix', 0] }, -0.01] }
        ]
      }
    }
  });

  pipeline.push({ $sort: { [sortBy]: sortOrder } });
  pipeline.push({ $skip: (page - 1) * limit });
  pipeline.push({ $limit: limit });

  pipeline.push({
    $project: {
      _id: 0,
      id_service: 1, nom_service: 1, type_service: 1,
      matiere: 1, niveau_concerne: 1, nombre_max_participants: 1,
      prix: 1, duree_seance: 1, description: 1,
      modalite_service: 1, date_creation: 1, actif: 1, score: 1,
      id_enseignant:             '$teacher.id_enseignant',
      nature:                    '$teacher.nature',
      rating:                    '$teacher.rating',
      reviewsCount:              '$teacher.reviewsCount',
      online:                    '$teacher.online',
      subjects:                  '$teacher.subjects',
      firstname:                 '$user.firstname',
      familyname:                '$user.familyname',
      email:                     '$user.email',
      numberphone:               '$user.numberphone',
    }
  });

  return pipeline;
};


const getAllServices = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, parseInt(req.query.limit) || DEFAULT_LIMIT);

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const pipeline = buildPipeline({
      serviceQuery: {}, teacherQuery: {}, userQuery: {},
      center: null, radius: 10000,
      sortBy: 'date_creation', sortOrder: -1,
      page, limit
    });

    const countPipeline = [...pipeline.slice(0, -2), { $count: 'total' }];

    const [services, countResult, totalServices, activeServices, suspendedServices, deletedThisMonth] = 
      await Promise.all([
        Service.aggregate(pipeline),
        Service.aggregate(countPipeline),
        Service.countDocuments({}),                                                      // total
        Service.countDocuments({ actif: true,  isDeleted: false }),                      // actifs
        Service.countDocuments({ actif: false, isDeleted: false }),                      // suspendus
        Service.countDocuments({ isDeleted: true, date_creation: { $gte: startOfCurrentMonth } }) // supprimés ce mois
      ]);

    return res.status(200).json({
      status: 'success',
      page, limit,
      total: countResult[0]?.total ?? 0,
      totalPages: Math.ceil((countResult[0]?.total ?? 0) / limit),
      stats: {
        totalServices,
        activeServices,
        suspendedServices,
        deletedThisMonth
      },
      data: services
    });

  } catch (error) {
    console.error('getAllServices error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const searchServices = async (req, res) => {
  try {
    const { page, limit, sortBy, sortOrder, city, lat, lng, radius, filters } = validateParams(req.body);

    let center = null;
    if (city)       center = await getCoordinatesFromCity(city);
    else if (lat && lng) center = [lng, lat];

    const serviceQuery = {};
    const teacherQuery = {};
    const userQuery    = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      const built = buildFieldFilter(value);
      if (built === undefined) continue;
      if (SERVICE_FIELDS.has(key))  serviceQuery[key]             = built;
      else if (TEACHER_FIELDS.has(key)) teacherQuery[`teacher.${key}`] = built;
      else if (USER_FIELDS.has(key))    userQuery[`user.${key}`]       = built;
    }

    const pipeline = buildPipeline({
      serviceQuery, teacherQuery, userQuery,
      center, radius, sortBy, sortOrder, page, limit
    });

    const countPipeline = [...pipeline.slice(0, -2), { $count: 'total' }];

    const [services, countResult] = await Promise.all([
      Service.aggregate(pipeline),
      Service.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total ?? 0;

    return res.status(200).json({
      status: 'success',
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      results: services.length,
      data: services
    });

  } catch (error) {
    console.error('searchServices error:', error);
    const statusCode = error.message.includes('géolocalisation') || error.message.includes('Ville') ? 400 : 500;
    return res.status(statusCode).json({ status: 'error', message: error.message });
  }
};


const getAllSubjects = async (req, res) => {
  try {
    const levels = await Education.find().sort({ cycle: 1, level: 1 });

    const allSubjectsSet = new Set();
    levels.forEach(l => l.subjects.forEach(s => allSubjectsSet.add(s)));

    const groupedByCycle = {};
    levels.forEach(doc => {
      if (!groupedByCycle[doc.cycle]) {
        groupedByCycle[doc.cycle] = new Set();
      }
      doc.subjects.forEach(s => groupedByCycle[doc.cycle].add(s));
    });

    const byCycle = {};
    for (const [cycle, set] of Object.entries(groupedByCycle)) {
      byCycle[cycle] = [...set].sort();
    }

    return res.status(200).json({
      status: 'success',
      allSubjects: [...allSubjectsSet].sort(),
      byCycle
    });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = { getAllServices, searchServices , getAllSubjects };

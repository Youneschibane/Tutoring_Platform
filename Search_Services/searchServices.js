const Service = require("../models/serviceModel");
const Teacher = require("../models/teacherModel");
const User = require("../models/userModel");
const axios = require("axios");

// Constants for field sets
const SERVICE_FIELDS = new Set([
  "nom_service", "type_service", "matiere", "niveau_concerne",
  "nombre_max_participants", "prix", "duree_seance",
  "description", "actif", "modalite_service", "date_creation"
]);

const TEACHER_FIELDS = new Set([
  "nature", "deplacement", "rayon_deplacement", "description_pedagogique",
  "parcours_academique", "experience_professionnelle", "certifications",
  "actif", "rating", "reviewsCount", "online", "subjects"
]);

const USER_FIELDS = new Set([
  "firstname", "familyname", "email",
  "numberphone", "role", "postaladr"
]);

// Constants for defaults and limits
const DEFAULT_RADIUS = 10000; // meters
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const EARTH_RADIUS = 6378137; // meters
const ALLOWED_SORT_FIELDS = ["score", "prix", "rating", "duree_seance", "date_creation", "reviewsCount"];

// Build dynamic filter for MongoDB queries
const buildFieldFilter = (key, value) => {
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value === "string") return { $regex: value, $options: "i" };

  if (typeof value === "boolean" || typeof value === "number") return value;

  if (Array.isArray(value)) return { $in: value };

  if (typeof value === "object") {
    const filter = {};

    // For numeric ranges (price, duration, rating, etc.)
    if (value.min !== undefined) filter.$gte = value.min;
    if (value.max !== undefined) filter.$lte = value.max;

    // For date ranges
    if (value.from) filter.$gte = new Date(value.from);
    if (value.to) filter.$lte = new Date(value.to);

    // For inclusion/exclusion
    if (value.in) filter.$in = value.in;
    if (value.nin) filter.$nin = value.nin;
    if (value.all) filter.$all = value.all;

    // For exact string match (case-insensitive)
    if (value.exact !== undefined) return { $regex: `^${value.exact}$`, $options: "i" };

    // For inequality
    if (value.ne !== undefined) filter.$ne = value.ne;

    // For existence check
    if (value.exists !== undefined) filter.$exists = value.exists;

    // For raw MongoDB filter
    if (value.raw) return value.raw;

    return Object.keys(filter).length ? filter : undefined;
  }

  return value;
};

// Validate and parse input parameters
const validateAndParseParams = (body) => {
  const {
    city, lat, lng, radius = DEFAULT_RADIUS,
    page = DEFAULT_PAGE, limit = DEFAULT_LIMIT,
    sortBy = "score", sortOrder = -1,
    ...filters
  } = body;

  // Validate pagination
  const pageNum = Math.max(1, parseInt(page) || DEFAULT_PAGE);
  const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT));

  // Validate sort
  const finalSortField = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : "score";
  const sortOrderNum = sortOrder === 1 || sortOrder === '1' ? 1 : -1;

  // Validate radius
  const radiusNum = Math.max(1000, parseFloat(radius) || DEFAULT_RADIUS); // Minimum 1km

  return {
    city,
    lat: lat ? parseFloat(lat) : null,
    lng: lng ? parseFloat(lng) : null,
    radius: radiusNum,
    page: pageNum,
    limit: limitNum,
    sortBy: finalSortField,
    sortOrder: sortOrderNum,
    filters
  };
};


// Get coordinates from city name
const getCoordinatesFromCity = async (city) => {
  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: { q: city, format: "json", limit: 1 },
        headers: { "User-Agent": "tutor-app" }, // required by Nominatim
        timeout: 5000
      }
    );

    if (!response.data?.length) {
      throw new Error("Ville invalide ou introuvable");
    }

    return [
      parseFloat(response.data[0].lon),
      parseFloat(response.data[0].lat)
    ];
  } catch (error) {
    console.error("Geocoding error:", error.message);
    throw new Error("Erreur lors de la géolocalisation de la ville");
  }
};
// Build MongoDB aggregation pipeline
const buildAggregationPipeline = (params) => {
  const { center, radius, serviceQuery, teacherQuery, userQuery, sortBy, sortOrder, page, limit } = params;

  const pipeline = [];

  // Initial match for active services
  pipeline.push({ $match: serviceQuery });

  // Lookup teacher
  pipeline.push({
    $lookup: {
      from: "teachers",
      localField: "id_enseignant",
      foreignField: "id_enseignant",
      as: "teacher"
    }
  });
  pipeline.push({ $unwind: "$teacher" });

  // Apply geo filter if center provided
  if (center) {
    pipeline.push({
      $match: {
        "teacher.location": {
          $geoWithin: {
            $centerSphere: [center, radius / EARTH_RADIUS]
          }
        }
      }
    });
  }

  // Apply teacher filters
  if (Object.keys(teacherQuery).length) {
    pipeline.push({ $match: teacherQuery });
  }

  // Lookup user
  pipeline.push({
    $lookup: {
      from: "users",
      localField: "teacher.id_enseignant",
      foreignField: "idmembre",
      as: "user"
    }
  });
  pipeline.push({ $unwind: "$user" });

  // Apply user filters
  if (Object.keys(userQuery).length) {
    pipeline.push({ $match: userQuery });
  }

  // Calculate score
  pipeline.push({
    $addFields: {
      score: {
        $add: [
          { $multiply: [{ $ifNull: ["$teacher.rating", 0] }, 2] },
          { $multiply: [{ $ifNull: ["$teacher.reviewsCount", 0] }, 0.1] },
          { $multiply: [{ $ifNull: ["$prix", 0] }, -0.01] } // Lower price slightly preferred
        ]
      }
    }
  });

  // Sort
  pipeline.push({ $sort: { [sortBy]: sortOrder } });

  // Pagination
  pipeline.push({ $skip: (page - 1) * limit });
  pipeline.push({ $limit: limit });

  // Projection
  pipeline.push({
    $project: {
      _id: 0,
      id_service: 1,
      nom_service: 1,
      type_service: 1,
      matiere: 1,
      niveau_concerne: 1,
      
      nombre_max_participants: 1,
      prix: 1,
      duree_seance: 1,
      description: 1,
      modalite_service: 1,
      date_creation: 1,
      score: 1,
      // Teacher info
      id_enseignant: "$teacher.id_enseignant",
      nature: "$teacher.nature",
      rating: "$teacher.rating",
      reviewsCount: "$teacher.reviewsCount",
      online: "$teacher.online",
      subjects: "$teacher.subjects",
      deplacement: "$teacher.deplacement",
      rayon_deplacement: "$teacher.rayon_deplacement",
      description_pedagogique: "$teacher.description_pedagogique",
      // User info
      firstname: "$user.firstname",
      familyname: "$user.familyname",
      email: "$user.email",
      numberphone: "$user.numberphone"
    }
  });

  return pipeline;
};

// Main search function
const searchServices = async (req, res) => {
  try {
    // Validate and parse input parameters
    const params = validateAndParseParams(req.body);
    const { city, lat, lng, radius, page, limit, sortBy, sortOrder, filters } = params;

    // Determine center coordinates
    let center = null;
    if (city) {
      center = await getCoordinatesFromCity(city);
    } else if (lat && lng) {
      center = [lng, lat];
    }

    // Build dynamic filters
    const serviceQuery = { actif: true };
    const teacherQuery = {};
    const userQuery = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === "") continue;
      const built = buildFieldFilter(key, value);
      if (built === undefined) continue;

      if (SERVICE_FIELDS.has(key)) {
        serviceQuery[key] = built;
      } else if (TEACHER_FIELDS.has(key)) {
        teacherQuery[`teacher.${key}`] = built;
      } else if (USER_FIELDS.has(key)) {
        userQuery[`user.${key}`] = built;
      }
    }

    // Build aggregation pipeline
    const pipeline = buildAggregationPipeline({
      center,
      radius,
      serviceQuery,
      teacherQuery,
      userQuery,
      sortBy,
      sortOrder,
      page,
      limit
    });

    // Create count pipeline (exclude pagination stages)
    const countPipeline = [...pipeline.slice(0, -2), { $count: "total" }];

    // Execute queries in parallel
    const [services, countResult] = await Promise.all([
      Service.aggregate(pipeline),
      Service.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total ?? 0;

    // Return response
    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      results: services.length,
      data: services
    });

  } catch (error) {
    console.error("searchServices Error:", error);
    const statusCode = error.message.includes("géolocalisation") || error.message.includes("Ville") ? 400 : 500;
    return res.status(statusCode).json({
      message: error.message || "Erreur serveur",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { searchServices };
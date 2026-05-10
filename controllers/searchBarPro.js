const Service = require('../models/serviceModel');
const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');

// =========================
// CONSTANTS
// =========================
const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 10;

const ALLOWED_SORT_FIELDS = [
  'score', 'prix', 'rating', 'reviewsCount', 'date_creation'
];

// Mapping frontend (avec accents) → enum du schéma (sans accents)
// Frontend : "Primaire" | "Collège" | "Lycée" | "ESI"
// Schema   : "Primaire" | "College" | "Lycee" | "ESI"
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
// TEACHER NAME RESOLVER
// Retourne les idmembre des profs dont le nom matche le query
// null  = query vide → pas de filtre nom
// []    = aucun prof trouvé pour ce query
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

// =========================
// GEO TEACHER RESOLVER
// Retourne les id_enseignant des profs dans la zone
// null = pas de filtre géo demandé
// []   = aucun prof dans la zone
// Requiert un index 2dsphere sur Teacher.location pour le cas GPS
// =========================
const resolveTeacherIdsByGeo = async ({ lat, lng, radius, city }) => {
  // Cas 1 : coordonnées GPS (radius déjà en mètres, converti côté frontend)
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

  // Cas 2 : nom de ville
  if (city) {
    const teachers = await Teacher.find({
      ville: { $regex: escapeRegex(city), $options: 'i' }
    }).select('id_enseignant').lean();

    return teachers.map(t => t.id_enseignant);
  }

  return null;
};

// =========================
// FILTER BUILDER
// Calqué sur le schéma Service ET les champs envoyés par le frontend
// =========================
const buildFilter = ({
  safeQuery,
  statut,
  niveauSchema,    // valeur déjà convertie via NIVEAU_MAP
  annee_concerne,
  matiere,
  type_service,
  modalite_service,
  prix,            // { min?, max? }
  teacherNameIds,  // null | number[]
  geoTeacherIds,   // null | number[]
}) => {
  const filter = {
    // ── Champs toujours présents dans le schéma (default définis) ──────────
    // suspendu a default:false et index → filtre direct, pas besoin de $exists
    isDeleted:              false,
    suspendu:               false,
    'archivedMeta.isArchived': false,
  };

  // ── Statut actif/inactive ─────────────────────────────────────────────────
  // Schema : actif Boolean default:true
  if (statut === 'actif')    filter.actif = true;
  if (statut === 'inactive') filter.actif = false;

  // ── Recherche textuelle — uniquement si query non vide ───────────────────
  // Le schéma a un index text sur {nom_service, matiere} mais on garde regex
  // pour pouvoir chercher aussi dans description + nom du prof
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

  // ── Filtre géographique ───────────────────────────────────────────────────
  if (geoTeacherIds !== null) {
    // Si un filtre $or de nom-prof existe déjà, combiner avec $and
    // pour ne pas écraser $or
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

  // ── niveau_concerne ───────────────────────────────────────────────────────
  // Schema enum : "Primaire" | "College" | "Lycee" | "ESI" (sans accents)
  // Frontend envoie : "Primaire" | "Collège" | "Lycée" | "ESI" (avec accents)
  // → conversion via NIVEAU_MAP appliquée avant buildFilter
  if (niveauSchema) filter.niveau_concerne = niveauSchema;

  // ── annee_concerne ────────────────────────────────────────────────────────
  // Recherche souple (ex: "2ème", "Terminale")
  if (annee_concerne)
    filter.annee_concerne = { $regex: escapeRegex(annee_concerne), $options: 'i' };

  // ── matiere ───────────────────────────────────────────────────────────────
  // Filtre indépendant du query textuel — index sur ce champ
  if (matiere)
    filter.matiere = { $regex: escapeRegex(matiere), $options: 'i' };

  // ── type_service ──────────────────────────────────────────────────────────
  // Schema enum : "Individuel" | "Groupe" — correspond exactement au frontend
  if (type_service) filter.type_service = type_service;

  // ── modalite_service ──────────────────────────────────────────────────────
  // Frontend : "En ligne" | "Présentiel"
  // ⚠️  Absent du schéma actuel — à ajouter au schéma si nécessaire
  // Décommenté dès que le champ existe dans le schéma :
  // if (modalite_service) filter.modalite_service = modalite_service;

  // ── prix : { min?, max? } ─────────────────────────────────────────────────
  // Schema : prix Number min:0
  // Frontend envoie un objet { min, max }
  if (prix && typeof prix === 'object') {
    const prixFilter = {};
    if (prix.min !== undefined && !isNaN(Number(prix.min)))
      prixFilter.$gte = Number(prix.min);
    if (prix.max !== undefined && !isNaN(Number(prix.max)))
      prixFilter.$lte = Number(prix.max);
    if (Object.keys(prixFilter).length) filter.prix = prixFilter;
  }

  return filter;
};

// =========================
// PIPELINE BUILDER
// =========================
const buildPipeline = ({
  filter, safeQuery, finalSort, finalOrder,
  pageNum, limitNum,
  rating   // { min: number } — filtré après le $lookup teacher
}) => {
  const pipeline = [];

  pipeline.push({ $match: filter });

  // ── Join Teacher ──────────────────────────────────────────────────────────
  // Clé : Service.id_enseignant ↔ Teacher.id_enseignant (Number)
  pipeline.push({
    $lookup: {
      from:         'teachers',
      localField:   'id_enseignant',
      foreignField: 'id_enseignant',
      as:           'teacher'
    }
  });
  pipeline.push({ $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } });

  // ── Join User ─────────────────────────────────────────────────────────────
  // Teacher.id_enseignant ↔ User.idmembre (Number)
  pipeline.push({
    $lookup: {
      from:         'users',
      localField:   'teacher.id_enseignant',
      foreignField: 'idmembre',
      as:           'user'
    }
  });
  pipeline.push({ $unwind: { path: '$user', preserveNullAndEmptyArrays: true } });

  // ── Filtre rating (après lookup) ──────────────────────────────────────────
  // Frontend : rating: { min: number } (ex: { min: 4 })
  if (rating && rating.min !== undefined && !isNaN(Number(rating.min))) {
    pipeline.push({
      $match: { 'teacher.rating': { $gte: Number(rating.min) } }
    });
  }

  // ── Score de pertinence ───────────────────────────────────────────────────
  // Sans query → score basé uniquement sur rating + reviewsCount
  pipeline.push({
    $addFields: {
      score: {
        $add: [
          ...(safeQuery ? [
            { $cond: [{ $regexMatch: { input: { $ifNull: ['$nom_service', ''] }, regex: safeQuery, options: 'i' } }, 5, 0] },
            { $cond: [{ $regexMatch: { input: { $ifNull: ['$matiere',     ''] }, regex: safeQuery, options: 'i' } }, 3, 0] },
            { $cond: [{ $regexMatch: { input: { $ifNull: ['$description', ''] }, regex: safeQuery, options: 'i' } }, 2, 0] },
            {
              $cond: [
                {
                  $or: [
                    { $regexMatch: { input: { $ifNull: ['$user.firstname',  ''] }, regex: safeQuery, options: 'i' } },
                    { $regexMatch: { input: { $ifNull: ['$user.familyname', ''] }, regex: safeQuery, options: 'i' } }
                  ]
                },
                1, 0
              ]
            }
          ] : []),
          { $multiply: [{ $ifNull: ['$teacher.rating',       0] }, 1]   },
          { $multiply: [{ $ifNull: ['$teacher.reviewsCount', 0] }, 0.1] }
        ]
      }
    }
  });

  pipeline.push({ $sort: { [finalSort]: finalOrder, date_creation: -1 } });

  // ── $facet : count + pagination en une seule query ────────────────────────
  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [
        { $skip:  (pageNum - 1) * limitNum },
        { $limit: limitNum },
        {
          $project: {
            _id:                     0,
            // ── Champs Service (schéma) ──────────────────────────────
            id_service:              1,
            id_enseignant:           1,
            nom_service:             1,
            type_service:            1,
            matiere:                 1,
            niveau_concerne:         1,
            annee_concerne:          1,
            description:             1,
            actif:                   1,
            nombre_max_participants: 1,
            prix:                    1,
            duree_seance:            1,
            date_creation:           1,
            score:                   1,
            // ── Champs Teacher (via lookup) ──────────────────────────
            rating:                  '$teacher.rating',
            reviewsCount:            '$teacher.reviewsCount',
            photo_profil:            '$teacher.photo_profil',
            nature:                  '$teacher.nature',
            deplacement:             '$teacher.deplacement',
            description_pedagogique: '$teacher.description_pedagogique',
            // ── Champs User (via lookup) ─────────────────────────────
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
// Champs destructurés = exactement ce que le frontend envoie
// =========================
// =========================
// MAIN CONTROLLER
// =========================
const searchBarPro = async (req, res) => {
  try {
    const {
      // ── Meta ──────────────────────────────────────────────────────────────
      q         = '',
      page      = DEFAULT_PAGE,
      limit     = DEFAULT_LIMIT,
      sortBy    = 'score',
      sortOrder = -1,
      statut    = 'actif',

      // ── Filtres (noms identiques au frontend) ──────────────────────────
      niveau_concerne, 
      niveau,          // fallback for niveau_concerne
      annee_concerne,  
      annee,           // fallback for annee_concerne
      matiere,         
      type_service,    
      modalite_service,
      prix,            
      rating,          

      // ── Géo ───────────────────────────────────────────────────────────────
      lat,             
      lng,             
      radius,          
      city,            
    } = req.body;

    // --- FIX: Resolve fields whether the frontend sends 'niveau' or 'niveau_concerne' ---
    const resolvedNiveau = niveau_concerne || niveau;
    const resolvedAnnee  = annee_concerne || annee;

    const query     = typeof q === 'string' ? q.trim() : '';
    const safeQuery = query ? escapeRegex(query) : '';

    const pageNum  = Math.max(1, parseInt(page)  || DEFAULT_PAGE);
    const limitNum = Math.min(50, parseInt(limit) || DEFAULT_LIMIT);

    // Sort : "score" sans query → bascule sur "rating" (score uniforme sinon)
    const resolvedSortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'score';
    const finalSort      = !query && resolvedSortBy === 'score' ? 'rating' : resolvedSortBy;
    const finalOrder     = sortOrder === 1 || sortOrder === '1' ? 1 : -1;

    // Conversion niveau frontend → enum schéma en utilisant la variable résolue
    const niveauSchema = resolvedNiveau ? (NIVEAU_MAP[resolvedNiveau] ?? null) : null;

    // Résolution des IDs enseignant en parallèle
    const [teacherNameIds, geoTeacherIds] = await Promise.all([
      resolveTeacherIdsByName(query),
      resolveTeacherIdsByGeo({ lat, lng, radius, city })
    ]);

    const filter = buildFilter({
      safeQuery,
      statut,
      niveauSchema,
      annee_concerne: resolvedAnnee,
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
    console.error('searchBarPro error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { searchBarPro };
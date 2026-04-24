const Service = require('../models/serviceModel');
const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');

// ─────────────────────────────────────────────────────────────
// Barre de recherche — par nom de service OU nom/prénom du prof
// Retourne des services (pas des profs)
// ─────────────────────────────────────────────────────────────
exports.searchBar = async (req, res) => {
  /* #swagger.tags = ['Recherche']
      #swagger.summary = 'Rechercher des services ou enseignants'
      #swagger.description = 'Barre de recherche globale. Permet de trouver des services par nom, matière, ou par le nom/prénom du professeur.'
      
      #swagger.parameters['q'] = {
          in: 'query',
          description: 'Terme de recherche (minimum 2 caractères)',
          required: true,
          type: 'string',
          example: 'Mathématiques'
      }
      
      #swagger.parameters['page'] = {
          in: 'query',
          description: 'Numéro de la page pour la pagination',
          required: false,
          type: 'integer',
          default: 1
      }
      
      #swagger.parameters['limit'] = {
          in: 'query',
          description: 'Nombre de résultats par page (maximum 50)',
          required: false,
          type: 'integer',
          default: 20
      }

      #swagger.responses[200] = {
          description: 'Recherche réussie, retourne les services triés par pertinence.',
      }
      #swagger.responses[400] = {
          description: 'Requête invalide (le terme de recherche contient moins de 2 caractères).'
      }
      #swagger.responses[500] = {
          description: 'Erreur interne du serveur.'
      }
    */
  try {
    const { q, page = 1, limit = 20 } = req.query;

    // 1. Validation
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        status:  'fail',
        message: "La recherche doit contenir au moins 2 caractères."
      });
    }

    const query      = q.trim();
    const pageNum    = Math.max(1, parseInt(page));
    const limitNum   = Math.min(50, Math.max(1, parseInt(limit)));
    const skip       = (pageNum - 1) * limitNum;
    const searchRegex = new RegExp(query, 'i'); // insensible à la casse

    // 2. Trouver les enseignants dont le nom/prénom correspond
    //    On cherche dans User (firstname, familyname) puis on récupère leurs idmembre
    const matchingUsers = await User.find({
      role: 'teacher',
      $or: [
        { firstname:  searchRegex },
        { familyname: searchRegex },
        // Recherche sur nom complet "Ahmed Benali" ou "Benali Ahmed"
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ['$firstname', ' ', '$familyname'] },
              regex: query,
              options: 'i'
            }
          }
        },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ['$familyname', ' ', '$firstname'] },
              regex: query,
              options: 'i'
            }
          }
        }
      ]
    }).select('idmembre').lean();

    const matchingTeacherIds = matchingUsers.map(u => u.idmembre);

    // 3. Construire la query service :
    //    - nom_service correspond à la recherche
    //    - OU l'enseignant correspond à la recherche
    //    - ET le service est actif, non suspendu, non supprimé
    const serviceFilter = {
      actif:     true,
      suspendu:  false,
      isDeleted: false,
      $or: [
        { nom_service: searchRegex },
        { matiere:     searchRegex }, // bonus — chercher aussi dans la matière
        ...(matchingTeacherIds.length
          ? [{ id_enseignant: { $in: matchingTeacherIds } }]
          : []
        )
      ]
    };

    // 4. Aggregation — enrichir les services avec info prof + user
    const pipeline = [
      { $match: serviceFilter },

      // Jointure avec Teacher
      {
        $lookup: {
          from:         'teachers',
          localField:   'id_enseignant',
          foreignField: 'id_enseignant',
          as:           'teacher'
        }
      },
      { $unwind: { path: '$teacher', preserveNullAndEmpty: false } },

      // Jointure avec User
      {
        $lookup: {
          from:         'users',
          localField:   'teacher.id_enseignant',
          foreignField: 'idmembre',
          as:           'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmpty: false } },

      // Score de pertinence :
      // +3 si nom du service correspond
      // +2 si matière correspond
      // +1 si nom du prof correspond
      // +rating du prof
      {
        $addFields: {
          relevanceScore: {
            $add: [
              {
                $cond: [
                  { $regexMatch: { input: '$nom_service', regex: query, options: 'i' } },
                  3, 0
                ]
              },
              {
                $cond: [
                  { $regexMatch: { input: '$matiere', regex: query, options: 'i' } },
                  2, 0
                ]
              },
              {
                $cond: [
                  {
                    $or: [
                      { $regexMatch: { input: '$user.firstname',  regex: query, options: 'i' } },
                      { $regexMatch: { input: '$user.familyname', regex: query, options: 'i' } }
                    ]
                  },
                  1, 0
                ]
              },
              { $ifNull: ['$teacher.rating', 0] }
            ]
          }
        }
      },

      // Trier par pertinence puis rating
      { $sort: { relevanceScore: -1, 'teacher.rating': -1 } },

      // Pagination
      { $skip: skip },
      { $limit: limitNum },

      // Projection finale
      {
        $project: {
          _id:                    0,
          id_service:             1,
          nom_service:            1,
          matiere:                1,
          niveau_concerne:        1,
          annee_concerne:         1,
          type_service:           1,
          prix:                   1,
          duree_seance:           1,
          description:            1,
          modalite_service:       1,
          nombre_max_participants: 1,
          relevanceScore:         1,

          // Info enseignant
          id_enseignant:           '$teacher.id_enseignant',
          rating:                  '$teacher.rating',
          reviewsCount:            '$teacher.reviewsCount',
          photo_profil:            '$teacher.photo_profil',
          description_pedagogique: '$teacher.description_pedagogique',
          deplacement:             '$teacher.deplacement',
          nature:                  '$teacher.nature',

          // Info user
          teacher_firstname:  '$user.firstname',
          teacher_familyname: '$user.familyname'
        }
      }
    ];

    // 5. Exécuter pipeline + count en parallèle
    const countPipeline = [
      { $match: serviceFilter },
      { $count: 'total' }
    ];

    const [results, countResult] = await Promise.all([
      Service.aggregate(pipeline),
      Service.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total ?? 0;

    return res.status(200).json({
      status:     'success',
      query,
      page:       pageNum,
      limit:      limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      results:    results.length,
      data:       results
    });

  } catch (error) {
    console.error('SearchBar error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};
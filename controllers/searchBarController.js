const Service = require('../models/serviceModel');
const User    = require('../models/userModel');

exports.searchBar = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    if (q.length < 2) {
      return res.status(400).json({
        status: 'fail',
        message: 'Search query must be at least 2 characters'
      });
    }

    const regex = new RegExp(q, 'i');

    // ─────────────────────────────
    // 1. FIND TEACHERS BY USER NAME
    // ─────────────────────────────
    const users = await User.find({
      role: 'teacher',
      $or: [
        { firstname: regex },
        { familyname: regex },
        { email: regex }
      ]
    }).select('idmembre');

    const teacherIds = users.map(u => u.idmembre);

    // ─────────────────────────────
    // 2. BUILD SERVICE FILTER
    // ─────────────────────────────
    const filter = {
      $and: [
        {
          $or: [
            { nom_service: regex },
            { matiere: regex },
            { description: regex },
            ...(teacherIds.length ? [{ id_enseignant: { $in: teacherIds } }] : [])
          ]
        }
      ]
    };

    // ─────────────────────────────
    // 3. QUERY SERVICES
    // ─────────────────────────────
    const [services, total] = await Promise.all([
      Service.find(filter)
        .select('-__v')
        .sort({ date_creation: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Service.countDocuments(filter)
    ]);

    return res.status(200).json({
      status: 'success',
      query: q,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      data: services
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
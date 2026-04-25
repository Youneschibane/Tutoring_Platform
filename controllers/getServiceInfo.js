const Service = require('../models/serviceModel');

const getServiceByNumericId = async (req, res) => {
  try {
    const { id_service } = req.params;

    // ─────────────────────────────
    // VALIDATION
    // ─────────────────────────────
    if (!id_service) {
      return res.status(400).json({
        status: "fail",
        message: "id_service is required"
      });
    }

    // ─────────────────────────────
    // SEARCH BY NUMERIC ID
    // ─────────────────────────────
    const service = await Service.findOne({
  id_service: Number(id_service),
  actif: true,
  isDeleted: false,

  $and: [
    {
      $or: [
        { suspendu: false },
        { suspendu: { $exists: false } }
      ]
    }
  ]
});

    // ─────────────────────────────
    // NOT FOUND
    // ─────────────────────────────
    if (!service) {
      return res.status(404).json({
        status: "fail",
        message: "Service not found"
      });
    }

    // ─────────────────────────────
    // SUCCESS
    // ─────────────────────────────
    return res.status(200).json({
      status: "success",
      data: service
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

module.exports = { getServiceByNumericId };
const Rule = require('../models/rulesModel');

const getAllRules = async (req, res) => {
  try {
    const rules = await Rule.find().sort({ createdAt: -1 });
    return res.status(200).json({
      status: 'success',
      total:  rules.length,
      data:   rules
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const addRule = async (req, res) => {
  try {
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ status: 'error', message: 'Title and body are required' });
    }

    const rule = await Rule.create({ title, body });
    return res.status(201).json({ status: 'success', data: rule });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const deleteRule = async (req, res) => {
  try {
    const rule = await Rule.findByIdAndDelete(req.params.id);

    if (!rule) {
      return res.status(404).json({ status: 'error', message: 'Rule not found' });
    }

    return res.status(200).json({ status: 'success', message: 'Rule deleted successfully' });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { getAllRules, addRule, deleteRule };
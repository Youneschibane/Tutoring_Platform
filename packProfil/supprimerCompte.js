const User   = require('../models/userModel');
const Device = require('../models/deviceModel');
const AccountDeletion = require('../models/accountDeletionModel');

exports.deleteAccount = async (req, res) => {
  const session = await require('mongoose').startSession();
  session.startTransaction();

  try {
    // Use req.user.id from auth middleware instead of req.params
    const userId = req.user.id;
    const user = await User.findById(userId).session(session);
    
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ status: 'fail', message: "Utilisateur introuvable." });
    }

    if (!user.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ status: 'fail', message: "Ce compte est déjà désactivé." });
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    // Update user
    await User.findByIdAndUpdate(userId, {
      isActive: false,
      deletionScheduledAt: deletionDate
    }, { session });

 

    // Record deletion request in AccountDeletion for audit trail
    await AccountDeletion.findOneAndUpdate(
      { userId: userId },
      {
        userId: userId,
        email: user.email,
        phone: user.numberphone,
        requestedAt: new Date(),
        deletionScheduledFor: deletionDate,
        status: 'pending'
      },
      { upsert: true, new: true, session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      status: 'success',
      message: "Compte désactivé. Suppression automatique dans 30 jours.",
      deletionDate: deletionDate.toISOString(),
      info: "Vos données seront archivées pour des raisons de conformité avant suppression finale."
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    session.endSession();
  }
};

exports.reactivateAccount = async (req, res) => {
  const session = await require('mongoose').startSession();
  session.startTransaction();

  try {
    // Use req.user.id from auth middleware instead of req.params
    const userId = req.user.id;
    const user = await User.findById(userId).session(session);
    
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ status: 'fail', message: "Utilisateur introuvable." });
    }

    if (user.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ status: 'fail', message: "Ce compte est déjà actif." });
    }

    // Reactivate user
    await User.findByIdAndUpdate(userId, {
      isActive: true,
      deletionScheduledAt: null
    }, { session });

    // Update AccountDeletion status
    await AccountDeletion.findOneAndUpdate(
      { userId: userId },
      {
        status: 'cancelled',
        cancelledAt: new Date()
      },
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      status: 'success',
      message: "Compte réactivé avec succès.",
      info: "Votre compte est maintenant actif et accessible."
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    session.endSession();
  }
};
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent = require('../models/parentModel');
const Admin = require('../models/adminModel');
const Device = require('../models/deviceModel');
const Archive = require('../models/archiveModel');
const AccountDeletion = require('../models/accountDeletionModel');

/**
 * Permanently delete users whose 30-day grace period has expired
 * Moves their data to Archive collection for traceability
 */
exports.permanentlyDeleteExpiredAccounts = async () => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = new Date();
    
    // Find all users scheduled for deletion past their deadline
    const expiredUsers = await User.find({
      isActive: false,
      deletionScheduledAt: { $lt: now },
      deletionScheduledAt: { $ne: null }
    }).session(session);

    console.log(`Found ${expiredUsers.length} accounts to permanently delete`);

    for (const user of expiredUsers) {
      try {
        await deleteUserPermanently(user, session);
        console.log(`✓ Permanently deleted user: ${user.email || user.numberphone}`);
      } catch (error) {
        console.error(`✗ Error deleting user ${user._id}:`, error.message);
        // Continue with next user on error
      }
    }

    await session.commitTransaction();
    console.log('✓ Account deletion batch completed successfully');
    return { deletedCount: expiredUsers.length };

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in permanentlyDeleteExpiredAccounts:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Delete a single user and archive their data
 */
async function deleteUserPermanently(user, session) {
  const archiveData = {
    userId: user._id,
    idmembre: user.idmembre,
    firstname: user.firstname,
    familyname: user.familyname,
    email: user.email,
    numberphone: user.numberphone,
    role: user.role,
    deletionScheduledAt: user.deletionScheduledAt,
    userSnapshot: user.toObject()
  };

  // Get role-specific data
  let roleModel, idField, roleData;
  
  switch (user.role) {
    case 'teacher':
      roleModel = Teacher;
      idField = 'id_enseignant';
      break;
    case 'student':
      roleModel = Student;
      idField = 'id_eleve';
      break;
    case 'parent':
      roleModel = Parent;
      idField = 'id_parent';
      break;
    case 'admin':
      roleModel = Admin;
      idField = 'id_admin';
      break;
    default:
      roleModel = null;
  }

  // Archive role-specific data
  if (roleModel && idField) {
    roleData = await roleModel.findOne({ [idField]: user.idmembre }).session(session);
    if (roleData) {
      archiveData.roleData = roleData.toObject();
      
      // Delete from role collection
      await roleModel.deleteOne(
        { [idField]: user.idmembre },
        { session }
      );
    }
  }

  // Archive device data
  const devices = await Device.find({ userId: user._id }).session(session);
  if (devices.length > 0) {
    archiveData.deviceSnapshot = devices.map(d => d.toObject());
    
    // Delete devices
    await Device.deleteMany(
      { userId: user._id },
      { session }
    );
  }

  // Save to archive
  const archive = new Archive(archiveData);
  await archive.save({ session });

  // Update AccountDeletion record
  await AccountDeletion.findOneAndUpdate(
    { userId: user._id },
    {
      status: 'completed',
      deletedAt: new Date()
    },
    { session }
  );

  // Finally, delete the user
  await User.deleteOne(
    { _id: user._id },
    { session }
  );
}

/**
 * Get archived user data for audit/compliance
 */
exports.getArchivedUser = async (email) => {
  try {
    const archived = await Archive.findOne({ 
      $or: [
        { email: email },
        { numberphone: email }
      ]
    });

    if (!archived) {
      return null;
    }

    return {
      status: 'success',
      data: archived,
      message: 'Archived user data retrieved for compliance'
    };
  } catch (error) {
    throw new Error(`Error retrieving archived user: ${error.message}`);
  }
};

/**
 * Get deletion audit trail
 */
exports.getDeletionAuditTrail = async (filters = {}) => {
  try {
    const query = {};
    
    if (filters.role) query.role = filters.role;
    if (filters.startDate) {
      query.permanentlyDeletedAt = { 
        $gte: new Date(filters.startDate) 
      };
    }
    if (filters.endDate) {
      query.permanentlyDeletedAt = {
        ...query.permanentlyDeletedAt,
        $lte: new Date(filters.endDate)
      };
    }

    const archives = await Archive.find(query)
      .sort({ permanentlyDeletedAt: -1 })
      .select('idmembre email role permanentlyDeletedAt deletionScheduledAt');

    return {
      count: archives.length,
      data: archives
    };
  } catch (error) {
    throw new Error(`Error retrieving audit trail: ${error.message}`);
  }
};

/**
 * Restore account from archive (within retention period)
 */
exports.restoreFromArchive = async (email, session) => {
  try {
    const archived = await Archive.findOne({
      $or: [
        { email: email },
        { numberphone: email }
      ]
    }).session(session);

    if (!archived) {
      throw new Error('Archived user not found');
    }

    // Check if still within retention period
    if (new Date() > archived.retentionUntil) {
      throw new Error('Retention period expired - cannot restore');
    }

    // Restore user
    const userSnapshot = archived.userSnapshot;
    userSnapshot.isActive = true;
    userSnapshot.deletionScheduledAt = null;

    const restoredUser = await User.create([userSnapshot], { session });

    // Restore role data if exists
    if (archived.roleData && archived.role) {
      const roleModel = {
        teacher: Teacher,
        student: Student,
        parent: Parent,
        admin: Admin
      }[archived.role];

      if (roleModel) {
        archived.roleData._id = new mongoose.Types.ObjectId();
        await roleModel.create([archived.roleData], { session });
      }
    }

    // Update AccountDeletion
    await AccountDeletion.findOneAndUpdate(
      { userId: archived.userId },
      { status: 'cancelled', cancelledAt: new Date() },
      { session }
    );

    // Delete from archive
    await Archive.deleteOne({ _id: archived._id }, { session });

    return restoredUser;
  } catch (error) {
    throw new Error(`Error restoring user: ${error.message}`);
  }
};

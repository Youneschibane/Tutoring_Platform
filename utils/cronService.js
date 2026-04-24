const cron = require('node-cron');
const { permanentlyDeleteExpiredAccounts } = require('./accountDeletionService');

let cronJob = null;

/**
 * Initialize cron jobs for account deletion
 * Runs daily at 2 AM to check for expired accounts
 */
exports.initializeCronJobs = () => {
  try {
    // Schedule task to run every day at 2 AM
    cronJob = cron.schedule('0 2 * * *', async () => {
      console.log('\n🔄 Running scheduled account deletion job...');
      
      try {
        const result = await permanentlyDeleteExpiredAccounts();
        console.log(`✓ Deletion job completed: ${result.deletedCount} accounts deleted`);
      } catch (error) {
        console.error('✗ Error in deletion job:', error.message);
        // Send alert notification if needed
        notifyAdminOfError(error);
      }
    });

    console.log('✓ Cron job initialized: Daily account deletion at 2 AM UTC');
    return cronJob;
  } catch (error) {
    console.error('Failed to initialize cron job:', error);
    throw error;
  }
};

/**
 * Stop cron job (for graceful shutdown)
 */
exports.stopCronJobs = () => {
  if (cronJob) {
    cronJob.stop();
    console.log('✓ Cron job stopped');
  }
};

/**
 * Manual trigger for deletion (for testing/admin purposes)
 */
exports.triggerDeletionNow = async () => {
  console.log('🔧 Manually triggering account deletion...');
  try {
    const result = await permanentlyDeleteExpiredAccounts();
    console.log(`✓ Manual deletion completed: ${result.deletedCount} accounts deleted`);
    return result;
  } catch (error) {
    console.error('✗ Error in manual deletion:', error);
    throw error;
  }
};

/**
 * Notify admin of errors
 */
function notifyAdminOfError(error) {
  // TODO: Implement email notification to admin
  // sendEmail({
  //   to: process.env.ADMIN_EMAIL,
  //   subject: '⚠️ Account Deletion Job Error',
  //   message: `Error: ${error.message}`
  // });
  console.error('Admin notification would be sent:', error.message);
}

/**
 * Get job status
 */
exports.getCronJobStatus = () => {
  return {
    active: cronJob ? !cronJob._destroyed : false,
    schedule: '0 2 * * * (Daily at 2 AM UTC)',
    nextRun: cronJob ? 'Scheduled' : 'Not scheduled'
  };
};

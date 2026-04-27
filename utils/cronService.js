const cron = require('node-cron');
const { permanentlyDeleteExpiredAccounts } = require('./accountDeletionService');
const { 
  permanentDeleteAccountsCronJob, 
  cleanupExpiredArchivesCronJob, 
  notifyPendingDeletedAccountsCronJob 
} = require('./accountDeletionCronService');

let cronJobs = [];

/**
 * Initialize cron jobs for account deletion and archival
 */
exports.initializeCronJobs = () => {
  try {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔧 Initializing Account Deletion and Archive Cron Jobs');
    console.log('═══════════════════════════════════════════════════════\n');

    // Initialize all new cron jobs
    permanentDeleteAccountsCronJob();
    cleanupExpiredArchivesCronJob();
    notifyPendingDeletedAccountsCronJob();

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ All cron jobs initialized successfully');
    console.log('═══════════════════════════════════════════════════════\n');

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize cron jobs:', error);
    throw error;
  }
};

/**
 * Stop all cron jobs (for graceful shutdown)
 */
exports.stopCronJobs = () => {
  console.log('🛑 Stopping all cron jobs...');
  cron.getTasks().forEach(task => {
    task.stop();
  });
  console.log('✓ All cron jobs stopped');
};

/**
 * Manual trigger for permanent deletion (for testing/admin purposes)
 */
exports.triggerDeletionNow = async () => {
  console.log('🔧 Manually triggering account permanent deletion...');
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
 * Get all cron job statuses
 */
exports.getCronJobStatus = () => {
  return {
    tasks: cron.getTasks().length,
    jobs: [
      {
        name: 'Permanent Account Deletion',
        schedule: '0 2 * * * (Daily at 2 AM UTC)',
        description: 'Permanently delete accounts after 30-day grace period'
      },
      {
        name: 'Archive Cleanup',
        schedule: '0 3 * * 0 (Sundays at 3 AM UTC)',
        description: 'Clean up expired archive records'
      },
      {
        name: 'Deletion Reminders',
        schedule: '0 10 * * * (Daily at 10 AM UTC)',
        description: 'Send reminder emails before permanent deletion'
      }
    ]
  };
};

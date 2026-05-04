const cron = require('node-cron');
const User = require('../models/userModel');
const AccountDeletion = require('../models/accountDeletionModel');
const { permanentlyDeleteAccount } = require('../packProfil/supprimerCompte');

/**
 * @name permanentDeleteAccountsCronJob
 * @description Cron job qui exécute la suppression définitive des comptes
 *              après la période de grâce de 30 jours
 * 
 * Exécution: Tous les jours à 2h du matin
 * Fonction: Cherche tous les comptes désactivés dont la période de 30 jours est expirée
 *           et les supprime définitivement avec archivage complet
 */

const permanentDeleteAccountsCronJob = () => {
  // Exécuter tous les jours à 2h00 du matin
  cron.schedule('0 2 * * *', async () => {
    console.log('🕐 [CRON] Démarrage de la suppression définitive des comptes (02:00)...');

    try {
      // 1. Chercher tous les comptes désactivés dont la période de grâce est expirée
      const now = new Date();
      
      const usersToDelete = await User.find({
        isActive: false,
        isDeleted: false,
        deletionScheduledAt: { $lte: now }  // La date de suppression est passée
      }).select('+deletionScheduledAt');

      if (usersToDelete.length === 0) {
        console.log('✅ [CRON] Aucun compte à supprimer définitivement.');
        return;
      }

      console.log(`⚠️  [CRON] Trouvé ${usersToDelete.length} compte(s) à supprimer définitivement.`);

      let successCount = 0;
      let errorCount = 0;

      // 2. Supprimer chaque compte définitivement
      for (const user of usersToDelete) {
        try {
          const result = await permanentlyDeleteAccount(user._id);
          
          if (result.success) {
            successCount++;
            console.log(`✅ [CRON] Compte supprimé: ${user.idmembre} (${user.email})`);
          } else {
            errorCount++;
            console.warn(`⚠️  [CRON] Erreur lors de la suppression: ${user.idmembre} - ${result.message}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ [CRON] Erreur lors de la suppression de ${user.idmembre}:`, error.message);
        }
      }

      // 3. Résumé
      console.log(`\n📊 [CRON] Résumé de la suppression:`);
      console.log(`   ✅ Succès: ${successCount}`);
      console.log(`   ❌ Erreurs: ${errorCount}`);
      console.log(`   📅 Exécution complétée à: ${new Date().toISOString()}\n`);

    } catch (error) {
      console.error('❌ [CRON] Erreur lors du cron job de suppression:', error.message);
    }
  });

  console.log('🚀 [CRON] Tâche de suppression définitive des comptes initialisée (02:00 chaque jour)');
};

/**
 * @name cleanupExpiredArchivesCronJob
 * @description Cron job qui nettoie les archives expirées selon la politique de rétention
 * 
 * Exécution: Tous les dimanches à 3h du matin
 * Fonction: Supprime les documents ArchiveAction dont la date retentionUntil est dépassée
 *           (Implémentation avec TTL index, ce job est un backup)
 */

const cleanupExpiredArchivesCronJob = () => {
  const ArchiveAction = require('../models/archiveActionModel');
  
  // Exécuter tous les dimanches à 3h00 du matin
  cron.schedule('0 3 * * 0', async () => {
    console.log('🕐 [CRON] Démarrage du nettoyage des archives expirées (03:00)...');

    try {
      const now = new Date();
      
      const result = await ArchiveAction.deleteMany({
        retentionUntil: { $lte: now }
      });

      console.log(`✅ [CRON] Archives expirées supprimées: ${result.deletedCount}`);
      
    } catch (error) {
      console.error('❌ [CRON] Erreur lors du nettoyage des archives:', error.message);
    }
  });

  console.log('🚀 [CRON] Tâche de nettoyage des archives initialisée (03:00 chaque dimanche)');
};

/**
 * @name notifyPendingDeletedAccountsCronJob
 * @description Cron job pour envoyer des notifications de rappel
 * 
 * Exécution: Tous les jours à 10h du matin
 * Fonction: Envoie des e-mails de rappel 7 jours avant la suppression définitive
 */

const notifyPendingDeletedAccountsCronJob = () => {
  // Exécuter tous les jours à 10h00 du matin
  cron.schedule('0 10 * * *', async () => {
    console.log('🕐 [CRON] Vérification des comptes proches de suppression (10:00)...');

    try {
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Trouver les comptes qui seront supprimés dans les 7 prochains jours
      const accountsToNotify = await User.find({
        isActive: false,
        isDeleted: false,
        deletionScheduledAt: { 
          $gte: now, 
          $lte: sevenDaysLater 
        }
      }).select('+deletionScheduledAt');

      if (accountsToNotify.length === 0) {
        console.log('✅ [CRON] Aucun compte à notifier.');
        return;
      }

      console.log(`📧 [CRON] ${accountsToNotify.length} compte(s) à notifier avant suppression.`);

      // TODO: Implémenter l'envoi d'e-mails de rappel via sendEmail
      // for (const user of accountsToNotify) {
      //   await sendEmail({
      //     to: user.email,
      //     subject: 'Rappel: Votre compte sera supprimé',
      //     template: 'account-deletion-reminder',
      //     data: { name: user.firstname, deletionDate: user.deletionScheduledAt }
      //   });
      // }

    } catch (error) {
      console.error('❌ [CRON] Erreur lors de la notification:', error.message);
    }
  });

  console.log('🚀 [CRON] Tâche de notification initialisée (10:00 chaque jour)');
};

// Export pour initialiser dans server.js
module.exports = {
  permanentDeleteAccountsCronJob,
  cleanupExpiredArchivesCronJob,
  notifyPendingDeletedAccountsCronJob,
  
  // Initialiser tous les cron jobs
  initializeAllCronJobs: () => {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔧 Initialisation des tâches CRON de gestion des comptes');
    console.log('═══════════════════════════════════════════════════════\n');
    
    permanentDeleteAccountsCronJob();
    cleanupExpiredArchivesCronJob();
    notifyPendingDeletedAccountsCronJob();
    
    console.log('✅ Tous les cron jobs sont initialisés.\n');
  }
};

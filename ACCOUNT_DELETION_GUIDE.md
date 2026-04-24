# Account Deletion & Archiving System

## Overview

This system implements a **30-day grace period** for account deletions with automatic archiving for traceability and compliance:

1. User requests account deletion → Account marked as inactive
2. **30-day grace period** → User can reactivate during this time
3. After 30 days → Account automatically deleted and data archived
4. **Archived data** kept for 1 year (configurable) for compliance/audit

---

## Setup & Installation

### 1. Install Required Dependency

```bash
npm install node-cron
```

### 2. Environment Variables (optional)

Add to your `.env` file:

```env
# Admin email for deletion notifications
ADMIN_EMAIL=admin@tutoring-platform.com

# Cron job timezone (default: UTC)
CRON_TIMEZONE=UTC

# Archive retention period in days (default: 365)
ARCHIVE_RETENTION_DAYS=365
```

### 3. Database Collections

The system automatically creates/uses these collections:

- **users** - Main user collection
- **teachers** - Teacher role data
- **students** - Student role data
- **parents** - Parent role data
- **admins** - Admin role data
- **devices** - Device sessions
- **archives** - Deleted user data backup
- **accountdeletions** - Deletion audit trail

---

## API Endpoints

### User Deletion Endpoints

#### 1. Request Account Deletion
**POST** `/api/pack-profil/delete`

Marks account for deletion after 30 days.

```bash
curl -X POST http://localhost:3000/api/pack-profil/delete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "status": "success",
  "message": "Compte désactivé. Suppression automatique dans 30 jours.",
  "deletionDate": "2025-05-21T12:00:00.000Z",
  "info": "Vos données seront archivées pour des raisons de conformité avant suppression finale."
}
```

#### 2. Reactivate Account (within 30 days)
**POST** `/api/pack-profil/reactivate`

Cancels the deletion if within 30-day grace period.

```bash
curl -X POST http://localhost:3000/api/pack-profil/reactivate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "status": "success",
  "message": "Compte réactivé avec succès.",
  "info": "Votre compte est maintenant actif et accessible."
}
```

---

### Admin Management Endpoints

#### 1. Check Cron Job Status
**GET** `/api/admin/deletion/deletion-status`

Check if deletion cron job is running.

```bash
curl http://localhost:3000/api/admin/deletion/deletion-status \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "active": true,
    "schedule": "0 2 * * * (Daily at 2 AM UTC)",
    "nextRun": "Scheduled"
  }
}
```

#### 2. Manually Trigger Deletion
**POST** `/api/admin/deletion/trigger-deletion`

Immediately process expired accounts (for testing/emergencies).

```bash
curl -X POST http://localhost:3000/api/admin/deletion/trigger-deletion \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response:**
```json
{
  "status": "success",
  "message": "5 accounts permanently deleted",
  "data": {
    "deletedCount": 5
  }
}
```

#### 3. Get Deletion Audit Trail
**POST** `/api/admin/deletion/deletion-audit`

Retrieve history of deleted accounts.

```bash
curl -X POST http://localhost:3000/api/admin/deletion/deletion-audit \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "student",
    "startDate": "2025-04-01",
    "endDate": "2025-05-21"
  }'
```

**Query Parameters:**
- `role` (optional) - Filter by role: 'teacher', 'student', 'parent', 'admin'
- `startDate` (optional) - ISO date string
- `endDate` (optional) - ISO date string

**Response:**
```json
{
  "status": "success",
  "message": "Deletion audit trail retrieved",
  "data": {
    "count": 3,
    "data": [
      {
        "_id": "...",
        "idmembre": 1001,
        "email": "student@example.com",
        "role": "student",
        "permanentlyDeletedAt": "2025-05-20T02:15:30.000Z",
        "deletionScheduledAt": "2025-04-20T12:00:00.000Z"
      }
    ]
  }
}
```

#### 4. Search Archived User
**POST** `/api/admin/deletion/archived-user`

Retrieve archived data for a deleted user.

```bash
curl -X POST http://localhost:3000/api/admin/deletion/archived-user \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "deleted-user@example.com"
  }'
```

**Body Parameters:**
- `email` or `phone` (at least one required)

**Response:**
```json
{
  "status": "success",
  "message": "Archived user data found",
  "data": {
    "status": "success",
    "data": {
      "_id": "...",
      "userId": "...",
      "idmembre": 1001,
      "firstname": "John",
      "familyname": "Doe",
      "email": "john@example.com",
      "role": "student",
      "permanentlyDeletedAt": "2025-05-20T02:15:30.000Z",
      "userSnapshot": { /* full user data */ },
      "roleData": { /* student-specific data */ },
      "deviceSnapshot": [ /* device sessions */ ],
      "retentionUntil": "2026-05-20T02:15:30.000Z"
    }
  }
}
```

---

## Automatic Deletion Process

### Daily Cron Schedule

**Time:** 2:00 AM UTC (configurable in `cronService.js`)

**What happens:**
1. Finds all users with `isActive=false` and `deletionScheduledAt` in the past
2. For each expired user:
   - Archives user data to `archives` collection
   - Archives role-specific data (teacher/student/parent/admin)
   - Archives device session data
   - Updates `accountdeletions` record to "completed"
   - Deletes user from `users` collection
   - Deletes user from role-specific collections
   - Deletes all associated devices
3. Logs completion summary

### Archive Retention

Archived data automatically expires after **1 year** (configurable) via MongoDB TTL index.

---

## Data Flow Diagram

```
User Deletion Request
        ↓
[isActive: false, deletionScheduledAt: now + 30 days]
        ↓
    ┌─────────────────────────────┐
    │   30-day Grace Period        │
    │ User can reactivate anytime  │
    └─────────────────────────────┘
        ↓
  Cron Job Triggers (Daily 2 AM)
        ↓
  Is 30 days passed?
    ├─ YES → Archive & Delete
    │         ├─ Save to Archives collection
    │         ├─ Delete from Users
    │         ├─ Delete from Role tables
    │         └─ Delete Devices
    └─ NO → Skip
        ↓
  Data retained in Archives for 1 year
        ↓
  TTL Index auto-deletes after 1 year
```

---

## Database Schema: Archive Collection

```javascript
{
  userId: ObjectId,              // Original MongoDB ID
  idmembre: Number,              // Numeric ID
  firstname: String,
  familyname: String,
  email: String,
  numberphone: String,
  role: String,                  // 'teacher', 'student', 'parent', 'admin'
  roleData: Mixed,               // Entire role-specific document
  deletionReason: String,        // Optional
  deletionScheduledAt: Date,
  permanentlyDeletedAt: Date,    // When actually deleted
  userSnapshot: Mixed,           // Full user document at time of deletion
  deviceSnapshot: Array,         // Array of device documents
  retentionUntil: Date,          // Auto-delete after this date (1 year)
  createdAt: Date,
  updatedAt: Date
}
```

---

## Compliance & Legal

### GDPR Compliance

✅ **Right to be Forgotten:** After 30-day grace period, all personal data is deleted
✅ **Data Portability:** User has 30 days to request data before deletion
✅ **Audit Trail:** Complete deletion history stored in `accountdeletions` collection
✅ **Retention Policy:** Archived data kept only as long as legally required

### Audit Trail (AccountDeletion Collection)

```javascript
{
  userId: ObjectId,
  email: String,
  phone: String,
  requestedAt: Date,             // When deletion was requested
  deletionScheduledFor: Date,    // When permanent deletion will occur
  status: String,                // 'pending', 'cancelled', 'completed'
  reason: String,                // Optional reason
  cancelledAt: Date,             // If reactivated
  deletedAt: Date                // When actually deleted
}
```

---

## Troubleshooting

### Cron job not running?

1. Check logs for errors:
   ```bash
   # In server logs, look for:
   # ✓ Cron job initialized: Daily account deletion at 2 AM UTC
   ```

2. Verify node-cron is installed:
   ```bash
   npm list node-cron
   ```

3. Check MongoDB connection:
   ```bash
   # Ensure MongoDB is running and MONGO_URI is correct
   ```

### Manual deletion trigger

For testing, manually trigger the deletion:

```bash
curl -X POST http://localhost:3000/api/admin/deletion/trigger-deletion \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Archives not being created?

Ensure archive model is properly required in `accountDeletionService.js`.

---

## Configuration

### Adjust cron schedule

Edit `utils/cronService.js`:

```javascript
// Change from: 0 2 * * * (2 AM UTC daily)
// To: 0 0 * * 0 (Midnight UTC every Sunday)
cronJob = cron.schedule('0 0 * * 0', async () => {
  // ...
});
```

### Cron Schedule Format

```
┌───────────── second (0 - 59)
│ ┌───────────── minute (0 - 59)
│ │ ┌───────────── hour (0 - 23)
│ │ │ ┌───────────── day of month (1 - 31)
│ │ │ │ ┌───────────── month (0 - 11)
│ │ │ │ │ ┌───────────── day of week (0 - 6) (0 = Sunday)
│ │ │ │ │ │
│ │ │ │ │ │
0 2 * * * = Every day at 2:00 AM UTC
0 0 * * 0 = Every Sunday at midnight UTC
0 */6 * * * = Every 6 hours
```

### Adjust retention period

Edit `models/archiveModel.js`:

```javascript
// Change from: 365 days
retentionUntil: {
  type: Date,
  default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
}
```

---

## Files Modified/Created

### New Files
- `models/archiveModel.js` - Archive schema
- `utils/accountDeletionService.js` - Deletion & archiving logic
- `utils/cronService.js` - Cron job scheduler
- `routes/adminDeletionRoutes.js` - Admin endpoints

### Modified Files
- `packProfil/supprimerCompte.js` - Updated to use AccountDeletion model & transactions
- `server.js` - Initialize cron job on startup
- `app.js` - Added admin deletion routes

---

## Testing

### Test deletion workflow

```bash
# 1. Request deletion
curl -X POST http://localhost:3000/api/pack-profil/delete \
  -H "Authorization: Bearer USER_TOKEN"

# 2. Check status
curl http://localhost:3000/api/admin/deletion/deletion-status \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 3. Manually trigger deletion (for testing)
curl -X POST http://localhost:3000/api/admin/deletion/trigger-deletion \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 4. Check archives
curl -X POST http://localhost:3000/api/admin/deletion/archived-user \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "deleted@example.com"}'

# 5. Get audit trail
curl -X POST http://localhost:3000/api/admin/deletion/deletion-audit \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Security Considerations

✅ Admin-only access to deletion management endpoints
✅ Transactions ensure atomic operations
✅ Session-based concurrency control
✅ Complete audit trail for compliance
✅ Graceful shutdown with cron job cleanup
✅ Error handling & logging

---

## Support

For issues or questions about the deletion system, contact the development team.

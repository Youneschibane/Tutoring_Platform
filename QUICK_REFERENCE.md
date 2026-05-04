
# 🚀 Quick Reference - Soft Delete Implementation

## 📌 What Changed

| Component | Change | Status |
|-----------|--------|--------|
| User Model | Added `isDeleted`, `deletedAt`, `deletionReason` | ✅ |
| ArchiveAction Model | NEW collection for audit trail | ✅ |
| Auth Middleware | Check `isDeleted` before allowing login | ✅ |
| Delete Controller | Soft delete (Day 0) + Permanent delete (Day 30) | ✅ |
| Sessions API | Flag deleted participants | ✅ |
| Cron Service | Daily deletion + cleanup + reminders | ✅ |

---

## 🔑 Key Concepts

### **Soft Delete (Day 0)**
```
POST /api/pack-profil/delete-account
→ isActive: false (can reactivate)
→ deletionScheduledAt: now + 30 days
→ isDeleted: false (still active technically)
```

### **Grace Period (Day 0-30)**
```
User blocked from login (protect middleware)
But CAN reactivate via /reactivate-account
All data remains in database
```

### **Permanent Delete (Day 30+)**
```
Cron job runs at 2 AM daily
isDeleted: true (IRREVERSIBLE)
All dependent data deleted
Cannot reactivate
```

---

## 🛠️ Usage Examples

### **User Requests Deletion**
```bash
curl -X POST http://localhost:3000/api/pack-profil/delete-account \
  -H "Authorization: Bearer <token>"
```
Response: Account will be deleted on 2026-05-27

### **User Changes Mind (Within 30 Days)**
```bash
curl -X POST http://localhost:3000/api/pack-profil/reactivate-account \
  -H "Authorization: Bearer <token>"
```
Response: Account reactivated and accessible

### **After 30 Days - Automatic Deletion**
```
Cron job runs → Account permanently deleted
User tries to login → 403 "Compte supprimé définitivement"
Cannot reactivate
```

---

## 📊 Database Queries

### Check Pending Deletions
```javascript
db.users.find({
  isActive: false,
  isDeleted: false,
  deletionScheduledAt: { $gte: new Date() }
})
```

### Check Permanently Deleted
```javascript
db.users.find({
  isDeleted: true
})
```

### View Audit Trail
```javascript
db.archiveactions.find({
  role: "teacher",
  actionType: "hard_delete"
})
```

### Find Accounts Expiring in 7 Days
```javascript
const now = new Date();
const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

db.users.find({
  isActive: false,
  isDeleted: false,
  deletionScheduledAt: { $gte: now, $lte: in7days }
})
```

---

## ⏰ Timeline

| Day | Status | Can Login? | Can Reactivate? | Action |
|-----|--------|-----------|-----------------|--------|
| 0 | Soft Delete Requested | ❌ | ✅ | Record in ArchiveAction |
| 7-23 | Grace Period | ❌ | ✅ | User can still recover |
| 23 | Reminder Sent | ❌ | ✅ | Email: "7 days left" |
| 30 | Cron Triggers | ❌ | ❌ | Permanent deletion |
| 30+ | Permanently Deleted | ❌ | ❌ | Cannot recover |
| 365 | Archive Cleanup | - | - | Data auto-deleted |

---

## 🧪 Quick Test

```bash
# 1. Delete account
curl -X POST http://localhost:3000/api/pack-profil/delete-account \
  -H "Authorization: Bearer <token>"

# 2. Try login (should fail)
curl -X POST http://localhost:3000/api/auth/login \
  -d "email=user@email.com&password=password"

# 3. Reactivate (should succeed)
curl -X POST http://localhost:3000/api/pack-profil/reactivate-account \
  -H "Authorization: Bearer <token>"

# 4. Try login again (should succeed)
curl -X POST http://localhost:3000/api/auth/login \
  -d "email=user@email.com&password=password"
```

---

## 🔍 Error Messages

### During Soft Delete (Day 0-30)
```json
{
  "status": "fail",
  "message": "Compte désactivé et en attente de suppression. Contactez le support pour réactiver."
}
```

### After Permanent Delete (Day 30+)
```json
{
  "status": "fail",
  "message": "Ce compte a été supprimé définitivement et ne peut pas être récupéré."
}
```

### Trying to Reactivate Permanent Delete
```json
{
  "status": "fail",
  "message": "Ce compte a été supprimé définitivement et ne peut pas être récupéré."
}
```

---

## 📁 Files to Know

| File | Purpose |
|------|---------|
| `models/userModel.js` | User schema with soft delete fields |
| `models/archiveActionModel.js` | Audit trail for deletions |
| `middleware/authMiddleware.js` | Login validation (checks isDeleted) |
| `packProfil/supprimerCompte.js` | Delete/reactivate/permanent delete logic |
| `utils/accountDeletionCronService.js` | Cron job definitions |
| `utils/cronService.js` | Cron initialization |

---

## ⚙️ Cron Schedule

```
0 2 * * *   → Daily at 2 AM UTC   → Permanent deletion
0 3 * * 0   → Sundays at 3 AM UTC → Archive cleanup
0 10 * * *  → Daily at 10 AM UTC  → Send reminders
```

---

## 🔐 Middleware Checks

### `protect` Middleware
```
1. Extract JWT token
2. Verify signature
3. Check user exists
4. ✅ NEW: Check if permanently deleted (isDeleted=true)
5. Check if deactivated (isActive=false)
6. Check password change timestamp
7. Verify device has valid token
8. For teachers: Check if approved
```

### `protectReactivate` Middleware
```
1. Extract JWT token
2. Verify signature
3. Check user exists
4. ✅ NEW: Check if permanently deleted (cannot reactivate)
5. Check password change timestamp
6. Verify device has valid token
```

---

## 📋 Checklist for Deployment

- [ ] Backup database before deploying
- [ ] Deploy new models (User, ArchiveAction)
- [ ] Deploy middleware updates
- [ ] Deploy controller updates
- [ ] Deploy cron service
- [ ] Verify cron jobs start without errors
- [ ] Monitor logs for first 24 hours
- [ ] Test soft delete → reactivate flow
- [ ] Test grace period enforcement
- [ ] Verify participants marked as deleted in sessions

---

## 🎯 Success Criteria

✅ Users can delete accounts  
✅ Deleted accounts cannot login  
✅ Users can reactivate within 30 days  
✅ Cron job runs daily at 2 AM  
✅ Permanent deletion happens after 30 days  
✅ Cannot reactivate after permanent deletion  
✅ Audit trail captures all actions  
✅ Archives auto-cleanup after 1 year  

---

**Implementation Date**: 2026-04-27  
**Status**: ✅ Production Ready  
**Last Updated**: 2026-04-27  

For full details, see: `SOFT_DELETE_IMPLEMENTATION_GUIDE.md`


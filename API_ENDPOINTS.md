
# 📡 API Endpoints - Account Deletion & Recovery

## Base URL
```
http://localhost:3000/api
```

---

## 🗑️ Deletion & Recovery Endpoints

### 1. **Delete Account** (Soft Delete)
```
POST /pack-profil/delete-account
```

**Description**: Initiates account deletion with 30-day grace period

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body**:
```json
{}
// No body required - uses authenticated user from token
```

**Success Response** (200):
```json
{
  "status": "success",
  "message": "Compte désactivé. Suppression automatique dans 30 jours.",
  "deletionDate": "2026-05-27T10:30:00Z",
  "info": "Vous avez 30 jours pour récupérer votre compte. Après cette période, il sera supprimé définitivement."
}
```

**Error Responses**:
- `404` - User not found
- `400` - Account already deactivated or deleted
- `500` - Server error

**Status After Call**:
- `isActive: false`
- `deletionScheduledAt: Date + 30 days`
- `isDeleted: false` (still recoverable)

---

### 2. **Reactivate Account**
```
POST /pack-profil/reactivate-account
```

**Description**: Recover account within 30-day grace period

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body**:
```json
{}
// No body required - uses authenticated user from token
```

**Success Response** (200):
```json
{
  "status": "success",
  "message": "Compte réactivé avec succès.",
  "info": "Votre compte est maintenant actif et accessible."
}
```

**Error Responses**:
- `404` - User not found
- `400` - Account already active
- `403` - Account permanently deleted (cannot recover)
- `500` - Server error

**Status After Call**:
- `isActive: true`
- `deletionScheduledAt: null`
- `isDeleted: false` (still recoverable)

---

## 🔐 Authentication Affected Endpoints

### **Login After Deletion**
```
POST /api/auth/login
```

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response if Account is Soft Deleted** (403):
```json
{
  "status": "fail",
  "message": "Compte désactivé et en attente de suppression. Contactez le support pour réactiver."
}
```

**Response if Account is Permanently Deleted** (403):
```json
{
  "status": "fail",
  "message": "Ce compte a été supprimé définitivement et ne peut pas être récupéré."
}
```

---

## 📊 Session Endpoints (With Participant Status)

### **Get Upcoming Sessions**
```
GET /api/session/upcoming/:id_eleve
```

**Response** (200):
```json
{
  "success": true,
  "count": 2,
  "sessions": [
    {
      "_id": "60d5ec49c1234567890abcde",
      "id_seance": 1001,
      "titre": "Advanced Mathematics",
      "date_seance": "2026-05-15T10:00:00Z",
      "statut": "confirmee",
      "etudiants": [
        "60d5ec49c1234567890aaaaa",
        "60d5ec49c1234567890bbbbb"
      ],
      "participantsStatus": [
        {
          "studentId": "60d5ec49c1234567890aaaaa",
          "studentName": "John Doe",
          "status": "active",
          "isDeleted": false,
          "deletedAt": null
        },
        {
          "studentId": "60d5ec49c1234567890bbbbb",
          "studentName": "Jane Smith",
          "status": "permanently_deleted",
          "isDeleted": true,
          "deletedAt": "2026-04-20T00:00:00Z"
        }
      ]
    }
  ]
}
```

### **Get Past Sessions**
```
GET /api/session/past/:id_eleve
```

**Response**: Same structure as upcoming sessions but for completed sessions

**Note**: Each session includes `participantsStatus` array showing deletion status

---

## 👤 User Profile Affected Endpoints

### **Get Current User Profile** (After Soft Delete)
```
GET /api/user/me
```

**Response** (403):
```json
{
  "status": "fail",
  "message": "Compte désactivé et en attente de suppression. Contactez le support pour réactiver."
}
```

---

## ⏰ Scheduled Deletion Timeline

### What Happens Automatically:

**Day 0** (Immediately):
- `POST /pack-profil/delete-account` called
- `isActive` set to `false`
- `deletionScheduledAt` set to Day 30

**Day 7-23** (Optional):
- Reactivation still possible
- User not sent any notifications

**Day 23** (Automatic):
- ⚠️ Reminder email sent (TODO: implement)
- "Your account will be deleted in 7 days"

**Day 30** (Automatic):
- Cron job runs at 2 AM UTC
- `isDeleted` set to `true`
- All dependent data deleted (based on role)
- `ArchiveAction` record created with snapshot

**Day 30+** (After permanent deletion):
- User cannot login
- User cannot reactivate
- Cannot be recovered

**Day 365** (Automatic):
- Archive records auto-deleted via TTL index

---

## 🔧 Admin Endpoints (Optional)

### **Check Cron Job Status**
```
GET /api/admin/cron-status
```

**Response** (200):
```json
{
  "tasks": 3,
  "jobs": [
    {
      "name": "Permanent Account Deletion",
      "schedule": "0 2 * * * (Daily at 2 AM UTC)",
      "description": "Permanently delete accounts after 30-day grace period"
    },
    {
      "name": "Archive Cleanup",
      "schedule": "0 3 * * 0 (Sundays at 3 AM UTC)",
      "description": "Clean up expired archive records"
    },
    {
      "name": "Deletion Reminders",
      "schedule": "0 10 * * * (Daily at 10 AM UTC)",
      "description": "Send reminder emails before permanent deletion"
    }
  ]
}
```

### **Manually Trigger Deletion** (Testing)
```
POST /api/admin/trigger-deletion
```

**Response** (200):
```json
{
  "success": true,
  "message": "Permanent deletion triggered",
  "accountsDeleted": 3,
  "details": [
    {
      "userId": "60d5ec49c1234567890abcde",
      "email": "user1@example.com",
      "status": "deleted"
    }
  ]
}
```

---

## 📝 Request/Response Examples

### **Complete Deletion Flow**

#### Step 1: Request Deletion
```bash
curl -X POST http://localhost:3000/api/pack-profil/delete-account \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "status": "success",
  "message": "Compte désactivé. Suppression automatique dans 30 jours.",
  "deletionDate": "2026-05-27T10:30:00Z"
}
```

#### Step 2: Try to Login (Should Fail)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Response**:
```json
{
  "status": "fail",
  "message": "Compte désactivé et en attente de suppression. Contactez le support pour réactiver."
}
```

#### Step 3: Reactivate Within 30 Days
```bash
curl -X POST http://localhost:3000/api/pack-profil/reactivate-account \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "status": "success",
  "message": "Compte réactivé avec succès.",
  "info": "Votre compte est maintenant actif et accessible."
}
```

#### Step 4: Login Again (Should Work)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "user": {...},
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 📑 Common Error Codes

| Code | Message | Meaning |
|------|---------|---------|
| `400` | "Ce compte est déjà désactivé." | Already in soft delete |
| `400` | "Ce compte est déjà actif." | Already active (not deleted) |
| `403` | "Compte désactivé et en attente de suppression..." | During grace period (Day 0-30) |
| `403` | "Ce compte a été supprimé définitivement..." | Permanently deleted (Day 30+) |
| `404` | "Utilisateur introuvable." | User does not exist |
| `500` | Error message | Server error |

---

## 🔄 Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ User Initiates Deletion                                 │
│ POST /pack-profil/delete-account                        │
└─────────────────────┬───────────────────────────────────┘
                      ↓
        ┌──────────────────────────────┐
        │ SOFT DELETE (Day 0)           │
        │ isActive: false               │
        │ isDeleted: false              │
        │ REVERSIBLE                    │
        └──────────────┬─────────────────┘
                      ↓
        ┌──────────────────────────────┐
        │ GRACE PERIOD (Day 0-30)       │
        │ Cannot login                  │
        │ Can reactivate                │
        └────┬──────────────────────┬───┘
             │                      │
         ✅ REACTIVATE          ⏰ DAY 30
             │                      │
             ↓                      ↓
    ┌─────────────────┐  ┌──────────────────────┐
    │ Account Active  │  │ PERMANENT DELETE     │
    │ Accessible      │  │ isDeleted: true      │
    │                 │  │ IRREVERSIBLE         │
    └─────────────────┘  └──────────────┬───────┘
                                        ↓
                         ┌──────────────────────┐
                         │ Cannot Login         │
                         │ Cannot Reactivate    │
                         │ Archived             │
                         └──────────────┬───────┘
                                        ↓
                         ┌──────────────────────┐
                         │ DAY 365              │
                         │ Archive Cleanup      │
                         │ Records Deleted      │
                         └──────────────────────┘
```

---

## 🚀 Integration Notes

- All endpoints require valid JWT token (except login)
- Use the JWT token from authentication response
- Token includes user `id` used for identifying the account
- Cascade deletion happens by role (student/parent/teacher)
- Session participants flagged as deleted for visibility

---

**API Version**: 1.0  
**Last Updated**: 2026-04-27  
**Status**: ✅ Production Ready


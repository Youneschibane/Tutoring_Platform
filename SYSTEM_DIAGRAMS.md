
# 🔄 System Diagrams - Soft Delete Implementation

## 1. Complete Deletion Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ACCOUNT DELETION FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

                          USER REQUESTS DELETION
                                   ↓
                    POST /api/pack-profil/delete-account
                                   ↓
                    ┌──────────────────────────────┐
                    │  SOFT DELETE (Day 0)         │
                    │  ✓ isActive: false           │
                    │  ✓ isDeleted: false          │
                    │  ✓ deletionScheduledAt: +30d │
                    │  ✓ Record in ArchiveAction   │
                    └────────────┬─────────────────┘
                                 ↓
    ┌────────────────────────────────────────────────────────┐
    │  GRACE PERIOD (Day 0-30)                              │
    │  ✗ Cannot Login (protect middleware blocks)           │
    │  ✓ Can Reactivate                                     │
    │  ✓ All Data Preserved                                 │
    ├────────────┬──────────────────────────┬───────────────┤
    │            │                          │               │
    │        ✅ USER                    ⏰ DAY 23        ⏰ DAY 30
    │        REACTIVATES               REMINDER       AUTOMATIC
    │            │                      EMAIL         PERMANENT
    │            ↓                          │          DELETION
    │   ┌─────────────────┐                │             │
    │   │ Account Active  │                │             ↓
    │   │ ✓ isActive:true │                │    ┌──────────────────────┐
    │   │ Accessible      │                │    │ PERMANENT DELETE     │
    │   └─────────────────┘                │    │ ✓ isDeleted: true    │
    │                                       │    │ ✓ Cascade deletion   │
    │                                       │    │ ✓ Archive snapshot   │
    │                                       │    └──────────┬───────────┘
    │                                       │              ↓
    │                                       └────→ ┌──────────────────────┐
    │                                              │ PERMANENT STATE      │
    │                                              │ ✗ Cannot Login       │
    │                                              │ ✗ Cannot Reactivate  │
    │                                              │ ✗ Cannot Recover     │
    │                                              └──────────┬───────────┘
    │                                                         ↓
    │                                              ┌──────────────────────┐
    │                                              │ DAY 365              │
    │                                              │ Archive Cleanup      │
    │                                              │ TTL Index Deletes    │
    │                                              └──────────────────────┘
    └────────────────────────────────────────────────────────┘
```

---

## 2. Authentication Flow (protect Middleware)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW (protect)                      │
└──────────────────────────────────────────────────────────────────────┘

              User sends request with JWT token
                            ↓
                   Extract & Verify Token
                            ↓
                    Check User Exists
                            ↓
        ┌────────────────────────────────────────┐
        │   NEW: Check if Permanently Deleted    │
        │   if (user.isDeleted === true)         │
        ├────────────────────────────────────────┤
        │ ✓ YES → 403 "Permanently deleted"      │
        │ ✗ NO → Continue                        │
        └────┬─────────────────────────────────┬─┘
             │                                 │
        ┌────↓──────────────────┐     ┌───────↓──────────────────┐
        │ Check if Deactivated  │     │ Continue Checks          │
        │ if (!user.isActive)   │     │ • Password timestamp     │
        ├───────────────────────┤     │ • Device token          │
        │ ✓ YES → 403 "Pending" │     │ • Teacher approval      │
        │ ✗ NO → Continue       │     └────────────────────────┘
        └───────────────────────┘                │
                                                 ↓
                                        ✅ AUTHENTICATED
                                     User can access endpoint
```

---

## 3. Cascade Deletion by Role

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CASCADE DELETION BY ROLE                           │
└──────────────────────────────────────────────────────────────────────┘

STUDENT DELETION              PARENT DELETION           TEACHER DELETION
──────────────────           ─────────────────         ──────────────────
  Student                      Parent                    Teacher
    ↓                            ↓                         ↓
Remove from all            Get all children          Get all services
sessions (Seance)          from Parent.enfants       (Service table)
    ↓                            ↓                         ↓
Delete Student             For each child:            Get all sessions
profile                    - Remove from sessions    (Seance table)
    ↓                      - Delete child profile         ↓
Record in                      ↓                      Delete all services
ArchiveAction           Delete Parent profile            ↓
    ↓                          ↓                      Delete all sessions
COMPLETE                  Record cascade             (removes participants)
                          in ArchiveAction                ↓
                               ↓                      Delete Teacher
                          COMPLETE                   profile
                                                        ↓
                                                    Record cascade
                                                    in ArchiveAction
                                                        ↓
                                                    COMPLETE
```

---

## 4. Cron Job Schedule

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CRON JOB EXECUTION SCHEDULE                        │
└──────────────────────────────────────────────────────────────────────┘

                          WEEK VIEW

    MONDAY                   WEDNESDAY                SUNDAY
    ──────                   ─────────                ──────
    
    2 AM ✓ Delete           2 AM ✓ Delete            2 AM ✓ Delete
    10 AM ✓ Remind          10 AM ✓ Remind           10 AM ✓ Remind
                                                     3 AM ✓ Archive Clean


                          DAY VIEW (Example: Monday)

    00:00 ─────────────────────────────────────────────────────
    01:00 ─────────────────────────────────────────────────────
    
    02:00 🔧 PERMANENT DELETION JOB ✓
           • Find accounts with isActive: false
           • Find accounts with deletionScheduledAt <= now
           • Call permanentlyDeleteAccount() for each
           • Log results
    
    03:00 ─────────────────────────────────────────────────────
    ...
    10:00 📧 REMINDER EMAIL JOB ✓
           • Find accounts scheduled deletion in next 7 days
           • Send reminder emails
           • Log notifications
    
    11:00 ─────────────────────────────────────────────────────


                      ARCHIVE CLEANUP (Sundays)
    
    03:00 🗑️ ARCHIVE CLEANUP JOB ✓
           • Find ArchiveAction records with retentionUntil <= now
           • Delete them (TTL is primary method)
           • Log cleanup count

```

---

## 5. Database State Transitions

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DATABASE STATE TRANSITIONS                         │
└──────────────────────────────────────────────────────────────────────┘

USER TABLE STATE CHANGES
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│ INITIAL STATE (Active User)                                    │
│ ┌────────────────────────────────────────┐                     │
│ │ _id:                  ObjectId         │                     │
│ │ email:                user@email.com   │                     │
│ │ isActive:             true             │                     │
│ │ isDeleted:            false            │                     │
│ │ deletionScheduledAt:  null             │                     │
│ └────────────────────────────────────────┘                     │
│          ↓ POST /delete-account                                │
│                                                                 │
│ SOFT DELETE STATE (Day 0-30)                                   │
│ ┌────────────────────────────────────────┐                     │
│ │ _id:                  ObjectId         │                     │
│ │ email:                user@email.com   │                     │
│ │ isActive:             false ⚠️          │                     │
│ │ isDeleted:            false            │                     │
│ │ deletionScheduledAt:  2026-05-27 ⏰    │                     │
│ └────────────────────────────────────────┘                     │
│   ├─ CAN REACTIVATE ✓ →                                        │
│   │     ↓ POST /reactivate-account                             │
│   │     Back to INITIAL STATE                                  │
│   │                                                             │
│   └─ AUTOMATIC DELETION ⏰ →                                    │
│           ↓ Cron job (Day 30)                                  │
│                                                                 │
│ PERMANENTLY DELETED STATE (Day 30+)                            │
│ ┌────────────────────────────────────────┐                     │
│ │ _id:                  ObjectId         │                     │
│ │ email:                user@email.com   │                     │
│ │ isActive:             false            │                     │
│ │ isDeleted:            true 🔒          │                     │
│ │ deletedAt:            2026-05-27 ✓     │                     │
│ │ deletionReason:       "user_request"   │                     │
│ └────────────────────────────────────────┘                     │
│   ├─ CANNOT REACTIVATE ✗                                       │
│   └─ CANNOT LOGIN ✗                                            │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

ARCHIVE ACTION TABLE (Audit Trail)
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│ RECORD CREATED ON SOFT DELETE (Day 0)                          │
│ ┌────────────────────────────────────────┐                     │
│ │ userId:              ObjectId          │                     │
│ │ idmembre:            12345             │                     │
│ │ role:                "teacher"         │                     │
│ │ actionType:          "soft_delete"     │                     │
│ │ userSnapshot:        { ...full data }  │                     │
│ │ permanentlyDeletedAt: null             │                     │
│ │ retentionUntil:      2027-04-27        │                     │
│ └────────────────────────────────────────┘                     │
│          ↓ Cron job (Day 30)                                   │
│                                                                 │
│ RECORD UPDATED ON PERMANENT DELETE (Day 30)                    │
│ ┌────────────────────────────────────────┐                     │
│ │ userId:              ObjectId          │                     │
│ │ idmembre:            12345             │                     │
│ │ role:                "teacher"         │                     │
│ │ actionType:          "hard_delete" ✓   │                     │
│ │ userSnapshot:        { ...full data }  │                     │
│ │ permanentlyDeletedAt: 2026-05-27 ✓     │                     │
│ │ cascadedDeletions:   { ...details }    │                     │
│ │ retentionUntil:      2027-04-27        │                     │
│ └────────────────────────────────────────┘                     │
│          ↓ TTL index (Day 365)                                 │
│                                                                 │
│ RECORD AUTO-DELETED (Day 365)                                  │
│ ✓ MongoDB TTL index automatically deletes this record          │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 6. Session Participant Status Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│            SESSION RETRIEVAL WITH PARTICIPANT STATUS                  │
└──────────────────────────────────────────────────────────────────────┘

GET /api/session/upcoming/:id_eleve
          ↓
    Load Session
    Find.populate('etudiants')
          ↓
Call enrichSessionWithDeletedStatus()
          ↓
For each student in session:
  ├─ Load Student record
  ├─ Load User record (with +isDeleted field)
  └─ Build participantsStatus object:
     ├─ studentId: ObjectId
     ├─ studentName: "John Doe"
     ├─ status: "active" or "permanently_deleted"
     ├─ isDeleted: Boolean
     └─ deletedAt: Date or null
          ↓
    Return Session + participantsStatus array

RESPONSE EXAMPLE:
{
  "success": true,
  "sessions": [
    {
      "id_seance": 1001,
      "titre": "Math Class",
      "etudiants": [ ... ],
      "participantsStatus": [
        {
          "studentId": "ObjectId1",
          "studentName": "John Doe",
          "status": "active",
          "isDeleted": false,
          "deletedAt": null
        },
        {
          "studentId": "ObjectId2",
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

---

## 7. Error Response Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    ERROR RESPONSE FLOW                                │
└──────────────────────────────────────────────────────────────────────┘

USER ATTEMPTS LOGIN
        ↓
    Check User
        ├─ Not found? → 404 "User not found"
        └─ Found ✓
              ↓
    Check isDeleted
        ├─ isDeleted: true? → 403 "Permanently deleted"
        │   (Cannot recover, no reactivation possible)
        │
        └─ isDeleted: false
              ↓
         Check isActive
             ├─ isActive: false? → 403 "Deactivated"
             │  (In grace period, offer reactivation)
             │
             └─ isActive: true
                    ↓
              Continue auth flow
                    ↓
              Check other validations
                    ↓
                ✅ LOGIN SUCCESS


RESPONSE EXAMPLES:

Permanently Deleted:
{
  "status": "fail",
  "message": "Ce compte a été supprimé définitivement et ne peut pas être récupéré."
}
Code: 403

Deactivated (Soft Delete):
{
  "status": "fail",
  "message": "Compte désactivé et en attente de suppression. Contactez le support pour réactiver."
}
Code: 403

Success:
{
  "status": "success",
  "data": { ... }
}
Code: 200
```

---

## 8. Transaction Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    TRANSACTION CONSISTENCY                            │
└──────────────────────────────────────────────────────────────────────┘

START TRANSACTION
        ↓
   UPDATE User
   (SET isActive: false, deletionScheduledAt: +30 days)
        ├─ Failed? → ROLLBACK, Return Error
        └─ Success ✓
              ↓
   CREATE/UPDATE AccountDeletion
   (Record the deletion request)
        ├─ Failed? → ROLLBACK, Return Error
        └─ Success ✓
              ↓
   CREATE ArchiveAction
   (Store snapshot for audit trail)
        ├─ Failed? → ROLLBACK, Return Error
        └─ Success ✓
              ↓
   COMMIT TRANSACTION
        ├─ Failed? → ROLLBACK, All changes undone
        └─ Success ✓
              ↓
   ✅ All changes persisted consistently
        ↓
   Return Success Response


PERMANENT DELETION TRANSACTION:

START TRANSACTION
        ↓
   ROLE-SPECIFIC CASCADE DELETION
        │
        ├─ IF Teacher:
        │  ├─ Delete all Services
        │  ├─ Delete all Sessions
        │  └─ Delete Teacher profile
        │
        ├─ IF Parent:
        │  ├─ Delete all children from Sessions
        │  ├─ Delete all Student profiles
        │  └─ Delete Parent profile
        │
        └─ IF Student:
           ├─ Remove from all Sessions
           └─ Delete Student profile
        ↓
   UPDATE User
   (SET isDeleted: true, deletedAt: now)
        ├─ Failed? → ROLLBACK, Cascade not deleted
        └─ Success ✓
              ↓
   DELETE all Devices
        ├─ Failed? → ROLLBACK
        └─ Success ✓
              ↓
   UPDATE ArchiveAction
   (SET actionType: "hard_delete", permanentlyDeletedAt: now)
        ├─ Failed? → ROLLBACK
        └─ Success ✓
              ↓
   COMMIT TRANSACTION
        ├─ Failed? → ROLLBACK, Everything reverted
        └─ Success ✓
              ↓
   ✅ Complete permanent deletion persisted
```

---

**Generated**: 2026-04-27  
**Status**: ✅ Production Ready


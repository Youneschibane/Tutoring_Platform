# Professional Account Management - Implementation Guide

## Overview
This upgrade implements industry-standard security patterns used by companies like Google, Facebook, Slack, and Twitter.

---

## 🔐 PASSWORD CHANGE (Two-Step Verification)

### Why Two-Step?
- **Security**: OTP prevents attackers who have compromised one password
- **Non-repudiation**: Proves the user initiated the change
- **Account recovery**: Can't be done remotely; requires email/SMS access

### Flow:
```
1. User submits current password
2. System sends OTP to email/SMS (6 digits, 10-min expiry)
3. User enters OTP + new password
4. All devices are logged out (force re-login)
5. Security notification sent
```

### Files Modified:
- `updatePassword.js` - Two endpoints: request OTP + confirm
- `otpModel.js` - Added 'password_change' purpose

### API:
```
POST /auth/password/request-otp
  { currentPassword }
  
POST /auth/password/confirm
  { otp, newPassword }
  -> All devices auto-logout (security feature)
```

---

## ✏️ PROFILE UPDATES (Smart OTP Detection)

### Smart Behavior:
- **Non-sensitive fields** (firstname, familyname, postaladr): ✅ Direct update
- **Sensitive fields** (email, phone): ⚠️ Requires OTP verification

### Why?
- Balance **UX** (no friction for minor updates)
- With **security** (protects critical contact info)

### Sensitive Field Detection:
```javascript
SENSITIVE_FIELDS = ['email', 'phone', 'numberphone']
```

### Flow:
```
1. User provides updates
   ↓
2. System detects field types
   ├─ Non-sensitive → Direct update ✅
   └─ Sensitive → Send OTP
       ├─ User confirms with OTP
       └─ Updates applied ✅
```

### Files Modified:
- `updateProfile.js` - Smart OTP detection + dual-path updates
- `otpModel.js` - Added 'profile_change' purpose

### API:
```
POST /auth/profile/request-update-otp
  { email, phone, firstname, ... }
  -> Returns: { requiresOtp: true/false }
  
PUT /auth/profile/update
  { firstname, email, phone, otp?, photo? }
```

---

## 🗑️ ACCOUNT DELETION (7-Day Grace Period)

### Why Grace Period?
- Prevents accidental deletion
- GDPR-compliant soft delete
- Allows recovery within 7 days
- Gives user time to notify contacts/backup data

### Professional Pattern:
Most apps DON'T delete immediately:
- **Google**: 60-day grace period + recovery email
- **Facebook**: 30-day grace period
- **LinkedIn**: 24-hour grace period
- **Slack**: 30-day grace period

### Flow:
```
Step 1: User submits password
Step 2: System sends OTP
Step 3: User confirms with OTP
Step 4: Account marked for deletion (7 days)
        - User deactivated immediately
        - All sessions terminated
        - Marked in AccountDeletion table
Step 5: User can cancel within 7 days
Step 6: Auto-delete after 7 days (background job)
```

### Security Features:
- ✅ Password verification (not just OTP)
- ✅ Immediate deactivation + session termination
- ✅ Email confirmation sent
- ✅ Reversible within grace period
- ✅ Audit trail maintained

### Files Created/Modified:
- `supprimerCompte.js` - Three endpoints: request + confirm + cancel
- `accountDeletionModel.js` - NEW: Tracks deletion schedules
- `otpModel.js` - Added 'account_deletion' purpose

### API:
```
POST /auth/account/request-deletion
  { password }
  -> { deletionDate, contact }
  
POST /auth/account/confirm-deletion
  { otp }
  -> Account deactivated, scheduled for deletion
  
POST /auth/account/cancel-deletion
  {}
  -> Deletion cancelled, account reactivated
```

---

## 🔄 Data Model Updates

### OTP Model Enhancement:
```javascript
// Before:
enum: ['signup', 'reset']

// After:
enum: ['signup', 'reset', 'password_change', 'profile_change', 'account_deletion']
```

### New Model: AccountDeletion
```javascript
{
  userId: ObjectId,
  email: String,
  phone: String,
  requestedAt: Date,
  deletionScheduledFor: Date,  // +7 days
  status: 'pending' | 'cancelled' | 'completed',
  reason: String,
  cancelledAt: Date,
  deletedAt: Date
}
```

---

## 📊 Notifications Sent

| Action | Channel | When |
|--------|---------|------|
| Password Change | Email + SMS | Immediately after confirmation |
| Profile Update | Email | After sensitive fields change |
| Delete Request | Email + SMS | On confirmation |
| Delete Cancelled | Email | User cancels deletion |

**Example Message:**
```
🔐 Alerte de sécurité : Votre mot de passe a été changé. 
Tous les appareils ont été déconnectés. 
Si ce n'était pas vous, changez votre mot de passe immédiatement.
```

---

## 🎯 Security Best Practices Implemented

### 1. Two-Factor Verification
- ✅ Password + OTP for sensitive operations
- ✅ Non-repudiation (user can't claim they didn't do it)

### 2. Session Management
- ✅ Force re-login after password change
- ✅ Terminate all devices on deletion
- ✅ Device reactivation after logout

### 3. Data Integrity
- ✅ MongoDB transactions (all-or-nothing)
- ✅ Rollback on errors
- ✅ Audit trails maintained

### 4. Rate Limiting (Ready for):
- OTP attempts: Max 5 attempts per identifier
- OTP expiry: 10 minutes (auto-delete)
- Can be enhanced with: Redis + express-rate-limit

### 5. Sensitive Field Detection
- ✅ Smart OTP requirement only for critical fields
- ✅ Non-sensitive updates = instant gratification
- ✅ Prevents UX friction while maintaining security

---

## 🚀 To Complete Setup:

### 1. Update Routes
Add to your `routes/authRoutes.js` or create `routes/packProfilRoutes.js`:
```javascript
router.post('/password/request-otp', protect, passwordController.requestPasswordChangeOtp);
router.post('/password/confirm', protect, passwordController.confirmPasswordChange);
router.post('/profile/request-update-otp', protect, profileController.requestProfileUpdateOtp);
router.put('/profile/update', protect, upload.single('photo'), profileController.updateProfile);
router.post('/account/request-deletion', protect, deletionController.requestAccountDeletion);
router.post('/account/confirm-deletion', protect, deletionController.confirmAccountDeletion);
router.post('/account/cancel-deletion', protect, deletionController.cancelAccountDeletion);
```

### 2. Background Job (Delete Accounts After Grace Period)
Create a cron job in your server:
```javascript
// Run daily at midnight
const schedule = require('node-schedule');

schedule.scheduleJob('0 0 * * *', async () => {
  const now = new Date();
  const deletions = await AccountDeletion.find({
    status: 'pending',
    deletionScheduledFor: { $lte: now }
  });
  
  for (const deletion of deletions) {
    await User.findByIdAndDelete(deletion.userId);
    await deletion.updateOne({ status: 'completed', deletedAt: now });
    console.log(`Account ${deletion.email} permanently deleted`);
  }
});
```

### 3. Update User Model
Ensure User model has `isActive` field:
```javascript
isActive: { type: Boolean, default: true }
```

### 4. Frontend Implementation
See `ROUTES_IMPLEMENTATION_GUIDE.js` for frontend code examples

---

## 📈 Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| Password Change | 1 step | 2 steps (OTP) |
| Profile Update | 1 step | 1-2 steps (smart OTP) |
| Account Delete | Instant | 3 steps + 7-day grace |
| Security | Basic | Enterprise-grade |
| Recovery | ❌ | ✅ (7 days) |
| Audit Trail | ❌ | ✅ |
| Session Management | Basic | Advanced |
| Device Invalidation | ❌ | ✅ |

---

## 🔧 Customization Options

### Adjust Grace Period:
```javascript
// In confirmAccountDeletion
const deletionDate = new Date();
deletionDate.setDate(deletionDate.getDate() + 14); // Change to 14 days
```

### Adjust OTP Expiry:
```javascript
// In otpModel.js
createdAt: { type: Date, default: Date.now, expires: 300 } // 5 minutes instead of 10
```

### Add Rate Limiting:
```javascript
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 attempts
});

router.post('/password/request-otp', otpLimiter, passwordController.requestPasswordChangeOtp);
```

---

## ✅ Testing Checklist

- [ ] Request OTP for password change
- [ ] Confirm password change with OTP
- [ ] Verify all devices logged out
- [ ] Request OTP for profile (non-sensitive) - should skip OTP
- [ ] Request OTP for profile (email/phone change) - should require OTP
- [ ] Update profile with OTP
- [ ] Request account deletion
- [ ] Confirm account deletion with OTP
- [ ] Verify account deactivated
- [ ] Cancel account deletion within 7 days
- [ ] Verify account reactivated
- [ ] Check email/SMS notifications sent

---

## 📚 References

- Google Account Security: https://support.google.com/accounts
- OWASP Authentication Cheat Sheet
- GDPR Data Deletion Requirements
- Industry Best Practices (Facebook, Slack, LinkedIn)

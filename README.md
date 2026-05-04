# Tutoring Platform

A comprehensive online tutoring platform that connects teachers and students, enabling seamless booking, service management, and educational content sharing.

## 🎯 Features

- **User Management**: Multi-role authentication (Admin, Teacher, Student, Parent)
- **Service Management**: Teachers create and manage tutoring services
- **Session Booking**: Students can reserve tutoring sessions
- **Document Management**: Teachers can upload and manage diplomas and certifications
- **User Search**: Advanced search for teachers with filters
- **Device Tracking**: Multi-device session management with JWT authentication
- **Account Deletion**: Secure account deletion with 30-day grace period
- **Notifications**: Real-time notifications for appointments and updates
- **File Management**: Cloudinary integration for profile photos and documents
- **Admin Dashboard**: Comprehensive admin controls for platform management

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: MongoDB 9.x (Mongoose ODM)
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: Cloudinary
- **Email Service**: Nodemailer & Resend
- **SMS Service**: Twilio
- **Scheduling**: node-cron

### Security
- **Helmet**: HTTP security headers
- **CORS**: Cross-origin resource sharing
- **XSS Protection**: xss package
- **Rate Limiting**: express-rate-limit
- **HPP**: HTTP Parameter Pollution protection
- **Bcrypt**: Password hashing

### Additional Tools
- **Swagger UI**: API documentation
- **Morgan**: HTTP request logging
- **Multer**: File upload handling
- **UAParser**: User-agent parsing
- **GeoIP Lite**: Geographic IP lookup

## 📦 Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn
- MongoDB database
- Cloudinary account
- Twilio account (optional, for SMS)
- Email service credentials (Nodemailer or Resend)

### Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd Tutoring_Platform
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/tutoring_platform

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=90d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Services
RESEND_API_KEY=your_resend_key
NODEMAILER_EMAIL=your_email@gmail.com
NODEMAILER_PASSWORD=your_app_password

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Firebase (optional)
FIREBASE_PROJECT_ID=your_firebase_project

# Google Maps
GOOGLE_MAPS_API_KEY=your_maps_key
```

4. **Start the development server**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 🚀 Usage

### Development
```bash
npm run dev
```
Runs the server with auto-reload using nodemon.

### Production
```bash
npm start
```
Runs the server normally.

### API Documentation
Access Swagger UI at: `http://localhost:3000/api-docs`

## 📁 Project Structure

```
Tutoring_Platform/
├── Config/                    # Configuration files
│   ├── cloudinaryConfig.js   # Cloudinary setup
│   └── uploadMiddleware.js   # File upload middleware
├── controllers/              # Request handlers
│   ├── adminTeacherController.js
│   ├── serviceController.js
│   ├── adminDiplomeController.js
│   └── ...
├── models/                   # MongoDB schemas
│   ├── userModel.js
│   ├── teacherModel.js
│   ├── studentModel.js
│   └── ...
├── routes/                   # API routes
│   ├── authRoutes.js
│   ├── serviceRoutes.js
│   ├── adminTeacherRoutes.js
│   └── ...
├── middleware/               # Custom middleware
│   ├── authMiddleware.js     # JWT verification
│   └── upload.js             # File upload config
├── utils/                    # Utility functions
│   ├── sendEmail.js
│   ├── sendSMS.js
│   ├── cronService.js
│   └── ...
├── generateID/               # ID generation
├── gestionDuDocument/        # Document management
├── packProfil/               # Profile management
├── Sign_In_Up/               # Authentication modules
├── Search_Services/          # Search functionality
├── Reserve_session/          # Session reservation
├── app.js                    # Express app setup
├── server.js                 # Server entry point
├── package.json              # Dependencies
└── README.md                 # This file
```

## 🔐 Authentication

The platform uses JWT-based authentication with device tracking:

- **Token Format**: Bearer token in Authorization header
- **Token Duration**: 90 days
- **Device Tracking**: Each login creates a device record
- **Multi-Device Support**: Users can stay logged in on multiple devices
- **Session Invalidation**: Password changes invalidate all active sessions

### Authentication Flow
1. User signs up/logs in
2. System creates JWT token and device record
3. Token stored in Authorization header for subsequent requests
4. Device status checked on each request

## 📚 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - Login user
- `POST /api/auth/logout` - Logout user

### Services
- `GET /api/service` - List all services
- `POST /api/service` - Create service (Teacher)
- `PUT /api/service/:id` - Update service
- `DELETE /api/service/:id` - Delete service

### Sessions
- `GET /api/session` - List sessions
- `POST /api/session` - Create session
- `GET /api/session/:id` - Get session details
- `PATCH /api/session/:id` - Update session

### Admin
- `GET /api/admin/teachers` - List teachers awaiting approval
- `PATCH /api/admin/teachers/:id/approve` - Approve teacher
- `GET /api/admin/diplomes` - List pending diplomas
- `PATCH /api/admin/diplomes/accept/:id` - Accept diploma

### Search
- `POST /api/search/searchTeachers` - Advanced teacher search
- `GET /api/search/searchBar` - Quick search

### Documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/:id` - Get document
- `DELETE /api/documents/:id` - Delete document

See `/api-docs` for complete endpoint documentation.

## 🔒 Security Features

✅ **Password Security**
- Bcrypt hashing with salt rounds
- Password change validation
- Password reset with OTP

✅ **API Security**
- Rate limiting (500 requests per 15 minutes)
- CORS configuration
- Helmet for security headers
- XSS protection
- HPP (HTTP Parameter Pollution) protection

✅ **Data Protection**
- JWT token encryption
- Device-specific token validation
- Secure file upload validation
- MongoDB injection prevention

✅ **Account Management**
- Soft delete with 30-day recovery window
- Account deactivation
- Device tracking and logout
- Multi-device session management

## 📝 Models Overview

### User
- Authentication credentials
- Personal information
- Device tracking
- Account status (active/deleted)
- Password change history

### Teacher
- Qualifications and diplomas
- Subjects and specialties
- Availability schedule
- Service history
- Document uploads
- Acceptance status (admin approval required)

### Student
- Academic level
- Preferred subjects
- Session history
- Reservations

### Service
- Service details and pricing
- Availability slots
- Booked sessions
- Teacher association

### Session
- Scheduling information
- Participants
- Status tracking
- Completion records

### Device
- Device identification
- Last used timestamp
- IP address and location
- User agent information

## 🔄 Workflow Examples

### Teacher Registration & Approval
1. Teacher signs up with basic info
2. Teacher uploads diplomas (pending admin approval)
3. Admin reviews diplomas and approves
4. Teacher can now create services
5. Students can book sessions

### Student Booking a Session
1. Student searches for teachers
2. Filters by subject, availability, location
3. Views teacher profile and services
4. Reserves available session slot
5. Receives confirmation notification

### Account Deletion
1. User requests account deletion
2. Account marked as inactive (30-day grace period)
3. User can reactivate within 30 days
4. After 30 days, account permanently deleted
5. All associated data cleaned up

## 🐛 Error Handling

All API endpoints return consistent response format:

```json
{
  "status": "success|fail|error",
  "message": "Human-readable message",
  "data": {}
}
```

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Server Error

## 📊 Database Indexes

Recommended indexes for performance:

```javascript
// Users
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ idmembre: 1 })

// Teachers
db.teachers.createIndex({ id_enseignant: 1 }, { unique: true })
db.teachers.createIndex({ acceptanceStatus: 1 })

// Services
db.services.createIndex({ id_enseignant: 1 })
db.services.createIndex({ isDeleted: 1 })

// Sessions
db.sessions.createIndex({ service: 1 })
db.sessions.createIndex({ date_seance: 1 })
```

## 🚧 Scheduled Tasks

The platform uses `node-cron` for scheduled operations:

- **Account Cleanup**: Daily deletion of accounts past 30-day grace period
- **Session Reminders**: Send reminders 24 hours before sessions
- **Notification Cleanup**: Archive old notifications

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 👥 Authors

- Development Team

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Contact support team

## 🔄 Recent Updates

- ✅ Fixed critical file naming issues
- ✅ Removed duplicate and test files
- ✅ Implemented admin diploma approval workflow
- ✅ Added device tracking for sessions
- ✅ Implemented soft delete with recovery period

## ⚡ Performance Tips

1. **Database**: Use indexes on frequently queried fields
2. **Caching**: Implement Redis for session caching
3. **Images**: Use Cloudinary transformations for optimization
4. **Requests**: Implement pagination for large result sets
5. **Logging**: Use structured logging in production

---

**Last Updated**: April 29, 2026
**Version**: 1.0.0

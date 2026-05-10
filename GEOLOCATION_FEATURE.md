# Teacher Geolocation Feature — City to Coordinates Translation

## Overview

This feature allows teachers to enter their city during account creation or profile updates, which is automatically translated to precise latitude and longitude coordinates using OpenStreetMap's Nominatim geocoding API.

## Features

✅ **Automatic City-to-Coordinates Conversion**
- Teachers enter city name during signup or profile update
- System automatically translates city to GPS coordinates
- Coordinates are stored in the Teacher model and used for geospatial queries

✅ **Graceful Degradation**
- If geocoding fails, account creation/update still succeeds
- Coordinates default to [0, 0] if city cannot be resolved
- System logs warnings but doesn't block the operation

✅ **City Name Storage**
- City name is stored in the teacher profile for reference
- Useful for displaying location information to students

✅ **GIS Support**
- Automatically syncs coordinates to MongoDB GeoJSON format
- Enables geospatial queries (find teachers near location)

## API Usage

### 1. Teacher Signup with City

**Endpoint:** `POST /api/auth/signup`

**Request Body** (multipart/form-data):
```javascript
{
  signupToken: "eyJhbGc...",
  password: "SecurePass123",
  role: "teacher",
  firstname: "Ahmed",
  familyname: "Benali",
  postaladr: "16000",
  // Teacher-specific fields
  nature: "Independent",
  description_pedagogique: "Experienced math teacher",
  deplacement: true,
  rayon_deplacement: 5,
  modalite: "Hybride",
  // CITY FIELD - will be converted to coordinates
  city: "Algiers", // or "Alger", etc.
  // Other fields...
  photo_profil: <binary>,
  cv: <binary>,
  diplomes: [<binary>, <binary>]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "_id": "...",
      "idmembre": 123,
      "firstname": "Ahmed",
      "familyname": "Benali"
    },
    "teacher": {
      "_id": "...",
      "id_enseignant": 123,
      "city": "Algiers",
      "latitude": 36.7372,
      "longitude": 3.0868,
      "location": {
        "type": "Point",
        "coordinates": [3.0868, 36.7372]
      }
    }
  }
}
```

### 2. Update Teacher Profile with City

**Endpoint:** `PUT /api/profile/teacher`

**Request Body** (multipart/form-data):
```javascript
{
  firstname: "Ahmed",
  familyname: "Benali",
  email: "ahmed@example.com",
  numberphone: "+213555123456",
  postaladr: "16000",
  // Teacher-specific updates
  city: "Oran", // Update city
  description_pedagogique: "Updated description",
  rayon_deplacement: 10,
  nature: "Independent"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Profil enseignant mis à jour avec succès.",
  "data": {
    "user": { ... },
    "details": {
      "_id": "...",
      "id_enseignant": 123,
      "city": "Oran",
      "latitude": 35.7345,
      "longitude": -0.6386,
      "location": {
        "type": "Point",
        "coordinates": [-0.6386, 35.7345]
      }
    }
  }
}
```

## Database Schema

### Teacher Model Updates

New fields added to `teacherModel.js`:

```javascript
{
  // ─────────────────────────────
  // GEO LOCATION
  // ─────────────────────────────
  city: {
    type: String,
    default: null,
    trim: true
  },

  latitude: { type: Number, default: 0 },
  longitude: { type: Number, default: 0 },

  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      default: [0, 0]
    }
  }
}
```

## Implementation Details

### Files Modified

1. **utils/geocoding.js** (NEW)
   - `cityToCoordinates(city, country)` - Converts city name to coordinates
   - `validateCoordinates(lat, lng)` - Validates coordinate values
   - Uses OpenStreetMap Nominatim API (free, no API key)

2. **Sign_In_Up/Sign_up.js**
   - Added city-to-coordinates conversion in `completeProfile()` function
   - Teacher profile now stores: city, latitude, longitude

3. **packProfil/updateProfile.js**
   - Added city-to-coordinates conversion in `performUpdate()` function
   - Handles city updates for teacher profiles
   - Added `city` to `allowedFields` for teacher role

4. **models/teacherModel.js**
   - Added `city` field to store city name
   - Already had `latitude`, `longitude`, `location` (GeoJSON)

### Geocoding Service (Nominatim API)

**API:** OpenStreetMap Nominatim
- **Endpoint:** `https://nominatim.openstreetmap.org/search`
- **No API Key Required:** Free public service
- **Rate Limiting:** 1 request per second recommended
- **Response Format:** JSON

**Example Request:**
```
GET https://nominatim.openstreetmap.org/search?q=Algiers,Algeria&format=json&limit=1
```

**Response:**
```json
[
  {
    "lat": "36.7372",
    "lon": "3.0868",
    "display_name": "Algiers, Algeria",
    ...
  }
]
```

## Error Handling

### Graceful Degradation

If geocoding fails:
```
⚠ Geocoding failed for city "InvalidCity": City "InvalidCity" not found in Algeria
⚠ Proceeding with profile update without new coordinates
```

The system:
- Logs a warning message
- Does NOT block signup/profile update
- Coordinates remain unchanged (default [0, 0] for new profiles)
- User can still complete registration

### Common Error Cases

| Error | Cause | Handling |
|-------|-------|----------|
| City not found | Invalid city name | Proceeds with default [0, 0] |
| API timeout | Network issue | Logs warning, continues |
| Invalid response | Nominatim API error | Logs warning, continues |
| Empty city string | Missing city parameter | Skips geocoding, continues |

## Usage Examples

### Frontend - Signup Form

```javascript
// HTML Form
<form enctype="multipart/form-data">
  <input type="text" name="firstname" placeholder="First name" required>
  <input type="text" name="familyname" placeholder="Family name" required>
  <input type="email" name="email" required>
  <input type="tel" name="numberphone" required>
  
  <!-- City field for geolocation -->
  <input type="text" name="city" placeholder="City (e.g., Algiers)" required>
  
  <!-- Other fields -->
  <input type="text" name="nature" placeholder="Nature" required>
  <textarea name="description_pedagogique" required></textarea>
  <input type="checkbox" name="deplacement"> Travel available
  <input type="number" name="rayon_deplacement" min="0">
  
  <input type="file" name="cv" accept=".pdf,.doc" required>
  <input type="file" name="diplomes" multiple required>
  <input type="file" name="photo_profil" accept="image/*">
  
  <button type="submit">Create Account</button>
</form>

// JavaScript - FormData submission
const formData = new FormData();
formData.append('signupToken', token);
formData.append('password', password);
formData.append('role', 'teacher');
formData.append('firstname', 'Ahmed');
formData.append('familyname', 'Benali');
formData.append('postaladr', '16000');
formData.append('city', 'Algiers'); // ← City for geocoding
formData.append('nature', 'Independent');
formData.append('description_pedagogique', 'Math expert');
formData.append('deplacement', true);
formData.append('rayon_deplacement', 5);
formData.append('cv', cvFile);
formData.append('diplomes', diplomeFile);
formData.append('photo_profil', photoFile);

const response = await fetch('/api/auth/signup', {
  method: 'POST',
  body: formData
});
```

### Backend - Verify Coordinates

```javascript
// After signup/update, verify teacher coordinates
const teacher = await Teacher.findOne({ id_enseignant: teacherId });

console.log(`Teacher: ${teacher.firstname}`);
console.log(`City: ${teacher.city}`);
console.log(`Coordinates: [${teacher.latitude}, ${teacher.longitude}]`);
console.log(`GeoJSON: ${JSON.stringify(teacher.location)}`);

// Use for geospatial queries
const nearbyTeachers = await Teacher.find({
  location: {
    $near: {
      $geometry: {
        type: 'Point',
        coordinates: [3.0868, 36.7372] // [lng, lat]
      },
      $maxDistance: 5000 // 5 km
    }
  }
});
```

## Testing

### Test City Names (Algeria)

| City | Expected Lat | Expected Lng |
|------|--------------|--------------|
| Algiers | ≈ 36.74 | ≈ 3.09 |
| Oran | ≈ 35.73 | ≈ -0.64 |
| Constantine | ≈ 36.37 | ≈ 6.62 |
| Annaba | ≈ 36.90 | ≈ 7.77 |
| Tlemcen | ≈ 35.29 | ≈ -1.31 |

### Test Invalid Cities

```javascript
// These should fail gracefully
- "InvalidCity123" → City not found
- "" → Empty string skipped
- "   " → Whitespace trimmed
- null → Skipped
```

## Performance Considerations

### API Calls

- **Geocoding happens during:** Signup or profile update (not on every request)
- **Rate limit:** 1 request per second recommended by Nominatim
- **Timeout:** 5 seconds per request
- **Caching:** Consider caching city→coordinates mappings in Redis for high-volume scenarios

### Database Indexes

Existing indexes support geospatial queries:
```javascript
teacherSchema.index({ location: '2dsphere' });
```

## Security & Privacy

✅ **No Personal Data Exposure**
- Only city name is used (public information)
- No IP addresses tracked
- Coordinates are approximate (city-level, not precise)

✅ **API Safety**
- Read-only API calls to Nominatim
- No credentials required
- User-Agent header included in requests

## Future Enhancements

1. **Caching:** Redis cache for city→coordinates mappings
2. **Multiple Countries:** Support teacher profiles from different countries
3. **Reverse Geocoding:** Convert coordinates to city names (lookup feature)
4. **Map Display:** Show teacher locations on interactive map
5. **Distance Filtering:** Search teachers within N km radius
6. **Timezone Support:** Automatically set timezone based on coordinates

## Troubleshooting

### City not being translated

**Issue:** Teacher signs up with city but coordinates remain [0, 0]

**Causes:**
- Invalid city name
- API rate limit exceeded
- Network connectivity issue
- Nominatim API temporary unavailability

**Solution:**
1. Check console logs for geocoding errors
2. Verify city name spelling
3. Try with a major city first (Algiers, Oran)
4. Wait and retry if rate limited
5. City can be manually updated later via profile update endpoint

### Coordinates showing [0, 0]

**Issue:** All new teachers have coordinates [0, 0]

**Possible causes:**
- City field not being sent in request
- Empty city string
- Nominatim API unavailable

**Solution:**
1. Verify frontend is sending city parameter
2. Check server logs for geocoding errors
3. Monitor Nominatim API status
4. Implement fallback/retry logic

---

**Last Updated:** May 2026
**Version:** 1.0
**Status:** Production Ready ✅

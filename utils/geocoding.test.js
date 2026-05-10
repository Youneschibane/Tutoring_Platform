/**
 * ═══════════════════════════════════════════════════════════════
 * GEOLOCATION FEATURE - TEST & EXAMPLES
 * ═══════════════════════════════════════════════════════════════
 * 
 * This file contains example requests and test cases for the
 * teacher geolocation feature (city-to-coordinates translation)
 */

// ═══════════════════════════════════════════════════════════════
// 1. MANUAL GEOCODING TEST
// ═══════════════════════════════════════════════════════════════

const { cityToCoordinates, validateCoordinates } = require('../utils/geocoding');

const testGeocoding = async () => {
  console.log('\n=== GEOCODING TEST ===\n');

  // Test valid cities
  const testCities = [
    'Algiers',
    'Oran',
    'Constantine',
    'Annaba',
    'Tlemcen',
    'Benghazi', // Libya
  ];

  for (const city of testCities) {
    try {
      const geoData = await cityToCoordinates(city);
      console.log(`✓ ${city}`);
      console.log(`  Coordinates: [${geoData.latitude}, ${geoData.longitude}]`);
      console.log(`  Address: ${geoData.formattedAddress}\n`);
    } catch (err) {
      console.log(`✗ ${city}`);
      console.log(`  Error: ${err.message}\n`);
    }
  }

  // Test invalid cities
  const invalidCities = ['InvalidCity123', 'XYZ999', ''];

  console.log('\n--- INVALID CITIES TEST ---\n');
  for (const city of invalidCities) {
    try {
      const geoData = await cityToCoordinates(city);
      console.log(`✓ ${city} (unexpected success)`);
    } catch (err) {
      console.log(`✓ ${city} (correctly failed)`);
      console.log(`  Error: ${err.message}\n`);
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// 2. CURL EXAMPLES - TEACHER SIGNUP WITH CITY
// ═══════════════════════════════════════════════════════════════

/*
# Teacher Signup with City Geolocation

# Prerequisites:
# 1. Get signup token from /api/auth/otp-verify endpoint
# 2. Replace TOKEN_HERE with actual token
# 3. Prepare CV and diploma files

SIGNUP_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
CITY="Algiers"

curl -X POST http://localhost:3000/api/auth/signup \
  -F "signupToken=$SIGNUP_TOKEN" \
  -F "password=SecurePass123" \
  -F "role=teacher" \
  -F "firstname=Ahmed" \
  -F "familyname=Benali" \
  -F "postaladr=16000" \
  -F "city=$CITY" \
  -F "nature=Independent" \
  -F "description_pedagogique=Experienced mathematics teacher with 10 years experience" \
  -F "deplacement=true" \
  -F "rayon_deplacement=5" \
  -F "modalite=Hybride" \
  -F "subjects=[{\"name\":\"Mathematics\",\"cycle\":\"Lycee\"},{\"name\":\"Physics\",\"cycle\":\"College\"}]" \
  -F "email=ahmed.benali@example.com" \
  -F "numberphone=+213555123456" \
  -F "cv=@/path/to/cv.pdf" \
  -F "diplomes=@/path/to/diploma1.pdf" \
  -F "diplomes=@/path/to/diploma2.pdf" \
  -F "photo_profil=@/path/to/photo.jpg"

# Expected Response:
# {
#   "status": "success",
#   "data": {
#     "user": {
#       "_id": "...",
#       "idmembre": 123,
#       "firstname": "Ahmed",
#       "city": "Algiers"
#     },
#     "teacher": {
#       "id_enseignant": 123,
#       "city": "Algiers",
#       "latitude": 36.7372,
#       "longitude": 3.0868,
#       "location": {
#         "type": "Point",
#         "coordinates": [3.0868, 36.7372]
#       }
#     },
#     "token": "eyJhbGc..."
#   }
# }
*/

// ═══════════════════════════════════════════════════════════════
// 3. JAVASCRIPT FETCH EXAMPLES - SIGNUP
// ═══════════════════════════════════════════════════════════════

const signupWithCity = async (signupToken) => {
  const formData = new FormData();

  // Basic info
  formData.append('signupToken', signupToken);
  formData.append('password', 'SecurePass123');
  formData.append('role', 'teacher');
  formData.append('firstname', 'Ahmed');
  formData.append('familyname', 'Benali');
  formData.append('postaladr', '16000');

  // Teacher profile
  formData.append('nature', 'Independent');
  formData.append('description_pedagogique', 'Experienced math teacher');
  formData.append('deplacement', 'true');
  formData.append('rayon_deplacement', '5');
  formData.append('modalite', 'Hybride');

  // ← GEOLOCATION: City to be converted to coordinates
  formData.append('city', 'Algiers');

  // Contact info
  formData.append('email', 'ahmed@example.com');
  formData.append('numberphone', '+213555123456');

  // Subjects
  formData.append('subjects', JSON.stringify([
    { name: 'Mathematics', cycle: 'Lycee' },
    { name: 'Physics', cycle: 'College' }
  ]));

  // Files (simulated here)
  // formData.append('cv', cvFile);
  // formData.append('diplomes', diplomeFile1);
  // formData.append('diplomes', diplomeFile2);
  // formData.append('photo_profil', photoFile);

  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.status === 'success') {
      console.log('✓ Signup successful');
      console.log(`  Teacher ID: ${data.data.teacher.id_enseignant}`);
      console.log(`  City: ${data.data.teacher.city}`);
      console.log(`  Coordinates: [${data.data.teacher.latitude}, ${data.data.teacher.longitude}]`);
      return data.data;
    } else {
      console.error('✗ Signup failed:', data.message);
      return null;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// 4. PROFILE UPDATE WITH CITY CHANGE
// ═══════════════════════════════════════════════════════════════

const updateTeacherCity = async (newCity, authToken) => {
  const formData = new FormData();

  // ← NEW CITY - will be converted to new coordinates
  formData.append('city', newCity);

  // Optionally update other fields
  formData.append('description_pedagogique', 'Updated description');
  formData.append('rayon_deplacement', '10');

  try {
    const response = await fetch('/api/profile/teacher', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    const data = await response.json();

    if (data.status === 'success') {
      console.log('✓ Profile updated');
      console.log(`  New city: ${data.data.details.city}`);
      console.log(`  New coordinates: [${data.data.details.latitude}, ${data.data.details.longitude}]`);
      return data.data.details;
    } else {
      console.error('✗ Update failed:', data.message);
      return null;
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// 5. VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════

const testCoordinateValidation = () => {
  console.log('\n=== COORDINATE VALIDATION TEST ===\n');

  const testCases = [
    { lat: 36.7372, lng: 3.0868, expected: true, desc: 'Valid Algiers coords' },
    { lat: 35.7345, lng: -0.6386, expected: true, desc: 'Valid Oran coords' },
    { lat: 90, lng: 180, expected: true, desc: 'Max valid values' },
    { lat: -90, lng: -180, expected: true, desc: 'Min valid values' },
    { lat: 91, lng: 180, expected: false, desc: 'Latitude > 90' },
    { lat: -91, lng: 180, expected: false, desc: 'Latitude < -90' },
    { lat: 36.7372, lng: 181, expected: false, desc: 'Longitude > 180' },
    { lat: 36.7372, lng: -181, expected: false, desc: 'Longitude < -180' },
    { lat: 'invalid', lng: 3.0868, expected: false, desc: 'Non-numeric latitude' },
    { lat: null, lng: 3.0868, expected: false, desc: 'Null latitude' }
  ];

  testCases.forEach(tc => {
    const result = validateCoordinates(tc.lat, tc.lng);
    const status = result === tc.expected ? '✓' : '✗';
    console.log(`${status} ${tc.desc}: ${result}`);
  });
};

// ═══════════════════════════════════════════════════════════════
// 6. GEOSPATIAL QUERY EXAMPLES
// ═══════════════════════════════════════════════════════════════

const findTeachersNearCity = async (cityName, radiusMeters = 5000) => {
  const { cityToCoordinates } = require('../utils/geocoding');
  const Teacher = require('../models/teacherModel');

  try {
    // Get coordinates for search center
    const searchCenter = await cityToCoordinates(cityName);

    // Query teachers within radius
    const teachers = await Teacher.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [searchCenter.longitude, searchCenter.latitude]
          },
          $maxDistance: radiusMeters
        }
      }
    }).select('id_enseignant city latitude longitude -_id');

    console.log(`\nTeachers within ${radiusMeters / 1000}km of ${cityName}:`);
    teachers.forEach(t => {
      console.log(`  - ID: ${t.id_enseignant}, City: ${t.city}, Coords: [${t.latitude}, ${t.longitude}]`);
    });

    return teachers;
  } catch (error) {
    console.error('Error finding teachers:', error.message);
    return [];
  }
};

// ═══════════════════════════════════════════════════════════════
// 7. ERROR SCENARIO TESTS
// ═══════════════════════════════════════════════════════════════

const testErrorScenarios = async () => {
  console.log('\n=== ERROR SCENARIO TESTS ===\n');

  // Scenario 1: Teacher signup without city (should succeed with default coords)
  console.log('Scenario 1: Signup without city field');
  console.log('  Expected: Success with coordinates [0, 0]');
  console.log('  Actual: Depends on form submission\n');

  // Scenario 2: Invalid city name (should fail gracefully)
  console.log('Scenario 2: Signup with invalid city');
  try {
    await cityToCoordinates('InvalidCity123XYZ');
    console.log('  Result: ✗ (should have failed)');
  } catch (err) {
    console.log('  Result: ✓ (correctly failed)');
    console.log(`  Error: ${err.message}\n`);
  }

  // Scenario 3: Empty city string (should be skipped)
  console.log('Scenario 3: Signup with empty city');
  console.log('  Expected: Success with coordinates [0, 0]\n');

  // Scenario 4: City name with special characters
  console.log('Scenario 4: City with special characters');
  try {
    const result = await cityToCoordinates('Sidi-Bel-Abbès');
    console.log('  Result: ✓ (found)');
    console.log(`  Coordinates: [${result.latitude}, ${result.longitude}]\n`);
  } catch (err) {
    console.log('  Result: ✗ (not found)');
    console.log(`  Error: ${err.message}\n`);
  }
};

// ═══════════════════════════════════════════════════════════════
// 8. PERFORMANCE TEST
// ═══════════════════════════════════════════════════════════════

const performanceTest = async () => {
  console.log('\n=== PERFORMANCE TEST ===\n');

  const cities = ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Tlemcen'];
  const startTime = Date.now();

  for (const city of cities) {
    try {
      await cityToCoordinates(city);
    } catch (err) {
      console.log(`Failed: ${city}`);
    }
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / cities.length;

  console.log(`Total time: ${totalTime}ms`);
  console.log(`Average time per request: ${avgTime.toFixed(2)}ms`);
  console.log(`Note: Nominatim API rate limit is ~1 req/sec\n`);
};

// ═══════════════════════════════════════════════════════════════
// EXPORT & RUN
// ═══════════════════════════════════════════════════════════════

module.exports = {
  testGeocoding,
  testCoordinateValidation,
  testErrorScenarios,
  performanceTest,
  signupWithCity,
  updateTeacherCity,
  findTeachersNearCity
};

// Uncomment to run tests
// testGeocoding().then(() => testCoordinateValidation()).then(() => testErrorScenarios());

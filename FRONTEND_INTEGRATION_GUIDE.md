# Frontend Integration Guide - Teacher Geolocation Feature

## Quick Start

Add a `city` input field to your teacher signup/profile update forms. The backend will automatically convert the city name to GPS coordinates.

---

## 1. Signup Form HTML

### Basic Example

```html
<form id="teacherSignupForm" enctype="multipart/form-data">
  <!-- Basic Information -->
  <fieldset>
    <legend>Basic Information</legend>
    
    <div class="form-group">
      <label for="firstname">First Name *</label>
      <input 
        type="text" 
        id="firstname" 
        name="firstname" 
        required 
        placeholder="Ahmed"
      >
    </div>

    <div class="form-group">
      <label for="familyname">Family Name *</label>
      <input 
        type="text" 
        id="familyname" 
        name="familyname" 
        required 
        placeholder="Benali"
      >
    </div>

    <div class="form-group">
      <label for="email">Email *</label>
      <input 
        type="email" 
        id="email" 
        name="email" 
        required 
        placeholder="ahmed@example.com"
      >
    </div>

    <div class="form-group">
      <label for="numberphone">Phone *</label>
      <input 
        type="tel" 
        id="numberphone" 
        name="numberphone" 
        required 
        placeholder="+213555123456"
      >
    </div>

    <div class="form-group">
      <label for="postaladr">Postal Code *</label>
      <input 
        type="text" 
        id="postaladr" 
        name="postaladr" 
        required 
        placeholder="16000"
      >
    </div>
  </fieldset>

  <!-- Professional Profile -->
  <fieldset>
    <legend>Professional Profile</legend>
    
    <div class="form-group">
      <label for="nature">Type of Organization *</label>
      <select id="nature" name="nature" required>
        <option value="">Select...</option>
        <option value="Independent">Independent</option>
        <option value="Etablissement">Educational Institution</option>
        <option value="Centre">Training Center</option>
      </select>
    </div>

    <div class="form-group">
      <label for="description_pedagogique">Pedagogical Description *</label>
      <textarea 
        id="description_pedagogique" 
        name="description_pedagogique" 
        required 
        rows="4"
        placeholder="Describe your teaching approach, experience, and specialties..."
      ></textarea>
    </div>

    <!-- ⭐ NEW: City Field for Geolocation ⭐ -->
    <div class="form-group">
      <label for="city">City *</label>
      <input 
        type="text" 
        id="city" 
        name="city" 
        required 
        placeholder="e.g., Algiers, Oran, Constantine"
        title="Your city will be converted to precise GPS coordinates"
      >
      <small class="form-text">Your location will be converted to GPS coordinates automatically</small>
    </div>

    <div class="form-group">
      <label>Travel Available *</label>
      <div class="checkbox-group">
        <input 
          type="checkbox" 
          id="deplacement" 
          name="deplacement" 
          value="true"
        >
        <label for="deplacement" class="checkbox-label">
          I can travel to teach students
        </label>
      </div>
    </div>

    <div class="form-group" id="rayonGroup" style="display:none;">
      <label for="rayon_deplacement">Travel Radius (km)</label>
      <input 
        type="number" 
        id="rayon_deplacement" 
        name="rayon_deplacement" 
        min="0" 
        max="100" 
        placeholder="5"
      >
      <small class="form-text">Maximum distance you're willing to travel</small>
    </div>

    <div class="form-group">
      <label for="modalite">Teaching Mode *</label>
      <select id="modalite" name="modalite" required>
        <option value="">Select...</option>
        <option value="En ligne">Online</option>
        <option value="En présentiel">In-Person</option>
        <option value="Hybride">Hybrid</option>
      </select>
    </div>

    <div class="form-group">
      <label for="subjects">Subjects *</label>
      <div id="subjectsContainer">
        <div class="subject-input">
          <input 
            type="text" 
            placeholder="Subject Name" 
            class="subject-name"
          >
          <select class="subject-cycle">
            <option value="">Level</option>
            <option value="Primaire">Primary</option>
            <option value="College">Middle</option>
            <option value="Lycee">High School</option>
            <option value="ESI">University</option>
          </select>
          <button type="button" class="btn-remove-subject">Remove</button>
        </div>
      </div>
      <button type="button" id="addSubjectBtn" class="btn-secondary">
        Add Subject
      </button>
    </div>
  </fieldset>

  <!-- Documents -->
  <fieldset>
    <legend>Documents</legend>
    
    <div class="form-group">
      <label for="cv">CV (PDF) *</label>
      <input 
        type="file" 
        id="cv" 
        name="cv" 
        accept=".pdf,.doc,.docx" 
        required
      >
    </div>

    <div class="form-group">
      <label for="diplomes">Diplomas (PDF) *</label>
      <input 
        type="file" 
        id="diplomes" 
        name="diplomes" 
        accept=".pdf" 
        multiple 
        required
      >
      <small class="form-text">Upload at least one diploma</small>
    </div>

    <div class="form-group">
      <label for="photo_profil">Profile Photo (JPG/PNG)</label>
      <input 
        type="file" 
        id="photo_profil" 
        name="photo_profil" 
        accept="image/*"
      >
      <small class="form-text">Max 5MB, recommended 400x400px</small>
    </div>
  </fieldset>

  <!-- Submit -->
  <div class="form-actions">
    <button type="submit" class="btn-primary">Create Account</button>
    <button type="reset" class="btn-secondary">Clear Form</button>
  </div>
</form>
```

---

## 2. JavaScript Form Handling

### Complete Signup Handler

```javascript
// DOM Elements
const form = document.getElementById('teacherSignupForm');
const deplacement = document.getElementById('deplacement');
const rayonGroup = document.getElementById('rayonGroup');
const addSubjectBtn = document.getElementById('addSubjectBtn');
const subjectsContainer = document.getElementById('subjectsContainer');

// Show/hide travel radius based on checkbox
deplacement.addEventListener('change', () => {
  rayonGroup.style.display = deplacement.checked ? 'block' : 'none';
});

// Add subject input
addSubjectBtn.addEventListener('click', () => {
  const div = document.createElement('div');
  div.className = 'subject-input';
  div.innerHTML = `
    <input type="text" placeholder="Subject Name" class="subject-name">
    <select class="subject-cycle">
      <option value="">Level</option>
      <option value="Primaire">Primary</option>
      <option value="College">Middle</option>
      <option value="Lycee">High School</option>
      <option value="ESI">University</option>
    </select>
    <button type="button" class="btn-remove-subject">Remove</button>
  `;
  
  div.querySelector('.btn-remove-subject').addEventListener('click', () => {
    div.remove();
  });
  
  subjectsContainer.appendChild(div);
});

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Collect subjects
  const subjects = Array.from(document.querySelectorAll('.subject-input')).map(div => ({
    name: div.querySelector('.subject-name').value,
    cycle: div.querySelector('.subject-cycle').value
  })).filter(s => s.name && s.cycle);

  if (subjects.length === 0) {
    alert('Please add at least one subject');
    return;
  }

  // Create FormData
  const formData = new FormData(form);
  
  // Replace subjects with JSON
  formData.delete('subjects');
  formData.append('subjects', JSON.stringify(subjects));

  // Add other required fields
  formData.append('role', 'teacher');
  formData.append('signupToken', getSignupToken()); // Get from your auth flow
  formData.append('password', document.getElementById('password').value);

  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.status === 'success') {
      // Success
      console.log('✓ Account created successfully');
      console.log('Teacher coordinates:', {
        city: data.data.teacher.city,
        latitude: data.data.teacher.latitude,
        longitude: data.data.teacher.longitude
      });

      // Redirect or show success message
      alert('Account created! Your location has been saved: ' + data.data.teacher.city);
      window.location.href = '/dashboard';
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    console.error('Signup error:', error);
    alert('An error occurred. Please try again.');
  }
});
```

---

## 3. Profile Update Form

### Update Form HTML

```html
<form id="teacherProfileForm" enctype="multipart/form-data">
  <fieldset>
    <legend>Edit Profile</legend>

    <div class="form-group">
      <label for="firstname">First Name</label>
      <input 
        type="text" 
        id="firstname" 
        name="firstname"
      >
    </div>

    <div class="form-group">
      <label for="familyname">Family Name</label>
      <input 
        type="text" 
        id="familyname" 
        name="familyname"
      >
    </div>

    <div class="form-group">
      <label for="email">Email</label>
      <input 
        type="email" 
        id="email" 
        name="email"
      >
    </div>

    <div class="form-group">
      <label for="numberphone">Phone</label>
      <input 
        type="tel" 
        id="numberphone" 
        name="numberphone"
      >
    </div>

    <!-- ⭐ City field for update ⭐ -->
    <div class="form-group">
      <label for="city">City</label>
      <input 
        type="text" 
        id="city" 
        name="city"
        placeholder="e.g., Algiers, Oran"
        title="Change your city to update location"
      >
      <small>Update to change your teaching location</small>
    </div>

    <div class="form-group">
      <label for="description_pedagogique">Description</label>
      <textarea 
        id="description_pedagogique" 
        name="description_pedagogique"
        rows="4"
      ></textarea>
    </div>

    <div class="form-group">
      <label for="rayon_deplacement">Travel Radius (km)</label>
      <input 
        type="number" 
        id="rayon_deplacement" 
        name="rayon_deplacement"
        min="0"
        max="100"
      >
    </div>

    <button type="submit" class="btn-primary">Update Profile</button>
  </fieldset>
</form>
```

### Update Form JavaScript

```javascript
const updateForm = document.getElementById('teacherProfileForm');

updateForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(updateForm);

  try {
    const response = await fetch('/api/profile/teacher', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: formData
    });

    const data = await response.json();

    if (data.status === 'success') {
      console.log('✓ Profile updated');
      console.log('New location:', {
        city: data.data.details.city,
        latitude: data.data.details.latitude,
        longitude: data.data.details.longitude
      });

      alert('Profile updated! New location saved: ' + data.data.details.city);
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    console.error('Update error:', error);
    alert('An error occurred. Please try again.');
  }
});
```

---

## 4. City Input Best Practices

### City Input with Suggestions

```html
<div class="form-group">
  <label for="city">City *</label>
  <input 
    type="text" 
    id="city" 
    name="city"
    list="cities"
    placeholder="Start typing..."
    required
  >
  <datalist id="cities">
    <option value="Algiers">Algiers</option>
    <option value="Oran">Oran</option>
    <option value="Constantine">Constantine</option>
    <option value="Annaba">Annaba</option>
    <option value="Blida">Blida</option>
    <option value="Tlemcen">Tlemcen</option>
    <option value="Sidi-Bel-Abbès">Sidi-Bel-Abbès</option>
    <option value="Bejaia">Bejaia</option>
    <option value="Setif">Setif</option>
    <option value="Tizi Ouzou">Tizi Ouzou</option>
  </datalist>
  <small>Common Algerian cities</small>
</div>
```

### City Input with Validation

```javascript
const cityInput = document.getElementById('city');

cityInput.addEventListener('blur', async () => {
  const city = cityInput.value.trim();
  
  if (!city) return;

  // Optional: Validate city on the frontend
  try {
    const response = await fetch(`/api/validate-city?city=${encodeURIComponent(city)}`);
    const result = await response.json();

    if (result.valid) {
      cityInput.classList.add('is-valid');
      console.log(`✓ ${city} found at ${result.latitude}, ${result.longitude}`);
    } else {
      cityInput.classList.add('is-invalid');
      console.warn(`✗ City "${city}" not found`);
    }
  } catch (error) {
    console.warn('Validation skipped (server unavailable)');
  }
});
```

---

## 5. Display Coordinates on Frontend

### Show Location After Signup

```javascript
const showLocationInfo = (teacher) => {
  const locationDiv = document.getElementById('locationInfo');
  
  locationDiv.innerHTML = `
    <div class="alert alert-info">
      <h4>📍 Your Location</h4>
      <p><strong>City:</strong> ${teacher.city}</p>
      <p><strong>Coordinates:</strong> 
        <a href="https://maps.google.com/?q=${teacher.latitude},${teacher.longitude}" 
           target="_blank">
          ${teacher.latitude.toFixed(4)}, ${teacher.longitude.toFixed(4)}
        </a>
      </p>
      <p class="text-muted">Students can find you within ${teacher.rayon_deplacement}km</p>
    </div>
  `;
};

// After successful signup
showLocationInfo(data.data.teacher);
```

### Display on Map (Optional)

```html
<!-- Add Leaflet library -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<!-- Map container -->
<div id="teacherMap" style="height: 400px;"></div>

<script>
const showTeacherOnMap = (teacher) => {
  const map = L.map('teacherMap').setView(
    [teacher.latitude, teacher.longitude], 
    13
  );

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  L.circleMarker(
    [teacher.latitude, teacher.longitude],
    {
      radius: 8,
      fillColor: '#0066cc',
      color: '#003399',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }
  ).bindPopup(`
    <b>${teacher.firstname} ${teacher.familyname}</b><br>
    ${teacher.city}<br>
    Radius: ${teacher.rayon_deplacement}km
  `).addTo(map);

  // Draw travel radius
  L.circle(
    [teacher.latitude, teacher.longitude],
    {
      radius: teacher.rayon_deplacement * 1000, // Convert km to m
      fillOpacity: 0.1,
      color: '#0066cc',
      weight: 1
    }
  ).addTo(map);
};
</script>
```

---

## 6. Error Handling on Frontend

```javascript
const handleGeolocationError = (error) => {
  const errorDiv = document.getElementById('geolocationError');
  
  switch(error.type) {
    case 'city_not_found':
      errorDiv.innerHTML = `
        <div class="alert alert-warning">
          <strong>⚠️ City not found</strong>
          <p>The city you entered couldn't be located. Please check the spelling.</p>
          <p>Try with a major city: Algiers, Oran, Constantine, Annaba, etc.</p>
        </div>
      `;
      break;
      
    case 'api_timeout':
      errorDiv.innerHTML = `
        <div class="alert alert-info">
          <strong>ℹ️ Location lookup slow</strong>
          <p>We're having trouble reaching the location service.</p>
          <p>Your profile will be created without exact coordinates, but you can update it later.</p>
        </div>
      `;
      break;
      
    case 'network_error':
      errorDiv.innerHTML = `
        <div class="alert alert-danger">
          <strong>❌ Network error</strong>
          <p>Please check your internet connection and try again.</p>
        </div>
      `;
      break;
  }
};
```

---

## 7. CSS Styling (Optional)

```css
/* City input styling */
#city {
  font-size: 16px;
  padding: 10px;
  border: 2px solid #ccc;
  border-radius: 4px;
  transition: border-color 0.3s;
}

#city:focus {
  border-color: #0066cc;
  outline: none;
}

#city.is-valid {
  border-color: #28a745;
  background-color: #f0f9f6;
}

#city.is-invalid {
  border-color: #dc3545;
  background-color: #fdf0f0;
}

/* City datalist styling */
#cities {
  max-height: 150px;
  overflow-y: auto;
}

/* Location info display */
.location-info {
  background-color: #e3f2fd;
  border-left: 4px solid #0066cc;
  padding: 15px;
  margin: 10px 0;
  border-radius: 4px;
}

.location-info h4 {
  margin-top: 0;
  color: #0066cc;
}

.location-info p {
  margin: 5px 0;
}
```

---

## Summary

✅ **Key Points:**
1. Add `city` input field to signup/update forms
2. Send city as part of FormData
3. Backend automatically converts to coordinates
4. Graceful fallback if geocoding fails
5. Display coordinates/location to user
6. No special frontend logic needed beyond form submission

✅ **Supported Cities (Examples):**
- Algiers, Oran, Constantine, Annaba, Blida
- Tlemcen, Sidi-Bel-Abbès, Setif, Bejaia, Tizi Ouzou
- And any other city worldwide

✅ **No Breaking Changes:**
- Old forms still work (without city)
- Coordinates default to [0, 0] if no city provided
- Fully backward compatible

---

**Documentation Version:** 1.0  
**Last Updated:** May 2026

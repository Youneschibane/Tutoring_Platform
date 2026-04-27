const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    idmembre: {
        type: Number,
        unique: true,
        trim: true,
        required: true,
    },

    firstname: {
        type: String,
        trim: true,
        required: [true, 'FIRST_NAME_REQUIRED'],
    },

    familyname: {
        type: String,
        trim: true,
        required: [true, 'LAST_NAME_REQUIRED'],
    },

    photo_profil: {
        type: String,
        default: null,
        required: false
    },

    numberphone: {
        type: String,
        unique: true,
        trim: true,
        sparse: true,
    },

    email: {
        type: String,
        unique: true,
        trim: true,
        lowercase: true,
        sparse: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },

    password: {
        type: String,
        minlength: [8, 'Password must be at least 8 characters long'],
        select: false,
        required: [true, "ERROR_PASSWORD_REQUIRED"],
    },

    role: {
        type: String,
        enum: ['parent', 'student', 'teacher', 'admin'],
        default: 'student', // Mis à 'student' par défaut pour plus de cohérence
    },

    accepted: {
        type: Boolean,
        default: false,
    },

    postaladr: {
        type: Number,
        required: true,
    }
}, { 
    timestamps: true 
});

// Middleware pour hacher le mot de passe avant la sauvegarde
userSchema.pre('save', async function (next) {
    // Ne hacher que si le mot de passe a été modifié (ou est nouveau)
    if (!this.isModified('password')) {
        return next();
    }

    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();
    } catch (error) {
        next(new Error(`Password hashing failed: ${error.message}`));
    }
});

// Méthode pour comparer le mot de passe saisi avec le mot de passe haché
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
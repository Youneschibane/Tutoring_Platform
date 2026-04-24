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
        default: 'user',
    },

 

    postaladr: {
        type: Number,
        required: true,
    },

    isActive: {
        type: Boolean,
        default: true
    },

    deletionScheduledAt: {
        type: Date,
        default: null,
        select: false
    },

    passwordChangedAt: {
        type: Date,
        select: false
    },

    // Photo de profil - for all user types
    photo_profil: {
        type: String,
        default: null
    }


 


},
    { timestamps: true },
);



userSchema.pre('save', async function () {
    // Only hash password if it's been modified
    if (!this.isModified('password')) {
        return;
    }

    try {
        this.password = await bcrypt.hash(this.password, 12);
    } catch (error) {
        throw new Error(`Password hashing failed: ${error.message}`);
    }
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};
userSchema.index({ firstname: 'text', familyname: 'text' }); // recherche sur nom du prof
const User = mongoose.model('User', userSchema);

module.exports = User;



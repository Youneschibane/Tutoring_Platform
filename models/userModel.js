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
    }





},
    { timestamps: true },
);



userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }


    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;



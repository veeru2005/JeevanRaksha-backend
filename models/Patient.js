const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    registrationType: {
        type: String,
        enum: ['aadhaar', 'driving_license'],
        required: true
    },
    // Aadhaar specific fields
    aadhaarNumber: {
        type: String,
        sparse: true,
        unique: true,
        validate: {
            validator: function (v) {
                return !v || /^\d{12}$/.test(v);
            },
            message: 'Aadhaar number must be 12 digits'
        }
    },
    aadhaarOTP: String,
    aadhaarVerified: {
        type: Boolean,
        default: false
    },

    // Driving License specific fields
    drivingLicenseNumber: {
        type: String,
        sparse: true,
        unique: true
    },
    dateOfBirth: Date,
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other', ''],
        default: ''
    },
    dlVerified: {
        type: Boolean,
        default: false
    },

    // Digital Health Card ID
    healthId: {
        type: String,
        unique: true,
        sparse: true
    },


    // Common fields
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    mobileNumber: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^\d{10}$/.test(v);
            },
            message: 'Mobile number must be 10 digits'
        }
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        sparse: true,
        validate: {
            validator: function (v) {
                return !v || /^\S+@\S+\.\S+$/.test(v);
            },
            message: 'Invalid email address'
        }
    },
    address: {
        type: String,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    bloodType: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']
    },
    allergies: [{
        type: String
    }],
    emergencyContacts: [{
        name: String,
        relationship: String,
        phone: String
    }],
    medicalConditions: [{
        condition: String,
        diagnosedDate: Date,
        notes: String
    }],
    medications: [{
        name: String,
        dosage: String,
        frequency: String
    }],

    // System fields
    isActive: {
        type: Boolean,
        default: true
    },
    consentGiven: {
        type: Boolean,
        required: true
    },
    qrCode: String,
    profileCreatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create indexes
patientSchema.index({ mobileNumber: 1 });
patientSchema.index({ email: 1 });

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;

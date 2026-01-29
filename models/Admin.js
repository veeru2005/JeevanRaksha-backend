const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'superadmin'],
    default: 'admin'
  },
  permissions: {
    viewPatients: {
      type: Boolean,
      default: true
    },
    editPatients: {
      type: Boolean,
      default: false
    },
    deletePatients: {
      type: Boolean,
      default: false
    },
    viewMedicalRecords: {
      type: Boolean,
      default: true
    },
    editMedicalRecords: {
      type: Boolean,
      default: false
    },
    manageAdmins: {
      type: Boolean,
      default: false
    },
    viewReports: {
      type: Boolean,
      default: true
    },
    systemSettings: {
      type: Boolean,
      default: false
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Admin', adminSchema);

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// CORS configuration for production
const allowedOrigins = [
    'http://localhost:5173',  // Local development
    'http://localhost:3000',  // Alternative local port
    'https://jeevanrakshahealthcard.vercel.app',  // Production frontend URL (new)
    process.env.FRONTEND_URL,  // Additional production frontend URL from env
].filter(Boolean); // Remove undefined values

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
    });

// Import Patient Model
const Patient = require('./models/Patient');
const Admin = require('./models/Admin');
const bcrypt = require('bcryptjs');
const { generateToken, verifyToken, verifySuperAdmin, checkPermission } = require('./middleware/auth');
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('./utils/email');
const { contactTemplate } = require('./utils/emailTemplates/contactTemplate');

// Routes
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    res.json({
        status: 'Online',
        database: dbStatus,
        timestamp: new Date().toISOString()
    });
});

// Contact form endpoint - sends an email to site owner/support
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ success: false, message: 'Name, email, subject and message are required' });
        }

        const receiver = process.env.CONTACT_RECEIVER || process.env.EMAIL_USER;
        if (!receiver) {
            return res.status(500).json({ success: false, message: 'Email receiver not configured on server' });
        }

        const html = contactTemplate({ name, email, subject, message, submittedAt: new Date() });

        await sendEmail({
            to: receiver,
            subject: `New contact message from ${name}`,
            html,
            text: `From: ${name} <${email}>\n\n${message}`
        });

        res.json({ success: true, message: 'Message sent. Thank you!' });
    } catch (err) {
        console.error('Contact send error:', err);
        res.status(500).json({ success: false, message: 'Failed to send message', error: err.message });
    }
});

// Get all patients
app.get('/api/patients', async (req, res) => {
    try {
        const patients = await Patient.find().select('-aadhaarNumber -drivingLicenseNumber');
        res.json({
            success: true,
            count: patients.length,
            data: patients
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Get patient by ID
app.get('/api/patients/:id', async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }
        res.json({
            success: true,
            data: patient
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Register with Aadhaar
app.post('/api/register/aadhaar', async (req, res) => {
    try {
        const {
            aadhaarNumber,
            otp,
            fullName,
            mobileNumber,
            email,
            password,
            consentGiven
        } = req.body;

        // Validate required fields
        if (!aadhaarNumber || !fullName || !mobileNumber || !consentGiven || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate Aadhaar number format
        if (!/^\d{12}$/.test(aadhaarNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Aadhaar number format. Must be 12 digits.'
            });
        }

        // Check if patient already exists with this Aadhaar or email
        const existingPatient = await Patient.findOne({
            $or: [{ aadhaarNumber }, { email }]
        });
        if (existingPatient) {
            return res.status(409).json({
                success: false,
                message: 'Patient with this Aadhaar or email already registered'
            });
        }

        // In production, verify OTP here
        // For demo purposes, we accept any OTP
        const isOTPValid = otp && otp.length === 6;

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if email is a superadmin email
        const superadminConfig = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'config', 'superadmins.json'), 'utf8')
        );
        const isSuperadminEmail = superadminConfig.superadminEmails.includes(email.toLowerCase());

        // If superadmin email, also create admin entry
        if (isSuperadminEmail) {
            // Check if admin already exists
            const existingAdmin = await Admin.findOne({ email });
            if (!existingAdmin) {
                const username = email.split('@')[0];
                const superadmin = new Admin({
                    username: username,
                    email: email,
                    password: hashedPassword,
                    role: 'superadmin',
                    isActive: true,
                    permissions: {
                        viewPatients: true,
                        editPatients: true,
                        deletePatients: true,
                        viewMedicalRecords: true,
                        editMedicalRecords: true,
                        manageAdmins: true,
                        viewReports: true,
                        systemSettings: true
                    }
                });
                await superadmin.save();
            }
        }

        // Create new patient
        const patient = new Patient({
            registrationType: 'aadhaar',
            aadhaarNumber,
            aadhaarVerified: isOTPValid,
            fullName,
            mobileNumber,
            email,
            password: hashedPassword,
            consentGiven,
            consentGiven,
            qrCode: `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            healthId: Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString()
        });

        await patient.save();

        // Generate token for auto-login
        const token = jwt.sign(
            { id: patient._id, email: patient.email },
            process.env.JWT_SECRET || 'jeevanraksha-secret-key',
            { expiresIn: '12h' }
        );

        res.status(201).json({
            success: true,
            message: 'Patient registered successfully with Aadhaar',
            data: {
                patientId: patient._id,
                fullName: patient.fullName,
                mobileNumber: patient.mobileNumber,
                email: patient.email,
                qrCode: patient.qrCode,
                verified: patient.aadhaarVerified,
                token: token,
                isSuperadmin: isSuperadminEmail
            }
        });
    } catch (err) {
        console.error('Aadhaar registration error:', err);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: err.message
        });
    }
});

// Register with Driving License
app.post('/api/register/driving-license', async (req, res) => {
    try {
        const {
            drivingLicenseNumber,
            dateOfBirth,
            fullName,
            mobileNumber,
            email,
            password
        } = req.body;

        // Validate required fields
        if (!drivingLicenseNumber || !dateOfBirth || !fullName || !mobileNumber || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Check if patient already exists with this DL or email
        const existingPatient = await Patient.findOne({
            $or: [{ drivingLicenseNumber }, { email }]
        });
        if (existingPatient) {
            return res.status(409).json({
                success: false,
                message: 'Patient with this Driving License or email already registered'
            });
        }

        // In production, verify DL with government database
        // For demo purposes, we accept any valid format
        const isDLValid = drivingLicenseNumber.length >= 10;

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if email is a superadmin email
        const superadminConfig = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'config', 'superadmins.json'), 'utf8')
        );
        const isSuperadminEmail = superadminConfig.superadminEmails.includes(email.toLowerCase());

        // If superadmin email, also create admin entry
        if (isSuperadminEmail) {
            // Check if admin already exists
            const existingAdmin = await Admin.findOne({ email });
            if (!existingAdmin) {
                const username = email.split('@')[0];
                const superadmin = new Admin({
                    username: username,
                    email: email,
                    password: hashedPassword,
                    role: 'superadmin',
                    isActive: true,
                    permissions: {
                        viewPatients: true,
                        editPatients: true,
                        deletePatients: true,
                        viewMedicalRecords: true,
                        editMedicalRecords: true,
                        manageAdmins: true,
                        viewReports: true,
                        systemSettings: true
                    }
                });
                await superadmin.save();
            }
        }

        // Create new patient
        const patient = new Patient({
            registrationType: 'driving_license',
            drivingLicenseNumber,
            dateOfBirth: new Date(dateOfBirth),
            dlVerified: isDLValid,
            fullName,
            mobileNumber,
            email,
            password: hashedPassword,
            consentGiven: true, // Assumed for DL registration
            qrCode: `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            healthId: Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString()
        });

        await patient.save();

        // Generate token for auto-login
        const dlToken = jwt.sign(
            { id: patient._id, email: patient.email },
            process.env.JWT_SECRET || 'jeevanraksha-secret-key',
            { expiresIn: '12h' }
        );

        res.status(201).json({
            success: true,
            message: 'Patient registered successfully with Driving License',
            data: {
                patientId: patient._id,
                fullName: patient.fullName,
                mobileNumber: patient.mobileNumber,
                email: patient.email,
                qrCode: patient.qrCode,
                verified: patient.dlVerified,
                token: dlToken,
                isSuperadmin: isSuperadminEmail
            }
        });
    } catch (err) {
        console.error('Driving License registration error:', err);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: err.message
        });
    }
});

// Patient Login
app.post('/api/patients/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find patient by email
        const patient = await Patient.findOne({ email });
        if (!patient) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, patient.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                patientId: patient._id,
                email: patient.email,
                type: 'patient'
            },
            process.env.JWT_SECRET || 'jeevanraksha-secret-key',
            { expiresIn: '12h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                patient: {
                    id: patient._id,
                    fullName: patient.fullName,
                    email: patient.email,
                    mobileNumber: patient.mobileNumber,
                    qrCode: patient.qrCode,
                    bloodGroup: patient.bloodGroup,
                    allergies: patient.allergies,
                    chronicConditions: patient.chronicConditions,
                    emergencyContact: patient.emergencyContact
                }
            }
        });
    } catch (err) {
        console.error('Patient login error:', err);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: err.message
        });
    }
});

// Update patient medical information
app.put('/api/patients/:id', async (req, res) => {
    try {
        const { bloodType, allergies, emergencyContacts, medicalConditions, medications, dob, dateOfBirth, gender, address } = req.body;

        const updateFields = {
            bloodType,
            allergies,
            emergencyContacts,
            medicalConditions,
            medications,
            address
        };

        // Accept either `dob` (from frontend) or `dateOfBirth` and convert to Date when provided
        const dobValue = dob || dateOfBirth;
        if (dobValue) {
            const parsed = new Date(dobValue);
            if (!isNaN(parsed.getTime())) updateFields.dateOfBirth = parsed;
        }

        if (typeof gender !== 'undefined') {
            updateFields.gender = gender;
        }

        const patient = await Patient.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        res.json({
            success: true,
            message: 'Patient information updated successfully',
            data: patient
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Emergency access - get critical patient information by QR code
app.get('/api/emergency/:qrCode', async (req, res) => {
    try {
        const patient = await Patient.findOne({ qrCode: req.params.qrCode });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        // Return only critical information
        res.json({
            success: true,
            data: {
                fullName: patient.fullName,
                bloodType: patient.bloodType,
                allergies: patient.allergies,
                emergencyContacts: patient.emergencyContacts,
                medicalConditions: patient.medicalConditions,
                medications: patient.medications
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ==================== ADMIN AUTHENTICATION ROUTES ====================

// Sync superadmin access for existing patients
app.post('/api/admin/sync-superadmin', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email is in superadmin list
        const superadminConfig = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'config', 'superadmins.json'), 'utf8')
        );

        if (!superadminConfig.superadminEmails.includes(email.toLowerCase())) {
            return res.status(403).json({ success: false, error: 'Email is not a superadmin email' });
        }

        // Find patient with this email
        const patient = await Patient.findOne({ email });
        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient not found with this email' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, patient.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid password' });
        }

        // Check if admin already exists
        let admin = await Admin.findOne({ email });
        if (!admin) {
            // Create admin entry
            admin = new Admin({
                username: email.split('@')[0],
                email: email,
                password: patient.password, // Use same hashed password
                role: 'superadmin',
                isActive: true,
                permissions: {
                    viewPatients: true,
                    editPatients: true,
                    deletePatients: true,
                    viewMedicalRecords: true,
                    editMedicalRecords: true,
                    manageAdmins: true,
                    viewReports: true,
                    systemSettings: true
                }
            });
            await admin.save();
        }

        // Generate admin token
        const token = jwt.sign(
            { id: admin._id, role: admin.role },
            process.env.JWT_SECRET || 'jeevanraksha-secret-key',
            { expiresIn: '12h' }
        );

        res.json({
            success: true,
            message: 'Superadmin access synced successfully',
            token: token,
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Check superadmin emails endpoint (for reference)
app.get('/api/admin/superadmin-emails', async (req, res) => {
    try {
        const superadminConfig = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'config', 'superadmins.json'), 'utf8')
        );
        res.json({
            success: true,
            message: 'Superadmin emails are configured. Users registering with these emails will automatically get superadmin access.',
            count: superadminConfig.superadminEmails.length
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find admin by email
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        // Generate JWT token
        const token = generateToken(admin._id, admin.role);

        res.json({
            success: true,
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Get current admin profile
app.get('/api/admin/profile', verifyToken, async (req, res) => {
    try {
        res.json({
            success: true,
            admin: {
                id: req.admin._id,
                username: req.admin.username,
                email: req.admin.email,
                role: req.admin.role,
                permissions: req.admin.permissions,
                lastLogin: req.admin.lastLogin
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Get all admins (superadmin only)
app.get('/api/admin/users', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
        res.json({
            success: true,
            admins
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Create new admin (superadmin only)
app.post('/api/admin/create', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { username, email, password, role, permissions } = req.body;

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({
            $or: [{ email }, { username }]
        });

        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                error: 'Admin with this email or username already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new admin
        const newAdmin = new Admin({
            username,
            email,
            password: hashedPassword,
            role: role || 'admin',
            permissions: permissions || {
                viewPatients: true,
                editPatients: false,
                deletePatients: false,
                viewMedicalRecords: true,
                editMedicalRecords: false,
                manageAdmins: false,
                viewReports: true,
                systemSettings: false
            },
            createdBy: req.admin._id
        });

        await newAdmin.save();

        res.json({
            success: true,
            message: 'Admin created successfully',
            admin: {
                id: newAdmin._id,
                username: newAdmin.username,
                email: newAdmin.email,
                role: newAdmin.role,
                permissions: newAdmin.permissions
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Update admin (superadmin only)
app.put('/api/admin/update/:id', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, role, permissions, isActive } = req.body;

        const admin = await Admin.findById(id);
        if (!admin) {
            return res.status(404).json({
                success: false,
                error: 'Admin not found'
            });
        }

        // Update fields
        if (username) admin.username = username;
        if (email) admin.email = email;
        if (role) admin.role = role;
        if (permissions) admin.permissions = permissions;
        if (typeof isActive !== 'undefined') admin.isActive = isActive;

        await admin.save();

        res.json({
            success: true,
            message: 'Admin updated successfully',
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions,
                isActive: admin.isActive
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Delete admin (superadmin only)
app.delete('/api/admin/delete/:id', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting yourself
        if (id === req.admin._id.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }

        const admin = await Admin.findByIdAndDelete(id);
        if (!admin) {
            return res.status(404).json({
                success: false,
                error: 'Admin not found'
            });
        }

        res.json({
            success: true,
            message: 'Admin deleted successfully'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Get all patients (admin route with permission check)
app.get('/api/admin/patients', verifyToken, checkPermission('viewPatients'), async (req, res) => {
    try {
        const patients = await Patient.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            count: patients.length,
            patients
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Get patient by ID (admin route)
app.get('/api/admin/patients/:id', verifyToken, checkPermission('viewPatients'), async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }
        res.json({
            success: true,
            patient
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Update patient (admin route with permission check)
app.put('/api/admin/patients/:id', verifyToken, checkPermission('editPatients'), async (req, res) => {
    try {
        const patient = await Patient.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }

        res.json({
            success: true,
            message: 'Patient updated successfully',
            patient
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Delete patient (admin route with permission check)
app.delete('/api/admin/patients/:id', verifyToken, checkPermission('deletePatients'), async (req, res) => {
    try {
        const patient = await Patient.findByIdAndDelete(req.params.id);

        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found'
            });
        }

        res.json({
            success: true,
            message: 'Patient deleted successfully'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Get dashboard statistics (admin route)
app.get('/api/admin/dashboard/stats', verifyToken, async (req, res) => {
    try {
        const totalPatients = await Patient.countDocuments();
        const totalAdmins = await Admin.countDocuments();
        const recentPatients = await Patient.find().sort({ createdAt: -1 }).limit(5);
        const activeAdmins = await Admin.countDocuments({ isActive: true });

        res.json({
            success: true,
            stats: {
                totalPatients,
                totalAdmins,
                activeAdmins,
                recentPatients
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});

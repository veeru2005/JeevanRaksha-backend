const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'jeevanraksha-secret-key-2024';

// Generate JWT Token
const generateToken = (adminId, role) => {
  return jwt.sign(
    { id: adminId, role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
};

// Verify JWT Token Middleware
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select('-password');

    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Invalid token or admin inactive.' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// Check if admin is superadmin
const verifySuperAdmin = (req, res, next) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
  }
  next();
};

// Check specific permission
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (req.admin.role === 'superadmin') {
      // Superadmins have all permissions
      return next();
    }

    if (!req.admin.permissions[permission]) {
      return res.status(403).json({ error: `Access denied. '${permission}' permission required.` });
    }
    next();
  };
};

module.exports = {
  generateToken,
  verifyToken,
  verifySuperAdmin,
  checkPermission,
  JWT_SECRET
};

const jwt = require('jsonwebtoken');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "UAI_SECRET";

// Authentication middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.sendStatus(401);
  }
}

// Admin middleware
function admin(req, res, next) {
  if (!req.user?.is_admin) return res.sendStatus(403);
  next();
}

module.exports = {
  auth,
  admin,
  JWT_SECRET
};

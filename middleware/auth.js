const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'super_secret_change_me';

function authRequired(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Non autenticato' });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Sessione non valida' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Permessi insufficienti' });
    }
    next();
  };
}

module.exports = {
  SECRET,
  authRequired,
  requireRole
};

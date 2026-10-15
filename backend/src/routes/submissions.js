const router = require('express').Router();
const { listSubmissions, createSubmission, getSubmission } = require('../controllers/submissionController');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

// Optional auth helper: populates req.user if token is provided
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      req.user = decoded;
    } catch {
      // ignore invalid token in optional mode
    }
  }
  next();
};

router.get('/', optionalAuthenticate, listSubmissions);
router.post('/', optionalAuthenticate, createSubmission);
router.get('/:id', optionalAuthenticate, getSubmission);

module.exports = router;

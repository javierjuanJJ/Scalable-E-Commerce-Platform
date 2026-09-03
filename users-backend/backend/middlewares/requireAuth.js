export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });
  }
  next();
}
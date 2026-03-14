import type { RequestHandler } from 'express';
import { ApiError } from '@atlas/core';

export const requireRole = (...roles: string[]): RequestHandler => {
  return (req, _res, next) => {
    const userRoles = req.auth?.realm_access?.roles || [];
    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }

    next();
  };
};

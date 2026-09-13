import { applyDecorators, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { JwtGuard } from '../auth/jwt.guard.js';

/**
 * Restricts a controller (class) or a single endpoint (method) to administrators.
 *
 * Runs `JwtGuard` before `AdminGuard`, so a request without a valid token
 * (missing, expired or tampered) gets `401` and a valid token of a user with
 * `admin !== true` gets `403` with `ADMIN_REQUIRED`.
 *
 * Do not combine with `@Public()`: the endpoint stays protected and answers `401`.
 */
export const AdminOnly = () => applyDecorators(UseGuards(JwtGuard, AdminGuard));

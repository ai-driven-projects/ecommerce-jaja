import { Request } from 'express';
import { AppUser } from './app-user.type.js';

export interface AuthenticatedRequest extends Request {
  user: AppUser;
}

import { Request } from 'express';
import { AuthenticatedUser } from '@mentoria-360/shared';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

import { AuthenticatedUser } from '@mentoria-360/shared';
import { JwtPayload } from '../types/jwt-payload.type.js';

export function mapPayloadToAuthenticatedUser(
  payload: JwtPayload,
): AuthenticatedUser {
  return {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
  };
}

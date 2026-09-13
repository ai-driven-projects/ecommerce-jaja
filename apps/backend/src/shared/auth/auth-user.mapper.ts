import { AppUser } from '../types/app-user.type.js';
import { JwtPayload } from '../types/jwt-payload.type.js';

export function mapPayloadToAuthenticatedUser(payload: JwtPayload): AppUser {
  return {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    admin: payload.admin === true,
  };
}

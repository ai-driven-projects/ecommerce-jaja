import { AuthenticatedUser } from '@mentoria-360/shared';

export type AppUser = AuthenticatedUser & { admin: boolean };

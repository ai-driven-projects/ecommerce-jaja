export type JwtPayload = {
  sub: string;
  name: string;
  email: string;
  admin: boolean;
  iat?: number;
  exp?: number;
};

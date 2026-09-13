import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UserPrisma } from './user.prisma';
import { UserDTO } from '__AUTH_PACKAGE_NAME__';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userPrisma: UserPrisma) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          if (request?.cookies?.access_token) {
            return request.cookies.access_token as string;
          }

          const authHeader = request?.headers?.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: { sub: string; email: string }): Promise<UserDTO> {
    const userResult = await this.userPrisma.findUserByIdQuery.execute(
      payload.sub,
    );

    if (userResult.isFailure) {
      throw new UnauthorizedException();
    }

    const user = userResult.instance;
    return user;
  }
}

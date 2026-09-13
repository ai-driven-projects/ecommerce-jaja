import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticateUser, CreateUser, UserDTO, UserErrors } from '@jaja/auth';
import { PrismaService } from '../../db/prisma.service.js';
import { JwtGuard } from '../../shared/auth/jwt.guard.js';
import { CurrentUser } from '../../shared/decorators/current-user.decorator.js';
import { Public } from '../../shared/decorators/public.decorator.js';
import type { AppUser } from '../../shared/types/app-user.type.js';
import type { JwtPayload } from '../../shared/types/jwt-payload.type.js';
import { BcryptProvider } from './bcrypt.provider.js';
import { PasswordPrisma } from './password.prisma.js';
import { UserPrisma } from './user.prisma.js';

export type RegisterBody = {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string;
};

export type LoginBody = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: UserDTO;
};

@Controller('auth')
@UseGuards(JwtGuard)
export class AuthController {
  constructor(
    private readonly userPrisma: UserPrisma,
    private readonly passwordPrisma: PasswordPrisma,
    private readonly bcrypt: BcryptProvider,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  async register(@Body() body: RegisterBody): Promise<void> {
    const useCase = new CreateUser(
      this.userPrisma,
      this.passwordPrisma,
      this.bcrypt,
      this.prisma,
    );

    // Only these fields reach the use case: `admin` in the body is discarded.
    const result = await useCase.execute({
      name: body?.name,
      email: body?.email,
      password: body?.password,
      avatarUrl: body?.avatarUrl,
    });

    if (result.isFailure) {
      const codes = this.uniqueCodes(result.errors);
      if (codes.includes(UserErrors.EMAIL_ALREADY_EXISTS)) {
        throw new ConflictException(codes);
      }
      throw new BadRequestException(codes);
    }
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginBody): Promise<LoginResponse> {
    const useCase = new AuthenticateUser(
      this.userPrisma,
      this.passwordPrisma,
      this.bcrypt,
    );

    const result = await useCase.execute({
      email: body?.email,
      password: body?.password,
    });

    if (result.isFailure) {
      const codes = this.uniqueCodes(result.errors);
      if (codes.includes(UserErrors.INVALID_CREDENTIALS)) {
        throw new UnauthorizedException(codes);
      }
      throw new BadRequestException(codes);
    }

    const user = result.instance;
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      name: user.name,
      email: user.email,
      admin: user.admin,
    };

    return { token: this.jwtService.sign(payload), user };
  }

  @Get('me')
  me(@CurrentUser() user: AppUser): AppUser {
    return user;
  }

  // Value objects may repeat a code (e.g. Email); the API exposes each code once.
  private uniqueCodes(errors: string[]): string[] {
    return [...new Set(errors)];
  }
}

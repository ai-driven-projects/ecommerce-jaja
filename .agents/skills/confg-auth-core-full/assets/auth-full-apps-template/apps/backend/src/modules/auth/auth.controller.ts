import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  HttpCode,
  BadRequestException,
  UseGuards,
  Get,
  Param,
  Query,
  NotFoundException,
  Patch,
  Delete,
  InternalServerErrorException,
  Req,
  Res,
  } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { Request,
  Response } from 'express';
import { UserPrisma } from './user.prisma';
import { PasswordPrisma } from './password.prisma';
import {
  AssignRolesToUserIn,
  AssignRolesToUserUseCase,
  ChangePasswordUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  FindAllUsersUseCase,
  FindUserByEmailUseCase,
  FindUserByIdUseCase,
  LoginUseCase,
  PERMISSIONS,
  GetAuthDashboardOverviewUseCase,
  UpdateProfileUseCase,
  UpdateUserUseCase,
  PasswordErrors,
  LoginOAuthUseCase,
  OAuthErrors,
} from '__AUTH_PACKAGE_NAME__';
import type {
  ChangePasswordIn,
  CreateUserIn,
  LoginIn,
  UpdateProfileIn,
  UpdateUserIn,
  UserDTO,
} from '__AUTH_PACKAGE_NAME__';
import { RolePrisma } from './role.prisma';
import { AuditPrisma } from './audit.prisma';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { RequirePermissionGuard } from 'src/shared/guards/require-permission.guard';
import { RequirePermission } from 'src/shared/decorators/require-permission.decorator';
import { BcryptProvider } from 'src/modules/auth/providers/bcrypt.provider';
import { OAuthAccountPrisma } from './oauth-account.prisma';
import { GoogleOAuthProvider } from './providers/google-oauth.provider';
import { PrismaTransactionManager } from 'src/db/prisma-transaction.manager';

const OAUTH_STATE_COOKIE = 'oauth_state_google';
const ACCESS_TOKEN_COOKIE = 'access_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userPrisma: UserPrisma,
    private readonly passPrisma: PasswordPrisma,
    private readonly rolePrisma: RolePrisma,
    private readonly auditPrisma: AuditPrisma,
    private readonly jwtService: JwtService,
    private readonly bcryptProvider: BcryptProvider,
    private readonly oauthAccountPrisma: OAuthAccountPrisma,
    private readonly googleOAuthProvider: GoogleOAuthProvider,
    private readonly transactionManager: PrismaTransactionManager,
  ) {}

  @Post('login')
  async login(@Body() dados: LoginIn): Promise<{ token: string }> {
    const uc = new LoginUseCase(
      this.userPrisma,
      this.passPrisma.findPasswordHashQuery,
      this.bcryptProvider,
    );

    const res = await uc.execute(dados);
    if (res.isFailure) {
      throw new UnauthorizedException({ errors: res.errors });
    }

    const payload = {
      sub: res.instance.id,
      name: res.instance.name,
      email: res.instance.email,
    };

    return {
      token: this.jwtService.sign(payload),
    };
  }

  @Get('google/start')
  googleOAuthStart(@Res() response: Response) {
    const state = randomUUID();
    const urlResult = this.googleOAuthProvider.getAuthorizationUrl(state);
    if (urlResult.isFailure) {
      throw new InternalServerErrorException({ errors: urlResult.errors });
    }

    response.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000,
    });

    return response.redirect(urlResult.instance);
  }

  @Get('google/callback')
  async googleOAuthCallback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const signInUrl = `${frontendUrl}/auth/sign-in`;

    if (!code) {
      response.clearCookie(OAUTH_STATE_COOKIE);
      response.redirect(
        `${signInUrl}?error=${OAuthErrors.INVALID_CALLBACK_CODE}`,
      );
      return;
    }

    const stateCookie = request.cookies?.[OAUTH_STATE_COOKIE] as
      | string
      | undefined;
    if (!state || !stateCookie || state !== stateCookie) {
      response.clearCookie(OAUTH_STATE_COOKIE);
      response.redirect(`${signInUrl}?error=OAUTH_INVALID_STATE`);
      return;
    }

    const uc = new LoginOAuthUseCase(
      this.userPrisma,
      this.userPrisma.findUserByIdQuery,
      this.rolePrisma,
      this.oauthAccountPrisma,
      this.googleOAuthProvider,
    );
    const result = await uc.execute({ code });

    response.clearCookie(OAUTH_STATE_COOKIE);

    if (result.isFailure) {
      const error = result.errors?.[0] || 'OAUTH_LOGIN_FAILED';
      response.redirect(`${signInUrl}?error=${error}`);
      return;
    }

    const payload = {
      sub: result.instance.id,
      name: result.instance.name,
      email: result.instance.email,
    };

    const accessToken = this.jwtService.sign(payload);

    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000,
    });

    response.redirect(`${frontendUrl}/dashboard`);
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() dados: CreateUserIn & { confirmPassword: string }) {
    if (dados.password !== dados.confirmPassword) {
      throw new BadRequestException({ errors: [PasswordErrors.MISMATCH] });
    }
    const uc = new CreateUserUseCase(
      this.userPrisma,
      this.passPrisma,
      this.userPrisma.userExistsQuery,
      this.bcryptProvider,
      this.transactionManager,
    );
    const result = await uc.execute({
      name: dados.name,
      email: dados.email,
      password: dados.password,
    });

    if (result.isFailure) {
      throw new BadRequestException({ errors: result.errors });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: UserDTO) {
    return user;
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.AUDIT.READ)
  @Get('overview')
  async getDashboardOverview() {
    const uc = new GetAuthDashboardOverviewUseCase(
      this.auditPrisma.findAuthLoginOverviewQuery,
      this.auditPrisma.findAuthLoginTimelineQuery,
      this.auditPrisma.findAuthTopFailedEmailsQuery,
      this.auditPrisma.findAuthLatencyByWeekdayQuery,
      this.auditPrisma.findAuthAlertBoardQuery,
      this.auditPrisma.findAuthActivityRankingQuery,
    );
    const result = await uc.execute();

    if (result.isFailure) {
      throw new InternalServerErrorException({ errors: result.errors });
    }

    return result.instance;
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.USER.READ)
  @Get('users')
  async getAllUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);

    const uc = new FindAllUsersUseCase(this.userPrisma.findAllUsersQuery);
    const result = await uc.execute({
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      pageSize:
        Number.isFinite(parsedPageSize) && parsedPageSize > 0
          ? parsedPageSize
          : 10,
    });

    if (result.isFailure) {
      return {
        data: [],
        meta: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
      };
    }

    return result.instance;
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.USER.DELETE)
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    const uc = new DeleteUserUseCase(this.userPrisma);
    const result = await uc.execute({ id });

    if (result.isFailure) {
      throw new InternalServerErrorException({ errors: result.errors });
    }
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.USER.UPDATE)
  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() data: Omit<UpdateUserIn, 'id'>,
  ) {
    const uc = new UpdateUserUseCase(this.userPrisma);
    const result = await uc.execute({ ...data, id });

    if (result.isFailure) {
      throw new BadRequestException({ errors: result.errors });
    }

    return result.instance;
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.USER.READ)
  @Get('users/by-email')
  async getUserByEmail(@Query('email') email?: string) {
    if (!email) {
      throw new BadRequestException({ errors: ['EMAIL_IS_REQUIRED'] });
    }

    const uc = new FindUserByEmailUseCase(this.userPrisma.findUserByEmailQuery);
    const result = await uc.execute(email);

    if (result.isFailure) {
      throw new NotFoundException({ errors: result.errors });
    }
    return result.instance;
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.BASIC.USER.READ_OWN)
  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    const uc = new FindUserByIdUseCase(this.userPrisma.findUserByIdQuery);
    const result = await uc.execute(id);

    if (result.isFailure) {
      throw new NotFoundException({ errors: result.errors });
    }
    return result.instance;
  }

  @Post('user/create')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.USER.CREATE)
  async create(@Body() dados: CreateUserIn) {
    const uc = new CreateUserUseCase(
      this.userPrisma,
      this.passPrisma,
      this.userPrisma.userExistsQuery,
      this.bcryptProvider,
      this.transactionManager,
    );
    const result = await uc.execute(dados);

    if (result.isFailure) {
      throw new BadRequestException({ errors: result.errors! });
    }
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.AUTH.USER.UPDATE)
  @Patch('users/:id/roles')
  @HttpCode(204)
  async assignRoles(
    @Param('id') id: string,
    @Body() data: Omit<AssignRolesToUserIn, 'userId'>,
  ) {
    const uc = new AssignRolesToUserUseCase(this.userPrisma, this.rolePrisma);
    const result = await uc.execute({ userId: id, roleIds: data.roleIds });

    if (result.isFailure) {
      throw new BadRequestException({ errors: result.errors });
    }
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.BASIC.USER.UPDATE_OWN)
  @Patch('password/change')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: UserDTO,
    @Body() data: Omit<ChangePasswordIn, 'userId'>,
  ) {
    const uc = new ChangePasswordUseCase(
      this.passPrisma,
      this.userPrisma.userExistsQuery,
      this.bcryptProvider,
    );
    const result = await uc.execute({ ...data, userId: user.id! });

    if (result.isFailure) {
      throw new BadRequestException({ errors: result.errors });
    }
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.BASIC.USER.DELETE_OWN)
  @Delete('profile')
  @HttpCode(204)
  async deleteOwnProfile(@CurrentUser() user: UserDTO) {
    const uc = new DeleteUserUseCase(this.userPrisma);
    const result = await uc.execute({ id: user.id! });

    if (result.isFailure) {
      throw new BadRequestException({ errors: result.errors });
    }
  }

  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @RequirePermission(PERMISSIONS.BASIC.USER.UPDATE_OWN)
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: UserDTO,
    @Body() data: Omit<UpdateProfileIn, 'id'>,
  ) {
    const uc = new UpdateProfileUseCase(this.userPrisma);
    const result = await uc.execute({ id: user.id!, ...data });

    if (result.isFailure) {
      throw new BadRequestException({ errors: result.errors });
    }

    return result.instance;
  }
}

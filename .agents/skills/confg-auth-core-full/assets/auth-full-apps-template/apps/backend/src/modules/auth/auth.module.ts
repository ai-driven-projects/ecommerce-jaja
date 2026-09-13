import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DbModule } from 'src/db/db.module';
import { PrismaTransactionManager } from 'src/db/prisma-transaction.manager';
import { RequirePermissionGuard } from 'src/shared/guards/require-permission.guard';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PasswordPrisma } from './password.prisma';
import { RolePrisma } from './role.prisma';
import { UserPrisma } from './user.prisma';
import { BcryptProvider } from 'src/modules/auth/providers/bcrypt.provider';
import { RoleController } from './role.controller';
import { PermissionPrisma } from './permission.prisma';
import { AuditPrisma } from './audit.prisma';
import { OAuthAccountPrisma } from './oauth-account.prisma';
import { GoogleOAuthProvider } from './providers/google-oauth.provider';

@Module({
  imports: [
    DbModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '60m' },
      }),
    }),
  ],
  controllers: [AuthController, RoleController],
  providers: [
    UserPrisma,
    PasswordPrisma,
    RolePrisma,
    PermissionPrisma,
    AuditPrisma,
    OAuthAccountPrisma,
    GoogleOAuthProvider,
    JwtStrategy,
    BcryptProvider,
    PrismaTransactionManager,
    RequirePermissionGuard,
  ],
  exports: [
    UserPrisma,
    PasswordPrisma,
    RolePrisma,
    PermissionPrisma,
    AuditPrisma,
    OAuthAccountPrisma,
    BcryptProvider,
  ],
})
export class AuthModule {}

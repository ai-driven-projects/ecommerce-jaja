import {
  CreateOAuthAccountInDTO,
  OAuthAccountDTO,
  OAuthAccountRepository,
  OAuthErrors,
  OAuthIdentityProvider,
} from '__AUTH_PACKAGE_NAME__';
import { Result } from '__SHARED_PACKAGE_NAME__';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/db/prisma.service';

type OAuthAccountPayload = Prisma.OAuthAccountGetPayload<{}>;

@Injectable()
export class OAuthAccountPrisma implements OAuthAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderAccount(input: {
    provider: OAuthIdentityProvider;
    providerUserId: string;
  }): Promise<Result<OAuthAccountDTO>> {
    try {
      const account = await this.prisma.client.oAuthAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: this.toPrismaProvider(input.provider),
            providerUserId: input.providerUserId,
          },
        },
      });

      if (!account) {
        return Result.fail(OAuthErrors.ACCOUNT_NOT_FOUND);
      }

      return Result.ok(this.toDto(account));
    } catch (error) {
      return Result.fail(error);
    }
  }

  async create(input: CreateOAuthAccountInDTO): Promise<Result<void>> {
    try {
      await this.prisma.client.oAuthAccount.create({
        data: {
          provider: this.toPrismaProvider(input.provider),
          providerUserId: input.providerUserId,
          email: input.email,
          emailVerified: input.emailVerified,
          name: input.name,
          avatarUrl: input.avatarUrl,
          userId: input.userId,
        },
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }

  private toDto(payload: OAuthAccountPayload): OAuthAccountDTO {
    return {
      userId: payload.userId,
      provider: this.fromPrismaProvider(payload.provider),
      providerUserId: payload.providerUserId,
      email: payload.email,
      emailVerified: payload.emailVerified,
      name: payload.name ?? undefined,
      avatarUrl: payload.avatarUrl ?? undefined,
    };
  }

  // NOTE: podemos ter vários outros provedores no futuro
  private toPrismaProvider(provider: OAuthIdentityProvider): 'GOOGLE' {
    if (provider === OAuthIdentityProvider.GOOGLE) {
      return 'GOOGLE';
    }

    throw new Error(OAuthErrors.PROVIDER_NOT_SUPPORTED);
  }

  private fromPrismaProvider(provider: 'GOOGLE'): OAuthIdentityProvider {
    if (provider === 'GOOGLE') {
      return OAuthIdentityProvider.GOOGLE;
    }

    throw new Error(OAuthErrors.PROVIDER_NOT_SUPPORTED);
  }
}

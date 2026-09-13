import {
  OAuthProvider,
  OAuthErrors,
  OAuthIdentityDTO,
  OAuthIdentityProvider,
} from '__AUTH_PACKAGE_NAME__';
import { Result } from '__SHARED_PACKAGE_NAME__';
import { Injectable } from '@nestjs/common';

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

@Injectable()
export class GoogleOAuthProvider implements OAuthProvider {
  private readonly authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private readonly userInfoUrl =
    'https://openidconnect.googleapis.com/v1/userinfo';

  getAuthorizationUrl(state: string): Result<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return Result.fail(OAuthErrors.PROVIDER_MISCONFIGURED);
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    return Result.ok(`${this.authUrl}?${params.toString()}`);
  }

  async getIdentityFromCode(code: string): Promise<Result<OAuthIdentityDTO>> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return Result.fail(OAuthErrors.PROVIDER_MISCONFIGURED);
    }

    try {
      const tokenBody = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const tokenResponse = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenResponse.ok) {
        return Result.fail(OAuthErrors.INVALID_CALLBACK_CODE);
      }

      const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

      if (!tokenData.access_token) {
        return Result.fail(OAuthErrors.INVALID_CALLBACK_CODE);
      }

      const userInfoResponse = await fetch(this.userInfoUrl, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return Result.fail(OAuthErrors.INVALID_CALLBACK_CODE);
      }

      const userInfo =
        (await userInfoResponse.json()) as GoogleUserInfoResponse;

      if (!userInfo.sub || !userInfo.email) {
        return Result.fail(OAuthErrors.EMAIL_NOT_AVAILABLE);
      }

      return Result.ok({
        provider: OAuthIdentityProvider.GOOGLE,
        providerUserId: userInfo.sub,
        email: userInfo.email,
        emailVerified: Boolean(userInfo.email_verified),
        name: userInfo.name,
        avatarUrl: userInfo.picture,
      });
    } catch (error) {
      return Result.fail(error);
    }
  }
}

import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEV_TOOLS_DISABLED = 'DEV_TOOLS_DISABLED';

/**
 * Turns the development tools on only when `DEV_TOOLS_ENABLED` is exactly
 * `"true"` (trimmed, any case); missing or any other value answers
 * `404 DEV_TOOLS_DISABLED`, as if the routes did not exist. Declared after
 * `@AdminOnly()` runs, so whoever is not an administrator gets the usual
 * 401/403 and never learns whether the tools are on.
 */
@Injectable()
export class DevToolsGuard implements CanActivate {
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = isDevToolsEnabled(config.get<string>('DEV_TOOLS_ENABLED'));
  }

  canActivate(): boolean {
    if (!this.enabled) throw new NotFoundException([DEV_TOOLS_DISABLED]);
    return true;
  }
}

export function isDevToolsEnabled(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

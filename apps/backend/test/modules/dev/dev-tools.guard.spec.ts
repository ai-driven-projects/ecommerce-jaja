import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { DevToolsGuard, isDevToolsEnabled } from '../../../src/modules/dev/dev-tools.guard.js';

function guardWith(value: string | undefined): DevToolsGuard {
  return new DevToolsGuard({ get: () => value } as unknown as ConfigService);
}

describe('isDevToolsEnabled', () => {
  it.each(['true', ' TRUE ', 'True'])('is on for "%s"', (value) => {
    expect(isDevToolsEnabled(value)).toBe(true);
  });

  it.each([undefined, '', 'false', '1', 'yes'])('is off for %p', (value) => {
    expect(isDevToolsEnabled(value)).toBe(false);
  });
});

describe('DevToolsGuard', () => {
  it('lets the request through when on', () => {
    expect(guardWith('true').canActivate()).toBe(true);
  });

  it('answers 404 DEV_TOOLS_DISABLED when off', () => {
    expect(() => guardWith(undefined).canActivate()).toThrow(NotFoundException);
    try {
      guardWith('false').canActivate();
    } catch (error) {
      expect((error as NotFoundException).getResponse()).toMatchObject({ message: ['DEV_TOOLS_DISABLED'] });
    }
  });
});

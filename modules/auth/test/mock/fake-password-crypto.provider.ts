import { PasswordCryptoProvider } from '../../src/password'

// Valid bcrypt shape: `$2b$10$` + 53 chars of [./A-Za-z0-9].
export const FAKE_HASH =
  '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0'

export class FakePasswordCryptoProvider implements PasswordCryptoProvider {
  constructor(private readonly knownPlain = '#Senha123') {}

  async hash(_plain: string): Promise<string> {
    return FAKE_HASH
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return plain === this.knownPlain && hash === FAKE_HASH
  }
}

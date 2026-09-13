import { Injectable } from '@nestjs/common';
import { PasswordCryptoProvider } from '@jaja/auth';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

@Injectable()
export class BcryptProvider implements PasswordCryptoProvider {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

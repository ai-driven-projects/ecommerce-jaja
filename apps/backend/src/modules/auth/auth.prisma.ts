import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';

@Injectable()
export class AuthPrisma {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma.client;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service.js';

@Injectable()
export class OrdersPrisma {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma.client;
  }
}

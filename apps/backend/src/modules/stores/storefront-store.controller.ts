import { BadRequestException, Controller, Get } from '@nestjs/common';
import type { StorefrontStoreDTO } from '@jaja/stores';
import { StorePrisma } from './store.prisma.js';

// Public, read-only stores of the storefront. There is no global guard, so this
// route needs no token, and an `Authorization` header (valid or not) is simply
// ignored. It calls the query directly: the reading rules (active and
// non-deleted stores, public fields only, order by name) live in the SQL.
@Controller('storefront/stores')
export class StorefrontStoreController {
  constructor(private readonly storePrisma: StorePrisma) {}

  @Get()
  async findAll(): Promise<StorefrontStoreDTO[]> {
    const result = await this.storePrisma.findStorefrontStores.execute();

    // A read failure has no "not found" or conflict meaning: it is a 400 with
    // each code once, like the storefront catalog.
    if (result.isFailure) throw new BadRequestException([...new Set(result.errors)]);
    return result.instance;
  }
}

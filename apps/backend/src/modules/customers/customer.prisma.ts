import { Injectable } from '@nestjs/common';
import { Id, Result, TransactionContext } from '@mentoria-360/shared';
import {
  Customer,
  CustomerDetailDTO,
  CustomerErrors,
  CustomerListItemDTO,
  CustomerLocationDTO,
  CustomerRepository,
  FindCustomerByIdQuery,
  FindCustomerByUserIdQuery,
  FindCustomersQuery,
} from '@jaja/customers';
import { Customer as CustomerRow, Prisma } from '@prisma/client';
import {
  PrismaService,
  PrismaTransactionContext,
} from '../../db/prisma.service.js';
import { folded, toPrefixTsQuery } from '../../db/text-search.sql.js';

// Maps the unique constraints of `customers` to the domain error they represent.
// `customers_user_id_key` only fires when two first saves of the same user race;
// a primary key collision only happens when creating with the id of a deleted
// customer, which the API must answer as "not found".
const UNIQUE_VIOLATIONS = [
  { field: 'user_id', constraint: 'customers_user_id_key', code: CustomerErrors.CUSTOMER_ALREADY_EXISTS },
  { field: 'cpf', constraint: 'customers_cpf_key', code: CustomerErrors.CUSTOMER_CPF_ALREADY_EXISTS },
  { field: 'id', constraint: 'customers_pkey', code: CustomerErrors.CUSTOMER_NOT_FOUND },
] as const;

type ConstraintMeta = {
  target?: string | string[];
  field_name?: string;
  driverAdapterError?: {
    cause?: { constraint?: { index?: string; name?: string; fields?: string[] } };
  };
};

// Full-text document of a customer (`c`) joined with its user (`u`): name, email
// and CPF weigh more than phone and neighborhood. CPF and phone are stored as
// digits, so each one is a single lexeme matched by prefix.
const SEARCH_DOCUMENT = Prisma.raw(
  [
    `setweight(to_tsvector('simple', ${folded('u.name')}), 'A')`,
    `setweight(to_tsvector('simple', ${folded('u.email')}), 'A')`,
    `setweight(to_tsvector('simple', c.cpf), 'A')`,
    `setweight(to_tsvector('simple', c.phone), 'B')`,
    `setweight(to_tsvector('simple', ${folded('c.neighborhood')}), 'B')`,
  ].join(' || '),
);

// The database collation orders by bytes (uppercase first); the ICU collation
// orders user names ignoring case and accents. `c.id` keeps pages stable.
const NAME_ORDER = Prisma.raw('u.name COLLATE "pt-BR-x-icu", c.id');

const FROM_CUSTOMERS = Prisma.sql`FROM customers c JOIN users u ON u.id = c.user_id`;

// Digits with the punctuation of a CPF or phone mask: `529.982.247-25`, `(85) 99876-5432`.
const MASKED_SEARCH = /^[\d\s().-]+$/;
const MASKED_TERM = /^[\d().-]+$/;

/**
 * Reduces masked numbers to their digits, so they match the stored CPF and
 * phone: a search made only of mask characters becomes one digit term
 * (`(85) 99876` → `8599876`), and otherwise each masked term is reduced on its
 * own (`ana 529.982` → `ana 529982`). Without it `toPrefixTsQuery` would split
 * `529.982` into `529` and `982`, which match no lexeme.
 */
function toCustomerTsQuery(search: string): string | null {
  const text = MASKED_SEARCH.test(search)
    ? search.replace(/\D/g, '')
    : search
        .split(/\s+/)
        .map((term) => (MASKED_TERM.test(term) ? term.replace(/\D/g, '') : term))
        .join(' ');
  return toPrefixTsQuery(text);
}

type CustomerSearchRow = {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  neighborhood: string;
  city: string;
  state: string;
  is_active: boolean;
};

type CustomerWithUserRow = CustomerRow & { user: { name: string; email: string } };

function searchRowToDTO(row: CustomerSearchRow): CustomerListItemDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    cpf: row.cpf,
    phone: row.phone,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    isActive: row.is_active,
  };
}

@Injectable()
export class CustomerPrisma implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Read side (CQRS): rows are mapped straight to DTOs, without the entity, with
  // `name` and `email` of the linked user. The listing is raw SQL: Prisma has
  // neither full-text search on Postgres nor a collation-aware `orderBy`.
  readonly findCustomers: FindCustomersQuery = {
    execute: (filter) =>
      Result.tryAsync(async () => {
        const page = Math.max(1, Math.trunc(filter.page) || 1);
        const pageSize = Math.max(1, Math.trunc(filter.pageSize) || 1);
        const tsQuery = filter.search ? toCustomerTsQuery(filter.search) : null;

        const conditions = [Prisma.sql`c.deleted_at IS NULL`];
        if (typeof filter.isActive === 'boolean') {
          conditions.push(Prisma.sql`c.is_active = ${filter.isActive}`);
        }
        if (tsQuery) {
          conditions.push(Prisma.sql`(${SEARCH_DOCUMENT}) @@ to_tsquery('simple', ${tsQuery})`);
        }
        const where = Prisma.join(conditions, ' AND ');

        // With a search the best matches come first (name, email and CPF before
        // phone and neighborhood).
        const orderBy = tsQuery
          ? Prisma.sql`ts_rank(${SEARCH_DOCUMENT}, to_tsquery('simple', ${tsQuery})) DESC, ${NAME_ORDER}`
          : NAME_ORDER;

        const client = this.prisma.client;
        const [counts, rows] = await Promise.all([
          client.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${FROM_CUSTOMERS} WHERE ${where}`,
          client.$queryRaw<CustomerSearchRow[]>`
            SELECT c.id, u.name, u.email, c.cpf, c.phone, c.neighborhood, c.city, c.state, c.is_active
            ${FROM_CUSTOMERS}
            WHERE ${where}
            ORDER BY ${orderBy}
            LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        ]);

        const total = counts[0]?.total ?? 0;
        return {
          items: rows.map(searchRowToDTO),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      }),
  };

  readonly findCustomerById: FindCustomerByIdQuery = {
    execute: (id) =>
      Result.tryAsync(async () => {
        // A malformed id never matches the uuid column; skip the database error.
        if (!this.isUuid(id)) return null;

        const row = await this.prisma.client.customer.findFirst({
          where: { id, deletedAt: null },
          include: { user: { select: { name: true, email: true } } },
        });
        return row ? this.toDetailDTO(row) : null;
      }),
  };

  readonly findCustomerByUserId: FindCustomerByUserIdQuery = {
    execute: (userId) =>
      Result.tryAsync(async () => {
        if (!this.isUuid(userId)) return null;

        const row = await this.prisma.client.customer.findFirst({
          where: { userId, deletedAt: null },
          include: { user: { select: { name: true, email: true } } },
        });
        return row ? this.toDetailDTO(row) : null;
      }),
  };

  async create(customer: Customer, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        await this.clientFor(tx).customer.create({ data: this.fromDomain(customer) });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async update(customer: Customer, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      try {
        // `deletedAt: null` keeps a deleted customer from being edited back to life.
        await this.clientFor(tx).customer.update({
          where: { id: customer.id, deletedAt: null },
          data: this.fromDomain(customer),
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  async findById(id: string): Promise<Result<Customer>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<Customer>(CustomerErrors.CUSTOMER_NOT_FOUND);

      const row = await this.prisma.client.customer.findFirst({
        where: { id, deletedAt: null },
      });
      if (!row) return Result.fail<Customer>(CustomerErrors.CUSTOMER_NOT_FOUND);
      return this.toDomain(row);
    });
  }

  async findByUserId(userId: string): Promise<Result<Customer | null>> {
    return Result.tryAsync(async () => {
      // A malformed id never matches the uuid column; skip the database error.
      if (!this.isUuid(userId)) return Result.ok<Customer | null>(null);

      const row = await this.prisma.client.customer.findFirst({
        where: { userId, deletedAt: null },
      });
      if (!row) return Result.ok<Customer | null>(null);
      return this.toDomain(row);
    });
  }

  async findByCpf(cpf: string): Promise<Result<Customer | null>> {
    return Result.tryAsync(async () => {
      // An empty filter would match any customer in Prisma, so it finds nothing instead.
      if (typeof cpf !== 'string' || !cpf) return Result.ok<Customer | null>(null);

      const row = await this.prisma.client.customer.findFirst({
        where: { cpf, deletedAt: null },
      });
      if (!row) return Result.ok<Customer | null>(null);
      return this.toDomain(row);
    });
  }

  // Soft delete: fills `deletedAt` and keeps the record. Exists only because of
  // the repository contract; no use case deletes customers.
  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      if (!this.isUuid(id)) return Result.fail<void>(CustomerErrors.CUSTOMER_NOT_FOUND);

      try {
        await this.clientFor(tx).customer.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return Result.ok<void>();
      } catch (error) {
        return this.writeFailure(error);
      }
    });
  }

  private clientFor(tx?: TransactionContext) {
    return (tx as PrismaTransactionContext | undefined)?.client ?? this.prisma.client;
  }

  private isUuid(id: unknown): id is string {
    return typeof id === 'string' && Id.isValid(id);
  }

  // Translates the known write failures into domain errors; anything else is
  // rethrown and becomes a failure through `Result.tryAsync`.
  private writeFailure(error: unknown): Result<void> {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025: the `where` matched no row (missing or already deleted customer).
      if (error.code === 'P2025') return Result.fail(CustomerErrors.CUSTOMER_NOT_FOUND);

      if (error.code === 'P2002') {
        const hints = this.constraintHints(error);
        const violation = UNIQUE_VIOLATIONS.find(({ field, constraint }) =>
          hints.some((hint) => hint === field || hint.includes(constraint)),
        );
        if (violation) return Result.fail(violation.code);
      }

      // `customers_user_id_fkey` is the only foreign key of the table: the linked
      // user no longer exists (e.g. a token issued before a `migrate reset`). The
      // code alone is the fallback when the driver adapter omits the constraint.
      if (error.code === 'P2003') {
        return Result.fail(CustomerErrors.CUSTOMER_USER_NOT_FOUND);
      }
    }
    throw error;
  }

  // With the driver adapter (`@prisma/adapter-pg`) P2002/P2003 have no
  // `meta.target`: the constraint name comes in
  // `meta.driverAdapterError.cause.constraint` and in the message. Every shape
  // is collected.
  private constraintHints(error: Prisma.PrismaClientKnownRequestError): string[] {
    const meta = (error.meta ?? {}) as ConstraintMeta;
    const constraint = meta.driverAdapterError?.cause?.constraint;

    return [
      ...[meta.target ?? []].flat(),
      meta.field_name,
      ...(constraint?.fields ?? []),
      constraint?.index,
      constraint?.name,
      error.message,
    ]
      .filter((hint): hint is string => typeof hint === 'string')
      .map((hint) => hint.replace(/"/g, ''));
  }

  private toDomain(row: CustomerRow): Result<Customer> {
    return Customer.tryCreate({
      id: row.id,
      userId: row.userId,
      cpf: row.cpf,
      phone: row.phone,
      address: {
        zipCode: row.zipCode,
        street: row.street,
        number: row.number,
        complement: row.complement,
        neighborhood: row.neighborhood,
        city: row.city,
        state: row.state,
        location: this.toLocation(row),
      },
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  private fromDomain(customer: Customer): Prisma.CustomerUncheckedCreateInput {
    const address = customer.address;
    return {
      id: customer.id,
      userId: customer.userId,
      cpf: customer.cpf,
      phone: customer.phone,
      zipCode: address.zipCode,
      street: address.street,
      number: address.number,
      complement: address.complement,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      // Both columns or none, as the `customers_location_both_or_none` constraint requires.
      latitude: address.location?.latitude ?? null,
      longitude: address.location?.longitude ?? null,
      isActive: customer.isActive,
      // Persisting the entity timestamps keeps the database equal to the returned DTO.
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  private toDetailDTO(row: CustomerWithUserRow): CustomerDetailDTO {
    return {
      id: row.id,
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      cpf: row.cpf,
      phone: row.phone,
      address: {
        zipCode: row.zipCode,
        street: row.street,
        number: row.number,
        complement: row.complement,
        neighborhood: row.neighborhood,
        city: row.city,
        state: row.state,
        location: this.toLocation(row),
      },
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // The point of the address, or `null` when the customer has not marked one.
  // The check constraint keeps both columns set or both null.
  private toLocation(row: CustomerRow): CustomerLocationDTO | null {
    if (row.latitude === null || row.longitude === null) return null;
    return { latitude: row.latitude, longitude: row.longitude };
  }
}

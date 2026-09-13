import {
  Alias,
  Entity,
  EntityProps,
  Flag,
  Id,
  Name,
  Result,
  Text,
  Url,
} from '@mentoria-360/shared'
import { BrandDTO } from '../dto'

export interface BrandProps extends EntityProps {
  name: string
  slug?: string | null
  description?: string | null
  logoUrl?: string | null
  isActive?: boolean
}

export class Brand extends Entity<Brand, BrandProps> {
  private constructor(props: BrandProps) {
    super(props)
  }

  static create(props: BrandProps): Brand {
    const result = Brand.tryCreate(props)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(props: BrandProps): Result<Brand> {
    const id = Id.tryCreate(props.id)
    const name = Name.tryCreate(props.name)
    const slug = Alias.tryCreate(Brand.resolveSlug(props.slug, props.name))
    const description = Text.tryCreate(props.description, {
      optional: true,
      maxLength: 500,
    })
    const logoUrl = Url.tryCreate(props.logoUrl, { optional: true })
    const isActive = Flag.tryCreate(props.isActive ?? true)

    const attrs = Result.combine([
      id,
      name,
      slug,
      description,
      logoUrl,
      isActive,
    ])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new Brand({
        ...props,
        id: id.instance.value,
        name: name.instance.value,
        slug: slug.instance.value,
        description: description.instance?.value ?? null,
        logoUrl: logoUrl.instance?.value ?? null,
        isActive: isActive.instance.value,
      }),
    )
  }

  // A missing or blank slug is derived from the name. `Alias` lowercases the
  // value before validating it, so lowercasing here yields exactly what is stored.
  static resolveSlug(slug: string | null | undefined, name: string): string {
    if (typeof slug === 'string' && slug.trim()) return slug.toLowerCase()
    return Alias.format(name)
  }

  get name(): string {
    return this.props.name
  }

  get slug(): string {
    return this.props.slug!
  }

  get description(): string | null {
    return this.props.description ?? null
  }

  get logoUrl(): string | null {
    return this.props.logoUrl ?? null
  }

  get isActive(): boolean {
    return this.props.isActive === true
  }

  toDTO(): BrandDTO {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      logoUrl: this.logoUrl,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}

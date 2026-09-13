import {
  Alias,
  Entity,
  EntityProps,
  Flag,
  Id,
  Name,
  Order,
  Result,
  Text,
  Url,
} from '@mentoria-360/shared'
import { CategoryErrors } from '../errors'

export interface CategoryProps extends EntityProps {
  name: string
  slug?: string | null
  description?: string | null
  // `null` marks a root category.
  parentId?: string | null
  order?: number | null
  isHighlighted?: boolean | null
  imageUrl?: string | null
  isActive?: boolean | null
}

// `level` and `path` depend on other categories, so they are not part of the
// entity: they are computed by the read side and exposed only in `CategoryDTO`.
export class Category extends Entity<Category, CategoryProps> {
  private constructor(props: CategoryProps) {
    super(props)
  }

  static create(props: CategoryProps): Category {
    const result = Category.tryCreate(props)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(props: CategoryProps): Result<Category> {
    const id = Id.tryCreate(props.id)
    const name = Name.tryCreate(props.name)
    const slug = Alias.tryCreate(Category.resolveSlug(props.slug, props.name))
    const description = Text.tryCreate(props.description, {
      optional: true,
      maxLength: 500,
    })
    const parentId = Id.tryCreate(props.parentId, { optional: true })
    const order = Order.tryCreate(props.order ?? 0)
    const isHighlighted = Flag.tryCreate(props.isHighlighted ?? false)
    const imageUrl = Url.tryCreate(props.imageUrl, { optional: true })
    const isActive = Flag.tryCreate(props.isActive ?? true)

    const attrs = Result.combine([
      id,
      name,
      slug,
      description,
      parentId,
      order,
      isHighlighted,
      imageUrl,
      isActive,
    ])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    // The only hierarchy invariant the entity can check on its own; a
    // descendant parent is detected by the use case with the same code.
    if (parentId.instance?.value === id.instance.value) {
      return Result.fail(CategoryErrors.CATEGORY_CYCLE)
    }

    return Result.ok(
      new Category({
        ...props,
        id: id.instance.value,
        name: name.instance.value,
        slug: slug.instance.value,
        description: description.instance?.value ?? null,
        parentId: parentId.instance?.value ?? null,
        order: order.instance.value,
        isHighlighted: isHighlighted.instance.value,
        imageUrl: imageUrl.instance?.value ?? null,
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

  get parentId(): string | null {
    return this.props.parentId ?? null
  }

  get order(): number {
    return this.props.order ?? 0
  }

  get isHighlighted(): boolean {
    return this.props.isHighlighted === true
  }

  get imageUrl(): string | null {
    return this.props.imageUrl ?? null
  }

  get isActive(): boolean {
    return this.props.isActive === true
  }

  get isRoot(): boolean {
    return this.parentId === null
  }
}

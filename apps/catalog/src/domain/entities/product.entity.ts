import { AggregateRoot } from '@ecommerce/ddd';
import {
  InvalidPriceError,
  InvalidProductDescriptionError,
  InvalidProductNameError,
  InvalidWeightError,
  ProductNotPublishableError,
  ProductNotPublishedError,
  type PublishRequirement,
  TooManyImagesError,
} from '../errors/product.error.js';
import type { ProductDetailField, ProductEvent } from '../events/catalog.events.js';
import type { CategoryId, ProductId, ProductImageId } from '../value-objects/identifiers.js';
import type { Money } from '../value-objects/money.value-object.js';

export const ProductStatus = ['draft', 'published', 'unpublished'] as const;
export type ProductStatus = (typeof ProductStatus)[number];

/** A processed image in S3; its position in `images` is its display order. */
export type ProductImage = {
  readonly id: ProductImageId;
  readonly key: string;
};

export const MAX_IMAGES = 8;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_WEIGHT_GRAMS = 100_000;

export type ProductProps = {
  id: ProductId;
  categoryId: CategoryId;
  name: string;
  description: string;
  price: Money | null;
  weightGrams: number | null;
  images: readonly ProductImage[];
  status: ProductStatus;
  createdAt: Date;
  publishedAt: Date | null;
};

export type ProductDetailsChanges = {
  name?: string;
  description?: string;
  categoryId?: CategoryId;
  weightGrams?: number;
};

/**
 * Lifecycle: draft → published ⇄ unpublished; never deleted (K1). A draft may be incomplete;
 * completeness is enforced when publishing (K2). Whether `categoryId` exists spans aggregates,
 * so the use case checks it.
 */
export class Product extends AggregateRoot<ProductEvent> {
  private constructor(private props: ProductProps) {
    super();
  }

  /** Creates a draft. Emits `ProductCreated`. */
  static create(input: {
    id: ProductId;
    categoryId: CategoryId;
    name: string;
    description?: string;
    price?: Money;
    weightGrams?: number;
    now: Date;
  }): Product {
    const product = new Product({
      id: input.id,
      categoryId: input.categoryId,
      name: validName(input.name),
      description: validDescription(input.description ?? ''),
      price: input.price ? validPrice(input.price) : null,
      weightGrams: input.weightGrams === undefined ? null : validWeight(input.weightGrams),
      images: [],
      status: 'draft',
      createdAt: input.now,
      publishedAt: null,
    });
    product.record({
      type: 'ProductCreated',
      productId: product.id,
      categoryId: product.categoryId,
      name: product.name,
      occurredAt: input.now,
    });
    return product;
  }

  /** Rebuilds a product from persistence. Emits nothing. */
  static restore(props: ProductProps): Product {
    return new Product({ ...props, images: [...props.images] });
  }

  get id(): ProductId {
    return this.props.id;
  }

  get categoryId(): CategoryId {
    return this.props.categoryId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get price(): Money | null {
    return this.props.price;
  }

  get weightGrams(): number | null {
    return this.props.weightGrams;
  }

  /** A copy: callers cannot bypass `attachImage` and its limit. */
  get images(): readonly ProductImage[] {
    return [...this.props.images];
  }

  get status(): ProductStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }

  /** Applies only the fields that actually change; emits nothing when none does. */
  updateDetails(changes: ProductDetailsChanges, now: Date): void {
    const next = {
      name: changes.name === undefined ? this.props.name : validName(changes.name),
      description:
        changes.description === undefined
          ? this.props.description
          : validDescription(changes.description),
      categoryId: changes.categoryId ?? this.props.categoryId,
      weightGrams:
        changes.weightGrams === undefined
          ? this.props.weightGrams
          : validWeight(changes.weightGrams),
    };
    const changedFields = (Object.keys(next) as ProductDetailField[]).filter(
      (field) => next[field] !== this.props[field],
    );
    if (changedFields.length === 0) return;

    this.props = { ...this.props, ...next };
    this.record({
      type: 'ProductDetailsUpdated',
      productId: this.id,
      changedFields,
      occurredAt: now,
    });
  }

  changePrice(price: Money, now: Date): void {
    validPrice(price);
    const previous = this.props.price;
    if (previous?.equals(price)) return;

    this.props = { ...this.props, price };
    this.record({
      type: 'ProductPriceChanged',
      productId: this.id,
      previous: previous?.toJSON() ?? null,
      current: price.toJSON(),
      occurredAt: now,
    });
  }

  /** Idempotent per image id, so a redelivered "image processed" message is harmless. */
  attachImage(image: ProductImage, now: Date): void {
    if (this.props.images.some((attached) => attached.id === image.id)) return;
    if (this.props.images.length >= MAX_IMAGES) throw new TooManyImagesError(MAX_IMAGES);

    this.props = { ...this.props, images: [...this.props.images, image] };
    this.record({
      type: 'ProductImageAttached',
      productId: this.id,
      imageId: image.id,
      occurredAt: now,
    });
  }

  /** Idempotent for a published product. Lists every missing requirement at once. */
  publish(now: Date): void {
    if (this.props.status === 'published') return;

    const missing: PublishRequirement[] = [];
    if (!this.props.price) missing.push('price');
    if (this.props.weightGrams === null) missing.push('weight');
    if (this.props.images.length === 0) missing.push('image');
    if (missing.length > 0) throw new ProductNotPublishableError(missing);

    this.props = { ...this.props, status: 'published', publishedAt: now };
    this.record({ type: 'ProductPublished', productId: this.id, occurredAt: now });
  }

  /** Idempotent for an unpublished product; a draft was never on the storefront. */
  unpublish(now: Date): void {
    if (this.props.status === 'unpublished') return;
    if (this.props.status === 'draft') throw new ProductNotPublishedError();

    this.props = { ...this.props, status: 'unpublished' };
    this.record({ type: 'ProductUnpublished', productId: this.id, occurredAt: now });
  }
}

function validName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) throw new InvalidProductNameError();
  return name;
}

function validDescription(raw: string): string {
  const description = raw.trim();
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new InvalidProductDescriptionError();
  return description;
}

/** Money already guarantees whole cents ≥ 0; a product price must also be above zero. */
function validPrice(price: Money): Money {
  if (price.isZero) throw new InvalidPriceError();
  return price;
}

function validWeight(grams: number): number {
  if (!Number.isInteger(grams) || grams < 1 || grams > MAX_WEIGHT_GRAMS) {
    throw new InvalidWeightError();
  }
  return grams;
}

import { Alias, Flag, Id, Text, Url } from '@mentoria-360/shared';
import { v } from '@/shared/components/form/validator';
import type { ValueObjectClass, VOResult } from '@/shared/components/form/validator/types';
import { getMessage } from '@/shared/i18n';

export const PRODUCT_NAME_MIN_LENGTH = 3;
export const PRODUCT_NAME_MAX_LENGTH = 255;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 5000;
export const PRODUCT_SKU_MAX_LENGTH = 40;
export const PRODUCT_UNIT_MAX_LENGTH = 40;
export const PRODUCT_MAX_IMAGES = 10;
export const PRODUCT_DEFAULT_UNIT = 'unidade';

/** Nome do produto: 3 a 255 caracteres, com os mesmos códigos de erro do `ProductName` do domínio. */
class ProductNameText extends Text {
  protected static readonly TOO_SHORT: string = 'PRODUCT_NAME_TOO_SHORT';
  protected static readonly TOO_LONG: string = 'PRODUCT_NAME_TOO_LONG';
  protected static readonly DEFAULT_MIN_LENGTH: number = PRODUCT_NAME_MIN_LENGTH;
  protected static readonly DEFAULT_MAX_LENGTH: number = PRODUCT_NAME_MAX_LENGTH;
}

/** Descrição do produto: até 5000 caracteres, com o código do `ProductDescription` do domínio. */
class ProductDescriptionText extends Text {
  protected static readonly TOO_LONG: string = 'PRODUCT_DESCRIPTION_TOO_LONG';
  protected static readonly DEFAULT_MAX_LENGTH: number = PRODUCT_DESCRIPTION_MAX_LENGTH;
}

/**
 * Preço digitado em reais: número finito maior que zero e com no máximo duas
 * casas decimais, para virar centavos inteiros no envio (`MoneyCents` na API).
 */
const PriceInReais: ValueObjectClass<number> = {
  tryCreate(value: number): VOResult<number> {
    const isValid =
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value > 0 &&
      Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

    return isValid
      ? { isOk: true, isFailure: false, instance: { value } }
      : { isOk: false, isFailure: true, errors: ['MONEY_CENTS_INVALID'] };
  },
};

/**
 * Validação do formulário de produto com as mesmas regras da API: nome de 3 a
 * 255 caracteres, slug no padrão `Alias`, sku opcional até 40, marca opcional,
 * categoria obrigatória, descrição opcional até 5000, preço e preço "De:" em
 * reais (o "De:" precisa ser maior que o preço), unidade até 40 e até 10
 * imagens com URLs http/https. As imagens não têm `order`: a posição na lista
 * define a ordem no envio.
 */
export const productSchema = v
  .defineObject({
    name: ProductNameText,
    slug: Alias,
    sku: { vo: Text, optional: true, config: { maxLength: PRODUCT_SKU_MAX_LENGTH } },
    brandId: { vo: Id, optional: true },
    categoryId: Id,
    description: { vo: ProductDescriptionText, optional: true },
    price: PriceInReais,
    listPrice: { vo: PriceInReais, optional: true },
    unit: { vo: Text, config: { maxLength: PRODUCT_UNIT_MAX_LENGTH } },
    images: v.defineArray({ thumbUrl: Url, largeUrl: Url }, { max: PRODUCT_MAX_IMAGES }),
    isActive: Flag,
  })
  .refine((data) => data.listPrice === undefined || data.listPrice > data.price, {
    field: 'listPrice',
    message: getMessage('PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE'),
  });

export type ProductFormData = v.infer<typeof productSchema>;

export type ProductImageFormData = ProductFormData['images'][number];

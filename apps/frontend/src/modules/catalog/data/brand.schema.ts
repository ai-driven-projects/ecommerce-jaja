import { Alias, Flag, Name, Text, Url } from '@mentoria-360/shared';
import { v } from '@/shared/components/form/validator';

export const BRAND_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Validação do formulário de marca com as mesmas regras da API: nome de 2 a
 * 100 caracteres, slug no padrão `Alias`, descrição opcional até 500
 * caracteres, URL http/https opcional para o logo e status ativo booleano.
 */
export const brandSchema = v.defineObject({
  name: Name,
  slug: Alias,
  description: { vo: Text, optional: true, config: { maxLength: BRAND_DESCRIPTION_MAX_LENGTH } },
  logoUrl: { vo: Url, optional: true },
  isActive: Flag,
});

export type BrandFormData = v.infer<typeof brandSchema>;

import { Alias, Flag, Id, Name, Order, Text, Url } from '@mentoria-360/shared';
import { v } from '@/shared/components/form/validator';

export const CATEGORY_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Validação do formulário de categoria com as mesmas regras da API: nome de 2
 * a 100 caracteres, slug no padrão `Alias`, descrição opcional até 500
 * caracteres, pai opcional (vazio = raiz), ordem inteira maior ou igual a 0,
 * URL http/https opcional para a imagem e os indicadores de destaque e ativo.
 */
export const categorySchema = v.defineObject({
  parentId: { vo: Id, optional: true },
  name: Name,
  slug: Alias,
  description: { vo: Text, optional: true, config: { maxLength: CATEGORY_DESCRIPTION_MAX_LENGTH } },
  order: Order,
  isHighlighted: Flag,
  imageUrl: { vo: Url, optional: true },
  isActive: Flag,
});

export type CategoryFormData = v.infer<typeof categorySchema>;

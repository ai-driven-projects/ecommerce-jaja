'use client';

import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Button } from '@/shared/components/ui/button';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { ReadonlyTextField } from '@/shared/components/ui/readonly-text-field';
import { formatCpf, formatPhone } from '../data/customer.util';
import { useMyAccountForm, type UseMyAccountFormOptions } from '../data/use-my-account-form.hook';
import { CustomerAddressFields } from './customer-address-fields.component';
import { CustomerAddressMap, type CustomerMapStore } from './customer-address-map.component';

/** Cartão da loja (o mesmo do checkout). */
export const MY_ACCOUNT_CARD_CLASS = 'rounded-3xl border border-line bg-card px-5 py-[22px] sm:px-6';

type MyAccountFormProps = UseMyAccountFormOptions & {
  /** Usuário da sessão: nome e email aparecem somente leitura. */
  user: { name: string; email: string };
  /** Token da sessão, para a geocodificação do mapa. */
  token?: string;
  /** Todas as lojas ativas da vitrine: marcador, círculo do raio e lista do mapa. */
  stores: CustomerMapStore[];
  /** Slug da loja selecionada na vitrine (centro do mapa e destaque); `null` sem loja. */
  storeSlug: string | null;
};

/**
 * Formulário de "Minha conta" no visual da loja (cartões, rótulos e
 * espaçamentos do checkout):
 * - "Dados pessoais": nome e email da sessão somente leitura, CPF e telefone
 *   com máscara, lado a lado em telas largas;
 * - "Endereço de entrega": o mapa do ponto (com todas as lojas ativas e o raio
 *   de atendimento de cada uma) acima dos campos do endereço;
 * - rodapé com "Salvar dados" (desabilitado sem alterações) e "Descartar
 *   alterações" (só com alterações), que volta aos valores carregados e
 *   reinicia o fluxo do mapa.
 * Montar só depois de carregar o cadastro: os valores iniciais são definitivos.
 */
export function MyAccountForm({ user, token, stores, storeSlug, ...options }: MyAccountFormProps) {
  const { form, submit, discard } = useMyAccountForm(options);
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  // Descartar remonta o mapa: sugestão, ponto localizado e âncora do aviso voltam ao início.
  const [mapKey, setMapKey] = useState(0);

  const handleDiscard = () => {
    discard();
    setMapKey((key) => key + 1);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <section className={MY_ACCOUNT_CARD_CLASS} aria-labelledby="account-personal-title">
        <h2 id="account-personal-title" className="mb-4 font-display text-lg font-extrabold">
          Dados pessoais
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor="account-name">Nome</Label>
            <ReadonlyTextField id="account-name" value={user.name} />
          </div>
          <div className="min-w-0">
            <Label htmlFor="account-email">Email</Label>
            <ReadonlyTextField id="account-email" value={user.email} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-ink">Nome e email são da sua conta de acesso.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="account-cpf">CPF</Label>
            <Controller
              control={control}
              name="cpf"
              render={({ field }) => (
                <Input
                  id="account-cpf"
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(formatCpf(event.target.value))}
                  onBlur={field.onBlur}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  className="tabular-nums"
                  aria-invalid={errors.cpf ? true : undefined}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.cpf?.message ? <FormErrorMessage className="mt-1.5">{errors.cpf.message}</FormErrorMessage> : null}
          </div>

          <div>
            <Label htmlFor="account-phone">Telefone</Label>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  id="account-phone"
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(formatPhone(event.target.value))}
                  onBlur={field.onBlur}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(11) 99999-9999"
                  className="tabular-nums"
                  aria-invalid={errors.phone ? true : undefined}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.phone?.message ? (
              <FormErrorMessage className="mt-1.5">{errors.phone.message}</FormErrorMessage>
            ) : null}
          </div>
        </div>
      </section>

      <section className={MY_ACCOUNT_CARD_CLASS} aria-labelledby="account-address-title">
        <h2 id="account-address-title" className="mb-4 font-display text-lg font-extrabold">
          Endereço de entrega
        </h2>

        <CustomerAddressMap
          key={mapKey}
          form={form}
          token={token}
          stores={stores}
          storeSlug={storeSlug}
          disabled={isSubmitting}
        />

        <div className="mt-5 border-t border-line pt-5">
          <CustomerAddressFields form={form} idPrefix="account" disabled={isSubmitting} />
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        {isDirty ? (
          <Button type="button" variant="outline" size="lg" onClick={handleDiscard} disabled={isSubmitting}>
            Descartar alterações
          </Button>
        ) : null}
        <Button type="submit" size="lg" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar dados'}
        </Button>
      </div>
    </form>
  );
}

import { useStdin } from 'ink';
import { useState } from 'react';
import { approve, discardDraft, requestPause, startLoop, stopNow } from '../../loops/control.js';
import { errorMessage } from '../../loops/format.js';
import { loopPaths } from '../../loops/loops.js';
import { openInEditor } from './editor.js';

export interface Message {
  text: string;
  kind: 'ok' | 'warn' | 'error';
}

export type Confirmation = { kind: 'stop' | 'discard'; name: string } | null;

/**
 * As ações sobre um loop, as mesmas na lista e na tela do loop. Parar e
 * descartar passam por confirmação; o resultado vira uma mensagem na tela.
 */
export function useLoopActions(onChange: () => void, onDiscard?: (name: string) => void) {
  const { setRawMode } = useStdin();
  const [messages, setMessages] = useState<Message[]>([]);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [starting, setStarting] = useState<string>();

  const show = (...list: Message[]) => setMessages(list);

  const execute = (key: string, name: string, options: { pauseRequested: boolean }): boolean => {
    switch (key) {
      case 'i':
        if (starting) return true;
        setStarting(name);
        show({ text: `subindo o vigia de ${name}…`, kind: 'warn' });
        startLoop(name)
          .then((result) => {
            const warnings = result.warnings.map((text) => ({ text, kind: 'warn' as const }));
            if (result.problems.length)
              show(...result.problems.map((text) => ({ text, kind: 'error' as const })), ...warnings);
            else
              show(
                {
                  text: `vigia rodando em segundo plano (pid ${result.pid}); fechar o CLI não para o loop`,
                  kind: 'ok',
                },
                ...warnings,
              );
          })
          .catch((error: unknown) => show({ text: errorMessage(error), kind: 'error' }))
          .finally(() => {
            setStarting(undefined);
            onChange();
          });
        return true;
      case 'p':
        requestPause(name, !options.pauseRequested);
        show(
          options.pauseRequested
            ? { text: 'pausa cancelada', kind: 'ok' }
            : { text: 'o loop pausa ao fim do passo atual', kind: 'warn' },
        );
        onChange();
        return true;
      case 'x':
        setConfirmation({ kind: 'stop', name });
        return true;
      case 'D':
        setConfirmation({ kind: 'discard', name });
        return true;
      case 'a': {
        const errors = approve(name);
        show(
          ...(errors.length
            ? errors.map((text) => ({ text, kind: 'error' as const }))
            : [{ text: 'plano aprovado', kind: 'ok' as const }]),
        );
        onChange();
        return true;
      }
      case 'e': {
        const error = openInEditor(loopPaths(name).plan, setRawMode);
        show(
          error
            ? { text: error, kind: 'warn' }
            : { text: 'plano.md salvo; aprove com a quando estiver pronto', kind: 'ok' },
        );
        onChange();
        return true;
      }
    }
    return false;
  };

  const confirm = () => {
    if (!confirmation) return;
    if (confirmation.kind === 'stop') {
      show(
        stopNow(confirmation.name)
          ? {
              text: 'parando: a iteração encerra os processos, salva o estado e o passo é retomado ao continuar',
              kind: 'warn',
            }
          : { text: 'o loop não está em execução', kind: 'warn' },
      );
    } else {
      const error = discardDraft(confirmation.name);
      show(error ? { text: error, kind: 'error' } : { text: `rascunho ${confirmation.name} descartado`, kind: 'ok' });
      if (!error) onDiscard?.(confirmation.name);
    }
    setConfirmation(null);
    onChange();
  };

  return {
    messages,
    clear: () => setMessages([]),
    execute,
    confirmation,
    confirm,
    cancel: () => setConfirmation(null),
    starting,
  };
}

export const confirmationQuestion = (confirmation: NonNullable<Confirmation>) =>
  confirmation.kind === 'stop'
    ? `Parar o loop ${confirmation.name} agora? O passo em andamento é interrompido e retomado ao continuar.`
    : `Descartar o rascunho ${confirmation.name}? A pasta openspec/loops/${confirmation.name} é apagada.`;

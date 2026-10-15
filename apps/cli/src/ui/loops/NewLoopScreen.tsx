import { Box, Text, useInput, usePaste } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { longDuration, money } from '../../loops/format.js';
import { specsForNewLoop, validateLoopName } from '../../loops/loops.js';
import { planLoop } from '../../loops/planner.js';
import type { Activity } from '../../loops/types.js';
import { Busy, COLOR, YesNo } from './common.js';
import { SpecPicker } from './SpecPicker.js';
import { useNow } from './useLoop.js';
import { appendPasted, applyMultilineTyping, applyTyping } from './typing.js';

type Phase = 'name' | 'source' | 'goal' | 'specs' | 'planning' | 'cancel' | 'error';
type Source = 'goal' | 'specs';

interface Props {
  onExit: () => void;
  /** O rascunho foi gravado: abre a tela do loop para revisar e aprovar. */
  onCreated: (name: string) => void;
}

const MAX_ACTIVITIES_ON_SCREEN = 8;

function loadSpecs() {
  try {
    return specsForNewLoop();
  } catch {
    return [];
  }
}

/**
 * Novo loop: nome → origem das etapas → objetivo (o Claude planeja as etapas) ou
 * specs pendentes escolhidas em ordem (cada uma vira uma etapa, sem proposta) →
 * o Claude (só leitura) escreve o plano. O loop nasce como rascunho e é revisado
 * e aprovado na tela dele.
 */
export function NewLoopScreen({ onExit, onCreated }: Props) {
  const [phase, setPhase] = useState<Phase>('name');
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [source, setSource] = useState<Source>('goal');
  const [sourceOption, setSourceOption] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const [specs] = useState(loadSpecs);
  const free = specs.filter((spec) => !spec.inLoop).length;
  const [error, setError] = useState<string>();
  const [startedAt, setStartedAt] = useState(0);
  const [spent, setSpent] = useState(0);
  const [waiting, setWaiting] = useState<string>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const cancellation = useRef<AbortController | null>(null);
  const now = useNow(1000);

  useEffect(() => () => cancellation.current?.abort(), []);

  const plan = (chosen = order, chosenSource = source) => {
    const control = new AbortController();
    cancellation.current = control;
    setPhase('planning');
    setError(undefined);
    setActivities([]);
    setStartedAt(Date.now());
    planLoop({
      name,
      goal,
      specs: chosenSource === 'specs' ? chosen : undefined,
      signal: control.signal,
      onActivity: (activity) => setActivities((list) => [...list, activity].slice(-MAX_ACTIVITIES_ON_SCREEN)),
      onWait: setWaiting,
      onCost: setSpent,
    })
      .then((result) => {
        if (result.ok) return onCreated(name);
        if (result.cancelled) return onExit();
        setError(result.error);
        setPhase('error');
      })
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : String(failure));
        setPhase('error');
      });
  };

  usePaste(
    (text) => {
      setError(undefined);
      if (phase === 'goal') setGoal((g) => appendPasted(g, text));
      else if (phase === 'name') setName((n) => appendPasted(n, text).replace(/\s/g, '-').toLowerCase());
    },
    { isActive: phase === 'goal' || phase === 'name' },
  );

  useInput(
    (input, key) => {
      if (phase === 'name') {
        if (key.escape) return onExit();
        if (key.return) {
          const problem = validateLoopName(name);
          if (problem) return setError(problem);
          setError(undefined);
          // sem specs pendentes livres, não há o que escolher: vai direto ao objetivo
          return setPhase(free ? 'source' : 'goal');
        }
        setError(undefined);
        return setName((n) => applyTyping(n, input, key).toLowerCase().replace(/\s/g, '-'));
      }
      if (phase === 'source') {
        if (key.escape) return setPhase('name');
        if (key.upArrow || key.downArrow) return setSourceOption((o) => 1 - o);
        if (key.return) {
          const chosen: Source = sourceOption === 0 ? 'goal' : 'specs';
          setSource(chosen);
          return setPhase(chosen);
        }
        return;
      }
      if (phase === 'goal') {
        if (key.escape) return setPhase(free ? 'source' : 'name');
        if (key.ctrl && input === 'd') {
          if (goal.trim().length < 10) return setError('descreva o objetivo com um pouco mais de detalhe');
          return plan(order, 'goal');
        }
        setError(undefined);
        return setGoal((g) => applyMultilineTyping(g, input, key));
      }
      if (phase === 'planning' && key.escape) return setPhase('cancel');
      if (phase === 'error') {
        if (key.escape) return onExit();
        if (key.return) return plan();
      }
    },
    { isActive: phase !== 'cancel' && phase !== 'specs' },
  );

  const goalLines = goal.split('\n');
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={COLOR.accent}>
        Novo loop
      </Text>
      <Text color={COLOR.dim}>
        O Claude lê o repositório e propõe as etapas, ou usa specs que você já criou; você revisa e aprova antes de
        iniciar.
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Text>Nome do loop</Text>
        {phase === 'name' ? (
          <Box borderStyle="round" borderColor={COLOR.accent} paddingX={1}>
            <Text>
              {name ? (
                name
              ) : (
                <Text color={COLOR.dim}>ex.: pedidos-cancelamento (kebab-case: vira o prefixo das changes)</Text>
              )}
              <Text inverse> </Text>
            </Text>
          </Box>
        ) : (
          <Text color={COLOR.success}>✔ {name}</Text>
        )}
      </Box>

      {phase === 'source' && (
        <Box marginTop={1} flexDirection="column">
          <Text>De onde vêm as etapas?</Text>
          {[
            { label: 'de um objetivo', detail: 'o Claude divide o objetivo em etapas e propõe cada spec' },
            {
              label: 'de specs já criadas',
              detail: `${free} pendente(s): você escolhe e ordena, e o loop vai direto ao apply`,
            },
          ].map((option, index) => (
            <Text key={option.label}>
              <Text color={COLOR.accent}>{index === sourceOption ? '› ' : '  '}</Text>
              <Text bold={index === sourceOption}>{option.label}</Text>
              <Text color={COLOR.dim}> · {option.detail}</Text>
            </Text>
          ))}
        </Box>
      )}

      {phase === 'specs' && (
        <Box marginTop={1} flexDirection="column">
          <SpecPicker
            specs={specs}
            initialOrder={order}
            onBack={(o) => {
              setOrder(o);
              setPhase('source');
            }}
            onConfirm={(o) => {
              setOrder(o);
              plan(o, 'specs');
            }}
          />
        </Box>
      )}

      {source === 'specs' && phase !== 'name' && phase !== 'source' && phase !== 'specs' && (
        <Box marginTop={1} flexDirection="column">
          <Text>Specs, na ordem</Text>
          <Text color={COLOR.dim} wrap="truncate-end">
            {order.map((spec, index) => `${index + 1}. ${spec}`).join('  →  ')}
          </Text>
        </Box>
      )}

      {source === 'goal' && phase !== 'name' && phase !== 'source' && (
        <Box marginTop={1} flexDirection="column">
          <Text>Objetivo</Text>
          {phase === 'goal' ? (
            <Box borderStyle="round" borderColor={COLOR.dim} paddingX={1} flexDirection="column">
              {goalLines.map((line, index) => (
                <Text key={index}>
                  {line}
                  {index === goalLines.length - 1 && <Text inverse> </Text>}
                </Text>
              ))}
            </Box>
          ) : (
            <Text color={COLOR.dim} wrap="truncate-end">
              {goalLines[0]}
              {goalLines.length > 1 ? ' …' : ''}
            </Text>
          )}
        </Box>
      )}

      {(phase === 'planning' || phase === 'cancel') && (
        <Box marginTop={1} flexDirection="column">
          <Text>
            <Busy />{' '}
            {source === 'specs'
              ? 'o Claude está preparando o plano e as verificações (só leitura)'
              : 'o Claude está planejando (só leitura)'}{' '}
            · ⏱ {longDuration(Math.max(0, now - startedAt))} · {money(spent)}
          </Text>
          {waiting && <Text color={COLOR.warn}>⏳ {waiting}</Text>}
          {activities.map((activity, index) => (
            <Text key={index} color={COLOR.dim} wrap="truncate-end">
              {activity.kind === 'tool' ? '→ ' : '💬 '}
              {activity.text}
            </Text>
          ))}
        </Box>
      )}

      {phase === 'cancel' && (
        <YesNo
          question="Cancelar o planejamento? Nada é gravado."
          onYes={() => cancellation.current?.abort()}
          onNo={() => setPhase('planning')}
        />
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={COLOR.error}>{error}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={COLOR.dim}>
          {phase === 'name' && 'enter continua · esc volta'}
          {phase === 'source' && '↑↓ escolhe · enter continua · esc volta ao nome'}
          {phase === 'goal' && 'enter quebra a linha · ctrl+d planeja · esc volta'}
          {phase === 'planning' && 'esc cancela'}
          {phase === 'error' && 'enter tenta de novo · esc volta'}
        </Text>
      </Box>
    </Box>
  );
}

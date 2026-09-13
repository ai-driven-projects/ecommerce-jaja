import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { useEffect, useMemo, useState } from 'react';
import type { Command, JourneyDetection, JourneyStep } from '../core/command.js';
import { areaLabel, detectAll, JOURNEY_ICON, JOURNEY_LABEL, pendingIds, toggleMany } from '../core/journey.js';
import type { ProjectInfo } from '../core/project.js';
import { createCommandContext } from '../core/runner.js';
import { Cell, Pointer } from './columns.js';
import { ACCENT } from './theme.js';

interface Props {
  command: Command;
  project: ProjectInfo;
  dryRun: boolean;
  /** Ids exatamente como selecionados; a jornada roda só esses, na ordem dela. */
  onRun(selection: string[]): void;
}

const STATUS_COLOR: Record<JourneyDetection['status'], string | undefined> = {
  done: 'green',
  pending: undefined,
  attention: 'yellow',
  unknown: 'gray',
};

/** Largura da coluna com o nome do passo. */
const LABEL_WIDTH = 26;
/** Cursor (2) e bolinha (2): a descrição do passo ativo começa depois deles e do prefixo. */
const LEAD_WIDTH = 4;

/**
 * Lista única dos passos, cada um com o prefixo da área e o estado detectado. Nada abre selecionado:
 * Espaço seleciona o passo sob o cursor e Enter executa exatamente os selecionados, na ordem da jornada.
 */
export function JourneyScreen({ command, project, dryRun, onRun }: Props) {
  const steps = useMemo(() => (command.steps ?? []) as JourneyStep[], [command]);
  /** Resultado da última detecção, marcado com a rodada (`refreshKey`) a que pertence. */
  const [detected, setDetected] = useState<{ round: number; map: Map<string, JourneyDetection> } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [cursor, setCursor] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // Enquanto a rodada atual não termina, a lista mostra "verificando..." sem precisar limpar estado no efeito.
  const detections = detected?.round === refreshKey ? detected.map : null;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const ctx = createCommandContext({
      project,
      yes: true,
      dryRun,
      reporter: { log: () => undefined },
      prompter: { confirm: async (_q, d) => d, ask: async (_q, d) => d, pick: async (_q, _o, c) => c.defaults ?? [] },
      signal: controller.signal,
    });
    detectAll(ctx, steps).then((result) => {
      if (active) setDetected({ round: refreshKey, map: result });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [steps, project, dryRun, refreshKey]);

  const prefixWidth = Math.max(0, ...steps.map((step) => areaLabel(step, command.areas).length)) + 2;
  const selectedSteps = steps.filter((step) => selected.has(step.id));
  const doneCount = detections ? steps.filter((step) => detections.get(step.id)?.status === 'done').length : null;

  useInput((input, key) => {
    setNotice(null);
    if (key.upArrow) setCursor((current) => Math.max(0, current - 1));
    if (key.downArrow) setCursor((current) => Math.min(steps.length - 1, current + 1));
    const letter = input.toLowerCase();
    if (letter === 'r') setRefreshKey((current) => current + 1);
    if (letter === 'a') setSelected((current) => toggleMany(current, steps.map((step) => step.id)));
    if (letter === 'p') {
      if (detections) setSelected(new Set(pendingIds(steps, detections)));
      else setNotice('Aguarde a verificação do estado para selecionar os pendentes.');
    }
    const step = steps[cursor];
    if (input === ' ' && step) setSelected((current) => toggleMany(current, [step.id]));
    if (!key.return) return;
    if (selectedSteps.length > 0) onRun(selectedSteps.map((item) => item.id));
    else setNotice('Nada selecionado. Espaço seleciona o passo sob o cursor.');
  });

  return (
    <Box flexDirection="column" marginTop={1} paddingX={1}>
      <Text>
        <Text bold color={ACCENT}>
          {command.title}
        </Text>
        <Text dimColor>
          {' '}
          · {doneCount === null ? 'verificando o estado...' : `${doneCount}/${steps.length} feitos`} · {selectedSteps.length} selecionado(s)
        </Text>
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {steps.map((step, index) => {
          const active = index === cursor;
          const checked = selected.has(step.id);
          const detection = detections?.get(step.id);
          return (
            <Box key={step.id} flexDirection="column">
              <Box>
                <Pointer active={active} />
                <Cell width={2}>
                  <Text color={checked ? 'green' : 'gray'}>{checked ? '●' : '○'}</Text>
                </Cell>
                <Cell width={prefixWidth}>
                  <Text color={active ? ACCENT : 'gray'} wrap="truncate">
                    {areaLabel(step, command.areas)}
                  </Text>
                </Cell>
                <Cell width={LABEL_WIDTH} paddingRight={1}>
                  <Text bold={active || checked} color={active ? ACCENT : checked ? 'green' : undefined} wrap="truncate">
                    {step.label}
                  </Text>
                </Cell>
                <Cell width={2}>
                  <Text color={detection ? STATUS_COLOR[detection.status] : undefined}>{detection ? JOURNEY_ICON[detection.status] : <Spinner type="dots" />}</Text>
                </Cell>
                <Text dimColor wrap="truncate">
                  {detection ? `${JOURNEY_LABEL[detection.status]}${detection.detail ? ` · ${detection.detail}` : ''}` : 'verificando...'}
                </Text>
              </Box>
              {active && step.description ? (
                <Box paddingLeft={LEAD_WIDTH + prefixWidth}>
                  <Text dimColor>{step.description}</Text>
                </Box>
              ) : null}
              {active && step.danger ? (
                <Box paddingLeft={LEAD_WIDTH + prefixWidth}>
                  <Text color="yellow">▲ {step.danger}</Text>
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        {selectedSteps.length === 0 ? (
          <Text dimColor>Nada selecionado.</Text>
        ) : (
          <Text>
            <Text color="green">Enter executa: </Text>
            {selectedSteps.map((item) => `${areaLabel(item, command.areas)} · ${item.label}`).join(' → ')}
          </Text>
        )}
      </Box>
      {notice ? <Text color="yellow">{notice}</Text> : null}
      <Text dimColor>Espaço seleciona · Enter executa · A tudo/nada · P pendentes · R verifica de novo · Esc volta</Text>
    </Box>
  );
}

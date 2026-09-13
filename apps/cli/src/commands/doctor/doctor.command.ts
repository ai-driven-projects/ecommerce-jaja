import type { Command, CommandContext } from '../../core/command.js';
import { createDoctorChecks, type Check, type CheckResult } from './checks.js';

async function runCheck(check: Check, ctx: CommandContext): Promise<CheckResult> {
  try {
    return await check.run(ctx);
  } catch (error) {
    return { status: 'error', detail: 'falhou', hint: error instanceof Error ? error.message : String(error) };
  }
}

export const doctorCommand: Command = {
  id: 'doctor',
  title: 'Doctor',
  description: 'Verifica Node, npm, git, Docker, dependências, submódulos, .env, banco e Prisma Client',
  group: 'Ambiente local',
  icon: '🔎',
  keywords: ['diagnostico', 'ambiente', 'saude', 'check', 'verificar'],
  async run(ctx) {
    ctx.report.info(`Projeto: ${ctx.project.name} (${ctx.project.rootDir})`);
    const counts = { ok: 0, warn: 0, error: 0 };

    for (const check of createDoctorChecks(ctx)) {
      if (ctx.signal.aborted) break;
      const result = await runCheck(check, ctx);
      counts[result.status] += 1;
      const line = `${check.label}: ${result.detail}`;
      if (result.status === 'ok') ctx.report.success(line);
      else if (result.status === 'warn') ctx.report.warn(line);
      else ctx.report.error(line);
      if (result.hint && result.status !== 'ok') ctx.report.detail(result.hint);
    }

    const summary = `${counts.ok} ok, ${counts.warn} aviso(s), ${counts.error} erro(s)`;
    if (counts.error > 0) return { status: 'error', summary: `Ambiente com problemas: ${summary}` };
    if (counts.warn > 0) return { status: 'warn', summary: `Ambiente utilizável com ressalvas: ${summary}` };
    return { status: 'ok', summary: `Ambiente pronto: ${summary}` };
  },
};

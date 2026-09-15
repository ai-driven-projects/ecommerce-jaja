import type { Command } from '../core/command.js';
import { brokerMenu } from './broker/broker.commands.js';
import { cleanWizard } from './clean/clean.wizard.js';
import { dbMenu } from './db/db.commands.js';
import { deployJourney } from './deploy/deploy.journey.js';
import { doctorCommand } from './doctor/doctor.command.js';
import { monitorCommand } from './monitor/monitor.command.js';
import { qualityWizard } from './quality/quality.wizard.js';
import { scrapeMenu } from './scrape/scrape.commands.js';
import { setupWizard } from './setup/setup.wizard.js';

/**
 * Menu inicial: poucas entradas, cada uma um wizard (checklist), um menu de ações, uma jornada (passos com estado)
 * ou uma ação direta. A paleta, o modo headless e o --help leem daqui; ids aninhados continuam acessíveis (ex.: `jaja db:start`).
 */
export function createCommands(): Command[] {
  return [doctorCommand, setupWizard, dbMenu, brokerMenu, scrapeMenu, qualityWizard, cleanWizard, deployJourney, monitorCommand];
}

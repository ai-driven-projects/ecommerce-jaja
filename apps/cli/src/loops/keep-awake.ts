import { spawn, spawnSync } from 'node:child_process';

let active = false;

/**
 * Impede o macOS de entrar em repouso enquanto este processo viver:
 * `caffeinate -w <pid>` termina sozinho quando o processo termina, inclusive
 * num crash, então não sobra nada segurando o Mac acordado.
 *
 *   -i  sem repouso por inatividade
 *   -m  sem repouso do disco
 *   -s  sem repouso do sistema (vale com o carregador conectado)
 *
 * A tela pode apagar normalmente. Fechar a tampa ainda põe o Mac em repouso,
 * exceto com carregador e monitor externo.
 */
export function keepAwake(): boolean {
  if (active) return true;
  if (process.platform !== 'darwin') return false;
  if (spawnSync('which', ['caffeinate']).status !== 0) return false;
  const child = spawn('caffeinate', ['-ims', '-w', String(process.pid)], { stdio: 'ignore' });
  child.on('error', () => (active = false));
  child.unref();
  active = true;
  return true;
}

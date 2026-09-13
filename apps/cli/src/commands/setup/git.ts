/** Funções puras sobre .gitmodules e saída de ssh/git, testáveis sem processo. */

export function parseGitmodulesGithubUrls(raw: string): string[] {
  const urls: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*url\s*=\s*(https:\/\/github\.com\/\S+)/i);
    if (match?.[1]) urls.push(match[1]);
  }
  return urls;
}

/** `ssh -T git@github.com` sai com código 1 e uma saudação quando a chave é aceita. */
export function isGithubSshGreeting(code: number | null, output: string): boolean {
  return code === 1 && /successfully authenticated|Hi .+!/i.test(output);
}

export const GITHUB_HTTPS_PREFIX = 'https://github.com/';
export const GITHUB_SSH_PREFIX = 'git@github.com:';
export const GITHUB_SSH_INSTEAD_OF_KEY = `url.${GITHUB_SSH_PREFIX}.insteadOf`;

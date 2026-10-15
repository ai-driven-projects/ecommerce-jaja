import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { forgetUserShellPath, joinPaths, pathForLoop } from '../../src/loops/shell-path.js';

test('juntar PATHs sem repetir pastas, na ordem', () => {
  assert.equal(joinPaths('/a:/b', undefined, '/b:/c:'), '/a:/b:/c');
});

test('comando fora do PATH do CLI é achado no PATH do shell do usuário', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-env-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'docker-falso'), '#!/bin/sh\n', { mode: 0o755 });
  // um "shell" que, como um .zshrc com tema de prompt, escreve lixo antes do PATH
  const shell = path.join(dir, 'shell');
  fs.writeFileSync(shell, `#!/bin/sh\necho "🚀 prompt"\nprintf "\\n__PATH__${bin}:/usr/bin__FIM__\\n"\n`, {
    mode: 0o755,
  });
  const previous = process.env.SHELL;
  process.env.SHELL = shell;
  forgetUserShellPath();
  try {
    assert.deepEqual(pathForLoop(['sh'], '/bin:/usr/bin'), { path: '/bin:/usr/bin', missing: [] });
    const result = pathForLoop(['sh', 'docker-falso', 'nao-existe-xyz'], '/bin');
    assert.equal(result.path, `/bin:${bin}:/usr/bin`);
    assert.deepEqual(result.missing, ['nao-existe-xyz']);
  } finally {
    process.env.SHELL = previous;
    forgetUserShellPath();
  }
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseEnv } from '../doctor/env.js';
import { appendMissingKeys, isGeneratableSecret, setEnvValue } from './env-repair.js';

describe('appendMissingKeys', () => {
  const template = ['PORT="4000"', '', '# Consumidores de eventos.', '# "false" desliga.', 'EVENT_CONSUMERS_ENABLED="true"', 'OUTRA="1"', ''].join('\n');

  it('acrescenta a chave com os comentários logo acima dela e o valor do template', () => {
    const result = appendMissingKeys('PORT="4000"\n', template, ['EVENT_CONSUMERS_ENABLED']);
    assert.equal(result, 'PORT="4000"\n\n# Consumidores de eventos.\n# "false" desliga.\nEVENT_CONSUMERS_ENABLED="true"\n');
  });

  it('não leva comentários de outra chave e mantém o arquivo intacto sem faltantes', () => {
    const result = appendMissingKeys('PORT="4000"', template, ['OUTRA']);
    assert.deepEqual(parseEnv(result), { PORT: '4000', OUTRA: '1' });
    assert.equal(result.includes('Consumidores'), false);
    assert.equal(appendMissingKeys('A=1\n', template, []), 'A=1\n');
  });
});

describe('setEnvValue', () => {
  it('troca só a linha da chave', () => {
    assert.equal(setEnvValue('# x\nJWT_SECRET="YOUR_SECRET_HERE"\nPORT=1', 'JWT_SECRET', 'abc'), '# x\nJWT_SECRET="abc"\nPORT=1');
    assert.equal(setEnvValue('PORT=1', 'NADA', 'abc'), 'PORT=1');
  });
});

describe('isGeneratableSecret', () => {
  it('reconhece chaves de segredo, não chaves de API externas', () => {
    for (const key of ['JWT_SECRET', 'SESSION_TOKEN', 'DB_PASSWORD']) assert.equal(isGeneratableSecret(key), true, key);
    for (const key of ['GOOGLE_MAPS_API_KEY', 'PORT']) assert.equal(isGeneratableSecret(key), false, key);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { brokerUrls, parseComposeServiceState, readBrokerPorts } from './lib.js';

describe('readBrokerPorts', () => {
  it('usa 5672/15672 quando o .env não tem as chaves', () => {
    assert.deepEqual(readBrokerPorts({}), { amqp: 5672, management: 15672 });
  });

  it('lê as portas do .env', () => {
    assert.deepEqual(readBrokerPorts({ RABBITMQ_PORT: '5673', RABBITMQ_MANAGEMENT_PORT: '15673' }), { amqp: 5673, management: 15673 });
  });

  it('porta inválida volta ao padrão', () => {
    assert.deepEqual(readBrokerPorts({ RABBITMQ_PORT: 'abc', RABBITMQ_MANAGEMENT_PORT: '70000' }), { amqp: 5672, management: 15672 });
    assert.deepEqual(readBrokerPorts({ RABBITMQ_PORT: '', RABBITMQ_MANAGEMENT_PORT: '0' }), { amqp: 5672, management: 15672 });
    assert.deepEqual(readBrokerPorts({ RABBITMQ_PORT: '56.72', RABBITMQ_MANAGEMENT_PORT: '-1' }), { amqp: 5672, management: 15672 });
  });
});

describe('brokerUrls', () => {
  it('monta as URLs só com host e porta, sem usuário nem senha', () => {
    const urls = brokerUrls(readBrokerPorts({ RABBITMQ_PORT: '5672', RABBITMQ_URL: 'amqp://jaja:s3nh4@localhost:5672' }));
    assert.deepEqual(urls, { amqp: 'amqp://localhost:5672', management: 'http://localhost:15672' });
    for (const url of Object.values(urls)) {
      assert.equal(url.includes('@'), false);
      assert.equal(url.includes('s3nh4'), false);
      assert.equal(url.includes('jaja'), false);
    }
  });
});

describe('parseComposeServiceState', () => {
  it('reconhece o serviço rodando e saudável (um objeto JSON por linha)', () => {
    const stdout = `${JSON.stringify({ Name: 'jaja-rabbitmq', Service: 'rabbitmq', State: 'running', Health: 'healthy', Status: 'Up 2 minutes (healthy)' })}\n`;
    assert.deepEqual(parseComposeServiceState(stdout), { state: 'running', health: 'healthy', status: 'Up 2 minutes (healthy)', running: true, healthy: true });
  });

  it('aceita o formato antigo em array e o healthcheck ainda iniciando', () => {
    const stdout = JSON.stringify([{ Name: 'jaja-rabbitmq', State: 'running', Health: 'starting', Status: 'Up 3 seconds (health: starting)' }]);
    const state = parseComposeServiceState(stdout);
    assert.equal(state?.running, true);
    assert.equal(state?.healthy, false);
    assert.equal(state?.health, 'starting');
  });

  it('reconhece o serviço parado', () => {
    const stdout = JSON.stringify({ Name: 'jaja-rabbitmq', State: 'exited', Health: '', Status: 'Exited (0) 5 seconds ago' });
    assert.deepEqual(parseComposeServiceState(stdout), { state: 'exited', health: null, status: 'Exited (0) 5 seconds ago', running: false, healthy: false });
  });

  it('saída vazia ou inválida → null', () => {
    assert.equal(parseComposeServiceState(''), null);
    assert.equal(parseComposeServiceState('  \n'), null);
    assert.equal(parseComposeServiceState('[]'), null);
    assert.equal(parseComposeServiceState('no such service'), null);
  });
});

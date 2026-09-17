import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { basicAuthHeader, brokerUrls, managementQueueContentsUrl, managementQueuesUrl, parseComposeServiceState, readBrokerCredentials, readBrokerPorts, summarizeQueues } from './lib.js';

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

describe('readBrokerCredentials', () => {
  it('tira usuário e senha da RABBITMQ_URL', () => {
    assert.deepEqual(readBrokerCredentials({ RABBITMQ_URL: 'amqp://loja:s3nh4@localhost:5672' }), { username: 'loja', password: 's3nh4' });
  });

  it('usa jaja/jaja sem a chave, com URL inválida ou sem usuário', () => {
    const fallback = { username: 'jaja', password: 'jaja' };
    assert.deepEqual(readBrokerCredentials({}), fallback);
    assert.deepEqual(readBrokerCredentials({ RABBITMQ_URL: '' }), fallback);
    assert.deepEqual(readBrokerCredentials({ RABBITMQ_URL: 'não é uma url' }), fallback);
    assert.deepEqual(readBrokerCredentials({ RABBITMQ_URL: 'amqp://localhost:5672' }), fallback);
  });

  it('decodifica caracteres codificados na senha', () => {
    assert.deepEqual(readBrokerCredentials({ RABBITMQ_URL: 'amqp://jaja:p%40ss%3Aw%2Frd@localhost:5672' }), { username: 'jaja', password: 'p@ss:w/rd' });
  });
});

describe('managementQueuesUrl e basicAuthHeader', () => {
  it('monta a URL da API sem credenciais e manda a credencial só no cabeçalho', () => {
    const url = managementQueuesUrl(readBrokerPorts({ RABBITMQ_MANAGEMENT_PORT: '15673', RABBITMQ_URL: 'amqp://jaja:s3nh4@localhost:5672' }));
    assert.equal(url, 'http://localhost:15673/api/queues/%2F');
    assert.equal(url.includes('s3nh4'), false);
    assert.equal(basicAuthHeader({ username: 'jaja', password: 'jaja' }), `Basic ${Buffer.from('jaja:jaja').toString('base64')}`);
  });

  it('monta a URL das mensagens de uma fila com o nome codificado', () => {
    const ports = readBrokerPorts({});
    assert.equal(managementQueueContentsUrl(ports, 'jaja.payment.approve-order.wait'), 'http://localhost:15672/api/queues/%2F/jaja.payment.approve-order.wait/contents');
    assert.equal(managementQueueContentsUrl(ports, 'fila com/barra'), 'http://localhost:15672/api/queues/%2F/fila%20com%2Fbarra/contents');
  });
});

describe('summarizeQueues', () => {
  it('agrupa a fila do consumidor, a .wait e a .dead numa linha e mantém a fila de inspeção à parte', () => {
    const summary = summarizeQueues([
      { name: 'jaja.orders.approve-payment', messages_ready: 3, messages_unacknowledged: 1, consumers: 2 },
      { name: 'jaja.orders.approve-payment.wait', messages_ready: 4, messages_unacknowledged: 0, consumers: 0 },
      { name: 'jaja.orders.approve-payment.dead', messages_ready: 2, messages_unacknowledged: 0, consumers: 0 },
      { name: 'jaja.events.all', messages_ready: 7, messages_unacknowledged: 0, consumers: 0 },
      { name: 'outro-projeto.fila', messages_ready: 9, consumers: 1 },
    ]);
    assert.deepEqual(summary.rows, [{ consumer: 'orders.approve-payment', ready: 3, unacked: 1, waiting: 4, dead: 2, consumers: 2 }]);
    assert.deepEqual(summary.inspection, { name: 'jaja.events.all', ready: 7, unacked: 0, consumers: 0 });
    assert.deepEqual(summary.deadLetters, [{ queue: 'jaja.orders.approve-payment.dead', messages: 2 }]);
  });

  it('lista só as filas .dead com mensagens, em ordem alfabética dos consumidores', () => {
    const summary = summarizeQueues([
      { name: 'jaja.orders.ship', messages_ready: 0, consumers: 1 },
      { name: 'jaja.orders.ship.dead', messages_ready: 0 },
      { name: 'jaja.orders.approve-payment', consumers: 1 },
      { name: 'jaja.orders.approve-payment.dead', messages_ready: 1 },
    ]);
    assert.deepEqual(
      summary.rows.map((row) => row.consumer),
      ['orders.approve-payment', 'orders.ship'],
    );
    assert.deepEqual(summary.deadLetters, [{ queue: 'jaja.orders.approve-payment.dead', messages: 1 }]);
    assert.equal(summary.inspection, null);
  });

  it('fila .wait ou .dead sem a principal ainda aparece no consumidor', () => {
    const summary = summarizeQueues([
      { name: 'jaja.cli-test.check.dead', messages_ready: 1 },
      { name: 'jaja.orders.pick.wait', messages_ready: 2 },
    ]);
    assert.deepEqual(summary.rows, [
      { consumer: 'cli-test.check', ready: 0, unacked: 0, waiting: 0, dead: 1, consumers: 0 },
      { consumer: 'orders.pick', ready: 0, unacked: 0, waiting: 2, dead: 0, consumers: 0 },
    ]);
    assert.deepEqual(summary.deadLetters, [{ queue: 'jaja.cli-test.check.dead', messages: 1 }]);
  });

  it('contadores ausentes (fila recém-criada) contam como zero', () => {
    const summary = summarizeQueues([{ name: 'jaja.orders.pick' }]);
    assert.deepEqual(summary.rows, [{ consumer: 'orders.pick', ready: 0, unacked: 0, waiting: 0, dead: 0, consumers: 0 }]);
  });

  it('lista vazia não gera linhas', () => {
    assert.deepEqual(summarizeQueues([]), { rows: [], inspection: null, deadLetters: [] });
  });
});

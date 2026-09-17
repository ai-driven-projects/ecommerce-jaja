// Helpers that keep the broker URL (with user and password) out of the logs and
// errors. Shared by the publisher and the consumer adapters.

// `host:port` of the broker, the only identification of a connection that goes
// to the logs.
export function brokerAddress(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === 'amqps:' ? '5671' : '5672');
    return `${parsed.hostname}:${port}`;
  } catch {
    return 'an invalid RABBITMQ_URL';
  }
}

// Removes the URL and its credentials from third-party messages before they
// reach a log or an error.
export function redactCredentials(text: string, url: string): string {
  const secrets = new Set<string>([url]);
  try {
    const { username, password } = new URL(url);
    for (const value of [password, username]) {
      if (value) {
        secrets.add(value);
        secrets.add(safeDecode(value));
      }
    }
  } catch {
    // Unparseable URL: the whole URL and any `scheme://user:password@` are still removed.
  }

  let safe = text.replace(/([a-z][a-z\d+.-]*:\/\/)[^\s/@]*@/gi, '$1***@');
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    safe = safe.split(secret).join('***');
  }
  return safe;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

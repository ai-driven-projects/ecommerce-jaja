import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './shared/errors/api-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Runs the destroy hooks on SIGINT/SIGTERM: the outbox relay waits for its
  // cycle and the broker connection is closed.
  app.enableShutdownHooks();
  app.enableCors();
  const port = Number(process.env.PORT ?? 4000);
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(port);
}
await bootstrap();

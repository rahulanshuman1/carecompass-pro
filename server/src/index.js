import mongoose from 'mongoose';
import { config } from './config.js';
import { createApp } from './app.js';

mongoose.set('strictQuery', true);

async function main() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`API listening on :${config.port} (${config.env})`));

  const shutdown = (sig) => {
    console.log(`${sig} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
main().catch((e) => {
  console.error('Fatal startup error', e);
  process.exit(1);
});

import pino from 'pino';
import pinoElasticsearch from 'pino-elasticsearch';

const isDevelopment = process.env.NODE_ENV !== 'production';

const streams = [
  {
    level: process.env.LOG_LEVEL || 'info',
    stream: isDevelopment
      ? pino.transport({
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        })
      : process.stdout,
  },
];

if (process.env.ELASTICSEARCH_NODE) {
  try {
    const esStream = pinoElasticsearch({
      node: process.env.ELASTICSEARCH_NODE,
      index: 'user-service-logs',
      'flush-bytes': 1000,
      'flush-interval': 30000,
      consistency: 'one',
      'es-version': 8,
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      },
    });
    streams.push({ level: 'info', stream: esStream });
  } catch (error) {
    console.error('Failed to initialize Elasticsearch transport:', error);
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'user-service',
    environment: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
}, pino.multistream(streams));

export function createChildLogger(bindings) {
  return logger.child(bindings);
}
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { assertApprovedTestMongoUri, parseEnv, validateMongoUri } from '../src/config/env.js';

const productionSecrets = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  PROXY_SECRET: 'c'.repeat(32),
};

describe('environment MongoDB URI validation', () => {
  it('rejects missing, empty, malformed, unsupported, and database-less production URIs', () => {
    for (const uri of [undefined, '', ' mongodb://localhost/campusflow ', 'not a URI', 'https://localhost/campusflow', 'mongodb://localhost']) {
      assert.throws(() => validateMongoUri(uri));
    }
    assert.throws(() => validateMongoUri('mongodb://localhost/campusflow/extra'));
  });

  it('accepts supported MongoDB URI protocols with one database name', () => {
    assert.strictEqual(
      validateMongoUri('mongodb://127.0.0.1:27017/campusflow'),
      'mongodb://127.0.0.1:27017/campusflow'
    );
    assert.strictEqual(
      validateMongoUri('mongodb+srv://cluster.example.com/campusflow'),
      'mongodb+srv://cluster.example.com/campusflow'
    );
  });

  it('requires a MongoDB URI only in production and retains development/test defaults', () => {
    assert.throws(() => parseEnv({ NODE_ENV: 'production', ...productionSecrets }));
    assert.strictEqual(
      parseEnv({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost/campusflow', ...productionSecrets })
        .MONGODB_URI,
      'mongodb://localhost/campusflow'
    );
    assert.strictEqual(parseEnv({ NODE_ENV: 'development' }).MONGODB_URI, 'mongodb://localhost:27017/campusflow');
    assert.strictEqual(parseEnv({ NODE_ENV: 'test' }).MONGODB_URI, 'mongodb://localhost:27017/campusflow');
  });

  it('permits only the explicitly approved isolated integration-test target', () => {
    assert.strictEqual(
      assertApprovedTestMongoUri(
        'mongodb://127.0.0.1:27018/campusflow_test?replicaSet=rs0&directConnection=true'
      ),
      'mongodb://127.0.0.1:27018/campusflow_test?replicaSet=rs0&directConnection=true'
    );
    assert.throws(() =>
      assertApprovedTestMongoUri(
        'mongodb://127.0.0.1:27017/campusflow_test?replicaSet=rs0&directConnection=true'
      )
    );
  });
});

describe('production environment secrets validation', () => {
  const validMongo = 'mongodb://localhost/campusflow';

  it('rejects missing or undersized JWT_ACCESS_SECRET in production', () => {
    assert.throws(
      () => parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: validMongo,
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        PROXY_SECRET: 'c'.repeat(32),
      }),
      /Missing required environment variable: JWT_ACCESS_SECRET/
    );

    assert.throws(
      () => parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: validMongo,
        JWT_ACCESS_SECRET: 'short-secret',
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        PROXY_SECRET: 'c'.repeat(32),
      }),
      /JWT_ACCESS_SECRET must be at least 32 characters long/
    );
  });

  it('rejects missing or undersized JWT_REFRESH_SECRET in production', () => {
    assert.throws(
      () => parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: validMongo,
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        PROXY_SECRET: 'c'.repeat(32),
      }),
      /Missing required environment variable: JWT_REFRESH_SECRET/
    );

    assert.throws(
      () => parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: validMongo,
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'too-short',
        PROXY_SECRET: 'c'.repeat(32),
      }),
      /JWT_REFRESH_SECRET must be at least 32 characters long/
    );
  });

  it('rejects missing or undersized PROXY_SECRET in production', () => {
    assert.throws(
      () => parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: validMongo,
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      }),
      /Missing required environment variable: PROXY_SECRET/
    );

    assert.throws(
      () => parseEnv({
        NODE_ENV: 'production',
        MONGODB_URI: validMongo,
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        PROXY_SECRET: 'not-enough-characters',
      }),
      /PROXY_SECRET must be at least 32 characters long/
    );
  });

  it('permits development mode without explicit production secrets', () => {
    const devEnv = parseEnv({ NODE_ENV: 'development' });
    assert.ok(devEnv.JWT_ACCESS_SECRET.length >= 32);
    assert.ok(devEnv.JWT_REFRESH_SECRET.length >= 32);
    assert.strictEqual(devEnv.PROXY_SECRET, '');
  });

  it('leaves REDIS_URL unconfigured in production when omitted, avoiding unwanted localhost connects', () => {
    const prodEnvWithoutRedis = parseEnv({
      NODE_ENV: 'production',
      MONGODB_URI: validMongo,
      ...productionSecrets,
    });
    assert.strictEqual(prodEnvWithoutRedis.REDIS_URL, '');

    const prodEnvWithRedis = parseEnv({
      NODE_ENV: 'production',
      MONGODB_URI: validMongo,
      REDIS_URL: 'rediss://custom-redis.internal:6380',
      ...productionSecrets,
    });
    assert.strictEqual(prodEnvWithRedis.REDIS_URL, 'rediss://custom-redis.internal:6380');

    const devEnv = parseEnv({ NODE_ENV: 'development' });
    assert.strictEqual(devEnv.REDIS_URL, 'redis://localhost:6379');
  });
});

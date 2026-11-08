import { S3Client } from '@aws-sdk/client-s3';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

export type TestFloci = {
  s3: S3Client;
  stop: () => Promise<void>;
};

/** A throwaway Floci (same image as compose) with an S3 client pointed at it. */
export async function startFloci(): Promise<TestFloci> {
  const container: StartedTestContainer = await new GenericContainer('floci/floci:2.3.0')
    .withExposedPorts(4566)
    .withWaitStrategy(Wait.forHttp('/_localstack/health', 4566))
    .start();

  const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: `http://${container.getHost()}:${container.getMappedPort(4566)}`,
    // Emulators serve buckets as paths; virtual-hosted style would need DNS for <bucket>.localhost.
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });

  return {
    s3,
    stop: async () => {
      s3.destroy();
      await container.stop();
    },
  };
}

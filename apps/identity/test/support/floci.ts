import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

export type TestFloci = {
  sns: SNSClient;
  sqs: SQSClient;
  stop: () => Promise<void>;
};

/** A throwaway Floci (same image as compose) with SDK clients pointed at it. */
export async function startFloci(): Promise<TestFloci> {
  const container: StartedTestContainer = await new GenericContainer('floci/floci:2.3.0')
    .withExposedPorts(4566)
    .withWaitStrategy(Wait.forHttp('/_localstack/health', 4566))
    .start();

  const options = {
    region: 'us-east-1',
    endpoint: `http://${container.getHost()}:${container.getMappedPort(4566)}`,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  };
  const sns = new SNSClient(options);
  const sqs = new SQSClient(options);

  return {
    sns,
    sqs,
    stop: async () => {
      sns.destroy();
      sqs.destroy();
      await container.stop();
    },
  };
}

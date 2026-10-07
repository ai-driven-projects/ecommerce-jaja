// Defaults of each environment size (`ENV_SIZE`). Every value can be
// overridden by its own variable in the .env. Sources and reasons: decision 15
// of openspec/changes/aws-ephemeral-environment/design.md.

export const ENV_SIZES = ['demo', 'load'] as const;
export type EnvSize = (typeof ENV_SIZES)[number];

export const MQ_DEPLOYMENT_MODES = ['SINGLE_INSTANCE', 'CLUSTER_MULTI_AZ'] as const;
export type MqDeploymentMode = (typeof MQ_DEPLOYMENT_MODES)[number];

export const QUEUE_TYPES = ['classic', 'quorum'] as const;
export type QueueType = (typeof QUEUE_TYPES)[number];

export interface SizeProfile {
  readonly maxAzs: number;
  readonly backendDesiredCount: number;
  readonly backendMaxCount: number;
  readonly backendCpu: number;
  readonly backendMemory: number;
  readonly dbInstanceClass: string;
  readonly dbMultiAz: boolean;
  readonly mqInstanceType: string;
  readonly mqDeploymentMode: MqDeploymentMode;
  readonly mqEngineVersion: string;
  readonly queueType: QueueType;
}

export const SIZE_PROFILES: Record<EnvSize, SizeProfile> = {
  demo: {
    maxAzs: 2,
    backendDesiredCount: 1,
    backendMaxCount: 1,
    backendCpu: 512,
    backendMemory: 1024,
    dbInstanceClass: 't4g.micro',
    dbMultiAz: false,
    // RabbitMQ 4 runs only on mq.m7g; mq.t3.micro no longer takes new brokers.
    mqInstanceType: 'mq.m7g.medium',
    mqDeploymentMode: 'SINGLE_INSTANCE',
    mqEngineVersion: '4.2',
    queueType: 'classic',
  },
  load: {
    // The broker cluster spreads its nodes over the zones.
    maxAzs: 3,
    backendDesiredCount: 2,
    backendMaxCount: 6,
    backendCpu: 1024,
    backendMemory: 2048,
    dbInstanceClass: 'm7g.large',
    dbMultiAz: true,
    mqInstanceType: 'mq.m7g.large',
    mqDeploymentMode: 'CLUSTER_MULTI_AZ',
    mqEngineVersion: '4.2',
    // Replicated on the 3 nodes of the cluster.
    queueType: 'quorum',
  },
};

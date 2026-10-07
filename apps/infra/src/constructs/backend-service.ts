import { Duration } from 'aws-cdk-lib';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import type { ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
import {
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  LogDrivers,
  OperatingSystemFamily,
  Secret as EcsSecret,
} from 'aws-cdk-lib/aws-ecs';
import type { ContainerImage, ICluster } from 'aws-cdk-lib/aws-ecs';
import type { ApplicationTargetGroup } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import type { ILogGroup } from 'aws-cdk-lib/aws-logs';
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { BACKEND_PORT } from './edge';

export const BACKEND_CONTAINER = 'backend';

export interface BackendServiceProps {
  readonly cluster: ICluster;
  readonly securityGroup: ISecurityGroup;
  readonly image: ContainerImage;
  readonly logGroup: ILogGroup;
  readonly targetGroup: ApplicationTargetGroup;
  readonly desiredCount: number;
  readonly maxCount: number;
  readonly cpu: number;
  readonly memory: number;
  /** Plain variables (no secret). */
  readonly environment: Record<string, string>;
  /** Variables taken from Secrets Manager by ECS when the task starts. */
  readonly secrets: Record<string, EcsSecret>;
}

/**
 * The API on Fargate (ARM64) behind the load balancer. The credentials reach
 * the container as ECS secrets; the image entrypoint builds `DATABASE_URL` and
 * `RABBITMQ_URL` from them. A deployment whose tasks never get healthy is
 * rolled back by the circuit breaker. Auto scaling by CPU only when the maximum
 * is above the initial count.
 */
export class BackendService extends Construct {
  readonly service: FargateService;
  readonly taskDefinition: FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: BackendServiceProps) {
    super(scope, id);

    this.taskDefinition = new FargateTaskDefinition(this, 'TaskDefinition', {
      cpu: props.cpu,
      memoryLimitMiB: props.memory,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
    });

    this.taskDefinition.addContainer(BACKEND_CONTAINER, {
      image: props.image,
      portMappings: [{ containerPort: BACKEND_PORT }],
      environment: { ...props.environment, PORT: String(BACKEND_PORT) },
      secrets: props.secrets,
      logging: LogDrivers.awsLogs({ logGroup: props.logGroup, streamPrefix: 'backend' }),
      // Time for the shutdown hooks of Nest (relay, consumers, connections).
      stopTimeout: Duration.seconds(30),
    });

    this.service = new FargateService(this, 'Service', {
      cluster: props.cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: props.desiredCount,
      securityGroups: [props.securityGroup],
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: Duration.seconds(60),
      circuitBreaker: { rollback: true },
    });
    props.targetGroup.addTarget(this.service);

    if (props.maxCount > props.desiredCount) {
      this.service
        .autoScaleTaskCount({ minCapacity: props.desiredCount, maxCapacity: props.maxCount })
        .scaleOnCpuUtilization('Cpu', {
          targetUtilizationPercent: 60,
          scaleOutCooldown: Duration.seconds(60),
          scaleInCooldown: Duration.seconds(120),
        });
    }
  }
}

/** ECS secrets of a Secrets Manager secret with JSON fields. */
export function secretFields(secret: ISecret, fields: Record<string, string>): Record<string, EcsSecret> {
  return Object.fromEntries(
    Object.entries(fields).map(([variable, field]) => [variable, EcsSecret.fromSecretsManager(secret, field)]),
  );
}

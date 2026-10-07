import { join } from 'node:path';
import { CustomResource, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import type { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import {
  CpuArchitecture,
  FargateTaskDefinition,
  LogDrivers,
  OperatingSystemFamily,
} from 'aws-cdk-lib/aws-ecs';
import type { ContainerImage, ICluster, Secret as EcsSecret } from 'aws-cdk-lib/aws-ecs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import type { ILogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export const MIGRATE_CONTAINER = 'migrate';
const LOG_STREAM_PREFIX = 'migrate';

export interface DbMigrationProps {
  readonly vpc: IVpc;
  readonly cluster: ICluster;
  readonly securityGroup: ISecurityGroup;
  /** `migrate` target of the backend Dockerfile. */
  readonly image: ContainerImage;
  /** Changes when the image changes, so the migration runs again. */
  readonly imageVersion: string;
  readonly logGroup: ILogGroup;
  readonly logRetention: RetentionDays;
  readonly environment: Record<string, string>;
  readonly secrets: Record<string, EcsSecret>;
  readonly seedOnDeploy: boolean;
}

/**
 * Runs `prisma migrate deploy` (and the seed, with `SEED_ON_DEPLOY`) once per
 * deploy, as a Fargate task started by a custom resource that waits for it to
 * stop. The resource runs again when the image, the task definition or
 * `SEED_ON_DEPLOY` change. A failed migration fails the deploy (and
 * CloudFormation rolls it back) with the location of its log.
 */
export class DbMigration extends Construct {
  readonly resource: CustomResource;

  constructor(scope: Construct, id: string, props: DbMigrationProps) {
    super(scope, id);

    const taskDefinition = new FargateTaskDefinition(this, 'TaskDefinition', {
      cpu: 512,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
    });
    taskDefinition.addContainer(MIGRATE_CONTAINER, {
      image: props.image,
      environment: { ...props.environment, SEED_ON_DEPLOY: String(props.seedOnDeploy) },
      secrets: props.secrets,
      logging: LogDrivers.awsLogs({ logGroup: props.logGroup, streamPrefix: LOG_STREAM_PREFIX }),
    });

    const handlerCode = Code.fromAsset(join(__dirname, 'db-migration-handler'));
    const handler = (name: string, entry: string) =>
      new LambdaFunction(this, name, {
        runtime: Runtime.NODEJS_22_X,
        handler: `index.${entry}`,
        code: handlerCode,
        timeout: Duration.seconds(30),
        logGroup: this.logGroupFor(name, props.logRetention),
      });

    const onEvent = handler('OnEvent', 'onEvent');
    onEvent.addToRolePolicy(
      new PolicyStatement({ actions: ['ecs:RunTask'], resources: [taskDefinition.taskDefinitionArn] }),
    );
    onEvent.addToRolePolicy(
      new PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [taskDefinition.taskRole.roleArn, taskDefinition.obtainExecutionRole().roleArn],
      }),
    );

    const isComplete = handler('IsComplete', 'isComplete');
    isComplete.addToRolePolicy(new PolicyStatement({ actions: ['ecs:DescribeTasks'], resources: ['*'] }));

    const provider = new Provider(this, 'Provider', {
      onEventHandler: onEvent,
      isCompleteHandler: isComplete,
      queryInterval: Duration.seconds(15),
      totalTimeout: Duration.minutes(20),
      logGroup: this.logGroupFor('ProviderFramework', props.logRetention),
    });

    this.resource = new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      resourceType: 'Custom::DbMigration',
      properties: {
        ClusterArn: props.cluster.clusterArn,
        TaskDefinitionArn: taskDefinition.taskDefinitionArn,
        SubnetIds: props.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
        SecurityGroupIds: [props.securityGroup.securityGroupId],
        ContainerName: MIGRATE_CONTAINER,
        LogGroupName: props.logGroup.logGroupName,
        LogStreamPrefix: LOG_STREAM_PREFIX,
        ImageVersion: props.imageVersion,
        SeedOnDeploy: String(props.seedOnDeploy),
      },
    });
  }

  // Explicit log groups: the ones Lambda would create by itself are left
  // behind when the stack is deleted.
  private logGroupFor(name: string, retention: RetentionDays): LogGroup {
    return new LogGroup(this, `${name}Logs`, { retention, removalPolicy: RemovalPolicy.DESTROY });
  }
}

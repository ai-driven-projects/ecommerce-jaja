import { CfnOutput, RemovalPolicy, Stack, Tags } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Cluster, ContainerImage, Secret as EcsSecret } from 'aws-cdk-lib/aws-ecs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import type { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { REPO_ROOT } from './config/env-file';
import type { InfraConfig } from './config/infra-config';
import { AppSecrets } from './constructs/app-secrets';
import { BackendService, secretFields } from './constructs/backend-service';
import { Database, DATABASE_NAME } from './constructs/database';
import { DbMigration } from './constructs/db-migration';
import { Edge } from './constructs/edge';
import { Network } from './constructs/network';
import { RabbitMqBroker } from './constructs/rabbitmq-broker';

const BACKEND_DOCKERFILE = 'apps/backend/Dockerfile';

export interface BackendImages {
  readonly runtime: ContainerImage;
  readonly migrate: ContainerImage;
  /** Changes with the `migrate` image (runs the migration again). */
  readonly migrateVersion: string;
}

export interface JajaStackProps extends StackProps {
  readonly config: InfraConfig;
  /** Tests pass registry images; the deploy builds them from the monorepo. */
  readonly images?: BackendImages;
}

/**
 * The whole ephemeral environment of the backend in one stack, so deploy and
 * destroy are atomic: network, RDS PostgreSQL, Amazon MQ for RabbitMQ, secrets,
 * ALB with HTTPS and the fixed API domain, the migration and the API on ECS
 * Fargate. Every stateful resource is destroyed with the stack.
 */
export class JajaStack extends Stack {
  constructor(scope: Construct, id: string, props: JajaStackProps) {
    super(scope, id, props);
    const { config } = props;
    Tags.of(this).add('jaja:environment', config.envName);
    const logRetention = config.logRetentionDays as RetentionDays;

    const network = new Network(this, 'Network', { maxAzs: config.network.maxAzs });

    const database = new Database(this, 'Database', {
      vpc: network.vpc,
      securityGroup: network.databaseSecurityGroup,
      instanceClass: config.database.instanceClass,
      multiAz: config.database.multiAz,
    });

    const broker = new RabbitMqBroker(this, 'Broker', {
      brokerName: `${config.envName}-broker`,
      vpc: network.vpc,
      securityGroup: network.brokerSecurityGroup,
      instanceType: config.broker.instanceType,
      deploymentMode: config.broker.deploymentMode,
      engineVersion: config.broker.engineVersion,
    });

    const appSecrets = new AppSecrets(this, 'AppSecrets', { names: config.appSecretNames });

    const edge = new Edge(this, 'Edge', {
      vpc: network.vpc,
      securityGroup: network.albSecurityGroup,
      domainName: config.domainName,
      apiDomainName: config.apiDomainName,
    });

    const cluster = new Cluster(this, 'Cluster', { vpc: network.vpc });
    const logGroup = new LogGroup(this, 'BackendLogs', {
      retention: logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const images = props.images ?? this.buildImages();

    const databaseEnvironment = {
      DB_HOST: database.instance.instanceEndpoint.hostname,
      DB_PORT: database.instance.instanceEndpoint.port.toString(),
      DB_NAME: DATABASE_NAME,
      DB_SSL: 'true',
    };
    const databaseSecrets = secretFields(database.secret, { DB_USER: 'username', DB_PASSWORD: 'password' });

    const migration = new DbMigration(this, 'DbMigration', {
      vpc: network.vpc,
      cluster,
      securityGroup: network.migrationSecurityGroup,
      image: images.migrate,
      imageVersion: images.migrateVersion,
      logGroup,
      logRetention,
      environment: databaseEnvironment,
      secrets: databaseSecrets,
      seedOnDeploy: config.app.seedOnDeploy,
    });
    migration.resource.node.addDependency(database.instance);

    const backend = new BackendService(this, 'Backend', {
      cluster,
      securityGroup: network.backendSecurityGroup,
      image: images.runtime,
      logGroup,
      targetGroup: edge.backendTargetGroup,
      desiredCount: config.backend.desiredCount,
      maxCount: config.backend.maxCount,
      cpu: config.backend.cpu,
      memory: config.backend.memory,
      environment: {
        ...databaseEnvironment,
        RABBITMQ_ENDPOINT: broker.amqpEndpoint,
        RABBITMQ_QUEUE_TYPE: config.broker.queueType,
        ORDER_SIMULATION_DELAY_FACTOR: config.app.orderSimulationDelayFactor,
        DB_POOL_MAX: String(config.backend.dbPoolMax),
        DEV_TOOLS_ENABLED: String(config.app.devToolsEnabled),
        ...(config.app.corsOrigin ? { CORS_ORIGIN: config.app.corsOrigin } : {}),
      },
      secrets: {
        ...databaseSecrets,
        ...secretFields(broker.secret, { RABBITMQ_USER: 'username', RABBITMQ_PASSWORD: 'password' }),
        JWT_SECRET: EcsSecret.fromSecretsManager(appSecrets.jwtSecret),
        ...(appSecrets.googleMapsApiKey
          ? { GOOGLE_MAPS_API_KEY: EcsSecret.fromSecretsManager(appSecrets.googleMapsApiKey) }
          : {}),
      },
    });
    // New tasks only after the migration of this deploy.
    backend.service.node.addDependency(migration.resource);

    new CfnOutput(this, 'ApiUrl', { value: edge.apiUrl, description: 'URL fixa da API' });
    new CfnOutput(this, 'LogGroup', { value: logGroup.logGroupName, description: 'Logs do backend e da migração' });
    new CfnOutput(this, 'BrokerId', { value: broker.broker.ref, description: 'Broker do Amazon MQ' });
  }

  private buildImages(): BackendImages {
    const build = (target: string) =>
      new DockerImageAsset(this, `BackendImage-${target}`, {
        directory: REPO_ROOT,
        file: BACKEND_DOCKERFILE,
        target,
        platform: Platform.LINUX_ARM64,
      });
    const runtime = build('runtime');
    const migrate = build('migrate');
    return {
      runtime: ContainerImage.fromDockerImageAsset(runtime),
      migrate: ContainerImage.fromDockerImageAsset(migrate),
      migrateVersion: migrate.assetHash,
    };
  }
}

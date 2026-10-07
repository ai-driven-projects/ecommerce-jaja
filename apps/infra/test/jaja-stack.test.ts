import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { describe, expect, it } from 'vitest';
import { loadInfraConfig } from '../src/config/infra-config';
import { JajaStack } from '../src/jaja-stack';

const ACCOUNT = '123456789012';
const REGION = 'sa-east-1';
const BASE = { AWS_ACCOUNT_ID: ACCOUNT, AWS_REGION: REGION, DOMAIN_NAME: 'exemplo.com.br' };

// Answers of the lookups (normally cached in cdk.context.json by the CLI).
const CONTEXT = {
  [`hosted-zone:account=${ACCOUNT}:domainName=exemplo.com.br:region=${REGION}`]: {
    Id: '/hostedzone/Z0EXEMPLO',
    Name: 'exemplo.com.br.',
  },
  [`availability-zones:account=${ACCOUNT}:region=${REGION}`]: ['sa-east-1a', 'sa-east-1b', 'sa-east-1c'],
};

function synth(env: Record<string, string> = {}, outdir?: string) {
  const { config } = loadInfraConfig({ ...BASE, ...env });
  const app = new App({ context: CONTEXT, ...(outdir ? { outdir } : {}) });
  const stack = new JajaStack(app, config.envName, {
    env: { account: config.account, region: config.region },
    config,
    images: {
      runtime: ContainerImage.fromRegistry('example/jaja-backend:runtime'),
      migrate: ContainerImage.fromRegistry('example/jaja-backend:migrate'),
      migrateVersion: 'test-version',
    },
  });
  return { app, stack, template: Template.fromStack(stack) };
}

const demo = synth().template;
const load = synth({ ENV_SIZE: 'load' }).template;

function containerOf(template: Template, name: string) {
  const definitions = Object.values(template.findResources('AWS::ECS::TaskDefinition'));
  const container = definitions
    .flatMap((definition: any) => definition.Properties.ContainerDefinitions)
    .find((item: any) => item.Name === name);
  if (!container) throw new Error(`container ${name} not found`);
  return container;
}

const variablesOf = (container: any) =>
  Object.fromEntries((container.Environment ?? []).map((item: any) => [item.Name, item.Value]));
const secretNamesOf = (container: any) => (container.Secrets ?? []).map((item: any) => item.Name).sort();

describe('Network', () => {
  it('creates 2 zones in demo and 3 in load, with a single NAT Gateway', () => {
    demo.resourceCountIs('AWS::EC2::Subnet', 4);
    load.resourceCountIs('AWS::EC2::Subnet', 6);
    demo.resourceCountIs('AWS::EC2::NatGateway', 1);
    load.resourceCountIs('AWS::EC2::NatGateway', 1);
  });

  it('opens only 80 and 443 of the load balancer to the internet', () => {
    const groups = Object.values(demo.findResources('AWS::EC2::SecurityGroup')) as any[];
    const open = groups.flatMap((group) =>
      (group.Properties.SecurityGroupIngress ?? []).filter((rule: any) => rule.CidrIp === '0.0.0.0/0'),
    );
    expect(open.map((rule: any) => rule.FromPort).sort()).toEqual([443, 80]);
  });

  it('lets the database be reached only by the backend and the migration, and the broker only by the backend', () => {
    const rules = Object.values(demo.findResources('AWS::EC2::SecurityGroupIngress')) as any[];
    expect(rules.filter((rule) => rule.Properties.FromPort === 5432)).toHaveLength(2);
    expect(rules.filter((rule) => rule.Properties.FromPort === 5671)).toHaveLength(1);
    expect(rules.filter((rule) => rule.Properties.FromPort === 4000)).toHaveLength(1);
  });
});

describe('Database', () => {
  it('is a private PostgreSQL 16, Single-AZ in demo and Multi-AZ in load, without protection or snapshot', () => {
    const expected = (instanceClass: string, multiAz: boolean) => ({
      Engine: 'postgres',
      EngineVersion: Match.stringLikeRegexp('^16'),
      DBInstanceClass: instanceClass,
      MultiAZ: multiAz,
      PubliclyAccessible: false,
      DeletionProtection: false,
      StorageEncrypted: true,
      DBName: 'jaja',
    });
    demo.hasResourceProperties('AWS::RDS::DBInstance', expected('db.t4g.micro', false));
    load.hasResourceProperties('AWS::RDS::DBInstance', expected('db.m7g.large', true));
    demo.hasResource('AWS::RDS::DBInstance', { DeletionPolicy: 'Delete', UpdateReplacePolicy: 'Delete' });
  });
});

describe('RabbitMqBroker', () => {
  it('is a private single instance on one subnet in demo', () => {
    demo.hasResourceProperties('AWS::AmazonMQ::Broker', {
      BrokerName: 'jaja-broker',
      EngineType: 'RABBITMQ',
      EngineVersion: '4.2',
      HostInstanceType: 'mq.m7g.medium',
      DeploymentMode: 'SINGLE_INSTANCE',
      PubliclyAccessible: false,
      AutoMinorVersionUpgrade: true,
      SubnetIds: [Match.anyValue()],
    });
  });

  it('is a cluster over the 3 private subnets in load', () => {
    load.hasResourceProperties('AWS::AmazonMQ::Broker', {
      HostInstanceType: 'mq.m7g.large',
      DeploymentMode: 'CLUSTER_MULTI_AZ',
      SubnetIds: [Match.anyValue(), Match.anyValue(), Match.anyValue()],
    });
  });

  it('takes the password from the generated secret by dynamic reference', () => {
    const broker = Object.values(demo.findResources('AWS::AmazonMQ::Broker'))[0] as any;
    const password = JSON.stringify(broker.Properties.Users[0].Password);
    expect(password).toContain('{{resolve:secretsmanager:');
    expect(password).toContain(':SecretString:password::}}');
  });
});

describe('AppSecrets', () => {
  it('generates the JWT secret when JWT_SECRET is empty', () => {
    demo.hasResourceProperties('AWS::SecretsManager::Secret', {
      GenerateSecretString: { PasswordLength: 64, ExcludePunctuation: true },
    });
  });

  it('references by name the secrets written by the deploy script when the .env has them', () => {
    const { template } = synth({ JWT_SECRET: 'j'.repeat(40), GOOGLE_MAPS_API_KEY: 'AIza-teste' });
    const container = containerOf(template, 'backend');
    const valueFrom = (name: string) =>
      JSON.stringify(container.Secrets.find((item: any) => item.Name === name).ValueFrom);

    expect(valueFrom('JWT_SECRET')).toContain('secret:jaja/app/jwt-secret');
    expect(valueFrom('GOOGLE_MAPS_API_KEY')).toContain('secret:jaja/app/google-maps-api-key');
    template.resourcePropertiesCountIs('AWS::SecretsManager::Secret', { GenerateSecretString: { PasswordLength: 64 } }, 0);
  });
});

describe('Edge', () => {
  it('validates the certificate of the API domain by DNS in the existing zone', () => {
    demo.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'api.jaja.exemplo.com.br',
      ValidationMethod: 'DNS',
      DomainValidationOptions: [{ DomainName: 'api.jaja.exemplo.com.br', HostedZoneId: 'Z0EXEMPLO' }],
    });
    demo.resourceCountIs('AWS::Route53::HostedZone', 0);
  });

  it('serves HTTPS on 443, redirects 80 and keeps idle connections for 120 s', () => {
    demo.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', { Port: 443, Protocol: 'HTTPS' });
    demo.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
      DefaultActions: [{ Type: 'redirect', RedirectConfig: Match.objectLike({ Port: '443', Protocol: 'HTTPS', StatusCode: 'HTTP_301' }) }],
    });
    demo.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internet-facing',
      LoadBalancerAttributes: Match.arrayWith([{ Key: 'idle_timeout.timeout_seconds', Value: '120' }]),
    });
  });

  it('points the fixed API name to the load balancer with an alias record', () => {
    demo.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'api.jaja.exemplo.com.br.',
      Type: 'A',
      HostedZoneId: 'Z0EXEMPLO',
      AliasTarget: Match.objectLike({ DNSName: Match.anyValue() }),
    });
  });

  it('checks the health of the backend on /health', () => {
    demo.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 4000,
      TargetType: 'ip',
      HealthCheckPath: '/health',
      Matcher: { HttpCode: '200' },
      TargetGroupAttributes: Match.arrayWith([{ Key: 'deregistration_delay.timeout_seconds', Value: '30' }]),
    });
  });
});

describe('BackendService', () => {
  it('runs on ARM64 with the variables of the backend and every credential as an ECS secret', () => {
    const { template } = synth({ CORS_ORIGIN: 'http://localhost:3000', ORDER_SIMULATION_DELAY_FACTOR: '0.2' });
    const container = containerOf(template, 'backend');

    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      RuntimePlatform: { CpuArchitecture: 'ARM64', OperatingSystemFamily: 'LINUX' },
      Cpu: '512',
      Memory: '1024',
    });
    expect(variablesOf(container)).toMatchObject({
      DB_NAME: 'jaja',
      DB_SSL: 'true',
      PORT: '4000',
      RABBITMQ_QUEUE_TYPE: 'classic',
      CORS_ORIGIN: 'http://localhost:3000',
      ORDER_SIMULATION_DELAY_FACTOR: '0.2',
      DEV_TOOLS_ENABLED: 'false',
      DB_POOL_MAX: '10',
    });
    expect(Object.keys(variablesOf(container))).toEqual(expect.arrayContaining(['DB_HOST', 'DB_PORT', 'RABBITMQ_ENDPOINT']));
    expect(secretNamesOf(container)).toEqual([
      'DB_PASSWORD',
      'DB_USER',
      'JWT_SECRET',
      'RABBITMQ_PASSWORD',
      'RABBITMQ_USER',
    ]);
    expect(container.StopTimeout).toBe(30);
  });

  it('omits CORS_ORIGIN when it is empty (any origin)', () => {
    expect(variablesOf(containerOf(demo, 'backend'))).not.toHaveProperty('CORS_ORIGIN');
  });

  it('runs 1 task without auto scaling in demo', () => {
    demo.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 1,
      LaunchType: 'FARGATE',
      DeploymentConfiguration: Match.objectLike({ DeploymentCircuitBreaker: { Enable: true, Rollback: true } }),
      NetworkConfiguration: { AwsvpcConfiguration: Match.objectLike({ AssignPublicIp: 'DISABLED' }) },
    });
    demo.resourceCountIs('AWS::ApplicationAutoScaling::ScalableTarget', 0);
  });

  it('scales from 2 to 6 tasks by CPU in load, with quorum queues', () => {
    load.hasResourceProperties('AWS::ECS::Service', { DesiredCount: 2 });
    load.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', { MinCapacity: 2, MaxCapacity: 6 });
    load.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
      TargetTrackingScalingPolicyConfiguration: Match.objectLike({
        TargetValue: 60,
        PredefinedMetricSpecification: { PredefinedMetricType: 'ECSServiceAverageCPUUtilization' },
      }),
    });
    expect(variablesOf(containerOf(load, 'backend')).RABBITMQ_QUEUE_TYPE).toBe('quorum');
  });
});

describe('DbMigration', () => {
  it('runs the migrate image with the database credentials and SEED_ON_DEPLOY', () => {
    const container = containerOf(synth({ SEED_ON_DEPLOY: 'true' }).template, 'migrate');

    expect(container.Image).toBe('example/jaja-backend:migrate');
    expect(variablesOf(container)).toMatchObject({ DB_SSL: 'true', SEED_ON_DEPLOY: 'true' });
    expect(secretNamesOf(container)).toEqual(['DB_PASSWORD', 'DB_USER']);
  });

  it('is triggered by the image version and SEED_ON_DEPLOY, and the backend service waits for it', () => {
    const migration = demo.findResources('Custom::DbMigration');
    const [migrationId, resource] = Object.entries(migration)[0] as [string, any];

    expect(resource.Properties).toMatchObject({
      ImageVersion: 'test-version',
      SeedOnDeploy: 'false',
      ContainerName: 'migrate',
      LogStreamPrefix: 'migrate',
    });
    const service = Object.values(demo.findResources('AWS::ECS::Service'))[0] as any;
    expect(service.DependsOn).toContain(migrationId);
  });

  it('polls the migration task every 15 s for up to 20 minutes', () => {
    const machine = Object.values(demo.findResources('AWS::StepFunctions::StateMachine'))[0] as any;
    const definition = JSON.stringify(machine.Properties.DefinitionString);

    expect(definition).toContain('\\"IntervalSeconds\\":15');
    expect(definition).toContain('\\"MaxAttempts\\":80');
  });
});

describe('ephemeral lifecycle', () => {
  it('retains nothing and takes no snapshot when the stack is deleted', () => {
    for (const template of [demo, load]) {
      const resources = template.toJSON().Resources as Record<string, any>;
      const kept = Object.entries(resources).filter(([, resource]) =>
        ['Retain', 'Snapshot', 'RetainExceptOnCreate'].includes(resource.DeletionPolicy),
      );
      expect(kept.map(([id]) => id)).toEqual([]);
    }
  });

  it('declares a log group with the configured retention for every Lambda function', () => {
    const { template } = synth({ LOG_RETENTION_DAYS: '7' });
    const functions = Object.values(template.findResources('AWS::Lambda::Function')) as any[];

    expect(functions.length).toBeGreaterThan(0);
    for (const fn of functions) expect(fn.Properties.LoggingConfig?.LogGroup).toBeDefined();
    template.allResourcesProperties('AWS::Logs::LogGroup', { RetentionInDays: 7 });
  });

  it('outputs the fixed URL of the API', () => {
    demo.hasOutput('ApiUrl', { Value: 'https://api.jaja.exemplo.com.br' });
  });
});

describe('secrets of the .env', () => {
  it('never reach the synthesized template', () => {
    const jwt = 's3gr3d0-de-teste-com-mais-de-32-caracteres';
    const google = 'AIza-chave-de-teste-do-google';
    const outdir = mkdtempSync(join(tmpdir(), 'jaja-cdk-out-'));
    synth({ JWT_SECRET: jwt, GOOGLE_MAPS_API_KEY: google }, outdir).app.synth();

    const files = listFiles(outdir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content, file).not.toContain(jwt);
      expect(content, file).not.toContain(google);
    }
  });
});

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

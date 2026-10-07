import { Fn, RemovalPolicy } from 'aws-cdk-lib';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import type { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { CfnBroker } from 'aws-cdk-lib/aws-amazonmq';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import type { MqDeploymentMode } from '../config/profiles';

const BROKER_USER = 'jaja';

export interface RabbitMqBrokerProps {
  readonly brokerName: string;
  readonly vpc: IVpc;
  readonly securityGroup: ISecurityGroup;
  readonly instanceType: string;
  readonly deploymentMode: MqDeploymentMode;
  readonly engineVersion: string;
}

/**
 * Amazon MQ for RabbitMQ, private, over the L1 `CfnBroker` (there is no L2).
 * The only user (the administrator created with the broker) has a generated
 * password: the template holds a dynamic reference to the secret, never the
 * value. A single-instance broker takes one private subnet; a cluster takes all
 * of them (one per zone).
 */
export class RabbitMqBroker extends Construct {
  readonly broker: CfnBroker;
  /** Fields `username` and `password`. */
  readonly secret: ISecret;
  /** `amqp+ssl://<host>:5671` (the image turns it into `amqps://`). */
  readonly amqpEndpoint: string;

  constructor(scope: Construct, id: string, props: RabbitMqBrokerProps) {
    super(scope, id);

    const secret = new Secret(this, 'Credentials', {
      description: `Usuário do broker ${props.brokerName}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: BROKER_USER }),
        generateStringKey: 'password',
        passwordLength: 32,
        // Amazon MQ refuses commas, colons and equal signs; the others would
        // need escaping in a URL.
        excludePunctuation: true,
      },
    });
    secret.applyRemovalPolicy(RemovalPolicy.DESTROY);
    this.secret = secret;

    const privateSubnets = props.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnetIds;

    this.broker = new CfnBroker(this, 'Broker', {
      brokerName: props.brokerName,
      engineType: 'RABBITMQ',
      engineVersion: props.engineVersion,
      hostInstanceType: props.instanceType,
      deploymentMode: props.deploymentMode,
      publiclyAccessible: false,
      // Required for RabbitMQ 3.13 and later.
      autoMinorVersionUpgrade: true,
      subnetIds: props.deploymentMode === 'SINGLE_INSTANCE' ? [privateSubnets[0]] : privateSubnets,
      securityGroups: [props.securityGroup.securityGroupId],
      users: [
        {
          username: secret.secretValueFromJson('username').unsafeUnwrap(),
          password: secret.secretValueFromJson('password').unsafeUnwrap(),
        },
      ],
    });
    this.broker.applyRemovalPolicy(RemovalPolicy.DESTROY);
    this.broker.node.addDependency(secret);

    this.amqpEndpoint = Fn.select(0, this.broker.attrAmqpEndpoints);
  }
}

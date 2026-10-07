import { Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import type { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkProps {
  readonly maxAzs: number;
}

/**
 * VPC with public subnets (load balancer, NAT) and private subnets with egress
 * (tasks, database, broker), with a single NAT Gateway, and one security group
 * per role. Only the load balancer accepts traffic from the internet.
 */
export class Network extends Construct {
  readonly vpc: IVpc;
  readonly albSecurityGroup: ISecurityGroup;
  readonly backendSecurityGroup: ISecurityGroup;
  readonly migrationSecurityGroup: ISecurityGroup;
  readonly databaseSecurityGroup: ISecurityGroup;
  readonly brokerSecurityGroup: ISecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      maxAzs: props.maxAzs,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 22 },
      ],
      // The default security group is never used; restricting it would add a
      // custom resource (and its Lambda log group) to the stack.
      restrictDefaultSecurityGroup: false,
    });

    const group = (name: string, description: string) =>
      new SecurityGroup(this, name, { vpc: this.vpc, description, allowAllOutbound: true });

    this.albSecurityGroup = group('AlbSecurityGroup', 'Load balancer: HTTP and HTTPS from the internet');
    this.albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'HTTP (redirected to HTTPS)');
    this.albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'HTTPS');

    this.backendSecurityGroup = group('BackendSecurityGroup', 'Backend tasks: only from the load balancer');
    this.backendSecurityGroup.addIngressRule(this.albSecurityGroup, Port.tcp(4000), 'API from the load balancer');

    this.migrationSecurityGroup = group('MigrationSecurityGroup', 'Migration task: no inbound traffic');

    this.databaseSecurityGroup = group('DatabaseSecurityGroup', 'PostgreSQL: only from the backend and the migration');
    this.databaseSecurityGroup.addIngressRule(this.backendSecurityGroup, Port.tcp(5432), 'PostgreSQL from the backend');
    this.databaseSecurityGroup.addIngressRule(this.migrationSecurityGroup, Port.tcp(5432), 'PostgreSQL from the migration');

    this.brokerSecurityGroup = group('BrokerSecurityGroup', 'RabbitMQ: only AMQP over TLS from the backend');
    this.brokerSecurityGroup.addIngressRule(this.backendSecurityGroup, Port.tcp(5671), 'AMQPS from the backend');
  }
}

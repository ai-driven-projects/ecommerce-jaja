import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { InstanceType, SubnetType } from 'aws-cdk-lib/aws-ec2';
import type { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  PostgresEngineVersion,
  StorageType,
} from 'aws-cdk-lib/aws-rds';
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export const DATABASE_NAME = 'jaja';
const DATABASE_USER = 'jaja_admin';

export interface DatabaseProps {
  readonly vpc: IVpc;
  readonly securityGroup: ISecurityGroup;
  /** Without the `db.` prefix, e.g. `t4g.micro`. */
  readonly instanceClass: string;
  readonly multiAz: boolean;
}

/**
 * RDS PostgreSQL 16, private, with credentials generated in Secrets Manager.
 * TLS is required by the default parameter group (`rds.force_ssl`). Ephemeral:
 * no deletion protection, no automated backups and no final snapshot.
 */
export class Database extends Construct {
  readonly instance: DatabaseInstance;
  /** Fields `username` and `password` (and `host`, `port`...). */
  readonly secret: ISecret;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    this.instance = new DatabaseInstance(this, 'Instance', {
      engine: DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_16 }),
      instanceType: new InstanceType(props.instanceClass),
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      publiclyAccessible: false,
      multiAz: props.multiAz,
      databaseName: DATABASE_NAME,
      credentials: Credentials.fromGeneratedSecret(DATABASE_USER),
      allocatedStorage: 20,
      storageType: StorageType.GP3,
      storageEncrypted: true,
      backupRetention: Duration.days(0),
      deleteAutomatedBackups: true,
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.secret = this.instance.secret!;
    this.secret.applyRemovalPolicy(RemovalPolicy.DESTROY);
  }
}

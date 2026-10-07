import { Duration } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import type { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerAction,
  TargetType,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export const BACKEND_PORT = 4000;
// Above the 20 s heartbeat of the live streams.
const IDLE_TIMEOUT = Duration.seconds(120);

export interface EdgeProps {
  readonly vpc: IVpc;
  readonly securityGroup: ISecurityGroup;
  /** Existing hosted zone (looked up, never created). */
  readonly domainName: string;
  /** `api.<sub>.<domain>`. */
  readonly apiDomainName: string;
}

/**
 * Public entry of the API: an ACM certificate validated by DNS in the existing
 * hosted zone, an internet-facing load balancer (HTTPS on 443, HTTP redirected)
 * and the alias record `api.<sub>.<domain>`, which keeps the URL fixed while
 * the load balancer is recreated with the environment.
 */
export class Edge extends Construct {
  readonly loadBalancer: ApplicationLoadBalancer;
  readonly backendTargetGroup: ApplicationTargetGroup;
  readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: EdgeProps) {
    super(scope, id);

    const zone = HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });

    const certificate = new Certificate(this, 'Certificate', {
      domainName: props.apiDomainName,
      validation: CertificateValidation.fromDns(zone),
    });

    this.loadBalancer = new ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.securityGroup,
      idleTimeout: IDLE_TIMEOUT,
    });

    this.backendTargetGroup = new ApplicationTargetGroup(this, 'BackendTargets', {
      vpc: props.vpc,
      port: BACKEND_PORT,
      protocol: ApplicationProtocol.HTTP,
      targetType: TargetType.IP,
      deregistrationDelay: Duration.seconds(30),
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: Duration.seconds(15),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    this.loadBalancer.addListener('Https', {
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [certificate],
      open: false,
      defaultAction: ListenerAction.forward([this.backendTargetGroup]),
    });
    // The ingress rules of 80 and 443 are in the security group of `Network`.
    this.loadBalancer.addRedirect({ sourcePort: 80, targetPort: 443, open: false });

    new ARecord(this, 'ApiRecord', {
      zone,
      recordName: props.apiDomainName,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(this.loadBalancer)),
    });

    this.apiUrl = `https://${props.apiDomainName}`;
  }
}

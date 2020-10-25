import * as cdk from '@aws-cdk/core';
import {
  AmazonLinuxGeneration,
  AmazonLinuxImage,
  Instance,
  InstanceType,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as targets from '@aws-cdk/aws-elasticloadbalancingv2-targets';
import { ApplicationTargetGroup } from '@aws-cdk/aws-elasticloadbalancingv2';

export class AiAssistedComputing extends cdk.Stack {

  get availabilityZones(): string [] {
    return ['eu-central-1a', 'eu-central-1b']
  }

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const bisuDevVpc = new Vpc(this, 'bisu-vpc-dev', {
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 2,
      subnetConfiguration: [{
        cidrMask: 23,
        name: 'public-subnet-dev',
        subnetType: SubnetType.PUBLIC,
      }],
      natGateways: 0,
    });
    
    const bisuBackendDevSg = new SecurityGroup(this, 'bisu-backend-sg-dev', {
      vpc: bisuDevVpc,
      allowAllOutbound: true,
      securityGroupName: 'bisu-backend-sg-dev',
      description: 'bisu backend dev security group',
    });

    bisuBackendDevSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'allow SSH from anywhere');
    bisuBackendDevSg.addIngressRule(Peer.anyIpv4(), Port.tcp(3000), 'node app port');
    bisuBackendDevSg.addIngressRule(Peer.anyIpv4(), Port.tcp(3001), 'node app port');

    const awsAMI = new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
    });

    //TODO: generate IAM Role for bisu-backend-dev app.

    const bisuBackendDevInstance = new Instance(this, 'bisu-backend-dev', {
      vpc: bisuDevVpc,
      instanceType: new InstanceType('t2.micro'),
      machineImage: awsAMI,
      keyName: 'bisu-backend-dev-kp',
      securityGroup: bisuBackendDevSg,
      instanceName: 'bisu-backend-dev',
    });

    const appLoadBalancer = new elbv2.ApplicationLoadBalancer(this, 'bisu-backend-dev-alb', {
      vpc: bisuDevVpc,
      internetFacing: true,
      loadBalancerName: 'bisu-backend-dev-alb',
      securityGroup: bisuBackendDevSg,
    });

    // control bisuBackendDevInstance.instanceId for instance ids 

    const appLbTargetGroup = new ApplicationTargetGroup(this, 'bisu-backend-dev-targetgroup', {
      vpc: bisuDevVpc,
      targetGroupName: 'bisu-backend-dev-targetgroup',
      targets: [
        new targets.InstanceIdTarget('i-01e49c78ee117d5c2', 3000),
        new targets.InstanceIdTarget('i-01e49c78ee117d5c2', 3001),
      ],
      healthCheck: {
        enabled: true,
        path: '/health-check',
        //interval: cdk.Duration.seconds(60),
      },
      port: 80,
    });

    const appLbListener = appLoadBalancer.addListener('bisu-backend-dev-alb-listener', {
      port: 80,
      defaultTargetGroups: [appLbTargetGroup],
    });

  }
}

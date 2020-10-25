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
    return ['eu-west-2a', 'eu-west-2b']
  }

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const devVpc = new Vpc(this, 'vpc-dev', {
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
    
    const aiAssistedAppDevSg = new SecurityGroup(this, 'ai-assisted-app-sg-dev', {
      vpc: devVpc,
      allowAllOutbound: true,
      securityGroupName: 'ai-assisted-app-sg-dev',
      description: 'ai-assisted-app backend dev security group',
    });

    aiAssistedAppDevSg.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'allow SSH from anywhere');
    aiAssistedAppDevSg.addIngressRule(Peer.anyIpv4(), Port.tcp(8000), 'python app port');

    const awsAMI = new AmazonLinuxImage({
      generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
    });

    const devInstance = new Instance(this, 'ai-assisted-app-dev', {
      vpc: devVpc,
      instanceType: new InstanceType('t2.micro'),
      machineImage: awsAMI,
      keyName: 'ai-assisted-dev-kp',
      securityGroup: aiAssistedAppDevSg,
      instanceName: 'ai-assisted-app-dev',
    });

    const appLoadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ai-assisted-app-dev-alb', {
      vpc: devVpc,
      internetFacing: true,
      loadBalancerName: 'ai-assisted-app-dev-alb',
      securityGroup: aiAssistedAppDevSg,
    });

    const appLbTargetGroup = new ApplicationTargetGroup(this, 'ai-assisted-app-dev-targetgroup', {
      vpc: devVpc,
      targetGroupName: 'ai-assisted-app-dev-targetgroup',
      targets: [
        new targets.InstanceIdTarget(devInstance.instanceId, 8000),
      ],
      healthCheck: {
        enabled: true,
        path: '/health-check',
      },
      port: 80,
    });

    const appLbListener = appLoadBalancer.addListener('ai-assisted-app-dev-alb-listener', {
      port: 80,
      defaultTargetGroups: [appLbTargetGroup],
    });

  }
}

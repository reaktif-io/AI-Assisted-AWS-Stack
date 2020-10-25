#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AiAssistedComputing } from '../lib/development-computing-stack';
const envLondontDev  = { account: '428736127726', region: 'eu-west-2' };

const app = new cdk.App();
new AiAssistedComputing(app, 'AiAssistedComputingDev', { env: envLondontDev });

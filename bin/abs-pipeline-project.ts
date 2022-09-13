#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AbsPipelineProjectStack } from '../lib/abs-pipeline-project-stack';
import { Abs2ndPipelineProjectStack } from '../lib/abs-2ndpipeline-project-stack';
import { AbsBackendInfra } from '../lib/abs-backend-infra';
import { AbsS3BucketStack } from '../lib/abs-s3bucket';

const app = new cdk.App();
new AbsPipelineProjectStack(app, 'AbsPipelineProjectStack', {
});
new Abs2ndPipelineProjectStack(app, 'Abs2ndPipelineProjectStack', {
});
new AbsBackendInfra(app, 'AbsBackendInfra', {
});
new AbsS3BucketStack(app,'AbsS3BucketStack',{
});
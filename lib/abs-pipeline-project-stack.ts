import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {Pipeline} from "aws-cdk-lib/aws-codepipeline";
import codepipelineactions = require('aws-cdk-lib/aws-codepipeline-actions');
import codepipeline = require('aws-cdk-lib/aws-codepipeline');
import cc = require('aws-cdk-lib/aws-codecommit');
import lambda = require('aws-cdk-lib/aws-lambda');
import s3 = require('aws-cdk-lib/aws-s3');
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from "aws-cdk-lib/aws-iam"


export class AbsPipelineProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //create role for codebuild //for testing purpose only // best practice not too add admin permission
    const actionRole = new iam.Role(this, 'ActionRole', {
      roleName: 'codebuild-role-1',
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: 'CodeBuild Role',
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')]
    });

    //Source Stage
    // Create a new repository or refer to an existing one if it was created
    const repo = cc.Repository.fromRepositoryName(this, 'backendrepo', 'abs-backend')

    //creating code pipeline
    const pipeline = new codepipeline.Pipeline(this, 'abs-devops-pipeline', {
      pipelineName: 'abs-devops-pipeline',
    });

    //getting source stage
    const sourceStage = pipeline.addStage({
      stageName: 'Source'
      
    });

    //create new artifact for source
    const sourceArtifact = new codepipeline.Artifact('Source');

    //pull action from source
    const sourceAction = new codepipelineactions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: repo,
      branch: 'development',
      output: sourceArtifact,
    });
    sourceStage.addAction(sourceAction);

    
    //ecr repo for checkmarx scan
    const ecrRepository = ecr.Repository.fromRepositoryName(this, 'JobImage', 'checkmarx-scan')
    
    //adding codebuild stage for checkmarx scan
    const scanProject = new codebuild.Project(this, "checkmarxScan", {
      projectName: "scanRepo",
      buildSpec: codebuild.BuildSpec.fromSourceFilename('lib/buildspec/scanBackend.yaml'),
      description: "backend repo vulnerability scan.",
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromEcrRepository(ecrRepository, 'latest'),
      },
      source: codebuild.Source.codeCommit({
        repository: repo,
        branchOrRef: "development"
      }),
    });
    
    //action for build
    const buildStage = pipeline.addStage({
      stageName: 'Scan'
    });

    const buildAction = new codepipelineactions.CodeBuildAction({
      actionName: 'scanBackendRepo',
      input: sourceArtifact,
      project: scanProject,
      environmentVariables: {
        CHECKMARX_BASE_RULE: {value: ''},
        CHECKMARX_USERNAME: {value: ''},
        CHECKMARX_PASSWORD: {value: ''},
        CX_TEAM: {value: ''},
        SCA_TENANT: {value: ''},
        SCA_USERNAME: {value: ''},
        SCA_PASSWORD: {value: ''},
        SCA_TEAM: {value: ''}
      },
    });
    buildStage.addAction(buildAction)

     //adding codebuild stage for push scan
     const pushProject = new codebuild.Project(this, "pushProject", {
      projectName: "pushBackendRepo",
      buildSpec: codebuild.BuildSpec.fromSourceFilename('lib/buildspec/pushBackend.yaml'),
      description: "push backend repo.",
      role: actionRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
        privileged: true,
      },
      source: codebuild.Source.codeCommit({
        repository: repo,
        branchOrRef: "development"
      }),
    });

    //action for build
    const buildpushStage = pipeline.addStage({
      stageName: 'Build'
    });

    const buildpushAction = new codepipelineactions.CodeBuildAction({
      actionName: 'pushBackendRepo',
      input: sourceArtifact,
      project: pushProject,
    });
    buildpushStage.addAction(buildpushAction)
  }  
}

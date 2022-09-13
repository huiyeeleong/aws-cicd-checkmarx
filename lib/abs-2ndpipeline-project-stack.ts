import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {Pipeline} from "aws-cdk-lib/aws-codepipeline";
import codepipelineactions = require('aws-cdk-lib/aws-codepipeline-actions');
import codepipeline = require('aws-cdk-lib/aws-codepipeline');
import cc = require('aws-cdk-lib/aws-codecommit');
import lambda = require('aws-cdk-lib/aws-lambda');
import * as iam from "aws-cdk-lib/aws-iam"
import s3 = require('aws-cdk-lib/aws-s3');
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';


export class Abs2ndPipelineProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //create role for codebuild //for testing purpose only // best practice not too add admin permission
        const actionRole = new iam.Role(this, 'ActionRole', {
            roleName: 'codebuild-role-2',
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
            description: 'CodeBuild Role',
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')]
          });

     //Source Stage
    // Create a new repository or refer to an existing one if it was created
    const repo = cc.Repository.fromRepositoryName(this, 'backendrepo', 'abs-backend')

    //creating 2nd code pipeline
    const pipeline = new codepipeline.Pipeline(this, 'abs-devops-2ndpipeline', {
        pipelineName: 'abs-devops-2ndpipeline',
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
      branch: 'main',
      output: sourceArtifact,
    });
    sourceStage.addAction(sourceAction);
   
    //ecr repo for checkmarx scan
    const ecrRepository = ecr.Repository.fromRepositoryName(this, 'JobImage', 'checkmarx-scan')
    
    //adding codebuild stage for checkmarx scan
    const scanProject = new codebuild.Project(this, "checkmarxScan", {
      projectName: "scanMasterRepo",
      buildSpec: codebuild.BuildSpec.fromSourceFilename('lib/buildspec/scanBackendInfa.yaml'),
      description: "backend repo vulnerability scan.",
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromEcrRepository(ecrRepository, 'latest'),
      },
      source: codebuild.Source.codeCommit({
        repository: repo,
        branchOrRef: "main"
      }),
    });
    //action for scan backend infra
    const scanStage = pipeline.addStage({
      stageName: 'Scan'
    });

    const scanAction = new codepipelineactions.CodeBuildAction({
      actionName: 'scanMasterRepo',
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
    scanStage.addAction(scanAction)

    

    //adding codebuild stage for backendInfra
    const buildInfra = new codebuild.Project(this, "backendInfra", {
        projectName: "buildbackendInfra",
        buildSpec: codebuild.BuildSpec.fromSourceFilename('lib/buildspec/backendInfra.yaml'),
        description: "build backend infra",
        role: actionRole,
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
          privileged: true,
        },
        source: codebuild.Source.codeCommit({
          repository: repo,
          branchOrRef: "main"
        }),
      });
      //action for build
    const buildStage = pipeline.addStage({
        stageName: 'Build'
      });
      const buildAction = new codepipelineactions.CodeBuildAction({
        actionName: 'BuildInfra',
        input: sourceArtifact,
        project: buildInfra,
      });
      buildStage.addAction(buildAction)
}  
}
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Shared Lambda Layer for Health Command Center
 * 
 * This layer contains common dependencies used across multiple Lambda functions.
 * By using a layer, we:
 * - Reduce individual Lambda deployment package sizes
 * - Improve cold start times
 * - Share code efficiently across functions
 * - Make Lambda code more readable in the AWS Console
 * 
 * The layer includes:
 * - AWS SDK v3 clients (DynamoDB, Cognito)
 * - Common utilities and types
 */
export class SharedLambdaLayer extends Construct {
  public readonly layer: lambda.LayerVersion;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Helper to get current directory in ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    /**
     * Create the Lambda layer
     * The layer will be built from a separate package.json that includes
     * only the production dependencies needed by Lambda functions
     */
    this.layer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../layers/shared'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'cp package.json pnpm-lock.yaml* /asset-output/ 2>/dev/null || cp package.json /asset-output/',
              'cd /asset-output',
              'npm install --production', // Use npm in the container since pnpm might not be available
              'rm -rf package.json pnpm-lock.yaml* package-lock.json*',
              'mkdir -p nodejs',
              'mv node_modules nodejs/',
            ].join(' && '),
          ],
          // Local bundling fallback when Docker is not available
          local: {
            tryBundle(outputDir: string, options: any): boolean {
              const layerDir = path.join(__dirname, '../layers/shared');
              
              try {
                // Check if the layer directory exists
                if (!fs.existsSync(layerDir)) {
                  console.log(`Creating layer directory: ${layerDir}`);
                  fs.mkdirSync(layerDir, { recursive: true });
                }

                // Check if package.json exists
                const packageJsonPath = path.join(layerDir, 'package.json');
                if (!fs.existsSync(packageJsonPath)) {
                  console.log('Creating default package.json for layer...');
                  const defaultPackageJson = {
                    name: 'health-command-center-shared-layer',
                    version: '1.0.0',
                    description: 'Shared dependencies for Lambda functions',
                    private: true,
                    dependencies: {
                      '@aws-sdk/client-dynamodb': '^3.481.0',
                      '@aws-sdk/lib-dynamodb': '^3.481.0',
                      '@aws-sdk/client-cognito-identity-provider': '^3.481.0',
                      'uuid': '^9.0.1'
                    }
                  };
                  fs.writeFileSync(packageJsonPath, JSON.stringify(defaultPackageJson, null, 2));
                }

                // Copy package.json to output directory
                fs.copyFileSync(packageJsonPath, path.join(outputDir, 'package.json'));

                // Install dependencies using npm (more universally available than pnpm in CI/CD)
                console.log('Installing layer dependencies...');
                execSync('npm install --production', {
                  cwd: outputDir,
                  stdio: 'inherit',
                });

                // Clean up package files
                const filesToRemove = ['package.json', 'package-lock.json', 'pnpm-lock.yaml'];
                filesToRemove.forEach(file => {
                  const filePath = path.join(outputDir, file);
                  if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                  }
                });

                // Create nodejs directory structure (required for Lambda layers)
                const nodejsDir = path.join(outputDir, 'nodejs');
                if (!fs.existsSync(nodejsDir)) {
                  fs.mkdirSync(nodejsDir);
                }

                // Move node_modules to nodejs/node_modules
                const sourceModules = path.join(outputDir, 'node_modules');
                const targetModules = path.join(nodejsDir, 'node_modules');
                
                if (fs.existsSync(sourceModules)) {
                  fs.renameSync(sourceModules, targetModules);
                }

                console.log('Layer bundling completed successfully');
                return true;
              } catch (error) {
                console.error('Local bundling failed:', error);
                return false;
              }
            },
          },
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared dependencies for Health Command Center Lambda functions',
      layerVersionName: 'health-command-center-shared-layer',
    });
  }
}

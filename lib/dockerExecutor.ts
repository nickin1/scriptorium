import Docker from 'dockerode';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export class DockerExecutor {
    private docker: Docker;
    private tempDir: string;

    constructor() {
        console.log('Initializing DockerExecutor');
        this.docker = new Docker();
        this.tempDir = path.join(process.cwd(), 'temp');
        console.log('Temp directory set to:', this.tempDir);
    }

    async executeCode(
        code: string,
        language: string,
        input: string = '',
        onOutput?: (type: 'stdout' | 'stderr', data: string) => void
    ): Promise<{ stdout: string, stderr: string }> {
        console.log(`Starting code execution for language: ${language}`);
        const containerId = crypto.randomBytes(16).toString('hex');
        console.log('Generated container ID:', containerId);

        const tempPath = path.join(this.tempDir, containerId);
        console.log('Created temp path:', tempPath);

        const imageName = `scriptorium-${language}:latest`;
        console.log('Using Docker image:', imageName);

        try {
            // Check if image exists
            console.log('Checking if Docker image exists...');
            try {
                await this.docker.getImage(imageName).inspect();
                console.log('Docker image found');
            } catch (error) {
                console.error('Docker image not found:', error);
                throw new Error(`Docker image ${imageName} not found. Please run the build-images.sh script first.`);
            }

            // Create temp directory for this execution
            console.log('Creating temp directory...');
            await fs.mkdir(tempPath, { recursive: true });
            console.log('Temp directory created successfully');

            // Set full permissions on temp directory
            await fs.chmod(tempPath, 0o777);

            // Write code file with special handling for Java
            const filename = language === 'java' ? 'Main.java' : `code.${this.getFileExtension(language)}`;
            const codeFile = path.join(tempPath, filename);
            console.log('Writing code to file:', codeFile);
            await fs.writeFile(codeFile, code);

            if (input) {
                console.log('Writing input file...');
                const inputFile = path.join(tempPath, 'input.txt');
                await fs.writeFile(inputFile, input);
                console.log('Input file written to:', inputFile);
            }

            // Create container
            console.log('Creating Docker container...');
            const container = await this.docker.createContainer({
                Image: imageName,
                name: containerId,
                HostConfig: {
                    Binds: [`${tempPath}:/home/coderunner/code:Z`],
                    Memory: 512 * 1024 * 1024,
                    MemorySwap: 512 * 1024 * 1024,
                    CpuPeriod: 100000,
                    CpuQuota: 90000,
                    NetworkMode: 'none'
                },
                WorkingDir: '/home/coderunner/code',
                Tty: false,
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                OpenStdin: true,
                StdinOnce: true,
                User: 'coderunner'
            });
            console.log('Container created successfully');

            // Start container
            console.log('Starting container...');
            await container.start();
            console.log('Container started successfully');

            // Attach to container
            console.log('Attaching to container...');
            const stream = await container.attach({
                stream: true,
                stdout: true,
                stderr: true,
                stdin: input ? true : false
            });
            console.log('Successfully attached to container');

            // Send input if provided
            if (input) {
                console.log('Sending input to container...');
                stream.write(input);
                stream.end();
                console.log('Input sent successfully');
            }

            // Collect output
            console.log('Setting up output collection...');
            let stdout = '';
            let stderr = '';

            return new Promise((resolve, reject) => {
                console.log('Starting execution promise...');

                // Set timeout
                const timeoutId = setTimeout(async () => {
                    console.log('Execution timeout reached');
                    try {
                        await container.kill();
                        if (onOutput) {
                            onOutput('stderr', 'Execution timeout');
                        }
                        reject(new Error('Execution timeout'));
                    } catch (error) {
                        console.error('Error killing container:', error);
                    }
                }, 10000);

                // Modified stream handling for real-time output
                stream.on('data', (chunk) => {
                    // First byte is stream type (1 for stdout, 2 for stderr)
                    const streamType = chunk[0];
                    const data = chunk.slice(8).toString();

                    // Split the data into lines and process each line separately
                    const lines = data.split('\n');
                    for (const line of lines) {
                        if (line.trim()) {  // Only process non-empty lines
                            if (streamType === 1) {
                                stdout += line + '\n';
                                if (onOutput) {
                                    onOutput('stdout', line + '\n');
                                }
                            } else if (streamType === 2) {
                                stderr += line + '\n';
                                if (onOutput) {
                                    onOutput('stderr', line + '\n');
                                }
                            }
                            console.log(`Stream type ${streamType}, line: ${line}`);
                        }
                    }
                });

                stream.on('error', (error) => {
                    console.error('Stream error:', error);
                    if (onOutput) {
                        onOutput('stderr', error.message);
                    }
                    stderr += error.message;
                });

                container.wait(async (error) => {
                    console.log('Container execution finished');
                    clearTimeout(timeoutId);
                    if (error) {
                        console.error('Container wait error:', error);
                        if (onOutput) {
                            onOutput('stderr', error.message);
                        }
                        reject(error);
                        return;
                    }

                    try {
                        await container.remove();
                        await fs.rm(tempPath, { recursive: true });
                        resolve({ stdout, stderr });
                    } catch (cleanupError) {
                        console.error('Cleanup error:', cleanupError);
                        resolve({ stdout, stderr });
                    }
                });
            });
        } catch (error) {
            console.error('Execution error:', error);

            // Cleanup on error
            console.log('Starting error cleanup...');
            try {
                console.log('Removing container...');
                const container = this.docker.getContainer(containerId);
                await container.remove({ force: true });
                console.log('Container removed successfully');
            } catch (cleanupError) {
                console.error('Container cleanup error:', cleanupError);
            }
            try {
                console.log('Removing temp directory...');
                await fs.rm(tempPath, { recursive: true });
                console.log('Temp directory removed successfully');
            } catch (cleanupError) {
                console.error('Temp directory cleanup error:', cleanupError);
            }
            throw error;
        }
    }

    private getFileExtension(language: string): string {
        console.log('Getting file extension for language:', language);
        const extensions: { [key: string]: string } = {
            python: 'py',
            javascript: 'js',
            typescript: 'ts',
            cpp: 'cpp',
            c: 'c',
            java: 'java',
            rust: 'rs',
            go: 'go',
            racket: 'rkt',
            ruby: 'rb'
        };
        const extension = extensions[language] || language;
        console.log('Using file extension:', extension);
        return extension;
    }
} 
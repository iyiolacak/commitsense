// Import necessary VS Code and Node.js modules
import * as vscode from 'vscode';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

/**
 * Activates the VSCode extension when the command is called
 * @param context - The context provided by VSCode
 */
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('commitsense.generateCommitMessage', async () => {
    try {
      // Get the workspace folder and check for a Git repository
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showWarningMessage('No workspace folder open. Please open a Git repository to use CommitSense.');
        return;
      }

      const gitRepoPath = workspaceFolders[0].uri.fsPath;
      const gitFolderPath = path.join(gitRepoPath, '.git');
      if (!fs.existsSync(gitFolderPath)) {
        vscode.window.showWarningMessage('No Git repository detected in the workspace folder.');
        return;
      }

      // Use Git commands to get the status of files
      exec('git diff --cached', { cwd: gitRepoPath }, async (error, stdout, stderr) => {
        if (error || stderr) {
          vscode.window.showErrorMessage('Failed to get Git diff: ' + (error?.message || stderr));
          return;
        }

        if (!stdout) {
          vscode.window.showInformationMessage('No changes staged for commit. Please stage your changes first.');
          return;
        }

        // Prepare prompt for GPT
        const prompt = `Write a concise commit message based on the following code changes: \n${stdout}`;

        // Send request to OpenAI API for commit message
        try {
          const response = await axios.post('https://api.openai.com/v1/completions', {
            model: 'gpt-4',
            prompt: prompt,
            max_tokens: 100,
          }, {
            headers: {
              Authorization: `Bearer YOUR_OPENAI_API_KEY`,
              'Content-Type': 'application/json',
            }
          });

          const commitMessage = response.data.choices[0].text.trim();

          // Display generated commit message to the user and update the input box
          if (commitMessage) {
            vscode.window.showInformationMessage('Generated Commit Message:\n' + commitMessage);
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension) {
              const git = gitExtension.exports.getAPI(1);
              const repository = git.repositories[0];
              if (repository) {
                repository.inputBox.value = commitMessage;
              }
            }
          }
        } catch (err) {
          vscode.window.showErrorMessage('Failed to generate commit message: ' + (err as Error).message);
        }
      });
    } catch (err) {
      vscode.window.showErrorMessage('An error occurred while generating the commit message: ' + (err as Error).message);
    }
  });

  context.subscriptions.push(disposable);
}

/**
 * Deactivates the VSCode extension
 */
export function deactivate() {}
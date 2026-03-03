import * as vscode from 'vscode';
import { registerThemeDiscoveryCacheInvalidation } from './themeDiscovery';

export function activate(context: vscode.ExtensionContext): void {
  registerThemeDiscoveryCacheInvalidation(context);
  context.subscriptions.push(
    vscode.commands.registerCommand('styleGenerator.openStyleManager', () => openStyleManager(context)),
    vscode.commands.registerCommand('styleGenerator.openColorEditor', () => openColorEditor(context)),
    vscode.commands.registerCommand('styleGenerator.openFontEditor', () => openFontEditor(context)),
    vscode.commands.registerCommand('styleGenerator.openFileIconEditor', () => openFileIconEditor(context)),
    vscode.commands.registerCommand('styleGenerator.openProductIconEditor', () => openProductIconEditor(context))
  );
}

export function deactivate(): void {}

async function openStyleManager(_context: vscode.ExtensionContext): Promise<void> {
  await vscode.window.showInformationMessage(
    'Style Manager will list and apply saved styles. (Coming in a later step.)'
  );
}

async function openColorEditor(_context: vscode.ExtensionContext): Promise<void> {
  await vscode.window.showInformationMessage(
    'Color Theme Editor will let you fork and edit color themes. (Coming in a later step.)'
  );
}

async function openFontEditor(_context: vscode.ExtensionContext): Promise<void> {
  await vscode.window.showInformationMessage(
    'Font Editor will let you configure editor and workbench font settings. (Coming in a later step.)'
  );
}

async function openFileIconEditor(_context: vscode.ExtensionContext): Promise<void> {
  await vscode.window.showInformationMessage(
    'File Icon Editor will let you import icon packs and define associations. (Coming in a later step.)'
  );
}

async function openProductIconEditor(_context: vscode.ExtensionContext): Promise<void> {
  await vscode.window.showInformationMessage(
    'Product Icon Editor will let you import a WOFF font and map product icon IDs. (Coming in a later step.)'
  );
}

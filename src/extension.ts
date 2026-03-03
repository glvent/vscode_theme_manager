import * as vscode from 'vscode';
import { registerThemeDiscoveryCacheInvalidation } from './themeDiscovery';
import {
  getStyles,
  applyStyle,
  createStyle,
  addStyle,
  CUSTOM_FILE_ICON_THEME_ID,
  CUSTOM_PRODUCT_ICON_THEME_ID,
} from './styleManager';

export function activate(context: vscode.ExtensionContext): void {
  registerThemeDiscoveryCacheInvalidation(context);
  context.subscriptions.push(
    vscode.commands.registerCommand('styleGenerator.openStyleManager', () => openStyleManager(context)),
    vscode.commands.registerCommand('styleGenerator.openColorEditor', () => openColorEditor(context)),
    vscode.commands.registerCommand('styleGenerator.openFontEditor', () => openFontEditor(context)),
    vscode.commands.registerCommand('styleGenerator.openFileIconEditor', () => openFileIconEditor(context)),
    vscode.commands.registerCommand('styleGenerator.openProductIconEditor', () => openProductIconEditor(context)),
    vscode.commands.registerCommand('styleGenerator.applyStyle', () => runApplyStyle(context)),
    vscode.commands.registerCommand('styleGenerator.saveCurrentAsStyle', () => runSaveCurrentAsStyle(context))
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

async function runApplyStyle(context: vscode.ExtensionContext): Promise<void> {
  const styles = getStyles(context);
  if (styles.length === 0) {
    await vscode.window.showInformationMessage(
      'No styles saved. Use "Style Generator: Save Current as Style" to create one.'
    );
    return;
  }
  const picked = await vscode.window.showQuickPick(
    styles.map((s) => ({ label: s.name, style: s })),
    { placeHolder: 'Select a style to apply', matchOnDescription: true }
  );
  if (picked) {
    await applyStyle(context, picked.style);
    await vscode.window.showInformationMessage(`Applied style: ${picked.style.name}`);
  }
}

async function runSaveCurrentAsStyle(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration();
  const colorThemeId = config.get<string>('workbench.colorTheme') ?? '';
  const iconThemeId = config.get<string>('workbench.iconTheme') ?? '';
  const productIconThemeId = config.get<string>('workbench.productIconTheme') ?? '';

  const name = await vscode.window.showInputBox({
    prompt: 'Name for this style',
    placeHolder: 'My Style',
    value: `Style ${new Date().toLocaleDateString()}`,
  });
  if (name === undefined) return;

  const style = createStyle({
    name: name.trim() || 'Unnamed',
    colorThemeId,
    fontSettings: {
      editorFontFamily: config.get<string>('editor.fontFamily'),
      editorFontSize: config.get<number>('editor.fontSize'),
      editorFontWeight: config.get<string | number>('editor.fontWeight'),
      editorFontLigatures: config.get<boolean>('editor.fontLigatures'),
      editorLineHeight: config.get<number>('editor.lineHeight'),
      editorLetterSpacing: config.get<number>('editor.letterSpacing'),
    },
    fileIconThemeId: iconThemeId || CUSTOM_FILE_ICON_THEME_ID,
    productIconThemeId: productIconThemeId || CUSTOM_PRODUCT_ICON_THEME_ID,
  });
  await addStyle(context, style);
  await vscode.window.showInformationMessage(`Saved style "${style.name}". Use "Style Generator: Apply Style" to apply it.`);
}

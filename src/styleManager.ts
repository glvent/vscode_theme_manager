import * as vscode from 'vscode';

// --- Constants (match package.json contributes) ---

export const CUSTOM_COLOR_THEME_ID = 'style-generator-custom';
export const CUSTOM_FILE_ICON_THEME_ID = 'style-generator-file-icons';
export const CUSTOM_PRODUCT_ICON_THEME_ID = 'style-generator-product-icons';

// --- Style data structure ---

export interface FontSettings {
  editorFontFamily?: string;
  editorFontSize?: number;
  editorFontWeight?: string | number;
  editorFontLigatures?: boolean;
  editorLineHeight?: number;
  editorLetterSpacing?: number;
}

export interface Style {
  id: string;
  name: string;
  colorThemeId: string;
  fontSettings?: FontSettings;
  fileIconThemeId: string;
  productIconThemeId: string;
}

// --- Global state keys ---

const GLOBAL_STATE_KEY_STYLES = 'styles';
const GLOBAL_STATE_KEY_ACTIVE_STYLE_ID = 'activeStyleId';
const GLOBAL_STATE_KEY_CUSTOM_COLOR_THEME_STORAGE_KEY = 'customColorThemeStorageKey';

// --- Persist list of styles in globalState ---

export function getStyles(context: vscode.ExtensionContext): Style[] {
  const raw = context.globalState.get<unknown>(GLOBAL_STATE_KEY_STYLES);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is Style =>
      s !== null &&
      typeof s === 'object' &&
      typeof (s as Style).id === 'string' &&
      typeof (s as Style).name === 'string' &&
      typeof (s as Style).colorThemeId === 'string' &&
      typeof (s as Style).fileIconThemeId === 'string' &&
      typeof (s as Style).productIconThemeId === 'string'
  );
}

export async function saveStyles(context: vscode.ExtensionContext, styles: Style[]): Promise<void> {
  await context.globalState.update(GLOBAL_STATE_KEY_STYLES, styles);
}

export function getActiveStyleId(context: vscode.ExtensionContext): string | undefined {
  return context.globalState.get<string>(GLOBAL_STATE_KEY_ACTIVE_STYLE_ID);
}

export async function setActiveStyleId(
  context: vscode.ExtensionContext,
  styleId: string | undefined
): Promise<void> {
  await context.globalState.update(GLOBAL_STATE_KEY_ACTIVE_STYLE_ID, styleId);
}

// --- Heavy payloads in globalStorage; keys in global state ---

export async function getCustomColorThemeJson(
  context: vscode.ExtensionContext
): Promise<Record<string, unknown> | undefined> {
  const storageKey = context.globalState.get<string>(GLOBAL_STATE_KEY_CUSTOM_COLOR_THEME_STORAGE_KEY);
  if (!storageKey || !context.globalStorageUri) return undefined;
  try {
    const uri = vscode.Uri.joinPath(context.globalStorageUri, storageKey);
    const data = await vscode.workspace.fs.readFile(uri);
    const raw = new TextDecoder().decode(data);
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export async function setCustomColorThemeJson(
  context: vscode.ExtensionContext,
  themeJson: Record<string, unknown> | undefined
): Promise<void> {
  if (!context.globalStorageUri) return;
  const key = 'custom-color-theme.json';
  await context.globalState.update(GLOBAL_STATE_KEY_CUSTOM_COLOR_THEME_STORAGE_KEY, themeJson ? key : undefined);
  const uri = vscode.Uri.joinPath(context.globalStorageUri, key);
  if (themeJson) {
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(themeJson, null, 2)));
  } else {
    try {
      await vscode.workspace.fs.delete(uri);
    } catch {
      // ignore if missing
    }
  }
}

// --- Apply style: set workbench.colorTheme, font settings, workbench.iconTheme, workbench.productIconTheme ---

const FONT_SETTING_KEYS: { key: keyof FontSettings; configKey: string }[] = [
  { key: 'editorFontFamily', configKey: 'editor.fontFamily' },
  { key: 'editorFontSize', configKey: 'editor.fontSize' },
  { key: 'editorFontWeight', configKey: 'editor.fontWeight' },
  { key: 'editorFontLigatures', configKey: 'editor.fontLigatures' },
  { key: 'editorLineHeight', configKey: 'editor.lineHeight' },
  { key: 'editorLetterSpacing', configKey: 'editor.letterSpacing' },
];

export async function applyStyle(
  context: vscode.ExtensionContext,
  style: Style
): Promise<void> {
  const config = vscode.workspace.getConfiguration();

  // Color theme: use installed theme id unless it's our custom id (Section 5 will apply customizations for that).
  if (style.colorThemeId !== CUSTOM_COLOR_THEME_ID) {
    await config.update('workbench.colorTheme', style.colorThemeId, vscode.ConfigurationTarget.Global);
  }
  // Custom color theme application (workbench.colorCustomizations / editor.tokenColorCustomizations) is Section 5.

  // Font settings from the style.
  if (style.fontSettings) {
    for (const { key, configKey } of FONT_SETTING_KEYS) {
      const value = style.fontSettings[key];
      if (value !== undefined) {
        await config.update(configKey, value, vscode.ConfigurationTarget.Global);
      }
    }
  }

  // File icon theme and product icon theme.
  await config.update('workbench.iconTheme', style.fileIconThemeId, vscode.ConfigurationTarget.Global);
  await config.update('workbench.productIconTheme', style.productIconThemeId, vscode.ConfigurationTarget.Global);

  await setActiveStyleId(context, style.id);
}

// --- Helpers for Style Manager UI ---

export function createStyle(partial: Omit<Style, 'id'>): Style {
  return {
    ...partial,
    id: `style-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
}

export async function addStyle(context: vscode.ExtensionContext, style: Style): Promise<void> {
  const styles = getStyles(context);
  if (styles.some((s) => s.id === style.id)) return;
  await saveStyles(context, [...styles, style]);
}

export async function updateStyle(context: vscode.ExtensionContext, updated: Style): Promise<void> {
  const styles = getStyles(context).map((s) => (s.id === updated.id ? updated : s));
  await saveStyles(context, styles);
}

export async function removeStyle(context: vscode.ExtensionContext, styleId: string): Promise<void> {
  const styles = getStyles(context).filter((s) => s.id !== styleId);
  if (getActiveStyleId(context) === styleId) {
    await setActiveStyleId(context, undefined);
  }
  await saveStyles(context, styles);
}

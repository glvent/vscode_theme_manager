import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// --- Types (exposed for style manager and editors) ---

export interface ColorThemeInfo {
  id: string;
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  path: string;
  colors: Record<string, string> | undefined;
  tokenColors: TokenColorRule[] | undefined;
}

export interface TokenColorRule {
  scope?: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

export interface FileIconThemeInfo {
  id: string;
  label: string;
  path: string;
  iconDefinitionsSummary?: { count: number };
  associationsSummary?: { fileExtensions?: number; fileNames?: number; folderNames?: number; languageIds?: number };
}

export interface ProductIconThemeInfo {
  id: string;
  label: string;
  path: string;
}

// --- Helpers ---

function resolvePath(extensionPath: string, relativePath: string): string {
  return path.resolve(extensionPath, relativePath.replace(/^\.[/\\]/, ''));
}

async function readFileUtf8(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf-8');
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await readFileUtf8(filePath);
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Parse .tmTheme (plist XML) and return token colors in VS Code format. */
async function parseTmTheme(filePath: string): Promise<TokenColorRule[] | undefined> {
  try {
    const raw = await readFileUtf8(filePath);
    // .tmTheme is often plist; minimal parse for <key>scope</key><string>... to get settings
    const settingsMatches = raw.matchAll(/<key>settings<\/key>\s*<dict>([\s\S]*?)<\/dict>/g);
    const rules: TokenColorRule[] = [];
    for (const m of settingsMatches) {
      const dict = m[1];
      const scopeMatch = dict.match(/<key>scope<\/key>\s*<string>([^<]*)<\/string>/);
      const fgMatch = dict.match(/<key>foreground<\/key>\s*<string>#?([^<]*)<\/string>/);
      const bgMatch = dict.match(/<key>background<\/key>\s*<string>#?([^<]*)<\/string>/);
      const fontStyleMatch = dict.match(/<key>fontStyle<\/key>\s*<string>([^<]*)<\/string>/);
      const scope = scopeMatch ? scopeMatch[1].trim() : undefined;
      const foreground = fgMatch ? (fgMatch[1].startsWith('#') ? fgMatch[1] : '#' + fgMatch[1]) : undefined;
      const background = bgMatch ? (bgMatch[1].startsWith('#') ? bgMatch[1] : '#' + bgMatch[1]) : undefined;
      const fontStyle = fontStyleMatch ? fontStyleMatch[1] : undefined;
      if (foreground || background || fontStyle) {
        rules.push({
          scope: scope || undefined,
          settings: { foreground, background, fontStyle },
        });
      }
    }
    return rules.length > 0 ? rules : undefined;
  } catch {
    return undefined;
  }
}

// --- Color themes ---

interface ThemeContribution {
  id?: string;
  label: string;
  path: string;
  uiTheme?: string;
}

interface ColorThemeJson {
  colors?: Record<string, string>;
  tokenColors?: TokenColorRule[] | string;
}

export async function discoverColorThemes(): Promise<ColorThemeInfo[]> {
  const result: ColorThemeInfo[] = [];
  const extensions = vscode.extensions.all;

  for (const ext of extensions) {
    const contributes = ext.packageJSON?.contributes as { themes?: ThemeContribution[] } | undefined;
    const themes = contributes?.themes;
    if (!Array.isArray(themes)) continue;

    const extensionPath = ext.extensionPath;
    for (let i = 0; i < themes.length; i++) {
      const t = themes[i];
      if (!t || typeof t.path !== 'string' || typeof t.label !== 'string') continue;

      const themePath = resolvePath(extensionPath, t.path);
      const themeId = t.id ?? t.label ?? String(i);
      // Use contribution id when present (matches workbench.colorTheme); else extensionId-themeId.
      const fullId =
        typeof t.id === 'string' && t.id.trim() ? t.id : `${ext.id}-${themeId}`.replace(/\s+/g, ' ');
      const uiTheme = (t.uiTheme === 'vs-dark' || t.uiTheme === 'hc-black' ? t.uiTheme : 'vs') as ColorThemeInfo['uiTheme'];

      const json = await readJsonFile<ColorThemeJson>(themePath);
      let colors = json?.colors;
      let tokenColors = Array.isArray(json?.tokenColors) ? (json.tokenColors as TokenColorRule[]) : undefined;

      if (typeof json?.tokenColors === 'string') {
        const tmPath = path.resolve(path.dirname(themePath), json.tokenColors);
        tokenColors = await parseTmTheme(tmPath);
      }

      result.push({
        id: fullId,
        label: t.label,
        uiTheme,
        path: themePath,
        colors,
        tokenColors,
      });
    }
  }

  return result;
}

// --- File icon themes ---

interface IconThemeContribution {
  id?: string;
  label: string;
  path: string;
}

interface FileIconThemeJson {
  iconDefinitions?: Record<string, unknown>;
  file?: string;
  folder?: string;
  folderExpanded?: string;
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  languageIds?: Record<string, string>;
}

export async function discoverFileIconThemes(): Promise<FileIconThemeInfo[]> {
  const result: FileIconThemeInfo[] = [];
  const extensions = vscode.extensions.all;

  for (const ext of extensions) {
    const contributes = ext.packageJSON?.contributes as { iconThemes?: IconThemeContribution[] } | undefined;
    const iconThemes = contributes?.iconThemes;
    if (!Array.isArray(iconThemes)) continue;

    const extensionPath = ext.extensionPath;
    for (let i = 0; i < iconThemes.length; i++) {
      const t = iconThemes[i];
      if (!t || typeof t.path !== 'string' || typeof t.label !== 'string') continue;

      const themePath = resolvePath(extensionPath, t.path);
      const themeId = t.id ?? t.label ?? String(i);
      const fullId =
        typeof t.id === 'string' && t.id.trim() ? t.id : `${ext.id}-${themeId}`.replace(/\s+/g, ' ');

      const json = await readJsonFile<FileIconThemeJson>(themePath);
      const iconDefs = json?.iconDefinitions;
      const count = iconDefs ? Object.keys(iconDefs).length : 0;
      const associationsSummary = json
        ? {
            fileExtensions: json.fileExtensions ? Object.keys(json.fileExtensions).length : 0,
            fileNames: json.fileNames ? Object.keys(json.fileNames).length : 0,
            folderNames: json.folderNames ? Object.keys(json.folderNames).length : 0,
            languageIds: json.languageIds ? Object.keys(json.languageIds).length : 0,
          }
        : undefined;

      result.push({
        id: fullId,
        label: t.label,
        path: themePath,
        iconDefinitionsSummary: { count },
        associationsSummary,
      });
    }
  }

  return result;
}

// --- Product icon themes ---

interface ProductIconThemeContribution {
  id?: string;
  label: string;
  path: string;
}

export async function discoverProductIconThemes(): Promise<ProductIconThemeInfo[]> {
  const result: ProductIconThemeInfo[] = [];
  const extensions = vscode.extensions.all;

  for (const ext of extensions) {
    const contributes = ext.packageJSON?.contributes as { productIconThemes?: ProductIconThemeContribution[] } | undefined;
    const productThemes = contributes?.productIconThemes;
    if (!Array.isArray(productThemes)) continue;

    const extensionPath = ext.extensionPath;
    for (let i = 0; i < productThemes.length; i++) {
      const t = productThemes[i];
      if (!t || typeof t.path !== 'string' || typeof t.label !== 'string') continue;

      const themePath = resolvePath(extensionPath, t.path);
      const themeId = t.id ?? t.label ?? String(i);
      const fullId =
        typeof t.id === 'string' && t.id.trim() ? t.id : `${ext.id}-${themeId}`.replace(/\s+/g, ' ');

      result.push({
        id: fullId,
        label: t.label,
        path: themePath,
      });
    }
  }

  return result;
}

// --- Cached API (optional) ---

let colorThemesCache: ColorThemeInfo[] | null = null;
let fileIconThemesCache: FileIconThemeInfo[] | null = null;
let productIconThemesCache: ProductIconThemeInfo[] | null = null;

export function clearThemeDiscoveryCache(): void {
  colorThemesCache = null;
  fileIconThemesCache = null;
  productIconThemesCache = null;
}

export async function getColorThemes(cache = true): Promise<ColorThemeInfo[]> {
  if (cache && colorThemesCache) return colorThemesCache;
  colorThemesCache = await discoverColorThemes();
  return colorThemesCache;
}

export async function getFileIconThemes(cache = true): Promise<FileIconThemeInfo[]> {
  if (cache && fileIconThemesCache) return fileIconThemesCache;
  fileIconThemesCache = await discoverFileIconThemes();
  return fileIconThemesCache;
}

export async function getProductIconThemes(cache = true): Promise<ProductIconThemeInfo[]> {
  if (cache && productIconThemesCache) return productIconThemesCache;
  productIconThemesCache = await discoverProductIconThemes();
  return productIconThemesCache;
}

export function registerThemeDiscoveryCacheInvalidation(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.extensions.onDidChange(() => {
      clearThemeDiscoveryCache();
    })
  );
}

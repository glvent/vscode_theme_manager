import * as vscode from 'vscode';
import { getColorThemes, TokenColorRule } from '../themeDiscovery';
import { getCustomColorThemeJson, setCustomColorThemeJson } from '../styleManager';

const VIEW_TYPE = 'styleGenerator.colorThemeEditor';
const SCOPE_THEME_NAME = 'Style Generator';

export function openColorThemeEditor(context: vscode.ExtensionContext): void {
  const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
  const existing = ColorThemeEditorPanel.currentPanel;
  if (existing) {
    existing.reveal(column);
    return;
  }
  const panel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    'Color Theme Editor',
    column,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [],
    }
  );
  ColorThemeEditorPanel.currentPanel = new ColorThemeEditorPanel(panel, context);
}

class ColorThemeEditorPanel {
  static currentPanel: ColorThemeEditorPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.context = context;
    panel.onDidDispose(() => this.dispose(), null, this.disposables);
    panel.webview.html = this.getHtml();
    panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables
    );
    this.sendInitialState();
  }

  private dispose(): void {
    ColorThemeEditorPanel.currentPanel = undefined;
    this.disposables.forEach((d) => d.dispose());
  }

  reveal(column: vscode.ViewColumn): void {
    this.panel.reveal(column);
  }

  private async sendInitialState(): Promise<void> {
    const themes = await getColorThemes();
    const custom = await getCustomColorThemeJson(this.context);
    const config = vscode.workspace.getConfiguration();
    const currentColorCustomizations = config.get<Record<string, string>>('workbench.colorCustomizations') ?? {};
    const currentTokenCustomizations = config.get<Record<string, { textMateRules?: TokenColorRule[] }>>('editor.tokenColorCustomizations') ?? {};
    const currentThemeName = config.get<string>('workbench.colorTheme') ?? '';
    const scopeKey = `[${currentThemeName}]`;
    const currentTokenRules = currentTokenCustomizations[scopeKey]?.textMateRules ?? [];

    const colors = (custom?.colors as Record<string, string> | undefined) ?? currentColorCustomizations;
    const tokenColors = (custom?.tokenColors as TokenColorRule[] | undefined) ?? currentTokenRules;

    this.panel.webview.postMessage({
      type: 'initial',
      themes: themes.map((t) => ({ id: t.id, label: t.label })),
      colors: colors ?? {},
      tokenColors: tokenColors ?? [],
      currentThemeName: currentThemeName,
    });
  }

  private async handleMessage(msg: { type: string; themeId?: string; colors?: Record<string, string>; tokenColors?: TokenColorRule[] }): Promise<void> {
    switch (msg.type) {
      case 'fork': {
        const themes = await getColorThemes();
        const theme = themes.find((t) => t.id === msg.themeId);
        if (!theme) return;
        const colors = theme.colors ?? {};
        const tokenColors = theme.tokenColors ?? [];
        this.panel.webview.postMessage({
          type: 'forked',
          colors,
          tokenColors,
        });
        await this.applyPreview(colors, tokenColors);
        break;
      }
      case 'updatePreview': {
        if (msg.colors !== undefined || msg.tokenColors !== undefined) {
          await this.applyPreview(msg.colors ?? {}, msg.tokenColors ?? []);
        }
        break;
      }
      case 'save': {
        const colors = msg.colors ?? {};
        const tokenColors = msg.tokenColors ?? [];
        const fullTheme = {
          name: SCOPE_THEME_NAME,
          type: 'dark',
          colors,
          tokenColors,
        };
        await setCustomColorThemeJson(this.context, fullTheme);
        await vscode.window.showInformationMessage('Custom color theme saved. Use a style with "Custom" color to apply it.');
        break;
      }
      case 'export': {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('my-color-theme.json'),
          filters: { 'Color theme': ['json'] },
        });
        if (!uri) return;
        const colors = msg.colors ?? {};
        const tokenColors = msg.tokenColors ?? [];
        const fullTheme = {
          name: SCOPE_THEME_NAME,
          type: 'dark',
          colors,
          tokenColors,
        };
        await vscode.workspace.fs.writeFile(
          uri,
          new TextEncoder().encode(JSON.stringify(fullTheme, null, 2))
        );
        await vscode.window.showInformationMessage(`Exported to ${uri.fsPath}`);
        break;
      }
      default:
        break;
    }
  }

  private async applyPreview(
    colors: Record<string, string>,
    tokenColors: TokenColorRule[]
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const currentThemeName = config.get<string>('workbench.colorTheme') ?? SCOPE_THEME_NAME;
    const scopeKey = `[${currentThemeName}]`;
    await config.update(
      'workbench.colorCustomizations',
      colors,
      vscode.ConfigurationTarget.Global
    );
    const existing = config.get<Record<string, unknown>>('editor.tokenColorCustomizations') ?? {};
    await config.update(
      'editor.tokenColorCustomizations',
      { ...existing, [scopeKey]: { textMateRules: tokenColors } },
      vscode.ConfigurationTarget.Global
    );
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Color Theme Editor</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); font-size: 13px; padding: 12px; margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h2 { margin: 0 0 8px; font-size: 14px; }
    section { margin-bottom: 16px; }
    .row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    label { min-width: 200px; }
    select { flex: 1; min-width: 180px; padding: 4px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
    input[type="color"] { width: 28px; height: 24px; padding: 0; border: 1px solid var(--vscode-input-border); cursor: pointer; }
    input[type="text"] { flex: 1; min-width: 100px; padding: 4px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
    button { padding: 6px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .token-rule { display: grid; grid-template-columns: 1fr 120px 120px 100px 60px; gap: 6px; align-items: center; margin-bottom: 4px; }
    .token-rule input { min-width: 0; }
    .token-list { max-height: 280px; overflow-y: auto; }
    .color-list { max-height: 240px; overflow-y: auto; }
    .actions { display: flex; gap: 8px; margin-top: 12px; }
  </style>
</head>
<body>
  <section>
    <h2>Theme source</h2>
    <div class="row">
      <select id="themeSelect"><option value="">-- Select a theme to fork --</option></select>
      <button id="forkBtn">Fork</button>
    </div>
  </section>
    <section>
    <h2>Workbench colors</h2>
    <div class="color-list" id="colorList"></div>
    <div class="row">
      <input type="text" id="newColorKey" placeholder="e.g. editor.background">
      <input type="text" id="newColorValue" placeholder="#1e1e1e">
      <button id="addColorBtn" class="secondary">Add color</button>
    </div>
  </section>
  <section>
    <h2>Token colors</h2>
    <div class="token-list" id="tokenList"></div>
    <button id="addTokenBtn" class="secondary">Add rule</button>
  </section>
  <section class="actions">
    <button id="saveBtn">Save custom theme</button>
    <button id="exportBtn" class="secondary">Export to file</button>
  </section>
  <script>
    const vscode = acquireVsCodeApi();
    let themes = [];
    let colors = {};
    let tokenColors = [];

    function emitPreview() {
      vscode.postMessage({ type: 'updatePreview', colors: { ...colors }, tokenColors: [...tokenColors] });
    }

    function renderColors() {
      const el = document.getElementById('colorList');
      el.innerHTML = '';
      const keys = Object.keys(colors).sort();
      keys.forEach(key => {
        const row = document.createElement('div');
        row.className = 'row';
        const lab = document.createElement('label');
        lab.textContent = key;
        const inp = document.createElement('input');
        inp.type = 'color';
        inp.value = colors[key].replace(/^#([0-9a-fA-F]{6})$/, (m, h) => '#' + h);
        if (colors[key].length === 9) inp.value = colors[key].slice(0, 7);
        const txt = document.createElement('input');
        txt.type = 'text';
        txt.value = colors[key];
        txt.placeholder = '#rrggbb';
        const del = document.createElement('button');
        del.className = 'secondary';
        del.textContent = 'Remove';
        inp.oninput = () => { colors[key] = inp.value; txt.value = inp.value; emitPreview(); };
        txt.onchange = () => { colors[key] = txt.value; if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(txt.value)) inp.value = txt.value.slice(0,7); emitPreview(); };
        del.onclick = () => { delete colors[key]; renderColors(); emitPreview(); };
        row.appendChild(lab); row.appendChild(inp); row.appendChild(txt); row.appendChild(del);
        el.appendChild(row);
      });
    }

    function renderTokenColors() {
      const el = document.getElementById('tokenList');
      el.innerHTML = '';
      tokenColors.forEach((rule, i) => {
        const row = document.createElement('div');
        row.className = 'token-rule';
        const scope = Array.isArray(rule.scope) ? rule.scope.join(', ') : (rule.scope || '');
        const fg = rule.settings?.foreground || '';
        const bg = rule.settings?.background || '';
        const fontStyle = rule.settings?.fontStyle || '';
        row.innerHTML = \`
          <input type="text" placeholder="scope" value="\${scope}">
          <input type="text" placeholder="foreground" value="\${fg}">
          <input type="text" placeholder="background" value="\${bg}">
          <input type="text" placeholder="fontStyle" value="\${fontStyle}">
          <button class="secondary" data-i="\${i}">Del</button>
        \`;
        const inputs = row.querySelectorAll('input');
        const update = () => {
          const sc = inputs[0].value.trim();
          tokenColors[i] = {
            scope: sc ? (sc.includes(',') ? sc.split(/,\\s*/) : sc) : undefined,
            settings: { foreground: inputs[1].value || undefined, background: inputs[2].value || undefined, fontStyle: inputs[3].value || undefined }
          };
          emitPreview();
        };
        inputs.forEach(inp => inp.addEventListener('input', update));
        row.querySelector('button').onclick = () => { tokenColors.splice(i, 1); renderTokenColors(); emitPreview(); };
        el.appendChild(row);
      });
    }

    document.getElementById('themeSelect').onchange = () => {};
    document.getElementById('forkBtn').onclick = () => {
      const id = document.getElementById('themeSelect').value;
      if (id) vscode.postMessage({ type: 'fork', themeId: id });
    };
    document.getElementById('addColorBtn').onclick = () => {
      const keyInp = document.getElementById('newColorKey');
      const valInp = document.getElementById('newColorValue');
      const key = keyInp.value.trim();
      const val = valInp.value.trim() || '#000000';
      if (key) { colors[key] = val; keyInp.value = ''; valInp.value = ''; renderColors(); emitPreview(); }
    };
    document.getElementById('addTokenBtn').onclick = () => {
      tokenColors.push({ scope: 'source', settings: { foreground: '#ffffff' } });
      renderTokenColors();
      emitPreview();
    };
    document.getElementById('saveBtn').onclick = () => vscode.postMessage({ type: 'save', colors: { ...colors }, tokenColors: [...tokenColors] });
    document.getElementById('exportBtn').onclick = () => vscode.postMessage({ type: 'export', colors: { ...colors }, tokenColors: [...tokenColors] });

    window.addEventListener('message', e => {
      const m = e.data;
      if (m.type === 'initial') {
        themes = m.themes || [];
        const sel = document.getElementById('themeSelect');
        sel.innerHTML = '<option value="">-- Select a theme to fork --</option>' + themes.map(t => \`<option value="\${t.id}">\${t.label}</option>\`).join('');
        colors = m.colors || {};
        tokenColors = Array.isArray(m.tokenColors) ? m.tokenColors : [];
        renderColors();
        renderTokenColors();
      } else if (m.type === 'forked') {
        colors = m.colors || {};
        tokenColors = Array.isArray(m.tokenColors) ? m.tokenColors : [];
        renderColors();
        renderTokenColors();
      }
    });
  </script>
</body>
</html>`;
  }
}

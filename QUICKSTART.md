# VSCode Style Generator - Quick Start

## Method 1: One-time setup

```bash
npm run setup
```

Or, optionally, run the compiler in watch mode so changes recompile automatically. Leave this running in a terminal while you work:

```bash
npm run watch
```

- Press **F5** (or **Run > Start Debugging**).
- Use this when you want breakpoints, DevTools, and the debugger attached.

## Method 2: Dev script (**recommended**)

- Use this when you want one command that can optionally start watch and launch.

```bash
npm run start:dev
```

- Install dependencies via `npm install`.
- Finds currently used VSCode editor.
- Choose between `npm run watch` or `npm run setup`.

## Try the extension

1. In the new **Extension Development Host** window, open the command palette via `Ctrl+Shift+P` or `Cmd+Shift+P`.
2. Run any of the following:
  - `**Style Generator: Open Style Manager`**
  - `**Style Generator: Open Color Editor`**
  - `**Style Generator: Open Font Editor`**
  - `**Style Generator: Open File Icon Editor**`
  - `**Style Generator: Open Product Icon Editor**`

Close the Extension Development Host window when you’re done.
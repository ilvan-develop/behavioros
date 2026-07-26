# BehaviorOS — VSCode/Cursor Extension Spec

## Features
1. **Protocol Status Panel** — Webview sidebar mostrando:
   - Estado atual do protocolo (steps completed/missing)
   - Missão ativa
   - DNA pattern selecionado
   - Último audit result

2. **Commands** (Command Palette)
   - `BehaviorOS: Select DNA` → bos_select_dna
   - `BehaviorOS: Create Mission` → create-mission
   - `BehaviorOS: Run Audit` → bos_run_audit
   - `BehaviorOS: Validate Protocol` → bos_validate_protocol

3. **Decorations**
   - Código não-compliance destacado
   - Quality gate status inline

## Tech Stack
- Extension: TypeScript + VSCode Extension API
- Webview: React + shadcn/ui
- MCP Client: @modelcontextprotocol/sdk
- State: ProtocolState via MCP bos_validate_protocol

## Files
```
behavioros-vscode/
├── package.json
├── src/
│   ├── extension.ts        # Activation
│   ├── panel.ts            # Webview panel
│   ├── mcp-client.ts       # MCP connection
│   ├── decorations.ts      # Editor decorations
│   └── commands.ts         # Command palette
├── webview-ui/
│   ├── App.tsx
│   ├── ProtocolStatus.tsx
│   ├── MissionPanel.tsx
│   └── AuditResult.tsx
└── .vscodeignore
```

## MCP Connection
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({
  command: 'node',
  args: ['packages/mcp-server/dist/server.js'],
})

const client = new Client({ name: 'behavioros-vscode', version: '1.0.0' })
await client.connect(transport)
```

## Publishing
- VSCode Marketplace: publisher behavioros
- Open VSX Registry (for Cursor)

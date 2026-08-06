# Runbook mínimo — Operação e Recuperação do BehaviorOS Kernel

Resumo rápido
- Localização do estado: `.agent_state.json` na raiz do repositório.
- Comando de diagnóstico: `npx @behavioros/cli enforce doctor` (ou `npx @behavioros/cli ecosystem doctor`).

Procedimentos comuns

1) Inicializar estado (modo safe)

  - Copiar o template:

```bash
cp templates/.agent_state.json.example .agent_state.json
```

  - Verificar permissões e integridade do JSON.

2) Executar diagnóstico (doctor)

```bash
# Verifica saúde do registry, adapters e DNAs
npx @behavioros/cli enforce doctor
```

Saídas esperadas: resumo com checks (SkillEngine, DNALoader, MCPs, Adapters). Em caso de `CRITICAL` bloqueará o merge.

3) Restaurar estado a partir de backup

 - Se `.agent_state.json` corrompido, substituir por `templates/.agent_state.json.example` e re-popular manualmente `pipeline_history` com entradas relevantes.

4) Forçar re-sincronização de DNAs

```bash
# Re-sincroniza o registry (--report não existe em `sync`; o relatório é um
# comando separado)
npx @behavioros/cli ecosystem sync
npx @behavioros/cli ecosystem report --format md
```

5) Quando escalonar para humanos

- Security critical: parar pipelines e abrir issue com label `security/critical`.
- Governance violation: abrir `governance` ticket e bloquear deploy até revisão.

Logs e Telemetria
- Local logs: `generated/mcp/logs/` e `packages/observability-dashboard` (se existir).
- Métricas recomendadas: `routing_success_rate`, `handoff_failures`, `doctor_blockers`.

Checklist pré-deploy
- `ecosystem doctor` sem blockers críticos
- `.agent_state.json` válido e com `pipeline_status: READY`
- CI green (lint, typecheck, tests básicos)

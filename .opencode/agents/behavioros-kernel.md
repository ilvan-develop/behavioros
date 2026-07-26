# BEHAVIOROS CORE KERNEL v1.0
<!-- SYSTEM_GOVERNANCE_LAYER: PRIORITY_0 -->

## 1. BEHAVIOR & ARCHITECTURAL CONSTRAINTS
- Você atua sob a governança BehaviorOS.
- Mantenha isolamento de domínios (DDD) — não cruze boundaries sem mapeamento.
- Não modifique arquivos fora do contexto do subtask sem autorização.

## 2. KERNEL LOOP (ESTADOS OBRIGATÓRIOS)
Para qualquer tarefa delegada, siga estritamente as etapas e atualize `.agent_state.json`:
1. [STAGE: ANALYSIS] — Ler código, DNAs, `AGENTS.md` e `.agent_state.json`.
2. [STAGE: PROPOSAL] — Apresentar blueprint de mudanças e aguardar aprovação para mudanças estruturais.
3. [STAGE: EXECUTION] — Implementar alterações dentro do contexto mapeado.
4. [STAGE: VERIFICATION] — Rodar validações locais (tests/doctor) e gravar resultado em `pipeline_history`.

## 3. MEMÓRIA / ESTADO
- Estado persistente obrigatório: `.agent_state.json`.
- Atualize `current_workflow.active_stage` e anexe entradas em `pipeline_history` ao completar cada stage.

## 4. PROIBIÇÕES
- Nunca execute comandos remotos ou instale software por conta própria.
- Nunca escreva credenciais sensíveis em repositório.

## 5. INTEGRATION HINTS
- Paths principais para leitura: `dnas/`, `packages/*`, `generated/mcp/`, `docs/`.
- Ao detectar falha em adapters, registre `rejectionReason` no `HandoffRecord` e tente fallback.

## 6. AUDITABILITY
- Todas as decisões de roteamento e handoff devem ser registradas com `missionId` e `agentId`.

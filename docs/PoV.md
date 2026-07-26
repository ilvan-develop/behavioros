# Prova de Verdade (PoV) — BehaviorOS Kernel

Objetivo: validar que o `BehaviorOS Kernel` atende aos requisitos de governança, persistência de estado, roteamento de skills e handoffs seguros.

Critérios de Aceitação (alto nível):
- `ecosystem doctor` (ou equivalente) retorna sem blockers críticos para um ambiente de teste.
- O arquivo `.agent_state.json` é lido/escrito durante o pipeline (ANALYSIS → EXECUTION → VERIFICATION).
- DNAs são carregadas pelo `DNALoader` sem erros de schema e ao menos 3 cenários de roteamento são resolvidos pelo `SkillEngine`.
- Handoff sequence conclui (pending → accepted → in_progress → completed) para um cenário end-to-end (ex.: "Implement payment module").

Cenários de Teste Prioritários:
1. Doctor clean run
   - Entrada: ambiente de dev com DNAs em `dnas/` e `templates/.agent_state.json.example` copiado para `.agent_state.json`.
   - Comando esperado: `npx @behavioros/cli enforce doctor` (ou `npx @behavioros/cli ecosystem doctor`).
   - Critério: saída com `status: OK` e sem `CRITICAL` blockers.

2. Fluxo simples de handoff
   - Entrada: DNA definindo agente `payments-specialist` e um task "Create Prisma schema".
   - Resultado esperado: `SkillRouter` roteia para `database-agent` e handoff passa para `backend-agent` sem perda de contexto.

3. Falha de adapter e fallback
   - Entrada: simular falha no `AITMPLAdapter` (mock) e verificar fallback para outro source.
   - Critério: fallback automático registrado no `handoff` e `pipeline_history` com motivo.

Artefatos de evidência (PoV):
- Logs do `ecosystem doctor` (JSON/MD).
- Um `report.md` com status de cada cenário (pass/fail) e trechos de logs.
- `templates/.agent_state.json.example` copiado para `.agent_state.json` com pipeline_history preenchido 
  (apenas para demonstração, pode conter dados fictícios de execução do PoV).

Observações: este documento descreve o que deve ser reproduzido pela equipa. Não executa comandos automaticamente — fornece os passos e a evidência esperada.

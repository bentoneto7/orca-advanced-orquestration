# orca-skills

Equipe de seis IAs trabalhando juntas no [Orca](https://github.com/stablyai/orca), com gestão de créditos: antes de cada onda, a skill lê a cota real de cada IA e dá mais trabalho a quem tem mais folga. **Claude**, **Codex**, **Cursor**, **Grok**, **Antigravity** e **Muse** dividem a tarefa em ondas paralelas, com expansão de subagentes. Qualquer uma pode coordenar ou ser subagente.

**Tutorial completo, do passo 1 até a configuração concluída: [docs/TUTORIAL.md](docs/TUTORIAL.md).**

**Entenda a ideia completa, a dinâmica e por que é mais eficiente: [docs/IDEIA.md](docs/IDEIA.md).**

## Principais benefícios

![Dinâmica da equipe](docs/img/dinamica.png)

- **Seis IAs em paralelo.** Claude, Codex, Cursor, Grok, Antigravity e Muse trabalham ao mesmo tempo, cada uma na própria worktree, em ondas com dependências.
- **Revisão cruzada sem viés.** Toda entrega é revisada por uma IA de outro fornecedor, que não sabe quem fez.
- **Gestão de créditos com balanço saudável.** A cota real de cada IA é lida antes de cada onda, sem gastar tokens. Quem tem mais folga recebe mais trabalho, quem está adiantado no consumo da janela recebe menos, e Claude e Codex guardam 15% para revisão crítica.
- **Redistribuição automática.** Se uma IA bate o limite no meio do trabalho, a tarefa passa na hora para a próxima com folga, e a IA sem cota fica de fora até o reset.
- **Autonomia total com limites fixos.** Os agentes executam sem pedir aprovação. Merge na main, deploy, produção, dados reais e segredos ficam prontos, mas listados em "Pendente de aprovação" para você decidir.
- **Economia de tokens.** Respostas de até 15 linhas, handoffs curtos e o modelo mais barato que resolve cada tarefa.
- **Instaladores para macOS, Linux e Windows.** Um comando instala e confere tudo em todas as IAs.

![Benefícios](docs/img/beneficios.png)

![Gestão de créditos](docs/img/gestao-de-creditos.png)

## Travas de segurança

Autonomia total, com travas fixas. As IAs executam sozinhas e obedecem ao coordenador, mas 7 ações nenhuma executa, nem com ordem: merge ou push na main, deploy, ação em produção, apagar ou alterar dados reais, migração em banco real, segredos e apagar arquivos fora da worktree. Nesses pontos a IA deixa pronto (branch, PR, comando) e lista em "Pendente de aprovação", e você aprova tudo num só lugar no fim. A mesma regra vai para todas as IAs. Detalhes em [docs/IDEIA.md](docs/IDEIA.md#travas-de-segurança-autonomia-total-com-travas-fixas).

![Travas de segurança](docs/img/travas.png)

## Como fica no Orca

Print real do Orca rodando a `/orquestration` (recortado) e a leitura de cotas feita antes de cada onda, sem gastar tokens. Mais prints e o formato do plano e do relatório em [docs/IDEIA.md](docs/IDEIA.md).

![Print real do Orca rodando a /orquestration](docs/img/print-orca-real.png)

![Saída real do cotas.mjs](docs/img/print-cotas.png)

## Instalação rápida

Com o Orca e as CLIs já instalados e logados:

**macOS / Linux**

```bash
git clone https://github.com/bentoneto7/orca-skills.git
cd orca-skills
bash scripts/instalar.sh
bash scripts/instalar.sh --verificar
```

**Windows**

```powershell
gh repo clone bentoneto7/orca-skills
cd orca-skills
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\instalar.ps1 -Verificar
```

Depois, no Orca: **Settings > Agents > Refresh** e abra uma sessão nova de cada agente.

## O que tem aqui

| Caminho | O que é |
|---|---|
| `skills/orquestration/` | Regras da equipe: gestão de créditos pela cota real, papel de cada IA, board, revisão cruzada entre fornecedores, autonomia com limites fixos e execução em paralelo (até 6 workers). |
| `skills/orquestration/cotas.mjs` | Lê a cota de cada IA (`orca account list --json`, sem gastar tokens) e imprime a linha `Cotas` com uso, ritmo, reset e a parte de cada IA. |
| `skills/orchestration/` | A skill oficial de orquestração do Orca, com a seção "Equipe Zuuuw" no fim, que carrega a `orquestration`. |
| `config/equipe-orca.md` | Regras de como cada IA recebe e responde as chamadas do coordenador. O script grava esse texto nas instruções globais de cada IA. |
| `config/grok-rules-orca-equipe.md` | As mesmas regras no formato do Grok (`~/.grok/rules/`). |
| `config/cursor-rules-orca-equipe.mdc` | As mesmas regras no formato do Cursor (`~/.cursor/rules/`). |
| `config/grok-config.toml.example` | Trecho sugerido para o `~/.grok/config.toml`. |
| `config/orchestration-hook.md` | A seção "Equipe Zuuuw" que o script acrescenta na skill do Orca. |
| `scripts/instalar.sh` | Instala tudo em todas as IAs no macOS/Linux (`--verificar` só confere). |
| `scripts/instalar.ps1` | O mesmo no Windows (`-Verificar` só confere). |

## Uso

Numa sessão do Claude ou do Codex aberta pelo Orca:

```
/orquestration <o que precisa ser feito>
```

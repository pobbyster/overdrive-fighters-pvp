# Overdrive Fighters — servidor PvP

Este pacote contém o servidor Node.js e a edição web do jogo, incluindo editor de baralhos. Não é necessário executar o aplicativo Windows para hospedar ou jogar.

## Testar o pacote

Com Node.js 22 ou superior, nesta pasta:

```sh
npm ci --omit=dev --ignore-scripts
npm test
npm start
```

Abra `http://127.0.0.1:4310/arena.html?pvp`. O endpoint `/pvp-health` retorna `{"protocol":1,"status":"ok"}`. Em hospedagem, o processo atende em `0.0.0.0` e usa a variável `PORT` fornecida pela plataforma. HTTP e WebSocket compartilham a porta.

## Publicar no Render

1. Envie **o conteúdo desta pasta** a um repositório Git de sua conta (preferencialmente privado). A raiz deve conter `package.json`, `package-lock.json`, `render.yaml`, `pvp/`, `work/` e `desktop/site/`.
2. Conecte esse repositório no Render. Crie um Blueprint usando `render.yaml`, ou um Web Service Node com os parâmetros abaixo.
3. Build: `npm ci --omit=dev --ignore-scripts`; start: `npm start`; health check: `/pvp-health`.
4. Use uma única instância. O blueprint configura o plano gratuito, sem banco ou disco pagos. Não ative escala horizontal: o arquivo privado de salas é mantido por um único processo.
5. Após o deploy, abra `https://SEU-SERVICO.onrender.com/arena.html?pvp`. O servidor padrão do jogo permanece `wss://overdrive-fighters-pvp.onrender.com/pvp`. Para outro host, informe explicitamente `wss://SEU-SERVICO.onrender.com/pvp` no campo Servidor.
6. Valide duas sessões no endereço público: criar/entrar, confirmar decks, jogar e recarregar uma aba para verificar a reconexão.

O plano gratuito tem limitações de disponibilidade e pode suspender o processo por inatividade. As salas agora são gravadas em `.data/pvp-rooms.json`; a recuperação só funciona enquanto esse arquivo for preservado. Em hospedagem com disco temporário, deploys ou substituição do disco ainda podem apagar os dados. Para uso contínuo, avaliar um plano sempre ativo e persistência antes de oferecer partidas competitivas. O pacote **não** contrata nem cria recursos por conta própria.

O estado da aplicação é privado por jogador: o servidor não transmite mão, baralho embaralhado ou cartas Extras ocultas do adversário. Use o código da sala para convidar; o token de reconexão fica privado na aba. HTTPS/WSS deve ser mantido no endereço público.

## Baralhos dos jogadores

O seletor da Arena lê a mesma biblioteca do editor no endereço atual. Ao voltar do editor, a lista é atualizada. Os jogadores podem criar seus decks nesse editor ou usar **Importar baralho JSON** diretamente na Arena.

Listas criadas no aplicativo Windows ou em outro domínio/porta não aparecem automaticamente em outro endereço: exporte o JSON no editor de origem e importe no PvP. A importação salva uma nova lista sem substituir um deck diferente com o mesmo nome. Decks continuam sujeitos às regras de quantidade, cores e scripts disponíveis.

## Persistência e configuração opcional

`OFS_PVP_STATE_FILE` define o caminho privado do arquivo de salas, fora de `desktop/site`. Use armazenamento persistente para garantir recuperação entre deploys. Arquivo corrompido ou de outra revisão bloqueia a inicialização e permanece intacto. Mantenha também a cópia `.bak`. Não publique esses arquivos: contêm credenciais.

`OFS_PVP_LOBBY_SECONDS` define a expiração de salas de espera (1800 por padrão). `OFS_PVP_DECISION_SECONDS` ativa relógio por decisão, desativado por padrão (0). Quando ativo, o prazo aparece na interface; desconexão pausa o relógio e a reconexão dos dois jogadores o reinicia.

- `PORT`: porta da plataforma; não precisa ser definida manualmente no Render.
- `OFS_PVP_HOST`: `0.0.0.0` em hospedagem (já configurado).
- `OFS_PVP_ORIGINS`: origens adicionais autorizadas, separadas por vírgula, quando a interface estiver em outro domínio. Não use `*`.
- `RENDER_EXTERNAL_URL`: reconhecida automaticamente quando fornecida pelo Render.

Esta versão suporta Standard (3 energias, melhor de três), Advanced (5 energias, melhor de três) e Deathmatch (7 energias, um duelo). Standard/Advanced permitem side deck entre duelos; Deathmatch permite trocas antes da abertura. Não inclui contas, ranking, chat ou armazenamento distribuído. Há recuperação após reinício quando o arquivo privado permanece disponível.

Referências: [WebSocket no Render](https://render.com/docs/websocket), [Web Services](https://render.com/docs/web-services), [Blueprint](https://render.com/docs/blueprint-spec), [limites do plano gratuito](https://render.com/docs/free).

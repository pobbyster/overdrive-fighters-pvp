# Overdrive Fighters — First Drive

## Redes sociais, apoio e treino

Preencha community-config.js com os links oficiais de Discord, YouTube, Instagram, Facebook e Twitter. A lista support recebe objetos com label e url para os links do botão APOIE. Endereços vazios exibem “em breve”; não há redirecionamento para páginas fictícias.

O Treino permite selecionar Hanma, Len Yin, Boydd e Blossom com as artes PNG fornecidas. A seleção usa um baralho de treino de 40 cartas, sem substituir o rascunho ou as listas salvas no deckbuilder. “Usar meu baralho” retorna à lista atual.

Site responsivo reconstruído a partir de Overdrive-Fighters-Manual.html.

Abra index.html para uso local. Para servir por HTTP, execute `node servir-site.cjs` na pasta do projeto e acesse http://127.0.0.1:4173.

Mantém catálogo de 107 cartas, filtros e zoom, construção e biblioteca de baralhos, curva de custos, importação/exportação JSON, decklist/PDF, Print & Play A4, simulador de mão, mesa manual de dois lados, menus de ações, movimentação por toque ou arraste, vida, Overdrive, energias, mulligan, pilhas, ajuste de combate, desfazer, registro/anotações e guias originais.

A mesa é manual, conforme o arquivo fornecido. As regras e efeitos não são aplicados automaticamente. Os baralhos e a mesa são salvos neste navegador. Uma origem diferente não acessa os dados salvos na origem anterior; use exportação/importação de baralhos para transferir as listas.

As artes e documentos do criador foram preservados. Os scripts de comportamento foram reaproveitados; a estrutura foi modularizada e o visual reconstruído em overdrive.css. legacy.css preserva os estilos funcionais e a impressão original.

Arquivos necessários para hospedar: todo o conteúdo desta pasta, incluindo assets. Não publique os arquivos de partida privada do projeto anterior.

## Torneios

A aba Torneios exige o servidor Node (`node servir-site.cjs`), junto a tournament-api.cjs e work/catalog.json. Permite criar/agendar eventos, abrir/encerrar inscrições, enviar decklists JSON ou o baralho atual, e baixar as inscrições/decklists no painel do organizador.

Na primeira execução, o servidor cria dados-torneios/chave-organizador.txt. Copie essa chave para o campo do organizador. Mantenha a pasta dados-torneios privada e faça cópias de segurança: ela contém a chave, eventos e inscrições. Ela não deve ficar na pasta pública site.

Os horários seguem America/Fortaleza (UTC−3). O servidor atual atende somente neste computador. Para receber inscrições de outros dispositivos pela internet, publique o frontend e este backend em hospedagem com Node e armazenamento persistente; publicar só a pasta site não ativa os torneios.

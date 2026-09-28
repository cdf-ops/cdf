# Atualização — Integração Clube do Frio, n8n e Brevo

Concluímos a primeira etapa da integração da plataforma Clube do Frio com o n8n e a Brevo.

Nesta fase, foi preparada toda a estrutura necessária para automatizar os e-mails de confirmação de inscrição dos eventos.

## Funcionamento previsto

1. Quando uma pessoa se inscrever em um evento, a plataforma criará uma solicitação de envio em uma fila segura.
2. O n8n consultará essa fila e verificará o contato na Brevo.
3. Caso o contato ainda não exista, ele será criado. Caso já exista, seus dados permanentes serão atualizados.
4. A Brevo enviará o modelo de e-mail associado ao evento.
5. A plataforma receberá da Brevo as atualizações de entrega, falhas, bloqueios, descadastros e outros estados relevantes.

## Configuração por evento

Foi criada uma área específica da Brevo dentro de cada evento, permitindo:

- Atualizar a lista de modelos disponíveis na Brevo.
- Selecionar qual modelo será utilizado naquele evento.
- Ativar ou desativar o envio automático.
- Acompanhar os e-mails processados e seus respectivos status.
- Identificar falhas e permitir futuras rotinas de reenvio.

## Responsabilidades da plataforma e do marketing

Por decisão de escopo, as informações específicas do evento — nome, data, local, imagens e demais conteúdos — continuarão configuradas diretamente no modelo da Brevo pelo marketing.

A plataforma enviará apenas os atributos permanentes do contato:

- E-mail
- Nome completo
- Número do participante
- Cidade
- Estado
- Profissão

Essa divisão reduz a complexidade da plataforma e permite que o marketing mantenha o conteúdo e a identidade visual dos e-mails diretamente na Brevo.

## Segurança e integração

A comunicação entre a plataforma e o n8n foi protegida por autenticação. O webhook da Brevo também foi configurado para informar à plataforma o resultado dos envios.

Essa configuração foi realizada utilizando a conexão já existente no n8n, sem necessidade de acesso direto à conta da Brevo.

## Situação atual

- Plataforma atualizada em produção.
- Banco de dados preparado para controlar a fila e o histórico dos envios.
- Integração com o n8n configurada.
- Catálogo de modelos da Brevo funcionando.
- Webhook de acompanhamento da Brevo funcionando.
- Credenciais e conexões protegidas.
- Worker de envio ainda desativado por segurança.
- Nenhum e-mail real foi enviado até o momento.

## Próxima etapa

O próximo passo será realizar um teste controlado:

1. Atualizar os modelos disponíveis.
2. Selecionar um modelo em um evento de teste.
3. Realizar uma inscrição com um e-mail de teste.
4. Ativar temporariamente o processamento.
5. Acompanhar todo o fluxo, desde a inscrição até a confirmação de entrega.
6. Validar os dados recebidos pela Brevo e o conteúdo final do e-mail.

Após essa validação, o processamento automático poderá ser ativado definitivamente para os eventos escolhidos.

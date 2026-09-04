# Portal MRP BEAS - Scheduler 🚀

O **Portal MRP BEAS** é uma solução web corporativa que permite agendar e gerenciar execuções de cenários MRP (Material Requirements Planning) do add-on BEAS para SAP Business One. 

A aplicação fornece um painel de controle construído com **SAP UI5**, autêntica os usuários pelo **SAP Service Layer**, persiste as configurações no banco de dados **SAP HANA**, e roda em segundo plano através de um serviço do Windows.

---

## ⚙️ Como Funciona (Arquitetura)

O sistema é dividido em três pilares principais que se comunicam para automatizar o MRP:

1. **Frontend (Interface do Usuário):**
   - Construído com o framework **SAP UI5 / Fiori**, garantindo uma interface rica, responsiva e alinhada com os padrões estéticos do ecossistema SAP.
   - Possui uma tela de autenticação moderna que valida as credenciais do usuário diretamente contra a API oficial do SAP B1 (Service Layer).
   - Permite listar os cenários de MRP disponíveis, criar agendamentos selecionando os dias da semana e horários, além de permitir disparar a execução de um MRP manualmente na hora (botão "Rodar Agora").

2. **Backend (Serviço Node.js):**
   - O coração do sistema. Desenvolvido em **Node.js** com `Express`.
   - **Agendador (`node-cron`):** Um motor de tempo que roda em background monitorando continuamente a tabela de agendamentos. Quando o relógio bate com um horário agendado, o Node.js aciona o processo sem necessidade de intervenção humana.
   - **Execução do BEAS:** O backend invoca o BEAS nativamente pelo Windows (via CLI do `beas.exe`), enviando parâmetros e um XML gerado dinamicamente com as credenciais, o banco de dados e o ID do cenário que precisa ser rodado.

3. **Banco de Dados (SAP HANA):**
   - O Node.js se conecta diretamente ao HANA (via `@sap/hana-client`).
   - Todos os agendamentos feitos pela tela web são gravados em uma tabela customizada chamada `SPS_MRP_SCHEDULES` (criada automaticamente pelo sistema se não existir).
   - Os cenários de MRP listados no portal são buscados ativamente de dentro das tabelas oficiais do BEAS no HANA.

---

## 🛠️ Tecnologias Utilizadas

- **Node.js** (Backend, Cron Jobs, Child Processes)
- **SAP UI5 / Fiori** (Frontend Web)
- **SAP Service Layer** (Autenticação e Sessão)
- **SAP HANA Client** (Comunicação com o banco)
- **node-windows** (Instalação como serviço em background)

---

## 📌 Pré-requisitos

- Node.js (Versão 18+)
- SAP HANA Client instalado e configurado no servidor.
- O BEAS deve estar instalado no servidor na rota padrão: `C:\Program Files\beas software\beas`.
- Serviço do Service Layer (SL) rodando e acessível.

---

## 🚀 Instalação e Configuração

### 1. Preparando o Ambiente
Clone este repositório no seu servidor (em uma pasta local como `C:\SPS\mrp\mrpService` para evitar problemas de restrição de rede no Windows).

Navegue até a pasta e instale as dependências:
```bash
npm install
```

### 2. Variáveis de Ambiente (.env)
Crie ou edite o arquivo `.env` na raiz do projeto contendo as conexões do seu ambiente:

```env
BACKEND_PORT=9110
DBTYPE=HANA
DB_SERVER=SEU_SERVIDOR_HANA:30015
SL_URL=https://seu_servidor_sl:50000/b1s/v1
DB_NAME=SBO_COBRA_PRD
DB_USERNAME=B1ADMIN
DB_PASSWORD=senha_do_banco
NDB=NDB@seu_servidor_hana:30013
SAP_USERCODE=manager
SAP_PASSWORD=senha_do_sap
SERVICE_NAME=sps_beas_mrp_scheduler_prd
```

### 3. Rodando como Serviço do Windows (Recomendado)
Para que o MRP rode de madrugada ou com o servidor bloqueado, a aplicação deve rodar como um **Serviço do Windows**.

> ⚠️ **Atenção:** Devido a políticas de segurança do Windows (WMI), você **não pode** instalar o serviço através de um mapeamento de rede (UNC Path como `\\10.86...`). Abra o CMD na máquina real acessando o caminho físico (`C:\...`).

Abra um terminal (como Administrador) e rode:
```bash
node install-service.js
```
O serviço será instalado com o nome definido no `SERVICE_NAME` e iniciado automaticamente em background.
(Para desinstalar, basta rodar `node uninstall-service.js`).

### 4. Executando para Testes (Modo Dev)
Caso queira subir o serviço manualmente no terminal apenas para visualizar o log em tempo real:
```bash
npm start
```

---

## 🖥️ Utilização

1. Acesse `http://localhost:9110` (ou o IP do seu servidor).
2. Entre com o seu **Usuário e Senha do SAP**.
3. Na listagem, clique em **Adicionar** para programar os dias da semana e horários em que um Cenário MRP deve ser executado.
4. Para forçar a execução imediata de um cenário, clique no botão de "Play" (Rodar Agora).
5. O sistema criará o agendamento no HANA e o backend cuidará do resto!

---
*Desenvolvido sob medida para a automação de rotinas industriais e logísticas no SAP Business One / BEAS.*

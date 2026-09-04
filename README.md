# BEAS MRP Scheduler

Serviço de backend em Node.js com frontend baseado no framework SAP UI5 (Fiori) para criar e gerenciar agendamentos de cenários MRP do BEAS. 
A aplicação se conecta diretamente com a base do SAP HANA para listar os cenários dinamicamente e os executa de forma programada em segundo plano.

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/en/) (Versão 18 ou superior recomendada)
- O BEAS deve estar instalado no servidor na rota padrão: `C:\Program Files\beas software\beas` (ou deve ser modificado no código fonte caso seja diferente)
- SAP HANA Client

## ⚙️ Instalação

Siga os passos abaixo para baixar e rodar o projeto em seu ambiente:

1. **Clone o repositório:**
```bash
git clone https://github.com/thierryrs1/BEAS_MRP_Scheduler.git
cd BEAS_MRP_Scheduler
```

2. **Instale as dependências Node.js:**
```bash
npm install
```

3. **Configure as Variáveis de Ambiente:**
Verifique o arquivo `.env` localizado na raiz do projeto (crie-o se não existir) e garanta que as informações batem com a sua base de produção ou teste.

Exemplo do `.env`:
```env
BACKEND_PORT=9110
FRONTEND_PORT=9111
DBTYPE=HANA
DB_SERVER=SEU_SERVIDOR_HANA:30015
DB_NAME=SUA_BASE_SBO
DB_USERNAME=SEU_USUARIO_DB
DB_PASSWORD=SUA_SENHA_DB
NDB=NDB@SEU_SERVIDOR_BEAS:30013
SAP_USERCODE=SEU_USUARIO_SAP
SAP_PASSWORD=SUA_SENHA_SAP
```

4. **Inicie o serviço:**
```bash
npm start
```
*(Para ambiente de desenvolvimento, você pode usar `npm run dev` se possuir o nodemon instalado).*

## 🚀 Uso

- Com o serviço ativo, abra o seu navegador de preferência.
- Acesse a interface web do portal através do endereço: `http://localhost:9110` (A porta dependerá do valor setado no `BACKEND_PORT` do arquivo `.env`).
- Utilize a interface web para listar seus cenários SAP e criar os seus agendamentos! 
- Os logs da execução do MRP serão exibidos tanto no console da sua aplicação (`app.js`) quanto no arquivo nativo de log caso esteja configurado no BEAS.

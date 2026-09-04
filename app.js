require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { exec } = require('child_process');
const hanaClient = require('@sap/hana-client');
const path = require('path');
const https = require('https');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignorar erro de certificado self-signed do SL

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let schedules = [];
let activeJobs = {};

const connOptions = {
    serverNode: process.env.DB_SERVER,
    uid: process.env.DB_USERNAME,
    pwd: process.env.DB_PASSWORD,
    currentSchema: process.env.DB_NAME
};

const schema = process.env.DB_NAME;

// Função auxiliar para executar SQL
function executeSql(sql, params, callback) {
    const conn = hanaClient.createConnection();
    conn.connect(connOptions, (err) => {
        if (err) return callback(err);
        conn.exec(sql, params, (err, result) => {
            conn.disconnect();
            callback(err, result);
        });
    });
}

function executeMrp(scenarioId) {
    let scriptContent = "";
    if (scenarioId === "ALL") {
        scriptContent = "object=ue_mrp=server";
    } else {
        scriptContent = `object=ue_mrp=calc=${scenarioId}`;
    }

    const beasPath = "C:\\Program Files\\beas software\\beas";
    const server = process.env.NDB;
    const db = process.env.DB_NAME;
    const user = process.env.SAP_USERCODE;
    const pw = process.env.SAP_PASSWORD;

    const cmd = `cd /d "${beasPath}" && start /wait "" beas.exe server=${server} db=${db} user=${user} pw=${pw} /inservermode script="<cr_lf>${scriptContent}<cr_lf>app=close<cr_lf>"`;

    const now = new Date().toLocaleString('pt-BR');
    console.log(`[${now}] Executando MRP: Cenário ${scenarioId}`);

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`[${now}] Erro ao executar MRP: ${error.message}`);
            return;
        }
        console.log(`[${now}] MRP Finalizado. ${stdout}`);
    });
}

// REST APIs
app.get('/api/config', (req, res) => {
    res.json({ dbName: process.env.DB_NAME });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!process.env.SL_URL) {
        return res.status(500).json({ success: false, error: 'URL do Service Layer não configurada' });
    }

    const data = JSON.stringify({
        CompanyDB: process.env.DB_NAME,
        UserName: username,
        Password: password
    });
    
    const slUrl = new URL(process.env.SL_URL + "/Login");
    
    const options = {
        hostname: slUrl.hostname,
        port: slUrl.port || 443,
        path: slUrl.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        },
        rejectUnauthorized: false
    };
    
    const request = https.request(options, (response) => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                try {
                    const parsed = JSON.parse(body);
                    res.json({ success: true, SessionId: parsed.SessionId });
                } catch(e) {
                    res.json({ success: true });
                }
            } else {
                res.status(401).json({ success: false, error: 'Usuário ou senha inválidos' });
            }
        });
    });
    
    request.on('error', (err) => {
        console.error('Erro de conexão com Service Layer:', err);
        res.status(500).json({ success: false, error: 'Erro ao conectar ao Service Layer' });
    });
    
    request.write(data);
    request.end();
});

app.get('/api/schedules', (req, res) => {
    res.json(schedules);
});

app.post('/api/schedules', (req, res) => {
    const { scenarioId, cronExpression, scenarioName } = req.body;

    if (!cron.validate(cronExpression)) {
        return res.status(400).json({ error: "Expressão Cron inválida" });
    }

    const id = Date.now().toString();
    const newSchedule = { id, scenarioId, scenarioName, cronExpression };

    const sql = `INSERT INTO "${schema}"."SPS_MRP_SCHEDULES" ("ID", "SCENARIO_ID", "SCENARIO_NAME", "CRON_EXPRESSION") VALUES (?, ?, ?, ?)`;
    executeSql(sql, [id, scenarioId, scenarioName, cronExpression], (err) => {
        if (err) {
            console.error("Erro ao inserir no HANA:", err);
            return res.status(500).json({ error: "Erro ao salvar no banco" });
        }

        schedules.push(newSchedule);
        activeJobs[id] = cron.schedule(cronExpression, () => {
            executeMrp(scenarioId);
        });

        res.status(201).json(newSchedule);
    });
});

app.put('/api/schedules/:id', (req, res) => {
    const { id } = req.params;
    const { scenarioId, cronExpression, scenarioName } = req.body;

    if (!cron.validate(cronExpression)) {
        return res.status(400).json({ error: "Expressão Cron inválida" });
    }

    const index = schedules.findIndex(s => s.id === id);
    if (index !== -1) {
        const sql = `UPDATE "${schema}"."SPS_MRP_SCHEDULES" SET "SCENARIO_ID" = ?, "SCENARIO_NAME" = ?, "CRON_EXPRESSION" = ? WHERE "ID" = ?`;
        executeSql(sql, [scenarioId, scenarioName, cronExpression, id], (err) => {
            if (err) {
                console.error("Erro ao atualizar no HANA:", err);
                return res.status(500).json({ error: "Erro ao atualizar no banco" });
            }

            schedules[index] = { id, scenarioId, scenarioName, cronExpression };

            if (activeJobs[id]) {
                activeJobs[id].stop();
            }
            activeJobs[id] = cron.schedule(cronExpression, () => {
                executeMrp(scenarioId);
            });

            res.status(200).json(schedules[index]);
        });
    } else {
        res.status(404).json({ error: "Agendamento não encontrado" });
    }
});

app.delete('/api/schedules/:id', (req, res) => {
    const { id } = req.params;
    const index = schedules.findIndex(s => s.id === id);

    if (index !== -1) {
        const sql = `DELETE FROM "${schema}"."SPS_MRP_SCHEDULES" WHERE "ID" = ?`;
        executeSql(sql, [id], (err) => {
            if (err) {
                console.error("Erro ao deletar no HANA:", err);
                return res.status(500).json({ error: "Erro ao remover do banco" });
            }

            if (activeJobs[id]) {
                activeJobs[id].stop();
                delete activeJobs[id];
            }
            schedules.splice(index, 1);
            res.status(200).json({ message: "Agendamento removido" });
        });
    } else {
        res.status(404).json({ error: "Agendamento não encontrado" });
    }
});

app.post('/api/schedules/:id/run', (req, res) => {
    const { id } = req.params;
    const schedule = schedules.find(s => s.id === id);
    if (schedule) {
        executeMrp(schedule.scenarioId);
        res.status(200).json({ message: "Execução iniciada em background" });
    } else {
        res.status(404).json({ error: "Agendamento não encontrado" });
    }
});

app.get('/api/scenarios', (req, res) => {
    const sql = `SELECT "NR", "BEZEICHNUNG" FROM "${schema}"."BEAS_MRP_PLANUNG" ORDER BY 1`;
    executeSql(sql, [], (err, rows) => {
        if (err) {
            console.error('Erro ao consultar cenários:', err);
            return res.status(500).json({ error: 'Erro ao consultar cenários MRP' });
        }
        res.json(rows);
    });
});

// Inicialização do Banco de Dados e Carga dos Agendamentos
function initDBAndStart() {
    const checkTableSql = `SELECT COUNT(*) AS "count" FROM "TABLES" WHERE "SCHEMA_NAME" = '${schema}' AND "TABLE_NAME" = 'SPS_MRP_SCHEDULES'`;
    executeSql(checkTableSql, [], (err, result) => {
        if (err) {
            console.error("Erro ao verificar tabela:", err);
            process.exit(1);
        }

        const count = result[0].count;
        if (count === 0) {
            const createTableSql = `
                CREATE TABLE "${schema}"."SPS_MRP_SCHEDULES" (
                    "ID" NVARCHAR(50) PRIMARY KEY,
                    "SCENARIO_ID" NVARCHAR(50),
                    "SCENARIO_NAME" NVARCHAR(200),
                    "CRON_EXPRESSION" NVARCHAR(50)
                )
            `;
            executeSql(createTableSql, [], (createErr) => {
                if (createErr) {
                    console.error("Erro ao criar tabela SPS_MRP_SCHEDULES:", createErr);
                    process.exit(1);
                }
                console.log("Tabela SPS_MRP_SCHEDULES criada com sucesso.");
                startServer();
            });
        } else {
            console.log("Tabela SPS_MRP_SCHEDULES já existe. Carregando agendamentos...");
            loadSchedulesFromDB();
        }
    });
}

function loadSchedulesFromDB() {
    const sql = `SELECT "ID", "SCENARIO_ID", "SCENARIO_NAME", "CRON_EXPRESSION" FROM "${schema}"."SPS_MRP_SCHEDULES"`;
    executeSql(sql, [], (err, rows) => {
        if (err) {
            console.error("Erro ao carregar agendamentos:", err);
            process.exit(1);
        }

        rows.forEach(row => {
            const id = row.ID;
            const scenarioId = row.SCENARIO_ID;
            const scenarioName = row.SCENARIO_NAME;
            const cronExpression = row.CRON_EXPRESSION;

            schedules.push({ id, scenarioId, scenarioName, cronExpression });
            activeJobs[id] = cron.schedule(cronExpression, () => {
                executeMrp(scenarioId);
            });
        });

        console.log(`Carregados ${rows.length} agendamentos ativos do HANA.`);
        startServer();
    });
}

function startServer() {
    const port = process.env.BACKEND_PORT || 9110;
    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}

// Inicia o processo
initDBAndStart();

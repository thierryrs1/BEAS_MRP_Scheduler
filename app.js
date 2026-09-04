require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { exec } = require('child_process');
const hanaClient = require('@sap/hana-client');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Array em memória para manter os agendamentos no MVP
let schedules = [];
let activeJobs = {};

const connOptions = {
    serverNode: process.env.DB_SERVER,
    uid: process.env.DB_USERNAME,
    pwd: process.env.DB_PASSWORD,
    currentSchema: process.env.DB_NAME // changed from databaseName to currentSchema for SAP B1
};

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
    schedules.push(newSchedule);

    const job = cron.schedule(cronExpression, () => {
        executeMrp(scenarioId);
    });
    
    activeJobs[id] = job;
    res.status(201).json(newSchedule);
});

app.delete('/api/schedules/:id', (req, res) => {
    const { id } = req.params;
    const index = schedules.findIndex(s => s.id === id);
    if (index !== -1) {
        if (activeJobs[id]) {
            activeJobs[id].stop();
            delete activeJobs[id];
        }
        schedules.splice(index, 1);
        res.status(200).json({ message: "Agendamento removido" });
    } else {
        res.status(404).json({ error: "Agendamento não encontrado" });
    }
});

app.get('/api/scenarios', (req, res) => {
    const conn = hanaClient.createConnection();
    conn.connect(connOptions, (err) => {
        if (err) {
            console.error('Erro de conexão HANA:', err);
            return res.status(500).json({ error: 'Erro de conexão com o banco de dados' });
        }
        
        // Add DB_NAME dynamically as schema to avoid schema errors
        const schema = process.env.DB_NAME;
        const sql = `SELECT "NR", "BEZEICHNUNG" FROM "${schema}"."BEAS_MRP_PLANUNG" ORDER BY 1`;
        
        conn.exec(sql, (err, rows) => {
            conn.disconnect();
            if (err) {
                console.error('Erro ao consultar cenários:', err);
                return res.status(500).json({ error: 'Erro ao consultar cenários MRP' });
            }
            res.json(rows);
        });
    });
});

const port = process.env.BACKEND_PORT || 9110;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});

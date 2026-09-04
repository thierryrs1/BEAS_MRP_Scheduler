require('dotenv').config({ path: require('path').join(__dirname, '.env') });
var Service = require('node-windows').Service;
var path = require('path');

var svc = new Service({
  name: process.env.SERVICE_NAME || 'BEAS_MRP_Service',
  description: 'Serviço de Agendamento do BEAS MRP rodando na porta ' + (process.env.BACKEND_PORT || 9110) + '. Integração via Service Layer.',
  script: path.join(__dirname, 'app.js'),
  env: [{
    name: "NODE_ENV",
    value: "production"
  }]
});

svc.on('install', function() {
  svc.start();
  console.log('Serviço "' + svc.name + '" instalado e iniciado com sucesso!');
});

svc.on('alreadyinstalled', function() {
  console.log('Este serviço já está instalado.');
});

svc.install();

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
var Service = require('node-windows').Service;
var path = require('path');

var svc = new Service({
  name: process.env.SERVICE_NAME || 'BEAS_MRP_Service',
  script: path.join(__dirname, 'app.js')
});

svc.on('uninstall', function() {
  console.log('Serviço "' + svc.name + '" desinstalado com sucesso.');
});

svc.uninstall();

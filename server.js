'use strict';

var cluster = require('cluster');

if (cluster.isMaster) {
    require('./app/server/serverMaster.js');
} else {
    require('./app/server/serverWorker.js');
}

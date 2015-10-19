'use strict';

var cluster = require('cluster');

if (cluster.isMaster) {
    require('./app/server/server.master.js');
} else {
    require('./app/server/server.worker.js');
}

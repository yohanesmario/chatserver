'use strict';

var cluster = require('cluster');

if (cluster.isMaster) {
    require('./includes/server/server.master.js');
} else {
    require('./includes/server/server.worker.js');
}

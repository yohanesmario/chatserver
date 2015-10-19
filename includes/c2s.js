'use strict';

var cluster = require('cluster');

if (cluster.isMaster) {
    module.exports = require('./c2s/c2s.master.js');
} else {
    module.exports = require('./c2s/c2s.worker.js');
}

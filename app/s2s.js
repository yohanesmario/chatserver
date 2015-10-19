'use strict';

var cluster = require('cluster');

if (cluster.isMaster) {
    module.exports = require('./s2s/s2s.master.js');
} else {
    module.exports = require('./s2s/s2s.worker.js');
}

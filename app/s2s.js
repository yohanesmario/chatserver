'use strict';

var cluster = require('cluster');

if (cluster.isMaster) {
    module.exports = require('./s2s/s2sMaster.js');
} else {
    module.exports = require('./s2s/s2sWorker.js');
}

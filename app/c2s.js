'use strict';

var cluster = require('cluster');

if (cluster.isMaster) {
    module.exports = require('./c2s/c2sMaster.js');
} else {
    module.exports = require('./c2s/c2sWorker.js');
}

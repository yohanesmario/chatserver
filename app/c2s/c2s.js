'use strict';
var include = require('include');
var cluster = include('cluster');

if (cluster.isMaster) {
    module.exports = include('app.c2s.c2sMaster');
} else {
    module.exports = include('app.c2s.c2sWorker');
}

'use strict';
var include = require('include');
var cluster = include('cluster');

if (cluster.isMaster) {
    module.exports = include('app.s2s.s2sMaster');
} else {
    module.exports = include('app.s2s.s2sWorker');
}

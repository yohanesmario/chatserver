'use strict';

var include = require('include');
var cluster = include('cluster');

if (cluster.isMaster) {
    include('app.server.serverMaster');
} else {
    include('app.server.serverWorker');
}

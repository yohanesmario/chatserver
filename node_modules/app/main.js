'use strict';

var cluster = require('cluster');

if (cluster.isMaster) {
    require('app/server/serverMaster');
} else {
    require('app/server/serverWorker');
}

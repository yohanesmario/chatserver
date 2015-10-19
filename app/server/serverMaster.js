'use strict';
var include = require('include');

// Absolute Dependencies
var cc = include('app.tools.clusterCounter');
var numCPUs = cc.numCPUs;
var numWorkers = cc.numWorkers;

// Environment variables
process.env.UV_THREADPOOL_SIZE = numCPUs; // libuv threadpool size

// Common Dependencies
var cluster = include('cluster');
var logWrapper = include('app.tools.logWrapper');

// APP TITLE
console.log("\nHTTP CHAT SERVER\n");

// Master Dependencies
var cfg = include('app.tools.readArgv').init(process);
var promptWrapper = include('app.tools.promptWrapper');
var s2sClient = include('app.s2s.s2sClient');
var dbWrapper = include('app.tools.dbWrapper').init(cfg);
s2sClient.dbWrapper = dbWrapper;
s2sClient.cfg = cfg;
var processPost = include('app.tools.processPost').init(cfg, dbWrapper, s2sClient);

// Set round-robin cluster scheduling
// cluster.schedulingPolicy = cluster.SCHED_RR;

// Load DB.
dbWrapper.loadDatabase(function(){
    var workerCount = 0;

    var workerStartedCallback = function(){
        workerCount++;
        if (workerCount===numWorkers) {
            if (cfg.serverHook!=null) {
                s2sClient.initConnection(cfg, function(){
                    console.log("\nREADY\n");
                    promptWrapper.startReading(dbWrapper, s2sClient);
                    s2sClient.startHeartbeat();
                });
            } else {
                console.log("\nREADY\n");
                promptWrapper.startReading(dbWrapper, s2sClient);
                s2sClient.startHeartbeat();
            }
        }
    };

    // Fork workers.
    var workerMessageCallback = function(data){
        if (data.messageType!=null) {
            switch (data.messageType) {
                case "c2sMaster": {
                    processPost.c2s.handle(data.payload);
                } break;
                case "s2sMaster": {
                    processPost.s2s.handle(data.payload);
                } break;
                case "workerStarted": {
                    workerStartedCallback();
                } break;
                case "initWorker": {
                    processPost.c2s.initWorker(data.payload.workerID);
                } break;
                case "log": {
                    logWrapper.log(data.payload);
                } break;
            }
        }
    };
    for (var i = 0; i < numWorkers; i++) {
        var worker = cluster.fork();
        worker.on('message', workerMessageCallback);
    }

    cluster.on('exit', function(worker) {
        var newWorker = cluster.fork();
        logWrapper.log('worker ' + worker.id + ' [' + worker.process.pid + '] died.');
        logWrapper.log('worker ' + newWorker.id  + ' [' + newWorker.process.pid + '] created.');
    });
});

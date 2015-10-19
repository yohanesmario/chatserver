'use strict';

// Absolute Dependencies
var cc = require('../clusterCounter.js');
var numCPUs = cc.numCPUs;

// Environment variables
process.env.UV_THREADPOOL_SIZE = numCPUs; // libuv threadpool size

// Common Dependencies
var cluster = require('cluster');
var logWrapper = require('../logWrapper.js');

// Child Dependencies
var http = require('http');
var xml2js = require('xml2js');
var xmlBuilder = new xml2js.Builder();
var cfg = require('../readArgv.js').init(process);
var guiGenerator = require('../guiGenerator.js');
var processPost = require('../processPost.js').init(cfg);

// Create Server
var server = http.createServer(function(request, response) {
    // var ip = request.headers['x-forwarded-for'] ||
    //          request.connection.remoteAddress ||
    //          request.socket.remoteAddress ||
    //          request.connection.socket.remoteAddress;
    // logWrapper.log(ip);
    switch (request.method) {
        case 'POST': {
            processPost.process(request, response);
        } break;
        case 'GET': {
            guiGenerator.handle(request, response);
        } break;
        default: {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"c2s"},
                    "status":["rejected"],
                    "status-code":[12],
                    "message":["Unsupported method."]
                }
            }));
        }
    }
});

// Establish listener.
switch (cfg.ip) {
    case null: {
        server.listen(cfg.port);
        logWrapper.log("Worker "+cluster.worker.id+" > port "+cfg.port);
    } break;
    default: {
        server.listen(cfg.port, cfg.ip);
        logWrapper.log("Worker "+cluster.worker.id+" > address "+cfg.ip+":"+cfg.port);
    } break;
}

process.send({
    messageType:"workerStarted"
}, function(){
    process.send({
        messageType:"initWorker",
        payload:{
            workerID:cluster.worker.id
        }
    });
});

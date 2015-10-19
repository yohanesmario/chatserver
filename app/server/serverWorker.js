'use strict';
var include = require('include');

// Absolute Dependencies
var cc = include('app.tools.clusterCounter');
var numCPUs = cc.numCPUs;

// Environment variables
process.env.UV_THREADPOOL_SIZE = numCPUs; // libuv threadpool size

// Common Dependencies
var cluster = include('cluster');
var logWrapper = include('app.tools.logWrapper');

// Child Dependencies
var http = include('http');
var xml2js = include('xml2js');
var xmlBuilder = new xml2js.Builder();
var cfg = include('app.tools.readArgv').init(process);
var guiGenerator = include('app.tools.guiGenerator');
var processPost = include('app.tools.processPost').init(cfg);

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

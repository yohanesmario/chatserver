// Absolute Dependencies
var cc = require("./includes/clusterCounter.js");
var numCPUs = cc.numCPUs;
var numWorkers = cc.numWorkers;

// Environment variables
process.env.UV_THREADPOOL_SIZE = numCPUs; // libuv threadpool size

// Common Dependencies
var cluster = require('cluster');
var logWrapper = require('./includes/logWrapper.js');

if (cluster.isMaster) {
    // APP TITLE
    console.log("\nHTTP CHAT SERVER\n");

    // Master Dependencies
    var cfg = require('./includes/readArgv.js').init(process);
    var promptWrapper = require('./includes/prompt-wrapper.js');
    var s2sClient = require('./includes/s2sClient.js');
    var dbWrapper = require('./includes/db-wrapper.js').init(cfg);
    s2sClient.dbWrapper = dbWrapper;
    s2sClient.cfg = cfg;
    var processPost = require('./includes/processPost.js').init(cfg, dbWrapper, s2sClient);

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
} else {
    // Child Dependencies
    var http = require('http');
    var xml2js = require('xml2js');
    var xmlBuilder = new xml2js.Builder();
    var cfg = require('./includes/readArgv.js').init(process);
    var guiGenerator = require('./includes/guiGenerator.js');
    var processPost = require('./includes/processPost.js').init(cfg);

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
}

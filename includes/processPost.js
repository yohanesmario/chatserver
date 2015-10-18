var xml2js = require('xml2js');
var cluster = require('cluster');
var async = require('async');
var c2s = require('../includes/c2s.js');
var s2s = require('../includes/s2s.js');
var parseString = xml2js.parseString;
var xmlBuilder = new xml2js.Builder();

var processPost = function (request, response) {
    var queryData = "";

    if(request.method === 'POST') {
        request.on('data', function(data) {
            queryData += data;
            if(queryData.length > 1e6) {
                queryData = "";
                response.writeHead(413, {'Content-Type': 'text/plain'}).end();
                request.connection.destroy();
            }
        });

        request.on('end', function() {
            //request.post = querystring.parse(queryData);
			request.post = queryData;
            parseString(request.post, function (err, data) {
				if (data!=null && data.request!=null && data.request.$!=null && data.request.$.type!=null) {
					switch (data.request.$.type) {
						case 'c2s': {
							// Call c2s dispatcher
							c2s.handle(data.request, response);
						} break;
						case 's2s': {
							// Call s2s dispatcher
							s2s.handle(data.request, response);
						} break;
						default: {
							response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
                            response.end(xmlBuilder.buildObject({
                                response:{
                                    $:{type:"c2s"},
                                    "status":["rejected"],
                                    "status-code":[11],
                                    "message":["Request type not recognized."]
                                }
                            }));
						} break;
					}
				} else {
                    response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
                    response.end(xmlBuilder.buildObject({
                        response:{
                            $:{type:"c2s"},
                            "status":["rejected"],
                            "status-code":[11],
                            "message":["Request type not recognized."]
                        }
                    }));
				}
			});
        });

    } else {
        response.writeHead(405, {'Content-Type': 'text/plain'});
        response.end();
    }
};

module.exports = {};
module.exports.c2s = c2s;
module.exports.s2s = s2s;
module.exports.process = processPost;
module.exports.init = function(cfg, dbWrapper, s2sClient){
    if (cluster.isMaster) {
        c2s.dbWrapper = dbWrapper;
        c2s.cfg = cfg;
        c2s.s2sClient = s2sClient;
        s2s.dbWrapper = dbWrapper;
        s2s.cfg = cfg;
        s2s.s2sClient = s2sClient;
    } else {
        process.on('message', function(data){
            if (data.messageType!=null) {
                switch (data.messageType) {
                    case "c2sWorker": {
                        c2s.dbWrapper.callbackHashTable["c2sWorker"+data.payload.reqID](data.payload);
                    } break;
                    case "s2sWorker": {
                        s2s.dbWrapper.callbackHashTable["s2sWorker"+data.payload.reqID](data.payload);
                    } break;
                    case "flush": {
                        c2s.dbWrapper.chatHistory.length = 0;
                    } break;
                    case "killWorker": {
                        cluster.worker.kill();
                    } break;
                    case "c2sWorkerChatSend": {
                        for (var i = 0; i < data.payload.length; i++) {
                            if (i===0 && c2s.dbWrapper.chatHistory.length===0) {
                                c2s.dbWrapper.chatHistoryFirstID = data.payload[i].$loki;
                            }
                            c2s.dbWrapper.chatHistory.push(data.payload[i]);
                        }
                        for (var key in c2s.dbWrapper.pullRequestHashTable) {
                            var identifier = key;
                            async.setImmediate(c2s.dbWrapper.pullRequestHashTable[identifier].fun);
                        }
                    } break;
                }
            }
        });
        c2s.dbWrapper = {
            chatHistory:[],
            callbackHashTable:{},
            pullRequestHashTable:{},
            chatHistoryFirstID:1
        };
        s2s.dbWrapper = {
            callbackHashTable:{}
        };
        c2s.cfg = cfg;
        s2s.cfg = cfg;
    }
    return module.exports;
};

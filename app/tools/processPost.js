'use strict';

var include = require('include');
var xml2js = include('xml2js');
var cluster = include('cluster');
var c2s = include('app.c2s.c2s');
var s2s = include('app.s2s.s2s');
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
        c2s.cfg = cfg;
        s2s.cfg = cfg;
        c2s.s2sClient = s2sClient;
        s2s.s2sClient = s2sClient;
        c2s.dbWrapper = dbWrapper;
        s2s.dbWrapper = dbWrapper;
    } else {
        c2s.cfg = cfg;
        s2s.cfg = cfg;
        c2s.startListening();
        s2s.startListening();

        process.on('message', function(data){
            if (data.messageType!=null) {
                switch (data.messageType) {
                    case "killWorker": {
                        cluster.worker.kill();
                    } break;
                }
            }
        });
    }
    return module.exports;
};
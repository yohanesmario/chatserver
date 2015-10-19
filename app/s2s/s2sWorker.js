'use strict';

var include = require('include');
var cluster = include('cluster');
var crypto = include('crypto');
var sha512 = null;
var xml2js = include('xml2js');
var xmlBuilder = new xml2js.Builder();

var s2sObj = {
    callbackHashTable:{},
    cfg:null,
    s2sClient:null,

	handle: function(request, response){
        var method = request.method[0];
		switch(method) {
            case 'registrasiServer': {
                s2sObj.registrasiServer(request, response);
            } break;
            case 'loginServer': {
                s2sObj.loginServer(request, response);
            } break;
            case 'registrasiClient': {
                s2sObj.registrasiClient(request, response);
            } break;
            case 'loginClient': {
                s2sObj.loginClient(request, response);
            } break;
            case 'chatSendClient': {
                s2sObj.chatSendClient(request, response);
            } break;
            case 'logoutClient': {
                s2sObj.logoutClient(request, response);
            } break;
            case 'logoutServer': {
                s2sObj.logoutServer(request, response);
            } break;
            case 'serverHeartbeat': {
                s2sObj.serverHeartbeat(request, response);
            } break;
            case 'listRegisteredServer': {
                s2sObj.listRegisteredServer(request, response);
            } break;
            default: {
                response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
                response.end(xmlBuilder.buildObject({
                    response:{
                        $:{type:"s2s"},
                        "status":["rejected"],
                        "status-code":[14],
                        "message":["Method not recognized."]
                    }
                }));
            } break;
        }
	},

    registrasiServer:function(request, response){
        var requestID, hash;
        if (request!=null && request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.ip!=null && request.param[0].$.port!=null && request.param[0].$.password!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');
            sha512 = crypto.createHash('sha512');
            sha512.update(request.param[0].$.password);
            hash = sha512.digest('hex');

            s2sObj.callbackHashTable['s2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete s2sObj.callbackHashTable['s2sWorker'+requestID];
            };
            process.send({
                messageType:"s2sMaster",
                payload:{
                    workerID:cluster.worker.id,
                    reqID:requestID,
                    hash:hash,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"s2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    loginServer:function(request, response){
        var requestID, sessid, hash;
        if (request!=null && request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.ip!=null && request.param[0].$.port!=null && request.param[0].$.password!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');
            sessid = request.param[0].$.ip + ":" + request.param[0].$.port + "::w" + cluster.worker.id + "::" + crypto.randomBytes(16).toString('base64');
            sha512 = crypto.createHash('sha512');
            sha512.update(request.param[0].$.password);
            hash = sha512.digest('hex');

            s2sObj.callbackHashTable['s2sWorker'+requestID] = function(data){
                var header = data.header;
                data = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(data));

                delete s2sObj.callbackHashTable['s2sWorker'+requestID];
            };
            process.send({
                messageType:"s2sMaster",
                payload:{
                    workerID:cluster.worker.id,
                    reqID:requestID,
                    hash:hash,
                    sessid:sessid,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"s2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    registrasiClient:function(request, response){
        var requestID;
        if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.username!=null && request.param[0].$.password!=null && request.param[0].$.sessid!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            s2sObj.callbackHashTable['s2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete s2sObj.callbackHashTable['s2sWorker'+requestID];
            };
            process.send({
                messageType:"s2sMaster",
                payload:{
                    workerID:cluster.worker.id,
                    reqID:requestID,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"s2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    loginClient:function(request, response){
        var requestID;
        if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.username!=null && request.param[0].$.csessid!=null && request.param[0].$.sessid!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            s2sObj.callbackHashTable['s2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete s2sObj.callbackHashTable['s2sWorker'+requestID];
            };
            process.send({
                messageType:"s2sMaster",
                payload:{
                    workerID:cluster.worker.id,
                    reqID:requestID,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"s2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    chatSendClient:function(request, response){
        var requestID;
        if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.username!=null && request.param[0].$.time!=null && request.param[0].$.message!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            s2sObj.callbackHashTable['s2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete s2sObj.callbackHashTable['s2sWorker'+requestID];
            };
            process.send({
                messageType:"s2sMaster",
                payload:{
                    workerID:cluster.worker.id,
                    reqID:requestID,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"s2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    logoutClient:function(request, response){
        var requestID;
        if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.csessid!=null && request.param[0].$.sessid!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            s2sObj.callbackHashTable['s2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete s2sObj.callbackHashTable['s2sWorker'+requestID];
            };
            process.send({
                messageType:"s2sMaster",
                payload:{
                    workerID:cluster.worker.id,
                    reqID:requestID,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"s2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    logoutServer:function(request, response){
        var requestID;
        if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.sessid!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            s2sObj.callbackHashTable['s2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete s2sObj.callbackHashTable['s2sWorker'+requestID];
            };
            process.send({
                messageType:"s2sMaster",
                payload:{
                    workerID:cluster.worker.id,
                    reqID:requestID,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"s2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    serverHeartbeat:function(request, response){
        var requestID;
        if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.sessid!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            s2sObj.callbackHashTable['s2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete s2sObj.callbackHashTable['s2sWorker'+requestID];
            };
            process.send({
                messageType:"s2sMaster",
                payload:{
                    workerID:cluster.worker.id,
                    reqID:requestID,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"s2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    listRegisteredServer:function(request, response){
        var requestID;
        requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

        s2sObj.callbackHashTable['s2sWorker'+requestID] = function(data){
            var header = data.header;
            var res = data.data;
            response.writeHead(200, "OK", header);
            response.end(xmlBuilder.buildObject(res));

            delete s2sObj.callbackHashTable['s2sWorker'+requestID];
        };
        process.send({
            messageType:"s2sMaster",
            payload:{
                workerID:cluster.worker.id,
                reqID:requestID,
                data:request
            }
        });
    },

    startListening:function(){
        process.on('message', function(data){
            if (data.messageType!=null) {
                switch (data.messageType) {
                    case "s2sWorker": {
                        s2sObj.callbackHashTable["s2sWorker"+data.payload.reqID](data.payload);
                    } break;
                }
            }
        });
    }
};

module.exports = s2sObj;

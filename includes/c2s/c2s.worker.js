'use strict';

var xml2js = require('xml2js');
var crypto = require('crypto');
var sha512 = null;
var cluster = require('cluster');
var xmlBuilder = new xml2js.Builder();
var async = require('async');

var c2sObj = {
    chatHistory:[],
    callbackHashTable:{},
    pullRequestHashTable:{},
    chatHistoryFirstID:1,
    cfg:null,
    s2sClient:null,

	handle: function(request, response){
        var method = request.method[0];
		switch(method) {
            case 'login': {
                c2sObj.login(request, response);
            } break;
            case 'register': {
                c2sObj.register(request, response);
            } break;
            case 'logout': {
                c2sObj.logout(request, response);
            } break;
            case 'chatSend': {
                c2sObj.chatSend(request, response);
            } break;
            case 'chatPull': {
                if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.lastID!=null) {
                    c2sObj.chatPull(request, response);
                } else {
                    response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
                    response.end(xmlBuilder.buildObject({
                        response:{
                            $:{type:"c2s"},
                            "status":["rejected"],
                            "status-code":[13],
                            "message":["Parameter read failed."]
                        }
                    }));
                }
            } break;
            case 'chatGet': {
                c2sObj.chatPull(request, response);
            } break;
            case 'heartbeat': {
                c2sObj.heartbeat(request, response);
            } break;
            default: {
                response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
                response.end(xmlBuilder.buildObject({
                    response:{
                        $:{type:"c2s"},
                        "status":["rejected"],
                        "status-code":[14],
                        "message":["Method not recognized."]
                    }
                }));
            } break;
        }
	},

    login: function(request, response){
        var requestID, hash, sessid;
        if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.user!=null && request.param[0].$.password!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');
            hash = null;
            sessid = null;
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.user!=null && request.param[0].$.password!=null) {
                sha512 = crypto.createHash('sha512');
                sha512.update(request.param[0].$.password);
                hash = sha512.digest('hex');
                sessid = request.param[0].$.user + "::w" + cluster.worker.id + "::" + crypto.randomBytes(16).toString('base64');
            }

            c2sObj.callbackHashTable['c2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete c2sObj.callbackHashTable['c2sWorker'+requestID];
            };
            process.send({
                messageType:"c2sMaster",
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
                    $:{type:"c2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    logout: function(request, response){
        var requestID;
        if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.sessid!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            c2sObj.callbackHashTable['c2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete c2sObj.callbackHashTable['c2sWorker'+requestID];
            };
            process.send({
                messageType:"c2sMaster",
                payload:{
                    reqID:requestID,
                    workerID:cluster.worker.id,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"c2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    register: function(request, response){
        var requestID, hash;
        if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.user!=null && request.param[0].$.password!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');
            hash = null;
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.password!=null) {
                sha512 = crypto.createHash('sha512');
                sha512.update(request.param[0].$.password);
                hash = sha512.digest('hex');
            }

            c2sObj.callbackHashTable['c2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete c2sObj.callbackHashTable['c2sWorker'+requestID];
            };
            process.send({
                messageType:"c2sMaster",
                payload:{
                    reqID:requestID,
                    workerID:cluster.worker.id,
                    hash:hash,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"c2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    chatSend:function(request, response){
        var requestID;
        if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.sessid!=null && request.param[0].$.message!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            c2sObj.callbackHashTable['c2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete c2sObj.callbackHashTable['c2sWorker'+requestID];
            };
            process.send({
                messageType:"c2sMaster",
                payload:{
                    reqID:requestID,
                    workerID:cluster.worker.id,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"c2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    chatPull:function(request, response, reqID){
        if (response.closedByClient!==true && response.closedByServer!==true) {
            var lastID = parseInt(request.param[0].$.lastID);
            var messages = null;
            if (lastID===-1) {
                // find all
                messages = c2sObj.chatHistory;
            } else {
                // find where $loki more than lastID
                var idxID = lastID - c2sObj.chatHistoryFirstID;
                var msgRes = [];
                if (idxID>=0 && idxID<c2sObj.chatHistory.length) {
                    // msgRes = c2sObj.chatHistory.slice(idxID+1, c2sObj.chatHistory.length);
                    var len = c2sObj.chatHistory.length;
                    for (var i = idxID+1; i < len; i++) {
                        msgRes.push(c2sObj.chatHistory[i]);
                    }
                }
                messages = msgRes;
            }

            if (messages!=null && messages.length>0) {
                response.closedByServer = true;
                delete c2sObj.pullRequestHashTable["c2sWorker"+requestID];
                var messageArray = [];
                var nextID = 0;
                async.each(messages, function(message, callback){
                    messageArray.push({
                        $:{
                            "username":message.username,
                            "time":message.time,
                            "message":message.message
                        }
                    });
                    nextID = (message.$loki>nextID)?message.$loki:nextID;
                    async.setImmediate(function(){
                        callback();
                    });
                }, function() {
                    if (reqID==null) {
                        response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
                    }
                    response.end(xmlBuilder.buildObject({
                        response:{
                            $:{type:"c2s"},
                            "status":["accepted"],
                            "status-code":[1],
                            "lastID":[nextID],
                            "messages":[{"message":messageArray}]
                        }
                    }));
                });
            } else {
                if (reqID!=null) {
                    response.write(" "); // Keep connection alive
                    setTimeout(function(){
                        if (c2sObj.pullRequestHashTable["c2sWorker"+reqID]!=null) {
                            c2sObj.pullRequestHashTable["c2sWorker"+reqID].fun();
                        }
                    }, response.connection.server.timeout/4);
                } else {
                    response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
                    response.write(" "); // Keep connection alive
                    var requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');
                    response.on('close', function(){
                        response.closedByClient = true;
                        delete c2sObj.pullRequestHashTable["c2sWorker"+requestID];
                    });
                    var sendPullRequest = function(){
                        c2sObj.chatPull(request, response, requestID);
                    };
                    c2sObj.pullRequestHashTable["c2sWorker"+requestID] = {
                        type:"pullRequest",
                        fun:sendPullRequest
                    };
                    setTimeout(function(){
                        if (c2sObj.pullRequestHashTable["c2sWorker"+requestID]!=null) {
                            c2sObj.pullRequestHashTable["c2sWorker"+requestID].fun();
                        }
                    }, response.connection.server.timeout/4);
                }
            }
        } else {
            if (reqID!=null && c2sObj.pullRequestHashTable["c2sWorker"+reqID]!=null) {
                delete c2sObj.pullRequestHashTable["c2sWorker"+reqID];
            }
        }
    },

    chatGet:function(request, response){
        var requestID;
        if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.time!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            c2sObj.callbackHashTable['c2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete c2sObj.callbackHashTable['c2sWorker'+requestID];
            };
            process.send({
                messageType:"c2sMaster",
                payload:{
                    reqID:requestID,
                    workerID:cluster.worker.id,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"c2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    heartbeat:function(request, response){
        var requestID;
        if (request!=null && request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.sessid!=null) {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            c2sObj.callbackHashTable['c2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete c2sObj.callbackHashTable['c2sWorker'+requestID];
            };
            process.send({
                messageType:"c2sMaster",
                payload:{
                    reqID:requestID,
                    workerID:cluster.worker.id,
                    data:request
                }
            });
        } else {
            response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            response.end(xmlBuilder.buildObject({
                response:{
                    $:{type:"c2s"},
                    "status":["rejected"],
                    "status-code":[13],
                    "message":["Parameter read failed."]
                }
            }));
        }
    },

    startListening:function(){
        process.on('message', function(data){
            if (data.messageType!=null) {
                switch (data.messageType) {
                    case "c2sWorker": {
                        c2sObj.callbackHashTable["c2sWorker"+data.payload.reqID](data.payload);
                    } break;
                    case "flush": {
                        c2sObj.chatHistory.length = 0;
                    } break;
                    case "c2sWorkerChatSend": {
                        for (var i = 0; i < data.payload.length; i++) {
                            if (i===0 && c2sObj.chatHistory.length===0) {
                                c2sObj.chatHistoryFirstID = data.payload[i].$loki;
                            }
                            c2sObj.chatHistory.push(data.payload[i]);
                        }
                        for (var key in c2sObj.pullRequestHashTable) {
                            var identifier = key;
                            async.setImmediate(c2sObj.pullRequestHashTable[identifier].fun);
                        }
                    } break;
                }
            }
        });
    }
};

module.exports = c2sObj;

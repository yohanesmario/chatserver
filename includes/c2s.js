'use strict';

var xml2js = require('xml2js');
var crypto = require('crypto');
var sha512 = null;
var cluster = require('cluster');
var xmlBuilder = new xml2js.Builder();
var async = require('async');

var c2sObj = {
    dbWrapper:null,
    cfg:null,
    s2sClient:null,
    initWorker:function(workerID){
        if (cluster.isMaster) {
            var res = c2sObj.dbWrapper.chatHistory.chain().find({}).simplesort('$loki').data();
            var msgRes = [];
            for (var i = 0; i < res.length; i++) {
                msgRes.push({
                    '$loki':res[i].$loki,
                    'username':res[i].username,
                    'time':res[i].time,
                    'message':res[i].message
                });
            }
            cluster.workers[workerID].send({
                messageType:"c2sWorkerChatSend",
                payload:msgRes
            });
        }
    },
	handle: function(request, response){
        var req = (cluster.isMaster)?request.data.method[0]:request.method[0];
		switch(req) {
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
                response.end("c2s");
            } break;
        }
	},
    login: function(request, response){
        var requestID, hash, sessid;
        if (cluster.isMaster) {
            var workerID = request.workerID;
            requestID = request.reqID;
            sessid = request.sessid;
            hash = request.hash;
            request = request.data;

            var username = request.param[0].$.user;
            var res = c2sObj.dbWrapper.users.by('username', username);

            if (res!=null && res.password!=null) {
                if (res.loggedIn===false) {
                    if (res.password===hash) {
                        // Success
                        res.loggedIn = true;
                        res.sessid = sessid;
                        res.heartbeat = Date.now();
                        res.handledByMe = true;
                        res.handlerIpPort = null;
                        c2sObj.dbWrapper.users.update(res);

                        cluster.workers[workerID].send({
                            messageType:"c2sWorker",
                            payload:{
                                reqID:requestID,
                                header:{'Content-Type': 'text/plain'},
                                data:{
                                    response:{
                                        $:{type:"c2s"},
                                        "status":["accepted"],
                                        "status-code":[1],
                                        "sessid":[sessid]
                                    }
                                }
                            }
                        });

                        c2sObj.s2sClient.loginClient(username, sessid, function(){});
                    } else {
                        // Fail
                        cluster.workers[workerID].send({
                            messageType:"c2sWorker",
                            payload:{
                                reqID:requestID,
                                header:{'Content-Type': 'text/plain'},
                                data:{
                                    response:{
                                        $:{type:"c2s"},
                                        "status":["rejected"],
                                        "status-code":[3],
                                        "message":["Wrong password."]
                                    }
                                }
                            }
                        });
                    }
                } else {
                    // Already logged-in
                    cluster.workers[workerID].send({
                        messageType:"c2sWorker",
                        payload:{
                            reqID:requestID,
                            header:{'Content-Type': 'text/plain'},
                            data:{
                                response:{
                                    $:{type:"c2s"},
                                    "status":["rejected"],
                                    "status-code":[5],
                                    "message":["Already logged-in."]
                                }
                            }
                        }
                    });
                }
            } else {
                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["rejected"],
                                "status-code":[4],
                                "message":["User doesn't exist."]
                            }
                        }
                    }
                });
            }
        } else {
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

                c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID];
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
        }
    },
    logout: function(request, response){
        var requestID;
        if (cluster.isMaster) {
            var workerID = request.workerID;
            requestID = request.reqID;
            request = request.data;

            var sessid = request.param[0].$.sessid;
            var res = c2sObj.dbWrapper.users.find({"sessid":sessid});

            if (res!=null && res.length>0 && res[0].sessid===sessid) {
                res[0].loggedIn = false;
                res[0].sessid = null;
                res[0].heartbeat = null;
                res[0].handledByMe = null;
                res[0].handlerIpPort = null;
                c2sObj.dbWrapper.users.update(res[0]);

                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["accepted"],
                                "status-code":[1]
                            }
                        }
                    }
                });

                c2sObj.s2sClient.logoutClient(sessid, function(){});
            } else {
                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":["Session expired."]
                            }
                        }
                    }
                });
            }
        } else {
            if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.sessid!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID];
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
        }
    },
    register: function(request, response){
        var requestID, hash;
        if (cluster.isMaster) {
            var workerID = request.workerID;
            requestID = request.reqID;
            hash = request.hash;
            request = request.data;

            var username = request.param[0].$.user;
            var password = hash;

            var res = c2sObj.dbWrapper.users.insert({
                "username":username,
                "password":password,
                "loggedIn":false,
                "sessid":null,
                "heartbeat":null,
                "handledByMe":false,
                "handlerIpPort":null
            });

            if (res.username===username) {
                // Success
                c2sObj.dbWrapper.queueSaving();

                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["accepted"],
                                "status-code":[1]
                            }
                        }
                    }
                });

                c2sObj.s2sClient.registerClient(username, password, function(){});
            } else {
                // Fail
                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":["Duplicate entry."]
                            }
                        }
                    }
                });
            }
        } else {
            if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.user!=null && request.param[0].$.password!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');
                hash = null;
                if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.password!=null) {
                    sha512 = crypto.createHash('sha512');
                    sha512.update(request.param[0].$.password);
                    hash = sha512.digest('hex');
                }

                c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID];
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
        }
    },
    chatSend:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            var workerID = request.workerID;
            requestID = request.reqID;
            request = request.data;

            var sessid = request.param[0].$.sessid;
            var message = request.param[0].$.message;

            var res = c2sObj.dbWrapper.users.find({"sessid":sessid});

            if (res!=null && res.length>0 && res[0].sessid===sessid) {
                var msgRes = c2sObj.dbWrapper.chatHistory.insert({
                    'username':res[0].username,
                    'time':Date.now(),
                    'message':message
                });
                c2sObj.dbWrapper.queueSaving();

                var servers = c2sObj.dbWrapper.servers.find({"loggedIn":true});
                for (var i = 0; i < servers.length; i++) {
                    c2sObj.s2sClient.chatSendClient(servers[i].ip, servers[i].port, {
                        'username':msgRes.username,
                        'time':msgRes.time,
                        'message':msgRes.message
                    }, function(){
                        // Berhasil ngirim
                    });
                }

                c2sObj.dbWrapper.queueC2SWorkerChatSend({
                    '$loki':msgRes.$loki,
                    'username':msgRes.username,
                    'time':msgRes.time,
                    'message':msgRes.message
                });
                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["accepted"],
                                "status-code":[1]
                            }
                        }
                    }
                });
            } else {
                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":["Session expired."]
                            }
                        }
                    }
                });
            }
        } else {
            if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.sessid!=null && request.param[0].$.message!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID];
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
        }
    },
    chatPull:function(request, response, reqID){
        if (cluster.isWorker) {
            if (response.closedByClient!==true && response.closedByServer!==true) {
                var lastID = parseInt(request.param[0].$.lastID);
                var messages = null;
                if (lastID===-1) {
                    // find all
                    messages = c2sObj.dbWrapper.chatHistory;
                } else {
                    // find where $loki more than lastID
                    var idxID = lastID - c2sObj.dbWrapper.chatHistoryFirstID;
                    var msgRes = [];
                    if (idxID>=0 && idxID<c2sObj.dbWrapper.chatHistory.length) {
                        // msgRes = c2sObj.dbWrapper.chatHistory.slice(idxID+1, c2sObj.dbWrapper.chatHistory.length);
                        var len = c2sObj.dbWrapper.chatHistory.length;
                        for (var i = idxID+1; i < len; i++) {
                            msgRes.push(c2sObj.dbWrapper.chatHistory[i]);
                        }
                    }
                    messages = msgRes;
                }

                if (messages!=null && messages.length>0) {
                    response.closedByServer = true;
                    delete c2sObj.dbWrapper.pullRequestHashTable["c2sWorker"+requestID];
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
                            if (c2sObj.dbWrapper.pullRequestHashTable["c2sWorker"+reqID]!=null) {
                                c2sObj.dbWrapper.pullRequestHashTable["c2sWorker"+reqID].fun();
                            }
                        }, response.connection.server.timeout/4);
                    } else {
                        response.writeHead(200, "OK", {'Content-Type': 'text/plain'});
                        response.write(" "); // Keep connection alive
                        var requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');
                        response.on('close', function(){
                            response.closedByClient = true;
                            delete c2sObj.dbWrapper.pullRequestHashTable["c2sWorker"+requestID];
                        });
                        var sendPullRequest = function(){
                            c2sObj.chatPull(request, response, requestID);
                        };
                        c2sObj.dbWrapper.pullRequestHashTable["c2sWorker"+requestID] = {
                            type:"pullRequest",
                            fun:sendPullRequest
                        };
                        setTimeout(function(){
                            if (c2sObj.dbWrapper.pullRequestHashTable["c2sWorker"+requestID]!=null) {
                                c2sObj.dbWrapper.pullRequestHashTable["c2sWorker"+requestID].fun();
                            }
                        }, response.connection.server.timeout/4);
                    }
                }
            } else {
                if (reqID!=null && c2sObj.dbWrapper.pullRequestHashTable["c2sWorker"+reqID]!=null) {
                    delete c2sObj.dbWrapper.pullRequestHashTable["c2sWorker"+reqID];
                }
            }
        }
    },
    chatGet:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            var workerID = request.workerID;
            requestID = request.reqID;
            request = request.data;

            var time = parseInt(request.param[0].$.time);
            var messages = c2sObj.dbWrapper.chatHistory.find({'time':{'$gt':time}});

            if (messages!=null && messages.length>0) {
                var messageArray = [];
                var nextTime = 0;

                async.each(messages, function(message, callback){
                    messageArray.push({
                        $:{
                            "username":message.username,
                            "time":message.time,
                            "message":message.message
                        }
                    });
                    nextTime = (message.time>nextTime)?message.time:nextTime;
                    async.setImmediate(function(){
                        callback();
                    });
                }, function() {
                    cluster.workers[workerID].send({
                        messageType:"c2sWorker",
                        payload:{
                            reqID:requestID,
                            header:{'Content-Type': 'text/plain'},
                            data:{
                                response:{
                                    $:{type:"c2s"},
                                    "status":["accepted"],
                                    "status-code":[1],
                                    "time":[nextTime],
                                    "messages":[{"message":messageArray}]
                                }
                            }
                        }
                    });
                });
            } else {
                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["accepted"],
                                "status-code":[1],
                                "time":[time]
                            }
                        }
                    }
                });
            }
        } else {
            if (request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.time!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID];
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
        }
    },
    heartbeat:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            requestID = request.reqID;
            var workerID = request.workerID;
            request = request.data;

            var sessid = request.param[0].$.sessid;
            var res = c2sObj.dbWrapper.users.find({'sessid':sessid});

            if (res!=null && res.length===1 && res[0]!=null && res[0].username!=null) {
                res[0].heartbeat = Date.now();
                res[0].handledByMe = true;
                res[0].handlerIpPort = null;
                c2sObj.dbWrapper.users.update(res[0]);

                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["accepted"],
                                "status-code":[1]
                            }
                        }
                    }
                });
            } else {
                cluster.workers[workerID].send({
                    messageType:"c2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                $:{type:"c2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":['Session expired.']
                            }
                        }
                    }
                });
            }
        } else {
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.sessid!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete c2sObj.dbWrapper.callbackHashTable['c2sWorker'+requestID];
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
        }
    }
};

module.exports = c2sObj;

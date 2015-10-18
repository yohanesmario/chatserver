'use strict';

var cluster = require('cluster');
var crypto = require('crypto');
var sha512 = null;
var async = require('async');
var xml2js = require('xml2js');
var parseString = xml2js.parseString;
var xmlBuilder = new xml2js.Builder();

var s2sObj = {
    dbWrapper:null,
    cfg:null,
    s2sClient:null,
	handle: function(request, response){
        var method = (cluster.isMaster)?request.data.method[0]:request.method[0];
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
                response.end("s2s");
            } break;
        }
	},
    registrasiServer:function(request, response){
        var requestID, hash;
        if (cluster.isMaster) { // MASTER BRANCH
            requestID = request.reqID;
            var workerID = request.workerID;
            hash = request.hash;
            request = request.data;
            var ipPort = request.param[0].$.ip+":"+request.param[0].$.port;

            var res = s2sObj.dbWrapper.servers.find({"ipPort": ipPort});

            if (res!=null && res.length>0 && res[0].ipPort===ipPort) {
                // Already registered
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":['duplicate identifier']
                            }
                        }
                    }
                });
            } else {
                s2sObj.dbWrapper.servers.insert({
                    "ipPort":ipPort,
                    "ip":request.param[0].$.ip,
                    "port":request.param[0].$.port,
                    "password":hash,
                    "loggedIn":false,
                    "sessid":null,
                    "mysessid":null,
                    "heartbeat":null
                });
                // Success
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["accepted"],
                                "status-code":[1]
                            }
                        }
                    }
                });
            }
        } else { // WORKER BRANCH
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.ip!=null && request.param[0].$.port!=null && request.param[0].$.password!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');
                sha512 = crypto.createHash('sha512');
                sha512.update(request.param[0].$.password);
                hash = sha512.digest('hex');

                s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID];
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
        }
    },
    loginServer:function(request, response){
        var requestID, sessid, hash;
        if (cluster.isMaster) { // MASTER BRANCH
            requestID = request.reqID;
            var workerID = request.workerID;
            hash = request.hash;
            sessid = request.sessid;
            request = request.data;
            var ipPort = request.param[0].$.ip+":"+request.param[0].$.port;

            var res = s2sObj.dbWrapper.servers.find({'ipPort':ipPort});

            if (res!=null && res.length===1 && res[0].ipPort===ipPort) {
                if (res[0].password===hash) {
                    if (res[0].loggedIn!==true) {
                        res[0].loggedIn = true;
                        res[0].sessid = sessid;
                        res[0].heartbeat = Date.now();
                        s2sObj.dbWrapper.servers.update(res[0]);
                        var msgRes = s2sObj.dbWrapper.chatHistory.find({'$loki':{'$gt':-Infinity}});
                        var usrRes = s2sObj.dbWrapper.users.find({'$loki':{'$gt':-Infinity}});
                        var messages = [];
                        var usersBucket = [];
                        var i;
                        for (i = 0; i < msgRes.length; i++) {
                            messages.push({
                                "$":{
                                    "username":msgRes[i].username,
                                    "time":msgRes[i].time,
                                    "message":msgRes[i].message
                                }
                            });
                        }
                        for (i = 0; i < usrRes.length; i++) {
                            var handlerIpPort;
                            if (usrRes[i].handlerIpPort!=null) {
                                handlerIpPort = usrRes[i].handlerIpPort;
                            } else {
                                handlerIpPort = s2sObj.cfg.identifier.ip+":"+s2sObj.cfg.identifier.port;
                            }
                            var usrSessid = usrRes[i].sessid;
                            if (usrSessid==null) {
                                usrSessid = "null";
                            }
                            usersBucket.push({
                                "$":{
                                    "username":usrRes[i].username,
                                    "password":usrRes[i].password,
                                    "loggedIn":((usrRes[i].loggedIn)?"true":"false"),
                                    "sessid":usrSessid,
                                    "handlerIpPort":handlerIpPort
                                }
                            });
                        }
                        // Success
                        cluster.workers[workerID].send({
                            messageType:"s2sWorker",
                            payload:{
                                reqID:requestID,
                                header:{'Content-Type': 'text/plain'},
                                data:{
                                    response:{
                                        "$":{"type":"s2s"},
                                        "status":["accepted"],
                                        "status-code":[1],
                                        "sessid":sessid,
                                        "messages":[{
                                            "message":messages
                                        }],
                                        "users":[{
                                            "user":usersBucket
                                        }]
                                    }
                                }
                            }
                        }, function(){
                            if (res[0].mysessid==null) {
                                async.setImmediate(function(){
                                    var loginServerCallback = function(r){
                                        parseString(r, function(err, d){
                                            var srv = s2sObj.dbWrapper.servers.find({'ipPort': ipPort});
                                            if (srv!=null && srv.length===1 && srv[0].mysessid===null) {
                                                srv[0].mysessid = d.response.sessid[0];
                                                s2sObj.dbWrapper.servers.update(srv[0]);
                                            }
                                        });
                                    };
                                    s2sObj.s2sClient.loginServer(res[0].ip, res[0].port, loginServerCallback);
                                });
                            }
                        });
                    } else {
                        // Already logged in
                        cluster.workers[workerID].send({
                            messageType:"s2sWorker",
                            payload:{
                                reqID:requestID,
                                header:{'Content-Type': 'text/plain'},
                                data:{
                                    response:{
                                        "$":{"type":"s2s"},
                                        "status":["rejected"],
                                        "status-code":[5],
                                        "message":["already logged-in"]
                                    }
                                }
                            }
                        });
                    }
                } else {
                    // Wrong password
                    cluster.workers[workerID].send({
                        messageType:"s2sWorker",
                        payload:{
                            reqID:requestID,
                            header:{'Content-Type': 'text/plain'},
                            data:{
                                response:{
                                    "$":{"type":"s2s"},
                                    "status":["rejected"],
                                    "status-code":[4],
                                    "message":["wrong password"]
                                }
                            }
                        }
                    });
                }
            } else {
                // ip:port doesn't exist
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":['identifier doesn\'t exist']
                            }
                        }
                    }
                });
            }
        } else { // WORKER BRANCH
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0]!=null && request.param[0].$!=null && request.param[0].$.ip!=null && request.param[0].$.port!=null && request.param[0].$.password!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');
                sessid = request.param[0].$.ip + ":" + request.param[0].$.port + "::w" + cluster.worker.id + "::" + crypto.randomBytes(16).toString('base64');
                sha512 = crypto.createHash('sha512');
                sha512.update(request.param[0].$.password);
                hash = sha512.digest('hex');

                s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID] = function(data){
                    var header = data.header;
                    data = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(data));

                    delete s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID];
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
        }
    },
    registrasiClient:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            requestID = request.reqID;
            var workerID = request.workerID;
            request = request.data;

            var srv = s2sObj.dbWrapper.servers.find({"sessid":request.param[0].$.sessid});
            if (srv!=null && srv.length===1) {
                var res = s2sObj.dbWrapper.users.insert({
                    "username":request.param[0].$.username,
                    "password":request.param[0].$.password,
                    "loggedIn":false,
                    "sessid":null,
                    "heartbeat":null,
                    "handledByMe":false,
                    "handlerIpPort":null
                });

                if (res!=null && res.username===request.param[0].$.username) {
                    cluster.workers[workerID].send({
                        messageType:"s2sWorker",
                        payload:{
                            reqID:requestID,
                            header:{'Content-Type': 'text/plain'},
                            data:{
                                response:{
                                    "$":{"type":"s2s"},
                                    "status":["accepted"],
                                    "status-code":[1]
                                }
                            }
                        }
                    });
                } else {
                    cluster.workers[workerID].send({
                        messageType:"s2sWorker",
                        payload:{
                            reqID:requestID,
                            header:{'Content-Type': 'text/plain'},
                            data:{
                                response:{
                                    "$":{"type":"s2s"},
                                    "status":["rejected"],
                                    "status-code":[4],
                                    "message":["Already registered"]
                                }
                            }
                        }
                    });
                }
            } else {
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":["session expired"]
                            }
                        }
                    }
                });
            }
        } else {
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.username!=null && request.param[0].$.password!=null && request.param[0].$.sessid!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID];
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
        }
    },
    loginClient:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            requestID = request.reqID;
            var workerID = request.workerID;
            request = request.data;

            var srv = s2sObj.dbWrapper.servers.find({"sessid":request.param[0].$.sessid});
            if (srv!=null && srv.length===1) {
                var res = s2sObj.dbWrapper.users.find({"username":request.param[0].$.username});
                if (res!=null && res.length===1) {
                    if (res[0].loggedIn===false) {
                        res[0].loggedIn = true;
                        res[0].sessid = request.param[0].$.csessid;
                        res[0].heartbeat = null;
                        res[0].handledByMe = false;
                        res[0].handlerIpPort = srv[0].ipPort;
                        s2sObj.dbWrapper.users.update(res[0]);

                        cluster.workers[workerID].send({
                            messageType:"s2sWorker",
                            payload:{
                                reqID:requestID,
                                header:{'Content-Type': 'text/plain'},
                                data:{
                                    response:{
                                        "$":{"type":"s2s"},
                                        "status":["accepted"],
                                        "status-code":[1]
                                    }
                                }
                            }
                        });
                    } else {
                        cluster.workers[workerID].send({
                            messageType:"s2sWorker",
                            payload:{
                                reqID:requestID,
                                header:{'Content-Type': 'text/plain'},
                                data:{
                                    response:{
                                        "$":{"type":"s2s"},
                                        "status":["rejected"],
                                        "status-code":[5],
                                        "message":["already logged in"]
                                    }
                                }
                            }
                        });
                    }
                } else {
                    cluster.workers[workerID].send({
                        messageType:"s2sWorker",
                        payload:{
                            reqID:requestID,
                            header:{'Content-Type': 'text/plain'},
                            data:{
                                response:{
                                    "$":{"type":"s2s"},
                                    "status":["rejected"],
                                    "status-code":[4],
                                    "message":["user doesn't exist"]
                                }
                            }
                        }
                    });
                }
            } else {
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":["session expired"]
                            }
                        }
                    }
                });
            }
        } else {
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.username!=null && request.param[0].$.csessid!=null && request.param[0].$.sessid!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID];
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
        }
    },
    chatSendClient:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            requestID = request.reqID;
            var workerID = request.workerID;
            request = request.data;

            var inserted = s2sObj.dbWrapper.chatHistory.insert({
                "username":request.param[0].$.username,
                "time":parseInt(request.param[0].$.time),
                "message":request.param[0].$.message
            });

            if (inserted!=null && inserted.username===request.param[0].$.username) {
                s2sObj.dbWrapper.queueC2SWorkerChatSend({
                    '$loki':inserted.$loki,
                    'username':inserted.username,
                    'time':inserted.time,
                    'message':inserted.message
                });
            }

            cluster.workers[workerID].send({
                messageType:"s2sWorker",
                payload:{
                    reqID:requestID,
                    header:{'Content-Type': 'text/plain'},
                    data:{
                        response:{
                            "$":{"type":"s2s"},
                            "status":["accepted"],
                            "status-code":[1]
                        }
                    }
                }
            });
        } else {
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.username!=null && request.param[0].$.time!=null && request.param[0].$.message!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID];
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
        }
    },
    logoutClient:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            requestID = request.reqID;
            var workerID = request.workerID;
            request = request.data;

            var srv = s2sObj.dbWrapper.servers.find({"sessid":request.param[0].$.sessid});
            if (srv!=null && srv.length===1) {
                var res = s2sObj.dbWrapper.users.find({"sessid":request.param[0].$.csessid});
                if (res!=null && res.length===1) {
                    res[0].loggedIn = false;
                    res[0].sessid = null;
                    res[0].heartbeat = null;
                    res[0].handledByMe = false;
                    res[0].handlerIpPort = null;
                    s2sObj.dbWrapper.users.update(res[0]);

                    cluster.workers[workerID].send({
                        messageType:"s2sWorker",
                        payload:{
                            reqID:requestID,
                            header:{'Content-Type': 'text/plain'},
                            data:{
                                response:{
                                    "$":{"type":"s2s"},
                                    "status":["accepted"],
                                    "status-code":[1]
                                }
                            }
                        }
                    });
                } else {
                    cluster.workers[workerID].send({
                        messageType:"s2sWorker",
                        payload:{
                            reqID:requestID,
                            header:{'Content-Type': 'text/plain'},
                            data:{
                                response:{
                                    "$":{"type":"s2s"},
                                    "status":["rejected"],
                                    "status-code":[4],
                                    "message":["user's session expired"]
                                }
                            }
                        }
                    });
                }
            } else {
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":["session expired"]
                            }
                        }
                    }
                });
            }
        } else {
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.csessid!=null && request.param[0].$.sessid!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID];
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
        }
    },
    logoutServer:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            requestID = request.reqID;
            var workerID = request.workerID;
            request = request.data;

            var res = s2sObj.dbWrapper.servers.find({"sessid":request.param[0].$.sessid});
            if (res!=null && res.length===1) {
                res[0].loggedIn = false;
                res[0].sessid = null;
                res[0].mysessid = null;
                res[0].heartbeat = null;
                var usrRes = s2sObj.dbWrapper.users.find({"handlerIpPort":res[0].ipPort});
                if (usrRes!=null && usrRes.length>0) {
                    for (var i = 0; i < usrRes.length; i++) {
                        usrRes[i].loggedIn = false;
                        usrRes[i].handledByMe = false;
                        usrRes[i].heartbeat = null;
                        usrRes[i].handlerIpPort = null;
                        usrRes[i].sessid = null;
                        s2sObj.dbWrapper.users.update(usrRes[i]);
                    }
                }
                s2sObj.dbWrapper.servers.update(res[0]);
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["accepted"],
                                "status-code":[1]
                            }
                        }
                    }
                });
            } else {
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":["session expired"]
                            }
                        }
                    }
                });
            }
        } else {
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.sessid!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID];
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
        }
    },
    serverHeartbeat:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            requestID = request.reqID;
            var workerID = request.workerID;
            request = request.data;

            var res = s2sObj.dbWrapper.servers.find({"sessid":request.param[0].$.sessid});
            if (res!=null && res.length===1) {
                res[0].heartbeat = Date.now();
                s2sObj.dbWrapper.servers.update(res[0]);
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["accepted"],
                                "status-code":[1]
                            }
                        }
                    }
                });
            } else {
                cluster.workers[workerID].send({
                    messageType:"s2sWorker",
                    payload:{
                        reqID:requestID,
                        header:{'Content-Type': 'text/plain'},
                        data:{
                            response:{
                                "$":{"type":"s2s"},
                                "status":["rejected"],
                                "status-code":[3],
                                "message":["session expired"]
                            }
                        }
                    }
                });
            }
        } else {
            if (request!=null && request.param!=null && request.param.length===1 && request.param[0].$!=null && request.param[0].$.sessid!=null) {
                requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

                s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID] = function(data){
                    var header = data.header;
                    var res = data.data;
                    response.writeHead(200, "OK", header);
                    response.end(xmlBuilder.buildObject(res));

                    delete s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID];
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
        }
    },
    listRegisteredServer:function(request, response){
        var requestID;
        if (cluster.isMaster) {
            requestID = request.reqID;
            var workerID = request.workerID;
            request = request.data;

            var serverArray = [{
                "$":{
                    "ip":s2sObj.cfg.identifier.ip,
                    "port":s2sObj.cfg.identifier.port,
                    "password":s2sObj.cfg.hash
                }
            }];

            var res = s2sObj.dbWrapper.servers.find({'$loki':{'$gt':-Infinity}});
            if (res!=null) {
                for (var i = 0; i < res.length; i++) {
                    serverArray.push({
                        "$":{
                            "ip":res[i].ip,
                            "port":res[i].port,
                            "password":res[i].password
                        }
                    });
                }
            }

            cluster.workers[workerID].send({
                messageType:"s2sWorker",
                payload:{
                    reqID:requestID,
                    header:{'Content-Type': 'text/plain'},
                    data:{
                        response:{
                            "$":{"type":"s2s"},
                            "status":["accepted"],
                            "status-code":[1],
                            "servers":[
                                {"server":serverArray}
                            ]
                        }
                    }
                }
            });
        } else {
            requestID = cluster.worker.id + "::" + Date.now() + crypto.randomBytes(4).toString('base64');

            s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID] = function(data){
                var header = data.header;
                var res = data.data;
                response.writeHead(200, "OK", header);
                response.end(xmlBuilder.buildObject(res));

                delete s2sObj.dbWrapper.callbackHashTable['s2sWorker'+requestID];
            };
            process.send({
                messageType:"s2sMaster",
                payload:{
                    workerID:cluster.worker.id,
                    reqID:requestID,
                    data:request
                }
            });
        }
    }
};

module.exports = s2sObj;

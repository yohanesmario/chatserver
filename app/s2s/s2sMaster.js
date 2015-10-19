'use strict';

var include = require('include');
var cluster = include('cluster');
var async = include('async');
var xml2js = include('xml2js');
var parseString = xml2js.parseString;

var s2sObj = {
    dbWrapper:null,
    cfg:null,
    s2sClient:null,

	handle: function(request){
        var method = request.data.method[0];
		switch(method) {
            case 'registrasiServer': {
                s2sObj.registrasiServer(request);
            } break;
            case 'loginServer': {
                s2sObj.loginServer(request);
            } break;
            case 'registrasiClient': {
                s2sObj.registrasiClient(request);
            } break;
            case 'loginClient': {
                s2sObj.loginClient(request);
            } break;
            case 'chatSendClient': {
                s2sObj.chatSendClient(request);
            } break;
            case 'logoutClient': {
                s2sObj.logoutClient(request);
            } break;
            case 'logoutServer': {
                s2sObj.logoutServer(request);
            } break;
            case 'serverHeartbeat': {
                s2sObj.serverHeartbeat(request);
            } break;
            case 'listRegisteredServer': {
                s2sObj.listRegisteredServer(request);
            } break;
        }
	},

    registrasiServer:function(request){
        var requestID, hash;
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
    },

    loginServer:function(request){
        var requestID, sessid, hash;
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
    },

    registrasiClient:function(request){
        var requestID;
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
            s2sObj.dbWrapper.queueSaving();

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
    },

    loginClient:function(request){
        var requestID;
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
    },

    chatSendClient:function(request){
        var requestID;
        requestID = request.reqID;
        var workerID = request.workerID;
        request = request.data;

        var inserted = s2sObj.dbWrapper.chatHistory.insert({
            "username":request.param[0].$.username,
            "time":parseInt(request.param[0].$.time),
            "message":request.param[0].$.message
        });
        s2sObj.dbWrapper.queueSaving();

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
    },

    logoutClient:function(request){
        var requestID;
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
    },

    logoutServer:function(request){
        var requestID;
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
    },

    serverHeartbeat:function(request){
        var requestID;
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
    },

    listRegisteredServer:function(request){
        var requestID;
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
    }
};

module.exports = s2sObj;

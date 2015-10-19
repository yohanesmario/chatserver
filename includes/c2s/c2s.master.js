'use strict';

var cluster = require('cluster');
var async = require('async');

var c2sObj = {
    dbWrapper:null,
    cfg:null,
    s2sClient:null,

    initWorker:function(workerID){
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
    },

	handle: function(request){
        var method = request.data.method[0];
		switch(method) {
            case 'login': {
                c2sObj.login(request);
            } break;
            case 'register': {
                c2sObj.register(request);
            } break;
            case 'logout': {
                c2sObj.logout(request);
            } break;
            case 'chatSend': {
                c2sObj.chatSend(request);
            } break;
            case 'chatGet': {
                c2sObj.chatPull(request);
            } break;
            case 'heartbeat': {
                c2sObj.heartbeat(request);
            } break;
        }
	},

    login: function(request){
        var requestID, hash, sessid;
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
    },

    logout: function(request){
        var requestID;
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
    },

    register: function(request){
        var requestID, hash;
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
    },

    chatSend:function(request){
        var requestID;
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
    },

    chatGet:function(request){
        var requestID;
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
    },
    
    heartbeat:function(request){
        var requestID;
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
    }
};

module.exports = c2sObj;

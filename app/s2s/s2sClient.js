'use strict';
var include = require('include');
var http = include('http');
var async = include('async');
var xml2js = include('xml2js');
var logWrapper = include('app.tools.logWrapper');
var parseString = xml2js.parseString;
var xmlBuilder = new xml2js.Builder();

var s2sClient = {
    dbWrapper:null,
    cfg:null,

    post: function(host, port, data, success, error){
        var options = {
            hostname: host,
            port: port,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length
            }
        };
        var req = http.request(options, function(res){
            res.setEncoding('utf8');
            var result = "";
            res.on('data', function (chunk) {
                result += chunk;
            });
            res.on('end', function() {
                if (success!=null) {
                    success(result);
                }
            });
        });
        req.on('error', function(e) {
            if (error!=null) {
                error(e);
            }
        });
        req.write(data);
        req.end();
    },

    initConnection: function(cfg, cb){
        s2sClient.listRegisteredServer(cfg.serverHook.ip, cfg.serverHook.port, function(result){
            parseString(result, function(err, data){
                if (data!=null && data.response!=null && data.response.$!=null && data.response.$.type!=null && data.response.$.type==='s2s') {
                    var maxCount = data.response.servers[0].server.length;
                    var countNow = 0;
                    var loginCallback = function(ip, port, r){
                        parseString(r, function(err, d){
                            var ipPort = ip+":"+port;
                            var res = s2sClient.dbWrapper.servers.find({'ipPort': ipPort});
                            if (res!=null && res.length===1 && res[0].mysessid==null) {
                                res[0].mysessid = d.response.sessid[0];
                                s2sClient.dbWrapper.servers.update(res[0]);

                                var i;
                                if (d.response.messages[0].message!=null) {
                                    for (i = 0; i < d.response.messages[0].message.length; i++) {
                                        var msgTemp = s2sClient.dbWrapper.chatHistory.find({"$and":[
                                            {"username":d.response.messages[0].message[i].$.username},
                                            {"time":parseInt(d.response.messages[0].message[i].$.time)},
                                            {"message":d.response.messages[0].message[i].$.message}
                                        ]});
                                        if (!(msgTemp!=null && msgTemp.length>0)) {
                                            var msg = s2sClient.dbWrapper.chatHistory.insert({
                                                "username":d.response.messages[0].message[i].$.username,
                                                "time":parseInt(d.response.messages[0].message[i].$.time),
                                                "message":d.response.messages[0].message[i].$.message
                                            });
                                            s2sClient.dbWrapper.queueC2SWorkerChatSend({
                                                '$loki':msg.$loki,
                                                'username':msg.username,
                                                'time':msg.time,
                                                'message':msg.message
                                            });
                                        }
                                    }
                                    s2sClient.dbWrapper.queueSaving();
                                }

                                if (d.response.users[0].user!=null) {
                                    for (i = 0; i < d.response.users[0].user.length; i++) {
                                        var usrTemp = s2sClient.dbWrapper.users.find({"username":d.response.users[0].user[i].$.username});

                                        if (!(usrTemp!=null && usrTemp.length>0)) {
                                            var loggedIn = d.response.users[0].user[i].$.loggedIn;
                                            if (loggedIn==="false") {loggedIn=false;} else {loggedIn=true;}
                                            var usrSessid = d.response.users[0].user[i].$.sessid;
                                            if (usrSessid==="null") {usrSessid=null;}
                                            var handlerIpPort = d.response.users[0].user[i].$.handlerIpPort;
                                            if (loggedIn===false) {handlerIpPort=null;}
                                            s2sClient.dbWrapper.users.insert({
                                                "username":d.response.users[0].user[i].$.username,
                                                "password":d.response.users[0].user[i].$.password,
                                                "loggedIn":loggedIn,
                                                "sessid":usrSessid,
                                                "heartbeat":null,
                                                "handledByMe":false,
                                                "handlerIpPort":handlerIpPort
                                            });
                                        }
                                    }
                                    s2sClient.dbWrapper.queueSaving();
                                }

                                async.setImmediate(function(){
                                    if (cb!=null) {
                                        countNow++;
                                        if (countNow===maxCount) {
                                            cb();
                                        }
                                    }
                                });
                            }
                        });
                    };

                    var registerCallback = function(ip, port, r){
                        parseString(r, function(){
                            s2sClient.loginServer(ip, port, function(loginResult){
                                loginCallback(ip, port, loginResult);
                            }, function(e){
                                logWrapper.log(e);
                                async.setImmediate(function(){
                                    if (cb!=null) {
                                        countNow++;
                                        if (countNow===maxCount) {
                                            cb();
                                        }
                                    }
                                });
                            });
                        });
                    };

                    var registerErrorCallback = function(e){
                        logWrapper.log(e);
                        async.setImmediate(function(){
                            if (cb!=null) {
                                countNow++;
                                if (countNow===maxCount) {
                                    cb();
                                }
                            }
                        });
                    };

                    for (var i = 0; i < data.response.servers[0].server.length; i++) {
                        if (data.response.servers[0].server[i].$.ip!==cfg.identifier.ip || parseInt(data.response.servers[0].server[i].$.port)!==parseInt(cfg.identifier.port)) {
                            s2sClient.registerServer(
                                data.response.servers[0].server[i].$.ip,
                                data.response.servers[0].server[i].$.port,
                                data.response.servers[0].server[i].$.password,
                                registerCallback,
                                registerErrorCallback
                            );
                        } else {
                            maxCount--;
                        }
                    }
                } else {

                }
            });
        });
    },

    listRegisteredServer: function(host, port, cb){
        s2sClient.post(host, port, xmlBuilder.buildObject({
            request:{
                $:{type:"s2s"},
                "method":["listRegisteredServer"]
            }
        }), cb, function(e){
            logWrapper.log('problem with request: ' + e.message);
        });
    },

    registerServer:function(host, port, hash, cb, errorCB){
        var ipPort = host+":"+port;
        s2sClient.dbWrapper.servers.insert({
            "ipPort":ipPort,
            "ip":host,
            "port":parseInt(port),
            "password":hash,
            "loggedIn":false,
            "sessid":null,
            "mysessid":null,
            "heartbeat":null
        });

        var data = xmlBuilder.buildObject({
            request:{
                $:{type:"s2s"},
                "method":["registrasiServer"],
                "param":[{
                    "$":{
                        "ip":s2sClient.cfg.identifier.ip,
                        "port":s2sClient.cfg.identifier.port,
                        "password":s2sClient.cfg.password
                    }
                }]
            }
        });
        s2sClient.post(host, port, data, function(result){
            cb(host, port, result);
        }, function(e){
            if (errorCB==null) {
                logWrapper.log('problem with request: ' + e.message);
            } else {
                errorCB(e);
            }
        });
    },

    loginServer:function(host, port, cb, errorCB){
        var data = xmlBuilder.buildObject({
            request:{
                $:{type:"s2s"},
                "method":["loginServer"],
                "param":[{
                    "$":{
                        "ip":s2sClient.cfg.identifier.ip,
                        "port":s2sClient.cfg.identifier.port,
                        "password":s2sClient.cfg.password
                    }
                }]
            }
        });
        s2sClient.post(host, port, data, cb, function(e){
            if (errorCB==null) {
                logWrapper.log('problem with request: ' + e.message);
            } else {
                errorCB(e);
            }
        });
    },

    serverHeartbeat:function(host, port, sessid, cb){
        var data = xmlBuilder.buildObject({
            request:{
                $:{type:"s2s"},
                "method":["serverHeartbeat"],
                "param":[{
                    "$":{
                        "sessid":sessid
                    }
                }]
            }
        });
        s2sClient.post(host, port, data, cb, function(e){
            logWrapper.log('problem with request: ' + e.message);
        });
    },

    startHeartbeat:function(){
        var beat = function(){
            var srv = s2sClient.dbWrapper.servers.find({"$and":[
                {"loggedIn":true},
                {"mysessid":{"$ne":null}}
            ]});
            var emptyFunction = function(){};
            for (var i = 0; i < srv.length; i++) {
                s2sClient.serverHeartbeat(srv[i].ip, srv[i].port, srv[i].mysessid, emptyFunction);
            }
            setTimeout(function(){
                beat();
            }, 60000);
        };
        setTimeout(function(){
            beat();
        }, 60000);
    },

    chatSendClient:function(host, port, message, cb){
        var data = xmlBuilder.buildObject({
            request:{
                $:{type:"s2s"},
                "method":["chatSendClient"],
                "param":[{
                    "$":{
                        "username":message.username,
                        "time":message.time,
                        "message":message.message
                    }
                }]
            }
        });
        s2sClient.post(host, port, data, cb, function(e){
            logWrapper.log('problem with request: ' + e.message);
        });
    },

    loginClient:function(username, csessid, cb){
        var srv = s2sClient.dbWrapper.servers.find({"$and":[
            {"loggedIn":true},
            {"mysessid":{"$ne":null}}
        ]});
        var errorHandler = function(e){
            logWrapper.log('problem with request: ' + e.message);
        };
        for (var i = 0; i < srv.length; i++) {
            var data = xmlBuilder.buildObject({
                request:{
                    $:{type:"s2s"},
                    "method":["loginClient"],
                    "param":[{
                        "$":{
                            "username":username,
                            "csessid":csessid,
                            "sessid":srv[i].mysessid
                        }
                    }]
                }
            });
            s2sClient.post(srv[i].ip, srv[i].port, data, cb, errorHandler);
        }
    },

    logoutClient:function(csessid, cb){
        var srv = s2sClient.dbWrapper.servers.find({"$and":[
            {"loggedIn":true},
            {"mysessid":{"$ne":null}}
        ]});
        var errorHandler = function(e){
            logWrapper.log('problem with request: ' + e.message);
        };
        for (var i = 0; i < srv.length; i++) {
            var data = xmlBuilder.buildObject({
                request:{
                    $:{type:"s2s"},
                    "method":["logoutClient"],
                    "param":[{
                        "$":{
                            "csessid":csessid,
                            "sessid":srv[i].mysessid
                        }
                    }]
                }
            });
            s2sClient.post(srv[i].ip, srv[i].port, data, cb, errorHandler);
        }
    },

    registerClient:function(username, hash, cb){
        var srv = s2sClient.dbWrapper.servers.find({"$and":[
            {"loggedIn":true},
            {"mysessid":{"$ne":null}}
        ]});
        var errorHandler = function(e){
            logWrapper.log('problem with request: ' + e.message);
        };
        for (var i = 0; i < srv.length; i++) {
            var data = xmlBuilder.buildObject({
                request:{
                    $:{type:"s2s"},
                    "method":["registrasiClient"],
                    "param":[{
                        "$":{
                            "username":username,
                            "password":hash,
                            "sessid":srv[i].mysessid
                        }
                    }]
                }
            });
            s2sClient.post(srv[i].ip, srv[i].port, data, cb, errorHandler);
        }
    },

    logoutServer:function(cb, error){
        var srv = s2sClient.dbWrapper.servers.find({"$and":[
            {"loggedIn":true},
            {"mysessid":{"$ne":null}}
        ]});
        var errorHandler = function(e){
            if (error!=null) {
                error(e);
            } else {
                logWrapper.log('problem with request: ' + e.message);
            }
        };
        for (var i = 0; i < srv.length; i++) {
            var data = xmlBuilder.buildObject({
                request:{
                    $:{type:"s2s"},
                    "method":["logoutServer"],
                    "param":[{
                        "$":{
                            "sessid":srv[i].mysessid
                        }
                    }]
                }
            });

            s2sClient.post(srv[i].ip, srv[i].port, data, cb, errorHandler);

            srv[i].loggedIn = false;
            srv[i].sessid = null;
            srv[i].mysessid = null;
            srv[i].heartbeat = null;
            s2sClient.dbWrapper.servers.update(srv[i]);
        }
    }
};

module.exports = s2sClient;

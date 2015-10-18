'use strict';

var cluster = require('cluster');
var loki = require('lokijs');
var async = require('async');
var logWrapper = require('./logWrapper.js');
var savingQueue = false;
var savingExec = false;
var sendingQueue = [];
var c2sWorkerChatSendStarted = false;

module.exports = {};
module.exports.init = function(cfg) {
    module.exports.dbName = cfg.dbName;
    module.exports.db = new loki('./db/' + cfg.dbName + '.json');
    module.exports.cfg = cfg;
    module.exports.users = null;
    module.exports.chatHistory = null;
    module.exports.servers = null;

    return module.exports;
};
module.exports.queueC2SWorkerChatSend = function(obj){
    sendingQueue.push(obj);
    if (c2sWorkerChatSendStarted===false) {
        c2sWorkerChatSendStarted = true;
        async.setImmediate(function(){
            module.exports.c2sWorkerChatSend();
        });
    }
};
module.exports.c2sWorkerChatSend = function(){
    if (sendingQueue.length>0) {
        for (var key in cluster.workers) {
            if (cluster.workers[key]!=null) {
                cluster.workers[key].send({
                    messageType:"c2sWorkerChatSend",
                    payload:sendingQueue
                });
            }
        }
        sendingQueue.length = 0;
    }
    c2sWorkerChatSendStarted = false;
};
module.exports.queueSaving = function(){
    // MANTRA: Event-loop will never have race-condition. We are still inside of event-loop. :)
    if (savingQueue===false && module.exports.db!=null) { // No queue, means no pending save
        savingQueue = true;
        async.setImmediate(function(){
            module.exports.execSaving();
        });
    }
};
module.exports.execSaving = function(){
    // MANTRA: Event-loop will never have race-condition. We are still inside of event-loop. :)
    if (savingQueue===true && savingExec===false && module.exports.db!=null) { // There's queue, please execute save
        savingExec = true;
        savingQueue = false;
        module.exports.db.saveDatabase(function(){
            savingExec = false;
            async.setImmediate(function(){
                module.exports.execSaving();
            });
        });
    }
};
module.exports.flush = function(cb) {
    var iteration = 0;
    module.exports.logoutAllUsers(function(){
        iteration++;
        if (cb!=null && iteration===2) {
            cb();
        }
    });
    module.exports.removeAllServers(function(){
        iteration++;
        if (cb!=null && iteration===2) {
            cb();
        }
    });
};
module.exports.drop = function(cb) {
    var iteration = 0;
    module.exports.removeAllUsers(function(){
        iteration++;
        if (cb!=null && iteration===3) {
            cb();
        }
    });
    module.exports.deleteAllMessages(function(){
        iteration++;
        if (cb!=null && iteration===3) {
            cb();
        }
    });
    module.exports.removeAllServers(function(){
        iteration++;
        if (cb!=null && iteration===3) {
            cb();
        }
    });
};
module.exports.logoutAllUsers = function(cb){
    var users = module.exports.users.find({"$loki":{"$gt":-Infinity}});
    async.each(users, function(user, callback){
        user.loggedIn = false;
        user.heartbeat = null;
        user.sessid = null;
        module.exports.users.update(user);
        async.setImmediate(function(){
            callback();
        });
    }, function() {
        module.exports.queueSaving();
        async.setImmediate(function(){
            if (cb!=null) {
                cb();
            }
        });
    });
};
module.exports.removeAllUsers = function(cb){
    var users = module.exports.users.find({"$loki":{"$gt":-Infinity}});
    async.each(users, function(user, callback){
        if (user!=null) {
            module.exports.users.remove(user);
        }
        async.setImmediate(function(){
            callback();
        });
    }, function() {
        module.exports.queueSaving();
        async.setImmediate(function(){
            if (cb!=null) {
                cb();
            }
        });
    });
};
module.exports.deleteAllMessages = function(cb){
    var chats = module.exports.chatHistory.find({'$loki':{'$gt':-Infinity}});
    async.each(chats, function(chat, callback){
        if (chat!=null) {
            module.exports.chatHistory.remove(chat);
        }
        async.setImmediate(function(){
            callback();
        });
    }, function() {
        module.exports.queueSaving();

        for (var key in cluster.workers) {
            cluster.workers[key].send({
                messageType:"flush"
            });
        }

        async.setImmediate(function(){
            if (cb!=null) {
                cb();
            }
        });
    });
};
module.exports.removeAllServers = function(cb){
    var servers = module.exports.servers.find({'$loki':{'$gt':-Infinity}});
    async.each(servers, function(server, callback){
        if (server!=null) {
            module.exports.servers.remove(server);
        }
        async.setImmediate(function(){
            callback();
        });
    }, function() {
        module.exports.queueSaving();

        async.setImmediate(function(){
            if (cb!=null) {
                cb();
            }
        });
    });
};
module.exports.loadDatabase = function(callback){
    module.exports.db.loadDatabase({}, function(){
        var newDB = false;

        module.exports.users = module.exports.db.getCollection('users');
        module.exports.chatHistory = module.exports.db.getCollection('chatHistory');
        module.exports.servers = module.exports.db.getCollection('servers');
        if (module.exports.users==null) {
            newDB = true;
            module.exports.users = module.exports.db.addCollection('users');
            module.exports.users.ensureUniqueIndex('username');
            module.exports.users.ensureIndex('sessid');
        }
        if (module.exports.chatHistory==null) {
            module.exports.chatHistory = module.exports.db.addCollection('chatHistory');
        }
        if (module.exports.servers==null) {
            module.exports.servers = module.exports.db.addCollection('servers');
            module.exports.users.ensureUniqueIndex('ipPort');
            module.exports.users.ensureIndex('sessid');
        }
        if (module.exports.cfg.persistDB===true) {
            module.exports.flush(function(){
                module.exports.queueSaving();
            });
        } else {
            module.exports.drop(function(){
                module.exports.queueSaving();
            });
        }

        function cleanupUser(usersObj) {
            var invalidUsers = usersObj.find({'$and':[{'loggedIn':true}, {'handledByMe':true}, {'heartbeat':{'$lt':(Date.now()-(600000))}}]}); // less than ten minutes ago

            for (var i = 0; i < invalidUsers.length; i++) {
                invalidUsers[i].loggedIn = false;
                invalidUsers[i].heartbeat = null;
                invalidUsers[i].sessid = null;
                invalidUsers[i].handledByMe = false;
                invalidUsers[i].handlerIpPort = null;
                usersObj.update(invalidUsers[i]);
            }

            setTimeout(function(){
                cleanupUser(usersObj);
            }, 60000); // Execute cleanup every 1 minute.
        }

        function cleanupServer(serversObj, usersObj) {
            var invalidServers = serversObj.find({'$and':[{'loggedIn':true}, {'heartbeat':{'$lt':(Date.now()-(600000))}}]}); // less than ten minutes ago
            var invalidUsers;

            for (var i = 0; i < invalidServers.length; i++) {
                invalidServers[i].loggedIn = false;
                invalidServers[i].heartbeat = null;
                invalidServers[i].sessid = null;
                invalidServers[i].mysessid = null;
                serversObj.update(invalidServers[i]);

                invalidUsers = usersObj.find({"handlerIpPort":invalidServers[i].ipPort});

                for (var j = 0; j < invalidUsers.length; j++) {
                    invalidUsers[j].loggedIn = false;
                    invalidUsers[j].heartbeat = null;
                    invalidUsers[j].sessid = null;
                    invalidUsers[j].handledByMe = false;
                    invalidUsers[j].handlerIpPort = null;
                    usersObj.update(invalidUsers[j]);
                }
            }

            setTimeout(function(){
                cleanupServer(serversObj, usersObj);
            }, 60000); // Execute cleanup every 1 minute.
        }

        setTimeout(function(){
            cleanupUser(module.exports.users);
            cleanupServer(module.exports.servers, module.exports.users);
        }, 60000);

        if (newDB) {
            logWrapper.log(module.exports.dbName + " database has been successfully created.");
        } else {
            logWrapper.log(module.exports.dbName + " database has been successfully loaded.");
        }

        callback();
    });
};

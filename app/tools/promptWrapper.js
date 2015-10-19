'use strict';

var include = require('include');
var cc = include("app.tools.clusterCounter");
var numWorkers = cc.numWorkers;

var fs = include('fs');
var cluster = include('cluster');
var prompt = include('prompt');
var async = include('async');
var s2sClient = include('app.s2s.s2sClient');
prompt.start();
prompt.colors = false;
prompt.message = "";
prompt.delimiter = "";
var promptEventHandled = false;
var dbWrapper = null;
var s2sClient = null;

// var commandText = colors.inverse(">");
var commandText = ">";

var startReading = function(){
    async.setImmediate(function(){
        execPrompt();
    });
};

var continueReading = startReading;

var execPrompt = function() {
    prompt.get([commandText], function(err, result){
        if (err==null) {
            switch(result[commandText]) {
                case 'help': {
                    fs.readFile("./help/main.txt", function(err, file){
                        if (err==null) {
                            console.log(file+'');
                        } else {
                            console.log(err);
                        }

                        continueReading();
                    });
                } break;
                case 'exit': {
                    var doExit = function(){
                        var workerCount = 0;
                        cluster._events.exit = function() {
                            workerCount++;
                            if (workerCount===numWorkers) {
                                console.log("Server terminated");
                                console.log("Goodbye");
                                process.exit(0);
                            }
                        };
                        cluster._eventsCount = 1;
                        console.log("Terminating workers...");
                        async.setImmediate(function(){
                            for (var key in cluster.workers) {
                                cluster.workers[key].send({
                                    messageType:"killWorker"
                                });
                            }
                        });
                    };
                    var srv = s2sClient.dbWrapper.servers.find({"$and":[
                        {"loggedIn":true},
                        {"mysessid":{"$ne":null}}
                    ]});
                    if (srv!=null && srv.length>0) {
                        var countExit = 0;
                        var maxCountExit = srv.length;
                        console.log("Logging out from network...");
                        s2sClient.logoutServer(function(){
                            countExit++;
                            if (countExit===maxCountExit) {
                                doExit();
                            }
                        }, function(){
                            countExit++;
                            if (countExit===maxCountExit) {
                                doExit();
                            }
                        });
                    } else {
                        doExit();
                    }
                } break;
                case 'flush': {
                    dbWrapper.flush(function(){
                        console.log("System flushed.");
                        continueReading();
                    });
                } break;
                case 'logout all': {
                    dbWrapper.logoutAllUsers(function(){
                        console.log("All users logged-out.");
                        continueReading();
                    });
                } break;
                default: {
                    console.log("Unknown command '" + result[commandText] + "'. Type 'help' for list of commands.");
                    continueReading();
                } break;
            }
        } else {
            console.log(err);
            continueReading();
        }
    });
};

module.exports = {};
module.exports.startReading = function(dbWrp, s2sCli){
    if (promptEventHandled===false) {
        promptEventHandled = true;
        process.on('console', function(){
            process.stdout.write(commandText+" ");
        });
    }
    dbWrapper = dbWrp;
    s2sClient = s2sCli;
    startReading();
};
var cc = require("./clusterCounter.js");
var numCPUs = cc.numCPUs;
var numWorkers = cc.numWorkers;

var fs = require('fs');
var cluster = require('cluster');
var prompt = require('prompt');
var logWrapper = require('./logWrapper.js');
var colors = require('colors/safe');
var async = require('async');
var s2sClient = require('./s2sClient.js');
prompt.start();
prompt.colors = false;
prompt.message = "";
prompt.delimiter = "";
var promptEventHandled = false;
var dbWrapper = null;

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
                    var workerCount = 0;
                    cluster._events.exit = function(worker, code, signal) {
                        workerCount++;
                        if (workerCount==numWorkers) {
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
module.exports.startReading = function(dbWrp){
    if (promptEventHandled==false) {
        promptEventHandled = true;
        process.on('console', function(data){
            process.stdout.write(commandText+" ");
        });
    }
    dbWrapper = dbWrp;
    startReading();
};

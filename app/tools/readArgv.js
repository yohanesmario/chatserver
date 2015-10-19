'use strict';

var include = require('include');
var fs = include('fs');
var os = include('os');
var ifaces = os.networkInterfaces();
var cluster = include('cluster');
var crypto = include('crypto');
var sha512 = null;

var objectSize = function(obj){
    var size = 0;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            size++;
        }
    }
    return size;
};

module.exports = {};

module.exports.init = function(processObj) {
    var config = null;
    var port = 1337;
    var ip = null;
    var password = "admin";
    var hash = null;
    var dbName = "mainDB1";
    var serverHook = null;
    var persistDB = false;
    var identifier = {
        ip:"127.0.0.1",
        port:port,
    };

    if (processObj.argv.length>=3) {
    	var argvBucket = '';
    	for (i=2; i<processObj.argv.length; i++) {
    		argvBucket += processObj.argv[i];
    		if (i+1<processObj.argv.length) {
    			argvBucket += ' ';
    		}
    	}

        config = JSON.parse(fs.readFileSync(argvBucket)+'');

        if (config!=null) {
            if (config.port!=null) {
                port = parseInt(config.port);
                identifier.port = port;
            }
            if (config.ip!=null) {
                ip = config.ip;
                identifier.ip = ip;
            } else {
                if (objectSize(ifaces)>1) {
                    for (var key in ifaces) {
                        if (ifaces.hasOwnProperty(key)) {
                            for (var i = 0; i < ifaces[key].length; i++) {
                                if (ifaces[key][i].family==='IPv4' && ifaces[key][i].address!=='127.0.0.1') {
                                    identifier.ip = ifaces[key][i].address;
                                }
                            }
                        }
                    }
                }
            }
            if (config.password!=null) {
                password = config.password;
            }
            if (config.dbName!=null) {
                dbName = config.dbName;
            }
            if (config.persistDB!=null) {
                persistDB = config.persistDB;
            }
            if (config.serverHook!=null) {
                serverHook = config.serverHook;
            }
        }

        if (cluster.isMaster) {
            console.log(argvBucket + " configuration file has been successfully read.");
            console.log("Server Identifier:", identifier.ip+":"+identifier.port);
        }
    } else {
        if (cluster.isMaster) {
            console.log('No config file. Using default settings...');
            console.log("Server Identifier:", identifier.ip+":"+identifier.port);
        }
    }

    sha512 = crypto.createHash('sha512');
    sha512.update(password);
    hash = sha512.digest('hex');

    module.exports.config = config;
    module.exports.port = port;
    module.exports.ip = ip;
    module.exports.password = password;
    module.exports.hash = hash;
    module.exports.dbName = dbName;
    module.exports.persistDB = persistDB;
    module.exports.serverHook = serverHook;
    module.exports.identifier = identifier;

    return module.exports;
};
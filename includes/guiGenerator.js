var fs = require('fs');
var url = require('url');
var mime = require('mime-types');
var zlib = require('zlib');
var async = require('async');
var cluster = require('cluster');
var logWrapper = require('./logWrapper.js');

module.exports = {
	handle: function(request, response){
        var parsedURL = url.parse(request.url, true);

        var encoding = request.headers['accept-encoding'];
        var searchWord = 'gzip';
        var useGzip = false;

        var routeGUI = function() {
            switch(parsedURL.pathname) {
                case '/': {
                    fs.readFile('./webroot/index.html', function(err, html) {
                        if (encoding!=null && useGzip==true) {
                            zlib.gzip(html, function(err,res){
                                response.writeHead(200, {
                                    'Content-Type': 'text/html',
                                    'Content-Encoding': 'gzip'
                                });
                                response.end(res);
                            });
                        } else {
                            response.writeHead(200, {
                                'Content-Type': 'text/html'
                            });
                            response.end(html);
                        }
                    });
                } break;
                case '/benchmark': {
                    var benchmarkStr = "BENCHMARK";
                    response.writeHead(200, {
                        'Content-Type': 'text/plain'
                    });
                    response.end(benchmarkStr);
                } break;
                default: {
                    fs.readFile('./webroot'+parsedURL.pathname, function(err, file) {
                        if (err==null) {
                            if (encoding!=null && useGzip==true) {
                                zlib.gzip(file, function(err,res){
                                    response.writeHead(200, {
                                        'Content-Type': mime.lookup('./webroot'+parsedURL.pathname),
                                        'Content-Encoding': 'gzip'
                                    });
                                    response.end(res);
                                });
                            } else {
                                response.writeHead(200, {
                                    'Content-Type': mime.lookup('./webroot'+parsedURL.pathname)
                                });
                                response.end(file);
                            }
                        } else {
                            fs.readFile('./webroot/404.html', function(err, html) {
                                if (encoding!=null && useGzip==true) {
                                    zlib.gzip(html, function(err,res){
                                        response.writeHead(404, {
                                            'Content-Type': 'text/html',
                                            'Content-Encoding': 'gzip'
                                        });
                                        response.end(res);
                                    });
                                } else {
                                    response.writeHead(404, {
                                        'Content-Type': 'text/html'
                                    });
                                    response.end(html);
                                }
                            });
                        }
                    });
                } break;
            }
        };

        if (encoding!=null) { // if encoding is not null, there's a chance that gzip is accepted
            var start = 0;
            var end = encoding.length-searchWord.length;
            var curr = start;
            if (end<0) { // if encoding is shorter than the word 'gzip', it can't be gzip.
                routeGUI();
            } else {
                // Search for 'gzip' encoding (async)
                async.whilst(
                    function(){
                        if (curr<=end) {
                            var test = true;
                            for (var i = curr; i < curr+searchWord.length; i++) {
                                iSearch = i-curr;
                                if (encoding.charAt(i)!=searchWord.charAt(iSearch)) {
                                    test = false;
                                }
                            }
                            if (test==true) { // gzip encoding is accepted, get out of loop and route GUI.
                                useGzip = true;
                                return false;
                            } else {
                                return true;
                            }
                        } else {
                            return false;
                        }
                    },
                    function(callback){
                        curr++;
                        async.setImmediate(function(){
                            callback();
                        });
                    },
                    function(err){
                        routeGUI();
                    }
                );
            }
        } else {
            routeGUI();
        }
	}
};

var http = require('http');
var cluster = require('cluster');

if (cluster.isMaster) {
    for (var i = 0; i < 8; i++) {
        cluster.fork();
    }
} else {
    var mongodb = require('mongodb');
    var MongoClient = mongodb.MongoClient;
    var url = 'mongodb://localhost:27017/test2';

    var server = http.Server(function(request, response){
        if (request.method=='GET') {
            // Use connect method to connect to the Server
            MongoClient.connect(url, function (err, db) {
                if (err) {
                    console.log('Unable to connect to the mongoDB server. Error:', err);
                } else {
                    //HURRAY!! We are connected. :)

                    var collection = db.collection('chatHistory');
                    collection.find().toArray(function(err, result){
                        var res = "";
                        if (err) {
                            console.log(err);
                        } else if (result.length>0) {
                            res += JSON.stringify(result);
                        } else {
                            res += ("No document(s) found.");
                        }

                        response.writeHead(200, {'Content-Type':'text/plain'});
                        response.end(res);

                        db.close();
                    });
                }
            });
        } else {
            response.writeHead(500, {'Content-Type':'text/plain'});
            response.end("Server Error");
        }
    });

    var port = 1337;
    server.listen(port);
    console.log("listening on port "+port);
}

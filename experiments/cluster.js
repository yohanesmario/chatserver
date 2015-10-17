var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
    var counter = 0;
    var start = Date.now();

    cluster.on('exit', function(worker, code, signal) {
        counter++;
        if (counter==numCPUs) {
            console.log("Done!");
            console.log("TIME:", Date.now()-start);
            process.exit(0);
        }
    });

    console.log("Benchmarking...");
    var counter2 = 0;
    // Fork workers.
    for (var i = 0; i < numCPUs; i++) {
        cluster.fork().on('message', function(){
            counter2++;
            if (counter2==8) {
                counter2 = 0;
                console.log("["+Date.now()+"] workers are still alive.");
            }
        });
    }
} else {
    var i=0;

    var doSomeMath = function(){
        i++;
        if (i<1e9) {
            setImmediate(function(){
                doSomeMath();
            });
        } else {
            cluster.worker.kill();
        }
    }

    setImmediate(function(){
        doSomeMath();
    });

    setInterval(function(){
        process.send("I'M ALIVE");
    }, 2000);
}

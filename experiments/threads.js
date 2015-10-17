var Worker = require('webworker-threads').Worker;
// var w = new Worker('worker.js'); // Standard API

var data = {"test":"test"};

// You may also pass in a function:
var worker = new Worker(function(){
    postMessage("I'm working before postMessage('ali').");
    this.onmessage = function(event) {
        event.data.test = "LALALALA";
        postMessage(event.data);
        // self.close();
    };
});
worker.onmessage = function(event) {
    console.log(event.data);
    console.log(data);
};
worker.postMessage({"test":"test"});

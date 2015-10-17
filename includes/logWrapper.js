var cluster = require('cluster');

module.exports = {};
module.exports.log = function(str){
    if (cluster.isMaster) {
        console.log(str);
        process.emit('console');
    } else {
        process.send({
            messageType:"log",
            payload:str
        });
    }
};

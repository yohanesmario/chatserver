var os = require('os');

module.exports = {};

// Number of logical processor
module.exports.numCPUs = os.cpus().length;

// Number of worker is the total of logical processor - 1 to make room for master
module.exports.numWorkers = ((module.exports.numCPUs-1===0)?(1):(module.exports.numCPUs-1));

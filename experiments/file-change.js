var fs = require('fs');
var lastFile = null;
var file = null;
var interval = 150;

function scan() {
    fs.readFile("./test.dat", function(err, data){
        file = data.toString();

        if (lastFile!=null && lastFile!=file) {
            console.log("File Changed!", Date.now());
            fs.writeFile("./test.backup.dat", file, function(err, data){
                setTimeout(function(){
                    scan();
                }, interval);
            });
        } else {
            setTimeout(function(){
                scan();
            }, interval);
        }

        lastFile = file;
    });
}

scan();

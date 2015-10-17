var http = require('http');
var xml2js = require('xml2js');
var parseString = xml2js.parseString;
var xmlBuilder = new xml2js.Builder();

var createPost = function(password){
    var postData = "getpage=html%2Findex.html&errorpage=html%2Fmain.html&var%3Amenu=setup&var%3Apage=wizard&obj-action=auth&%3Ausername=admin&%3Apassword="+password+"&%3Aaction=login";
    return postData;
}

var doPost = function(host, port, path, data, success, error){
    var postData = xmlBuilder.buildObject({
        request:{
            $:{type:"s2s"},
            "method":["listRegisteredServer"]
        }
    });
    var options = {
        hostname: host,
        port: port,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cache-Control': 'no-cache',
            'Content-Length': postData.length,
            "Connection": "keep-alive",
            "Origin": "chrome-extension://mkhojklkhkdaghjjfdnphfphiaiohkef",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.71 Safari/537.36",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "en-US,en;q=0.8,af;q=0.6,id;q=0.4,ms;q=0.2",
            "Cookie": "sys_UserName=admin; language=en_us; sessionid=762511fe"
        }
    };
    var req = http.request(options, function(res){
        res.setEncoding('utf8');
        var result = "";
        res.on('data', function (chunk) {
            result += chunk;
        });
        res.on('end', function() {
            if (success!=null) {
                success(result);
            }
        })
    });
    req.on('error', function(e) {
        if (error!=null) {
            error(e);
        }
    });
    req.write(data);
    req.end();
};

doPost("192.168.1.1", 80, "/cgi-bin/webproc", createPost("test"), function(result){
    console.log(result);
}, function(e){
    console.log(e);
});

var appHelper = {
    "escapeHTML":function(html){
        return $("<div></div>").text(html).html();
    },
    "createXML":{
        "login":function(username, password){
            return  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                    '<request type="c2s">' +
                        '<method>login</method>' +
                        '<param user="' + appHelper.escapeHTML(username) + '" password="' + appHelper.escapeHTML(password) + '" />' +
                    '</request>';
        },
        "register":function(username, password){
            return  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                    '<request type="c2s">' +
                        '<method>register</method>' +
                        '<param user="' + appHelper.escapeHTML(username) + '" password="' + appHelper.escapeHTML(password) + '" />' +
                    '</request>';
        },
        "logout":function(sessid){
            return  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                    '<request type="c2s">' +
                        '<method>logout</method>' +
                        '<param sessid="' + appHelper.escapeHTML(sessid) + '" />' +
                    '</request>';
        },
        "chatSend":function(sessid, message){
            return  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                    '<request type="c2s">' +
                        '<method>chatSend</method>' +
                        '<param sessid="' + appHelper.escapeHTML(sessid) + '" message="' + appHelper.escapeHTML(message) + '" />' +
                    '</request>';
        },
        "chatPull":function(lastID){
            return  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                    '<request type="c2s">' +
                        '<method>chatPull</method>' +
                        '<param lastID="' + appHelper.escapeHTML(lastID) + '" />' +
                    '</request>';
        },
        "heartbeat":function(sessid){
            return  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                    '<request type="c2s">' +
                        '<method>heartbeat</method>' +
                        '<param sessid="' + appHelper.escapeHTML(sessid) + '" />' +
                    '</request>';
        }
    },
    "isLoggedIn":function($cookies){
        var res = $cookies.get("loggedIn");
        if (res=="true") {
            return true;
        } else {
            return false;
        }
    },
    "setLoggedIn":function($cookies, state, username, sessid){
        if (state===true) {
            $cookies.put("loggedIn", true);
            $cookies.put("username", username);
            $cookies.put("chatSessionID", sessid);
            return true;
        } else {
            $cookies.remove("loggedIn");
            $cookies.remove("username");
            $cookies.remove("chatSessionID");
            return false;
        }
    },
    "getUsername":function($cookies){
        return $cookies.get("username");
    },
    "getSessionID":function($cookies){
        return $cookies.get("chatSessionID");
    }
};

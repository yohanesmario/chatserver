var HttpChatController = angular.module('HttpChatController', []);

HttpChatController.controller('LoginController', ['$scope', '$http', '$cookies', '$location',
function ($scope, $http, $cookies, $location) {
    if (appHelper.isLoggedIn($cookies)) {
        $location.url("/chatroom");
    }

    $scope.alerts = [];

    $scope.addAlert = function(type, message) {
        $scope.alerts.push({ type: type, msg: message });
    };

    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };

    $("[autofocus]").focus();

    $scope.loginButton = function(){
        var data = appHelper.createXML.login($scope.username, $scope.password);
        $http.post("/", data).then(function(response){
            var responseData = $(response.data);
            var statusCode = responseData.find("status-code").text();
            var sessid = null;
            var message = null;
            if (statusCode!=null) {
                statusCode = parseInt(statusCode);
                if (statusCode===1) {
                    sessid = responseData.find("sessid").text();
                } else {
                    message = responseData.find("message").text();
                }
            }

            if (sessid!=null) {
                // Login
                $scope.addAlert("success", "Login sucessful. Please wait for a moment.");
                appHelper.setLoggedIn($cookies, true, $scope.username, sessid);
                $scope.username = "";
                $scope.password = "";
                $location.url("/");
            } else if (message!=null) {
                // Display warning
                $scope.addAlert("warning", message);
            } else {
                // Display unknown error
                $scope.addAlert("danger", "Unknown error!");
            }
        }, function(){
            $scope.addAlert("danger", "Connection error!");
        });
    };
}]);

HttpChatController.controller('RegisterController', ['$scope', '$http', '$cookies', '$location',
function($scope, $http, $cookies, $location) {
    if (appHelper.isLoggedIn($cookies)) {
        $location.url("/chatroom");
    }

    $scope.alerts = [];

    $scope.addAlert = function(type, message) {
        $scope.alerts.push({ type: type, msg: message });
    };

    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };

    $("[autofocus]").focus();

    $scope.registerButton = function(){
        var data = appHelper.createXML.register($scope.username, $scope.password);
        $http.post("/", data).then(function(response){
            var responseData = $(response.data);
            var statusCode = responseData.find("status-code").text();
            var message = null;
            if (statusCode!=null) {
                statusCode = parseInt(statusCode);
                if (statusCode!==1) {
                    message = responseData.find("message").text();
                }
            }

            if (statusCode===1) {
                // Display success
                $scope.addAlert("success", "User \""+appHelper.escapeHTML($scope.username)+"\" has been successfully registered.");
            } else if (statusCode!=null && statusCode!==1 && message!=null) {
                // Display warning
                $scope.addAlert("warning", message);
            } else {
                // Display unknown error
                $scope.addAlert("danger", "Unknown error!");
            }

            $scope.username = "";
            $scope.password = "";
        });
    };
}]);

HttpChatController.controller('ChatroomController', ['$scope', '$http', '$cookies', '$location', '$timeout', '$filter', '$modal', '$q',
function($scope, $http, $cookies, $location, $timeout, $filter, $modal, $q) {
    if (!appHelper.isLoggedIn($cookies)) {
        $location.url("/login");
    }

    $scope.animationsEnabled = true;

    var randomizer = {
        "chatPull":Date.now(),
        "loggedInUserPull":Date.now()+1,
        "heartbeat":Date.now()+2,
    };

    $scope.open = function (size, message) {
        $scope.alertMessage = message;
        var modalInstance = $modal.open({
            animation: $scope.animationsEnabled,
            templateUrl: 'myModalContent.html',
            controller: 'ModalInstanceCtrl',
            scope:$scope,
            size: size,
            resolve: {
                items: function () {
                    return $scope.items;
                }
            }
        });

        modalInstance.result.then(function (selectedItem) {
            $scope.selected = selectedItem;
        }, function () {
            console.info('Modal dismissed at: ' + new Date());
        });
    };

    $("[autofocus]").focus();

    $scope.username = appHelper.getUsername($cookies);
    $scope.connectionStatus = "online";
    $scope.placeholder = "Type your message...";
    $scope.submitDisabled = "";
    $scope.refreshRate = 100; // 1000/10fps = 100
    $scope.refreshRateFail = 2000;
    $scope.heartRate = 3000;
    $scope.heartRateFail = 1000;
    $scope.messages = [];
    $scope.users = [];
    $scope.lastID = -1;
    $scope.lastHash = 0;
    $scope.canceler = $q.defer();

    $scope.chatPull = function(){
        if ($location.url()==="/chatroom") {
            var data = appHelper.createXML.chatPull($scope.lastID);

            $http.post("/"+randomizer.chatPull, data, {timeout: $scope.canceler.promise}).then(function(response){
                var responseData = $(response.data);
                var statusCode = responseData.find("status-code").text();
                var message = null;
                if (statusCode!=null) {
                    statusCode = parseInt(statusCode);
                    if (statusCode!==1) {
                        message = responseData.find("message").text();
                    }
                }

                if (statusCode===1) {
                    $scope.connectionStatus = "online";
                    // display messages
                    if ($scope.lastID===parseInt(responseData.find("lastID").text())) {
                        // No new messages
                    } else {
                        $scope.lastID=parseInt(responseData.find("lastID").text());
                        var messagesData = responseData.find("message");
                        for (var i = 0; i < messagesData.length; i++) {
                            var thisMsg = $(messagesData[i]);
                            $scope.messages.push({
                                "sender":thisMsg.attr("username"),
                                "position":((thisMsg.attr("username")===$scope.username)?"right":"left"),
                                "color":((thisMsg.attr("username")===$scope.username)?"primary":"default"),
                                "time":parseInt(thisMsg.attr("time")),
                                "displayedTime":$filter('date')(parseInt(thisMsg.attr("time")), 'hh:mm a'),
                                "displayedDate":$filter('date')(parseInt(thisMsg.attr("time")), 'MMMM dd, yyyy'),
                                "timezone":"Timezone offset: " + $filter('date')(parseInt(thisMsg.attr("time")), 'Z'),
                                "body":thisMsg.attr("message")
                            });
                        }
                    }
                } else {
                    $scope.connectionStatus = "offline";

                    if (message!=null) {
                        // Display warning
                        console.error("[CHAT PULL]" + message);
                    } else {
                        // Display unknown error
                        console.error("[CHAT PULL] Unknown error!");
                    }
                }

                $timeout(function(){
                    $scope.chatPull();
                },$scope.refreshRate);
            }, function() {
                $scope.connectionStatus = "offline";

                $timeout(function(){
                    $scope.chatPull();
                },$scope.refreshRateFail);
            });
        }
    };

    $scope.chatPull();

    $scope.loggedInUserPull = function(){
        if ($location.url()==="/chatroom") {
            var data = appHelper.createXML.loggedInUserPull($scope.lastHash);

            $http.post("/"+randomizer.loggedInUserPull, data, {timeout: $scope.canceler.promise}).then(function(response){
                var responseData = $(response.data);
                var statusCode = responseData.find("status-code").text();
                var message = null;
                if (statusCode!=null) {
                    statusCode = parseInt(statusCode);
                    if (statusCode!==1) {
                        message = responseData.find("message").text();
                    }
                }

                if (statusCode===1) {
                    $scope.connectionStatus = "online";
                    // display messages
                    if ($scope.lastHash+""===responseData.find("lastHash").text()) {
                        // No new messages
                    } else {
                        $scope.lastHash=responseData.find("lastHash").text();
                        var usersData = responseData.find("user");
                        $scope.users.splice(0, $scope.users.length);
                        for (var i = 0; i < usersData.length; i++) {
                            var thisUsr = $(usersData[i]);
                            $scope.users.push(
                                {"username":thisUsr.attr("username")}
                            );
                        }
                    }
                } else {
                    $scope.connectionStatus = "offline";

                    if (message!=null) {
                        // Display warning
                        console.error("[LOGGED-IN USER PULL]" + message);
                    } else {
                        // Display unknown error
                        console.error("[LOGGED-IN USER PULL] Unknown error!");
                    }
                }

                $timeout(function(){
                    $scope.loggedInUserPull();
                },$scope.refreshRate);
            }, function() {
                $scope.connectionStatus = "offline";

                $timeout(function(){
                    $scope.loggedInUserPull();
                },$scope.refreshRateFail);
            });
        }
    };

    $scope.loggedInUserPull();

    $scope.heartbeat = function(){
        if ($location.url()==="/chatroom") {
            var data = appHelper.createXML.heartbeat(appHelper.getSessionID($cookies));
            $http.post("/"+randomizer.heartbeat, data).then(function(response){
                var responseData = $(response.data);
                var statusCode = responseData.find("status-code").text();
                var message = null;
                if (statusCode!=null) {
                    statusCode = parseInt(statusCode);
                    if (statusCode!==1) {
                        message = responseData.find("message").text();
                    }
                }

                if (statusCode===1) {
                    // display messages
                    $scope.connectionStatus = "online";
                } else if (message!=null) {
                    // Display warning
                    console.error("[HEARTBEAT] " + message);

                    if (statusCode===3) {
                        // Session expired. Logout immediately.
                        $scope.logoutButton();
                    }
                } else {
                    // Display unknown error
                    console.error("[HEARTBEAT] Unknown error!");
                }

                $timeout(function(){
                    $scope.heartbeat();
                },$scope.heartRate);
            }, function(){
                $scope.connectionStatus = "offline";

                $timeout(function(){
                    $scope.heartbeat();
                },$scope.heartRateFail);
            });
        }
    };

    $scope.heartbeat();

    $scope.logoutButton = function(){
        var data = appHelper.createXML.logout(appHelper.getSessionID($cookies));
        $http.post("/", data).then(function(response){
            var responseData = $(response.data);
            var statusCode = responseData.find("status-code").text();
            var message = null;
            if (statusCode!=null) {
                statusCode = parseInt(statusCode);
                if (statusCode!==1) {
                    message = responseData.find("message").text();
                }
            }

            if (statusCode===1) {
                // Logout
            } else if (message!=null) {
                // Display warning
                console.error("[LOGOUT] " + message);
            } else {
                // Display unknown error
                console.error("[LOGOUT] Unknown error!");
            }

            if (statusCode!=null) {
                $scope.canceler.resolve();
                appHelper.setLoggedIn($cookies, false);
                $location.url("/");
            }
        }, function(){
            $scope.open("sm", "Connection error!");
        });
    };

    $scope.submitAction = function(cb){
        var data = appHelper.createXML.chatSend(appHelper.getSessionID($cookies), $scope.draft);
        $scope.draft = "";
        $scope.placeholder = "Sending message...";
        $("#submitDisabled").prop('disabled', true);
        $http.post("/", data).then(function(response){
            var responseData = $(response.data);
            var statusCode = responseData.find("status-code").text();
            var message = null;
            if (statusCode!=null) {
                statusCode = parseInt(statusCode);
                if (statusCode!==1) {
                    message = responseData.find("message").text();
                }
            }

            if (statusCode===1) {
                // Refresh timeline on demand
                $scope.draft = "";
                $scope.placeholder = "Type your message...";
                $("#submitDisabled").prop('disabled', false).focus();
            } else if (message!=null) {
                // Display warning
                $scope.open("sm", message);
                $scope.draft = "";
                $scope.placeholder = "Type your message...";
                $("#submitDisabled").prop('disabled', false).focus();
            } else {
                // Display unknown error
                $scope.open("sm", "Unknown error!");
                $scope.draft = "";
                $scope.placeholder = "Type your message...";
                $("#submitDisabled").prop('disabled', false).focus();
            }

            if (cb!=null) {
                async.nextTick(function(){
                    cb();
                });
            }
        }, function() {
            $scope.open("sm", "Connection error!");
            $scope.draft = "";
            $scope.placeholder = "Type your message...";
            $("#submitDisabled").prop('disabled', false).focus();
        });
    };

    // var contentMax = 1000000;
    // var contentNow = 0;
    // var addContent = function(){
    //     $scope.draft = "DUMMY DATA";
    //     contentNow++;
    //     $scope.submitAction(function(){
    //         if (contentNow<contentMax) {
    //             addContent();
    //         }
    //     });
    // };
    //
    // async.nextTick(function(){
    //     addContent();
    // });

}]);

HttpChatController.controller('ModalInstanceCtrl', function ($scope, $modalInstance) {
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});

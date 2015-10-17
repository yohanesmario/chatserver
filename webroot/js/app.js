var httpChat = angular.module('httpChat', [
  'ngRoute',
  'ngCookies',
  'HttpChatController',
  'ui.bootstrap'
]);

httpChat.config(['$routeProvider', '$locationProvider',
function($routeProvider, $locationProvider) {
    $routeProvider.
    when('/login', {
        templateUrl: 'partials/login.html',
        controller: 'LoginController'
    }).
    when('/register', {
        templateUrl: 'partials/register.html',
        controller: 'RegisterController'
    }).
    when('/chatroom', {
        templateUrl: 'partials/chatroom.html',
        controller: 'ChatroomController'
    }).
    otherwise({
        redirectTo: '/login'
    });
}]);

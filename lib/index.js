var xtend = require('xtend');
var jwt = require('jsonwebtoken');
var socketio_jwt = require('socketio-jwt')


function authorize(options, onConnection) {
    //no querystring

    var checkIfTokenRefreshedInSharedDb, updateRefreshedTokenInSharedDb;
    var blackList, blackListIdx, maintenance;
    var defaults = { required: true, additional_auth: authorizeWithAuthCodeAndRefreshedToken, handshake: false };
    options = xtend(defaults, options);

    scheduleTokenMaintenance();

    if (options.refresh) {

        if (options.validTokenDb) {
            // just some thoughts, about having multiple nodes and ability to manage connecting on different server. but would need to think how the websocket will emit on different node...
            checkIfTokenRefreshedInSharedDb = options.validTokenDb.checkIfTokenRefreshed;
            updateRefreshedTokenInSharedDb = options.validTokenDb.updateRefreshedToken;
        }
        else {
            if (!blackList) {
                blackList = {};
                blackListIdx = [];
            }
            checkIfTokenRefreshedInSharedDb = function(token) {
                var validity = blackList[token];
                return validity;// && validity.refreshed;
            };
            updateRefreshedTokenInSharedDb = function(previousToken, newToken) {
                blackList[previousToken] = true;
                blackList[newToken] = false;
            };
        }
    }
    // idea is that the client  is aware of the token life...(decode)..and will reconnect before too late...

    return function(socket) {
        // let's listen on logout 
        socket.on('logout', function(token) {
            blackList[token] = true;
            socket.emit('logged_out');
        });
        return socketio_jwt.authorize(options)(socket);
    };



    ///////////////////////////////////////

    function scheduleTokenMaintenance() {
        maintenance = setTimeout(function() {
            console.log("maintenance");
            removeExpiredEventFromBlackList();
            scheduleTokenMaintenance();
        }, options.disposalInterval || 20000);
    }


    function removeExpiredEventFromBlackList() {
        // @TODO...we could work out of an ordered list to speed up the whole thing.
        var currentTime = (new Date().getTime() / 1000) | 0; // remove millis
        for (var token in blackList) {
            if (blackList[token].exp < currentTime) {
                delete blackList[token];
            }
        }
    }


    function authorizeWithAuthCodeAndRefreshedToken(decoded, onSuccess, onError, context) {
        // when the token is used once, a refreshed token is sent back. the old one is black listed (set as refreshed)
        // are we receiving again a token that we have already refreshed once? 
        if (options.refresh && decoded.jti && checkIfTokenRefreshedInSharedDb(context.data.token)) {
            return onError("Token is no longer valid", 'no_longer_valid');
        }
        // we are not going to call onSuccess but handle the logic here
        var newToken = refreshToken(decoded, context.data.token);
        context.socket.emit('authenticated', newToken);
    }

    //     //try getting the current namespace otherwise fallback to all sockets.
    //     var namespace = (server.nsps && socket.nsp &&
    //         server.nsps[socket.nsp.name]) ||
    //         server.sockets;

    //     // explicit namespace
    //     namespace.emit('authenticated', socket);

    function refreshToken(decoded, token) {
        // console.log("decoded:" + JSON.stringify(decoded) + ", was" + token);
        // this would make each token unique and track how many times a token was refreshed
        if (decoded.jwtId > 0) {
            decoded.jwtId += 1;
        }
        else {
            decoded.jwtId = 1;
        }
        var newToken = options.refresh(decoded);
        // we must prevent that a yet valid token be reused if it were refreshed.
        // but keep track of when the other will expire so we can inform client to get a new one..
        updateRefreshedTokenInSharedDb(token, newToken.token);
        return newToken.token;
    }
}

exports.authorize = authorize;

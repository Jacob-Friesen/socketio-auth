var xtend = require('xtend');
var jwt = require('jsonwebtoken');
var socketio_jwt = require('socketio-jwt')


function authorize(options, onConnection) {
    //no querystring

    var checkIfTokenRefreshedInSharedDb, updateRefreshedTokenInSharedDb;
    var defaults = { required: true, additional_auth: authorizeWithAuthCodeAndRefreshedToken, handshake: false };
    options = xtend(defaults, options);

    if (options.refresh) {

        if (options.validTokenDb) {
            // just some thoughts, about having multiple nodes and ability to manage connecting on different server. but would need to think how the websocket will emit on different node...
            checkIfTokenRefreshedInSharedDb = options.validTokenDb.checkIfTokenRefreshed;
            updateRefreshedTokenInSharedDb = options.validTokenDb.updateRefreshedToken;
        }
        else {
            if (!options.blackList) {
                options.blackList = {};
            }
            checkIfTokenRefreshedInSharedDb = function (token) {
                var validity = options.blackList[token];
                return validity && validity.refreshed;
            };
            updateRefreshedTokenInSharedDb = function (previousToken, newToken, expirationDate) {
                options.blackList[previousToken] = { refreshed: true };
                options.blackList[newToken] = { expiresOn: expirationDate };
            };
        }
    }


    return function (socket) {
        // let's listen on logout 
        socket.on('logout', function (token) {
            options.blackList[token] = { refreshed: true };
            socket.emit('logged_out');
        });
        return socketio_jwt.authorize(options)(socket);
    };

    
    
    ///////////////////////////////////////
    

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
        var newToken = options.refresh(decoded);

        var expirationDate = new Date(new Date().getTime() + newToken.expirationInMinutes);

        // we must prevent that a yet valid token be reused if it were refreshed.
        // but keep track of when the other will expire so we can inform client to get a new one..
        updateRefreshedTokenInSharedDb(token, newToken.token, expirationDate);
        return newToken.token;
    }
}

exports.authorize = authorize;

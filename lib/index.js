var assert = require('assert');
var authorize = require('./authorize');
var jwt = require('jsonwebtoken');
var socketIo = require('socket.io');
var api = require('./api');
/**
 * 
 * 
 * + user enters his credential and submit to api
 * + api return a token or error msg
 * - token has an expiration time
 * + browser redirects to app server with token VISIBLE in query string
 * + app server returns app page with angular code to browser
 * + app is now running in the browser and picks up the token in the url
 * + app connects the websocket just with the url
 * + On connect, the app emit "authenticate" message with token as parameter to web server 
 * + If browser takes too much time to sent "authenticate" after connecting websocket, web socket server with send unauthorized, and app in the browser will redirect to login
 *  (this will prevent a hacker to send messages to the websocket..but it could for a little time.. before receiving a msg the server needs to be sure, server needs to check if user is authenticated before processing any msg)
 * + If not, the web socket server will send back "authenticated""
 * 
 * 
 * ----------------------------------------------------------------------- 
 * Challenge 1:
 * ------------
 * if the token has expired and the connection has never been disconnected, the client app will still use the connection.
 * 
 * Challenge 2:
 * ------------
 * if the client loses connection, it can re-authenticate with same token.
 * 
 * Challenge 3:
 * ------------
 * If the client loses the connection and the token is invalid, the client is sent back to login....connection lost can often happen.
 * 
 * Challenge 4:
 * ------------
 * when the user logs in, the token is sent back to the client, which then redirect to the app... token is visible in url and can be stolen.
 * 
 * Challenge 5
 * ------------
 * If user refreshes the browser, the app must auto login it was logged in.
 * 
 * Challenge 6
 * ------------
 * If user is able to find out a VALID token, and has time to use in on a different machine, access will be granted.
 * 
 * 
 * -----------------------------------------------------------------------
 * IDEA:
 * 
 * HTTPS to prevent seing the sessiontoken in the ip paquet
 * ------------------------------------------------------
 * Setup HTTPS is a must....
 * 
 * 
 * Access token to prevent sharing the session token
 * ------------------------------------------
 * when login, client receives a nonce - token which has a short life span.
 * 
 * then when client authenticate via the socket,  it passes the nonce,
 * system returns a long life span token, that the app will store in place of the initial token. it will use in case the connection is lost.
 * 
 * If someone tries to use the nonce (might have found in a bookmark, or logs), it will be redirected to login. So the nonce is no longer useful
 * 
 * 
 * store token in local storage to stay logged in
 * ----------------------------------------------
 * If user refreshes the browser, the token is saved in the long life span token is stored in the storage, app will use it to authenticate or will be redirected to login
 * 
 * 
 * Refresh token before expiration
 * -------------------------------
 * if the long life span token is about to expired (timeout), the web socket will disconnect before it expirations. So that when the client will auto reconnect, it will get a new long life token.
 */

//pass a new token after login and store it locally in place of the other.

/* 
* 
* black list replaced token
* -------------------------
* When a token is replaced by a new one, the previous one, should be deleted.
* The client shall acknowledge that it receives a new token, so that the server should black list it until it expires. so nobody can use it until then.
* black listed token should be in a db, so that it can be shared between multiple instances of node.
* 
* 
* 
* 
* 
*/


/**
 * 
 * create a socketio server with middleware to handle token based connection, reconnection
 * 
 * return a new instance of the socketIo server 
 * 
 */
function socketServe(server, options) {

    assert.notStrictEqual(options.claim, undefined);
    assert.notStrictEqual(options.findUserByCredentials, undefined);

    var io = socketIo.listen(server);

    if (!options.refresh) {
        options.refresh = generateSessionToken;
    }

    if (!options.claim) {
        options.claim = generateClaim;
    }

    io.sockets
        .on('connection', authorize(options));

    return io;

    ////////////////////////////////////////

    function generateSessionToken(payload) {
        payload.dur = 5 * 60;
        return jwt.sign(payload, this.secret, { expiresIn: payload.dur });
    }
};

/**
 * add to express app the login and registration api request handling.
 */
function apiServe(app, options) {
    return api(app, options);
}

/**
 * sugar function that sets up a secure socket server and provide api on the same server
 * 
 * return a new instance of the socketIo server 
 */
function infrastructure(server, app, options) {
    apiServe(app, options);
    return socketServe(server, options);
};

module.exports = {
    apiServe: apiServe,
    socketServe: socketServe,
    infrastructure: infrastructure
};


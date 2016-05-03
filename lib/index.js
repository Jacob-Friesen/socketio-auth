var assert = require('assert');
var socketioSec = require('./authorize');
var jwt = require('jsonwebtoken');
var socketIo = require('socket.io');

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
 * ----------------------------------------------------------------------- * Challenge 1:
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

module.exports.server = function(server, app, options) {
    
    assert.notStrictEqual(options.claim,undefined);
    assert.notStrictEqual(options.findUserByCredentials,undefined);

    var io = socketIo.listen(server);

    if (!options.refresh) {
        options.refresh = generateSessionToken;
    }
    if (!options.authorization) {
        options.authorization = generateAuthorizationCode;
    }

    if (!options.claim) {
        options.claim = generateClaim;
    }

    io.sockets
        .on('connection', socketioSec.authorize(options));

    app.post('/login', handleLoginRequest);

    app.post('/register', handleRegisterRequest);

    return io;

    ////////////////////////////////////////

    function handleLoginRequest(req, res) {
        console.log('check credentials for ' + JSON.stringify(req.body) + ', then send back auth code...');
        var user = options.findUserByCredentials(req.body)
            .then(function(user) {
                    sendAuthorizationResponse(res, user);
            })
            .catch(function(error) {
                res.status(401).send({ code: "USER_INVALID" });
            });
    }

    function handleRegisterRequest(req, res) {
        console.log('Registering ' + JSON.stringify(req.body) + ', then send back auth code...');

        options.register(req.body)
            .then(function(user) {
                sendAuthorizationResponse(res, user);
            })
            .catch(function(err) {
                //  Bad Request :The server cannot or will not process the request due to an apparent client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).
                res.status(400).send({ code: err });
            });
    }

    function sendAuthorizationResponse(res, user) {
        var token = options.authorization(options.claim(user));
        if (options.appUrl) {
            res.status(200).send(options.appUrl(token));
        } else {
            res.json({ token: token });
        }
    }


    // function checkPassword(userPassword, password) {
    //     // @TODO: userPassword should be encrypted 
    //     // passwork must be encrypted before comparing with the current user password
    //     return password == "123";
    // }

    function generateAuthorizationCode(payload) {
        return jwt.sign(payload, options.secret, { 
            expiresIn: 10
        });
    }

    function generateSessionToken(payload) {
        payload.dur = 5 * 60;
        return jwt.sign(payload, this.secret, { expiresIn: payload.dur });
    }
};


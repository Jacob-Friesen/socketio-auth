var assert = require('assert');
var authorize = require('./authorize');
var jwt = require('jsonwebtoken');
var socketIo = require('socket.io');
var apiAccess = require('./api-access');
var apiRouter = require('./api-router');
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
    return apiAccess(app, options);
}

/**
 * sugar function that sets up a secure socket server and provide api on the same server
 * Deprecated
 * return a new instance of the socketIo server 
 */
function infrastructure(server, app, options) {
    apiServe(app, options);
    return socketServe(server, options);
};

/**
 * sugar function that sets up a secure socket server and provide access (login/registration) api on the same server  
 * 
 * return a new instance of the api-router 
 */
function infraServe(server, app, options) {
    apiServe(app, options);
    var so = socketServe(server, options);
    return apiRouter(so,options.api || 'api');
};

module.exports = {
    apiServe: apiServe,
    apiRouter : apiRouter,
    socketServe: socketServe,
    infraServe: infraServe,
    
    infrastructure: infrastructure
};


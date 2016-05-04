var assert = require('assert');
var authorize = require('./authorize');
var jwt = require('jsonwebtoken');
var socketIo = require('socket.io');
var api = require('./api');

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


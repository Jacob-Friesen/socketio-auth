var fixture = require('./fixture');
var request = require('request');
var io = require('socket.io-client');
var should = require('should');
var jwt = require('jsonwebtoken');

describe('authorizer without querystring and refresh token', function () {

    var options;
    
    //start and stop the server
    before(function (done) {
        var id = 0;
        options = {
            handshake: false,
            refresh: function (decoded) {
                return {
                    token: jwt.sign(decoded, this.secret, { expiresIn: 60 * 6 * 60, jwtid: new Date() }),
                    expiration: 30
                };
            }
        };
        fixture.start(options, done);
    });


    after(fixture.stop);

    describe('when the user is not logged in', function () {

        it('should close the connection after a timeout if no auth message is received', function (done) {
            var socket = io.connect('http://localhost:9000', {
                forceNew: true
            });
            socket.once('disconnect', function () {
                done();
            });
        });

        it('should not respond echo', function (done) {
            var socket = io.connect('http://localhost:9000', {
                'forceNew': true,
            });

            socket.on('echo-response', function () {
                done(new Error('this should not happen'));
            }).emit('echo', { hi: 123 });

            setTimeout(done, 1200);
        });

    });

    describe('when the user is logged in', function () {

        beforeEach(function (done) {
            request.post({
                url: 'http://localhost:9000/login',
                form: { username: 'jose', password: 'Pa123' },
                json: true
            }, function (err, resp, body) {
                this.token = body.token;
                done();
            }.bind(this));
        });



        it('should do the handshake and connect and receive a different token', function (done) {
            var socket = io.connect('http://localhost:9000', {
                'forceNew': true,
            });
            var token = this.token;
            socket.on('connect', function () {
                socket.on('authenticated', function (refreshToken) {
                    should.exist(refreshToken);
                    token.should.not.eql(refreshToken);
                    socket.close();
                    done();
                })
                .emit('authenticate', { token: token });
            });
        });


        it('should connect, refresh token and make the auth token invalid', function (done) {
            var socket = io.connect('http://localhost:9000', {
                'forceNew': true,
            });
            var token = this.token;
            socket.on('connect', function () {
                socket.on('authenticated', function (refreshToken) {
                    
                    should.exist(refreshToken);
                    token.should.not.eql(refreshToken);
                    socket.close();
                      

                    // now trying a new connection but with the same token
                    var socket2 = io.connect('http://localhost:9000', {
                        'forceNew': true,
                    });
                    socket2.on('connect', function () {
                        socket2.on('unauthorized', function (err) {
                            // console.log("error" + JSON.stringify(err));
                            socket2.close();
                            err.message.should.eql("Token is no longer valid");
                            done();
                        }).emit('authenticate', { token: token });

                    });

                }).emit('authenticate', { token: token });
            });
        });


        it('should connect, refresh token and make the refreshed token invalid', function (done) {
            var socket = io.connect('http://localhost:9000', {
                'forceNew': true,
            });
            var token = this.token;
            socket.on('connect', function () {
                socket.on('authenticated', function (refreshToken) {
                    should.exist(refreshToken);
                    token.should.not.eql(refreshToken);
                    socket.close();
                    // now trying a new connection but with the same token
                    var socket2 = io.connect('http://localhost:9000', {
                        'forceNew': true,
                    });
                    socket2.on('connect', function () {
                        socket2.on('authenticated', function (newRefreshedToken) {
                            // console.log("error" + JSON.stringify(err));
                            socket2.close();

                            // now we try to use the first refreshToken again!
                            var socket3 = io.connect('http://localhost:9000', {
                                'forceNew': true,
                            });
                            socket3.on('connect', function () {
                                socket3.on('unauthorized', function (err) {
                                    // console.log("error" + JSON.stringify(err));
                                    socket3.close();
                                    err.message.should.eql("Token is no longer valid");
                                    done();
                                }).emit('authenticate', { token: refreshToken });

                            });
                        }).emit('authenticate', { token: refreshToken });

                    });

                }).emit('authenticate', { token: token });
            });
        });
    });
    
    // when the black listed token is about to expire, inform client to authenticate so that it can record a new refreshed token..
    
    // could we be less intrusive and code all the login...  additional_auth...not sure...if not good enough

});
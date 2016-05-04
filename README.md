
Authenticate socket.io incoming connections with authorization code followed by token, the latter will be blacklisted and refreshed for a safer connection.

This implementation was inspired on the following articles:

https://developer.salesforce.com/page/File:OAuthWebServerFlow.png

https://stormpath.com/blog/jwt-the-right-way/

https://developer.salesforce.com/page/Digging_Deeper_into_OAuth_2.0_on_Force.com

## Description

This npm package provides the middleware to secure your express/socketio application. the 2 following components are available for use on the same server or different ones: 
- login/registration api 
- Secures websockets.


## Use Case

__Main flow__

This will handle the following flow:

- Client Sends user credentials or registration with a post to a server api (/login or /register).
- System returns a short life token or url with token (options.appUrl)
- Client connects sockets
- Then it emits "authenticate" and passed the just received token
(If system receives token too late (timeout), it will emit unauthorized)
- System verifies the token and emits "authenticated" back to the client with a new token (with a long life span)
- On receiving "authenticated", client stores the just received token for future reconnection use.

__Alternate flows__

If the connection is lost, client will reconnect with the stored token and receive a refreshed one.

If A token previous used and replaced by a new one is received by the server, it will send unauthorized.

If a token is about to expire, the client should request a new one before too late.

If client socket emits "logout" with its current token, server will invalidate token to prevent reuse and send back "logged_out".
Client can then delete its token / redirect to logout or login page.

## Installation
```
npm install "git://github.com/z-open/socketio-jwt#commit-ish
```

## options

refresh: to provide a function that returns a token, based on a payload.

claim: to provide a function that returns a claim based on a user

secret: the value to compute the jwt token if the default generation is used;

findUserByCredentials : to provide a function that returns a promise with the user...ex: find user in a db matching email and password

disposalInterval: value in seconds, interval between attempt to dispose expired token from the black list (get rid of expired token since they can not be reused anyway) 


__Usage__

socketioAuth.infrastructure(server,app,options)

will create the secure web socket server and configure the api to run on the same server. This returns an instance of the socket server

socketioAuth.apiServe(app,options)

will add login and register request handling to an express app.
Post credentials to those url and the token or app url will be sent back.

socketIoAuth.socketServe(server, options)
create an instance of socketio that handles connection/reconnection via tokens.


## Example 
```javascript
```

**Note:** If you are using a base64-encoded secret (e.g. your Auth0 secret key), you need to convert it to a Buffer: `Buffer('your secret key', 'base64')`

__Client side__:

```javascript
```
__Server side__:
```javascript
```

## Challenges to address

__active connection with invalid token__

server should force disconnection to prevent client to remain connected after expiration...)

__Auth Code and token access__

* After calling the login api, a auth code is passed back to the client via https. Then client will redirect to app url exposing the auth code. It will expire in seconds but still could be stolen.
 
* Tokens are communicated via the websocket over https. However, token might be stored on the client to allow reconnection in case of refresh. If someone could extract the token from the client (would need access the machine or shell), it can be used to make a new connection on a new client which would prevent the original owner to reconnect.

Solution could be to find a way to confirm that the new connection is issued from the same machine... (Ip might not be the best solution, as they are dynamically provided, and public ip is shared by multiple clients on a network. Drastic change of ip could be detected (different location))


__Scalling Right__:

https://nodejs.org/api/cluster.html
"There is no routing logic in Node.js, or in your program, and no shared state between the workers. Therefore, it is important to design your program such that it does not rely too heavily on in-memory data objects for things like sessions and login."

http://goldfirestudios.com/blog/136/Horizontally-Scaling-Node.js-and-WebSockets-with-Redis

## Contribute

You are always welcome to open an issue or provide a pull-request!

Also check out the unit tests:
```bash
npm test
```

## Issue Reporting


If you have found a bug or if you have a feature request, please report them at this repository issues section. Please do not report security vulnerabilities on the public GitHub issue tracker. 

## Author

[z-open]

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.

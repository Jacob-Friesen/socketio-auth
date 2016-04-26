
Authenticate socket.io incoming connections with authorization code followed by token, the latter will be blacklisted and refreshed for a safer connection.



This will handle the following flow:

- client Sends user credentials with a post
- system returns a short life token
- client connects sockets
- When client receives the token, it emits "authenticate" with the just received token
(If system receives token too late (timeout), it will emit unauthorized)
- System verify the token and emits "authenticated" with a new token (with a long life span)
- On receiving the authenticated message, client stores the just received token.


Alternate flows:

If the connection is lost, client will reconnect with the stored token and receive a refreshed one.

If A token previous used and replaced by a new one is received by the server, it will send unauthorized.

If a token is about to expire, the server disconnects the socket.
This forces the client to reconnect with its current token, which invalidates the token and allow the reception of a refreshed one.



## Installation

```
npm install "git://github.com/z-open/socketio-jwt#commit-ish
```

## Example usage

```javascript

```

**Note:** If you are using a base64-encoded secret (e.g. your Auth0 secret key), you need to convert it to a Buffer: `Buffer('your secret key', 'base64')`

__Client side__:

```javascript
```

__Server side__:




```

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

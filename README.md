# node-mutex

[![Build Status](https://travis-ci.org/rogermadjos/node-mutex.svg?branch=master)](https://travis-ci.org/rogermadjos/node-mutex)
[![npm version](https://badge.fury.io/js/node-mutex.svg)](http://badge.fury.io/js/node-mutex)

## How to install

```
npm install node-mutex
```

`node-mutex` ensures synchronicity of `critical` code blocks across multiple nodejs instances. This is achieved with the help of `redis` and some clever aproach to managing `locks`.

## How to use
```js
var mutex = require( 'node-mutex' )();

mutex.lock( 'key', function( err, unlock ) {
  if ( err ) {
  	console.error( err );
  	console.error( 'Unable to acquire lock' );
  }
  //synchronized code block

  unlock();
});

```

## How to use ( Promise API )
```js
var mutex = require( 'node-mutex' )();

mutex
  .lock( 'key' )
  .then( function( unlock ) {

    //synchronized code block

  	unlock();
  } );
```

## Options
```js
var mutex = require('node-mutex')(opts);
```
List of available options:
- `host`: host to connect redis on (`127.0.0.1`)
- `port`: port to connect redis on (`6379`)
- `url`:  url to connect redis, this option replace values of host and port. Format: `[redis:]//[[user][:password@]][host][:port][/db-number][?db=db-number[&password=bar[&option=value]]]`
- `prefix`: port to connect redis on (`mutex:`)
- `sleepTime`: maximum time in milliseconds to wait before retrying the acquisition of lock (`250`)
- `expireTime`: time in milliseconds before the `lock` expires (`3000`)
- `pub`: optional, the redis client to publish events on
- `sub`: optional, the redis client to subscribe to events on


## License

MIT

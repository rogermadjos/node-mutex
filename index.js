'use strict';

/**
 * Module dependencies.
 */

var redis = require( 'redis' ).createClient;
var uuid = require( 'node-uuid' );
var async = require( 'async' );
var Promise = require( 'bluebird' ); //jshint ignore:line

/**
 * Module exports.
 */
module.exports = function( opts ) {
  return new Mutex( opts );
};

/**
 * Mutex class.
 *
 * @param {Object}
 */

function Mutex ( opts ) {
  opts = opts || {};

  this.url  = opts.url;
  this.host = opts.host || '127.0.0.1';
  this.port = Number( opts.port || 6379 );
  this.sleepTime = opts.sleepTime || 250;
  this.expireTime = opts.expireTime || 5000;
  this.prefix = opts.prefix || 'mutex:';
  this.pub = opts.pub;
  this.sub = opts.sub;

  //Init clients if needed
  if ( !this.pub ) {
    this.pub = this.url ? redis( this.url ) : redis( this.port, this.host );
  }
  if ( !this.sub ) {
    this.sub = this.url ? redis( this.url ) : redis( this.port, this.host );
  }

  this.sub.subscribe( this.prefix + 'release' );
  this.sub.on( 'message', function( _, key ) {
    if ( listeners[ key ] ) {
      for ( var k in listeners[ key ] ) {
        if ( listeners[ key ][ k ] ) {
          listeners[ key ][ k ]();
        }
      }
    }
  } );
}

var scripts = {};
var listeners = {};

//Acquire lock and set expire time
scripts.acquire = {
  script: [
    'local locked = redis.call(\'SETNX\', KEYS[1], ARGV[1]);',
    'if locked == 1 then redis.call(\'PEXPIRE\', KEYS[1], ARGV[2]) end;',
    'return locked'
  ].join( '' )
};

//Should not release lock that's not yours
scripts.release = {
  script: [
    'local id = redis.call(\'GET\', KEYS[1]);',
    'if id == ARGV[1] then redis.call(\'DEL\', KEYS[1]) end'
  ].join( '' )
};

//Load lua scripts into redis
function loadScripts ( client, callback ) {
  if ( scripts.acquire.sha && scripts.release.sha ) {
    return callback( null, {
      acquire: scripts.acquire.sha,
      release: scripts.release.sha
    } );
  }
  client.multi()
  .script( 'LOAD', scripts.acquire.script )
  .script( 'LOAD', scripts.release.script )
		.exec( function( err, results ) {
  if ( err ) {
    return callback( err );
  }
  scripts.acquire.sha = results[ 0 ];
  scripts.release.sha = results[ 1 ];
  callback( null, {
    acquire: scripts.acquire.sha,
    release: scripts.release.sha
  } );
		} );
}

/**
 * Acquire lock.
 *
 * @access private
 * @param {string}   key
 */
Mutex.prototype.lock = function( key ) {
  var self = this;
  if ( typeof arguments[ 1 ] !== 'function' ) {
    var expireTime = arguments[ 1 ];
    return new Promise( function( resolve, reject ) {
      self._lock( key, function( err, unlock ) {
        if ( err ) {
          return reject( err );
        }
        resolve( unlock );
      }, expireTime );
    } );
  }

  self._lock.apply( this, arguments );
};

/**
 * Acquire lock.
 *
 * @access private
 * @param {string}   key
 * @param {function} fn
 * @param {number}   expireTime
 */
Mutex.prototype._lock = function( key, fn, expireTime ) {
  var self = this;
  var id = uuid.v1();
  var originalKey = key;
  key = self.prefix + key;
  expireTime = expireTime || self.expireTime;

  async.auto( {
    loadScripts: function( callback ) {
      loadScripts( self.pub, callback );
    },
    acquireLock: [ 'loadScripts', function( callback, results ) {
      var tout;
      var acquire = function() {};
      if ( !listeners[ key ] ) {
        listeners[ key ] = {};
      }
      listeners[ key ][ id ] = acquire;
      acquire = function() {
        clearTimeout( tout );
        self.pub.evalsha( results.loadScripts.acquire, 1, key, id, expireTime, function( err, result ) {
          if ( err ) {
            delete listeners[ key ][ id ];
            clearTimeout( tout );
            if ( err.toString().indexOf( 'NOSCRIPT' ) > 0 ) {
              delete scripts.acquire.sha;
              delete scripts.release.sha;
              return callback( null, false );
            }            else {
              return callback( err );
            }
          }
          if ( Number( result ) ) {
            delete listeners[ key ][ id ];
            clearTimeout( tout );
            return callback( null, true );
          }
          tout = setTimeout( acquire, self.sleepTime );
        } );
      };
      acquire();
    } ]
  }, function( err, results ) {
    if ( err ) {
      return fn( err );
    }
    if ( results.acquireLock ) {
      var done = function() {
        done = function() {};
        self.pub.evalsha( results.loadScripts.release, 1, key, id, function( err ) {
          if ( err ) {
            return console.error( err );
          }
          self.pub.publish( self.prefix + 'release', key, function( err ) {
            if ( err ) {
              console.error( err );
            }
          } );
        } );
      };
      fn( null, done );
    }    else {
      self.lock( originalKey, fn, expireTime );
    }
  } );
};

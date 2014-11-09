var assert = require('assert');
var Mutex = require('../');
var redis = require('redis').createClient;
var async = require('async');

describe('Mutex Tests: ', function() {
	this.timeout(10000);

	var client = redis();
	var mutex = new Mutex();

	before(function(done) {
		client.eval("return redis.call('DEL', unpack(redis.call('KEYS', ARGV[1] .. '*')))", 0, mutex.prefix, function() {
			done();
		});
	});

	it('should apply default settings', function() {
		var mutex = new Mutex();
		assert.equal(mutex.prefix, 'mutex:');
		assert.equal(mutex.sleepTime, 250);
		assert.equal(mutex.expireTime, 3000);
		assert.equal(mutex.host, '127.0.0.1');
		assert.equal(mutex.port, 6379);
		assert.equal(mutex.pub.address, '127.0.0.1:6379');
		assert.equal(mutex.sub.address, '127.0.0.1:6379');
		delete mutex;
	});

	it('should apply custom settings', function() {
		var mutex = new Mutex({
			prefix: 'custom:',
			sleepTime: 500,
			expireTime: 5000,
		});
		assert.equal(mutex.prefix, 'custom:');
		assert.equal(mutex.sleepTime, 500);
		assert.equal(mutex.expireTime, 5000);
		delete mutex;
	});

	it('should set redis lock and delete after unlock() is called', function(done) {
		mutex.lock('test', function(err, unlock) {
			client.exists(mutex.prefix+'test', function(_, result) {
				assert(Number(result));
				unlock();
				setTimeout(function() {
					client.exists(mutex.prefix+'test', function(err, result) {
						if(err) {
							console.error(err);
						}
						assert(!Number(result));
						done();
					})
				}, 250);
			});
		});
	});

	it('should be able to acquire lock after previous lock expires', function(done) {
		var timestamp = Date.now();
		var count = 0;
		mutex.lock('test', function(err, unlock) {
			setTimeout(function() {
				count++;
				unlock();
			}, mutex.expireTime*2);
		});

		setTimeout(function() {
			mutex.lock('test', function(err, unlock) {
				assert(Date.now()-timestamp > mutex.expireTime && Date.now()-timestamp < mutex.expireTime*2);
				setTimeout(function() {
					assert(count > 0);
					unlock();
					done();
				}, mutex.expireTime);
			});
		}, mutex.expireTime + mutex.expireTime/2);
	});

	it('shoud not block executions from different scopes', function(done) {
		var count = 0;
		var timestamp = Date.now();
		mutex.lock('test:0', function(err, unlock) {
			setTimeout(function() {
				count++;
				unlock();
			}, 2000);
		});

		setTimeout(function() {
			mutex.lock('test:1', function(err, unlock) {
				assert(Date.now()-timestamp >= 800 && Date.now()-timestamp <= 1200);
				setTimeout(function() {
					assert(count > 0);
					unlock();
					done();
				}, 2000);
			});
		}, 1000);
	});

	it('should correctly synchronize the execution of asynchronous calls from different scopes', function(done) {
		this.timeout(20000);
		var count = [0,0,0];
		async.times(30, function(index, callback) {
			var scope = index % 3;
			setTimeout(function() {
				mutex.lock('test:'+scope, function(_, unlock) {
					var num = count[scope] + 1;
					setTimeout(function() {
						count[scope]++;
						assert.equal(num, count[scope]);
						unlock();
						callback();
					}, 100 + Math.random()*250);
				});
			}, Math.random()*5000);
		}, function() {
			done();
		});
	});

});
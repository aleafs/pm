/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Child	= require('child_process');
var TcpWrap	= process.binding('tcp_wrap').TCP;

/**
 * @已经启动的子进程列表
 */
var children	= {};

/**
 * @注册的监听分发列表
 */
var bindings	= {};

/* {{{ function intval() */
function intval (num, dft) {
	try {
		num	= parseInt(num);
	} catch (e) {}

	return num ? num : dft;
}
/* }}} */

/* {{{ timestamp() */
function timestamp() {
	return intval((new Date()).getTime() / 1000, 0);
}
/* }}} */

/* {{{ function register() */
/**
 * 注册子进程映射表
 *
 */
function register (port, path, cnum) {
	bindings[intval(port, 0)]	= {
		path	: path,
		cnum	: intval(cnum, 1),
	}
}
/* }}} */

/* {{{ function dispatch() */
/**
 * 分发请求
 */
function dispatch () {
	for (var port in bindings) {
		var conf	= bindings[port];
		for (var i = 0; i < conf.cnum; i++) {
			Worker.start(conf.path, port);
		}
		port > 0 && listen(port);
	}
}
/* }}} */

var Worker	= {
	start	: function(path, port) {
		var wk	= Child.fork(path);
		if (!children[port]) {
			children[port]	= [];
		}

		children[port].push({
			'pid'		: wk.pid,
			'uptime'	: timestamp(),
			'scores'	: 0,
		});
	},

	select	: function(port) {
		if (!children[port]) {
			children[port]	= [];
		}

		var finder	= children[port];
		for (var i = 0, m = finder.length; i < m; i++) {
		}
	},
};

/* {{{ function listen() */
function listen (port) {
}
/* }}} */

exports.create	= function () {
	return {
		register	: register,
		dispatch	: dispatch,
	}
}

var obj	= exports.create();
obj.register(null, '/a', 1);
obj.dispatch();


/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Child	= require('child_process');
var TcpWrap	= process.binding('tcp_wrap').TCP;

/**
 * @子进程状态
 */
var STATUS	= {
	PEDDING	: 0,			/**<	正在初始化，还无法处理请求	*/
	RUNNING	: 10,			/**<	正常工作	*/
	STOPING	: 20,			/**<	准备退出，不再接受请求 */
};

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
		port > 0 && Master.listen(port);
	}
}
/* }}} */

/* {{{ Object worker */
var Worker	= {
	start	: function(path, port) {
		var wk	= Child.fork(path);
		if (!children[port]) {
			children[port]	= {};
		}

		children[port][wk.pid]	= {
			'uptime'	: timestamp(),
			'scores'	: 0,
			'status'	: STATUS.PEDDING,
		};
	},

	select	: function(port) {
		if (!children[port]) {
			return;
		}

		var pid	= 0;
		var fet	= children[port];
		var max	= 4294967296;
		for (var idx in fet) {
			var tmp	= fet[idx];
			if (max > tmp.scores && STATUS.RUNNING = tmp.status) {
				pid	= idx;
				max	= tmp.scores;
			}
		}

		if (!fet[pid]) {
			return;
		}

		children[port][pid].scores++;

		return pid;
	},
};
/* }}} */

/* {{{ Object Master() */
var Master	= {
	listen	: function (port) {
			  },
};
/* }}} */

exports.CHILD	= {
	'STATUS'	: STATUS,
};

exports.create	= function () {
	return {
		register	: register,
		dispatch	: dispatch,
	}
}

var obj	= exports.create();
obj.register(null, 'test/http.js', 1);
obj.dispatch();


/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var Child	= require('child_process');
var TcpWrap	= process.binding('tcp_wrap').TCP;

var STATUS	= require('./define.js').CHILD.STATUS;
var MSGTYPE	= require('./define.js').MESSAGE.TYPE;

/**
 * @已经启动的子进程列表
 */
var children	= {};

/**
 * @用于负载均衡的记分板
 */
var scoreboad	= {};

/**
 * @注册的监听分发列表
 */
var bindings	= {};

/* {{{ function intval() */
function intval (num, dft) {
	try {
		num	= parseInt(num);
		dft	= parseInt(dft);
	} catch (e) {}

	return num || dft || 0;
}
/* }}} */

/* {{{ timestamp() */
function timestamp() {
	return intval((new Date()).getTime() / 1000, 0);
}
/* }}} */

var Master	= {};

/* {{{ function Master.listen() */
Master.listen	= function (port) {
	var server	= new TcpWrap();
	server.bind('0.0.0.0', port);
	server.onconnection	= function (handle) {
		var pid	= Worker.select(port);
		if (!pid) {
			//
		} else {
			scoreboad[port][pid].scores++;
			scoreboad[port][pid].remain++;
			children[pid].send({
				'type'	: MSGTYPE.REQ_FD,
			}, handle);
		}

		handle.close();
	};
	server.listen('/dev/null');
};
/* }}} */

/* {{{ function Master.killall() */
Master.killall	= function (signal) {
	console.log(signal);
	for (var pid in children) {
		process.kill(pid, signal);
	}
}
/* }}} */

/* {{{ function Master.heartbeat() */
Master.heartbeat	= function (msg, port, pid) {
	for (var key in msg.data) {
		scoreboad[port][pid][key]	= msg.data[key];
	}
}
/* }}} */

var Worker	= {};

/* {{{ funciton Worker.start() */
Worker.start	= function (path, port) {
	var sub	= Child.fork(path);
	var pid	= sub.pid;

	children[pid]	= sub;
	if (!scoreboad[port]) {
		scoreboad[port]	= {};
	}

	scoreboad[port][pid]	= {
		'uptime'	: timestamp(),
		'scores'	: 0,
		'remain'	: 5,		/**<	避免大量请求瞬间涌入 */
		'status'	: STATUS.PEDDING,
	};

	sub.on('exit', function (code, signal) {
		try {
			delete children[pid];
			delete scoreboad[port][pid];
		} catch (e) {}
	});

	sub.on('message', function (msg) {
		if (!msg.type || !msg.data) {
			return;
		}

		switch (msg.type) {
			case MSGTYPE.HEART:
				Master.heartbeat(msg, port, pid);
				break;

			case MSGTYPE.RELOAD:
				Master.killall('SIGUSR1');
				break;

			default:
				break;
		}
	});

}
/* }}} */

/* {{{ function Worker.select() */
Worker.select	= function (port) {
	if (!scoreboad[port]) {
		return;
	}

	var pid	= 0;
	var max	= 4294967296;
	for (var idx in scoreboad[port]) {
		var tmp	= scoreboad[port][idx];
		if (max > tmp.remain && STATUS.RUNNING == tmp.status) {
			pid	= idx;
			max	= tmp.remain;
		}
	}

	if (!children[pid]) {
		delete scoreboad[port][pid];
		return;
	}

	return pid;
}
/* }}} */

exports.create	= function () {
	return {
		/**
		 * 注册子进程映射表
		 *
		 */
		'register'	: function (port, path, cnum) {
			bindings[intval(port, 0)]	= {
				path	: path,
				cnum	: intval(cnum, 1),
			};
		},
		/**
		 * 分发请求
		 */
		'dispatch'	: function () {
			for (var port in bindings) {
				var conf	= bindings[port];
				for (var i = 0; i < conf.cnum; i++) {
					Worker.start(conf.path, port);
				}
				port > 0 && Master.listen(port);
			}
		},
	}
}


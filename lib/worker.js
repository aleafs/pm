/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var STATUS	= require('./define.js').CHILD.STATUS;
var MSGTYPE	= require('./define.js').MESSAGE.TYPE;

var Worker	= {};
var myself	= {
	'remain'	: 0,		/**<	避免大量请求瞬间涌入 */
	'status'	: STATUS.PEDDING,
};

/* {{{ function Worker.ready() */
Worker.ready	= function (callback) {

	myself.status	= STATUS.RUNNING;
	myself.remain	= 0;

	/**
	 * @发送心跳
	 */
	process.hasOwnProperty('send') && setInterval(function () {
		var msg	= myself;
		msg.memory	= process.memoryUsage();
		process.send({
			'type'	: MSGTYPE.HEART,
			'data'	: msg,
		});
	}, 1000);

	/**
	 * @master发来的fd处理
	 */
	process.on('message', function (msg, handle) {
		if (!msg.type) {
			return;
		}

		switch (msg.type) {
			case MSGTYPE.REQ_FD:
				myself.remain++;
				callback(handle);
				break;
			default:
				break;
		}
	});

}
/* }}} */

/* {{{ function Worker.release() */
Worker.release	= function () {
	myself.remain--;
}
/* }}} */

exports.create	= function () {
	return Worker;
}


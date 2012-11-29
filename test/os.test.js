/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

var rewire = require('rewire');
var should = require('should');
var os = rewire(__dirname + '/../lib/os.js');

var _mocked = {};
_mocked.os  = {
  'platform' : function () {return 'linux';},
  'cpus' : function () {return [0,1]},
};
_mocked.fs  = {
  'readFileSync' : function () {
    return ['cpu  1075827 37 353258 631990752 220302 11 60263 22716756 0',
    'cpu0 504931 33 161329 100616782 159668 9 23452 7626460 0',
    'cpu1 503828 3 173795 107652876 20966 0 26767 607430 0',
    'cpu8 31654 0 7789 98402179 26194 1 8495 11865758 0',
    'cpu9 16218 0 4293 107873312 3666 0 1041 1339345 0',
    'cpu10 7757 0 3439 108714234 3819 0 311 731368 0',
    'cpu11 11436 0 2611 108731366 5987 0 194 546393 0',
    'intr ...'
      ].join('\n');
  },
};

describe('os patch for linux', function () {

  it('should_cpusnum_works_fine', function () {
    os.__set__(_mocked);
    os.cpusnum().should.eql(6);

    _mocked.fs.readFileSync = function () {
      throw new Error('test error');
    };
    os.__set__(_mocked);
    os.cpusnum().should.eql(2);

    _mocked.os.platform = function () {
      return 'darwin';
    };
    os.__set__(_mocked);
    os.cpusnum().should.eql(2);
  });

});


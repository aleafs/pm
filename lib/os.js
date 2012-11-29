/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

"use strict";

/**
 * XXX:
 *
 * node (>=0.8) crash on linux platform when cpu number are not continuous
 *
 * cpu  1075827 37 353258 631990752 220302 11 60263 22716756 0
 * cpu0 504931 33 161329 100616782 159668 9 23452 7626460 0
 * cpu1 503828 3 173795 107652876 20966 0 26767 607430 0
 * cpu8 31654 0 7789 98402179 26194 1 8495 11865758 0
 * cpu9 16218 0 4293 107873312 3666 0 1041 1339345 0
 * cpu10 7757 0 3439 108714234 3819 0 311 731368 0
 * cpu11 11436 0 2611 108731366 5987 0 194 546393 0
 */

var os = require('os');
var fs = require('fs');

os.cpusnum = function () {
  if ('linux' !== os.platform()) {
    return os.cpus().length;
  }

  var num = 0;
  try {
    fs.readFileSync('/proc/stat', 'utf8').split('\n').forEach(function (row) {
      var w = row.split(' ');
      if (w.shift().match(/^cpu\d+$/) && w.length > 4) {
        num++;
      }
    });
  } catch (e) {
    num = os.cpus().length;
  }

  return num;
};

module.exports = os;


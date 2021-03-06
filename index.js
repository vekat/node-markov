var EventEmitter = require('events').EventEmitter;
var deck = require('deck');
var Lazy = require('lazy');

module.exports = function (
  order,
  genKey = (s) => s.toLowerCase().replace(/[^a-z\d]+/g, '_').replace(/^_/, '').replace(/_$/, ''),
  genWords = (s) => s.split(/\s+/)
) {
  if (!order) order = 2;
  var db = {};
  var self = {};

  self.seed = function (seed, cb) {
    if (seed instanceof EventEmitter) {
      Lazy(seed).lines.forEach(self.seed);

      if (cb) {
        seed.on('error', cb);
        seed.on('end', cb);
      }
    }
    else {
      var text = (Buffer.isBuffer(seed) ? seed.toString() : seed)
      var words = genWords(text)
      var links = [];

      for (var i = 0; i < words.length; i += order) {
        var link = words.slice(i, i + order).join(' ');
        links.push(link);
      }

      if (links.length <= 1) {
        if (cb) cb(null);
        return;
      }

      for (var i = 1; i < links.length; i++) {
        var word = links[i-1];
        var cword = genKey(word)
        var next = links[i];
        var cnext = genKey(next)

        var node = db[cword] !== undefined
          ? db[cword]
          : {
            count : 0,
            words : {},
            prev : {},
            next : {},
          }
        ;
        db[cword] = node;

        node.count++;
        node.words[word] = (
          node.words[word] !== undefined ? node.words[word] : 0
        ) + 1;
        node.next[cnext] = (
          node.next[cnext] !== undefined ? node.next[cnext] : 0
        ) + 1

        if (i > 1) {
          var prev = genKey(links[i-2]);
          node.prev[prev] = (
            node.prev[prev] !== undefined ? node.prev[prev] : 0
          ) + 1;
        } else {
          node.prev[''] = (node.prev[''] || 0) + 1;
        }
      }

      if (db[cnext] === undefined) db[cnext] = {
        count : 1,
        words : {},
        prev : {},
        next : { '' : 0 },
      };

      var n = db[cnext];
      n.words[next] = (n.words[next] !== undefined ? n.words[next] : 0) + 1;
      n.prev[cword] = (n.prev[cword] !== undefined ? n.prev[cword] : 0) + 1;
      n.next[''] = (n.next[''] || 0) + 1;

      if (cb) cb(null);
    }
  };

  self.search = function (text) {
    var words = genWords(text)
    var groups = {};

    for (var i = 0; i < words.length; i += order) {
      var word = genKey(words.slice(i, i + order).join(' '));

      if (db[word] !== undefined)
        groups[word] = db[word].count;
    }

    return deck.pick(groups);
  };

  self.pick = function () {
    return deck.pick(Object.keys(db))
  };

  self.next = function (cur) {
    if (!cur || !db[cur]) return undefined;

    var next = deck.pick(db[cur].next);
    return next && {
      key : next,
      word : deck.pick(db[next].words),
    } || undefined;
  };

  self.prev = function (cur) {
    if (!cur || !db[cur]) return undefined;

    var prev = deck.pick(db[cur].prev);
    return prev && {
      key : prev,
      word : deck.pick(db[prev].words),
    } || undefined;
  };

  self.forward = function (cur, limit) {
    var res = [];
    while (cur && !limit || res.length < limit) {
      var next = self.next(cur);
      if (!next) break;
      cur = next.key;
      res.push(next.word);
    }

    return res;
  };

  self.backward = function (cur, limit) {
    var res = [];
    while (cur && !limit || res.length < limit) {
      var prev = self.prev(cur);
      if (!prev) break;
      cur = prev.key;
      res.unshift(prev.word);
    }

    return res;
  };

  self.fill = function (cur, limit) {
    var res = []
    if (db[cur] && db[cur].words) res.push(deck.pick(db[cur].words));
    if (!res[0]) return [];
    if (limit && res.length >= limit) return res;

    var pcur = cur;
    var ncur = cur;

    while (pcur || ncur) {
      if (pcur) {
        var prev = self.prev(pcur);
        pcur = null;
        if (prev) {
          pcur = prev.key;
          res.unshift(prev.word);
          if (limit && res.length >= limit) break;
        }
      }

      if (ncur) {
        var next = self.next(ncur);
        ncur = null;
        if (next) {
          ncur = next.key;
          res.push(next.word);
          if (limit && res.length >= limit) break;
        }
      }
    }

    return res;
  };

  self.respond = function (text, limit) {
    var cur = self.search(text) || self.pick();
    return self.fill(cur, limit);
  };

  self.word = function (cur) {
    return db[cur] && deck.pick(db[cur].words);
  };

  // function to return db object
  self.getDB = function () {
    return db
  }

  return self;
};

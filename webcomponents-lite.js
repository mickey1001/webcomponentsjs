(function () {
'use strict';

/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(scope) {

  'use strict';

  // defaultPrevented is broken in IE.
  // https://connect.microsoft.com/IE/feedback/details/790389/event-defaultprevented-returns-false-after-preventdefault-was-called
  var workingDefaultPrevented = (function() {
    var e = document.createEvent('Event');
    e.initEvent('foo', true, true);
    e.preventDefault();
    return e.defaultPrevented;
  })();

  if (!workingDefaultPrevented) {
    var origPreventDefault = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function() {
      if (!this.cancelable) {
        return;
      }

      origPreventDefault.call(this);

      Object.defineProperty(this, 'defaultPrevented', {
        get: function() {
          return true;
        },
        configurable: true
      });
    };
  }

  var isIE = /Trident/.test(navigator.userAgent);

  // CustomEvent constructor shim
  if (!window.CustomEvent || isIE && (typeof window.CustomEvent !== 'function')) {
    window.CustomEvent = function(inType, params) {
      params = params || {};
      var e = document.createEvent('CustomEvent');
      e.initCustomEvent(inType, Boolean(params.bubbles), Boolean(params.cancelable), params.detail);
      return e;
    };
    window.CustomEvent.prototype = window.Event.prototype;
  }

  // Event constructor shim
  if (!window.Event || isIE && (typeof window.Event !== 'function')) {
    var origEvent = window.Event;
    window.Event = function(inType, params) {
      params = params || {};
      var e = document.createEvent('Event');
      e.initEvent(inType, Boolean(params.bubbles), Boolean(params.cancelable));
      return e;
    };
    if (origEvent) {
      for (var i in origEvent) {
        window.Event[i] = origEvent[i];
      }
    }
    window.Event.prototype = origEvent.prototype;
  }

  if (!window.MouseEvent || isIE && (typeof window.MouseEvent !== 'function')) {
    var origMouseEvent = window.MouseEvent;
    window.MouseEvent = function(inType, params) {
      params = params || {};
      var e = document.createEvent('MouseEvent');
      e.initMouseEvent(inType,
        Boolean(params.bubbles), Boolean(params.cancelable),
        params.view || window, params.detail,
        params.screenX, params.screenY, params.clientX, params.clientY,
        params.ctrlKey, params.altKey, params.shiftKey, params.metaKey,
        params.button, params.relatedTarget);
      return e;
    };
    if (origMouseEvent) {
      for (var i in origMouseEvent) {
        window.MouseEvent[i] = origMouseEvent[i];
      }
    }
    window.MouseEvent.prototype = origMouseEvent.prototype;
  }

  // ES6 stuff
  if (!Array.from) {
    Array.from = function (object) {
      return [].slice.call(object);
    };
  }

  if (!Object.assign) {
    var assign = function(target, source) {
      var n$ = Object.getOwnPropertyNames(source);
      for (var i=0, p; i < n$.length; i++) {
        p = n$[i];
        target[p] = source[p];
      }
    };

    Object.assign = function(target, sources) {
      var args = [].slice.call(arguments, 1);
      for (var i=0, s; i < args.length; i++) {
        s = args[i];
        if (s) {
          assign(target, s);
        }
      }
      return target;
    };
  }

})(window.WebComponents);

/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

(function(scope) {
  'use strict';

  // feature detect for URL constructor
  var hasWorkingUrl = false;
  if (!scope.forceJURL) {
    try {
      var u = new URL('b', 'http://a');
      u.pathname = 'c%20d';
      hasWorkingUrl = u.href === 'http://a/c%20d';
    } catch(e) {}
  }

  if (hasWorkingUrl)
    return;

  var relative = Object.create(null);
  relative['ftp'] = 21;
  relative['file'] = 0;
  relative['gopher'] = 70;
  relative['http'] = 80;
  relative['https'] = 443;
  relative['ws'] = 80;
  relative['wss'] = 443;

  var relativePathDotMapping = Object.create(null);
  relativePathDotMapping['%2e'] = '.';
  relativePathDotMapping['.%2e'] = '..';
  relativePathDotMapping['%2e.'] = '..';
  relativePathDotMapping['%2e%2e'] = '..';

  function isRelativeScheme(scheme) {
    return relative[scheme] !== undefined;
  }

  function invalid() {
    clear.call(this);
    this._isInvalid = true;
  }

  function IDNAToASCII(h) {
    if ('' == h) {
      invalid.call(this);
    }
    // XXX
    return h.toLowerCase()
  }

  function percentEscape(c) {
    var unicode = c.charCodeAt(0);
    if (unicode > 0x20 &&
       unicode < 0x7F &&
       // " # < > ? `
       [0x22, 0x23, 0x3C, 0x3E, 0x3F, 0x60].indexOf(unicode) == -1
      ) {
      return c;
    }
    return encodeURIComponent(c);
  }

  function percentEscapeQuery(c) {
    // XXX This actually needs to encode c using encoding and then
    // convert the bytes one-by-one.

    var unicode = c.charCodeAt(0);
    if (unicode > 0x20 &&
       unicode < 0x7F &&
       // " # < > ` (do not escape '?')
       [0x22, 0x23, 0x3C, 0x3E, 0x60].indexOf(unicode) == -1
      ) {
      return c;
    }
    return encodeURIComponent(c);
  }

  var EOF = undefined,
      ALPHA = /[a-zA-Z]/,
      ALPHANUMERIC = /[a-zA-Z0-9\+\-\.]/;

  function parse(input, stateOverride, base) {
    function err(message) {
      errors.push(message);
    }

    var state = stateOverride || 'scheme start',
        cursor = 0,
        buffer = '',
        seenAt = false,
        seenBracket = false,
        errors = [];

    loop: while ((input[cursor - 1] != EOF || cursor == 0) && !this._isInvalid) {
      var c = input[cursor];
      switch (state) {
        case 'scheme start':
          if (c && ALPHA.test(c)) {
            buffer += c.toLowerCase(); // ASCII-safe
            state = 'scheme';
          } else if (!stateOverride) {
            buffer = '';
            state = 'no scheme';
            continue;
          } else {
            err('Invalid scheme.');
            break loop;
          }
          break;

        case 'scheme':
          if (c && ALPHANUMERIC.test(c)) {
            buffer += c.toLowerCase(); // ASCII-safe
          } else if (':' == c) {
            this._scheme = buffer;
            buffer = '';
            if (stateOverride) {
              break loop;
            }
            if (isRelativeScheme(this._scheme)) {
              this._isRelative = true;
            }
            if ('file' == this._scheme) {
              state = 'relative';
            } else if (this._isRelative && base && base._scheme == this._scheme) {
              state = 'relative or authority';
            } else if (this._isRelative) {
              state = 'authority first slash';
            } else {
              state = 'scheme data';
            }
          } else if (!stateOverride) {
            buffer = '';
            cursor = 0;
            state = 'no scheme';
            continue;
          } else if (EOF == c) {
            break loop;
          } else {
            err('Code point not allowed in scheme: ' + c);
            break loop;
          }
          break;

        case 'scheme data':
          if ('?' == c) {
            this._query = '?';
            state = 'query';
          } else if ('#' == c) {
            this._fragment = '#';
            state = 'fragment';
          } else {
            // XXX error handling
            if (EOF != c && '\t' != c && '\n' != c && '\r' != c) {
              this._schemeData += percentEscape(c);
            }
          }
          break;

        case 'no scheme':
          if (!base || !(isRelativeScheme(base._scheme))) {
            err('Missing scheme.');
            invalid.call(this);
          } else {
            state = 'relative';
            continue;
          }
          break;

        case 'relative or authority':
          if ('/' == c && '/' == input[cursor+1]) {
            state = 'authority ignore slashes';
          } else {
            err('Expected /, got: ' + c);
            state = 'relative';
            continue
          }
          break;

        case 'relative':
          this._isRelative = true;
          if ('file' != this._scheme)
            this._scheme = base._scheme;
          if (EOF == c) {
            this._host = base._host;
            this._port = base._port;
            this._path = base._path.slice();
            this._query = base._query;
            this._username = base._username;
            this._password = base._password;
            break loop;
          } else if ('/' == c || '\\' == c) {
            if ('\\' == c)
              err('\\ is an invalid code point.');
            state = 'relative slash';
          } else if ('?' == c) {
            this._host = base._host;
            this._port = base._port;
            this._path = base._path.slice();
            this._query = '?';
            this._username = base._username;
            this._password = base._password;
            state = 'query';
          } else if ('#' == c) {
            this._host = base._host;
            this._port = base._port;
            this._path = base._path.slice();
            this._query = base._query;
            this._fragment = '#';
            this._username = base._username;
            this._password = base._password;
            state = 'fragment';
          } else {
            var nextC = input[cursor+1];
            var nextNextC = input[cursor+2];
            if (
              'file' != this._scheme || !ALPHA.test(c) ||
              (nextC != ':' && nextC != '|') ||
              (EOF != nextNextC && '/' != nextNextC && '\\' != nextNextC && '?' != nextNextC && '#' != nextNextC)) {
              this._host = base._host;
              this._port = base._port;
              this._username = base._username;
              this._password = base._password;
              this._path = base._path.slice();
              this._path.pop();
            }
            state = 'relative path';
            continue;
          }
          break;

        case 'relative slash':
          if ('/' == c || '\\' == c) {
            if ('\\' == c) {
              err('\\ is an invalid code point.');
            }
            if ('file' == this._scheme) {
              state = 'file host';
            } else {
              state = 'authority ignore slashes';
            }
          } else {
            if ('file' != this._scheme) {
              this._host = base._host;
              this._port = base._port;
              this._username = base._username;
              this._password = base._password;
            }
            state = 'relative path';
            continue;
          }
          break;

        case 'authority first slash':
          if ('/' == c) {
            state = 'authority second slash';
          } else {
            err("Expected '/', got: " + c);
            state = 'authority ignore slashes';
            continue;
          }
          break;

        case 'authority second slash':
          state = 'authority ignore slashes';
          if ('/' != c) {
            err("Expected '/', got: " + c);
            continue;
          }
          break;

        case 'authority ignore slashes':
          if ('/' != c && '\\' != c) {
            state = 'authority';
            continue;
          } else {
            err('Expected authority, got: ' + c);
          }
          break;

        case 'authority':
          if ('@' == c) {
            if (seenAt) {
              err('@ already seen.');
              buffer += '%40';
            }
            seenAt = true;
            for (var i = 0; i < buffer.length; i++) {
              var cp = buffer[i];
              if ('\t' == cp || '\n' == cp || '\r' == cp) {
                err('Invalid whitespace in authority.');
                continue;
              }
              // XXX check URL code points
              if (':' == cp && null === this._password) {
                this._password = '';
                continue;
              }
              var tempC = percentEscape(cp);
              (null !== this._password) ? this._password += tempC : this._username += tempC;
            }
            buffer = '';
          } else if (EOF == c || '/' == c || '\\' == c || '?' == c || '#' == c) {
            cursor -= buffer.length;
            buffer = '';
            state = 'host';
            continue;
          } else {
            buffer += c;
          }
          break;

        case 'file host':
          if (EOF == c || '/' == c || '\\' == c || '?' == c || '#' == c) {
            if (buffer.length == 2 && ALPHA.test(buffer[0]) && (buffer[1] == ':' || buffer[1] == '|')) {
              state = 'relative path';
            } else if (buffer.length == 0) {
              state = 'relative path start';
            } else {
              this._host = IDNAToASCII.call(this, buffer);
              buffer = '';
              state = 'relative path start';
            }
            continue;
          } else if ('\t' == c || '\n' == c || '\r' == c) {
            err('Invalid whitespace in file host.');
          } else {
            buffer += c;
          }
          break;

        case 'host':
        case 'hostname':
          if (':' == c && !seenBracket) {
            // XXX host parsing
            this._host = IDNAToASCII.call(this, buffer);
            buffer = '';
            state = 'port';
            if ('hostname' == stateOverride) {
              break loop;
            }
          } else if (EOF == c || '/' == c || '\\' == c || '?' == c || '#' == c) {
            this._host = IDNAToASCII.call(this, buffer);
            buffer = '';
            state = 'relative path start';
            if (stateOverride) {
              break loop;
            }
            continue;
          } else if ('\t' != c && '\n' != c && '\r' != c) {
            if ('[' == c) {
              seenBracket = true;
            } else if (']' == c) {
              seenBracket = false;
            }
            buffer += c;
          } else {
            err('Invalid code point in host/hostname: ' + c);
          }
          break;

        case 'port':
          if (/[0-9]/.test(c)) {
            buffer += c;
          } else if (EOF == c || '/' == c || '\\' == c || '?' == c || '#' == c || stateOverride) {
            if ('' != buffer) {
              var temp = parseInt(buffer, 10);
              if (temp != relative[this._scheme]) {
                this._port = temp + '';
              }
              buffer = '';
            }
            if (stateOverride) {
              break loop;
            }
            state = 'relative path start';
            continue;
          } else if ('\t' == c || '\n' == c || '\r' == c) {
            err('Invalid code point in port: ' + c);
          } else {
            invalid.call(this);
          }
          break;

        case 'relative path start':
          if ('\\' == c)
            err("'\\' not allowed in path.");
          state = 'relative path';
          if ('/' != c && '\\' != c) {
            continue;
          }
          break;

        case 'relative path':
          if (EOF == c || '/' == c || '\\' == c || (!stateOverride && ('?' == c || '#' == c))) {
            if ('\\' == c) {
              err('\\ not allowed in relative path.');
            }
            var tmp;
            if (tmp = relativePathDotMapping[buffer.toLowerCase()]) {
              buffer = tmp;
            }
            if ('..' == buffer) {
              this._path.pop();
              if ('/' != c && '\\' != c) {
                this._path.push('');
              }
            } else if ('.' == buffer && '/' != c && '\\' != c) {
              this._path.push('');
            } else if ('.' != buffer) {
              if ('file' == this._scheme && this._path.length == 0 && buffer.length == 2 && ALPHA.test(buffer[0]) && buffer[1] == '|') {
                buffer = buffer[0] + ':';
              }
              this._path.push(buffer);
            }
            buffer = '';
            if ('?' == c) {
              this._query = '?';
              state = 'query';
            } else if ('#' == c) {
              this._fragment = '#';
              state = 'fragment';
            }
          } else if ('\t' != c && '\n' != c && '\r' != c) {
            buffer += percentEscape(c);
          }
          break;

        case 'query':
          if (!stateOverride && '#' == c) {
            this._fragment = '#';
            state = 'fragment';
          } else if (EOF != c && '\t' != c && '\n' != c && '\r' != c) {
            this._query += percentEscapeQuery(c);
          }
          break;

        case 'fragment':
          if (EOF != c && '\t' != c && '\n' != c && '\r' != c) {
            this._fragment += c;
          }
          break;
      }

      cursor++;
    }
  }

  function clear() {
    this._scheme = '';
    this._schemeData = '';
    this._username = '';
    this._password = null;
    this._host = '';
    this._port = '';
    this._path = [];
    this._query = '';
    this._fragment = '';
    this._isInvalid = false;
    this._isRelative = false;
  }

  // Does not process domain names or IP addresses.
  // Does not handle encoding for the query parameter.
  function jURL(url, base /* , encoding */) {
    if (base !== undefined && !(base instanceof jURL))
      base = new jURL(String(base));

    this._url = url;
    clear.call(this);

    var input = url.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, '');
    // encoding = encoding || 'utf-8'

    parse.call(this, input, null, base);
  }

  jURL.prototype = {
    toString: function() {
      return this.href;
    },
    get href() {
      if (this._isInvalid)
        return this._url;

      var authority = '';
      if ('' != this._username || null != this._password) {
        authority = this._username +
            (null != this._password ? ':' + this._password : '') + '@';
      }

      return this.protocol +
          (this._isRelative ? '//' + authority + this.host : '') +
          this.pathname + this._query + this._fragment;
    },
    set href(href) {
      clear.call(this);
      parse.call(this, href);
    },

    get protocol() {
      return this._scheme + ':';
    },
    set protocol(protocol) {
      if (this._isInvalid)
        return;
      parse.call(this, protocol + ':', 'scheme start');
    },

    get host() {
      return this._isInvalid ? '' : this._port ?
          this._host + ':' + this._port : this._host;
    },
    set host(host) {
      if (this._isInvalid || !this._isRelative)
        return;
      parse.call(this, host, 'host');
    },

    get hostname() {
      return this._host;
    },
    set hostname(hostname) {
      if (this._isInvalid || !this._isRelative)
        return;
      parse.call(this, hostname, 'hostname');
    },

    get port() {
      return this._port;
    },
    set port(port) {
      if (this._isInvalid || !this._isRelative)
        return;
      parse.call(this, port, 'port');
    },

    get pathname() {
      return this._isInvalid ? '' : this._isRelative ?
          '/' + this._path.join('/') : this._schemeData;
    },
    set pathname(pathname) {
      if (this._isInvalid || !this._isRelative)
        return;
      this._path = [];
      parse.call(this, pathname, 'relative path start');
    },

    get search() {
      return this._isInvalid || !this._query || '?' == this._query ?
          '' : this._query;
    },
    set search(search) {
      if (this._isInvalid || !this._isRelative)
        return;
      this._query = '?';
      if ('?' == search[0])
        search = search.slice(1);
      parse.call(this, search, 'query');
    },

    get hash() {
      return this._isInvalid || !this._fragment || '#' == this._fragment ?
          '' : this._fragment;
    },
    set hash(hash) {
      if (this._isInvalid)
        return;
      this._fragment = '#';
      if ('#' == hash[0])
        hash = hash.slice(1);
      parse.call(this, hash, 'fragment');
    },

    get origin() {
      var host;
      if (this._isInvalid || !this._scheme) {
        return '';
      }
      // javascript: Gecko returns String(""), WebKit/Blink String("null")
      // Gecko throws error for "data://"
      // data: Gecko returns "", Blink returns "data://", WebKit returns "null"
      // Gecko returns String("") for file: mailto:
      // WebKit/Blink returns String("SCHEME://") for file: mailto:
      switch (this._scheme) {
        case 'data':
        case 'file':
        case 'javascript':
        case 'mailto':
          return 'null';
      }
      host = this.host;
      if (!host) {
        return '';
      }
      return this._scheme + '://' + host;
    }
  };

  // Copy over the static methods
  var OriginalURL = scope.URL;
  if (OriginalURL) {
    jURL.createObjectURL = function(blob) {
      // IE extension allows a second optional options argument.
      // http://msdn.microsoft.com/en-us/library/ie/hh772302(v=vs.85).aspx
      return OriginalURL.createObjectURL.apply(OriginalURL, arguments);
    };
    jURL.revokeObjectURL = function(url) {
      OriginalURL.revokeObjectURL(url);
    };
  }

  scope.URL = jURL;

})(window);

/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// minimal template polyfill
(function() {
  // NOTE: we rely on this cloneNode not causing element upgrade.
  // This means this polyfill must load before the CE polyfill and
  // this would need to be re-worked if a browser supports native CE
  // but not <template>.
  var Native_cloneNode = Node.prototype.cloneNode;
  var Native_importNode = Document.prototype.importNode;
  var Native_createElement = Document.prototype.createElement;

  var needsTemplate = (typeof HTMLTemplateElement === 'undefined');

  // returns true if nested templates cannot be cloned (they cannot be on
  // some impl's like Safari 8 and Edge)
  // OR if cloning a document fragment does not result in a document fragment
  var needsCloning = (function() {
    if (!needsTemplate) {
      var t = document.createElement('template');
      var t2 = document.createElement('template');
      t2.content.appendChild(document.createElement('div'));
      t.content.appendChild(t2);
      var clone = t.cloneNode(true);
      return (clone.content.childNodes.length === 0 || clone.content.firstChild.content.childNodes.length === 0
        || !(document.createDocumentFragment().cloneNode() instanceof DocumentFragment));
    }
  })();

  var TEMPLATE_TAG = 'template';
  var TemplateImpl = function() {};

  if (needsTemplate) {

    var contentDoc = document.implementation.createHTMLDocument('template');
    var canDecorate = true;

    var templateStyle = document.createElement('style');
    templateStyle.textContent = TEMPLATE_TAG + '{display:none;}';

    var head = document.head;
    head.insertBefore(templateStyle, head.firstElementChild);

    /**
      Provides a minimal shim for the <template> element.
    */
    TemplateImpl.prototype = Object.create(HTMLElement.prototype);


    // if elements do not have `innerHTML` on instances, then
    // templates can be patched by swizzling their prototypes.
    var canProtoPatch =
      !(document.createElement('div').hasOwnProperty('innerHTML'));

    /**
      The `decorate` method moves element children to the template's `content`.
      NOTE: there is no support for dynamically adding elements to templates.
    */
    TemplateImpl.decorate = function(template) {
      // if the template is decorated, return fast
      if (template.content) {
        return;
      }
      template.content = contentDoc.createDocumentFragment();
      var child;
      while (child = template.firstChild) {
        template.content.appendChild(child);
      }
      if (canProtoPatch) {
        template.__proto__ = TemplateImpl.prototype;
      } else {
        template.cloneNode = function(deep) {
          return TemplateImpl._cloneNode(this, deep);
        };
        // add innerHTML to template, if possible
        // Note: this throws on Safari 7
        if (canDecorate) {
          try {
            defineInnerHTML(template);
          } catch (err) {
            canDecorate = false;
          }
        }
      }
      // bootstrap recursively
      TemplateImpl.bootstrap(template.content);
    };

    function defineInnerHTML(obj) {
      Object.defineProperty(obj, 'innerHTML', {
        get: function() {
          var o = '';
          for (var e = this.content.firstChild; e; e = e.nextSibling) {
            o += e.outerHTML || escapeData(e.data);
          }
          return o;
        },
        set: function(text) {
          contentDoc.body.innerHTML = text;
          TemplateImpl.bootstrap(contentDoc);
          while (this.content.firstChild) {
            this.content.removeChild(this.content.firstChild);
          }
          while (contentDoc.body.firstChild) {
            this.content.appendChild(contentDoc.body.firstChild);
          }
        },
        configurable: true
      });
    }

    defineInnerHTML(TemplateImpl.prototype);

    /**
      The `bootstrap` method is called automatically and "fixes" all
      <template> elements in the document referenced by the `doc` argument.
    */
    TemplateImpl.bootstrap = function(doc) {
      var templates = doc.querySelectorAll(TEMPLATE_TAG);
      for (var i=0, l=templates.length, t; (i<l) && (t=templates[i]); i++) {
        TemplateImpl.decorate(t);
      }
    };

    // auto-bootstrapping for main document
    document.addEventListener('DOMContentLoaded', function() {
      TemplateImpl.bootstrap(document);
    });

    // Patch document.createElement to ensure newly created templates have content
    Document.prototype.createElement = function() {
      'use strict';
      var el = Native_createElement.apply(this, arguments);
      if (el.localName === 'template') {
        TemplateImpl.decorate(el);
      }
      return el;
    };

    var escapeDataRegExp = /[&\u00A0<>]/g;

    function escapeReplace(c) {
      switch (c) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '\u00A0':
          return '&nbsp;';
      }
    }

    function escapeData(s) {
      return s.replace(escapeDataRegExp, escapeReplace);
    }
  }

  // make cloning/importing work!
  if (needsTemplate || needsCloning) {

    TemplateImpl._cloneNode = function(template, deep) {
      var clone = Native_cloneNode.call(template, false);
      // NOTE: decorate doesn't auto-fix children because they are already
      // decorated so they need special clone fixup.
      if (this.decorate) {
        this.decorate(clone);
      }
      if (deep) {
        // NOTE: use native clone node to make sure CE's wrapped
        // cloneNode does not cause elements to upgrade.
        clone.content.appendChild(
            Native_cloneNode.call(template.content, true));
        // now ensure nested templates are cloned correctly.
        this.fixClonedDom(clone.content, template.content);
      }
      return clone;
    };

    TemplateImpl.prototype.cloneNode = function(deep) {
      return TemplateImpl._cloneNode(this, deep);
    };

    // Given a source and cloned subtree, find <template>'s in the cloned
    // subtree and replace them with cloned <template>'s from source.
    // We must do this because only the source templates have proper .content.
    TemplateImpl.fixClonedDom = function(clone, source) {
      // do nothing if cloned node is not an element
      if (!source.querySelectorAll) return;
      // these two lists should be coincident
      var s$ = source.querySelectorAll(TEMPLATE_TAG);
      var t$ = clone.querySelectorAll(TEMPLATE_TAG);
      for (var i=0, l=t$.length, t, s; i<l; i++) {
        s = s$[i];
        t = t$[i];
        if (this.decorate) {
          this.decorate(s);
        }
        t.parentNode.replaceChild(s.cloneNode(true), t);
      }
    };

    // override all cloning to fix the cloned subtree to contain properly
    // cloned templates.
    Node.prototype.cloneNode = function(deep) {
      var dom;
      // workaround for Edge bug cloning documentFragments
      // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8619646/
      if (this instanceof DocumentFragment) {
        if (!deep) {
          return this.ownerDocument.createDocumentFragment();
        } else {
          dom = this.ownerDocument.importNode(this, true);
        }
      } else {
        dom = Native_cloneNode.call(this, deep);
      }
      // template.content is cloned iff `deep`.
      if (deep) {
        TemplateImpl.fixClonedDom(dom, this);
      }
      return dom;
    };

    // NOTE: we are cloning instead of importing <template>'s.
    // However, the ownerDocument of the cloned template will be correct!
    // This is because the native import node creates the right document owned
    // subtree and `fixClonedDom` inserts cloned templates into this subtree,
    // thus updating the owner doc.
    Document.prototype.importNode = function(element, deep) {
      if (element.localName === TEMPLATE_TAG) {
        return TemplateImpl._cloneNode(element, deep);
      } else {
        var dom = Native_importNode.call(this, element, deep);
        if (deep) {
          TemplateImpl.fixClonedDom(dom, element);
        }
        return dom;
      }
    };

    if (needsCloning) {
      HTMLTemplateElement.prototype.cloneNode = function(deep) {
        return TemplateImpl._cloneNode(this, deep);
      };
    }
  }

  // NOTE: Patch document.importNode to work around IE11 bug that
  // casues children of a document fragment imported while
  // there is a mutation observer to not have a parentNode (!?!)
  // This needs to happen *after* patching importNode to fix template cloning
  if (/Trident/.test(navigator.userAgent)) {
    (function() {
      var Native_importNode = Document.prototype.importNode;
      Document.prototype.importNode = function() {
        var n = Native_importNode.apply(this, arguments);
        // Copy all children to a new document fragment since
        // this one may be broken
        if (n.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          var f = this.createDocumentFragment();
          f.appendChild(n);
          return f;
        } else {
          return n;
        }
      };
    })();
  }

  if (needsTemplate) {
    window.HTMLTemplateElement = TemplateImpl;
  }

})();

!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.ES6Promise=e();}(window,function(){"use strict";function t(t){return"function"==typeof t||"object"==typeof t&&null!==t}function e(t){return"function"==typeof t}function n(t){I=t;}function r(t){J=t;}function o(){return function(){return process.nextTick(a)}}function i(){return"undefined"!=typeof H?function(){H(a);}:c()}function s(){var t=0,e=new V(a),n=document.createTextNode("");return e.observe(n,{characterData:!0}),function(){n.data=t=++t%2;}}function u(){var t=new MessageChannel;return t.port1.onmessage=a,function(){return t.port2.postMessage(0)}}function c(){var t=setTimeout;return function(){return t(a,1)}}function a(){for(var t=0;t<G;t+=2){var e=$[t],n=$[t+1];e(n),$[t]=void 0,$[t+1]=void 0;}G=0;}function f(){try{var t=require,e=t("vertx");return H=e.runOnLoop||e.runOnContext,i()}catch(n){return c()}}function l(t,e){var n=arguments,r=this,o=new this.constructor(p);void 0===o[et]&&k(o);var i=r._state;return i?!function(){var t=n[i-1];J(function(){return x(i,o,t,r._result)});}():E(r,o,t,e),o}function h(t){var e=this;if(t&&"object"==typeof t&&t.constructor===e)return t;var n=new e(p);return g(n,t),n}function p(){}function v(){return new TypeError("You cannot resolve a promise with itself")}function d(){return new TypeError("A promises callback cannot return that same promise.")}function _(t){try{return t.then}catch(e){return it.error=e,it}}function y(t,e,n,r){try{t.call(e,n,r);}catch(o){return o}}function m(t,e,n){J(function(t){var r=!1,o=y(n,e,function(n){r||(r=!0,e!==n?g(t,n):S(t,n));},function(e){r||(r=!0,j(t,e));},"Settle: "+(t._label||" unknown promise"));!r&&o&&(r=!0,j(t,o));},t);}function b(t,e){e._state===rt?S(t,e._result):e._state===ot?j(t,e._result):E(e,void 0,function(e){return g(t,e)},function(e){return j(t,e)});}function w(t,n,r){n.constructor===t.constructor&&r===l&&n.constructor.resolve===h?b(t,n):r===it?j(t,it.error):void 0===r?S(t,n):e(r)?m(t,n,r):S(t,n);}function g(e,n){e===n?j(e,v()):t(n)?w(e,n,_(n)):S(e,n);}function A(t){t._onerror&&t._onerror(t._result),P(t);}function S(t,e){t._state===nt&&(t._result=e,t._state=rt,0!==t._subscribers.length&&J(P,t));}function j(t,e){t._state===nt&&(t._state=ot,t._result=e,J(A,t));}function E(t,e,n,r){var o=t._subscribers,i=o.length;t._onerror=null,o[i]=e,o[i+rt]=n,o[i+ot]=r,0===i&&t._state&&J(P,t);}function P(t){var e=t._subscribers,n=t._state;if(0!==e.length){for(var r=void 0,o=void 0,i=t._result,s=0;s<e.length;s+=3)r=e[s],o=e[s+n],r?x(n,r,o,i):o(i);t._subscribers.length=0;}}function T(){this.error=null;}function M(t,e){try{return t(e)}catch(n){return st.error=n,st}}function x(t,n,r,o){var i=e(r),s=void 0,u=void 0,c=void 0,a=void 0;if(i){if(s=M(r,o),s===st?(a=!0,u=s.error,s=null):c=!0,n===s)return void j(n,d())}else s=o,c=!0;n._state!==nt||(i&&c?g(n,s):a?j(n,u):t===rt?S(n,s):t===ot&&j(n,s));}function C(t,e){try{e(function(e){g(t,e);},function(e){j(t,e);});}catch(n){j(t,n);}}function O(){return ut++}function k(t){t[et]=ut++,t._state=void 0,t._result=void 0,t._subscribers=[];}function Y(t,e){this._instanceConstructor=t,this.promise=new t(p),this.promise[et]||k(this.promise),B(e)?(this._input=e,this.length=e.length,this._remaining=e.length,this._result=new Array(this.length),0===this.length?S(this.promise,this._result):(this.length=this.length||0,this._enumerate(),0===this._remaining&&S(this.promise,this._result))):j(this.promise,q());}function q(){return new Error("Array Methods must be provided an Array")}function F(t){return new Y(this,t).promise}function D(t){var e=this;return new e(B(t)?function(n,r){for(var o=t.length,i=0;i<o;i++)e.resolve(t[i]).then(n,r);}:function(t,e){return e(new TypeError("You must pass an array to race."))})}function K(t){var e=this,n=new e(p);return j(n,t),n}function L(){throw new TypeError("You must pass a resolver function as the first argument to the promise constructor")}function N(){throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.")}function U(t){this[et]=O(),this._result=this._state=void 0,this._subscribers=[],p!==t&&("function"!=typeof t&&L(),this instanceof U?C(this,t):N());}function W(){var t=void 0;if("undefined"!=typeof global)t=global;else if("undefined"!=typeof self)t=self;else try{t=Function("return this")();}catch(e){throw new Error("polyfill failed because global object is unavailable in this environment")}var n=t.Promise;if(n){var r=null;try{r=Object.prototype.toString.call(n.resolve());}catch(e){}if("[object Promise]"===r&&!n.cast)return}t.Promise=U;}var z=void 0;z=Array.isArray?Array.isArray:function(t){return"[object Array]"===Object.prototype.toString.call(t)};var B=z,G=0,H=void 0,I=void 0,J=function(t,e){$[G]=t,$[G+1]=e,G+=2,2===G&&(I?I(a):tt());},Q="undefined"!=typeof window?window:void 0,R=Q||{},V=R.MutationObserver||R.WebKitMutationObserver,X="undefined"==typeof self&&"undefined"!=typeof process&&"[object process]"==={}.toString.call(process),Z="undefined"!=typeof Uint8ClampedArray&&"undefined"!=typeof importScripts&&"undefined"!=typeof MessageChannel,$=new Array(1e3),tt=void 0;tt=X?o():V?s():Z?u():void 0===Q&&"function"==typeof require?f():c();var et=Math.random().toString(36).substring(16),nt=void 0,rt=1,ot=2,it=new T,st=new T,ut=0;return Y.prototype._enumerate=function(){for(var t=this.length,e=this._input,n=0;this._state===nt&&n<t;n++)this._eachEntry(e[n],n);},Y.prototype._eachEntry=function(t,e){var n=this._instanceConstructor,r=n.resolve;if(r===h){var o=_(t);if(o===l&&t._state!==nt)this._settledAt(t._state,e,t._result);else if("function"!=typeof o)this._remaining--,this._result[e]=t;else if(n===U){var i=new n(p);w(i,t,o),this._willSettleAt(i,e);}else this._willSettleAt(new n(function(e){return e(t)}),e);}else this._willSettleAt(r(t),e);},Y.prototype._settledAt=function(t,e,n){var r=this.promise;r._state===nt&&(this._remaining--,t===ot?j(r,n):this._result[e]=n),0===this._remaining&&S(r,this._result);},Y.prototype._willSettleAt=function(t,e){var n=this;E(t,void 0,function(t){return n._settledAt(rt,e,t)},function(t){return n._settledAt(ot,e,t)});},U.all=F,U.race=D,U.resolve=h,U.reject=K,U._setScheduler=n,U._setAsap=r,U._asap=J,U.prototype={constructor:U,then:l,"catch":function(t){return this.then(null,t)}},U.polyfill=W,U.Promise=U,U}),ES6Promise.polyfill();

/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
(scope => {

  /********************* base setup *********************/
  const useNative = Boolean('import' in document.createElement('link'));

  // Polyfill `currentScript` for browsers without it.
  let currentScript = null;
  if ('currentScript' in document === false) {
    Object.defineProperty(document, 'currentScript', {
      get() {
        return currentScript ||
          // NOTE: only works when called in synchronously executing code.
          // readyState should check if `loading` but IE10 is
          // interactive when scripts run so we cheat. This is not needed by
          // html-imports polyfill but helps generally polyfill `currentScript`.
          (document.readyState !== 'complete' ?
            document.scripts[document.scripts.length - 1] : null);
      },
      configurable: true
    });
  }

  /********************* path fixup *********************/
  const ABS_URL_TEST = /(^\/)|(^#)|(^[\w-\d]*:)/;
  const CSS_URL_REGEXP = /(url\()([^)]*)(\))/g;
  const CSS_IMPORT_REGEXP = /(@import[\s]+(?!url\())([^;]*)(;)/g;
  const STYLESHEET_REGEXP = /(<link[^>]*)(rel=['|"]?stylesheet['|"]?[^>]*>)/g;

  // path fixup: style elements in imports must be made relative to the main
  // document. We fixup url's in url() and @import.
  const Path = {

    fixUrls(element, base) {
      if (element.href) {
        element.setAttribute('href',
          Path.replaceAttrUrl(element.getAttribute('href'), base));
      }
      if (element.src) {
        element.setAttribute('src',
          Path.replaceAttrUrl(element.getAttribute('src'), base));
      }
      if (element.localName === 'style') {
        Path.resolveUrlsInStyle(element, base);
      }
    },

    fixUrlAttributes(element, base) {
      const attrs = ['action', 'src', 'href', 'url', 'style'];
      for (let i = 0, a; i < attrs.length && (a = attrs[i]); i++) {
        const at = element.attributes[a];
        const v = at && at.value;
        // Skip bound attribute values (assume binding is done via {} and []).
        // TODO(valdrin) consider exposing a library-implementable hook.
        if (v && (v.search(/({{|\[\[)/) < 0)) {
          at.value = (a === 'style') ?
            Path.resolveUrlsInCssText(v, base) :
            Path.replaceAttrUrl(v, base);
        }
      }
    },

    fixUrlsInTemplates(element, base) {
      const t$ = element.querySelectorAll('template');
      for (let i = 0; i < t$.length; i++) {
        Path.fixUrlsInTemplate(t$[i], base);
      }
    },

    fixUrlsInTemplate(template, base) {
      // If template is not supported, still resolve urls within it.
      const content = template.content || template;
      const n$ = content.querySelectorAll(
        'style, form[action], [src], [href], [url], [style]');
      for (let i = 0; i < n$.length; i++) {
        const n = n$[i];
        if (n.localName == 'style') {
          Path.resolveUrlsInStyle(n, base);
        } else {
          Path.fixUrlAttributes(n, base);
        }
      }
      Path.fixUrlsInTemplates(content, base);
    },

    resolveUrlsInStyle(style, linkUrl) {
      style.textContent = Path.resolveUrlsInCssText(style.textContent, linkUrl);
    },

    resolveUrlsInCssText(cssText, linkUrl) {
      let r = Path.replaceUrls(cssText, linkUrl, CSS_URL_REGEXP);
      r = Path.replaceUrls(r, linkUrl, CSS_IMPORT_REGEXP);
      return r;
    },

    replaceUrls(text, linkUrl, regexp) {
      return text.replace(regexp, (m, pre, url, post) => {
        let urlPath = url.replace(/["']/g, '');
        if (linkUrl) {
          urlPath = Path.resolveUrl(urlPath, linkUrl);
        }
        return pre + '\'' + urlPath + '\'' + post;
      });
    },

    replaceAttrUrl(text, linkUrl) {
      if (text && ABS_URL_TEST.test(text)) {
        return text;
      } else {
        return Path.resolveUrl(text, linkUrl);
      }
    },

    resolveUrl(url, base) {
      // Lazy feature detection.
      if (Path.__workingURL === undefined) {
        Path.__workingURL = false;
        try {
          const u = new URL('b', 'http://a');
          u.pathname = 'c%20d';
          Path.__workingURL = (u.href === 'http://a/c%20d');
        } catch (e) {}
      }

      if (Path.__workingURL) {
        return (new URL(url, base)).href;
      }

      // Fallback to creating an anchor into a disconnected document.
      let doc = Path.__tempDoc;
      if (!doc) {
        doc = document.implementation.createHTMLDocument('temp');
        Path.__tempDoc = doc;
        doc.__base = doc.createElement('base');
        doc.head.appendChild(doc.__base);
        doc.__anchor = doc.createElement('a');
      }
      doc.__base.href = base;
      doc.__anchor.href = url;
      return doc.__anchor.href || url;
    }
  };

  /********************* Xhr processor *********************/
  const Xhr = {

    async: true,

    /**
     * @param {!string} url
     * @return {!Promise}
     */
    load(url) {
      return new Promise((resolve, reject) => {
        if (!url) {
          reject({
            resource: 'error: href must be specified'
          });
        } else if (url.match(/^data:/)) {
          // Handle Data URI Scheme
          const pieces = url.split(',');
          const header = pieces[0];
          let resource = pieces[1];
          if (header.indexOf(';base64') > -1) {
            resource = atob(resource);
          } else {
            resource = decodeURIComponent(resource);
          }
          resolve({
            resource: resource
          });
        } else {
          const request = new XMLHttpRequest();
          request.open('GET', url, Xhr.async);
          request.addEventListener('readystatechange', () => {
            if (request.readyState === 4) {
              // Servers redirecting an import can add a Location header to help us
              // polyfill correctly.
              let redirectedUrl = undefined;
              try {
                const locationHeader = request.getResponseHeader('Location');
                if (locationHeader) {
                  // Relative or full path.
                  redirectedUrl = (locationHeader.substr(0, 1) === '/') ?
                    location.origin + locationHeader : locationHeader;
                }
              } catch (e) {
                console.error(e.message);
              }
              const resp = {
                resource: (request.response || request.responseText),
                redirectedUrl: redirectedUrl
              };
              if (request.status === 304 || request.status === 0 ||
                request.status >= 200 && request.status < 300) {
                resolve(resp);
              } else {
                reject(resp);
              }
            }
          });
          request.send();
        }
      });
    }
  };

  /********************* importer *********************/

  const isIE = /Trident/.test(navigator.userAgent) ||
    /Edge\/\d./i.test(navigator.userAgent);
  const supportsUnhandledrejection = ('onunhandledrejection' in window);

  const importSelector = 'link[rel=import]';

  // Used to disable loading of resources.
  const importDisableType = 'import-disable';

  const disabledLinkSelector = `link[rel=stylesheet][href][type=${importDisableType}]`;

  const importDependenciesSelector = `${importSelector}, ${disabledLinkSelector},
    style:not([type]), link[rel=stylesheet][href]:not([type]),
    script:not([type]), script[type="application/javascript"],
    script[type="text/javascript"]`;

  const importDependencyAttr = 'import-dependency';

  const rootImportSelector = `${importSelector}:not(${importDependencyAttr})`;

  const pendingScriptsSelector = `script[${importDependencyAttr}]`;

  const pendingStylesSelector = `style[${importDependencyAttr}],
    link[rel=stylesheet][${importDependencyAttr}]`;

  /**
   * Importer will:
   * - load any linked import documents (with deduping)
   * - whenever an import is loaded, prompt the parser to try to parse
   * - observe imported documents for new elements (these are handled via the
   *   dynamic importer)
   */
  class Importer {
    constructor() {
      this.documents = {};
      // Used to keep track of pending loads, so that flattening and firing of
      // events can be done when all resources are ready.
      this.inflight = 0;
      // 1. Load imports contents
      // 2. Assign them to first import links on the document
      // 3. Wait for import styles & scripts to be done loading/running
      // 4. Fire load/error events
      whenDocumentReady(() => {
        // Observe changes on <head>.
        new MutationObserver(m => this.handleMutations(m)).observe(document.head, {
          childList: true,
          subtree: true
        });
        this.load();
      });
    }

    /**
     * Loads the resources needed by the import link and fires the load/error
     * event on the node once finished. If link is not defined or null, loads
     * all imports in the main document.
     * @param {HTMLLinkElement=} link
     * @return {Promise|undefined}
     */
    load(link) {
      let whenLoadedPromise = link ? this.whenImportLoaded(link) :
        this.whenImportsLoaded(document);
      if (whenLoadedPromise) {
        this.inflight++;
        whenLoadedPromise = whenLoadedPromise.then(() => {
          // Wait until all resources are ready, then load import resources.
          if (--this.inflight === 0) {
            return this.onLoadedAll();
          }
        });
        // If browser doesn't support the unhandled rejection event,
        // log the error stack and fire the error outside the promise so it's
        // visible to listeners of window.onerror
        if (!supportsUnhandledrejection) {
          whenLoadedPromise = whenLoadedPromise.catch(err => {
            console.error(err.stack);
            setTimeout(() => {
              throw err;
            });
            throw 'unhandledrejection';
          });
        }
      }
      return whenLoadedPromise;
    }

    /**
     * @param {!(HTMLDocument|DocumentFragment)} doc
     * @return {Promise|null}
     */
    whenImportsLoaded(doc) {
      const links = /** @type {!NodeList<!HTMLLinkElement>} */
        (doc.querySelectorAll(importSelector));
      const promises = [];
      for (let i = 0, l = links.length; i < l; i++) {
        const promise = this.whenImportLoaded(links[i]);
        if (promise) {
          promises.push(promise);
        }
      }
      return promises.length ? Promise.all(promises).then(() => doc) : null;
    }

    /**
     * @param {!HTMLLinkElement} link
     * @return {Promise|null}
     */
    whenImportLoaded(link) {
      const url = link.href;
      // This resource is already being handled by another import.
      if (this.documents[url] !== undefined) {
        return null;
      }
      // Mark it as pending to notify others this url is being loaded.
      this.documents[url] = 'pending';
      return Xhr.load(url)
        .then(resp => {
          const doc = this.makeDocument(resp.resource, resp.redirectedUrl || url);
          this.documents[url] = doc;
          // Load subtree.
          return this.whenImportsLoaded(doc);
        }, () => this.documents[url] = null) // If load fails, handle error.
        .then(() => link);
    }

    /**
     * Creates a new document containing resource and normalizes urls accordingly.
     * @param {string=} resource
     * @param {string=} url
     * @return {!DocumentFragment}
     */
    makeDocument(resource, url) {
      if (!resource) {
        return document.createDocumentFragment();
      }

      if (isIE) {
        // <link rel=stylesheet> should be appended to <head>. Not doing so
        // in IE/Edge breaks the cascading order. We disable the loading by
        // setting the type before setting innerHTML to avoid loading
        // resources twice.
        resource = resource.replace(STYLESHEET_REGEXP, (match, p1, p2) => {
          if (match.indexOf('type=') === -1) {
            return `${p1} type=${importDisableType} ${p2}`;
          }
          return match;
        });
      }

      let content;
      const template = /** @type {!HTMLTemplateElement} */
        (document.createElement('template'));
      template.innerHTML = resource;
      if (template.content) {
        // This creates issues in Safari10 when used with shadydom (see #12).
        content = template.content;
      } else {
        // <template> not supported, create fragment and move content into it.
        content = document.createDocumentFragment();
        while (template.firstChild) {
          content.appendChild(template.firstChild);
        }
      }

      // Support <base> in imported docs. Resolve url and remove its href.
      const baseEl = content.querySelector('base');
      if (baseEl) {
        url = Path.replaceAttrUrl(baseEl.getAttribute('href'), url);
        baseEl.removeAttribute('href');
      }

      // This is specific to users of <dom-module> (Polymer).
      // TODO(valdrin) remove this when Polymer uses importForElement.
      const s$ = content.querySelectorAll('dom-module');
      for (let i = 0, s; i < s$.length && (s = s$[i]); i++) {
        s.setAttribute('assetpath',
          Path.replaceAttrUrl(s.getAttribute('assetpath') || '', url));
      }

      const n$ = /** @type {!NodeList<!(HTMLLinkElement|HTMLScriptElement|HTMLStyleElement)>} */
        (content.querySelectorAll(importDependenciesSelector));
      // For source map hints.
      let inlineScriptIndex = 0;
      for (let i = 0, l = n$.length, n; i < l && (n = n$[i]); i++) {
        // Listen for load/error events, then fix urls.
        whenElementLoaded(n);
        Path.fixUrls(n, url);
        // Mark for easier selectors.
        n.setAttribute(importDependencyAttr, '');
        // Generate source map hints for inline scripts.
        if (n.localName === 'script' && !n.src && n.textContent) {
          const num = inlineScriptIndex ? `-${inlineScriptIndex}` : '';
          const content = n.textContent + `\n//# sourceURL=${url}${num}.js\n`;
          // We use the src attribute so it triggers load/error events, and it's
          // easier to capture errors (e.g. parsing) like this.
          n.setAttribute('src', 'data:text/javascript;charset=utf-8,' + encodeURIComponent(content));
          n.textContent = '';
          inlineScriptIndex++;
        }
      }
      Path.fixUrlsInTemplates(content, url);
      return content;
    }

    /**
     * Returns a promise resolved after the loaded imports finish loading scripts
     * and styles, and fire the load/error events.
     * @return {!Promise}
     */
    onLoadedAll() {
      this.flatten(document);
      // We wait for styles to load, and at the same time we execute the scripts,
      // then fire the load/error events for imports to have faster whenReady
      // callback execution.
      // NOTE: This is different for native behavior where scripts would be
      // executed after the styles before them are loaded.
      // To achieve that, we could select pending styles and scripts in the
      // document and execute them sequentially in their dom order.
      return Promise.all([this.waitForStyles(), this.runScripts()])
        .then(() => this.fireEvents());
    }

    /**
     * @param {!HTMLDocument} doc
     */
    flatten(doc) {
      const n$ = /** @type {!NodeList<!HTMLLinkElement>} */
        (doc.querySelectorAll(importSelector));
      for (let i = 0, l = n$.length, n; i < l && (n = n$[i]); i++) {
        const imp = this.documents[n.href];
        n.import = /** @type {!Document} */ (imp);
        if (imp && imp.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          // We set the .import to be the link itself, and update its readyState.
          // Other links with the same href will point to this link.
          this.documents[n.href] = n;
          n.readyState = 'loading';
          // Suppress Closure warning about incompatible subtype assignment.
          ( /** @type {!HTMLElement} */ (n).import = n);
          this.flatten(imp);
          n.appendChild(imp);
        }
      }
    }

    /**
     * Replaces all the imported scripts with a clone in order to execute them.
     * Updates the `currentScript`.
     * @return {Promise} Resolved when scripts are loaded.
     */
    runScripts() {
      const s$ = document.querySelectorAll(pendingScriptsSelector);
      let promise = Promise.resolve();
      for (let i = 0, l = s$.length, s; i < l && (s = s$[i]); i++) {
        promise = promise.then(() => {
          // The pending scripts have been generated through innerHTML and
          // browsers won't execute them for security reasons. We cannot use
          // s.cloneNode(true) either, the only way to run the script is manually
          // creating a new element and copying its attributes.
          const clone = /** @type {!HTMLScriptElement} */
            (document.createElement('script'));
          // Remove import-dependency attribute to avoid double cloning.
          s.removeAttribute(importDependencyAttr);
          for (let j = 0, ll = s.attributes.length; j < ll; j++) {
            clone.setAttribute(s.attributes[j].name, s.attributes[j].value);
          }

          // Update currentScript and replace original with clone script.
          currentScript = clone;
          s.parentNode.replaceChild(clone, s);
          // Wait for load/error events; after is loaded, reset currentScript.
          return whenElementLoaded(clone).then(() => currentScript = null);
        });
      }
      return promise;
    }

    /**
     * Waits for all the imported stylesheets/styles to be loaded.
     * @return {Promise}
     */
    waitForStyles() {
      // <link rel=stylesheet> should be appended to <head>. Not doing so
      // in IE/Edge breaks the cascading order
      // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/10472273/
      // If there is one <link rel=stylesheet> imported, we must move all imported
      // links and styles to <head>.
      const needsMove = !!document.querySelector(disabledLinkSelector);
      const s$ = /** @type {!NodeList<!(HTMLLinkElement|HTMLStyleElement)>} */
        (document.querySelectorAll(pendingStylesSelector));
      const promises = [];
      for (let i = 0, l = s$.length, s; i < l && (s = s$[i]); i++) {
        // Listen for load/error events, remove selector once is done loading.
        promises.push(whenElementLoaded(s)
          .then(() => s.removeAttribute(importDependencyAttr)));
        // Check if was already moved to head, to handle the case where the element
        // has already been moved but it is still loading.
        if (needsMove && s.parentNode !== document.head) {
          let rootImport = importForElement(s);
          while (rootImport && importForElement(rootImport)) {
            rootImport = importForElement(rootImport);
          }
          // Replace the element we're about to move with a placeholder.
          // NOTE: we first have to append the element to the new parent, then
          // we can put the placeholder at its place, otherwise load/error events
          // seem to be fired too early.
          const parent = s.parentNode,
            next = s.nextSibling,
            placeholder = document.createElement(s.localName);
          // Add reference of the moved element.
          placeholder['__appliedElement'] = s;
          // Disable this from appearing in document.styleSheets.
          placeholder.setAttribute('type', 'import-placeholder');
          // First, re-parent the element...
          if (rootImport.parentNode === document.head) {
            document.head.insertBefore(s, rootImport);
          } else {
            document.head.appendChild(s);
          }
          // ...and then, insert the placeholder at the right place.
          parent.insertBefore(placeholder, next);
          // Enable the loading of <link rel=stylesheet>.
          s.removeAttribute('type');
        }
      }
      return Promise.all(promises);
    }

    /**
     * Fires load/error events for imports in the right order .
     */
    fireEvents() {
      const n$ = /** @type {!NodeList<!HTMLLinkElement>} */
        (document.querySelectorAll(importSelector));
      // Inverse order to have events firing bottom-up.
      for (let i = n$.length - 1, n; i >= 0 && (n = n$[i]); i--) {
        this.fireEventIfNeeded(n);
      }
    }

    /**
     * Fires load/error event for the import if this wasn't done already.
     * @param {!HTMLLinkElement} link
     */
    fireEventIfNeeded(link) {
      // Don't fire twice same event.
      if (!link['__loaded']) {
        link['__loaded'] = true;
        // Update link's import readyState.
        link.import && (link.import.readyState = 'complete');
        const eventType = link.import ? 'load' : 'error';
        link.dispatchEvent(new CustomEvent(eventType, {
          bubbles: false,
          cancelable: false,
          detail: undefined
        }));
      }
    }

    /**
     * @param {Array<MutationRecord>} mutations
     */
    handleMutations(mutations) {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (!m.addedNodes) {
          continue;
        }
        for (let ii = 0; ii < m.addedNodes.length; ii++) {
          const link = m.addedNodes[ii];
          if (!link || link.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          // NOTE: added scripts are not updating currentScript in IE.
          // TODO add test w/ script & stylesheet maybe
          const imports = /** @type {!NodeList<!HTMLLinkElement>} */
            (isImportLink(link) ? [link] : link.querySelectorAll(importSelector));
          for (let iii = 0; iii < imports.length; iii++) {
            const n = imports[iii];
            const imp = this.documents[n.href];
            // First time we see this import, load.
            if (imp === undefined) {
              this.load(n);
            }
            // If nothing else is loading, we can safely associate the import
            // and fire the load/error event.
            else if (!this.inflight) {
              n.import = imp;
              this.fireEventIfNeeded(n);
            }
          }
        }
      }
    }
  }

  /**
   * @param {!Node} node
   * @return {boolean}
   */
  const isImportLink = node => {
    return node.nodeType === Node.ELEMENT_NODE && node.localName === 'link' &&
      ( /** @type {!HTMLLinkElement} */ (node).rel === 'import');
  };

  /**
   * Waits for an element to finish loading. If already done loading, it will
   * mark the element accordingly.
   * @param {!(HTMLLinkElement|HTMLScriptElement|HTMLStyleElement)} element
   * @return {Promise}
   */
  const whenElementLoaded = element => {
    if (!element['__loadPromise']) {
      element['__loadPromise'] = new Promise(resolve => {
        // Inline scripts don't trigger load/error events, consider them already loaded.
        if (element.localName === 'script' && !element.src) {
          resolve();
        } else if (isIE && element.localName === 'style') {
          // NOTE: We listen only for load events in IE/Edge, because in IE/Edge
          // <style> with @import will fire error events for each failing @import,
          // and finally will trigger the load event when all @import are
          // finished (even if all fail).
          element.addEventListener('load', resolve);
        } else {
          element.addEventListener('load', resolve);
          element.addEventListener('error', resolve);
        }
      }).then(() => {
        element['__loaded'] = true;
        return element;
      });
    }
    return element['__loadPromise'];
  };

  /**
   * Calls the callback when all imports in the document at call time
   * (or at least document ready) have loaded. Callback is called synchronously
   * if imports are already done loading.
   * @param {function()=} callback
   */
  const whenReady = callback => {
    // 1. ensure the document is in a ready state (has dom), then
    // 2. watch for loading of imports and call callback when done
    whenDocumentReady(() => whenImportsReady(() => callback && callback()));
  };

  /**
   * Invokes the callback when document is in ready state. Callback is called
   *  synchronously if document is already done loading.
   * @param {!function()} callback
   */
  const whenDocumentReady = callback => {
    if (document.readyState !== 'loading') {
      callback();
    } else {
      const stateChanged = () => {
        if (document.readyState !== 'loading') {
          document.removeEventListener('readystatechange', stateChanged);
          callback();
        }
      };
      document.addEventListener('readystatechange', stateChanged);
    }
  };

  /**
   * Invokes the callback after all imports are loaded. Callback is called
   * synchronously if imports are already done loading.
   * @param {!function()} callback
   */
  const whenImportsReady = callback => {
    let imports = /** @type {!NodeList<!HTMLLinkElement>} */
      (document.querySelectorAll(rootImportSelector));
    const promises = [];
    for (let i = 0, l = imports.length, imp; i < l && (imp = imports[i]); i++) {
      if (!imp['__loaded']) {
        promises.push(whenElementLoaded(imp));
      }
    }
    if (promises.length) {
      // Execute callback outside the promise scope to avoid unhandled promise
      // exceptions that don't depend on whenImportsReady.
      let all = Promise.all(promises).then(callback);
      if (!supportsUnhandledrejection) {
        all.catch(err => {
          console.error(err.stack);
          setTimeout(() => {
            throw err;
          });
          throw 'unhandledrejection';
        });
      }
    } else {
      callback();
    }
  };

  /**
   * Returns the link that imported the element.
   * @param {!Node} element
   * @return {HTMLLinkElement|Document|undefined}
   */
  const importForElement = element => {
    if (useNative) {
      return element.ownerDocument;
    }
    let owner = element['__ownerImport'];
    if (!owner) {
      owner = element;
      // Walk up the parent tree until we find an import.
      while ((owner = owner.parentNode || owner.host) && !isImportLink(owner)) {}
      element['__ownerImport'] = owner;
    }
    return owner;
  };

  if (useNative) {
    // Check for imports that might already be done loading by the time this
    // script is actually executed. Native imports are blocking, so the ones
    // available in the document by this time should already have failed
    // or have .import defined.
    const imps = /** @type {!NodeList<!HTMLLinkElement>} */
      (document.querySelectorAll(importSelector));
    for (let i = 0, l = imps.length, imp; i < l && (imp = imps[i]); i++) {
      if (!imp.import || imp.import.readyState !== 'loading') {
        imp['__loaded'] = true;
      }
    }
    // Listen for load/error events to capture dynamically added scripts.
    /**
     * @type {!function(!Event)}
     */
    const onLoadingDone = event => {
      const elem = /** @type {!Element} */ (event.target);
      if (isImportLink(elem)) {
        elem['__loaded'] = true;
      }
    };
    document.addEventListener('load', onLoadingDone, true /* useCapture */ );
    document.addEventListener('error', onLoadingDone, true /* useCapture */ );
  } else {
    new Importer();
  }

  /**
    Add support for the `HTMLImportsLoaded` event and the `HTMLImports.whenReady`
    method. This api is necessary because unlike the native implementation,
    script elements do not force imports to resolve. Instead, users should wrap
    code in either an `HTMLImportsLoaded` handler or after load time in an
    `HTMLImports.whenReady(callback)` call.

    NOTE: This module also supports these apis under the native implementation.
    Therefore, if this file is loaded, the same code can be used under both
    the polyfill and native implementation.
   */
  whenReady(() => document.dispatchEvent(new CustomEvent('HTMLImportsLoaded', {
    cancelable: true,
    bubbles: true,
    detail: undefined
  })));

  // exports
  scope.useNative = useNative;
  scope.whenReady = whenReady;
  scope.importForElement = importForElement;

})(window.HTMLImports = (window.HTMLImports || {}));

/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function() {

  'use strict';

  // Establish scope.
  window.WebComponents = window.WebComponents || {flags:{}};

  // loading script
  var file = 'webcomponents-lite.js';
  var script = document.querySelector('script[src*="' + file + '"]');

  // Flags. Convert url arguments to flags
  var flags = {};
  if (!flags.noOpts) {
    // from url
    location.search.slice(1).split('&').forEach(function(option) {
      var parts = option.split('=');
      var match;
      if (parts[0] && (match = parts[0].match(/wc-(.+)/))) {
        flags[match[1]] = parts[1] || true;
      }
    });
    // from script
    if (script) {
      for (var i=0, a; (a=script.attributes[i]); i++) {
        if (a.name !== 'src') {
          flags[a.name] = a.value || true;
        }
      }
    }
    // log flags
    if (flags.log && flags.log.split) {
      var parts = flags.log.split(',');
      flags.log = {};
      parts.forEach(function(f) {
        flags.log[f] = true;
      });
    } else {
      flags.log = {};
    }
  }

  // exports
  WebComponents.flags = flags;
  var scope = window.WebComponents;
  var forceShady = scope.flags.shadydom;
  if (forceShady) {
    window.ShadyDOM = window.ShadyDOM || {};
    ShadyDOM.force = forceShady;
  }

  var forceCE = scope.flags.register || scope.flags.ce;
  if (forceCE && window.customElements) {
    customElements.forcePolyfill = forceCE;
  }

})();

(function(){
/*

Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
'use strict';var module$$src$array_splice={};function newSplice$$module$$src$array_splice(a,b,c){return{index:a,removed:b,addedCount:c}}
var EDIT_LEAVE$$module$$src$array_splice=0,EDIT_UPDATE$$module$$src$array_splice=1,EDIT_ADD$$module$$src$array_splice=2,EDIT_DELETE$$module$$src$array_splice=3,ArraySplice$$module$$src$array_splice={calcEditDistances:function(a,b,c,d,e,f){f=f-e+1;c=c-b+1;for(var g=Array(f),h=0;h<f;h++)g[h]=Array(c),g[h][0]=h;for(h=0;h<c;h++)g[0][h]=h;for(h=1;h<f;h++)for(var k=1;k<c;k++)if(this.equals(a[b+k-1],d[e+h-1]))g[h][k]=g[h-1][k-1];else{var l=g[h-1][k]+1,m=g[h][k-1]+1;g[h][k]=l<m?l:m;}return g},spliceOperationsFromEditDistances:function(a){for(var b=
a.length-1,c=a[0].length-1,d=a[b][c],e=[];0<b||0<c;)if(0==b)e.push(EDIT_ADD$$module$$src$array_splice),c--;else if(0==c)e.push(EDIT_DELETE$$module$$src$array_splice),b--;else{var f=a[b-1][c-1],g=a[b-1][c],h=a[b][c-1],k;k=g<h?g<f?g:f:h<f?h:f;k==f?(f==d?e.push(EDIT_LEAVE$$module$$src$array_splice):(e.push(EDIT_UPDATE$$module$$src$array_splice),d=f),b--,c--):k==g?(e.push(EDIT_DELETE$$module$$src$array_splice),b--,d=g):(e.push(EDIT_ADD$$module$$src$array_splice),c--,d=h);}e.reverse();return e},calcSplices:function(a,
b,c,d,e,f){var g=0,h=0,k=Math.min(c-b,f-e);0==b&&0==e&&(g=this.sharedPrefix(a,d,k));c==a.length&&f==d.length&&(h=this.sharedSuffix(a,d,k-g));b+=g;e+=g;c-=h;f-=h;if(0==c-b&&0==f-e)return[];if(b==c){for(a=newSplice$$module$$src$array_splice(b,[],0);e<f;)a.removed.push(d[e++]);return[a]}if(e==f)return[newSplice$$module$$src$array_splice(b,[],c-b)];f=this.spliceOperationsFromEditDistances(this.calcEditDistances(a,b,c,d,e,f));a=void 0;c=[];for(g=0;g<f.length;g++)switch(f[g]){case EDIT_LEAVE$$module$$src$array_splice:a&&
(c.push(a),a=void 0);b++;e++;break;case EDIT_UPDATE$$module$$src$array_splice:a||(a=newSplice$$module$$src$array_splice(b,[],0));a.addedCount++;b++;a.removed.push(d[e]);e++;break;case EDIT_ADD$$module$$src$array_splice:a||(a=newSplice$$module$$src$array_splice(b,[],0));a.addedCount++;b++;break;case EDIT_DELETE$$module$$src$array_splice:a||(a=newSplice$$module$$src$array_splice(b,[],0)),a.removed.push(d[e]),e++;}a&&c.push(a);return c},sharedPrefix:function(a,b,c){for(var d=0;d<c;d++)if(!this.equals(a[d],
b[d]))return d;return c},sharedSuffix:function(a,b,c){for(var d=a.length,e=b.length,f=0;f<c&&this.equals(a[--d],b[--e]);)f++;return f},calculateSplices:function(a,b){return this.calcSplices(a,0,a.length,b,0,b.length)},equals:function(a,b){return a===b}},calculateSplices$$module$$src$array_splice=function(a,b){return ArraySplice$$module$$src$array_splice.calculateSplices(a,b)};module$$src$array_splice.calculateSplices=calculateSplices$$module$$src$array_splice;var module$$src$utils={},settings$$module$$src$utils=window.ShadyDOM||{};settings$$module$$src$utils.hasNativeShadowDOM=!(!Element.prototype.attachShadow||!Node.prototype.getRootNode);var desc$$module$$src$utils=Object.getOwnPropertyDescriptor(Node.prototype,"firstChild");settings$$module$$src$utils.hasDescriptors=!!(desc$$module$$src$utils&&desc$$module$$src$utils.configurable&&desc$$module$$src$utils.get);settings$$module$$src$utils.inUse=settings$$module$$src$utils.force||!settings$$module$$src$utils.hasNativeShadowDOM;
function isShadyRoot$$module$$src$utils(a){return"ShadyRoot"===a.__localName}function ownerShadyRootForNode$$module$$src$utils(a){a=a.getRootNode();if(isShadyRoot$$module$$src$utils(a))return a}var p$$module$$src$utils=Element.prototype,matches$$module$$src$utils=p$$module$$src$utils.matches||p$$module$$src$utils.matchesSelector||p$$module$$src$utils.mozMatchesSelector||p$$module$$src$utils.msMatchesSelector||p$$module$$src$utils.oMatchesSelector||p$$module$$src$utils.webkitMatchesSelector;
function matchesSelector$$module$$src$utils(a,b){return matches$$module$$src$utils.call(a,b)}function copyOwnProperty$$module$$src$utils(a,b,c){(b=Object.getOwnPropertyDescriptor(b,a))&&Object.defineProperty(c,a,b);}function extend$$module$$src$utils(a,b){if(a&&b)for(var c=Object.getOwnPropertyNames(b),d=0,e;d<c.length&&(e=c[d]);d++)copyOwnProperty$$module$$src$utils(e,b,a);return a||b}
function extendAll$$module$$src$utils(a,b){for(var c=[],d=1;d<arguments.length;++d)c[d-1]=arguments[d];for(d=0;d<c.length;d++)extend$$module$$src$utils(a,c[d]);return a}function mixin$$module$$src$utils(a,b){for(var c in b)a[c]=b[c];return a}function patchPrototype$$module$$src$utils(a,b){var c=Object.getPrototypeOf(a);if(!c.hasOwnProperty("__patchProto")){var d=Object.create(c);d.__sourceProto=c;extend$$module$$src$utils(d,b);c.__patchProto=d;}a.__proto__=c.__patchProto;}
var twiddle$$module$$src$utils=document.createTextNode(""),content$$module$$src$utils=0,queue$$module$$src$utils=[];(new MutationObserver(function(){for(;queue$$module$$src$utils.length;)try{queue$$module$$src$utils.shift()();}catch(a){throw twiddle$$module$$src$utils.textContent=content$$module$$src$utils++,a;}})).observe(twiddle$$module$$src$utils,{characterData:!0});
function microtask$$module$$src$utils(a){queue$$module$$src$utils.push(a);twiddle$$module$$src$utils.textContent=content$$module$$src$utils++;}module$$src$utils.settings=settings$$module$$src$utils;module$$src$utils.isShadyRoot=isShadyRoot$$module$$src$utils;module$$src$utils.ownerShadyRootForNode=ownerShadyRootForNode$$module$$src$utils;module$$src$utils.matchesSelector=matchesSelector$$module$$src$utils;module$$src$utils.extend=extend$$module$$src$utils;module$$src$utils.extendAll=extendAll$$module$$src$utils;
module$$src$utils.mixin=mixin$$module$$src$utils;module$$src$utils.patchPrototype=patchPrototype$$module$$src$utils;module$$src$utils.microtask=microtask$$module$$src$utils;var module$$src$flush={},customElements$$module$$src$flush=window.customElements,flushList$$module$$src$flush=[],scheduled$$module$$src$flush,flushCount$$module$$src$flush=0,flushMax$$module$$src$flush=100;function enqueue$$module$$src$flush(a){scheduled$$module$$src$flush||(scheduled$$module$$src$flush=!0,module$$src$utils.microtask(flush$$module$$src$flush));flushList$$module$$src$flush.push(a);}
function flush$$module$$src$flush(){scheduled$$module$$src$flush=!1;for(flushCount$$module$$src$flush++;flushList$$module$$src$flush.length;)flushList$$module$$src$flush.shift()();customElements$$module$$src$flush&&customElements$$module$$src$flush.flush&&customElements$$module$$src$flush.flush();var a=flushCount$$module$$src$flush>flushMax$$module$$src$flush;flushList$$module$$src$flush.length&&!a&&flush$$module$$src$flush();flushCount$$module$$src$flush=0;if(a)throw Error("Loop detected in ShadyDOM distribution, aborting.");
}flush$$module$$src$flush.list=flushList$$module$$src$flush;module$$src$flush.enqueue=enqueue$$module$$src$flush;module$$src$flush.flush=flush$$module$$src$flush;var module$$src$logical_properties={};function getProperty$$module$$src$logical_properties(a,b){return a.__shady&&a.__shady[b]}function hasProperty$$module$$src$logical_properties(a,b){return void 0!==getProperty$$module$$src$logical_properties(a,b)}module$$src$logical_properties.getProperty=getProperty$$module$$src$logical_properties;module$$src$logical_properties.hasProperty=hasProperty$$module$$src$logical_properties;var module$$src$innerHTML={},escapeAttrRegExp$$module$$src$innerHTML=/[&\u00A0"]/g,escapeDataRegExp$$module$$src$innerHTML=/[&\u00A0<>]/g;function escapeReplace$$module$$src$innerHTML(a){switch(a){case "&":return"&amp;";case "<":return"&lt;";case ">":return"&gt;";case '"':return"&quot;";case "\u00a0":return"&nbsp;"}}function escapeAttr$$module$$src$innerHTML(a){return a.replace(escapeAttrRegExp$$module$$src$innerHTML,escapeReplace$$module$$src$innerHTML)}
function escapeData$$module$$src$innerHTML(a){return a.replace(escapeDataRegExp$$module$$src$innerHTML,escapeReplace$$module$$src$innerHTML)}function makeSet$$module$$src$innerHTML(a){for(var b={},c=0;c<a.length;c++)b[a[c]]=!0;return b}var voidElements$$module$$src$innerHTML=makeSet$$module$$src$innerHTML("area base br col command embed hr img input keygen link meta param source track wbr".split(" ")),plaintextParents$$module$$src$innerHTML=makeSet$$module$$src$innerHTML("style script xmp iframe noembed noframes plaintext noscript".split(" "));
function getOuterHTML$$module$$src$innerHTML(a,b,c){switch(a.nodeType){case Node.ELEMENT_NODE:b=a.localName;for(var d="<"+b,e=a.attributes,f=0,g;g=e[f];f++)d+=" "+g.name+'="'+escapeAttr$$module$$src$innerHTML(g.value)+'"';d+=">";return voidElements$$module$$src$innerHTML[b]?d:d+getInnerHTML$$module$$src$innerHTML(a,c)+"</"+b+">";case Node.TEXT_NODE:return a=a.data,b&&plaintextParents$$module$$src$innerHTML[b.localName]?a:escapeData$$module$$src$innerHTML(a);case Node.COMMENT_NODE:return"\x3c!--"+
a.data+"--\x3e";default:throw window.console.error(a),Error("not implemented");}}function getInnerHTML$$module$$src$innerHTML(a,b){"template"===a.localName&&(a=a.content);for(var c="",d=b?b(a):a.childNodes,e=0,f=d.length,g;e<f&&(g=d[e]);e++)c+=getOuterHTML$$module$$src$innerHTML(g,a,b);return c}module$$src$innerHTML.getOuterHTML=getOuterHTML$$module$$src$innerHTML;module$$src$innerHTML.getInnerHTML=getInnerHTML$$module$$src$innerHTML;var module$$src$native_tree={},nodeWalker$$module$$src$native_tree=document.createTreeWalker(document,NodeFilter.SHOW_ALL,null,!1),elementWalker$$module$$src$native_tree=document.createTreeWalker(document,NodeFilter.SHOW_ELEMENT,null,!1);function parentNode$$module$$src$native_tree(a){nodeWalker$$module$$src$native_tree.currentNode=a;return nodeWalker$$module$$src$native_tree.parentNode()}
function firstChild$$module$$src$native_tree(a){nodeWalker$$module$$src$native_tree.currentNode=a;return nodeWalker$$module$$src$native_tree.firstChild()}function lastChild$$module$$src$native_tree(a){nodeWalker$$module$$src$native_tree.currentNode=a;return nodeWalker$$module$$src$native_tree.lastChild()}function previousSibling$$module$$src$native_tree(a){nodeWalker$$module$$src$native_tree.currentNode=a;return nodeWalker$$module$$src$native_tree.previousSibling()}
function nextSibling$$module$$src$native_tree(a){nodeWalker$$module$$src$native_tree.currentNode=a;return nodeWalker$$module$$src$native_tree.nextSibling()}function childNodes$$module$$src$native_tree(a){var b=[];nodeWalker$$module$$src$native_tree.currentNode=a;for(a=nodeWalker$$module$$src$native_tree.firstChild();a;)b.push(a),a=nodeWalker$$module$$src$native_tree.nextSibling();return b}
function parentElement$$module$$src$native_tree(a){elementWalker$$module$$src$native_tree.currentNode=a;return elementWalker$$module$$src$native_tree.parentNode()}function firstElementChild$$module$$src$native_tree(a){elementWalker$$module$$src$native_tree.currentNode=a;return elementWalker$$module$$src$native_tree.firstChild()}function lastElementChild$$module$$src$native_tree(a){elementWalker$$module$$src$native_tree.currentNode=a;return elementWalker$$module$$src$native_tree.lastChild()}
function previousElementSibling$$module$$src$native_tree(a){elementWalker$$module$$src$native_tree.currentNode=a;return elementWalker$$module$$src$native_tree.previousSibling()}function nextElementSibling$$module$$src$native_tree(a){elementWalker$$module$$src$native_tree.currentNode=a;return elementWalker$$module$$src$native_tree.nextSibling()}
function children$$module$$src$native_tree(a){var b=[];elementWalker$$module$$src$native_tree.currentNode=a;for(a=elementWalker$$module$$src$native_tree.firstChild();a;)b.push(a),a=elementWalker$$module$$src$native_tree.nextSibling();return b}function innerHTML$$module$$src$native_tree(a){return module$$src$innerHTML.getInnerHTML(a,function(a){return childNodes$$module$$src$native_tree(a)})}
function textContent$$module$$src$native_tree(a){if(a.nodeType!==Node.ELEMENT_NODE)return a.nodeValue;a=document.createTreeWalker(a,NodeFilter.SHOW_TEXT,null,!1);for(var b="",c;c=a.nextNode();)b+=c.nodeValue;return b}module$$src$native_tree.parentNode=parentNode$$module$$src$native_tree;module$$src$native_tree.firstChild=firstChild$$module$$src$native_tree;module$$src$native_tree.lastChild=lastChild$$module$$src$native_tree;module$$src$native_tree.previousSibling=previousSibling$$module$$src$native_tree;
module$$src$native_tree.nextSibling=nextSibling$$module$$src$native_tree;module$$src$native_tree.childNodes=childNodes$$module$$src$native_tree;module$$src$native_tree.parentElement=parentElement$$module$$src$native_tree;module$$src$native_tree.firstElementChild=firstElementChild$$module$$src$native_tree;module$$src$native_tree.lastElementChild=lastElementChild$$module$$src$native_tree;module$$src$native_tree.previousElementSibling=previousElementSibling$$module$$src$native_tree;
module$$src$native_tree.nextElementSibling=nextElementSibling$$module$$src$native_tree;module$$src$native_tree.children=children$$module$$src$native_tree;module$$src$native_tree.innerHTML=innerHTML$$module$$src$native_tree;module$$src$native_tree.textContent=textContent$$module$$src$native_tree;var module$$src$patch_accessors={};function generateSimpleDescriptor$$module$$src$patch_accessors(a){return{get:function(){var b=module$$src$logical_properties.getProperty(this,a);return void 0!==b?b:module$$src$native_tree[a](this)},configurable:!0}}function clearNode$$module$$src$patch_accessors(a){for(;a.firstChild;)a.removeChild(a.firstChild);}
var nativeInnerHTMLDesc$$module$$src$patch_accessors=Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML")||Object.getOwnPropertyDescriptor(HTMLElement.prototype,"innerHTML"),inertDoc$$module$$src$patch_accessors=document.implementation.createHTMLDocument("inert"),htmlContainer$$module$$src$patch_accessors=inertDoc$$module$$src$patch_accessors.createElement("div"),nativeActiveElementDescriptor$$module$$src$patch_accessors=Object.getOwnPropertyDescriptor(Document.prototype,"activeElement");
function getDocumentActiveElement$$module$$src$patch_accessors(){if(nativeActiveElementDescriptor$$module$$src$patch_accessors&&nativeActiveElementDescriptor$$module$$src$patch_accessors.get)return nativeActiveElementDescriptor$$module$$src$patch_accessors.get.call(document);if(!module$$src$utils.settings.hasDescriptors)return document.activeElement}
function activeElementForNode$$module$$src$patch_accessors(a){var b=getDocumentActiveElement$$module$$src$patch_accessors();if(!b)return null;var c=!!module$$src$utils.isShadyRoot(a);if(!(a===document||c&&a.host!==b&&a.host.contains(b)))return null;for(c=module$$src$utils.ownerShadyRootForNode(b);c&&c!==a;)b=c.host,c=module$$src$utils.ownerShadyRootForNode(b);return a===document?c?null:b:c===a?b:null}
var OutsideAccessors$$module$$src$patch_accessors={parentElement:generateSimpleDescriptor$$module$$src$patch_accessors("parentElement"),parentNode:generateSimpleDescriptor$$module$$src$patch_accessors("parentNode"),nextSibling:generateSimpleDescriptor$$module$$src$patch_accessors("nextSibling"),previousSibling:generateSimpleDescriptor$$module$$src$patch_accessors("previousSibling"),className:{get:function(){return this.getAttribute("class")},set:function(a){this.setAttribute("class",a);},configurable:!0},
nextElementSibling:{get:function(){if(module$$src$logical_properties.hasProperty(this,"nextSibling")){for(var a=this.nextSibling;a&&a.nodeType!==Node.ELEMENT_NODE;)a=a.nextSibling;return a}return module$$src$native_tree.nextElementSibling(this)},configurable:!0},previousElementSibling:{get:function(){if(module$$src$logical_properties.hasProperty(this,"previousSibling")){for(var a=this.previousSibling;a&&a.nodeType!==Node.ELEMENT_NODE;)a=a.previousSibling;return a}return module$$src$native_tree.previousElementSibling(this)},
configurable:!0}},InsideAccessors$$module$$src$patch_accessors={childNodes:{get:function(){if(module$$src$logical_properties.hasProperty(this,"firstChild")){if(!this.__shady.childNodes){this.__shady.childNodes=[];for(var a=this.firstChild;a;a=a.nextSibling)this.__shady.childNodes.push(a);}return this.__shady.childNodes}return module$$src$native_tree.childNodes(this)},configurable:!0},firstChild:generateSimpleDescriptor$$module$$src$patch_accessors("firstChild"),lastChild:generateSimpleDescriptor$$module$$src$patch_accessors("lastChild"),
textContent:{get:function(){if(module$$src$logical_properties.hasProperty(this,"firstChild")){for(var a=[],b=0,c=this.childNodes,d;d=c[b];b++)d.nodeType!==Node.COMMENT_NODE&&a.push(d.textContent);return a.join("")}return module$$src$native_tree.textContent(this)},set:function(a){this.nodeType!==Node.ELEMENT_NODE?this.nodeValue=a:(clearNode$$module$$src$patch_accessors(this),a&&this.appendChild(document.createTextNode(a)));},configurable:!0},firstElementChild:{get:function(){if(module$$src$logical_properties.hasProperty(this,
"firstChild")){for(var a=this.firstChild;a&&a.nodeType!==Node.ELEMENT_NODE;)a=a.nextSibling;return a}return module$$src$native_tree.firstElementChild(this)},configurable:!0},lastElementChild:{get:function(){if(module$$src$logical_properties.hasProperty(this,"lastChild")){for(var a=this.lastChild;a&&a.nodeType!==Node.ELEMENT_NODE;)a=a.previousSibling;return a}return module$$src$native_tree.lastElementChild(this)},configurable:!0},children:{get:function(){return module$$src$logical_properties.hasProperty(this,
"firstChild")?Array.prototype.filter.call(this.childNodes,function(a){return a.nodeType===Node.ELEMENT_NODE}):module$$src$native_tree.children(this)},configurable:!0},innerHTML:{get:function(){var a="template"===this.localName?this.content:this;return module$$src$logical_properties.hasProperty(this,"firstChild")?module$$src$innerHTML.getInnerHTML(a):module$$src$native_tree.innerHTML(a)},set:function(a){var b="template"===this.localName?this.content:this;clearNode$$module$$src$patch_accessors(b);for(nativeInnerHTMLDesc$$module$$src$patch_accessors&&
nativeInnerHTMLDesc$$module$$src$patch_accessors.set?nativeInnerHTMLDesc$$module$$src$patch_accessors.set.call(htmlContainer$$module$$src$patch_accessors,a):htmlContainer$$module$$src$patch_accessors.innerHTML=a;htmlContainer$$module$$src$patch_accessors.firstChild;)b.appendChild(htmlContainer$$module$$src$patch_accessors.firstChild);},configurable:!0}},ShadowRootAccessor$$module$$src$patch_accessors={shadowRoot:{get:function(){return this.shadyRoot},set:function(a){this.shadyRoot=a;},configurable:!0}},
ActiveElementAccessor$$module$$src$patch_accessors={activeElement:{get:function(){return activeElementForNode$$module$$src$patch_accessors(this)},set:function(){},configurable:!0}};function patchAccessorGroup$$module$$src$patch_accessors(a,b,c){for(var d in b){var e=Object.getOwnPropertyDescriptor(a,d);e&&e.configurable||!e&&c?Object.defineProperty(a,d,b[d]):c&&console.warn("Could not define",d,"on",a);}}
function patchAccessors$$module$$src$patch_accessors(a){patchAccessorGroup$$module$$src$patch_accessors(a,OutsideAccessors$$module$$src$patch_accessors);patchAccessorGroup$$module$$src$patch_accessors(a,InsideAccessors$$module$$src$patch_accessors);patchAccessorGroup$$module$$src$patch_accessors(a,ActiveElementAccessor$$module$$src$patch_accessors);}
function patchShadowRootAccessors$$module$$src$patch_accessors(a){patchAccessorGroup$$module$$src$patch_accessors(a,InsideAccessors$$module$$src$patch_accessors,!0);patchAccessorGroup$$module$$src$patch_accessors(a,ActiveElementAccessor$$module$$src$patch_accessors,!0);}
var patchOutsideElementAccessors$$module$$src$patch_accessors=module$$src$utils.settings.hasDescriptors?function(){}:function(a){a.__shady&&a.__shady.__outsideAccessors||(a.__shady=a.__shady||{},a.__shady.__outsideAccessors=!0,patchAccessorGroup$$module$$src$patch_accessors(a,OutsideAccessors$$module$$src$patch_accessors,!0));},patchInsideElementAccessors$$module$$src$patch_accessors=module$$src$utils.settings.hasDescriptors?function(){}:function(a){a.__shady&&a.__shady.__insideAccessors||(a.__shady=
a.__shady||{},a.__shady.__insideAccessors=!0,patchAccessorGroup$$module$$src$patch_accessors(a,InsideAccessors$$module$$src$patch_accessors,!0),patchAccessorGroup$$module$$src$patch_accessors(a,ShadowRootAccessor$$module$$src$patch_accessors,!0));};module$$src$patch_accessors.ShadowRootAccessor=ShadowRootAccessor$$module$$src$patch_accessors;module$$src$patch_accessors.ActiveElementAccessor=ActiveElementAccessor$$module$$src$patch_accessors;module$$src$patch_accessors.patchAccessors=patchAccessors$$module$$src$patch_accessors;
module$$src$patch_accessors.patchShadowRootAccessors=patchShadowRootAccessors$$module$$src$patch_accessors;module$$src$patch_accessors.patchOutsideElementAccessors=patchOutsideElementAccessors$$module$$src$patch_accessors;module$$src$patch_accessors.patchInsideElementAccessors=patchInsideElementAccessors$$module$$src$patch_accessors;var module$$src$logical_tree={};
function recordInsertBefore$$module$$src$logical_tree(a,b,c){module$$src$patch_accessors.patchInsideElementAccessors(b);b.__shady=b.__shady||{};module$$src$logical_properties.hasProperty(b,"firstChild")&&(b.__shady.childNodes=null);if(a.nodeType===Node.DOCUMENT_FRAGMENT_NODE){for(var d=a.childNodes,e=0;e<d.length;e++)linkNode$$module$$src$logical_tree(d[e],b,c);a.__shady=a.__shady||{};b=module$$src$logical_properties.hasProperty(a,"firstChild")?null:void 0;a.__shady.firstChild=a.__shady.lastChild=
b;a.__shady.childNodes=b;}else linkNode$$module$$src$logical_tree(a,b,c);}
function linkNode$$module$$src$logical_tree(a,b,c){module$$src$patch_accessors.patchOutsideElementAccessors(a);c=c||null;a.__shady=a.__shady||{};b.__shady=b.__shady||{};c&&(c.__shady=c.__shady||{});a.__shady.previousSibling=c?c.__shady.previousSibling:b.lastChild;var d=a.__shady.previousSibling;d&&d.__shady&&(d.__shady.nextSibling=a);(d=a.__shady.nextSibling=c)&&d.__shady&&(d.__shady.previousSibling=a);a.__shady.parentNode=b;c?c===b.__shady.firstChild&&(b.__shady.firstChild=a):(b.__shady.lastChild=
a,b.__shady.firstChild||(b.__shady.firstChild=a));b.__shady.childNodes=null;}
function recordRemoveChild$$module$$src$logical_tree(a,b){a.__shady=a.__shady||{};b.__shady=b.__shady||{};a===b.__shady.firstChild&&(b.__shady.firstChild=a.__shady.nextSibling);a===b.__shady.lastChild&&(b.__shady.lastChild=a.__shady.previousSibling);var c=a.__shady.previousSibling,d=a.__shady.nextSibling;c&&(c.__shady=c.__shady||{},c.__shady.nextSibling=d);d&&(d.__shady=d.__shady||{},d.__shady.previousSibling=c);a.__shady.parentNode=a.__shady.previousSibling=a.__shady.nextSibling=void 0;module$$src$logical_properties.hasProperty(b,
"childNodes")&&(b.__shady.childNodes=null);}
var recordChildNodes$$module$$src$logical_tree=function(a){if(!module$$src$logical_properties.hasProperty(a,"firstChild")){a.__shady=a.__shady||{};a.__shady.firstChild=module$$src$native_tree.firstChild(a);a.__shady.lastChild=module$$src$native_tree.lastChild(a);module$$src$patch_accessors.patchInsideElementAccessors(a);for(var b=a.__shady.childNodes=module$$src$native_tree.childNodes(a),c=0,d;c<b.length&&(d=b[c]);c++)d.__shady=d.__shady||{},d.__shady.parentNode=a,d.__shady.nextSibling=b[c+1]||null,
d.__shady.previousSibling=b[c-1]||null,module$$src$patch_accessors.patchOutsideElementAccessors(d);}};module$$src$logical_tree.recordInsertBefore=recordInsertBefore$$module$$src$logical_tree;module$$src$logical_tree.recordRemoveChild=recordRemoveChild$$module$$src$logical_tree;module$$src$logical_tree.recordChildNodes=recordChildNodes$$module$$src$logical_tree;var module$$src$native_methods={},appendChild$$module$$src$native_methods=Element.prototype.appendChild,insertBefore$$module$$src$native_methods=Element.prototype.insertBefore,removeChild$$module$$src$native_methods=Element.prototype.removeChild,setAttribute$$module$$src$native_methods=Element.prototype.setAttribute,removeAttribute$$module$$src$native_methods=Element.prototype.removeAttribute,cloneNode$$module$$src$native_methods=Element.prototype.cloneNode,importNode$$module$$src$native_methods=
Document.prototype.importNode,addEventListener$$module$$src$native_methods=Element.prototype.addEventListener,removeEventListener$$module$$src$native_methods=Element.prototype.removeEventListener;module$$src$native_methods.appendChild=appendChild$$module$$src$native_methods;module$$src$native_methods.insertBefore=insertBefore$$module$$src$native_methods;module$$src$native_methods.removeChild=removeChild$$module$$src$native_methods;module$$src$native_methods.setAttribute=setAttribute$$module$$src$native_methods;
module$$src$native_methods.removeAttribute=removeAttribute$$module$$src$native_methods;module$$src$native_methods.cloneNode=cloneNode$$module$$src$native_methods;module$$src$native_methods.importNode=importNode$$module$$src$native_methods;module$$src$native_methods.addEventListener=addEventListener$$module$$src$native_methods;module$$src$native_methods.removeEventListener=removeEventListener$$module$$src$native_methods;var module$$src$distributor={},NormalizedEvent$$module$$src$distributor="function"===typeof Event?Event:function(a,b){b=b||{};var c=document.createEvent("Event");c.initEvent(a,!!b.bubbles,!!b.cancelable);return c},$jscompDefaultExport$$module$$src$distributor=function(a){this.root=a;this.insertionPointTag="slot";};$jscompDefaultExport$$module$$src$distributor.prototype.getInsertionPoints=function(){return this.root.querySelectorAll(this.insertionPointTag)};
$jscompDefaultExport$$module$$src$distributor.prototype.hasInsertionPoint=function(){return!(!this.root._insertionPoints||!this.root._insertionPoints.length)};$jscompDefaultExport$$module$$src$distributor.prototype.isInsertionPoint=function(a){return a.localName&&a.localName==this.insertionPointTag};$jscompDefaultExport$$module$$src$distributor.prototype.distribute=function(){return this.hasInsertionPoint()?this.distributePool(this.root,this.collectPool()):[]};
$jscompDefaultExport$$module$$src$distributor.prototype.collectPool=function(){for(var a=[],b=0,c=this.root.host.firstChild;c;c=c.nextSibling)a[b++]=c;return a};
$jscompDefaultExport$$module$$src$distributor.prototype.distributePool=function(a,b){a=[];for(var c=this.root._insertionPoints,d=0,e=c.length,f;d<e&&(f=c[d]);d++){this.distributeInsertionPoint(f,b);var g=f.parentNode;g&&g.shadyRoot&&this.hasInsertionPoint(g.shadyRoot)&&a.push(g.shadyRoot);}for(c=0;c<b.length;c++)if(f=b[c])f.__shady=f.__shady||{},f.__shady.assignedSlot=void 0,(d=module$$src$native_tree.parentNode(f))&&module$$src$native_methods.removeChild.call(d,f);return a};
$jscompDefaultExport$$module$$src$distributor.prototype.distributeInsertionPoint=function(a,b){var c=a.__shady.assignedNodes;c&&this.clearAssignedSlots(a,!0);a.__shady.assignedNodes=[];for(var d=!1,e=!1,f=0,g=b.length,h;f<g;f++)(h=b[f])&&this.matchesInsertionPoint(h,a)&&(h.__shady._prevAssignedSlot!=a&&(d=!0),this.distributeNodeInto(h,a),b[f]=void 0,e=!0);if(!e)for(b=a.childNodes,e=0;e<b.length;e++)h=b[e],h.__shady._prevAssignedSlot!=a&&(d=!0),this.distributeNodeInto(h,a);if(c){for(h=0;h<c.length;h++)c[h].__shady._prevAssignedSlot=
null;a.__shady.assignedNodes.length<c.length&&(d=!0);}this.setDistributedNodesOnInsertionPoint(a);d&&this._fireSlotChange(a);};$jscompDefaultExport$$module$$src$distributor.prototype.clearAssignedSlots=function(a,b){var c=a.__shady.assignedNodes;if(c)for(var d=0;d<c.length;d++){var e=c[d];b&&(e.__shady._prevAssignedSlot=e.__shady.assignedSlot);e.__shady.assignedSlot===a&&(e.__shady.assignedSlot=null);}};
$jscompDefaultExport$$module$$src$distributor.prototype.matchesInsertionPoint=function(a,b){b=(b=b.getAttribute("name"))?b.trim():"";a=(a=a.getAttribute&&a.getAttribute("slot"))?a.trim():"";return a==b};$jscompDefaultExport$$module$$src$distributor.prototype.distributeNodeInto=function(a,b){b.__shady.assignedNodes.push(a);a.__shady.assignedSlot=b;};
$jscompDefaultExport$$module$$src$distributor.prototype.setDistributedNodesOnInsertionPoint=function(a){var b=a.__shady.assignedNodes;a.__shady.distributedNodes=[];for(var c=0,d;c<b.length&&(d=b[c]);c++)if(this.isInsertionPoint(d)){var e=d.__shady.distributedNodes;if(e)for(var f=0;f<e.length;f++)a.__shady.distributedNodes.push(e[f]);}else a.__shady.distributedNodes.push(b[c]);};
$jscompDefaultExport$$module$$src$distributor.prototype._fireSlotChange=function(a){a.dispatchEvent(new NormalizedEvent$$module$$src$distributor("slotchange"));a.__shady.assignedSlot&&this._fireSlotChange(a.__shady.assignedSlot);};$jscompDefaultExport$$module$$src$distributor.prototype.isFinalDestination=function(a){return!a.__shady.assignedSlot};module$$src$distributor.default=$jscompDefaultExport$$module$$src$distributor;var module$$src$attach_shadow={},ShadyRootConstructionToken$$module$$src$attach_shadow={},ShadyRoot$$module$$src$attach_shadow=function(a,b){if(a!==ShadyRootConstructionToken$$module$$src$attach_shadow)throw new TypeError("Illegal constructor");a=document.createDocumentFragment();a.__proto__=ShadyRoot$$module$$src$attach_shadow.prototype;a._init(b);return a};ShadyRoot$$module$$src$attach_shadow.prototype=Object.create(DocumentFragment.prototype);
module$$src$utils.extendAll(ShadyRoot$$module$$src$attach_shadow.prototype,{_init:function(a){this.__localName="ShadyRoot";module$$src$logical_tree.recordChildNodes(a);module$$src$logical_tree.recordChildNodes(this);a.shadowRoot=this;this.host=a;this._changePending=this._hasRendered=this._renderPending=!1;this._distributor=new module$$src$distributor.default(this);this.update();},update:function(){var a=this;this._renderPending||(this._renderPending=!0,module$$src$flush.enqueue(function(){return a.render()}));},
_getRenderRoot:function(){for(var a=this,b=this;b;)b._renderPending&&(a=b),b=b._rendererForHost();return a},_rendererForHost:function(){var a=this.host.getRootNode();if(module$$src$utils.isShadyRoot(a))for(var b=this.host.childNodes,c=0,d;c<b.length;c++)if(d=b[c],this._distributor.isInsertionPoint(d))return a},render:function(){this._renderPending&&this._getRenderRoot()._render();},_render:function(){this._changePending=this._renderPending=!1;this._skipUpdateInsertionPoints?this._hasRendered||(this._insertionPoints=
[]):this.updateInsertionPoints();this._skipUpdateInsertionPoints=!1;this.distribute();this.compose();this._hasRendered=!0;},forceRender:function(){this._renderPending=!0;this.render();},distribute:function(){for(var a=this._distributor.distribute(),b=0;b<a.length;b++)a[b]._render();},updateInsertionPoints:function(){var a=this.__insertionPoints;if(a)for(var b=0,c;b<a.length;b++)c=a[b],c.getRootNode()!==this&&this._distributor.clearAssignedSlots(c);a=this._insertionPoints=this._distributor.getInsertionPoints();
for(b=0;b<a.length;b++)c=a[b],c.__shady=c.__shady||{},module$$src$logical_tree.recordChildNodes(c),module$$src$logical_tree.recordChildNodes(c.parentNode);},get _insertionPoints(){this.__insertionPoints||this.updateInsertionPoints();return this.__insertionPoints||(this.__insertionPoints=[])},set _insertionPoints(a){this.__insertionPoints=a;},hasInsertionPoint:function(){return this._distributor.hasInsertionPoint()},compose:function(){this._composeTree();},_composeTree:function(){this._updateChildNodes(this.host,
this._composeNode(this.host));for(var a=this._insertionPoints||[],b=0,c=a.length,d,e;b<c&&(d=a[b]);b++)e=d.parentNode,e!==this.host&&e!==this&&this._updateChildNodes(e,this._composeNode(e));},_composeNode:function(a){var b=[];a=(a.shadyRoot||a).childNodes;for(var c=0;c<a.length;c++){var d=a[c];if(this._distributor.isInsertionPoint(d))for(var e=d.__shady.distributedNodes||(d.__shady.distributedNodes=[]),f=0;f<e.length;f++){var g=e[f];this.isFinalDestination(d,g)&&b.push(g);}else b.push(d);}return b},
isFinalDestination:function(a,b){return this._distributor.isFinalDestination(a,b)},_updateChildNodes:function(a,b){for(var c=module$$src$native_tree.childNodes(a),d=module$$src$array_splice.calculateSplices(b,c),e=0,f=0,g;e<d.length&&(g=d[e]);e++){for(var h=0,k;h<g.removed.length&&(k=g.removed[h]);h++)module$$src$native_tree.parentNode(k)===a&&module$$src$native_methods.removeChild.call(a,k),c.splice(g.index+f,1);f-=g.addedCount;}for(e=0;e<d.length&&(g=d[e]);e++)for(f=c[g.index],h=g.index;h<g.index+
g.addedCount;h++)k=b[h],module$$src$native_methods.insertBefore.call(a,k,f),c.splice(h,0,k);},getInsertionPointTag:function(){return this._distributor.insertionPointTag}});function attachShadow$$module$$src$attach_shadow(a,b){if(!a)throw"Must provide a host.";if(!b)throw"Not enough arguments.";return new ShadyRoot$$module$$src$attach_shadow(ShadyRootConstructionToken$$module$$src$attach_shadow,a)}module$$src$patch_accessors.patchShadowRootAccessors(ShadyRoot$$module$$src$attach_shadow.prototype);
module$$src$attach_shadow.ShadyRoot=ShadyRoot$$module$$src$attach_shadow;module$$src$attach_shadow.attachShadow=attachShadow$$module$$src$attach_shadow;var module$$src$observe_changes={},AsyncObserver$$module$$src$observe_changes=function(){this._scheduled=!1;this.addedNodes=[];this.removedNodes=[];this.callbacks=new Set;};AsyncObserver$$module$$src$observe_changes.prototype.schedule=function(){var a=this;this._scheduled||(this._scheduled=!0,module$$src$utils.microtask(function(){a.flush();}));};AsyncObserver$$module$$src$observe_changes.prototype.flush=function(){if(this._scheduled){this._scheduled=!1;var a=this.takeRecords();a.length&&this.callbacks.forEach(function(b){b(a);});}};
AsyncObserver$$module$$src$observe_changes.prototype.takeRecords=function(){if(this.addedNodes.length||this.removedNodes.length){var a=[{addedNodes:this.addedNodes,removedNodes:this.removedNodes}];this.addedNodes=[];this.removedNodes=[];return a}return[]};
var observeChildren$$module$$src$observe_changes=function(a,b){a.__shady=a.__shady||{};a.__shady.observer||(a.__shady.observer=new AsyncObserver$$module$$src$observe_changes);a.__shady.observer.callbacks.add(b);var c=a.__shady.observer;return{_callback:b,_observer:c,_node:a,takeRecords:function(){return c.takeRecords()}}},unobserveChildren$$module$$src$observe_changes=function(a){var b=a&&a._observer;b&&(b.callbacks.delete(a._callback),b.callbacks.size||(a._node.__shady.observer=null));};
function filterMutations$$module$$src$observe_changes(a,b){var c=b.getRootNode();return a.map(function(a){var b=c===a.target.getRootNode();if(b&&a.addedNodes){if(b=Array.from(a.addedNodes).filter(function(a){return c===a.getRootNode()}),b.length)return a=Object.create(a),Object.defineProperty(a,"addedNodes",{value:b,configurable:!0}),a}else if(b)return a}).filter(function(a){return a})}module$$src$observe_changes.observeChildren=observeChildren$$module$$src$observe_changes;
module$$src$observe_changes.unobserveChildren=unobserveChildren$$module$$src$observe_changes;module$$src$observe_changes.filterMutations=filterMutations$$module$$src$observe_changes;var module$$src$logical_mutation={};
function addNode$$module$$src$logical_mutation(a,b,c){var d=module$$src$utils.ownerShadyRootForNode(a),e;d&&(b.__noInsertionPoint&&!d._changePending&&(d._skipUpdateInsertionPoints=!0),e=_maybeAddInsertionPoint$$module$$src$logical_mutation(b,a,d))&&(d._skipUpdateInsertionPoints=!1);module$$src$logical_properties.hasProperty(a,"firstChild")&&module$$src$logical_tree.recordInsertBefore(b,a,c);return _maybeDistribute$$module$$src$logical_mutation(b,a,d,e)||a.shadyRoot}
function removeNode$$module$$src$logical_mutation(a){var b=module$$src$logical_properties.hasProperty(a,"parentNode")&&module$$src$logical_properties.getProperty(a,"parentNode"),c,d=module$$src$utils.ownerShadyRootForNode(a);if(b||d){c=maybeDistributeParent$$module$$src$logical_mutation(a);b&&module$$src$logical_tree.recordRemoveChild(a,b);var e=d&&_removeDistributedChildren$$module$$src$logical_mutation(d,a),b=b&&d&&b.localName===d.getInsertionPointTag();if(e||b)d._skipUpdateInsertionPoints=!1,updateRootViaContentChange$$module$$src$logical_mutation(d);}_removeOwnerShadyRoot$$module$$src$logical_mutation(a);
return c}function _scheduleObserver$$module$$src$logical_mutation(a,b,c){if(a=a.__shady&&a.__shady.observer)b&&a.addedNodes.push(b),c&&a.removedNodes.push(c),a.schedule();}function removeNodeFromParent$$module$$src$logical_mutation(a,b){if(b)return _scheduleObserver$$module$$src$logical_mutation(b,null,a),removeNode$$module$$src$logical_mutation(a);a.parentNode&&module$$src$native_methods.removeChild.call(a.parentNode,a);_removeOwnerShadyRoot$$module$$src$logical_mutation(a);}
function _hasCachedOwnerRoot$$module$$src$logical_mutation(a){return void 0!==a.__ownerShadyRoot}function getRootNode$$module$$src$logical_mutation(a){if(a&&a.nodeType){var b=a.__ownerShadyRoot;void 0===b&&(b=module$$src$utils.isShadyRoot(a)?a:(b=a.parentNode)?getRootNode$$module$$src$logical_mutation(b):a,document.documentElement.contains(a)&&(a.__ownerShadyRoot=b));return b}}
function _maybeDistribute$$module$$src$logical_mutation(a,b,c,d){var e=c&&c.getInsertionPointTag()||"",f=a.nodeType===Node.DOCUMENT_FRAGMENT_NODE&&!a.__noInsertionPoint&&e&&a.querySelector(e),g=f&&f.parentNode.nodeType!==Node.DOCUMENT_FRAGMENT_NODE;((a=f||a.localName===e)||b.localName===e||d)&&c&&updateRootViaContentChange$$module$$src$logical_mutation(c);(c=_nodeNeedsDistribution$$module$$src$logical_mutation(b))&&updateRootViaContentChange$$module$$src$logical_mutation(b.shadyRoot);return c||a&&
!g}function _maybeAddInsertionPoint$$module$$src$logical_mutation(a,b,c){var d,e=c.getInsertionPointTag();if(a.nodeType!==Node.DOCUMENT_FRAGMENT_NODE||a.__noInsertionPoint)a.localName===e&&(module$$src$logical_tree.recordChildNodes(b),module$$src$logical_tree.recordChildNodes(a),d=!0);else for(var e=a.querySelectorAll(e),f=0,g,h;f<e.length&&(g=e[f]);f++)h=g.parentNode,h===a&&(h=b),h=_maybeAddInsertionPoint$$module$$src$logical_mutation(g,h,c),d=d||h;return d}
function _nodeNeedsDistribution$$module$$src$logical_mutation(a){return a&&a.shadyRoot&&a.shadyRoot.hasInsertionPoint()}function _removeDistributedChildren$$module$$src$logical_mutation(a,b){var c;a=a._insertionPoints;for(var d=0;d<a.length;d++){var e=a[d];if(_contains$$module$$src$logical_mutation(b,e))for(var e=e.assignedNodes({flatten:!0}),f=0;f<e.length;f++){c=!0;var g=e[f],h=module$$src$native_tree.parentNode(g);h&&module$$src$native_methods.removeChild.call(h,g);}}return c}
function _contains$$module$$src$logical_mutation(a,b){for(;b;){if(b==a)return!0;b=b.parentNode;}}function _removeOwnerShadyRoot$$module$$src$logical_mutation(a){if(_hasCachedOwnerRoot$$module$$src$logical_mutation(a))for(var b=a.childNodes,c=0,d=b.length,e;c<d&&(e=b[c]);c++)_removeOwnerShadyRoot$$module$$src$logical_mutation(e);a.__ownerShadyRoot=void 0;}
function firstComposedNode$$module$$src$logical_mutation(a){for(var b=a.assignedNodes({flatten:!0}),c=getRootNode$$module$$src$logical_mutation(a),d=0,e=b.length,f;d<e&&(f=b[d]);d++)if(c.isFinalDestination(a,f))return f}function maybeDistributeParent$$module$$src$logical_mutation(a){a=a.parentNode;if(_nodeNeedsDistribution$$module$$src$logical_mutation(a))return updateRootViaContentChange$$module$$src$logical_mutation(a.shadyRoot),!0}
function updateRootViaContentChange$$module$$src$logical_mutation(a){a._changePending=!0;a.update();}function distributeAttributeChange$$module$$src$logical_mutation(a,b){"slot"===b?maybeDistributeParent$$module$$src$logical_mutation(a):"slot"===a.localName&&"name"===b&&(a=module$$src$utils.ownerShadyRootForNode(a))&&a.update();}function query$$module$$src$logical_mutation(a,b,c){var d=[];_queryElements$$module$$src$logical_mutation(a.childNodes,b,c,d);return d}
function _queryElements$$module$$src$logical_mutation(a,b,c,d){for(var e=0,f=a.length,g;e<f&&(g=a[e]);e++)if(g.nodeType===Node.ELEMENT_NODE&&_queryElement$$module$$src$logical_mutation(g,b,c,d))return!0}function _queryElement$$module$$src$logical_mutation(a,b,c,d){var e=b(a);e&&d.push(a);if(c&&c(e))return e;_queryElements$$module$$src$logical_mutation(a.childNodes,b,c,d);}function renderRootNode$$module$$src$logical_mutation(a){a=a.getRootNode();module$$src$utils.isShadyRoot(a)&&a.render();}
function setAttribute$$module$$src$logical_mutation(a,b,c){window.ShadyCSS&&"class"===b&&a.ownerDocument===document?window.ShadyCSS.setElementClass(a,c):(module$$src$native_methods.setAttribute.call(a,b,c),distributeAttributeChange$$module$$src$logical_mutation(a,b));}function removeAttribute$$module$$src$logical_mutation(a,b){module$$src$native_methods.removeAttribute.call(a,b);distributeAttributeChange$$module$$src$logical_mutation(a,b);}
function insertBefore$$module$$src$logical_mutation(a,b,c){if(c){var d=module$$src$logical_properties.getProperty(c,"parentNode");if(void 0!==d&&d!==a)throw Error("The ref_node to be inserted before is not a child of this node");}b.nodeType!==Node.DOCUMENT_FRAGMENT_NODE&&(d=module$$src$logical_properties.getProperty(b,"parentNode"),removeNodeFromParent$$module$$src$logical_mutation(b,d));addNode$$module$$src$logical_mutation(a,b,c)||(c&&(d=module$$src$utils.ownerShadyRootForNode(c))&&(c=c.localName===
d.getInsertionPointTag()?firstComposedNode$$module$$src$logical_mutation(c):c),d=module$$src$utils.isShadyRoot(a)?a.host:a,c?module$$src$native_methods.insertBefore.call(d,b,c):module$$src$native_methods.appendChild.call(d,b));_scheduleObserver$$module$$src$logical_mutation(a,b);return b}
function removeChild$$module$$src$logical_mutation(a,b){if(b.parentNode!==a)throw Error("The node to be removed is not a child of this node: "+b);if(!removeNode$$module$$src$logical_mutation(b)){var c=module$$src$utils.isShadyRoot(a)?a.host:a,d=module$$src$native_tree.parentNode(b);c===d&&module$$src$native_methods.removeChild.call(c,b);}_scheduleObserver$$module$$src$logical_mutation(a,null,b);return b}
function cloneNode$$module$$src$logical_mutation(a,b){if("template"==a.localName)return module$$src$native_methods.cloneNode.call(a,b);var c=module$$src$native_methods.cloneNode.call(a,!1);if(b){a=a.childNodes;b=0;for(var d;b<a.length;b++)d=a[b].cloneNode(!0),c.appendChild(d);}return c}
function importNode$$module$$src$logical_mutation(a,b){if(a.ownerDocument!==document)return module$$src$native_methods.importNode.call(document,a,b);var c=module$$src$native_methods.importNode.call(document,a,!1);if(b){a=a.childNodes;b=0;for(var d;b<a.length;b++)d=importNode$$module$$src$logical_mutation(a[b],!0),c.appendChild(d);}return c}module$$src$logical_mutation.getRootNode=getRootNode$$module$$src$logical_mutation;module$$src$logical_mutation.query=query$$module$$src$logical_mutation;
module$$src$logical_mutation.renderRootNode=renderRootNode$$module$$src$logical_mutation;module$$src$logical_mutation.setAttribute=setAttribute$$module$$src$logical_mutation;module$$src$logical_mutation.removeAttribute=removeAttribute$$module$$src$logical_mutation;module$$src$logical_mutation.insertBefore=insertBefore$$module$$src$logical_mutation;module$$src$logical_mutation.removeChild=removeChild$$module$$src$logical_mutation;module$$src$logical_mutation.cloneNode=cloneNode$$module$$src$logical_mutation;
module$$src$logical_mutation.importNode=importNode$$module$$src$logical_mutation;var module$$src$patch_events={},alwaysComposed$$module$$src$patch_events={blur:!0,focus:!0,focusin:!0,focusout:!0,click:!0,dblclick:!0,mousedown:!0,mouseenter:!0,mouseleave:!0,mousemove:!0,mouseout:!0,mouseover:!0,mouseup:!0,wheel:!0,beforeinput:!0,input:!0,keydown:!0,keyup:!0,compositionstart:!0,compositionupdate:!0,compositionend:!0,touchstart:!0,touchend:!0,touchmove:!0,touchcancel:!0,pointerover:!0,pointerenter:!0,pointerdown:!0,pointermove:!0,pointerup:!0,pointercancel:!0,pointerout:!0,pointerleave:!0,
gotpointercapture:!0,lostpointercapture:!0,dragstart:!0,drag:!0,dragenter:!0,dragleave:!0,dragover:!0,drop:!0,dragend:!0,DOMActivate:!0,DOMFocusIn:!0,DOMFocusOut:!0,keypress:!0};function pathComposer$$module$$src$patch_events(a,b){var c=[],d=a;for(a=a===window?window:a.getRootNode();d;)c.push(d),d=d.assignedSlot?d.assignedSlot:d.nodeType===Node.DOCUMENT_FRAGMENT_NODE&&d.host&&(b||d!==a)?d.host:d.parentNode;c[c.length-1]===document&&c.push(window);return c}
function retarget$$module$$src$patch_events(a,b){if(!module$$src$utils.isShadyRoot)return a;a=pathComposer$$module$$src$patch_events(a,!0);for(var c=0,d,e,f,g;c<b.length;c++)if(d=b[c],f=d===window?window:d.getRootNode(),f!==e&&(g=a.indexOf(f),e=f),!module$$src$utils.isShadyRoot(f)||-1<g)return d}
var eventMixin$$module$$src$patch_events={get composed(){this.isTrusted&&void 0===this.__composed&&(this.__composed=alwaysComposed$$module$$src$patch_events[this.type]);return this.__composed||!1},composedPath:function(){this.__composedPath||(this.__composedPath=pathComposer$$module$$src$patch_events(this.__target,this.composed));return this.__composedPath},get target(){return retarget$$module$$src$patch_events(this.currentTarget,this.composedPath())},get relatedTarget(){if(!this.__relatedTarget)return null;
this.__relatedTargetComposedPath||(this.__relatedTargetComposedPath=pathComposer$$module$$src$patch_events(this.__relatedTarget,!0));return retarget$$module$$src$patch_events(this.currentTarget,this.__relatedTargetComposedPath)},stopPropagation:function(){Event.prototype.stopPropagation.call(this);this.__propagationStopped=!0;},stopImmediatePropagation:function(){Event.prototype.stopImmediatePropagation.call(this);this.__propagationStopped=this.__immediatePropagationStopped=!0;}};
function mixinComposedFlag$$module$$src$patch_events(a){var b=function(b,d){b=new a(b,d);b.__composed=d&&!!d.composed;return b};module$$src$utils.mixin(b,a);b.prototype=a.prototype;return b}var nonBubblingEventsToRetarget$$module$$src$patch_events={focus:!0,blur:!0};function fireHandlers$$module$$src$patch_events(a,b,c){if(c=b.__handlers&&b.__handlers[a.type]&&b.__handlers[a.type][c])for(var d=0,e;(e=c[d])&&(e.call(b,a),!a.__immediatePropagationStopped);d++);}
function retargetNonBubblingEvent$$module$$src$patch_events(a){var b=a.composedPath(),c;Object.defineProperty(a,"currentTarget",{get:function(){return c},configurable:!0});for(var d=b.length-1;0<=d;d--)if(c=b[d],fireHandlers$$module$$src$patch_events(a,c,"capture"),a.__propagationStopped)return;Object.defineProperty(a,"eventPhase",{value:Event.AT_TARGET});for(var e,d=0;d<b.length;d++)if(c=b[d],0===d||c.shadowRoot&&c.shadowRoot===e)if(fireHandlers$$module$$src$patch_events(a,c,"bubble"),c!==window&&
(e=c.getRootNode()),a.__propagationStopped)break}
function addEventListener$$module$$src$patch_events(a,b,c){if(b){var d,e,f;"object"===typeof c?(d=!!c.capture,e=!!c.once,f=!!c.passive):(d=!!c,f=e=!1);if(b.__eventWrappers)for(var g=0;g<b.__eventWrappers.length;g++){if(b.__eventWrappers[g].node===this&&b.__eventWrappers[g].type===a&&b.__eventWrappers[g].capture===d&&b.__eventWrappers[g].once===e&&b.__eventWrappers[g].passive===f)return}else b.__eventWrappers=[];g=function(d){e&&this.removeEventListener(a,b,c);d.__target||patchEvent$$module$$src$patch_events(d);
if(d.composed||-1<d.composedPath().indexOf(this))if(d.eventPhase===Event.BUBBLING_PHASE&&d.target===d.relatedTarget)d.stopImmediatePropagation();else return b(d)};b.__eventWrappers.push({node:this,type:a,capture:d,once:e,passive:f,wrapperFn:g});nonBubblingEventsToRetarget$$module$$src$patch_events[a]?(this.__handlers=this.__handlers||{},this.__handlers[a]=this.__handlers[a]||{capture:[],bubble:[]},this.__handlers[a][d?"capture":"bubble"].push(g)):module$$src$native_methods.addEventListener.call(this,
a,g,c);}}
function removeEventListener$$module$$src$patch_events(a,b,c){if(b){var d,e,f;"object"===typeof c?(d=!!c.capture,e=!!c.once,f=!!c.passive):(d=!!c,f=e=!1);var g=void 0;if(b.__eventWrappers)for(var h=0;h<b.__eventWrappers.length;h++)if(b.__eventWrappers[h].node===this&&b.__eventWrappers[h].type===a&&b.__eventWrappers[h].capture===d&&b.__eventWrappers[h].once===e&&b.__eventWrappers[h].passive===f){g=b.__eventWrappers.splice(h,1)[0].wrapperFn;b.__eventWrappers.length||(b.__eventWrappers=void 0);break}module$$src$native_methods.removeEventListener.call(this,
a,g||b,c);g&&nonBubblingEventsToRetarget$$module$$src$patch_events[a]&&this.__handlers&&this.__handlers[a]&&(a=this.__handlers[a][d?"capture":"bubble"],g=a.indexOf(g),-1<g&&a.splice(g,1));}}
function activateFocusEventOverrides$$module$$src$patch_events(){for(var a in nonBubblingEventsToRetarget$$module$$src$patch_events)window.addEventListener(a,function(a){a.__target||(patchEvent$$module$$src$patch_events(a),retargetNonBubblingEvent$$module$$src$patch_events(a),a.stopImmediatePropagation());},!0);}
function patchEvent$$module$$src$patch_events(a){a.__target=a.target;a.__relatedTarget=a.relatedTarget;module$$src$utils.settings.hasDescriptors?module$$src$utils.patchPrototype(a,eventMixin$$module$$src$patch_events):module$$src$utils.extend(a,eventMixin$$module$$src$patch_events);}
var PatchedEvent$$module$$src$patch_events=mixinComposedFlag$$module$$src$patch_events(window.Event),PatchedCustomEvent$$module$$src$patch_events=mixinComposedFlag$$module$$src$patch_events(window.CustomEvent),PatchedMouseEvent$$module$$src$patch_events=mixinComposedFlag$$module$$src$patch_events(window.MouseEvent);
function patchEvents$$module$$src$patch_events(){window.Event=PatchedEvent$$module$$src$patch_events;window.CustomEvent=PatchedCustomEvent$$module$$src$patch_events;window.MouseEvent=PatchedMouseEvent$$module$$src$patch_events;activateFocusEventOverrides$$module$$src$patch_events();}module$$src$patch_events.addEventListener=addEventListener$$module$$src$patch_events;module$$src$patch_events.removeEventListener=removeEventListener$$module$$src$patch_events;module$$src$patch_events.patchEvents=patchEvents$$module$$src$patch_events;var module$$src$patch_builtins={};function getAssignedSlot$$module$$src$patch_builtins(a){module$$src$logical_mutation.renderRootNode(a);return module$$src$logical_properties.getProperty(a,"assignedSlot")||null}
var nodeMixin$$module$$src$patch_builtins={addEventListener:module$$src$patch_events.addEventListener,removeEventListener:module$$src$patch_events.removeEventListener,appendChild:function(a){return module$$src$logical_mutation.insertBefore(this,a)},insertBefore:function(a,b){return module$$src$logical_mutation.insertBefore(this,a,b)},removeChild:function(a){return module$$src$logical_mutation.removeChild(this,a)},replaceChild:function(a,b){this.insertBefore(a,b);this.removeChild(b);return a},cloneNode:function(a){return module$$src$logical_mutation.cloneNode(this,
a)},getRootNode:function(a){return module$$src$logical_mutation.getRootNode(this,a)},get isConnected(){var a=this.ownerDocument;if(a&&a.contains&&a.contains(this)||(a=a.documentElement)&&a.contains&&a.contains(this))return!0;for(a=this;a&&!(a instanceof Document);)a=a.parentNode||(a instanceof module$$src$attach_shadow.ShadyRoot?a.host:void 0);return!!(a&&a instanceof Document)}},textMixin$$module$$src$patch_builtins={get assignedSlot(){return getAssignedSlot$$module$$src$patch_builtins(this)}},fragmentMixin$$module$$src$patch_builtins=
{querySelector:function(a){return module$$src$logical_mutation.query(this,function(b){return module$$src$utils.matchesSelector(b,a)},function(a){return!!a})[0]||null},querySelectorAll:function(a){return module$$src$logical_mutation.query(this,function(b){return module$$src$utils.matchesSelector(b,a)})}},slotMixin$$module$$src$patch_builtins={assignedNodes:function(a){if("slot"===this.localName)return module$$src$logical_mutation.renderRootNode(this),this.__shady?(a&&a.flatten?this.__shady.distributedNodes:
this.__shady.assignedNodes)||[]:[]}},elementMixin$$module$$src$patch_builtins=module$$src$utils.extendAll({setAttribute:function(a,b){module$$src$logical_mutation.setAttribute(this,a,b);},removeAttribute:function(a){module$$src$logical_mutation.removeAttribute(this,a);},attachShadow:function(a){return module$$src$attach_shadow.attachShadow(this,a)},get slot(){return this.getAttribute("slot")},set slot(a){this.setAttribute("slot",a);},get assignedSlot(){return getAssignedSlot$$module$$src$patch_builtins(this)}},
fragmentMixin$$module$$src$patch_builtins,slotMixin$$module$$src$patch_builtins);Object.defineProperties(elementMixin$$module$$src$patch_builtins,module$$src$patch_accessors.ShadowRootAccessor);var documentMixin$$module$$src$patch_builtins=module$$src$utils.extendAll({importNode:function(a,b){return module$$src$logical_mutation.importNode(a,b)}},fragmentMixin$$module$$src$patch_builtins);Object.defineProperties(documentMixin$$module$$src$patch_builtins,{_activeElement:module$$src$patch_accessors.ActiveElementAccessor.activeElement});
function patchBuiltin$$module$$src$patch_builtins(a,b){for(var c=Object.getOwnPropertyNames(b),d=0;d<c.length;d++){var e=c[d],f=Object.getOwnPropertyDescriptor(b,e);f.value?a[e]=f.value:Object.defineProperty(a,e,f);}}
function patchBuiltins$$module$$src$patch_builtins(){patchBuiltin$$module$$src$patch_builtins(window.Node.prototype,nodeMixin$$module$$src$patch_builtins);patchBuiltin$$module$$src$patch_builtins(window.Text.prototype,textMixin$$module$$src$patch_builtins);patchBuiltin$$module$$src$patch_builtins(window.DocumentFragment.prototype,fragmentMixin$$module$$src$patch_builtins);patchBuiltin$$module$$src$patch_builtins(window.Element.prototype,elementMixin$$module$$src$patch_builtins);patchBuiltin$$module$$src$patch_builtins(window.Document.prototype,
documentMixin$$module$$src$patch_builtins);window.HTMLSlotElement&&patchBuiltin$$module$$src$patch_builtins(window.HTMLSlotElement.prototype,slotMixin$$module$$src$patch_builtins);module$$src$utils.settings.hasDescriptors&&(module$$src$patch_accessors.patchAccessors(window.Node.prototype),module$$src$patch_accessors.patchAccessors(window.Text.prototype),module$$src$patch_accessors.patchAccessors(window.DocumentFragment.prototype),module$$src$patch_accessors.patchAccessors(window.Element.prototype),
module$$src$patch_accessors.patchAccessors((window.customElements&&customElements.nativeHTMLElement||HTMLElement).prototype),module$$src$patch_accessors.patchAccessors(window.Document.prototype),window.HTMLSlotElement&&module$$src$patch_accessors.patchAccessors(window.HTMLSlotElement.prototype));}module$$src$patch_builtins.patchBuiltins=patchBuiltins$$module$$src$patch_builtins;module$$src$utils.settings.inUse&&(window.ShadyDOM={inUse:module$$src$utils.settings.inUse,patch:function(a){return a},isShadyRoot:module$$src$utils.isShadyRoot,enqueue:module$$src$flush.enqueue,flush:module$$src$flush.flush,settings:module$$src$utils.settings,filterMutations:module$$src$observe_changes.filterMutations,observeChildren:module$$src$observe_changes.observeChildren,unobserveChildren:module$$src$observe_changes.unobserveChildren,nativeMethods:module$$src$native_methods,nativeTree:module$$src$native_tree},
module$$src$patch_events.patchEvents(),module$$src$patch_builtins.patchBuiltins(),window.ShadowRoot=module$$src$attach_shadow.ShadyRoot);
}).call(window);

(function(){
'use strict';var g=new function(){};var aa=new Set("annotation-xml color-profile font-face font-face-src font-face-uri font-face-format font-face-name missing-glyph".split(" "));function k(b){var a=aa.has(b);b=/^[a-z][.0-9_a-z]*-[\-.0-9_a-z]*$/.test(b);return!a&&b}function l(b){var a=b.isConnected;if(void 0!==a)return a;for(;b&&!(b.__CE_isImportDocument||b instanceof Document);)b=b.parentNode||(window.ShadowRoot&&b instanceof ShadowRoot?b.host:void 0);return!(!b||!(b.__CE_isImportDocument||b instanceof Document))}
function m(b,a){for(;a&&a!==b&&!a.nextSibling;)a=a.parentNode;return a&&a!==b?a.nextSibling:null}
function n(b,a,e){e=e?e:new Set;for(var c=b;c;){if(c.nodeType===Node.ELEMENT_NODE){var d=c;a(d);var h=d.localName;if("link"===h&&"import"===d.getAttribute("rel")){c=d.import;if(c instanceof Node&&!e.has(c))for(e.add(c),c=c.firstChild;c;c=c.nextSibling)n(c,a,e);c=m(b,d);continue}else if("template"===h){c=m(b,d);continue}if(d=d.__CE_shadowRoot)for(d=d.firstChild;d;d=d.nextSibling)n(d,a,e);}c=c.firstChild?c.firstChild:m(b,c);}}function q(b,a,e){b[a]=e;}function r(){this.a=new Map;this.f=new Map;this.c=[];this.b=!1;}function ba(b,a,e){b.a.set(a,e);b.f.set(e.constructor,e);}function t(b,a){b.b=!0;b.c.push(a);}function v(b,a){b.b&&n(a,function(a){return w(b,a)});}function w(b,a){if(b.b&&!a.__CE_patched){a.__CE_patched=!0;for(var e=0;e<b.c.length;e++)b.c[e](a);}}function x(b,a){var e=[];n(a,function(b){return e.push(b)});for(a=0;a<e.length;a++){var c=e[a];1===c.__CE_state?b.connectedCallback(c):y(b,c);}}
function z(b,a){var e=[];n(a,function(b){return e.push(b)});for(a=0;a<e.length;a++){var c=e[a];1===c.__CE_state&&b.disconnectedCallback(c);}}
function A(b,a,e){e=e?e:new Set;var c=[];n(a,function(d){if("link"===d.localName&&"import"===d.getAttribute("rel")){var a=d.import;a instanceof Node&&"complete"===a.readyState?(a.__CE_isImportDocument=!0,a.__CE_hasRegistry=!0):d.addEventListener("load",function(){var a=d.import;a.__CE_documentLoadHandled||(a.__CE_documentLoadHandled=!0,a.__CE_isImportDocument=!0,a.__CE_hasRegistry=!0,new Set(e),e.delete(a),A(b,a,e));});}else c.push(d);},e);if(b.b)for(a=0;a<c.length;a++)w(b,c[a]);for(a=0;a<c.length;a++)y(b,
c[a]);}
function y(b,a){if(void 0===a.__CE_state){var e=b.a.get(a.localName);if(e){e.constructionStack.push(a);var c=e.constructor;try{try{if(new c!==a)throw Error("The custom element constructor did not produce the element being upgraded.");}finally{e.constructionStack.pop();}}catch(f){throw a.__CE_state=2,f;}a.__CE_state=1;a.__CE_definition=e;if(e.attributeChangedCallback)for(e=e.observedAttributes,c=0;c<e.length;c++){var d=e[c],h=a.getAttribute(d);null!==h&&b.attributeChangedCallback(a,d,null,h,null);}l(a)&&b.connectedCallback(a);}}}
r.prototype.connectedCallback=function(b){var a=b.__CE_definition;a.connectedCallback&&a.connectedCallback.call(b);};r.prototype.disconnectedCallback=function(b){var a=b.__CE_definition;a.disconnectedCallback&&a.disconnectedCallback.call(b);};r.prototype.attributeChangedCallback=function(b,a,e,c,d){var h=b.__CE_definition;h.attributeChangedCallback&&-1<h.observedAttributes.indexOf(a)&&h.attributeChangedCallback.call(b,a,e,c,d);};function B(b,a){this.c=b;this.a=a;this.b=void 0;A(this.c,this.a);"loading"===this.a.readyState&&(this.b=new MutationObserver(this.f.bind(this)),this.b.observe(this.a,{childList:!0,subtree:!0}));}function C(b){b.b&&b.b.disconnect();}B.prototype.f=function(b){var a=this.a.readyState;"interactive"!==a&&"complete"!==a||C(this);for(a=0;a<b.length;a++)for(var e=b[a].addedNodes,c=0;c<e.length;c++)A(this.c,e[c]);};function ca(){var b=this;this.b=this.a=void 0;this.c=new Promise(function(a){b.b=a;b.a&&a(b.a);});}function D(b){if(b.a)throw Error("Already resolved.");b.a=void 0;b.b&&b.b(void 0);}function E(b){this.f=!1;this.a=b;this.h=new Map;this.g=function(b){return b()};this.b=!1;this.c=[];this.j=new B(b,document);}
E.prototype.l=function(b,a){var e=this;if(!(a instanceof Function))throw new TypeError("Custom element constructors must be functions.");if(!k(b))throw new SyntaxError("The element name '"+b+"' is not valid.");if(this.a.a.get(b))throw Error("A custom element with name '"+b+"' has already been defined.");if(this.f)throw Error("A custom element is already being defined.");this.f=!0;var c,d,h,f,u;try{var p=function(b){var a=P[b];if(void 0!==a&&!(a instanceof Function))throw Error("The '"+b+"' callback must be a function.");
return a},P=a.prototype;if(!(P instanceof Object))throw new TypeError("The custom element constructor's prototype is not an object.");c=p("connectedCallback");d=p("disconnectedCallback");h=p("adoptedCallback");f=p("attributeChangedCallback");u=a.observedAttributes||[];}catch(va){return}finally{this.f=!1;}ba(this.a,b,{localName:b,constructor:a,connectedCallback:c,disconnectedCallback:d,adoptedCallback:h,attributeChangedCallback:f,observedAttributes:u,constructionStack:[]});this.c.push(b);this.b||(this.b=
!0,this.g(function(){if(!1!==e.b)for(e.b=!1,A(e.a,document);0<e.c.length;){var b=e.c.shift();(b=e.h.get(b))&&D(b);}}));};E.prototype.get=function(b){if(b=this.a.a.get(b))return b.constructor};E.prototype.o=function(b){if(!k(b))return Promise.reject(new SyntaxError("'"+b+"' is not a valid custom element name."));var a=this.h.get(b);if(a)return a.c;a=new ca;this.h.set(b,a);this.a.a.get(b)&&-1===this.c.indexOf(b)&&D(a);return a.c};E.prototype.m=function(b){C(this.j);var a=this.g;this.g=function(e){return b(function(){return a(e)})};};
window.CustomElementRegistry=E;E.prototype.define=E.prototype.l;E.prototype.get=E.prototype.get;E.prototype.whenDefined=E.prototype.o;E.prototype.polyfillWrapFlushCallback=E.prototype.m;var F=window.Document.prototype.createElement,da=window.Document.prototype.createElementNS,ea=window.Document.prototype.importNode,fa=window.Document.prototype.prepend,ga=window.Document.prototype.append,G=window.Node.prototype.cloneNode,H=window.Node.prototype.appendChild,I=window.Node.prototype.insertBefore,J=window.Node.prototype.removeChild,K=window.Node.prototype.replaceChild,L=Object.getOwnPropertyDescriptor(window.Node.prototype,"textContent"),M=window.Element.prototype.attachShadow,N=Object.getOwnPropertyDescriptor(window.Element.prototype,
"innerHTML"),O=window.Element.prototype.getAttribute,Q=window.Element.prototype.setAttribute,R=window.Element.prototype.removeAttribute,S=window.Element.prototype.getAttributeNS,T=window.Element.prototype.setAttributeNS,U=window.Element.prototype.removeAttributeNS,V=window.Element.prototype.insertAdjacentElement,ha=window.Element.prototype.prepend,ia=window.Element.prototype.append,ja=window.Element.prototype.before,ka=window.Element.prototype.after,la=window.Element.prototype.replaceWith,ma=window.Element.prototype.remove,
na=window.HTMLElement,W=Object.getOwnPropertyDescriptor(window.HTMLElement.prototype,"innerHTML"),X=window.HTMLElement.prototype.insertAdjacentElement;function oa(){var b=Y;window.HTMLElement=function(){function a(){var a=this.constructor,c=b.f.get(a);if(!c)throw Error("The custom element being constructed was not registered with `customElements`.");var d=c.constructionStack;if(!d.length)return d=F.call(document,c.localName),Object.setPrototypeOf(d,a.prototype),d.__CE_state=1,d.__CE_definition=c,w(b,d),d;var c=d.length-1,h=d[c];if(h===g)throw Error("The HTMLElement constructor was either called reentrantly for this constructor or called multiple times.");
d[c]=g;Object.setPrototypeOf(h,a.prototype);w(b,h);return h}a.prototype=na.prototype;return a}();}function pa(b,a,e){a.prepend=function(a){for(var d=[],c=0;c<arguments.length;++c)d[c-0]=arguments[c];c=d.filter(function(b){return b instanceof Node&&l(b)});e.i.apply(this,d);for(var f=0;f<c.length;f++)z(b,c[f]);if(l(this))for(c=0;c<d.length;c++)f=d[c],f instanceof Element&&x(b,f);};a.append=function(a){for(var d=[],c=0;c<arguments.length;++c)d[c-0]=arguments[c];c=d.filter(function(b){return b instanceof Node&&l(b)});e.append.apply(this,d);for(var f=0;f<c.length;f++)z(b,c[f]);if(l(this))for(c=0;c<
d.length;c++)f=d[c],f instanceof Element&&x(b,f);};}function qa(){var b=Y;q(Document.prototype,"createElement",function(a){if(this.__CE_hasRegistry){var e=b.a.get(a);if(e)return new e.constructor}a=F.call(this,a);w(b,a);return a});q(Document.prototype,"importNode",function(a,e){a=ea.call(this,a,e);this.__CE_hasRegistry?A(b,a):v(b,a);return a});q(Document.prototype,"createElementNS",function(a,e){if(this.__CE_hasRegistry&&(null===a||"http://www.w3.org/1999/xhtml"===a)){var c=b.a.get(e);if(c)return new c.constructor}a=da.call(this,a,e);w(b,a);return a});
pa(b,Document.prototype,{i:fa,append:ga});}function ra(){var b=Y;function a(a,c){Object.defineProperty(a,"textContent",{enumerable:c.enumerable,configurable:!0,get:c.get,set:function(a){if(this.nodeType===Node.TEXT_NODE)c.set.call(this,a);else{var d=void 0;if(this.firstChild){var e=this.childNodes,u=e.length;if(0<u&&l(this))for(var d=Array(u),p=0;p<u;p++)d[p]=e[p];}c.set.call(this,a);if(d)for(a=0;a<d.length;a++)z(b,d[a]);}}});}q(Node.prototype,"insertBefore",function(a,c){if(a instanceof DocumentFragment){var d=Array.prototype.slice.apply(a.childNodes);
a=I.call(this,a,c);if(l(this))for(c=0;c<d.length;c++)x(b,d[c]);return a}d=l(a);c=I.call(this,a,c);d&&z(b,a);l(this)&&x(b,a);return c});q(Node.prototype,"appendChild",function(a){if(a instanceof DocumentFragment){var c=Array.prototype.slice.apply(a.childNodes);a=H.call(this,a);if(l(this))for(var d=0;d<c.length;d++)x(b,c[d]);return a}c=l(a);d=H.call(this,a);c&&z(b,a);l(this)&&x(b,a);return d});q(Node.prototype,"cloneNode",function(a){a=G.call(this,a);this.ownerDocument.__CE_hasRegistry?A(b,a):v(b,a);
return a});q(Node.prototype,"removeChild",function(a){var c=l(a),d=J.call(this,a);c&&z(b,a);return d});q(Node.prototype,"replaceChild",function(a,c){if(a instanceof DocumentFragment){var d=Array.prototype.slice.apply(a.childNodes);a=K.call(this,a,c);if(l(this))for(z(b,c),c=0;c<d.length;c++)x(b,d[c]);return a}var d=l(a),e=K.call(this,a,c),f=l(this);f&&z(b,c);d&&z(b,a);f&&x(b,a);return e});L&&L.get?a(Node.prototype,L):t(b,function(b){a(b,{enumerable:!0,configurable:!0,get:function(){for(var a=[],b=
0;b<this.childNodes.length;b++)a.push(this.childNodes[b].textContent);return a.join("")},set:function(a){for(;this.firstChild;)J.call(this,this.firstChild);H.call(this,document.createTextNode(a));}});});}function sa(b){var a=Element.prototype;a.before=function(a){for(var c=[],d=0;d<arguments.length;++d)c[d-0]=arguments[d];d=c.filter(function(a){return a instanceof Node&&l(a)});ja.apply(this,c);for(var e=0;e<d.length;e++)z(b,d[e]);if(l(this))for(d=0;d<c.length;d++)e=c[d],e instanceof Element&&x(b,e);};a.after=function(a){for(var c=[],d=0;d<arguments.length;++d)c[d-0]=arguments[d];d=c.filter(function(a){return a instanceof Node&&l(a)});ka.apply(this,c);for(var e=0;e<d.length;e++)z(b,d[e]);if(l(this))for(d=
0;d<c.length;d++)e=c[d],e instanceof Element&&x(b,e);};a.replaceWith=function(a){for(var c=[],d=0;d<arguments.length;++d)c[d-0]=arguments[d];var d=c.filter(function(a){return a instanceof Node&&l(a)}),e=l(this);la.apply(this,c);for(var f=0;f<d.length;f++)z(b,d[f]);if(e)for(z(b,this),d=0;d<c.length;d++)e=c[d],e instanceof Element&&x(b,e);};a.remove=function(){var a=l(this);ma.call(this);a&&z(b,this);};}function ta(){var b=Y;function a(a,c){Object.defineProperty(a,"innerHTML",{enumerable:c.enumerable,configurable:!0,get:c.get,set:function(a){var d=this,e=void 0;l(this)&&(e=[],n(this,function(a){a!==d&&e.push(a);}));c.set.call(this,a);if(e)for(var f=0;f<e.length;f++){var h=e[f];1===h.__CE_state&&b.disconnectedCallback(h);}this.ownerDocument.__CE_hasRegistry?A(b,this):v(b,this);return a}});}function e(a,c){q(a,"insertAdjacentElement",function(a,d){var e=l(d);a=c.call(this,a,d);e&&z(b,d);l(a)&&x(b,d);
return a});}M?q(Element.prototype,"attachShadow",function(a){return this.__CE_shadowRoot=a=M.call(this,a)}):console.warn("Custom Elements: `Element#attachShadow` was not patched.");if(N&&N.get)a(Element.prototype,N);else if(W&&W.get)a(HTMLElement.prototype,W);else{var c=F.call(document,"div");t(b,function(b){a(b,{enumerable:!0,configurable:!0,get:function(){return G.call(this,!0).innerHTML},set:function(a){var b="template"===this.localName?this.content:this;for(c.innerHTML=a;0<b.childNodes.length;)J.call(b,
b.childNodes[0]);for(;0<c.childNodes.length;)H.call(b,c.childNodes[0]);}});});}q(Element.prototype,"setAttribute",function(a,c){if(1!==this.__CE_state)return Q.call(this,a,c);var d=O.call(this,a);Q.call(this,a,c);c=O.call(this,a);d!==c&&b.attributeChangedCallback(this,a,d,c,null);});q(Element.prototype,"setAttributeNS",function(a,c,e){if(1!==this.__CE_state)return T.call(this,a,c,e);var d=S.call(this,a,c);T.call(this,a,c,e);e=S.call(this,a,c);d!==e&&b.attributeChangedCallback(this,c,d,e,a);});q(Element.prototype,
"removeAttribute",function(a){if(1!==this.__CE_state)return R.call(this,a);var c=O.call(this,a);R.call(this,a);null!==c&&b.attributeChangedCallback(this,a,c,null,null);});q(Element.prototype,"removeAttributeNS",function(a,c){if(1!==this.__CE_state)return U.call(this,a,c);var d=S.call(this,a,c);U.call(this,a,c);var e=S.call(this,a,c);d!==e&&b.attributeChangedCallback(this,c,d,e,a);});X?e(HTMLElement.prototype,X):V?e(Element.prototype,V):console.warn("Custom Elements: `Element#insertAdjacentElement` was not patched.");
pa(b,Element.prototype,{i:ha,append:ia});sa(b);}/*

 Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 Code distributed by Google as part of the polymer project is also
 subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
var Z=window.customElements;if(!Z||Z.forcePolyfill||"function"!=typeof Z.define||"function"!=typeof Z.get){var Y=new r;oa();qa();ra();ta();document.__CE_hasRegistry=!0;var ua=new E(Y);Object.defineProperty(window,"customElements",{configurable:!0,enumerable:!0,value:ua});}
}).call(self);

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

/*
Extremely simple css parser. Intended to be not more than what we need
and definitely not necessarily correct =).
*/

// given a string of css, return a simple rule tree
function parse(text) {
  text = clean(text);
  return parseCss(lex(text), text);
}

// remove stuff we don't care about that may hinder parsing
function clean(cssText) {
  return cssText.replace(RX.comments, '').replace(RX.port, '');
}

// super simple {...} lexer that returns a node tree
function lex(text) {
  let root = {
    start: 0,
    end: text.length
  };
  let n = root;
  for (let i = 0, l = text.length; i < l; i++) {
    if (text[i] === OPEN_BRACE) {
      if (!n.rules) {
        n.rules = [];
      }
      let p = n;
      let previous = p.rules[p.rules.length - 1];
      n = {
        start: i + 1,
        parent: p,
        previous: previous
      };
      p.rules.push(n);
    } else if (text[i] === CLOSE_BRACE) {
      n.end = i + 1;
      n = n.parent || root;
    }
  }
  return root;
}

// add selectors/cssText to node tree
function parseCss(node, text) {
  let t = text.substring(node.start, node.end - 1);
  node.parsedCssText = node.cssText = t.trim();
  if (node.parent) {
    let ss = node.previous ? node.previous.end : node.parent.start;
    t = text.substring(ss, node.start - 1);
    t = _expandUnicodeEscapes(t);
    t = t.replace(RX.multipleSpaces, ' ');
    // TODO(sorvell): ad hoc; make selector include only after last ;
    // helps with mixin syntax
    t = t.substring(t.lastIndexOf(';') + 1);
    let s = node.parsedSelector = node.selector = t.trim();
    node.atRule = (s.indexOf(AT_START) === 0);
    // note, support a subset of rule types...
    if (node.atRule) {
      if (s.indexOf(MEDIA_START) === 0) {
        node.type = types.MEDIA_RULE;
      } else if (s.match(RX.keyframesRule)) {
        node.type = types.KEYFRAMES_RULE;
        node.keyframesName =
          node.selector.split(RX.multipleSpaces).pop();
      }
    } else {
      if (s.indexOf(VAR_START) === 0) {
        node.type = types.MIXIN_RULE;
      } else {
        node.type = types.STYLE_RULE;
      }
    }
  }
  let r$ = node.rules;
  if (r$) {
    for (let i = 0, l = r$.length, r;
      (i < l) && (r = r$[i]); i++) {
      parseCss(r, text);
    }
  }
  return node;
}

// conversion of sort unicode escapes with spaces like `\33 ` (and longer) into
// expanded form that doesn't require trailing space `\000033`
function _expandUnicodeEscapes(s) {
  return s.replace(/\\([0-9a-f]{1,6})\s/gi, function() {
    let code = arguments[1],
      repeat = 6 - code.length;
    while (repeat--) {
      code = '0' + code;
    }
    return '\\' + code;
  });
}

// stringify parsed css.
function stringify(node, preserveProperties, text) {
  text = text || '';
  // calc rule cssText
  let cssText = '';
  if (node.cssText || node.rules) {
    let r$ = node.rules;
    if (r$ && !_hasMixinRules(r$)) {
      for (let i = 0, l = r$.length, r;
        (i < l) && (r = r$[i]); i++) {
        cssText = stringify(r, preserveProperties, cssText);
      }
    } else {
      cssText = preserveProperties ? node.cssText :
        removeCustomProps(node.cssText);
      cssText = cssText.trim();
      if (cssText) {
        cssText = '  ' + cssText + '\n';
      }
    }
  }
  // emit rule if there is cssText
  if (cssText) {
    if (node.selector) {
      text += node.selector + ' ' + OPEN_BRACE + '\n';
    }
    text += cssText;
    if (node.selector) {
      text += CLOSE_BRACE + '\n\n';
    }
  }
  return text;
}

function _hasMixinRules(rules) {
  return rules[0].selector.indexOf(VAR_START) === 0;
}

function removeCustomProps(cssText) {
  cssText = removeCustomPropAssignment(cssText);
  return removeCustomPropApply(cssText);
}

function removeCustomPropAssignment(cssText) {
  return cssText
    .replace(RX.customProp, '')
    .replace(RX.mixinProp, '');
}

function removeCustomPropApply(cssText) {
  return cssText
    .replace(RX.mixinApply, '')
    .replace(RX.varApply, '');
}

let types = {
  STYLE_RULE: 1,
  KEYFRAMES_RULE: 7,
  MEDIA_RULE: 4,
  MIXIN_RULE: 1000
};

let OPEN_BRACE = '{';
let CLOSE_BRACE = '}';

// helper regexp's
let RX = {
  comments: /\/\*[^*]*\*+([^/*][^*]*\*+)*\//gim,
  port: /@import[^;]*;/gim,
  customProp: /(?:^[^;\-\s}]+)?--[^;{}]*?:[^{};]*?(?:[;\n]|$)/gim,
  mixinProp: /(?:^[^;\-\s}]+)?--[^;{}]*?:[^{};]*?{[^}]*?}(?:[;\n]|$)?/gim,
  mixinApply: /@apply\s*\(?[^);]*\)?\s*(?:[;\n]|$)?/gim,
  varApply: /[^;:]*?:[^;]*?var\([^;]*\)(?:[;\n]|$)?/gim,
  keyframesRule: /^@[^\s]*keyframes/,
  multipleSpaces: /\s+/g
};

let VAR_START = '--';
let MEDIA_START = '@media';
let AT_START = '@';

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

let nativeShadow = !(window.ShadyDOM && window.ShadyDOM.inUse);
// chrome 49 has semi-working css vars, check if box-shadow works
// safari 9.1 has a recalc bug: https://bugs.webkit.org/show_bug.cgi?id=155782
let nativeCssVariables = (!navigator.userAgent.match('AppleWebKit/601') &&
window.CSS && CSS.supports && CSS.supports('box-shadow', '0 0 0 var(--foo)'));

// experimental support for native @apply
function detectNativeApply() {
  let style = document.createElement('style');
  style.textContent = '.foo { @apply --foo }';
  document.head.appendChild(style);
  let nativeCssApply = (style.sheet.cssRules[0].cssText.indexOf('apply') >= 0);
  document.head.removeChild(style);
  return nativeCssApply;
}

let nativeCssApply = false && detectNativeApply();

function parseSettings(settings) {
  if (settings) {
    nativeCssVariables = nativeCssVariables && !settings.shimcssproperties;
    nativeShadow = nativeShadow && !settings.shimshadow;
  }
}

if (window.ShadyCSS) {
  parseSettings(window.ShadyCSS);
} else if (window.WebComponents) {
  parseSettings(window.WebComponents.flags);
}

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

function toCssText (rules, callback) {
  if (typeof rules === 'string') {
    rules = parse(rules);
  }
  if (callback) {
    forEachRule(rules, callback);
  }
  return stringify(rules, nativeCssVariables);
}

function rulesForStyle(style) {
  if (!style.__cssRules && style.textContent) {
    style.__cssRules = parse(style.textContent);
  }
  return style.__cssRules;
}

// Tests if a rule is a keyframes selector, which looks almost exactly
// like a normal selector but is not (it has nothing to do with scoping
// for example).
function isKeyframesSelector(rule) {
  return rule.parent &&
  rule.parent.type === types.KEYFRAMES_RULE;
}

function forEachRule(node, styleRuleCallback, keyframesRuleCallback, onlyActiveRules) {
  if (!node) {
    return;
  }
  let skipRules = false;
  if (onlyActiveRules) {
    if (node.type === types.MEDIA_RULE) {
      let matchMedia = node.selector.match(rx.MEDIA_MATCH);
      if (matchMedia) {
        // if rule is a non matching @media rule, skip subrules
        if (!window.matchMedia(matchMedia[1]).matches) {
          skipRules = true;
        }
      }
    }
  }
  if (node.type === types.STYLE_RULE) {
    styleRuleCallback(node);
  } else if (keyframesRuleCallback &&
    node.type === types.KEYFRAMES_RULE) {
    keyframesRuleCallback(node);
  } else if (node.type === types.MIXIN_RULE) {
    skipRules = true;
  }
  let r$ = node.rules;
  if (r$ && !skipRules) {
    for (let i=0, l=r$.length, r; (i<l) && (r=r$[i]); i++) {
      forEachRule(r, styleRuleCallback, keyframesRuleCallback, onlyActiveRules);
    }
  }
}

// add a string of cssText to the document.
function applyCss(cssText, moniker, target, contextNode) {
  let style = createScopeStyle(cssText, moniker);
  return applyStyle(style, target, contextNode);
}

function applyStyle(style, target, contextNode) {
  target = target || document.head;
  let after = (contextNode && contextNode.nextSibling) ||
  target.firstChild;
  lastHeadApplyNode = style;
  return target.insertBefore(style, after);
}

function createScopeStyle(cssText, moniker) {
  let style = document.createElement('style');
  if (moniker) {
    style.setAttribute('scope', moniker);
  }
  style.textContent = cssText;
  return style;
}

let lastHeadApplyNode = null;

// insert a comment node as a styling position placeholder.
function applyStylePlaceHolder(moniker) {
  let placeHolder = document.createComment(' Shady DOM styles for ' +
    moniker + ' ');
  let after = lastHeadApplyNode ?
    lastHeadApplyNode.nextSibling : null;
  let scope = document.head;
  scope.insertBefore(placeHolder, after || scope.firstChild);
  lastHeadApplyNode = placeHolder;
  return placeHolder;
}



// cssBuildTypeForModule: function (module) {
//   let dm = Polymer.DomModule.import(module);
//   if (dm) {
//     return getCssBuildType(dm);
//   }
// },
//


// Walk from text[start] matching parens
// returns position of the outer end paren
function findMatchingParen(text, start) {
  let level = 0;
  for (let i=start, l=text.length; i < l; i++) {
    if (text[i] === '(') {
      level++;
    } else if (text[i] === ')') {
      if (--level === 0) {
        return i;
      }
    }
  }
  return -1;
}

function processVariableAndFallback(str, callback) {
  // find 'var('
  let start = str.indexOf('var(');
  if (start === -1) {
    // no var?, everything is prefix
    return callback(str, '', '', '');
  }
  //${prefix}var(${inner})${suffix}
  let end = findMatchingParen(str, start + 3);
  let inner = str.substring(start + 4, end);
  let prefix = str.substring(0, start);
  // suffix may have other variables
  let suffix = processVariableAndFallback(str.substring(end + 1), callback);
  let comma = inner.indexOf(',');
  // value and fallback args should be trimmed to match in property lookup
  if (comma === -1) {
    // variable, no fallback
    return callback(prefix, inner.trim(), '', suffix);
  }
  // var(${value},${fallback})
  let value = inner.substring(0, comma).trim();
  let fallback = inner.substring(comma + 1).trim();
  return callback(prefix, value, fallback, suffix);
}

function setElementClassRaw(element, value) {
  // use native setAttribute provided by ShadyDOM when setAttribute is patched
  if (window.ShadyDOM) {
    window.ShadyDOM.nativeMethods.setAttribute.call(element, 'class', value);
  } else {
    element.setAttribute('class', value);
  }
}

let rx = {
  VAR_ASSIGN: /(?:^|[;\s{]\s*)(--[\w-]*?)\s*:\s*(?:([^;{]*)|{([^}]*)})(?:(?=[;\s}])|$)/gi,
  MIXIN_MATCH: /(?:^|\W+)@apply\s*\(?([^);\n]*)\)?/gi,
  VAR_CONSUMED: /(--[\w-]+)\s*([:,;)]|$)/gi,
  ANIMATION_MATCH: /(animation\s*:)|(animation-name\s*:)/,
  MEDIA_MATCH: /@media[^(]*(\([^)]*\))/,
  IS_VAR: /^--/,
  BRACKETED: /\{[^}]*\}/g,
  HOST_PREFIX: '(?:^|[^.#[:])',
  HOST_SUFFIX: '($|[.:[\\s>+~])'
};

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

/* Transforms ShadowDOM styling into ShadyDOM styling

* scoping:

  * elements in scope get scoping selector class="x-foo-scope"
  * selectors re-written as follows:

    div button -> div.x-foo-scope button.x-foo-scope

* :host -> scopeName

* :host(...) -> scopeName...

* ::slotted(...) -> scopeName > ...

* ...:dir(ltr|rtl) -> [dir="ltr|rtl"] ..., ...[dir="ltr|rtl"]

* :host(:dir[rtl]) -> scopeName:dir(rtl) -> [dir="rtl"] scopeName, scopeName[dir="rtl"]

*/
const SCOPE_NAME = 'style-scope';

class StyleTransformer {
  get SCOPE_NAME() {
    return SCOPE_NAME;
  }
  // Given a node and scope name, add a scoping class to each node
  // in the tree. This facilitates transforming css into scoped rules.
  dom(node, scope, shouldRemoveScope) {
    // one time optimization to skip scoping...
    if (node.__styleScoped) {
      node.__styleScoped = null;
    } else {
      this._transformDom(node, scope || '', shouldRemoveScope);
    }
  }

  _transformDom(node, selector, shouldRemoveScope) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      this.element(node, selector, shouldRemoveScope);
    }
    let c$ = (node.localName === 'template') ?
      (node.content || node._content).childNodes :
      node.children || node.childNodes;
    if (c$) {
      for (let i=0; i<c$.length; i++) {
        this._transformDom(c$[i], selector, shouldRemoveScope);
      }
    }
  }

  element(element, scope, shouldRemoveScope) {
    // note: if using classes, we add both the general 'style-scope' class
    // as well as the specific scope. This enables easy filtering of all
    // `style-scope` elements
    if (scope) {
      // note: svg on IE does not have classList so fallback to class
      if (element.classList) {
        if (shouldRemoveScope) {
          element.classList.remove(SCOPE_NAME);
          element.classList.remove(scope);
        } else {
          element.classList.add(SCOPE_NAME);
          element.classList.add(scope);
        }
      } else if (element.getAttribute) {
        let c = element.getAttribute(CLASS);
        if (shouldRemoveScope) {
          if (c) {
            let newValue = c.replace(SCOPE_NAME, '').replace(scope, '');
            setElementClassRaw(element, newValue);
          }
        } else {
          let newValue = (c ? c + ' ' : '') + SCOPE_NAME + ' ' + scope;
          setElementClassRaw(element, newValue);
        }
      }
    }
  }

  elementStyles(element, styleRules, callback) {
    let cssBuildType = element.__cssBuild;
    // no need to shim selectors if settings.useNativeShadow, also
    // a shady css build will already have transformed selectors
    // NOTE: This method may be called as part of static or property shimming.
    // When there is a targeted build it will not be called for static shimming,
    // but when the property shim is used it is called and should opt out of
    // static shimming work when a proper build exists.
    let cssText = (nativeShadow || cssBuildType === 'shady') ?
    toCssText(styleRules, callback) :
    this.css(styleRules, element.is, element.extends, callback) + '\n\n';
    return cssText.trim();
  }

  // Given a string of cssText and a scoping string (scope), returns
  // a string of scoped css where each selector is transformed to include
  // a class created from the scope. ShadowDOM selectors are also transformed
  // (e.g. :host) to use the scoping selector.
  css(rules, scope, ext, callback) {
    let hostScope = this._calcHostScope(scope, ext);
    scope = this._calcElementScope(scope);
    let self = this;
    return toCssText(rules, function(rule) {
      if (!rule.isScoped) {
        self.rule(rule, scope, hostScope);
        rule.isScoped = true;
      }
      if (callback) {
        callback(rule, scope, hostScope);
      }
    });
  }

  _calcElementScope(scope) {
    if (scope) {
      return CSS_CLASS_PREFIX + scope;
    } else {
      return '';
    }
  }

  _calcHostScope(scope, ext) {
    return ext ? '[is=' +  scope + ']' : scope;
  }

  rule(rule, scope, hostScope) {
    this._transformRule(rule, this._transformComplexSelector,
      scope, hostScope);
  }

  // transforms a css rule to a scoped rule.
  _transformRule(rule, transformer, scope, hostScope) {
    // NOTE: save transformedSelector for subsequent matching of elements
    // against selectors (e.g. when calculating style properties)
    rule.selector = rule.transformedSelector =
      this._transformRuleCss(rule, transformer, scope, hostScope);
  }

  _transformRuleCss(rule, transformer, scope, hostScope) {
    let p$ = rule.selector.split(COMPLEX_SELECTOR_SEP);
    // we want to skip transformation of rules that appear in keyframes,
    // because they are keyframe selectors, not element selectors.
    if (!isKeyframesSelector(rule)) {
      for (let i=0, l=p$.length, p; (i<l) && (p=p$[i]); i++) {
        p$[i] = transformer.call(this, p, scope, hostScope);
      }
    }
    return p$.join(COMPLEX_SELECTOR_SEP);
  }

  _transformComplexSelector(selector, scope, hostScope) {
    let stop = false;
    selector = selector.trim();
    // Remove spaces inside of selectors like `:nth-of-type` because it confuses SIMPLE_SELECTOR_SEP
    selector = selector.replace(NTH, (m, type, inner) => `:${type}(${inner.replace(/\s/g, '')})`);
    selector = selector.replace(SLOTTED_START, `${HOST} $1`);
    selector = selector.replace(SIMPLE_SELECTOR_SEP, (m, c, s) => {
      if (!stop) {
        let info = this._transformCompoundSelector(s, c, scope, hostScope);
        stop = stop || info.stop;
        c = info.combinator;
        s = info.value;
      }
      return c + s;
    });
    return selector;
  }

  _transformCompoundSelector(selector, combinator, scope, hostScope) {
    // replace :host with host scoping class
    let slottedIndex = selector.indexOf(SLOTTED);
    if (selector.indexOf(HOST) >= 0) {
      selector = this._transformHostSelector(selector, hostScope);
    // replace other selectors with scoping class
    } else if (slottedIndex !== 0) {
      selector = scope ? this._transformSimpleSelector(selector, scope) :
        selector;
    }
    // mark ::slotted() scope jump to replace with descendant selector + arg
    // also ignore left-side combinator
    let slotted = false;
    if (slottedIndex >= 0) {
      combinator = '';
      slotted = true;
    }
    // process scope jumping selectors up to the scope jump and then stop
    let stop;
    if (slotted) {
      stop = true;
      if (slotted) {
        // .zonk ::slotted(.foo) -> .zonk.scope > .foo
        selector = selector.replace(SLOTTED_PAREN, (m, paren) => ` > ${paren}`);
      }
    }
    selector = selector.replace(DIR_PAREN, (m, before, dir) =>
      `[dir="${dir}"] ${before}, ${before}[dir="${dir}"]`);
    return {value: selector, combinator, stop};
  }

  _transformSimpleSelector(selector, scope) {
    let p$ = selector.split(PSEUDO_PREFIX);
    p$[0] += scope;
    return p$.join(PSEUDO_PREFIX);
  }

  // :host(...) -> scopeName...
  _transformHostSelector(selector, hostScope) {
    let m = selector.match(HOST_PAREN);
    let paren = m && m[2].trim() || '';
    if (paren) {
      if (!paren[0].match(SIMPLE_SELECTOR_PREFIX)) {
        // paren starts with a type selector
        let typeSelector = paren.split(SIMPLE_SELECTOR_PREFIX)[0];
        // if the type selector is our hostScope then avoid pre-pending it
        if (typeSelector === hostScope) {
          return paren;
        // otherwise, this selector should not match in this scope so
        // output a bogus selector.
        } else {
          return SELECTOR_NO_MATCH;
        }
      } else {
        // make sure to do a replace here to catch selectors like:
        // `:host(.foo)::before`
        return selector.replace(HOST_PAREN, function(m, host, paren) {
          return hostScope + paren;
        });
      }
    // if no paren, do a straight :host replacement.
    // TODO(sorvell): this should not strictly be necessary but
    // it's needed to maintain support for `:host[foo]` type selectors
    // which have been improperly used under Shady DOM. This should be
    // deprecated.
    } else {
      return selector.replace(HOST, hostScope);
    }
  }

  documentRule(rule) {
    // reset selector in case this is redone.
    rule.selector = rule.parsedSelector;
    this.normalizeRootSelector(rule);
    this._transformRule(rule, this._transformDocumentSelector);
  }

  normalizeRootSelector(rule) {
    if (rule.selector === ROOT) {
      rule.selector = 'html';
    }
  }

  _transformDocumentSelector(selector) {
    return selector.match(SLOTTED) ?
      this._transformComplexSelector(selector, SCOPE_DOC_SELECTOR) :
      this._transformSimpleSelector(selector.trim(), SCOPE_DOC_SELECTOR);
  }
}

let NTH = /:(nth[-\w]+)\(([^)]+)\)/;
let SCOPE_DOC_SELECTOR = `:not(.${SCOPE_NAME})`;
let COMPLEX_SELECTOR_SEP = ',';
let SIMPLE_SELECTOR_SEP = /(^|[\s>+~]+)((?:\[.+?\]|[^\s>+~=\[])+)/g;
let SIMPLE_SELECTOR_PREFIX = /[[.:#*]/;
let HOST = ':host';
let ROOT = ':root';
let SLOTTED = '::slotted';
let SLOTTED_START = new RegExp(`^(${SLOTTED})`);
// NOTE: this supports 1 nested () pair for things like
// :host(:not([selected]), more general support requires
// parsing which seems like overkill
let HOST_PAREN = /(:host)(?:\(((?:\([^)(]*\)|[^)(]*)+?)\))/;
// similar to HOST_PAREN
let SLOTTED_PAREN = /(?:::slotted)(?:\(((?:\([^)(]*\)|[^)(]*)+?)\))/;
let DIR_PAREN = /(.*):dir\((?:(ltr|rtl))\)/;
let CSS_CLASS_PREFIX = '.';
let PSEUDO_PREFIX = ':';
let CLASS = 'class';
let SELECTOR_NO_MATCH = 'should_not_match';

var StyleTransformer$1 = new StyleTransformer();

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

var templateMap = {};

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

const promise = Promise.resolve();

class StyleInfo {
  static get(node) {
    return node.__styleInfo;
  }
  static set(node, styleInfo) {
    node.__styleInfo = styleInfo;
    return styleInfo;
  }
  static invalidate(elementName) {
    if (templateMap[elementName]) {
      templateMap[elementName]._applyShimInvalid = true;
    }
  }
  /*
  the template is marked as `validating` for one microtask so that all instances
  found in the tree crawl of `applyStyle` will update themselves,
  but the template will only be updated once.
  */
  static startValidating(elementName) {
    const template = templateMap[elementName];
    if (!template._validating) {
      template._validating = true;
      promise.then(() => {
        template._applyShimInvalid = false;
        template._validating = false;
      });
    }
  }
  constructor(ast, placeholder, ownStylePropertyNames, elementName, typeExtension, cssBuild) {
    this.styleRules = ast || null;
    this.placeholder = placeholder || null;
    this.ownStylePropertyNames = ownStylePropertyNames || [];
    this.overrideStyleProperties = null;
    this.elementName = elementName || '';
    this.cssBuild = cssBuild || '';
    this.typeExtension = typeExtension || '';
    this.styleProperties = null;
    this.scopeSelector = null;
    this.customStyle = null;
  }
}

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

// TODO: dedupe with shady
const p = window.Element.prototype;
const matchesSelector = p.matches || p.matchesSelector ||
  p.mozMatchesSelector || p.msMatchesSelector ||
  p.oMatchesSelector || p.webkitMatchesSelector;

const IS_IE = navigator.userAgent.match('Trident');

const XSCOPE_NAME = 'x-scope';

class StyleProperties {
  get XSCOPE_NAME() {
    return XSCOPE_NAME;
  }
  // decorates styles with rule info and returns an array of used style
  // property names
  decorateStyles(rules) {
    let self = this, props = {}, keyframes = [], ruleIndex = 0;
    forEachRule(rules, function(rule) {
      self.decorateRule(rule);
      // mark in-order position of ast rule in styles block, used for cache key
      rule.index = ruleIndex++;
      self.collectPropertiesInCssText(rule.propertyInfo.cssText, props);
    }, function onKeyframesRule(rule) {
      keyframes.push(rule);
    });
    // Cache all found keyframes rules for later reference:
    rules._keyframes = keyframes;
    // return this list of property names *consumes* in these styles.
    let names = [];
    for (let i in props) {
      names.push(i);
    }
    return names;
  }

  // decorate a single rule with property info
  decorateRule(rule) {
    if (rule.propertyInfo) {
      return rule.propertyInfo;
    }
    let info = {}, properties = {};
    let hasProperties = this.collectProperties(rule, properties);
    if (hasProperties) {
      info.properties = properties;
      // TODO(sorvell): workaround parser seeing mixins as additional rules
      rule.rules = null;
    }
    info.cssText = this.collectCssText(rule);
    rule.propertyInfo = info;
    return info;
  }

  // collects the custom properties from a rule's cssText
  collectProperties(rule, properties) {
    let info = rule.propertyInfo;
    if (info) {
      if (info.properties) {
        Object.assign(properties, info.properties);
        return true;
      }
    } else {
      let m, rx$$1 = rx.VAR_ASSIGN;
      let cssText = rule.parsedCssText;
      let value;
      let any;
      while ((m = rx$$1.exec(cssText))) {
        // note: group 2 is var, 3 is mixin
        value = (m[2] || m[3]).trim();
        // value of 'inherit' or 'unset' is equivalent to not setting the property here
        if (value !== 'inherit' || value !== 'unset') {
          properties[m[1].trim()] = value;
        }
        any = true;
      }
      return any;
    }

  }

  // returns cssText of properties that consume variables/mixins
  collectCssText(rule) {
    return this.collectConsumingCssText(rule.parsedCssText);
  }

  // NOTE: we support consumption inside mixin assignment
  // but not production, so strip out {...}
  collectConsumingCssText(cssText) {
    return cssText.replace(rx.BRACKETED, '')
      .replace(rx.VAR_ASSIGN, '');
  }

  collectPropertiesInCssText(cssText, props) {
    let m;
    while ((m = rx.VAR_CONSUMED.exec(cssText))) {
      let name = m[1];
      // This regex catches all variable names, and following non-whitespace char
      // If next char is not ':', then variable is a consumer
      if (m[2] !== ':') {
        props[name] = true;
      }
    }
  }

  // turns custom properties into realized values.
  reify(props) {
    // big perf optimization here: reify only *own* properties
    // since this object has __proto__ of the element's scope properties
    let names = Object.getOwnPropertyNames(props);
    for (let i=0, n; i < names.length; i++) {
      n = names[i];
      props[n] = this.valueForProperty(props[n], props);
    }
  }

  // given a property value, returns the reified value
  // a property value may be:
  // (1) a literal value like: red or 5px;
  // (2) a variable value like: var(--a), var(--a, red), or var(--a, --b) or
  // var(--a, var(--b));
  // (3) a literal mixin value like { properties }. Each of these properties
  // can have values that are: (a) literal, (b) variables, (c) @apply mixins.
  valueForProperty(property, props) {
    // case (1) default
    // case (3) defines a mixin and we have to reify the internals
    if (property) {
      if (property.indexOf(';') >=0) {
        property = this.valueForProperties(property, props);
      } else {
        // case (2) variable
        let self = this;
        let fn = function(prefix, value, fallback, suffix) {
          if (!value) {
            return prefix + suffix;
          }
          let propertyValue = self.valueForProperty(props[value], props);
          // if value is "initial", then the variable should be treated as unset
          if (!propertyValue || propertyValue === 'initial') {
            // fallback may be --a or var(--a) or literal
            propertyValue = self.valueForProperty(props[fallback] || fallback, props) ||
            fallback;
          } else if (propertyValue === 'apply-shim-inherit') {
            // CSS build will replace `inherit` with `apply-shim-inherit`
            // for use with native css variables.
            // Since we have full control, we can use `inherit` directly.
            propertyValue = 'inherit';
          }
          return prefix + (propertyValue || '') + suffix;
        };
        property = processVariableAndFallback(property, fn);
      }
    }
    return property && property.trim() || '';
  }

  // note: we do not yet support mixin within mixin
  valueForProperties(property, props) {
    let parts = property.split(';');
    for (let i=0, p, m; i<parts.length; i++) {
      if ((p = parts[i])) {
        rx.MIXIN_MATCH.lastIndex = 0;
        m = rx.MIXIN_MATCH.exec(p);
        if (m) {
          p = this.valueForProperty(props[m[1]], props);
        } else {
          let colon = p.indexOf(':');
          if (colon !== -1) {
            let pp = p.substring(colon);
            pp = pp.trim();
            pp = this.valueForProperty(pp, props) || pp;
            p = p.substring(0, colon) + pp;
          }
        }
        parts[i] = (p && p.lastIndexOf(';') === p.length - 1) ?
          // strip trailing ;
          p.slice(0, -1) :
          p || '';
      }
    }
    return parts.join(';');
  }

  applyProperties(rule, props) {
    let output = '';
    // dynamically added sheets may not be decorated so ensure they are.
    if (!rule.propertyInfo) {
      this.decorateRule(rule);
    }
    if (rule.propertyInfo.cssText) {
      output = this.valueForProperties(rule.propertyInfo.cssText, props);
    }
    rule.cssText = output;
  }

  // Apply keyframe transformations to the cssText of a given rule. The
  // keyframeTransforms object is a map of keyframe names to transformer
  // functions which take in cssText and spit out transformed cssText.
  applyKeyframeTransforms(rule, keyframeTransforms) {
    let input = rule.cssText;
    let output = rule.cssText;
    if (rule.hasAnimations == null) {
      // Cache whether or not the rule has any animations to begin with:
      rule.hasAnimations = rx.ANIMATION_MATCH.test(input);
    }
    // If there are no animations referenced, we can skip transforms:
    if (rule.hasAnimations) {
      let transform;
      // If we haven't transformed this rule before, we iterate over all
      // transforms:
      if (rule.keyframeNamesToTransform == null) {
        rule.keyframeNamesToTransform = [];
        for (let keyframe in keyframeTransforms) {
          transform = keyframeTransforms[keyframe];
          output = transform(input);
          // If the transform actually changed the CSS text, we cache the
          // transform name for future use:
          if (input !== output) {
            input = output;
            rule.keyframeNamesToTransform.push(keyframe);
          }
        }
      } else {
        // If we already have a list of keyframe names that apply to this
        // rule, we apply only those keyframe name transforms:
        for (let i = 0; i < rule.keyframeNamesToTransform.length; ++i) {
          transform = keyframeTransforms[rule.keyframeNamesToTransform[i]];
          input = transform(input);
        }
        output = input;
      }
    }
    rule.cssText = output;
  }

  // Test if the rules in these styles matches the given `element` and if so,
  // collect any custom properties into `props`.
  propertyDataFromStyles(rules, element) {
    let props = {}, self = this;
    // generates a unique key for these matches
    let o = [];
    // note: active rules excludes non-matching @media rules
    forEachRule(rules, function(rule) {
      // TODO(sorvell): we could trim the set of rules at declaration
      // time to only include ones that have properties
      if (!rule.propertyInfo) {
        self.decorateRule(rule);
      }
      // match element against transformedSelector: selector may contain
      // unwanted uniquification and parsedSelector does not directly match
      // for :host selectors.
      let selectorToMatch = rule.transformedSelector || rule.parsedSelector;
      if (element && rule.propertyInfo.properties && selectorToMatch) {
        if (matchesSelector.call(element, selectorToMatch)) {
          self.collectProperties(rule, props);
          // produce numeric key for these matches for lookup
          addToBitMask(rule.index, o);
        }
      }
    }, null, true);
    return {properties: props, key: o};
  }

  whenHostOrRootRule(scope, rule, cssBuild, callback) {
    if (!rule.propertyInfo) {
      this.decorateRule(rule);
    }
    if (!rule.propertyInfo.properties) {
      return;
    }
    let hostScope = scope.is ?
    StyleTransformer$1._calcHostScope(scope.is, scope.extends) :
    'html';
    let parsedSelector = rule.parsedSelector;
    let isRoot = (parsedSelector === ':host > *' || parsedSelector === 'html');
    let isHost = parsedSelector.indexOf(':host') === 0 && !isRoot;
    // build info is either in scope (when scope is an element) or in the style
    // when scope is the default scope; note: this allows default scope to have
    // mixed mode built and unbuilt styles.
    if (cssBuild === 'shady') {
      // :root -> x-foo > *.x-foo for elements and html for custom-style
      isRoot = parsedSelector === (hostScope + ' > *.' + hostScope) || parsedSelector.indexOf('html') !== -1;
      // :host -> x-foo for elements, but sub-rules have .x-foo in them
      isHost = !isRoot && parsedSelector.indexOf(hostScope) === 0;
    }
    if (cssBuild === 'shadow') {
      isRoot = parsedSelector === ':host > *' || parsedSelector === 'html';
      isHost = isHost && !isRoot;
    }
    if (!isRoot && !isHost) {
      return;
    }
    let selectorToMatch = hostScope;
    if (isHost) {
      // need to transform :host under ShadowDOM because `:host` does not work with `matches`
      if (nativeShadow && !rule.transformedSelector) {
        // transform :host into a matchable selector
        rule.transformedSelector =
        StyleTransformer$1._transformRuleCss(
          rule,
          StyleTransformer$1._transformComplexSelector,
          StyleTransformer$1._calcElementScope(scope.is),
          hostScope
        );
      }
      selectorToMatch = rule.transformedSelector || hostScope;
    }
    callback({
      selector: selectorToMatch,
      isHost: isHost,
      isRoot: isRoot
    });
  }

  hostAndRootPropertiesForScope(scope, rules) {
    let hostProps = {}, rootProps = {}, self = this;
    // note: active rules excludes non-matching @media rules
    let cssBuild = rules && rules.__cssBuild;
    forEachRule(rules, function(rule) {
      // if scope is StyleDefaults, use _element for matchesSelector
      self.whenHostOrRootRule(scope, rule, cssBuild, function(info) {
        let element = scope._element || scope;
        if (matchesSelector.call(element, info.selector)) {
          if (info.isHost) {
            self.collectProperties(rule, hostProps);
          } else {
            self.collectProperties(rule, rootProps);
          }
        }
      });
    }, null, true);
    return {rootProps: rootProps, hostProps: hostProps};
  }

  transformStyles(element, properties, scopeSelector) {
    let self = this;
    let hostSelector = StyleTransformer$1
      ._calcHostScope(element.is, element.extends);
    let rxHostSelector = element.extends ?
      '\\' + hostSelector.slice(0, -1) + '\\]' :
      hostSelector;
    let hostRx = new RegExp(rx.HOST_PREFIX + rxHostSelector +
      rx.HOST_SUFFIX);
    let rules = StyleInfo.get(element).styleRules;
    let keyframeTransforms =
      this._elementKeyframeTransforms(element, rules, scopeSelector);
    return StyleTransformer$1.elementStyles(element, rules, function(rule) {
      self.applyProperties(rule, properties);
      if (!nativeShadow &&
          !isKeyframesSelector(rule) &&
          rule.cssText) {
        // NOTE: keyframe transforms only scope munge animation names, so it
        // is not necessary to apply them in ShadowDOM.
        self.applyKeyframeTransforms(rule, keyframeTransforms);
        self._scopeSelector(rule, hostRx, hostSelector, scopeSelector);
      }
    });
  }

  _elementKeyframeTransforms(element, rules, scopeSelector) {
    let keyframesRules = rules._keyframes;
    let keyframeTransforms = {};
    if (!nativeShadow && keyframesRules) {
      // For non-ShadowDOM, we transform all known keyframes rules in
      // advance for the current scope. This allows us to catch keyframes
      // rules that appear anywhere in the stylesheet:
      for (let i = 0, keyframesRule = keyframesRules[i];
           i < keyframesRules.length;
           keyframesRule = keyframesRules[++i]) {
        this._scopeKeyframes(keyframesRule, scopeSelector);
        keyframeTransforms[keyframesRule.keyframesName] =
            this._keyframesRuleTransformer(keyframesRule);
      }
    }
    return keyframeTransforms;
  }

  // Generate a factory for transforming a chunk of CSS text to handle a
  // particular scoped keyframes rule.
  _keyframesRuleTransformer(keyframesRule) {
    return function(cssText) {
      return cssText.replace(
          keyframesRule.keyframesNameRx,
          keyframesRule.transformedKeyframesName);
    };
  }

  // Transforms `@keyframes` names to be unique for the current host.
  // Example: @keyframes foo-anim -> @keyframes foo-anim-x-foo-0
  _scopeKeyframes(rule, scopeId) {
    rule.keyframesNameRx = new RegExp(rule.keyframesName, 'g');
    rule.transformedKeyframesName = rule.keyframesName + '-' + scopeId;
    rule.transformedSelector = rule.transformedSelector || rule.selector;
    rule.selector = rule.transformedSelector.replace(
        rule.keyframesName, rule.transformedKeyframesName);
  }

  // Strategy: x scope shim a selector e.g. to scope `.x-foo-42` (via classes):
  // non-host selector: .a.x-foo -> .x-foo-42 .a.x-foo
  // host selector: x-foo.wide -> .x-foo-42.wide
  // note: we use only the scope class (.x-foo-42) and not the hostSelector
  // (x-foo) to scope :host rules; this helps make property host rules
  // have low specificity. They are overrideable by class selectors but,
  // unfortunately, not by type selectors (e.g. overriding via
  // `.special` is ok, but not by `x-foo`).
  _scopeSelector(rule, hostRx, hostSelector, scopeId) {
    rule.transformedSelector = rule.transformedSelector || rule.selector;
    let selector = rule.transformedSelector;
    let scope = '.' + scopeId;
    let parts = selector.split(',');
    for (let i=0, l=parts.length, p; (i<l) && (p=parts[i]); i++) {
      parts[i] = p.match(hostRx) ?
        p.replace(hostSelector, scope) :
        scope + ' ' + p;
    }
    rule.selector = parts.join(',');
  }

  applyElementScopeSelector(element, selector, old) {
    let c = element.getAttribute('class') || '';
    let v = c;
    if (old) {
      v = c.replace(
        new RegExp('\\s*' + XSCOPE_NAME + '\\s*' + old + '\\s*', 'g'), ' ');
    }
    v += (v ? ' ' : '') + XSCOPE_NAME + ' ' + selector;
    if (c !== v) {
      setElementClassRaw(element, v);
    }
  }

  applyElementStyle(element, properties, selector, style) {
    // calculate cssText to apply
    let cssText = style ? style.textContent || '' :
      this.transformStyles(element, properties, selector);
    // if shady and we have a cached style that is not style, decrement
    let styleInfo = StyleInfo.get(element);
    let s = styleInfo.customStyle;
    if (s && !nativeShadow && (s !== style)) {
      s._useCount--;
      if (s._useCount <= 0 && s.parentNode) {
        s.parentNode.removeChild(s);
      }
    }
    // apply styling always under native or if we generated style
    // or the cached style is not in document(!)
    if (nativeShadow) {
      // update existing style only under native
      if (styleInfo.customStyle) {
        styleInfo.customStyle.textContent = cssText;
        style = styleInfo.customStyle;
      // otherwise, if we have css to apply, do so
      } else if (cssText) {
        // apply css after the scope style of the element to help with
        // style precedence rules.
        style = applyCss(cssText, selector, element.shadowRoot,
          styleInfo.placeholder);
      }
    } else {
      // shady and no cache hit
      if (!style) {
        // apply css after the scope style of the element to help with
        // style precedence rules.
        if (cssText) {
          style = applyCss(cssText, selector, null,
            styleInfo.placeholder);
        }
      // shady and cache hit but not in document
      } else if (!style.parentNode) {
        applyStyle(style, null, styleInfo.placeholder);
      }

    }
    // ensure this style is our custom style and increment its use count.
    if (style) {
      style._useCount = style._useCount || 0;
      // increment use count if we changed styles
      if (styleInfo.customStyle != style) {
        style._useCount++;
      }
      styleInfo.customStyle = style;
    }
    // @media rules may be stale in IE 10 and 11
    if (IS_IE) {
      style.textContent = style.textContent;
    }
    return style;
  }

  applyCustomStyle(style, properties) {
    let rules = rulesForStyle(style);
    let self = this;
    style.textContent = toCssText(rules, function(rule) {
      let css = rule.cssText = rule.parsedCssText;
      if (rule.propertyInfo && rule.propertyInfo.cssText) {
        // remove property assignments
        // so next function isn't confused
        // NOTE: we have 3 categories of css:
        // (1) normal properties,
        // (2) custom property assignments (--foo: red;),
        // (3) custom property usage: border: var(--foo); @apply(--foo);
        // In elements, 1 and 3 are separated for efficiency; here they
        // are not and this makes this case unique.
        css = removeCustomPropAssignment(css);
        // replace with reified properties, scenario is same as mixin
        rule.cssText = self.valueForProperties(css, properties);
      }
    });
  }
}

function addToBitMask(n, bits) {
  let o = parseInt(n / 32);
  let v = 1 << (n % 32);
  bits[o] = (bits[o] || 0) | v;
}

var StyleProperties$1 = new StyleProperties();

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

let placeholderMap = {};

const ce = window.customElements;
if (ce && !nativeShadow) {
  const origDefine = ce.define;
  ce.define = function(name, clazz, options) {
    placeholderMap[name] = applyStylePlaceHolder(name);
    return origDefine.call(ce, name, clazz, options);
  };
}

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
class StyleCache {
  constructor(typeMax = 100) {
    // map element name -> [{properties, styleElement, scopeSelector}]
    this.cache = {};
    this.typeMax = typeMax;
  }

  _validate(cacheEntry, properties, ownPropertyNames) {
    for (let idx = 0; idx < ownPropertyNames.length; idx++) {
      let pn = ownPropertyNames[idx];
      if (cacheEntry.properties[pn] !== properties[pn]) {
        return false;
      }
    }
    return true;
  }

  store(tagname, properties, styleElement, scopeSelector) {
    let list = this.cache[tagname] || [];
    list.push({properties, styleElement, scopeSelector});
    if (list.length > this.typeMax) {
      list.shift();
    }
    this.cache[tagname] = list;
  }

  fetch(tagname, properties, ownPropertyNames) {
    let list = this.cache[tagname];
    if (!list) {
      return;
    }
    // reverse list for most-recent lookups
    for (let idx = list.length - 1; idx >= 0; idx--) {
      let entry = list[idx];
      if (this._validate(entry, properties, ownPropertyNames)) {
        return entry;
      }
    }
  }
}

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
/**
 * The apply shim simulates the behavior of `@apply` proposed at
 * https://tabatkins.github.io/specs/css-apply-rule/.
 * The approach is to convert a property like this:
 *
 *    --foo: {color: red; background: blue;}
 *
 * to this:
 *
 *    --foo_-_color: red;
 *    --foo_-_background: blue;
 *
 * Then where `@apply --foo` is used, that is converted to:
 *
 *    color: var(--foo_-_color);
 *    background: var(--foo_-_background);
 *
 * This approach generally works but there are some issues and limitations.
 * Consider, for example, that somewhere *between* where `--foo` is set and used,
 * another element sets it to:
 *
 *    --foo: { border: 2px solid red; }
 *
 * We must now ensure that the color and background from the previous setting
 * do not apply. This is accomplished by changing the property set to this:
 *
 *    --foo_-_border: 2px solid red;
 *    --foo_-_color: initial;
 *    --foo_-_background: initial;
 *
 * This works but introduces one new issue.
 * Consider this setup at the point where the `@apply` is used:
 *
 *    background: orange;
 *    @apply --foo;
 *
 * In this case the background will be unset (initial) rather than the desired
 * `orange`. We address this by altering the property set to use a fallback
 * value like this:
 *
 *    color: var(--foo_-_color);
 *    background: var(--foo_-_background, orange);
 *    border: var(--foo_-_border);
 *
 * Note that the default is retained in the property set and the `background` is
 * the desired `orange`. This leads us to a limitation.
 *
 * Limitation 1:

 * Only properties in the rule where the `@apply`
 * is used are considered as default values.
 * If another rule matches the element and sets `background` with
 * less specificity than the rule in which `@apply` appears,
 * the `background` will not be set.
 *
 * Limitation 2:
 *
 * When using Polymer's `updateStyles` api, new properties may not be set for
 * `@apply` properties.

*/

let MIXIN_MATCH = rx.MIXIN_MATCH;
let VAR_ASSIGN = rx.VAR_ASSIGN;

let APPLY_NAME_CLEAN = /;\s*/m;
let INITIAL_INHERIT = /^\s*(initial)|(inherit)\s*$/;

// separator used between mixin-name and mixin-property-name when producing properties
// NOTE: plain '-' may cause collisions in user styles
let MIXIN_VAR_SEP = '_-_';

// map of mixin to property names
// --foo: {border: 2px} -> {properties: {(--foo, ['border'])}, dependants: {'element-name': proto}}
class MixinMap {
  constructor() {
    this._map = {};
  }
  set(name, props) {
    name = name.trim();
    this._map[name] = {
      properties: props,
      dependants: {}
    };
  }
  get(name) {
    name = name.trim();
    return this._map[name];
  }
}

class ApplyShim {
  constructor() {
    this._currentTemplate = null;
    this._measureElement = null;
    this._map = new MixinMap();
    this._separator = MIXIN_VAR_SEP;
    this._boundProduceCssProperties = (
      matchText, propertyName, valueProperty, valueMixin) =>
        this._produceCssProperties(
          matchText, propertyName, valueProperty, valueMixin);
  }
  // return true if `cssText` contains a mixin definition or consumption
  detectMixin(cssText) {
    const has = MIXIN_MATCH.test(cssText) || VAR_ASSIGN.test(cssText);
    // reset state of the regexes
    MIXIN_MATCH.lastIndex = 0;
    VAR_ASSIGN.lastIndex = 0;
    return has;
  }
  transformStyle(style, elementName) {
    let ast = rulesForStyle(style);
    this.transformRules(ast, elementName);
    return ast;
  }
  transformRules(rules, elementName) {
    this._currentTemplate = templateMap[elementName];
    forEachRule(rules, (r) => {
      this.transformRule(r);
    });
    this._currentTemplate = null;
  }
  transformRule(rule) {
    rule.cssText = this.transformCssText(rule.parsedCssText);
    // :root was only used for variable assignment in property shim,
    // but generates invalid selectors with real properties.
    // replace with `:host > *`, which serves the same effect
    if (rule.selector === ':root') {
      rule.selector = ':host > *';
    }
  }
  transformCssText(cssText) {
    // produce variables
    cssText = cssText.replace(VAR_ASSIGN, this._boundProduceCssProperties);
    // consume mixins
    return this._consumeCssProperties(cssText);
  }
  _getInitialValueForProperty(property) {
    if (!this._measureElement) {
      this._measureElement = document.createElement('meta');
      this._measureElement.style.all = 'initial';
      document.head.appendChild(this._measureElement);
    }
    return window.getComputedStyle(this._measureElement).getPropertyValue(property);
  }
  // replace mixin consumption with variable consumption
  _consumeCssProperties(text) {
    let m;
    // loop over text until all mixins with defintions have been applied
    while((m = MIXIN_MATCH.exec(text))) {
      let matchText = m[0];
      let mixinName = m[1];
      let idx = m.index;
      // collect properties before apply to be "defaults" if mixin might override them
      // match includes a "prefix", so find the start and end positions of @apply
      let applyPos = idx + matchText.indexOf('@apply');
      let afterApplyPos = idx + matchText.length;
      // find props defined before this @apply
      let textBeforeApply = text.slice(0, applyPos);
      let textAfterApply = text.slice(afterApplyPos);
      let defaults = this._cssTextToMap(textBeforeApply);
      let replacement = this._atApplyToCssProperties(mixinName, defaults);
      // use regex match position to replace mixin, keep linear processing time
      text = [textBeforeApply, replacement, textAfterApply].join('');
      // move regex search to _after_ replacement
      MIXIN_MATCH.lastIndex = idx + replacement.length;
    }
    return text;
  }
  // produce variable consumption at the site of mixin consumption
  // @apply --foo; -> for all props (${propname}: var(--foo_-_${propname}, ${fallback[propname]}}))
  // Example:
  // border: var(--foo_-_border); padding: var(--foo_-_padding, 2px)
  _atApplyToCssProperties(mixinName, fallbacks) {
    mixinName = mixinName.replace(APPLY_NAME_CLEAN, '');
    let vars = [];
    let mixinEntry = this._map.get(mixinName);
    // if we depend on a mixin before it is created
    // make a sentinel entry in the map to add this element as a dependency for when it is defined.
    if (!mixinEntry) {
      this._map.set(mixinName, {});
      mixinEntry = this._map.get(mixinName);
    }
    if (mixinEntry) {
      if (this._currentTemplate) {
        mixinEntry.dependants[this._currentTemplate.name] = this._currentTemplate;
      }
      let p, parts, f;
      for (p in mixinEntry.properties) {
        f = fallbacks && fallbacks[p];
        parts = [p, ': var(', mixinName, MIXIN_VAR_SEP, p];
        if (f) {
          parts.push(',', f);
        }
        parts.push(')');
        vars.push(parts.join(''));
      }
    }
    return vars.join('; ');
  }

  _replaceInitialOrInherit(property, value) {
    let match = INITIAL_INHERIT.exec(value);
    if (match) {
      if (match[1]) {
        // initial
        // replace `initial` with the concrete initial value for this property
        value = ApplyShim._getInitialValueForProperty(property);
      } else {
        // inherit
        // with this purposfully illegal value, the variable will be invalid at
        // compute time (https://www.w3.org/TR/css-variables/#invalid-at-computed-value-time)
        // and for inheriting values, will behave similarly
        // we cannot support the same behavior for non inheriting values like 'border'
        value = 'apply-shim-inherit';
      }
    }
    return value;
  }

  // "parse" a mixin definition into a map of properties and values
  // cssTextToMap('border: 2px solid black') -> ('border', '2px solid black')
  _cssTextToMap(text) {
    let props = text.split(';');
    let property, value;
    let out = {};
    for (let i = 0, p, sp; i < props.length; i++) {
      p = props[i];
      if (p) {
        sp = p.split(':');
        // ignore lines that aren't definitions like @media
        if (sp.length > 1) {
          property = sp[0].trim();
          // some properties may have ':' in the value, like data urls
          value = this._replaceInitialOrInherit(property, sp.slice(1).join(':'));
          out[property] = value;
        }
      }
    }
    return out;
  }

  _invalidateMixinEntry(mixinEntry) {
    for (let elementName in mixinEntry.dependants) {
      if (!this._currentTemplate || elementName !== this._currentTemplate.name) {
        StyleInfo.invalidate(elementName);
      }
    }
  }

  _produceCssProperties(matchText, propertyName, valueProperty, valueMixin) {
    // handle case where property value is a mixin
    if (valueProperty) {
      // form: --mixin2: var(--mixin1), where --mixin1 is in the map
      processVariableAndFallback(valueProperty, (prefix, value) => {
        if (value && this._map.get(value)) {
          valueMixin = '@apply ' + value + ';';
        }
      });
    }
    if (!valueMixin) {
      return matchText;
    }
    let mixinAsProperties = this._consumeCssProperties(valueMixin);
    let prefix = matchText.slice(0, matchText.indexOf('--'));
    let mixinValues = this._cssTextToMap(mixinAsProperties);
    let combinedProps = mixinValues;
    let mixinEntry = this._map.get(propertyName);
    let oldProps = mixinEntry && mixinEntry.properties;
    if (oldProps) {
      // NOTE: since we use mixin, the map of properties is updated here
      // and this is what we want.
      combinedProps = Object.assign(Object.create(oldProps), mixinValues);
    } else {
      this._map.set(propertyName, combinedProps);
    }
    let out = [];
    let p, v;
    // set variables defined by current mixin
    let needToInvalidate = false;
    for (p in combinedProps) {
      v = mixinValues[p];
      // if property not defined by current mixin, set initial
      if (v === undefined) {
        v = 'initial';
      }
      if (oldProps && !(p in oldProps)) {
        needToInvalidate = true;
      }
      out.push(propertyName + MIXIN_VAR_SEP + p + ': ' + v);
    }
    if (needToInvalidate) {
      this._invalidateMixinEntry(mixinEntry);
    }
    if (mixinEntry) {
      mixinEntry.properties = combinedProps;
    }
    // because the mixinMap is global, the mixin might conflict with
    // a different scope's simple variable definition:
    // Example:
    // some style somewhere:
    // --mixin1:{ ... }
    // --mixin2: var(--mixin1);
    // some other element:
    // --mixin1: 10px solid red;
    // --foo: var(--mixin1);
    // In this case, we leave the original variable definition in place.
    if (valueProperty) {
      prefix = matchText + ';' + prefix;
    }
    return prefix + out.join('; ') + ';';
  }
}

let applyShim = new ApplyShim();
window['ApplyShim'] = applyShim;

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

let flush = function() {};

if (!nativeShadow) {
  let elementNeedsScoping = (element) => {
    return (element.classList &&
      !element.classList.contains(StyleTransformer$1.SCOPE_NAME) ||
      // note: necessary for IE11
      (element instanceof SVGElement && (!element.hasAttribute('class') ||
      element.getAttribute('class').indexOf(StyleTransformer$1.SCOPE_NAME) < 0)));
  };

  let handler = (mxns) => {
    for (let x=0; x < mxns.length; x++) {
      let mxn = mxns[x];
      if (mxn.target === document.documentElement ||
        mxn.target === document.head) {
        continue;
      }
      for (let i=0; i < mxn.addedNodes.length; i++) {
        let n = mxn.addedNodes[i];
        if (elementNeedsScoping(n)) {
          let root = n.getRootNode();
          if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            // may no longer be in a shadowroot
            let host = root.host;
            if (host) {
              let scope = host.is || host.localName;
              StyleTransformer$1.dom(n, scope);
            }
          }
        }
      }
      for (let i=0; i < mxn.removedNodes.length; i++) {
        let n = mxn.removedNodes[i];
        if (n.nodeType === Node.ELEMENT_NODE) {
          let classes = undefined;
          if (n.classList) {
            classes = Array.from(n.classList);
          } else if (n.hasAttribute('class')) {
            classes = n.getAttribute('class').split(/\s+/);
          }
          if (classes !== undefined) {
            // NOTE: relies on the scoping class always being adjacent to the
            // SCOPE_NAME class.
            let classIdx = classes.indexOf(StyleTransformer$1.SCOPE_NAME);
            if (classIdx >= 0) {
              let scope = classes[classIdx + 1];
              if (scope) {
                StyleTransformer$1.dom(n, scope, true);
              }
            }
          }
        }
      }
    }
  };

  let observer = new MutationObserver(handler);
  let start = (node) => {
    observer.observe(node, {childList: true, subtree: true});
  };
  let nativeCustomElements = (window.customElements &&
    !window.customElements.flush);
  // need to start immediately with native custom elements
  // TODO(dfreedm): with polyfilled HTMLImports and native custom elements
  // excessive mutations may be observed; this can be optimized via cooperation
  // with the HTMLImports polyfill.
  if (nativeCustomElements) {
    start(document);
  } else {
    let delayedStart = () => {
      start(document.body);
    };
    // use polyfill timing if it's available
    if (window.HTMLImports) {
      window.HTMLImports.whenReady(delayedStart);
    // otherwise push beyond native imports being ready
    // which requires RAF + readystate interactive.
    } else {
      requestAnimationFrame(function() {
        if (document.readyState === 'loading') {
          let listener = function() {
            delayedStart();
            document.removeEventListener('readystatechange', listener);
          };
          document.addEventListener('readystatechange', listener);
        } else {
          delayedStart();
        }
      });
    }
  }

  flush = function() {
    handler(observer.takeRecords());
  };
}

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

// TODO(dfreedm): consider spliting into separate global
let styleCache = new StyleCache();

class ShadyCSS {
  constructor() {
    this._scopeCounter = {};
    this._documentOwner = document.documentElement;
    this._documentOwnerStyleInfo = StyleInfo.set(document.documentElement, new StyleInfo({rules: []}));
    this._elementsHaveApplied = false;
  }
  get nativeShadow() {
    return nativeShadow;
  }
  get nativeCss() {
    return nativeCssVariables;
  }
  get nativeCssApply() {
    return nativeCssApply;
  }
  flush() {
    flush();
  }
  _generateScopeSelector(name) {
    let id = this._scopeCounter[name] = (this._scopeCounter[name] || 0) + 1;
    return `${name}-${id}`;
  }
  getStyleAst(style) {
    return rulesForStyle(style);
  }
  styleAstToString(ast) {
    return toCssText(ast);
  }
  _gatherStyles(template) {
    let styles = template.content.querySelectorAll('style');
    let cssText = [];
    for (let i = 0; i < styles.length; i++) {
      let s = styles[i];
      cssText.push(s.textContent);
      s.parentNode.removeChild(s);
    }
    return cssText.join('').trim();
  }
  _getCssBuild(template) {
    let style = template.content.querySelector('style');
    if (!style) {
      return '';
    }
    return style.getAttribute('css-build') || '';
  }
  prepareTemplate(template, elementName, typeExtension) {
    if (template._prepared) {
      return;
    }
    template._prepared = true;
    template.name = elementName;
    template.extends = typeExtension;
    templateMap[elementName] = template;
    let cssBuild = this._getCssBuild(template);
    let cssText = this._gatherStyles(template);
    let info = {
      is: elementName,
      extends: typeExtension,
      __cssBuild: cssBuild,
    };
    if (!this.nativeShadow) {
      StyleTransformer$1.dom(template.content, elementName);
    }
    // check if the styling has mixin definitions or uses
    let hasMixins = applyShim.detectMixin(cssText);
    let ast = parse(cssText);
    // only run the applyshim transforms if there is a mixin involved
    if (hasMixins && this.nativeCss && !this.nativeCssApply) {
      applyShim.transformRules(ast, elementName);
    }
    template._styleAst = ast;

    let ownPropertyNames = [];
    if (!this.nativeCss) {
      ownPropertyNames = StyleProperties$1.decorateStyles(template._styleAst, info);
    }
    if (!ownPropertyNames.length || this.nativeCss) {
      let root = this.nativeShadow ? template.content : null;
      let placeholder = placeholderMap[elementName];
      let style = this._generateStaticStyle(info, template._styleAst, root, placeholder);
      template._style = style;
    }
    template._ownPropertyNames = ownPropertyNames;
  }
  _generateStaticStyle(info, rules, shadowroot, placeholder) {
    let cssText = StyleTransformer$1.elementStyles(info, rules);
    if (cssText.length) {
      return applyCss(cssText, info.is, shadowroot, placeholder);
    }
  }
  _prepareHost(host) {
    let is = host.getAttribute('is') || host.localName;
    let typeExtension;
    if (is !== host.localName) {
      typeExtension = host.localName;
    }
    let placeholder = placeholderMap[is];
    let template = templateMap[is];
    let ast;
    let ownStylePropertyNames;
    let cssBuild;
    if (template) {
      ast = template._styleAst;
      ownStylePropertyNames = template._ownPropertyNames;
      cssBuild = template._cssBuild;
    }
    return StyleInfo.set(host,
      new StyleInfo(
        ast,
        placeholder,
        ownStylePropertyNames,
        is,
        typeExtension,
        cssBuild
      )
    );
  }
  applyStyle(host, overrideProps) {
    let is = host.getAttribute('is') || host.localName;
    let styleInfo = StyleInfo.get(host);
    let hasApplied = Boolean(styleInfo);
    if (!styleInfo) {
      styleInfo = this._prepareHost(host);
    }
    // Only trip the `elementsHaveApplied` flag if a node other that the root document has `applyStyle` called
    if (!this._isRootOwner(host)) {
      this._elementsHaveApplied = true;
    }
    if (window.CustomStyle) {
      let CS = window.CustomStyle;
      if (CS._documentDirty) {
        CS.findStyles();
        if (!this.nativeCss) {
          this._updateProperties(this._documentOwner, this._documentOwnerStyleInfo);
        } else if (!this.nativeCssApply) {
          CS._revalidateApplyShim();
        }
        CS.applyStyles();
        // if no elements have booted yet, we can just update the document and be done
        if (!this._elementsHaveApplied) {
          return;
        }
        // if no native css custom properties, we must recalculate the whole tree
        if (!this.nativeCss) {
          this.updateStyles();
          /*
          When updateStyles() runs, this element may not have a shadowroot yet.
          If not, we need to make sure that this element runs `applyStyle` on itself at least once to generate a style
          */
          if (hasApplied) {
            return;
          }
        }
      }
    }
    if (overrideProps) {
      styleInfo.overrideStyleProperties =
        styleInfo.overrideStyleProperties || {};
      Object.assign(styleInfo.overrideStyleProperties, overrideProps);
    }
    if (this.nativeCss) {
      if (styleInfo.overrideStyleProperties) {
        this._updateNativeProperties(host, styleInfo.overrideStyleProperties);
      }
      let template = templateMap[is];
      // bail early if there is no shadowroot for this element
      if (!template && !this._isRootOwner(host)) {
        return;
      }
      if (template && template._applyShimInvalid && template._style) {
        // update template
        if (!template._validating) {
          applyShim.transformRules(template._styleAst, is);
          template._style.textContent = StyleTransformer$1.elementStyles(host, styleInfo.styleRules);
          StyleInfo.startValidating(is);
        }
        // update instance if native shadowdom
        if (this.nativeShadow) {
          let root = host.shadowRoot;
          if (root) {
            let style = root.querySelector('style');
            style.textContent = StyleTransformer$1.elementStyles(host, styleInfo.styleRules);
          }
        }
        styleInfo.styleRules = template._styleAst;
      }
    } else {
      this._updateProperties(host, styleInfo);
      if (styleInfo.ownStylePropertyNames && styleInfo.ownStylePropertyNames.length) {
        this._applyStyleProperties(host, styleInfo);
      }
    }
    if (hasApplied) {
      let root = this._isRootOwner(host) ? host : host.shadowRoot;
      // note: some elements may not have a root!
      if (root) {
        this._applyToDescendants(root);
      }
    }
  }
  _applyToDescendants(root) {
    // note: fallback to childNodes to support recursing into SVG which
    // does not support children in some browsers (Edge/IE)
    let c$ = root.children || root.childNodes;
    for (let i = 0, c; i < c$.length; i++) {
      c = c$[i];
      if (c.shadowRoot) {
        this.applyStyle(c);
      }
      this._applyToDescendants(c);
    }
  }
  _styleOwnerForNode(node) {
    let root = node.getRootNode();
    let host = root.host;
    if (host) {
      if (StyleInfo.get(host)) {
        return host;
      } else {
        return this._styleOwnerForNode(host);
      }
    }
    return this._documentOwner;
  }
  _isRootOwner(node) {
    return (node === this._documentOwner);
  }
  _applyStyleProperties(host, styleInfo) {
    let is = host.getAttribute('is') || host.localName;
    let cacheEntry = styleCache.fetch(is, styleInfo.styleProperties, styleInfo.ownStylePropertyNames);
    let cachedScopeSelector = cacheEntry && cacheEntry.scopeSelector;
    let cachedStyle = cacheEntry ? cacheEntry.styleElement : null;
    let oldScopeSelector = styleInfo.scopeSelector;
    // only generate new scope if cached style is not found
    styleInfo.scopeSelector = cachedScopeSelector || this._generateScopeSelector(is);
    let style = StyleProperties$1.applyElementStyle(host, styleInfo.styleProperties, styleInfo.scopeSelector, cachedStyle);
    if (!this.nativeShadow) {
      StyleProperties$1.applyElementScopeSelector(host, styleInfo.scopeSelector, oldScopeSelector);
    }
    if (!cacheEntry) {
      styleCache.store(is, styleInfo.styleProperties, style, styleInfo.scopeSelector);
    }
    return style;
  }
  _updateProperties(host, styleInfo) {
    let owner = this._styleOwnerForNode(host);
    let ownerStyleInfo = StyleInfo.get(owner);
    let ownerProperties = ownerStyleInfo.styleProperties;
    let props = Object.create(ownerProperties || null);
    let hostAndRootProps = StyleProperties$1.hostAndRootPropertiesForScope(host, styleInfo.styleRules);
    let propertyData = StyleProperties$1.propertyDataFromStyles(ownerStyleInfo.styleRules, host);
    let propertiesMatchingHost = propertyData.properties;
    Object.assign(
      props,
      hostAndRootProps.hostProps,
      propertiesMatchingHost,
      hostAndRootProps.rootProps
    );
    this._mixinOverrideStyles(props, styleInfo.overrideStyleProperties);
    StyleProperties$1.reify(props);
    styleInfo.styleProperties = props;
  }
  _mixinOverrideStyles(props, overrides) {
    for (let p in overrides) {
      let v = overrides[p];
      // skip override props if they are not truthy or 0
      // in order to fall back to inherited values
      if (v || v === 0) {
        props[p] = v;
      }
    }
  }
  _updateNativeProperties(element, properties) {
    // remove previous properties
    for (let p in properties) {
      // NOTE: for bc with shim, don't apply null values.
      if (p === null) {
        element.style.removeProperty(p);
      } else {
        element.style.setProperty(p, properties[p]);
      }
    }
  }
  updateStyles(properties) {
    this.applyStyle(this._documentOwner, properties);
  }
  /* Custom Style operations */
  _transformCustomStyleForDocument(style) {
    let ast = rulesForStyle(style);
    forEachRule(ast, (rule) => {
      if (nativeShadow) {
        StyleTransformer$1.normalizeRootSelector(rule);
      } else {
        StyleTransformer$1.documentRule(rule);
      }
      if (this.nativeCss && !this.nativeCssApply) {
        applyShim.transformRule(rule);
      }
    });
    if (this.nativeCss) {
      style.textContent = toCssText(ast);
    } else {
      this._documentOwnerStyleInfo.styleRules.rules.push(ast);
    }
  }
  _revalidateApplyShim(style) {
    if (this.nativeCss && !this.nativeCssApply) {
      let ast = rulesForStyle(style);
      applyShim.transformRules(ast);
      style.textContent = toCssText(ast);
    }
  }
  _applyCustomStyleToDocument(style) {
    if (!this.nativeCss) {
      StyleProperties$1.applyCustomStyle(style, this._documentOwnerStyleInfo.styleProperties);
    }
  }
  getComputedStyleValue(element, property) {
    let value;
    if (!this.nativeCss) {
      // element is either a style host, or an ancestor of a style host
      let styleInfo = StyleInfo.get(element) || StyleInfo.get(this._styleOwnerForNode(element));
      value = styleInfo.styleProperties[property];
    }
    // fall back to the property value from the computed styling
    value = value || window.getComputedStyle(element).getPropertyValue(property);
    // trim whitespace that can come after the `:` in css
    // example: padding: 2px -> " 2px"
    return value.trim();
  }
  // given an element and a classString, replaces
  // the element's class with the provided classString and adds
  // any necessary ShadyCSS static and property based scoping selectors
  setElementClass(element, classString) {
    let root = element.getRootNode();
    let classes = classString ? classString.split(/\s/) : [];
    let scopeName = root.host && root.host.localName;
    // If no scope, try to discover scope name from existing class.
    // This can occur if, for example, a template stamped element that
    // has been scoped is manipulated when not in a root.
    if (!scopeName) {
      var classAttr = element.getAttribute('class');
      if (classAttr) {
        let k$ = classAttr.split(/\s/);
        for (let i=0; i < k$.length; i++) {
          if (k$[i] === StyleTransformer$1.SCOPE_NAME) {
            scopeName = k$[i+1];
            break;
          }
        }
      }
    }
    if (scopeName) {
      classes.push(StyleTransformer$1.SCOPE_NAME, scopeName);
    }
    if (!this.nativeCss) {
      let styleInfo = StyleInfo.get(element);
      if (styleInfo && styleInfo.scopeSelector) {
        classes.push(StyleProperties$1.XSCOPE_NAME, styleInfo.scopeSelector);
      }
    }
    setElementClassRaw(element, classes.join(' '));
  }
  _styleInfoForNode(node) {
    return StyleInfo.get(node);
  }
}

window['ShadyCSS'] = new ShadyCSS();

/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

/*
Wrapper over <style> elements to co-operate with ShadyCSS

Example:
<custom-style>
  <style>
  ...
  </style>
</custom-style>
*/

let ShadyCSS$1 = window.ShadyCSS;

let enqueued = false;

let customStyles = [];

let hookFn = null;

/*
If a page only has <custom-style> elements, it will flash unstyled content,
as all the instances will boot asynchronously after page load.

Calling ShadyCSS.updateStyles() will force the work to happen synchronously
*/
function enqueueDocumentValidation() {
  if (enqueued) {
    return;
  }
  enqueued = true;
  if (window.HTMLImports) {
    window.HTMLImports.whenReady(validateDocument);
  } else if (document.readyState === 'complete') {
    validateDocument();
  } else {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'complete') {
        validateDocument();
      }
    });
  }
}

function validateDocument() {
  requestAnimationFrame(() => {
    if (enqueued || ShadyCSS$1._elementsHaveApplied) {
      ShadyCSS$1.updateStyles();
    }
    enqueued = false;
  });
}

class CustomStyle extends HTMLElement {
  static get _customStyles() {
    return customStyles;
  }
  static get processHook() {
    return hookFn;
  }
  static set processHook(fn) {
    hookFn = fn;
  }
  static get _documentDirty() {
    return enqueued;
  }
  static findStyles() {
    for (let i = 0; i < customStyles.length; i++) {
      let c = customStyles[i];
      if (!c._style) {
        let style = c.querySelector('style');
        if (!style) {
          continue;
        }
        // HTMLImports polyfill may have cloned the style into the main document,
        // which is referenced with __appliedElement.
        // Also, we must copy over the attributes.
        if (style.__appliedElement) {
          for (let i = 0; i < style.attributes.length; i++) {
            let attr = style.attributes[i];
            style.__appliedElement.setAttribute(attr.name, attr.value);
          }
        }
        c._style = style.__appliedElement || style;
        if (hookFn) {
          hookFn(c._style);
        }
        ShadyCSS$1._transformCustomStyleForDocument(c._style);
      }
    }
  }
  static _revalidateApplyShim() {
    for (let i = 0; i < customStyles.length; i++) {
      let c = customStyles[i];
      if (c._style) {
        ShadyCSS$1._revalidateApplyShim(c._style);
      }
    }
  }
  static applyStyles() {
    for (let i = 0; i < customStyles.length; i++) {
      let c = customStyles[i];
      if (c._style) {
        ShadyCSS$1._applyCustomStyleToDocument(c._style);
      }
    }
    enqueued = false;
  }
  constructor() {
    super();
    customStyles.push(this);
    enqueueDocumentValidation();
  }
}

window['CustomStyle'] = CustomStyle;
window.customElements.define('custom-style', CustomStyle);

/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(scope) {

  'use strict';

  if (customElements && customElements.polyfillWrapFlushCallback) {
    // Here we ensure that the public `HTMLImports.whenReady`
    // always comes *after* custom elements have upgraded.
    let flushCallback;
    function runAndClearCallback() {
      if (flushCallback) {
        let cb = flushCallback;
        flushCallback = null;
        cb();
      }
    }
    let origWhenReady = HTMLImports.whenReady;
    customElements.polyfillWrapFlushCallback(function(cb) {
      flushCallback = cb;
      origWhenReady(runAndClearCallback);
    });

    HTMLImports.whenReady = function(cb) {
      origWhenReady(function() {
        runAndClearCallback();
        cb();
      });
    };

  }

  HTMLImports.whenReady(function() {
    requestAnimationFrame(function() {
      window.dispatchEvent(new CustomEvent('WebComponentsReady'));
    });
  });

})(window.WebComponents);

/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(scope) {

  // It's desireable to provide a default stylesheet
  // that's convenient for styling unresolved elements, but
  // it's cumbersome to have to include this manually in every page.
  // It would make sense to put inside some HTMLImport but
  // the HTMLImports polyfill does not allow loading of stylesheets
  // that block rendering. Therefore this injection is tolerated here.
  //
  // NOTE: position: relative fixes IE's failure to inherit opacity
  // when a child is not statically positioned.
  var style = document.createElement('style');
  style.textContent = ''
      + 'body {'
      + 'transition: opacity ease-in 0.2s;'
      + ' } \n'
      + 'body[unresolved] {'
      + 'opacity: 0; display: block; overflow: hidden; position: relative;'
      + ' } \n'
      ;
  var head = document.querySelector('head');
  head.insertBefore(style, head.firstChild);

})(window.WebComponents);

/**
@license
Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
/*
 * Polyfills loaded: HTML Imports, Custom Elements, Shady DOM/Shady CSS, platform polyfills (URL/template)
 * Used in: IE 11
 */

}());

//# sourceMappingURL=webcomponents-lite.js.map

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
    }

  }

})();

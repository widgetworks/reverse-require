# reverse-require
Search for node modules from host project first

## Overview

This project provides a set of methods to reverse the search order of module imports.

So instead of searching the module first and moving up the chain, we start at the top-level project and work our way down the child projects until we find the module.


## When is this useful?

Imagine you have a __Core__ library that defines a set of `npm` dependencies.

You reference __Core__ in __Project A__ and __Project B__ to get a common set of dependencies and behaviour :sunglasses:

But now you want to test out how a new dependency will work in __Project A__. You `npm link` the module into __Project A__, fire it up and... __Core__ still loads the old version :neutral_face:

Of course! __Core__ defines the dependency so it's installed locally to that project and linking the new version to __Project A__ won't help.

You could link the dependency into __Core__ but it can get a bit hairy if you have a few libraries deep. And what if you need a different set of libraries in  __Project B__?

`reverse-require` lets you link a module near the __base__ of the tree and  version with your dependency modules (a little like `npm dedupe` but without having to define the same dependency in your `package.json` file).


## Installation

```bash
$ npm install --save reverse-require
```

## Usage

```javascript
// Configuration:

// In the index of your project:
var ReverseRequire = require('reverse-require');
ReverseRequire.moduleRoot = __filename;

// Usage:
var rr = require('reverse-require')();
var _ = rr('lodash');
```

// Copyright 2013 Google Inc.
// Copyright 2014 Volker Sorge
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Rule store for math syntax tree nodes.
 * @author sorge@google.com (Volker Sorge)
 */

goog.provide('sre.MathStore');

goog.require('sre.BaseRuleStore');
goog.require('sre.BaseUtil');
goog.require('sre.Locale.en');
goog.require('sre.Messages');
goog.require('sre.SpeechRule');



/**
 * A store for Math rules.
 * @constructor
 * @extends {sre.BaseRuleStore}
 */
sre.MathStore = function() {
  sre.MathStore.base(this, 'constructor');

  /**
   * @type {Array.<string>}
   */
  this.annotators = [];

  this.parseMethods['Alias'] = goog.bind(this.defineRuleAlias, this);
  this.parseMethods['Aliases'] =
      goog.bind(this.defineRulesAlias, this);
  this.parseMethods['UniqueAlias'] =
      goog.bind(this.defineUniqueRuleAlias, this);
  this.parseMethods['SpecializedRule'] =
      goog.bind(this.defineSpecialisedRule, this);

};
goog.inherits(sre.MathStore, sre.BaseRuleStore);


/**
 * @override
 */
sre.MathStore.prototype.initialize = function() {
  if (this.initialized) return;
  this.annotations();
  this.setSpeechRules(this.trie.collectRules());
  this.initialized = true;
};


/**
 * Activates annotators.
 */
sre.MathStore.prototype.annotations = function() {
  for (var i = 0, annotator; annotator = this.annotators[i]; i++) {
    sre.SemanticAnnotations.getInstance().activate(this.domain, annotator);
  }
};


/**
 * Adds an alias for an existing rule.
 * @param {string} name The name of the rule.
 * @param {string} dynamic A math domain and style assignment.
 * @param {string} query Precondition query of the rule.
 * @param {...string} var_args Additional static precondition constraints.
 */
sre.MathStore.prototype.defineUniqueRuleAlias = function(
    name, dynamic, query, var_args) {
  var dynamicCstr = this.parseCstr(dynamic);
  var rule = this.findRule(
      goog.bind(
          function(rule) {
            return rule.name == name &&
                dynamicCstr.equal(rule.dynamicCstr);
          },
          this));
  if (!rule) {
    throw new sre.SpeechRule.OutputError(
        'Rule named ' + name + ' with style ' + dynamic + ' does not exist.');
  }
  this.addAlias_(rule, query, Array.prototype.slice.call(arguments, 3));
};


// TODO: Possibly defines a number of duplicate rules.
// (E.g., superscript-baseline in Mathspeak)
// These are automatically discarded in the Trie, but might still be worthwhile
// looking into the definition methods.
//
/**
 * Adds an alias for an existing rule.
 * @param {string} name The name of the rule.
 * @param {string} query Precondition query of the rule.
 * @param {...string} var_args Additional static precondition constraints.
 */
sre.MathStore.prototype.defineRuleAlias = function(name, query, var_args) {
  var rule = this.findRule(function(rule) {
    return rule.name == name;});
  if (!rule) {
    throw new sre.SpeechRule.OutputError(
        'Rule with named ' + name + ' does not exist.');
  }
  this.addAlias_(rule, query, Array.prototype.slice.call(arguments, 2));
};


/**
 * Adds an alias for an existing rule.
 * @param {string} name The name of the rule.
 * @param {string} query Precondition query of the rule.
 * @param {...string} var_args Additional static precondition constraints.
 */
sre.MathStore.prototype.defineRulesAlias = function(name, query, var_args) {
  var rules = this.findAllRules(function(rule) {return rule.name == name;});
  if (rules.length == 0) {
    throw new sre.SpeechRule.OutputError(
        'Rule with name ' + name + ' does not exist.');
  }
  var cstrList = Array.prototype.slice.call(arguments, 2);
  var keep = [];
  var findKeep = function(rule) {
    var cstr = rule.dynamicCstr.toString();
    var action = rule.action.toString();
    for (var i = 0, k; k = keep[i]; i++) {
      if (k.action === action && k.cstr === cstr) {
        return false;
      }
    }
    keep.push({cstr: cstr, action: action});
    return true;
  };
  rules.forEach(goog.bind(
      function(rule) {
        if (findKeep(rule)) {
          this.addAlias_(rule, query, cstrList);
        }
      },
      this));
};


/**
 * Adds a new speech rule as alias of the given rule.
 * @param {sre.SpeechRule} rule The existing rule.
 * @param {string} query Precondition query of the rule.
 * @param {!Array.<string>} cstrList List of additional constraints.
 * @private
 */
sre.MathStore.prototype.addAlias_ = function(rule, query, cstrList) {
  var prec = this.parsePrecondition(query, cstrList);
  var newRule = new sre.SpeechRule(
      rule.name, rule.dynamicCstr, prec, rule.action);
  newRule.name = rule.name;
  this.addRule(newRule);
};


/**
 * Duplicates a speech rule for the old dynamic constraint for a new dynamic
 * constraint, keeping the same precondition, while possibly adding a new
 * action.
 * @param {string} name The name of the rule.
 * @param {string} oldDynamic The old math domain and style assignment.
 * @param {string} newDynamic The new math domain and style assignment.
 * @param {string=} opt_action String version of the speech rule.
 */
sre.MathStore.prototype.defineSpecialisedRule = function(
    name, oldDynamic, newDynamic, opt_action) {
  var dynamicCstr = this.parseCstr(oldDynamic);
  var rule = this.findRule(
      goog.bind(
          function(rule) {
            return rule.name == name &&
                dynamicCstr.equal(rule.dynamicCstr);},
          this));
  if (!rule) {
    throw new sre.SpeechRule.OutputError(
        'Rule named ' + name + ' with style ' +
        oldDynamic + ' does not exist.');
  }
  var newCstr = this.parseCstr(newDynamic);
  var action = opt_action ? sre.SpeechRule.Action.fromString(opt_action) :
          rule.action;
  var newRule = new sre.SpeechRule(
      rule.name, newCstr, rule.precondition, action);
  this.addRule(newRule);
};


// Evaluator
/**
 * Evaluates a single string of a math expressions. The method splits the given
 * string into components such as single characters, function names or words,
 * numbers, etc. and creates the appropriate auditory descriptions.
 * @override
 */
sre.MathStore.prototype.evaluateString = function(str) {
  var descs = new Array();
  if (str.match(/^\s+$/)) {
    // Nothing but whitespace: Ignore.
    return descs;
  }
  // Case of numbers with whitespace for separation.
  var num = this.matchNumber_(str);
  if (num && num.length === str.length) {
    descs.push(this.evaluateCharacter(num.number));
    return descs;
  }
  var split = sre.BaseUtil.removeEmpty(str.replace(/\s/g, ' ').split(' '));
  for (var i = 0, s; s = split[i]; i++) {
    if (s.length == 1) {
      descs.push(this.evaluateCharacter(s));
    } else if (s.match(new RegExp('^[' + sre.Messages.REGEXP.TEXT + ']+$'))) {
      descs.push(this.evaluateCharacter(s));
    } else {
      // Break up string even further wrt. symbols vs alphanum substrings.
      var rest = s;
      while (rest) {
        num = this.matchNumber_(rest);
        var alpha = rest.match(
            new RegExp('^[' + sre.Messages.REGEXP.TEXT + ']+'));
        if (num) {
          descs.push(this.evaluateCharacter(num.number));
          rest = rest.substring(num.length);
        } else if (alpha) {
          descs.push(this.evaluateCharacter(alpha[0]));
          rest = rest.substring(alpha[0].length);
        } else {
          var chars = Array.from(rest);
          var chr = chars[0];
          descs.push(this.evaluateCharacter(chr));
          rest = chars.slice(1).join('');
        }
      }
    }
  }
  return descs;
};


/**
 * Matches a number with respect to locale. If it discovers it is a number in
 * English writing, it will attempt to translate it.
 * @param {string} str The string to match.
 * @return {?{number: string, length: number}} The number and its length.
 * @private
 */
sre.MathStore.prototype.matchNumber_ = function(str) {
  var locNum = str.match(new RegExp('^' + sre.Messages.REGEXP.NUMBER));
  var enNum = str.match(new RegExp('^' + sre.Locale.en.REGEXP.NUMBER));
  if (!locNum && !enNum) {
    return null;
  }
  var isEn = enNum && enNum[0] === str;
  var isLoc = (locNum && locNum[0] === str) || !isEn;
  if (isLoc) {
    return locNum ? {number: locNum[0], length: locNum[0].length} : null;
  }
  var number = enNum[0].
      replace(new RegExp(sre.Locale.en.REGEXP.DIGIT_GROUP, 'g'), 'X').
      replace(new RegExp(sre.Locale.en.REGEXP.DECIMAL_MARK, 'g'),
              sre.Messages.REGEXP.DECIMAL_MARK).
      replace(/X/g, sre.Messages.REGEXP.DIGIT_GROUP.replace(/\\/g, ''));
  return {number: number, length: enNum[0].length};
};


/**
 * @override
 */
sre.MathStore.prototype.parse = function(ruleSet) {
  sre.MathStore.base(this, 'parse', ruleSet);
  this.annotators = /** @type {Array.<string>} */(ruleSet['annotators'] || []);
};

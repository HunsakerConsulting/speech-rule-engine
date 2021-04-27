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
 * @fileoverview Abstract base class for all speech rule stores.
 *
 * The base rule store implements some basic functionality that is common to
 * most speech rule stores.
 * @author sorge@google.com (Volker Sorge)
 */

goog.provide('sre.BaseRuleStore');

goog.require('sre.AuditoryDescription');
goog.require('sre.Debugger');
goog.require('sre.DomUtil');
goog.require('sre.DynamicCstr');
goog.require('sre.Engine');
goog.require('sre.SpeechRule');
goog.require('sre.SpeechRuleContext');
goog.require('sre.SpeechRuleEvaluator');
goog.require('sre.SpeechRuleStore');
goog.require('sre.Trie');



/**
 * @constructor
 * @implements {sre.SpeechRuleEvaluator}
 * @implements {sre.SpeechRuleStore}
 */
sre.BaseRuleStore = function() {

  /**
   * Context for custom functions of this rule store.
   * @type {sre.SpeechRuleContext}
   */
  this.context = new sre.SpeechRuleContext();

  /**
   * Set of speech rules in the store.
   * @type {!Array.<sre.SpeechRule>}
   * @private
   */
  this.speechRules_ = [];

  /**
   * Trie for indexing speech rules in this store.
   * @type {sre.Trie}
   */
  this.trie = new sre.Trie(this);

  /**
   * A priority list of dynamic constraint attributes.
   * @type {!sre.DynamicCstr.Order}
   */
  this.parseOrder = sre.DynamicCstr.DEFAULT_ORDER;

  /**
   * A dynamic constraint parser.
   * @type {!sre.DynamicCstr.Parser}
   */
  this.parser = new sre.DynamicCstr.Parser(this.parseOrder);

  /**
   * Default locale.
   * @type {string}
   */
  this.locale = sre.DynamicCstr.DEFAULT_VALUES[sre.DynamicCstr.Axis.LOCALE];

  /**
   * Default modality.
   * @type {string}
   */
  this.modality = sre.DynamicCstr.DEFAULT_VALUES[sre.DynamicCstr.Axis.MODALITY];

  /**
   * Default domain.
   * @type {string}
   */
  this.domain = '';

  /**
   * @type {boolean}
   */
  this.initialized = false;

  this.parseMethods = {
    'Rule': goog.bind(this.defineRule, this),
    'Generator': goog.bind(this.generateRules, this)
  };

  /**
   * Local transcriptions for special characters.
   * @type {Object.<string>}
   */
  this.customTranscriptions = { };

};


/**
 * @override
 */
sre.BaseRuleStore.prototype.lookupRule = function(node, dynamic) {
  if (!node ||
      (node.nodeType != sre.DomUtil.NodeType.ELEMENT_NODE &&
       node.nodeType != sre.DomUtil.NodeType.TEXT_NODE)) {
    return null;
  }
  var matchingRules = this.lookupRules(node, dynamic);
  return (matchingRules.length > 0) ?
      this.pickMostConstraint_(dynamic, matchingRules) : null;
};


/**
 * Retrieves a list of applicable rule for the given node.
 * @param {!Node} node A node.
 * @param {!sre.DynamicCstr} dynamic Additional dynamic
 *     constraints. These are matched against properties of a rule.
 * @return {Array.<sre.SpeechRule>} All applicable speech rules.
 */
sre.BaseRuleStore.prototype.lookupRules = function(node, dynamic) {
  return this.trie.lookupRules(node, dynamic.allProperties());
};


/**
 * @override
 */
sre.BaseRuleStore.prototype.defineRule = function(
    name, dynamic, action, prec, cstr) {
  var rule;
  try {
    // TODO: Have a parser that respects generators.
    var postc = sre.SpeechRule.Action.fromString(action);
    var cstrList = Array.prototype.slice.call(arguments, 4);
    var fullPrec = this.parsePrecondition(prec, cstrList);
    var dynamicCstr = this.parseCstr(dynamic);
    rule = new sre.SpeechRule(name, dynamicCstr, fullPrec, postc);
  } catch (err) {
    if (err.name == 'RuleError') {
      console.error('Rule Error ', prec, '(' + dynamic + '):', err.message);
      return null;
    }
    else {
      throw err;
    }
  }
  this.addRule(rule);
  return rule;
};


/**
 * @override
 */
sre.BaseRuleStore.prototype.addRule = function(rule) {
  rule.context = this.context;
  this.trie.addRule(rule);
  this.speechRules_.unshift(rule);
};


/**
 * @override
 */
sre.BaseRuleStore.prototype.deleteRule = function(rule) {
  var index = this.speechRules_.indexOf(rule);
  if (index != -1) {
    this.speechRules_.splice(index, 1);
  }
};


/**
 * @override
 */
sre.BaseRuleStore.prototype.findRule = function(pred) {
  for (var i = 0, rule; rule = this.speechRules_[i]; i++) {
    if (pred(rule)) {
      return rule;
    }
  }
  return null;
};


/**
 * @override
 */
sre.BaseRuleStore.prototype.findAllRules = function(pred) {
  return this.speechRules_.filter(pred);
};


/**
 * @override
 */
sre.BaseRuleStore.prototype.evaluateDefault = function(node) {
  var rest = node.textContent.slice(0);
  if (rest.match(/^\s+$/)) {
    // Nothing but whitespace: Ignore.
    return this.evaluateWhitespace(rest);
  }
  return this.evaluateString(rest);
};


/**
 * @override
 */
sre.BaseRuleStore.prototype.evaluateString = goog.abstractMethod;


/**
 * @override
 */
sre.BaseRuleStore.prototype.evaluateWhitespace = function(str) {
  return [];
};


/**
 * @override
 */
sre.BaseRuleStore.prototype.evaluateCustom = function(str) {
  var trans = this.customTranscriptions[str];
  return (trans !== undefined) ?
      sre.AuditoryDescription.create(
          {'text': trans}, {adjust: true, translate: false}) : null;
};


/**
 * @override
 */
sre.BaseRuleStore.prototype.evaluateCharacter = function(str) {
  return this.evaluateCustom(str) || sre.AuditoryDescription.create(
      {'text': str}, {adjust: true, translate: true});
};


/**
 * Test the applicability of a speech rule in debugging mode.
 * @param {sre.SpeechRule} rule Rule to debug.
 * @param {!Node} node DOM node to test applicability of given rule.
 */
sre.BaseRuleStore.prototype.debugSpeechRule = function(rule, node) {
  var prec = rule.precondition;
  var queryResult = rule.context.applyQuery(node, prec.query);
  sre.Debugger.getInstance().output(
      prec.query, queryResult ? queryResult.toString() : queryResult);
  prec.constraints.forEach(
      goog.bind(function(cstr) {
        sre.Debugger.getInstance().output(
            cstr, rule.context.applyConstraint(node, cstr));},
      this));
};


/**
 * Function to initialize the store with speech rules. It is called by the
 * speech rule engine upon parametrization with this store. The function allows
 * us to define sets of rules in separate files while depending on functionality
 * that is defined in the rule store.
 * Essentially it is a way of getting around dependencies.
 */
sre.BaseRuleStore.prototype.initialize = goog.abstractMethod;


/**
 * Removes duplicates of the given rule from the rule store. Thereby duplicates
 * are identified by having the same precondition and dynamic constraint.
 * @param {sre.SpeechRule} rule The rule.
 */
sre.BaseRuleStore.prototype.removeDuplicates = function(rule) {
  for (var i = this.speechRules_.length - 1, oldRule;
       oldRule = this.speechRules_[i]; i--) {
    if (oldRule != rule &&
        rule.dynamicCstr.equal(oldRule.dynamicCstr) &&
        sre.BaseRuleStore.comparePreconditions_(oldRule, rule)) {
      this.speechRules_.splice(i, 1);
    }
  }
};


/**
 * Picks the result of the most constraint rule by prefering those:
 * 1) that best match the dynamic constraints.
 * 2) with the most additional constraints.
 * @param {sre.DynamicCstr} dynamic Dynamic constraints.
 * @param {!Array.<sre.SpeechRule>} rules An array of rules.
 * @return {sre.SpeechRule} The most constraint rule.
 * @private
 */
sre.BaseRuleStore.prototype.pickMostConstraint_ = function(dynamic, rules) {
  var comparator = sre.Engine.getInstance().comparator;
  rules.sort(
      function(r1, r2) {
        return comparator.compare(r1.dynamicCstr, r2.dynamicCstr) ||
            // When same number of dynamic constraint attributes matches for
            // both rules, compare length of static constraints.
            // sre.BaseRuleStore.strongQuery_(r1, r2) ||
            sre.BaseRuleStore.priority_(r1, r2) ||
            (r2.precondition.constraints.length -
             r1.precondition.constraints.length);}
  );
  sre.Debugger.getInstance().generateOutput(
      goog.bind(function() {
        return rules.map(function(x) {
          return x.name + '(' + x.dynamicCstr.toString() + ')';});
      }, this)
  );
  return rules[0];
};


// TODO (sorge) Define the following methods directly on the precondition
//     classes.
/**
 * Compares two static constraints (i.e., lists of precondition constraints) and
 * returns true if they are equal.
 * @param {Array.<string>} cstr1 First static constraints.
 * @param {Array.<string>} cstr2 Second static constraints.
 * @return {boolean} True if the static constraints are equal.
 * @private
 */
sre.BaseRuleStore.compareStaticConstraints_ = function(
    cstr1, cstr2) {
  if (cstr1.length != cstr2.length) {
    return false;
  }
  for (var i = 0, cstr; cstr = cstr1[i]; i++) {
    if (cstr2.indexOf(cstr) == -1) {
      return false;
    }
  }
  return true;
};


/**
 * Compares the preconditions of two speech rules.
 * @param {sre.SpeechRule} rule1 The first speech rule.
 * @param {sre.SpeechRule} rule2 The second speech rule.
 * @return {boolean} True if the preconditions are equal.
 * @private
 */
sre.BaseRuleStore.comparePreconditions_ = function(rule1, rule2) {
  var prec1 = rule1.precondition;
  var prec2 = rule2.precondition;
  if (prec1.query != prec2.query) {
    return false;
  }
  return sre.BaseRuleStore.compareStaticConstraints_(
      prec1.constraints, prec2.constraints);
};


/**
 * Compares priority of two rules.
 * @param {sre.SpeechRule} rule1 The first speech rule.
 * @param {sre.SpeechRule} rule2 The second speech rule.
 * @return {number} -1, 0, 1 depending on the comparison.
 * @private
 */
sre.BaseRuleStore.priority_ = function(rule1, rule2) {
  var priority1 = rule1.precondition.priority;
  var priority2 = rule2.precondition.priority;
  return (priority1 === priority2) ? 0 :
      ((priority1 > priority2) ? -1 : 1);
};


/**
 * @return {!Array.<sre.SpeechRule>} Set of all speech rules in the store.
 */
sre.BaseRuleStore.prototype.getSpeechRules = function() {
  return this.speechRules_;
};


/**
 * Sets the speech rule set of the store.
 * @param {!Array.<sre.SpeechRule>} rules New rule set.
 */
sre.BaseRuleStore.prototype.setSpeechRules = function(rules) {
  this.speechRules_ = rules;
};


/**
 * Default constraint parser that adds the locale to the rest constraint
 * (generally, domain.style).
 * @param {string} cstr The constraint string.
 * @return {!sre.DynamicCstr} The parsed constraint including locale.
 */
sre.BaseRuleStore.prototype.parseCstr = function(cstr) {
  return this.parser.parse(
      this.locale + '.' + this.modality +
      (this.domain ? '.' + this.domain : '') +
      '.' + cstr);
};


/**
 * Parses precondition by resolving generator rules.
 * @param {string} query The query constraint.
 * @param {!Array.<string>} rest The rest constraints.
 * @return {sre.SpeechRule.Precondition} The new precondition.
 */
sre.BaseRuleStore.prototype.parsePrecondition = function(query, rest) {
  var queryCstr = this.parsePrecondition_(query);
  query = queryCstr[0];
  var restCstr = queryCstr.slice(1);
  for (var cstr of rest) {
    restCstr = restCstr.concat(this.parsePrecondition_(cstr));
  }
  return new sre.SpeechRule.Precondition(query, restCstr);
};


/**
 * Resolves a single precondition constraint.
 * @param {string} cstr The precondition constraint.
 * @return {Array.<string>} Array of constraints, possibly generated.
 * @private
 */
sre.BaseRuleStore.prototype.parsePrecondition_ = function(cstr) {
  var generator = this.context.customGenerators.lookup(cstr);
  return generator ? generator() : [cstr];
};


/**
 * Parses a rule set definition.
 * @param {Object.<string|Array<*>>} ruleSet The
 *     definition object.
 */
sre.BaseRuleStore.prototype.parse = function(ruleSet) {
  this.modality = ruleSet.modality || this.modality;
  this.locale = ruleSet.locale || this.locale;
  this.domain = ruleSet.domain || this.domain;
  this.context.parse(ruleSet.functions || []);
  this.parseRules(ruleSet.rules || []);
};


/**
 * Parse a list of rules, each given as a list of strings.
 * @param {Array.<Array.<string>>} rules The list of rules.
 */
sre.BaseRuleStore.prototype.parseRules = function(rules) {
  for (var i = 0, rule; rule = rules[i]; i++) {
    let type = rule[0];
    let method = this.parseMethods[type];
    if (type && method) {
      method.apply(this, rule.slice(1));
    }
  }
};


/**
 * Parses rules generated by the given generator function.
 * @param {string} generator Name of the generator function.
 */
sre.BaseRuleStore.prototype.generateRules = function(generator) {
  var method = this.context.customGenerators.lookup(generator);
  if (method) {
    method(this);
  }
};


/**
 * Prunes the trie of the store for a given constraint.
 * @param {Array.<string>} constraints A list of constraints.
 */
sre.BaseRuleStore.prototype.prune = function(constraints) {
  var last = constraints.pop();
  var parent = this.trie.byConstraint(constraints);
  if (parent) {
    parent.removeChild(last);
  }
};

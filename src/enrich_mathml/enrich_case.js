// Copyright 2015-21 Volker Sorge
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
 * @fileoverview Procedure for special case in semantic enrichment of MathML.
 * @author volker.sorge@gmail.com (Volker Sorge)
 */

goog.provide('sre.EnrichCase');



/**
 * @interface
 */
sre.EnrichCase = function() { };


/**
 * Retrieves the MathML node that is the result of the computation.
 * @return {!Element} The enriched MathML node.
 */
sre.EnrichCase.prototype.getMathml = function() { };

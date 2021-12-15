//
// Copyright 2020-21 Volker Sorge
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
 * @fileoverview Translating numbers into Bokmal.
 * @author volker.sorge@gmail.com (Volker Sorge)
 */
import {Numbers, NUMBERS as NUMB} from '../messages';

//
// This work was sponsored by TextHelp
//

/**
 * Sub-ISO specification. Possible values: alt.
 */
export let SUB_ISO: string = 'alt';

/**
 * Changes number one 'eins' into a prefix.
 * @param num number string.
 * @return If it is a one, it is made into prefix.
 */
function onePrefix_(num: string, thd: boolean = false): string {
  let numOne = NUMBERS.ones[1];
  return num === numOne ?
    (num === 'ein' ? 'eitt ' : (thd ? 'et' : 'ett'))
    : num;
}


/**
 * Translates a number of up to twelve digits into a string representation.
 * @param num The number to translate.
 * @return The string representation of that number.
 */
function hundredsToWords_(num: number, ordinal: boolean = false): string {
  let n = num % 1000;
  let str = '';
  let ones = NUMBERS.ones[Math.floor(n / 100)];
  str += ones ? onePrefix_(ones) + 'hundre' : '';
  n = n % 100;
  if (n) {
    str += str ? 'og' : '';
    if (ordinal) {
      let ord = NUMBERS.special.smallOrdinals[n];
      if (ord) {
        return str += ord;
      }
    }
    ones = NUMBERS.ones[n];
    if (ones) {
      str += ones;
    } else {
      let tens = NUMBERS.tens[Math.floor(n / 10)];
      ones = NUMBERS.ones[n % 10];
      str += ones ? ones + 'og' + tens : tens;
    }
  }
  return (ordinal ? replaceOrdinal(str) : str);
}


/**
 * Adds the ordinal ending for numbers up to numbers < 1000.
 * @param str The number.
 * @return Number with ordinal ending.
 */
function replaceOrdinal(str: string): string {
  let letOne = NUMBERS.special.endOrdinal[0];
  if (letOne === 'a' && str.match(/en$/)) {
    return str.slice(0, -2) + NUMBERS.special.endOrdinal;
  }
  if (str.match(/(d|n)$/) || str.match(/hundre$/)) {
    return str + 'de';
  }
  if (str.match(/i$/)) {
    return str + NUMBERS.special.endOrdinal;
  }
  if (letOne === 'a' && str.match(/e$/)) {
    return str.slice(0, -1) + NUMBERS.special.endOrdinal;
  }
  if (str.match(/e$/)) {
    return str + 'nde';
  }
  return str + 'nde';
}


/**
 * Translates a number of up to twelve digits into a string representation.
 * @param num The number to translate.
 * @return The string representation of that number.
 */
function numberToWords(num: number, ordinal: boolean = false): string {
  if (num === 0) {
    return ordinal ? NUMBERS.special.smallOrdinals[0] : NUMBERS.zero;
  }
  if (num >= Math.pow(10, 36)) {
    return num.toString();
  }
  let pos = 0;
  let str = '';
  while (num > 0) {
    let hundreds = num % 1000;
    if (hundreds) {
      let hund = hundredsToWords_(num % 1000, (pos ? false : ordinal));
      if (!pos && ordinal) {
        ordinal = !ordinal;
      }
      str = (pos === 1 ? onePrefix_(hund, true) : hund) +
        (pos > 1 ? NUMBERS.numSep : '') +
        (pos ?
          // If this is million or above take care oaf the plural.
          (NUMBERS.large[pos] + (pos > 1 && hundreds > 1 ? 'er' : '')) :
          '') +
        (pos > 1 && str ? NUMBERS.numSep : '') + str;
    }
    num = Math.floor(num / 1000);
    pos++;
  }
  return ordinal ? (str + (str.match(/tusen$/) ? 'de' : 'te')) : str;
}


/**
 * Translates a number of up to twelve digits into a string representation of
 * its ordinal.
 * @param num The number to translate.
 * @param plural A flag indicating if the ordinal is in plural.
 * @return The ordinal of the number as string.
 */
function numberToOrdinal(num: number, _plural: boolean): string {
  return wordOrdinal(num);
}


/**
 * Creates a word ordinal string from a number.
 * @param num The number to be converted.
 * @return The ordinal string.
 */
function wordOrdinal(num: number): string {
  let ordinal = numberToWords(num, true);
  return ordinal;
}


/**
 * Creates a simple ordinal string from a number.
 * @param num The number to be converted.
 * @return The ordinal string.
 */
function simpleOrdinal(num: number): string {
  return num.toString() + '.';
}


const NUMBERS: Numbers = NUMB();
NUMBERS.wordOrdinal = wordOrdinal;
NUMBERS.simpleOrdinal = simpleOrdinal;
NUMBERS.numberToWords = numberToWords;
NUMBERS.numberToOrdinal = numberToOrdinal;

export default NUMBERS;
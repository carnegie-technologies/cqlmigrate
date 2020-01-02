/**
 * Copyright 2019 Carnegie Technologies
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Assortment of utility functions
 */

import * as crypto from 'crypto';
import { Lexer, Token } from './Lexer';

const lexer: Lexer = new Lexer();

/**
 * Returns the input CQL in a canonical form. This form is all of the required
 * tokens (all non-whitespace and non-comment tokens) that the lexer returns,
 * joined with spaces. Note that this doesn't modify the case of keywords and
 * identifiers.
 */
export function canonicalizeCql(cql: string): string {
    const tokenValues: string[] = lexer.getRequiredTokens(cql).map((current: Token): string => {
        return current.value;
    });

    return tokenValues.join(' ');
}

/**
 * Calculates the checksum (MD5 hash, hex encoded) of the input CQL.
 * WARNING: Changing this function in any way that causes the output to change
 * for the same input would break this tool. If this function changes, all existing
 * checksums in the cql.migrations table would need to be recalculated.
 */
export function getCqlChecksum(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex');
}

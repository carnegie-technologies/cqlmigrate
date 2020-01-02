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
 * Contains the CQL lexer and token type
 */

import * as moo from 'moo';

/**
 * The token types that aren't required for reconstructing the CQL
 */
export const optionalTokenTypes: string[] = ['comment', 'whitespace'];

/**
 * Export an alias for the token type, so the moo package doesn't need to be
 * imported by anyone using the lexer
 */
export type Token = moo.Token;

/**
 * Regex patterns for getting CQL quotes (supports escaping quotes)
 */
const singleQuoteString: RegExp = /'(?:(?:(?:[^'])|(?:''))*)'/;
const doubleQuoteString: RegExp = /"(?:(?:(?:[^"])|(?:""))*)"/;
const stringPattern: RegExp = new RegExp(singleQuoteString.source + '|' + doubleQuoteString.source);

/**
 * Regex patterns for comments
 */
const blockComment: RegExp = /\/\*[\s\S]*?\*\//;
const slashComment: RegExp = /\/[\/]+.*/;
const dashComment: RegExp = /\-[\-]+.*/;
const commentPattern: RegExp = new RegExp(blockComment.source + '|' + slashComment.source + '|' + dashComment.source);

/**
 * A CQL lexer/tokenizer
 */
export class Lexer {
    private lexer: moo.Lexer;

    constructor() {
        this.lexer = moo.compile({
            string: stringPattern,
            comment: commentPattern,
            uuid: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/,
            whitespace: { match: /[\s]+/, lineBreaks: true, multiline: true },
            // The symbol regex also matches whitespace, so it has to come after
            // the whitespace regex (since moo guarantees they will match in the
            // order they are listed)
            symbol: { match: /\W/, lineBreaks: true },
            identifierOrValue: /[a-zA-Z0-9_]+/
        });
    }

    /**
     * Lexes the input CQL, returning an array of tokens
     *
     * @param cql The input CQL
     * @param ignore Any token types to exclude from the return value
     */
    public getTokens(cql: string, ignore: string[] = []): Token[] {
        this.lexer.reset(cql);

        const tokens: Token[] = [];

        let token: moo.Token = this.lexer.next();

        while (token !== undefined) {
            if (!ignore.includes(token.type)) {
                tokens.push(token);
            }
            token = this.lexer.next();
        }

        return tokens;
    }

    /**
     * Lexes the input CQL, returning an array of tokens that are required for
     * reconstructing the CQL, i.e. remove the comment and whitespace tokens
     *
     * @param cql The input CQL
     */
    public getRequiredTokens(cql: string): Token[] {
        return this.getTokens(cql, optionalTokenTypes);
    }
}

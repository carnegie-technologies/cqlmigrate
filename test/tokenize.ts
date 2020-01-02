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
 * Tests for the cql lexer
 */

import 'mocha';
import 'should';

import { Lexer, Token } from '../src/lib/Lexer';

let lexer: Lexer;

// We need do create a bunch of multiline CQL strings for testing
// tslint:disable no-multiline-string

const createTableExpectedTokens: number = 50;
const createTableExpectedRequiredTokens: number = 27;
const createTableCql: string = `
/* Beginning comment */
CREATE TABLE foo.bar (
    baz text, /* multiline comment with dashes -- nice */
    bing set<text>, -- single line comment with dashes
    bork int, // single line comment with slashes

    PRIMARY KEY ((baz))
);
`;

const insertExpectedTokens: number = 40;
const insertExpectedRequiredTokens: number = 27;
const insertCql: string = `
/* Beginning comment */
INSERT INTO foo.bar (baz, bing, bork) VALUES ('foo''s', {'a','b','c'}, 23);
`;

function validateStringWithExpectedTokens(input: string, expectedTokens: string[]): void {
    const tokens: Token[] = lexer.getTokens(input);

    tokens.length.should.equal(expectedTokens.length);

    tokens.forEach((token: Token, index: number): void => {
        token.value.should.equal(expectedTokens[index]);
    });
}

/**
 * Mocha recommends avoiding arrow functions, since the Mocha context
 * won't be accessible in 'this'.
 */
// tslint:disable no-function-expression only-arrow-functions
describe('CQL Lexer', function(): void {
    before(function(): void {
        lexer = new Lexer();
    });

    it('should find the correct number of tokens (create table string)', function(): void {
        lexer.getTokens(createTableCql).length.should.equal(createTableExpectedTokens);
    });

    it('should find the correct number of required tokens (create table string)', function(): void {
        lexer.getRequiredTokens(createTableCql).length.should.equal(createTableExpectedRequiredTokens);
    });

    it('should find the correct number of tokens (insert string)', function(): void {
        lexer.getTokens(insertCql).length.should.equal(insertExpectedTokens);
    });

    it('should find the correct number of required tokens (insert string)', function(): void {
        lexer.getRequiredTokens(insertCql).length.should.equal(insertExpectedRequiredTokens);
    });

    it('should tokenize symbols correctly', function(): void {
        const symbols: string = '<>;:[]{}=+-)(,.?|';
        const expectedTokens: string[] =
            ['<', '>', ';', ':', '[', ']', '{', '}', '=', '+', '-', ')', '(', ',', '.', '?', '|'];

        validateStringWithExpectedTokens(symbols, expectedTokens);
    });

    it('should tokenize basic comments and newlines correctly', function(): void {
        const comments: string =
            `/* This is a comment */
/* This is a comment with dashes -- foobarbaz */
/* This is a comment with slashes // foobarbaz */
-- this is a single line comment
// this is a single line comment
----- this is a single line comment
///// this is a single line comment`;
        const expectedTokens: string[] = [
            '/* This is a comment */',
            '\n',
            '/* This is a comment with dashes -- foobarbaz */',
            '\n',
            '/* This is a comment with slashes // foobarbaz */',
            '\n',
            '-- this is a single line comment',
            '\n',
            '// this is a single line comment',
            '\n',
            '----- this is a single line comment',
            '\n',
            '///// this is a single line comment'
        ];

        validateStringWithExpectedTokens(comments, expectedTokens);
    });

    it('should tokenize complex comments correctly', function(): void {
        const embeddedCommentExpectedTokens: number = 2;
        const embeddedCommentExpectedRequiredTokens: number = 0;
        const embeddedComment: string = `
/**
 * // Comment within a comment
 */`;

        lexer.getTokens(embeddedComment).length.should.equal(embeddedCommentExpectedTokens);
        lexer.getRequiredTokens(embeddedComment).length.should.equal(embeddedCommentExpectedRequiredTokens);

        const badCommentExpectedTokens: number = 15;
        const badCommentExpectedRequiredTokens: number = 7;
        const badComment: string = `
//**
 * Comment within a comment
 */`;

        lexer.getTokens(badComment).length.should.equal(badCommentExpectedTokens);
        lexer.getRequiredTokens(badComment).length.should.equal(badCommentExpectedRequiredTokens);

        const trickyCommentExpectedTokens: number = 1;
        const trickyCommentExpectedRequiredTokens: number = 0;
        const trickyComment: string = '// Normal comment with */ fake ending /* */ embedded comment';

        lexer.getTokens(trickyComment).length.should.equal(trickyCommentExpectedTokens);
        lexer.getRequiredTokens(trickyComment).length.should.equal(trickyCommentExpectedRequiredTokens);
    });

    it('should tokenize basic strings correctly', function(): void {
        const strings: string = `'this is a string' 'string with
a newline' 'string with escaped quote: dog''s'`;
        const expectedTokens: string[] = [
            `'this is a string'`,
            ' ',
            `'string with\na newline'`,
            ' ',
            `'string with escaped quote: dog''s'`
        ];

        validateStringWithExpectedTokens(strings, expectedTokens);
    });

    it('should tokenize complex strings correctly', function(): void {
        const stringWithComment: string = `'A string with a // comment inside'`;
        const stringWithCommentExpectedTokens: string[] = [stringWithComment];

        validateStringWithExpectedTokens(stringWithComment, stringWithCommentExpectedTokens);

        const quoteInDoubleQuotes: string = `"There is 'quotes' in this string"`;
        const quoteInDoubleQuotesExpectedTokens: string[] = [quoteInDoubleQuotes];

        validateStringWithExpectedTokens(quoteInDoubleQuotes, quoteInDoubleQuotesExpectedTokens);

        const quoteInSingleQuotes: string = `'There is "quotes" in this string'`;
        const quoteInSingleQuotesExpectedTokens: string[] = [quoteInSingleQuotes];

        validateStringWithExpectedTokens(quoteInSingleQuotes, quoteInSingleQuotesExpectedTokens);
    });

    it('should tokenize identifiers and other keywords correctly', function(): void {
        const keywords: string = `foo int text var SOME keyWoRd name_with_underscores`;
        const expectedTokens: string[] = [
            'foo',
            ' ',
            'int',
            ' ',
            'text',
            ' ',
            'var',
            ' ',
            'SOME',
            ' ',
            'keyWoRd',
            ' ',
            'name_with_underscores'
        ];

        validateStringWithExpectedTokens(keywords, expectedTokens);
    });
});
// tslint:enable no-function-expression only-arrow-functions
// tslint:enable no-multiline-string

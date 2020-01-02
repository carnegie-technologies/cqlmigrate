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
 * Tests for the cql canonicalizer
 */

import { canonicalizeCql } from '../src/lib/util';

// We need do create a bunch of multiline CQL strings for testing
// tslint:disable no-multiline-string

const createTableCql: string = `
/* Beginning comment */
CREATE TABLE foo.bar (
    baz text, /* multiline comment with dashes -- nice */
    bing set<text>, -- single line comment with dashes
    bork int, // single line comment with slashes

    PRIMARY KEY ((baz))
);
`;

const insertCql: string = `
/* Beginning comment */
INSERT INTO foo.bar (baz, bing, bork) VALUES ('foo''s', {'a','b','c'}, 23);
`;

/**
 * Mocha recommends avoiding arrow functions, since the Mocha context
 * won't be accessible in 'this'.
 */
// tslint:disable no-function-expression only-arrow-functions
describe('CQL Canonicalizer', function(): void {
    it('should canonicalize create table string correctly', function(): void {
        canonicalizeCql(createTableCql).should.equal(
            'CREATE TABLE foo . bar ( baz text , bing set < text > , bork int , PRIMARY KEY ( ( baz ) ) ) ;'
        );
    });

    it('should canonicalize insert string correctly', function(): void {
        canonicalizeCql(insertCql).should.equal(
            `INSERT INTO foo . bar ( baz , bing , bork ) VALUES ( 'foo''s' , { 'a' , 'b' , 'c' } , 23 ) ;`
        );
    });
});
// tslint:enable no-function-expression only-arrow-functions
// tslint:enable no-multiline-string

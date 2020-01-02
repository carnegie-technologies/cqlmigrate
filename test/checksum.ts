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
 * Tests for the checksum function. We just test that some fixed strings always
 * return the same checksum values, so the build will fail if the checksum
 * function ever changes or behaves different on a different platform.
 */

import 'mocha';
import 'should';

import { getCqlChecksum } from '../src/lib/util';

/**
 * Mocha recommends avoiding arrow functions, since the Mocha context
 * won't be accessible in 'this'.
 */
// tslint:disable no-function-expression only-arrow-functions
describe('Checksum', function(): void {
    it('should calculate the correct checksum for fixed strings', function(): void {
        getCqlChecksum('this is some string').should.equal('0e1eb663ad4cbb70b7d262f813bfbec4');
        getCqlChecksum('this is another string').should.equal('7cd1136eb26ea58d5ac6762168db7f7f');
        getCqlChecksum('foo bar baz').should.equal('ab07acbb1e496801937adfa772424bf7');
    });
});
// tslint:enable no-function-expression only-arrow-functions

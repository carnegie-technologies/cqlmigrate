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
 * Logger functions
 */

import { config } from '../config';

/**
 * A centralized place to store logger
 */

// tslint:disable: no-any
/**
 * Log to stdout
 */
export function info(message: any): void {
    console.log(message);
}

/**
 * Log to stderr
 */
export function error(message: any): void {
    console.error(message);
}

/**
 * Log to stdout if debug is set to true
 */
export function debug(message: any): void {
    if (config.get('debug') === true) {
        console.log(message);
    }
}

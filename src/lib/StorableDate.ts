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
 * Defines the desired way to represent this type in the data store
 */
export enum STORAGE_METHOD {
    TIMESTAMP,  // If you want to persist both the date and the time of the JavaScript Date
    UUID,       // If you want to persist both the date and the time as a UUID
    DATE_ONLY   // If you want to persist only the date and not the time portion of the JavaScript Date
}

/**
 * Wraps a JavaScript Date object with some additional information about how it should be stored
 */
export class StorableDate {
    /**
     * The date value representing both the date and the time
     */
    protected date: Date;

    /**
     * The way to represent this date in the data store. Default: TIMESTAMP
     */
    protected storageMethod: STORAGE_METHOD;

    /**
     * Wraps a JavaScript data object with some additional information about how it should be stored
     *
     * @param date           the JavaScript Date object to wrap
     * @param storageMethod  the desired storage method
     */
    constructor(date: Date, storageMethod: STORAGE_METHOD = STORAGE_METHOD.TIMESTAMP) {
        this.date = date;
        this.storageMethod = storageMethod;
    }

    /**
     * Returns the wrapped date object stored by this object
     */
    public getDate(): Date {
        return this.date;
    }

    /**
     * Returns how this date should be represented when it is saved by the data store
     */
    public getStorageMethod(): STORAGE_METHOD {
        return this.storageMethod;
    }

}

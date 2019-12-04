import { ThreadedClass, ThreadedClassConfig } from './api';
declare type CtorArgs<CtorT extends new (...args: any) => any> = CtorT extends new (...args: infer K) => any ? K : never;
/**
 * Returns an asynchronous version of the provided class
 * @param orgModule Path to imported module (this is what is in the require('XX') function, or import {class} from 'XX'} )
 * @param orgClass The class to be threaded
 * @param constructorArgs An array of arguments to be fed into the class constructor
 */
export declare function threadedClass<T, TCtor extends new (...args: any) => T>(orgModule: string, orgClass: TCtor, constructorArgs: CtorArgs<TCtor>, config?: ThreadedClassConfig): Promise<ThreadedClass<T>>;
export {};

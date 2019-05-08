import { ThreadedClass, ThreadedClassConfig } from './api';
/**
 * Returns an asynchronous version of the provided class
 * @param orgModule Path to imported module (this is what is in the require('XX') function, or import {class} from 'XX'} )
 * @param orgClass The class to be threaded
 * @param constructorArgs An array of arguments to be fed into the class constructor
 */
export declare function threadedClass<T>(orgModule: string, orgClass: Function, constructorArgs: any[], config?: ThreadedClassConfig): Promise<ThreadedClass<T>>;

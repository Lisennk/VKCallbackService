// TODO move to import/export once native Node.js supports it

const stringifySafe = require('json-stringify-safe');

class Logger {
    constructor (...args) {
        this.prefixesString = '';

        args.forEach((argument) => {
            this.prefixesString += `[${argument}]`;
        });
    }

    info (...args) {
        console.log(`[\u{1b}[1;30mINFO\u{1b}[0m]${this.prefixesString} ${this._combineArgsToString(args)}`);
        return this;
    }

    warn (...args) {
        console.log(`[\u{1b}[1;33mWARN\u{1b}[0m]${this.prefixesString} ${this._combineArgsToString(args)}`);
        return this;
    }

    error (...args) {
        console.log(`[\u{1b}[0;31mERROR\u{1b}[0m]${this.prefixesString} ${this._combineArgsToString(args)}`);
        return this;
    }

    crash (...args) {
        console.log(`[\u{1b}[1;31mCRASH\u{1b}[0m]${this.prefixesString} ${this._combineArgsToString(args)}`);
        process.exit(-1);
    }

    _combineArgsToString (args) {
        let str = '';
        args.forEach((argument) => {
            if (argument instanceof Object) {
                str += stringifySafe(argument) + ' ';
            } else {
                str += String(argument) + ' ';
            }
        });
        return str;
    }
}

module.exports = Logger;

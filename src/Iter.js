function toInteger(n) {
    if (n < 0) {
        return Math.ceil(n);
    }
    return Math.floor(n);
}

function toPositiveInteger(n) {
    if (n < 0) {
        return 0;
    }
    return Math.floor(n);
}

export default class Iter {
    constructor (iterable) {
        let iterator = Iter.getIterator(typeof iterable === 'function' ? iterable() : iterable);
        
        this[Symbol.iterator] = () => iterator;
    }
    
    static getIterator (obj) {
        return obj[Symbol.iterator]();
    }

    static isIterator (obj) {
        return (Iter.isIterable(obj) && typeof obj.next === 'function');
    }

    static isIterable (obj = null) {
        return (obj !== null && typeof obj[Symbol.iterator] === 'function');
    }

    static isMultiIterable (obj) {
        return (Iter.isIterable(obj) && Iter.getIterator(obj) !== Iter.getIterator(obj));
    }

    static isClosable (iterator) {
        return (Iter.isIterator(iterator) && typeof iterator.return === 'function');
    }

    static closeIterator (iterator) {
        if (Iter.isClosable(iterator)) {
            return Boolean(iterator.return().done);
        }
        return false;
    }

    static closeAllIterators (...iterators) {
        for (let it of iterators) {
            Iter.closeIterator(it);
        }
    }
    
    static range (start, end, step) {
        return new Iter(function* () {
            let s = toInteger(start),
                e = toInteger(end);
                
            if (typeof end == 'undefined') {
                e = s;
                s = 0;
            }
            
            let k = toInteger(step) || (s < e ? 1 : -1)
            
            if (k > 0) {
                while (s < e) {
                    yield s;
                    s += k;
                }
            }
            else {
                while (s > e) {
                    yield s;
                    s += k;
                }        
            }
        });
    }
    
    static count (start, step) {
        return new Iter(function* () {
            let s = toInteger(start) || 0,
                k = toInteger(step) || 1;
            while (true) {
                yield s;
                s += k;
            }
        });
    }

    static cycle (iterable) {
        let iterator = Iter.getIterator(iterable);
        
        return new Iter(function* () {
            let arr = [];
            for (let v of iterator) {
                yield v;
                arr.push(v);
            }
            while (true) {
                yield* arr;
            }
        });
    }

    static repeat (val, times = Infinity) {
        return new Iter(function* () {
            for (let i of Iter.range(toPositiveInteger(times))) {
                yield val;
            }
        });
    }
    
    toArray () {
        return [...Iter.getIterator(this)];        
    }
    
    zip (...iterables) {
        let iterators = [this, ...iterables].map(Iter.getIterator),
            done = iterables.length;
        
        return new Iter(function* () {
            try {
                while (done) {
                    let res = [];
                    for (let it of iterators) {
                        let curr = it.next();
                        if (curr.done) {
                            for (let i of iterators) {
                                if (i !== it) Iter.closeIterator(i);
                            }
                            return;
                        }
                        res.push(curr.value);
                    }
                    yield res;
                }
            } finally {
                Iter.closeAllIterators(...iterators);
            }
        });
    }
    
    longestZip (...iterables) {
        let iterators = [this, ...iterables].map(Iter.getIterator),
            map       = new Map(new Iter(iterators).zip(Iter.repeat(false))),
            count     = 0,
            done      = iterators.length;
        
        return new Iter(function* () {    
            try {    
                while (done) {
                    let res = [];
                    for (let it of iterators) {
                        let curr = it.next();
                        if (curr.done && !map.get(it)) {
                            map.set(it, true);
                            count++;
                        }
                        res.push(curr.value);
                    }
                    if (count >= iterators.length) {
                        return;
                    } 
                    yield res;
                }
            } finally {
                Iter.closeAllIterators(...iterators);
            }
        });
    }
    
    enumerate (start = 0) {
        return Iter.count(start).zip(this);
    }
    
    accumulate (callback = (x, y) => x + y) {
        let iterator = Iter.getIterator(this);
        
        return new Iter(function* () {
            try {
                let next = iterator.next(),
                    acc = next.value;
                if (!next.done) {
                    yield acc;
                }
                while (!( next = iterator.next() ).done) {
                    acc = callback(acc, next.value);
                    yield acc;
                }
            } finally {
                Iter.closeIterator(iterator);
            }
        });
    }
    
    chain (...iterables) {
        let iterators = [this, ...iterables].map(Iter.getIterator);
        
        return new Iter(function* () {
            for (let it of iterators) {
                yield* it;
            }
        });
    }
    
    compress (selectors) {
        let iterator = this.zip(selectors);
        
        return new Iter(function* () {
            for (let [v, s] of iterator) {
                if (s) yield v;
            }
        });
    }
    
    groupBy (key = (x) => x) {
        let iterator = Iter.getIterator(this);
        
        return new Iter(function* () {
            let k = {};
            let arr = [];
            
            for (let v of iterator) {
                let res = key(v);
                if (res !== k) {
                    if (arr.length) {
                        yield [k, arr];
                    }
                    arr = [];
                    k = res;
                }
                arr.push(v);
            }
            if (arr.length) {
                yield [k, arr];
            }        
        });
    }
    
    zipMap (...iterables) {
        let callback = iterables[iterables.length - 1];
        
        if (typeof callback != 'function') {
            return this.zip(...iterables);
        }
        else {
            let iterator = this.zip(...iterables.slice(0, -1));
            return new Iter(function* (){
                for (let arr of iterator) {
                    yield callback(...arr);
                }
            });
        }
    }
    
    longestZipMap (...iterables) {
        let callback = iterables[iterables.length - 1];
        
        if (typeof callback != 'function') {
            return this.longestZip(...iterables);
        }
        else {    
            let iterator = this.longestZip(...iterables.slice(0, -1));
            return new Iter(function* () {
                for (let arr of iterator) {
                    yield callback(...arr);
                }
            });
        }
    }
    
    spreadMap (callback) {
        let iterator = Iter.getIterator(this);
        
        return new Iter(function* () {
            for (let arr of iterator) {
                yield callback(...arr);
            }
        });
    }
    
    take (n = Infinity) {
        let iterator = Iter.getIterator(this);
        
        return new Iter(function* () {
            let count = toPositiveInteger(n);
            for (let v of iterator) {
                if (count-- > 0) {
                    yield v;
                    continue;
                }
                break;
            }
        });
    }
    
    takeWhile (callback = Boolean) {
        let iterator = Iter.getIterator(this);
        
        return new Iter(function* () {
            for (let v of iterator) {
                if (callback(v)) {
                    yield v;
                }
                else {
                    break;
                }
            }
        });
    }
    
    drop (n = Infinity) {
        let iterator = Iter.getIterator(this);
        
        return new Iter(function* () {
            let count = toPositiveInteger(n);
            for (let v of iterator) {
                if (count-- > 0) {
                    continue;
                }
                yield v;
            }
        });
    }
    
    dropWhile (callback = Boolean) {
        let iterator = Iter.getIterator(this);
        
        return new Iter(function* () {
            for (let v of iterator) {
                if (!callback(v)) {
                    yield v;
                    yield* iterator;
                    break;
                }
            }
        });
    }
    
    filter (callback = Boolean) {
        let iterator = Iter.getIterator(this);
        
        return new Iter(function* () {
            for (let v of iterator) {
                if (callback(v)) {
                    yield v;
                }
            }
        });
    }
    
    filterFalse (callback = Boolean) {
        let iterator = Iter.getIterator(this);
        
        return new Iter(function* () {
            for (let v of iterator) {
                if (!callback(v)) {
                    yield v;
                }
            }
        });
    }
    
    product (a = [], ...iterables) {
        let arr = [this, a, ...iterables].map((it) => Iter.isMultiIterable(it) ? it : [...it]),
            len = arr.length,
            res = [];
        
        return new Iter(function* gen(idx = 0) {
            if (idx >= len) {
                yield res.slice();
                return;
            }
            for (let v of arr[idx]) {
                res[idx] = v;
                yield* gen(idx + 1);
            }
        });
    }
    
    permutations (r) {
        let arr = this.toArray(),
            map = new Map(),
            res = [],
            len =  Math.min(toPositiveInteger(r), arr.length);
            
        if (Number.isNaN(len)) {
            len = arr.length;
        }
        
        return new Iter(function* gen(idx = 0) {
            if (idx >= len) {
                yield res.slice();
                return;
            }
            for (let [i, v] of new Iter(arr).enumerate(arr)) {
                if (!map.has(i)) {
                    map.set(i, true);
                    res[idx] = v;
                    yield* gen(idx + 1);
                    map.delete(i);
                }
            }
        });
    }
    
    combinations (r) {
        let arr = this.toArray(),
            len = toPositiveInteger(r),
            res = [];

        return new Iter(function* gen(idx = 0, start = 0) {
            if (idx >= len) {
                yield res.slice();
                return;
            }
            for (let i = start, l = arr.length; i < l; i++) {
                res[idx] = arr[i];
                yield* gen(idx + 1, i + 1);
            }
        });
    }
}


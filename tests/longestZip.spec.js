import './auto_mock_off';
import 'babel/polyfill';
import Iter from '../src/Iter';

describe('longestZip', () => {
    function* gen(n) {
        for (let i = 0; i < n; i++) {
            yield n;
        }
    }
    
    it('packs array with length equal to number of iterables', () => {
        let arr = [...new Iter([1]).longestZip([2], [3])];
        
        expect(Array.isArray(arr[0])).toBe(true);
        expect(arr[0].length).toBe(3);
    })
    
    it('stops when longest iterable is exhausted', () => {
        let arr = [...new Iter(gen(3)).longestZip(gen(10))];
        
        expect(arr.length).toBe(10);
    })
    
    it('yields undefined if shorter iterator is exhausted', () => {
        for (let [i, v] of new Iter(gen(0)).longestZip(gen(10))) {
            expect(i).toBe(undefined);
        }
    })
    
    it('closes all closable iterators on abrupt exits', () => {
        let iter1 = gen(4),
            iter2 = gen(20);
        
        for (let [i, j] of new Iter(iter1).longestZip(iter2)) {
            break;
        }
        
        let res1 = [...iter1],
            res2 = [...iter2];
            
        expect(res1.length).toBe(0);
        expect(res2.length).toBe(0);        
    })
    
    it('throws TypeError if argument is not iterable', () => {
        var err = {};
        
        try {
            new Iter([]).longestZip(null, 1234)
        } catch (e) {
            err = e;
        }
        expect(err instanceof TypeError).toBe(true);
    })
})

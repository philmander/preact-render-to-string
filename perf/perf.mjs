import preact from 'preact';
import renderToString from '../src/index';
import renderToStringOriginal from '../src/index-original';
import Benchmark from 'benchmark';

const createApp = function createApp(h) {
    return function (items) {
        return h(
            'div',
            { 'class': 'foo' },
            h(
                'h1',
                null,
                'Hi!'
            ),
            h(
                'p',
                null,
                'Here is a list of ',
                items.length,
                ' items:'
            ),
            h(
                'ul',
                null,
                items.map(function (item) {
                    return h(
                        'li',
                        null,
                        item
                    );
                })
            )
        );
    };
};


const PreactApp = createApp(preact.h);

let items = [];
for (let i=500; i--; ) {
    items.push(i);
}

new Benchmark.Suite()
    .add('renderToString', function() {
        renderToString(PreactApp(items));
    })
    .add('renderToStringOriginal', function() {
        renderToStringOriginal(PreactApp(items));
    })
    .on('complete', function () {
        this.forEach(r => console.log(r.toString()));
    })
    // run async
    .run({ 'async': true });
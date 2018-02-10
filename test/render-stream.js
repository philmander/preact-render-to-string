import { renderToStream, shallowRender } from '../src';
import { h, Component } from 'preact';
import chai, { expect } from 'chai';
import { spy, stub, match } from 'sinon';
import sinonChai from 'sinon-chai';
chai.use(sinonChai);

function streamToString(stream) {
	return new Promise((resolve, reject) => {
		let result = '', count = 0;
		stream.on('data', chunk => {
			count++;
			result += chunk;
		});
		stream.on('error', err => {
			reject(err);
		});
		stream.on('end', () => {
			resolve({
				result,
				count
			});
		});
	});
}

async function render(...args) {
	let rendered = await streamToString(renderToStream(...args));
	return rendered.result;
}

describe('render', () => {
	describe('Basic JSX', () => {
		it('should render JSX', async () => {
			let rendered = await render(<div class="foo">bar</div>),
				expected = `<div class="foo">bar</div>`;

			expect(rendered).to.equal(expected);
		});

		describe('whitespace', () => {
			it('should omit whitespace between elements', async () => {
				let children = [];
				for (let i=0; i<1000; i++) {
					children.push(Math.random()>.5 ? String(i) : h('x-'+String(i), null, i));
				}
				let rendered = await render(
					<div class="foo">
						x
						<a>a</a>
						<b>b</b>
						c
						{children}
						d
					</div>
				);

				expect(rendered).not.to.contain(/\s/);
			});

			it('should not indent when attributes contain newlines', async () => {
				let rendered = await render(
					<div class={`foo\n\tbar\n\tbaz`}>
						<a>a</a>
						<b>b</b>
						c
					</div>
				);

				expect(rendered).to.equal(`<div class="foo\n\tbar\n\tbaz"><a>a</a><b>b</b>c</div>`);
			});
		});

		it('should omit falsey attributes', async () => {
			let rendered = await render(<div a={null} b={undefined} c={false} />),
				expected = `<div></div>`;

			expect(rendered).to.equal(expected);

			expect(await render(<div foo={0} />)).to.equal(`<div foo="0"></div>`);
		});

		it('should collapse collapsible attributes', async () => {
			let rendered = await render(<div class="" style="" foo={true} bar />),
				expected = `<div class style foo bar></div>`;

			expect(rendered).to.equal(expected);
		});

		it('should omit functions', async () => {
			let rendered = await render(<div a={()=>{}} b={function(){}} />),
				expected = `<div></div>`;

			expect(rendered).to.equal(expected);
		});

		it('should encode entities', async () => {
			let rendered = await render(<div a={'"<>&'}>{'"<>&'}</div>),
				expected = `<div a="&quot;&lt;&gt;&amp;">&quot;&lt;&gt;&amp;</div>`;

			expect(rendered).to.equal(expected);
		});

		it('should omit falsey children', async () => {
			let rendered = await render(<div>{null}|{undefined}|{false}</div>),
				expected = `<div>||</div>`;

			expect(rendered).to.equal(expected);
		});

		it('should self-close void elements', async () => {
			let rendered = await render(<div><input type='text' /><wbr /></div>),
				expected = `<div><input type="text" /><wbr /></div>`;

			expect(rendered).to.equal(expected);
		});

		it('does not close void elements with closing tags', async () => {
			let rendered = await render(<input><p>Hello World</p></input>),
				expected = `<input /><p>Hello World</p>`;

			expect(rendered).to.equal(expected);
		});

		it('should serialize object styles', async () => {
			let rendered = await render(<div style={{ color:'red', border:'none' }} />),
				expected = `<div style="color: red; border: none;"></div>`;

			expect(rendered).to.equal(expected);
		});

		it('should ignore empty object styles', async () => {
			let rendered = await render(<div style={{}} />),
				expected = `<div></div>`;

			expect(rendered).to.equal(expected);
		});

		it('should render SVG elements', async () => {
			let rendered = await render((
				<svg>
					<image xlinkHref="#" />
					<foreignObject>
						<div xlinkHref="#" />
					</foreignObject>
					<g>
						<image xlinkHref="#" />
					</g>
				</svg>
			));

			expect(rendered).to.equal(`<svg><image xlink:href="#"></image><foreignObject><div xlinkHref="#"></div></foreignObject><g><image xlink:href="#"></image></g></svg>`);
		});
	});

	describe('Functional Components', () => {
		it('should render functional components', async () => {
			let Test = spy( ({ foo, children }) => <div foo={foo}>{ children }</div> );

			let rendered = await render(<Test foo="test">content</Test>);

			expect(rendered)
				.to.equal(`<div foo="test">content</div>`);

			expect(Test)
				.to.have.been.calledOnce
				.and.calledWithExactly(
					match({
						foo: 'test',
						children: ['content']
					}),
					match({})
				);
		});

		it('should render functional components within JSX', async () => {
			let Test = spy( ({ foo, children }) => <div foo={foo}>{ children }</div> );

			let rendered = await render(
				<section>
					<Test foo={1}><span>asdf</span></Test>
				</section>
			);

			expect(rendered)
				.to.equal(`<section><div foo="1"><span>asdf</span></div></section>`);

			expect(Test)
				.to.have.been.calledOnce
				.and.calledWithExactly(
					match({
						foo: 1,
						children: [
							match({ nodeName:'span', children:['asdf'] })
						]
					}),
					match({})
				);
		});

		it('should apply defaultProps', async () => {
			const Test = props => <div {...props} />;
			Test.defaultProps = {
				foo: 'default foo',
				bar: 'default bar'
			};

			expect(await render(<Test />), 'defaults').to.equal('<div foo="default foo" bar="default bar"></div>');
			expect(await render(<Test bar="b" />), 'partial').to.equal('<div foo="default foo" bar="b"></div>');
			expect(await render(<Test foo="a" bar="b" />), 'overridden').to.equal('<div foo="a" bar="b"></div>');
		});
	});

	describe('Classical Components', () => {
		it('should render classical components', async () => {
			let Test = spy(class Test extends Component {
				render({ foo, children }, state) {
					return <div foo={foo}>{ children }</div>;
				}
			});
			spy(Test.prototype, 'render');

			let rendered = await render(<Test foo="test">content</Test>);

			const PROPS = {
				foo: 'test',
				children: ['content']
			};

			expect(rendered)
				.to.equal(`<div foo="test">content</div>`);

			expect(Test)
				.to.have.been.calledOnce
				.and.calledWith(match(PROPS), match({}));

			expect(Test.prototype.render)
				.to.have.been.calledOnce
				.and.calledWithExactly(
					match(PROPS),
					match({}),	// empty state
					match({})	// empty context
				);
		});

		it('should render classical components within JSX', async () => {
			let Test = spy(class Test extends Component {
				render({ foo, children }, state) {
					return <div foo={foo}>{ children }</div>;
				}
			});

			spy(Test.prototype, 'render');

			let rendered = await render(
				<section>
					<Test foo={1}><span>asdf</span></Test>
				</section>
			);

			expect(rendered)
				.to.equal(`<section><div foo="1"><span>asdf</span></div></section>`);

			expect(Test).to.have.been.calledOnce;

			expect(Test.prototype.render)
				.to.have.been.calledOnce
				.and.calledWithExactly(
					match({
						foo: 1,
						children: [
							match({ nodeName:'span', children:['asdf'] })
						]
					}),
					match({}),	// empty state
					match({})
				);
		});

		it('should apply defaultProps', async () => {
			class Test extends Component {
				static defaultProps = {
					foo: 'default foo',
					bar: 'default bar'
				};
				render(props) {
					return <div {...props} />;
				}
			}

			expect(await render(<Test />), 'defaults').to.equal('<div foo="default foo" bar="default bar"></div>');
			expect(await render(<Test bar="b" />), 'partial').to.equal('<div foo="default foo" bar="b"></div>');
			expect(await render(<Test foo="a" bar="b" />), 'overridden').to.equal('<div foo="a" bar="b"></div>');
		});

		it('should invoke componentWillMount', async () => {
			class Test extends Component {
				componentWillMount() {}
				render(props) {
					return <div {...props} />;
				}
			}
			spy(Test.prototype, 'componentWillMount');
			spy(Test.prototype, 'render');

			await render(<Test />);

			expect(Test.prototype.componentWillMount)
				.to.have.been.calledOnce
				.and.to.have.been.calledBefore(Test.prototype.render);
		});

		it('should pass context to grandchildren', async () => {
			const CONTEXT = { a:'a' };
			const PROPS = { b:'b' };

			class Outer extends Component {
				getChildContext() {
					return CONTEXT;
				}
				render(props) {
					return <div><Inner {...props} /></div>;
				}
			}
			spy(Outer.prototype, 'getChildContext');

			class Inner extends Component {
				render(props, state, context) {
					return <div>{ context && context.a }</div>;
				}
			}
			spy(Inner.prototype, 'render');

			await render(<Outer />);

			expect(Outer.prototype.getChildContext).to.have.been.calledOnce;
			expect(Inner.prototype.render).to.have.been.calledWith(match({}), {}, CONTEXT);

			CONTEXT.foo = 'bar';
			await render(<Outer {...PROPS} />);

			expect(Outer.prototype.getChildContext).to.have.been.calledTwice;
			expect(Inner.prototype.render).to.have.been.calledWith(match(PROPS), {}, CONTEXT);
		});

		it('should pass context to direct children', async () => {
			const CONTEXT = { a:'a' };
			const PROPS = { b:'b' };

			class Outer extends Component {
				getChildContext() {
					return CONTEXT;
				}
				render(props) {
					return <Inner {...props} />;
				}
			}
			spy(Outer.prototype, 'getChildContext');

			class Inner extends Component {
				render(props, state, context) {
					return <div>{ context && context.a }</div>;
				}
			}
			spy(Inner.prototype, 'render');

			await render(<Outer />);

			expect(Outer.prototype.getChildContext).to.have.been.calledOnce;
			expect(Inner.prototype.render).to.have.been.calledWith(match({}), {}, CONTEXT);

			CONTEXT.foo = 'bar';
			await render(<Outer {...PROPS} />);

			expect(Outer.prototype.getChildContext).to.have.been.calledTwice;
			expect(Inner.prototype.render).to.have.been.calledWith(match(PROPS), {}, CONTEXT);

			// make sure render() could make use of context.a
			expect(Inner.prototype.render).to.have.returned(match({ children:['a'] }));
		});

		it('should preserve existing context properties when creating child contexts', async () => {
			let outerContext = { outer:true },
				innerContext = { inner:true };
			class Outer extends Component {
				getChildContext() {
					return { outerContext };
				}
				render() {
					return <div><Inner /></div>;
				}
			}

			class Inner extends Component {
				getChildContext() {
					return { innerContext };
				}
				render() {
					return <InnerMost />;
				}
			}

			class InnerMost extends Component {
				render() {
					return <strong>test</strong>;
				}
			}

			spy(Inner.prototype, 'render');
			spy(InnerMost.prototype, 'render');

			await render(<Outer />);

			expect(Inner.prototype.render).to.have.been.calledWith(match({}), {}, { outerContext });
			expect(InnerMost.prototype.render).to.have.been.calledWith(match({}), {}, { outerContext, innerContext });
		});
	});

	describe('High-order components', () => {
		class Outer extends Component {
			render({ children, ...props }) {
				return <Inner {...props} a="b">child <span>{ children }</span></Inner>;
			}
		}

		class Inner extends Component {
			render({ children, ...props }) {
				return <div id="inner" {...props} b="c" c="d">{ children }</div>;
			}
		}

		it('should resolve+render high order components', async () => {
			let rendered = await render(<Outer a="a" b="b" p={1}>foo</Outer>);
			expect(rendered).to.equal('<div id="inner" a="b" b="c" p="1" c="d">child <span>foo</span></div>');
		});

		it('should render child inline when shallow=true', () => {
			let rendered = shallowRender(<Outer a="a" b="b" p={1}>foo</Outer>);
			expect(rendered).to.equal('<Inner a="b" b="b" p="1">child <span>foo</span></Inner>');
		});

		it('should render nested high order components when shallowHighOrder=false', async () => {
			// using functions for meaningful generation of displayName
			function Outer() { return <Middle />; }
			function Middle() { return <div><Inner /></div>; }
			function Inner() { return 'hi'; }

			let rendered = await render(<Outer />);
			expect(rendered).to.equal('<div>hi</div>');

			rendered = await render(<Outer />, null, { shallow:true });
			expect(rendered, '{shallow:true}').to.equal('<Middle></Middle>');

			rendered = await render(<Outer />, null, { shallow:true, shallowHighOrder:false });
			expect(rendered, '{shallow:true,shallowHighOrder:false}').to.equal('<div><Inner></Inner></div>', 'but it should never render nested grandchild components');
		});
	});

	describe('dangerouslySetInnerHTML', () => {
		it('should support dangerouslySetInnerHTML', async () => {
			// some invalid HTML to make sure we're being flakey:
			let html = '<a href="foo">asdf</a> some text <ul><li>foo<li>bar</ul>';
			let rendered = await render(<div id="f" dangerouslySetInnerHTML={{__html:html}} />);
			expect(rendered).to.equal(`<div id="f">${html}</div>`);
		});

		it('should override children', async () => {
			let rendered = await render(<div dangerouslySetInnerHTML={{__html:'foo'}}><b>bar</b></div>);
			expect(rendered).to.equal('<div>foo</div>');
		});
	});

	describe('className / class massaging', () => {
		it('should render class using className', async () => {
			let rendered = await render(<div className="foo bar" />);
			expect(rendered).to.equal('<div class="foo bar"></div>');
		});

		it('should render class using class', async () => {
			let rendered = await render(<div class="foo bar" />);
			expect(rendered).to.equal('<div class="foo bar"></div>');
		});

		it('should prefer class over className', async () => {
			let rendered = await render(<div class="foo" className="foo bar" />);
			expect(rendered).to.equal('<div class="foo"></div>');
		});

		it('should stringify object classNames', async () => {
			let rendered = await render(<div class={{ foo:1, bar:0, baz:true, buzz:false }} />);
			expect(rendered, 'class').to.equal('<div class="foo baz"></div>');

			rendered = await render(<div className={{ foo:1, bar:0, baz:true, buzz:false }} />);
			expect(rendered, 'className').to.equal('<div class="foo baz"></div>');
		});
	});

	describe('sortAttributes', () => {
		it('should leave attributes unsorted by default', async () => {
			let rendered = await render(<div b1="b1" c="c" a="a" b="b" />);
			expect(rendered).to.equal('<div b1="b1" c="c" a="a" b="b"></div>');
		});

		it('should sort attributes lexicographically if enabled', async () => {
			let rendered = await render(<div b1="b1" c="c" a="a" b="b" />, null, { sortAttributes:true });
			expect(rendered).to.equal('<div a="a" b="b" b1="b1" c="c"></div>');
		});
	});

	describe('xml:true', () => {
		let renderXml = jsx => render(jsx, null, { xml:true });

		it('should render end-tags', async () => {
			expect(await renderXml(<div />)).to.equal(`<div />`);
			expect(await renderXml(<a />)).to.equal(`<a />`);
			expect(await renderXml(<a>b</a>)).to.equal(`<a>b</a>`);
		});

		it('should render boolean attributes with named values', async () => {
			expect(await renderXml(<div foo bar />)).to.equal(`<div foo="foo" bar="bar" />`);
		});

		it('should exclude falsey attributes', async () => {
			expect(await renderXml(<div foo={false} bar={0} />)).to.equal(`<div bar="0" />`);
		});
	});

	describe('state locking', () => {
		it('should set _disable and __x to true', async () => {
			let inst;
			class Foo extends Component {
				constructor(props, context) {
					super(props, context);
					inst = this;
				}
				render() {
					return <div />;
				}
			}

			expect(await render(<Foo />)).to.equal('<div></div>');

			expect(inst).to.have.property('_disable', true);
			expect(inst).to.have.property('__x', true);
		});

		it('should prevent re-rendering', async () => {
			const Bar = stub().returns(<div />);

			let count = 0;

			class Foo extends Component {
				componentWillMount() {
					this.forceUpdate();
				}
				render() {
					return <Bar count={++count} />;
				}
			}

			expect(await render(<Foo />)).to.equal('<div></div>');

			expect(Bar).to.have.been.calledOnce.and.calledWithMatch({ count: 1 });
		});
	});

	describe('streaming chunks', () => {
		it('renders in the expected number of chunks', async () => {
			class Bar extends Component {
				componentWillMount() {
					this.forceUpdate();
				}
				render({ children }) {
					return <div class="bar"> {children} </div>;
				}
            }
			let count = 0;

			class Foo extends Component {
				componentWillMount() {
					this.forceUpdate();
				}
				render() {
					return count <= 3 ? <div class="foo"><Foo count={++count} /></div> : '';
				}
            }

			let rendered = await streamToString(renderToStream(<div><Bar><Foo/></Bar></div>));
			expect(rendered.count).to.equal(119);
		});
	});
});
